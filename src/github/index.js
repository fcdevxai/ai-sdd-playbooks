/**
 * Delivery resolution (design §3.2/§3.4, C-01/C-10) — combines LOCAL Git with
 * GitHub. GitHub-sourced state is queried live or reported `unknown`; it is
 * NEVER assumed and NEVER persisted in sdd.lock.
 *
 *   local uncommitted            → uncommitted        (offline, no GitHub needed)
 *   local committed + no GitHub  → unknown            (can't confirm remote — do not assume)
 *   local committed + GitHub:
 *      no PR                     → committed
 *      PR merged                 → merged
 *      PR open + checks          → ci_failed | ci_pending | ci_passed | pr_open
 *   only change evidence uncommitted + PR merged:
 *      HEAD is the PR head, or the PR's merge commit is HEAD or an ancestor of HEAD → merged
 *      merge commit not an ancestor / no merge commit → unknown (MERGED_HEAD_IDENTITY_UNPROVEN)
 *      merge commit absent from a complete history  → unknown (MERGE_COMMIT_NOT_IN_HISTORY)
 *      shallow history cannot decide                 → unknown (MERGED_HISTORY_UNAVAILABLE)
 *   not a git repo               → unknown (GIT_UNAVAILABLE)
 *   malformed change slug        → unknown (INVALID_CHANGE_SLUG)
 *
 * A change's delivery is resolved from ITS OWN branch — the `slug` (change-id) —
 * not from whatever branch happens to be checked out. Only an absent slug
 * (`undefined`) falls back to the current branch, which is the pre-existing behavior
 * for callers with no change context; any other malformed value fails closed rather
 * than silently resolving a different change. The slug is an input, never stored:
 * delivery stays derived on every call.
 */
import { execFileSync } from 'node:child_process';
import { localGitState, currentBranch, isGitRepo, baseBranch, evidenceOnlyDirty } from './repository.js';
import { githubContext } from './auth.js';
import { prForBranch } from './pull-request.js';
import { checksState } from './checks.js';
import { GIT_ENV, ancestryWith, commitExistsWith } from '../tokens/equivalence.js';

export { currentBranch, baseBranch };

export function gitRunner(cwd) {
  return (args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'], env: GIT_ENV }).toString();
}

export function ghRunner(cwd) {
  return (args) => execFileSync('gh', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
}

/**
 * A change slug becomes a branch name and then an element of `gh`'s argv. Same
 * criterion as `isSafeSlug` in src/tokens/packet.js, plus a leading-dash rejection
 * that only matters here: `gh` would parse `-R` or `--web` as an option instead of a
 * branch. (There the slug is a path segment, where a leading dash is harmless.)
 * Duplicated rather than shared because unifying slug validation is its own change.
 */
function isSafeBranchSlug(slug) {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    slug !== '.' &&
    slug !== '..' &&
    !slug.startsWith('-') &&
    !slug.includes('/') &&
    !slug.includes('\\')
  );
}

export function resolveDelivery({ cwd, runGit, runGh, slug, allowEvidenceDirty = false } = {}) {
  // Before any runner is instantiated: a malformed slug must never reach git or gh.
  if (slug !== undefined && !isSafeBranchSlug(slug)) {
    return { provider: 'github', state: 'unknown', blocked_reason: 'INVALID_CHANGE_SLUG' };
  }

  const git = runGit || gitRunner(cwd);
  const gh = runGh || ghRunner(cwd);

  const local = localGitState(git);
  if (local === null) return { provider: 'github', state: 'unknown', blocked_reason: 'GIT_UNAVAILABLE' };
  const dirtyEvidence = local === 'uncommitted' && allowEvidenceDirty && evidenceOnlyDirty(git, slug);
  if (local === 'uncommitted' && !dirtyEvidence) return { provider: 'github', state: 'uncommitted' };

  // local committed → the remaining states require GitHub
  const ctx = githubContext(gh);
  if (!ctx.available) return { provider: 'github', state: 'unknown', blocked_reason: 'GITHUB_CONTEXT_UNAVAILABLE' };

  const branch = slug || currentBranch(git);
  const pr = prForBranch(branch, gh);
  if (!pr) return { provider: 'github', state: dirtyEvidence ? 'uncommitted' : 'committed' };
  if (pr.state === 'MERGED') {
    if (dirtyEvidence) {
      const unproven = mergedHeadIdentity(git, pr);
      if (unproven) return { provider: 'github', state: 'unknown', blocked_reason: unproven };
    }
    return { provider: 'github', state: 'merged' };
  }
  if (pr.state === 'OPEN') {
    const c = checksState(branch, gh);
    if (c === 'failed') return { provider: 'github', state: 'ci_failed' };
    if (c === 'pending') return { provider: 'github', state: 'ci_pending' };
    if (c === 'passed') return { provider: 'github', state: 'ci_passed' };
    return { provider: 'github', state: 'pr_open' };
  }
  return { provider: 'github', state: 'committed' }; // CLOSED-unmerged → back to committed
}

// A full Git object name (SHA-1 or SHA-256), lowercase as GitHub reports it. Anything else
// never reaches a Git argument vector, where it could be read as an option or a revision.
const OBJECT_NAME = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/**
 * Post-merge identity with only change evidence uncommitted: the merged result is in this
 * checkout when HEAD is the pull-request head, or when the pull request's merge commit is HEAD
 * or an ancestor of HEAD — the same three-valued ancestry delivered evidence uses (design
 * Amendment R5, rules 2 and 7), whatever the merge strategy. Returns null when proven, otherwise
 * the `blocked_reason`; nothing undecidable is ever proven.
 */
function mergedHeadIdentity(git, pr) {
  let head;
  try { head = git(['rev-parse', 'HEAD']).trim(); } catch { return 'MERGED_HEAD_IDENTITY_UNPROVEN'; }
  if (!OBJECT_NAME.test(head)) return 'MERGED_HEAD_IDENTITY_UNPROVEN';
  if (head === pr.headRefOid) return null;
  const merge = pr.mergeCommitOid;
  if (typeof merge !== 'string' || !OBJECT_NAME.test(merge)) return 'MERGED_HEAD_IDENTITY_UNPROVEN';
  let answer;
  try { answer = ancestryWith(git, merge, head); } catch { return 'MERGED_HEAD_IDENTITY_UNPROVEN'; }
  if (answer === 'yes') return null;
  if (answer === 'unknown') return 'MERGED_HISTORY_UNAVAILABLE';
  return commitExistsWith(git, merge) ? 'MERGED_HEAD_IDENTITY_UNPROVEN' : 'MERGE_COMMIT_NOT_IN_HISTORY';
}

export { isGitRepo };
