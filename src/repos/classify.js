/**
 * Repo file classification against the protected-path denylist — ported from
 * specloom's `classifyRepoFiles`/`parseGroupedFilesTouched`
 * (specloom, ADR-025). Pure: no filesystem, no git.
 */

/**
 * Built-in protected-path denylist — always active, never replaced by
 * `repos.<name>.protected_paths` (those are added on top). Secrets, keys,
 * permanent specs, and build outputs must never be staged in a feature commit.
 */
export const PROTECTED_PATHS_BUILTIN = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  'openspec/specs/**',
  'dist/',
  'build/',
  'node_modules/',
  'target/',
];

/** Translates a restricted glob (`*` = non-slash, `**` = any, `?` = one non-slash) to a RegExp. */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/** Returns the first protected pattern a path matches (full-path or basename glob, or dir prefix), else null. */
function matchProtected(filePath, patterns) {
  const base = filePath.split('/').pop();
  for (const pattern of patterns) {
    if (pattern.endsWith('/')) {
      if (filePath === pattern.slice(0, -1) || filePath.startsWith(pattern)) return pattern;
      continue;
    }
    const re = globToRegExp(pattern);
    if (re.test(filePath) || re.test(base)) return pattern;
  }
  return null;
}

/**
 * Classifies a repo's changed files against its declared files into
 * `candidateFiles` (declared & changed, not protected), `unrelatedFiles`
 * (changed & not declared), `expectedButMissing` (declared & not changed), and
 * `protectedStaged` (a candidate matching the denylist — moved out of
 * candidateFiles). The built-in denylist plus `protectedPaths` is fail-safe: a
 * protected path never remains a candidate.
 */
export function classifyRepoFiles({ declared = [], changed = [], protectedPaths = [] } = {}) {
  const patterns = [...PROTECTED_PATHS_BUILTIN, ...protectedPaths];
  const changedSet = new Set(changed);
  const declaredSet = new Set(declared);
  const candidateFiles = [];
  const protectedStaged = [];
  for (const file of declared) {
    if (!changedSet.has(file)) continue;
    if (matchProtected(file, patterns)) protectedStaged.push(file);
    else candidateFiles.push(file);
  }
  const unique = (arr) => [...new Set(arr)].sort();
  return {
    candidateFiles: unique(candidateFiles),
    unrelatedFiles: unique(changed.filter((f) => !declaredSet.has(f))),
    expectedButMissing: unique(declared.filter((f) => !changedSet.has(f))),
    protectedStaged: unique(protectedStaged),
  };
}

/**
 * Parses a single `## Files touched` bullet's inner text into `{ repo, path }`.
 * Understands the grouped form `- <repo>: <path>` (ADR-025) and the legacy
 * flat form `- <path>` / backtick-quoted path. Outer backticks are stripped in
 * every case; `repo` is null for a flat bullet.
 */
export function parseFilesTouchedBullet(entry) {
  let text = entry.trim().replace(/^`([^`]+)`$/, '$1').trim();
  const grouped = text.match(/^([A-Za-z0-9_.-]+):\s*(.+)$/);
  if (grouped) {
    const filePath = grouped[2].trim().replace(/^`([^`]+)`$/, '$1').trim();
    return { repo: grouped[1], path: filePath };
  }
  return { repo: null, path: text };
}

/**
 * Parses a `## Files touched` section body into a `repoName -> [paths]` map.
 * Each grouped `<repo-name>` must be in the allowlist (config repos + the SDD
 * repo) or it throws. A flat bullet (no repo prefix) maps to the SDD repo
 * (legacy compat); a flat `../`-style path is treated as undeclared (never
 * inferred into any repo).
 */
export function parseGroupedFilesTouched(section, { allowlist = [], sddRepoName = 'sdd' } = {}) {
  const map = {};
  if (!section) return map;
  const allowed = new Set([...allowlist, sddRepoName]);
  const stripped = section.replace(/<!--.*?-->/gs, '');
  for (const rawLine of stripped.split('\n')) {
    const bullet = rawLine.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!bullet) continue;
    const { repo, path: filePath } = parseFilesTouchedBullet(bullet[1]);
    if (!filePath) continue;
    if (repo) {
      if (!allowed.has(repo)) {
        throw new Error(`Unknown repo "${repo}" in ## Files touched (not found in playbook.config.yaml repos)`);
      }
      (map[repo] ||= []).push(filePath);
      continue;
    }
    // Flat bullet => SDD repo, unless it escapes the SDD root (treated as undeclared).
    if (filePath.startsWith('../') || filePath.split('/').includes('..')) continue;
    (map[sddRepoName] ||= []).push(filePath);
  }
  return map;
}
