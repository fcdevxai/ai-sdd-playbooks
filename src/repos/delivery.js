/**
 * Multi-repo delivery aggregation (design §"Public contracts", ADR
 * multi-repo-delivery-reduction). The lifecycle engine stays PURE (Principio
 * 2): this module computes the `deliveryStatus` OUTSIDE the engine and hands
 * it in as the same input `resolveDelivery` already produced for single-repo.
 *
 * Fail-closed end to end (Principio 3 / C-01 / C-10): `merged` is reachable
 * only when every impacted repo (hub included) reports `merged`. Any
 * uncertainty — an unresolvable path, an unreachable GitHub context — pulls
 * the aggregate down to `unknown`, never up to `merged`.
 */
import { resolveDelivery } from '../github/index.js';
import { readImpactedRepos, defaultChangesDir } from './impacted.js';
import { resolveConfiguredRepoPath, resolveSddRepo } from './config.js';

// Precedence order for the "weakest link" reduction — the first matching
// condition wins. `merged` (last) requires unanimity by construction: it's
// only reached when nothing worse is present among the states.
const PRECEDENCE = ['unknown', 'ci_failed', 'uncommitted', 'committed', 'ci_pending', 'ci_passed', 'merged'];

// Non-worst states that fold into the same aggregate bucket as their leader.
const STATE_TO_BUCKET = {
  unknown: 'unknown',
  ci_failed: 'ci_failed',
  uncommitted: 'uncommitted',
  committed: 'committed',
  pr_open: 'ci_pending',
  ci_pending: 'ci_pending',
  ci_passed: 'ci_passed',
  merged: 'merged',
};

const BLOCKED_REASON_PREFIX = {
  ci_failed: 'GITHUB_CI_FAILED',
};

/**
 * Pure reduction over per-repo delivery states — "eslabón más débil"
 * (weakest link): the aggregate is the worst bucket present; `merged` only
 * when every repo is `merged`.
 */
export function reduceDelivery(perRepo) {
  for (const bucket of PRECEDENCE) {
    const culprit = perRepo.find((r) => STATE_TO_BUCKET[r.state] === bucket);
    if (!culprit) continue;
    if (bucket === 'merged') {
      // Only reached once nothing worse matched above — unanimous by construction.
      return { state: 'merged' };
    }
    if (bucket === 'unknown' || bucket === 'ci_failed') {
      const reason = bucket === 'unknown' ? culprit.blocked_reason : BLOCKED_REASON_PREFIX[bucket];
      return { state: bucket, blocked_reason: `${reason} @${culprit.repo}` };
    }
    return { state: bucket };
  }
  // Unreachable in practice: PRECEDENCE covers every DELIVERY_STATES bucket,
  // and the hub is always present in perRepo.
  return { state: 'unknown', blocked_reason: 'NO_REPO_STATES' };
}

export function resolveMultiRepoDelivery({
  cwd = process.cwd(),
  changesDir = defaultChangesDir(cwd),
  slug,
  resolveOne = resolveDelivery,
} = {}) {
  const impacted = readImpactedRepos(slug, changesDir);

  if (impacted.length === 0) {
    const hub = resolveOne({ cwd, slug });
    return { state: hub.state, per_repo: [{ repo: resolveSddRepo({ cwd }).name, path: cwd, state: hub.state, blocked_reason: hub.blocked_reason }] };
  }

  const hubName = resolveSddRepo({ cwd }).name;
  const targets = [{ repo: hubName, path: cwd }, ...impacted.map((repo) => ({ repo, path: resolvePathOrNull(repo, cwd) }))];

  const perRepo = targets.map((target) => {
    if (target.path === null) {
      return { repo: target.repo, path: null, state: 'unknown', blocked_reason: `REPO_PATH_UNRESOLVED @${target.repo}` };
    }
    // Every impacted repo carries the change's branch too (`prepare-repos` creates it).
    const resolved = resolveOne({ cwd: target.path, slug });
    return { repo: target.repo, path: target.path, state: resolved.state, blocked_reason: resolved.blocked_reason };
  });

  const reduced = reduceDelivery(perRepo);
  return { state: reduced.state, per_repo: perRepo, ...(reduced.blocked_reason ? { blocked_reason: reduced.blocked_reason } : {}) };
}

function resolvePathOrNull(repoName, cwd) {
  try {
    return resolveConfiguredRepoPath(repoName, { cwd });
  } catch {
    return null;
  }
}
