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
import { localGitState, currentBranch, isGitRepo, baseBranch } from './repository.js';
import { githubContext } from './auth.js';
import { prForBranch } from './pull-request.js';
import { checksState } from './checks.js';

export { currentBranch, baseBranch };

export function gitRunner(cwd) {
  return (args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
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

export function resolveDelivery({ cwd, runGit, runGh, slug } = {}) {
  // Before any runner is instantiated: a malformed slug must never reach git or gh.
  if (slug !== undefined && !isSafeBranchSlug(slug)) {
    return { provider: 'github', state: 'unknown', blocked_reason: 'INVALID_CHANGE_SLUG' };
  }

  const git = runGit || gitRunner(cwd);
  const gh = runGh || ghRunner(cwd);

  const local = localGitState(git);
  if (local === null) return { provider: 'github', state: 'unknown', blocked_reason: 'GIT_UNAVAILABLE' };
  if (local === 'uncommitted') return { provider: 'github', state: 'uncommitted' };

  // local committed → the remaining states require GitHub
  const ctx = githubContext(gh);
  if (!ctx.available) return { provider: 'github', state: 'unknown', blocked_reason: 'GITHUB_CONTEXT_UNAVAILABLE' };

  const branch = slug || currentBranch(git);
  const pr = prForBranch(branch, gh);
  if (!pr) return { provider: 'github', state: 'committed' };
  if (pr.state === 'MERGED') return { provider: 'github', state: 'merged' };
  if (pr.state === 'OPEN') {
    const c = checksState(branch, gh);
    if (c === 'failed') return { provider: 'github', state: 'ci_failed' };
    if (c === 'pending') return { provider: 'github', state: 'ci_pending' };
    if (c === 'passed') return { provider: 'github', state: 'ci_passed' };
    return { provider: 'github', state: 'pr_open' };
  }
  return { provider: 'github', state: 'committed' }; // CLOSED-unmerged → back to committed
}

export { isGitRepo };
