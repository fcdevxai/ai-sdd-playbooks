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

/** Only generated/private proof may be dirty while checking post-merge delivery. */
export function evidenceOnlyDirty(runGit, slug) {
  if (!slug) return false;
  let porcelain;
  try { porcelain = runGit(['status', '--porcelain=v1', '--untracked-files=all']); }
  catch { return false; }
  const lines = porcelain.split('\n').filter(Boolean);
  if (lines.length === 0) return false;
  const prefix = `openspec/changes/${slug}/`;
  return lines.every((line) => {
    if (line.length < 4 || /[RC]/.test(line.slice(0, 2))) return false;
    const file = line.slice(3);
    if (file.startsWith('"') || file.includes(' -> ')) return false;
    if (file.startsWith('.specloom/runs/') || file === '.specloom/usage.json') return true;
    if (file.startsWith(`openspec/archive/${slug}/`)) return true;
    if (!file.startsWith(prefix)) return false;
    const name = file.slice(prefix.length);
    return name === 'context-packet.md' || name === 'handoff-manifest.json'
      || /^handoff-manifest-sdd-[a-z-]+-[a-f0-9]{64}\.json$/.test(name)
      || /^[a-z0-9-]+-report\.md$/.test(name)
      || /^evidence-binding-[a-z0-9._-]+\.json$/.test(name)
      || /^[a-z0-9-]+-execution-report\.md$/.test(name);
  });
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
