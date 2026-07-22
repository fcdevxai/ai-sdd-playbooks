/**
 * Local Git state (design §3.2, §9). GitHub-specific project, but this file
 * only reads the LOCAL working tree — no network needed.
 *
 * Runners are injected `(args) => string` so this is testable without git.
 */

export function isGitRepo(runGit) {
  try {
    runGit(['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

/** 'uncommitted' (dirty tree) | 'committed' (clean tree) | null (not a git repo). */
export function localGitState(runGit) {
  if (!isGitRepo(runGit)) return null;
  let porcelain;
  try {
    porcelain = runGit(['status', '--porcelain']);
  } catch {
    return null;
  }
  return porcelain.trim() ? 'uncommitted' : 'committed';
}

export function currentBranch(runGit) {
  try {
    return runGit(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch {
    return null;
  }
}

/** Base branch: config wins; never hardcoded in code (C-11). */
export function baseBranch(config) {
  return (config && config.github && config.github.base_branch) || null;
}
