/**
 * Multi-repo git-state primitives — ported from specloom's
 * `resolveRepoBaseBranch`/`readRepoGitState`/`resolveImplicitBase`
 * (framework/cli/lib.js). Pure with respect to the caller beyond the git
 * calls themselves: every git call is argv via execFileSync, never a shell.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Implicit bases probed, in order, when no explicit base was passed.
export const IMPLICIT_BASE_CANDIDATES = ['main', 'origin/main', 'master', 'origin/master'];

/**
 * Probes IMPLICIT_BASE_CANDIDATES in order via `git rev-parse --verify --quiet
 * <ref>` and returns the first that resolves. Probing — rather than
 * attempting the real diff and catching — means a missing candidate never
 * leaks a diff error; the extra call is bounded to four refs.
 */
export function resolveImplicitBase(git) {
  for (const ref of IMPLICIT_BASE_CANDIDATES) {
    try {
      git(['rev-parse', '--verify', '--quiet', ref]);
      return { baseRef: ref, baseResolved: true };
    } catch {
      // Candidate does not resolve in this checkout; try the next one.
    }
  }
  return { baseRef: null, baseResolved: false };
}

/**
 * Resolves a repo's base branch, in order:
 *   1. real origin/HEAD (stripped of the `origin/` prefix) -> 'remote-head';
 *   2. the config `default_base` when set                  -> 'config-default';
 *   3. IMPLICIT_BASE_CANDIDATES probed in order             -> 'probe';
 *   4. none -> { baseResolved: false, baseBranch: null, baseSource: null }.
 * A failed symbolic-ref never leaks an error.
 */
export function resolveRepoBaseBranch({ repoPath, defaultBase = null } = {}) {
  const git = (args) => execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' });

  try {
    const ref = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']).trim();
    const match = ref.match(/^refs\/remotes\/origin\/(.+)$/);
    if (match && match[1]) {
      return { baseBranch: match[1], baseResolved: true, baseSource: 'remote-head' };
    }
  } catch {
    // origin/HEAD is not a symbolic ref here (no remote / freshly cloned).
  }

  if (typeof defaultBase === 'string' && defaultBase.trim() !== '') {
    return { baseBranch: defaultBase.trim(), baseResolved: true, baseSource: 'config-default' };
  }

  const probe = resolveImplicitBase(git);
  if (probe.baseResolved) {
    return { baseBranch: probe.baseRef, baseResolved: true, baseSource: 'probe' };
  }

  return { baseBranch: null, baseResolved: false, baseSource: null };
}

// git-dir markers that mean an operation is mid-flight — never a safe base to plan on.
const GIT_INPROGRESS_MARKERS = ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'];

/**
 * Reads a repo's `currentBranch` and `dirty` flag and detects the fail-closed
 * blockers: a missing path => `repo_declared_but_missing`; detached HEAD, an
 * in-progress rebase/merge/cherry-pick, or any git error => `ambiguous_git_state`
 * (never a heuristic); a dirty working tree on a branch other than
 * `targetBranch` => `dirty_worktree_on_wrong_branch`.
 */
export function readRepoGitState({ repoPath, targetBranch } = {}) {
  if (!repoPath || !fs.existsSync(repoPath)) {
    return { exists: false, currentBranch: null, dirty: false, blocker: 'repo_declared_but_missing' };
  }
  const git = (args) => execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' });
  let gitDir;
  let porcelain;
  let currentBranch;
  try {
    gitDir = git(['rev-parse', '--git-dir']).trim();
    porcelain = git(['status', '--porcelain']);
    currentBranch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']).trim();
  } catch {
    return { exists: true, currentBranch: null, dirty: false, blocker: 'ambiguous_git_state' };
  }
  if (!currentBranch) {
    return { exists: true, currentBranch: null, dirty: false, blocker: 'ambiguous_git_state' };
  }
  const gitDirAbs = path.isAbsolute(gitDir) ? gitDir : path.join(repoPath, gitDir);
  for (const marker of GIT_INPROGRESS_MARKERS) {
    if (fs.existsSync(path.join(gitDirAbs, marker))) {
      return { exists: true, currentBranch, dirty: false, blocker: 'ambiguous_git_state' };
    }
  }
  const dirty = porcelain.trim() !== '';
  const blocker = dirty && currentBranch !== targetBranch ? 'dirty_worktree_on_wrong_branch' : null;
  return { exists: true, currentBranch, dirty, blocker };
}
