/**
 * Diff-first changed-file discovery — ported from specloom's
 * `collectChangedFiles` (specloom, ADR-011/ADR-022). Lists paths
 * changed for a change in the consumer repo or a configured sibling repo, with
 * a deterministic fallback (context-packet.md -> tasks.md -> local git state)
 * when no diff base resolves — never a thrown error for "no base found".
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { execFileSync } from 'node:child_process';
import { extractLabeledTokens, headingSection } from '../util/markdown.js';
import { assertSafeSlug } from './slug.js';
import { resolveConfiguredRepoPath } from './config.js';
import { parseFilesTouchedBullet } from './classify.js';
import { IMPLICIT_BASE_CANDIDATES, resolveImplicitBase } from './git-state.js';

export const CHANGED_FILES_DIFF_LINE_CAP = 200;

function gitDiffRange(baseRef) {
  return `${baseRef}...HEAD`;
}

function assertSafeGitBaseRef(baseRef) {
  if (typeof baseRef !== 'string' || baseRef.trim() === '' || baseRef.startsWith('-') || /[\s\0]/.test(baseRef)) {
    throw new Error(`Invalid base ref: "${baseRef}"`);
  }
  return baseRef;
}

/** Local staged, unstaged, and untracked paths — the git state that exists with or without a base. */
function localGitStateFiles(git) {
  return [
    git(['diff', '--name-only', '--cached']),
    git(['diff', '--name-only']),
    git(['ls-files', '--others', '--exclude-standard']),
  ];
}

/**
 * Repo-relative paths from a packet's `## Files touched` bullet list.
 * Understands both the grouped `- <repo>: <path>` form and the legacy
 * flat/backtick-quoted form: the repo prefix is stripped so the SDD fallback
 * always sees bare paths.
 */
function extractPacketFilesTouched(packetContent) {
  const section = headingSection(matter(packetContent).content, 'Files touched');
  if (!section) return [];
  const paths = [];
  for (const rawLine of section.split('\n')) {
    const bullet = rawLine.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!bullet) continue;
    const { path: filePath } = parseFilesTouchedBullet(bullet[1]);
    if (filePath) paths.push(filePath);
  }
  return paths;
}

/**
 * Deterministic SDD fallback file source for a change, confined to
 * openspec/changes/<slug>/. Prefers context-packet.md `Files touched`; if that
 * is absent or empty, reads tasks.md's `**Files**:` per-task entries. Always
 * resolves from `cwd` even when git points at a sibling `--repo`, since SDD
 * artifacts always live with the consumer's own changes.
 */
function collectSddFallbackFiles(slug, cwd) {
  const dir = path.join(cwd, 'openspec', 'changes', slug);
  const packetPath = path.join(dir, 'context-packet.md');
  const tasksPath = path.join(dir, 'tasks.md');
  let inspected = false;

  if (fs.existsSync(packetPath)) {
    inspected = true;
    const files = extractPacketFilesTouched(fs.readFileSync(packetPath, 'utf8'));
    if (files.length > 0) return { files, source: 'context-packet.md', inspected };
  }
  if (fs.existsSync(tasksPath)) {
    inspected = true;
    const files = extractLabeledTokens(fs.readFileSync(tasksPath, 'utf8'), /\*\*Files\*\*:\s*(.+)/i);
    if (files.length > 0) return { files, source: 'tasks.md', inspected };
  }
  return { files: [], source: null, inspected };
}

function dedupeSort(chunks) {
  return chunks
    .join('\n')
    .split('\n')
    .filter(Boolean)
    .filter((file, index, all) => all.indexOf(file) === index)
    .sort();
}

function capDiff(rawDiff, diffLineCap) {
  const lines = rawDiff
    .replace(/\n$/, '')
    .split('\n')
    .filter((line, index, all) => !(all.length === 1 && index === 0 && line === ''));
  const cap = Math.max(0, Number.isFinite(diffLineCap) ? diffLineCap : CHANGED_FILES_DIFF_LINE_CAP);
  return { diff: lines.slice(0, cap).join('\n'), diffTruncated: lines.length > cap };
}

/**
 * Lists paths changed for a change in the consumer repo (or a configured
 * sibling `repoName`). The return shape is stable across every path: it
 * always carries `baseRef`, `baseResolved`, `fallback`, `fallbackSource`,
 * `fallbackInspectable`, and `warnings` alongside `slug`, `repo`, `cwd`,
 * `files`, `diff`, and `diffTruncated`.
 */
export function collectChangedFiles(slug, {
  baseRef = null,
  includeDiff = false,
  diffLineCap = CHANGED_FILES_DIFF_LINE_CAP,
  repoName = null,
  cwd = process.cwd(),
} = {}) {
  assertSafeSlug(slug);
  const explicit = baseRef !== null && baseRef !== undefined;
  const gitCwd = repoName ? resolveConfiguredRepoPath(repoName, { cwd, requireDirectory: true }) : cwd;
  const git = (args) => execFileSync('git', args, { cwd: gitCwd, encoding: 'utf8' });

  let resolvedBase;
  let baseResolved;
  if (explicit) {
    resolvedBase = assertSafeGitBaseRef(baseRef);
    baseResolved = true;
  } else {
    const probe = resolveImplicitBase(git);
    resolvedBase = probe.baseRef;
    baseResolved = probe.baseResolved;
  }

  const warnings = [];
  let fallback = false;
  let fallbackSource = null;
  let fallbackInspectable = true;

  let files;
  if (baseResolved) {
    const range = gitDiffRange(resolvedBase);
    files = dedupeSort([git(['diff', '--name-only', '--end-of-options', range]), ...localGitStateFiles(git)]);
  } else {
    fallback = true;
    const sdd = collectSddFallbackFiles(slug, cwd);
    fallbackSource = sdd.source;
    let localFiles = [];
    let localInspected = false;
    try {
      localFiles = localGitStateFiles(git);
      localInspected = true;
    } catch {
      localInspected = false;
    }
    fallbackInspectable = sdd.inspected || localInspected;
    files = dedupeSort([...sdd.files, ...localFiles]);
    warnings.push(
      `no diff base resolved (tried ${IMPLICIT_BASE_CANDIDATES.join(', ')}); ` +
        `fallback source: ${fallbackSource || 'local git state'}`,
    );
  }

  let diff = '';
  let diffTruncated = false;
  if (includeDiff) {
    const diffChunks = baseResolved
      ? [git(['diff', '--end-of-options', gitDiffRange(resolvedBase)]), git(['diff', '--cached']), git(['diff'])]
      : [git(['diff', '--cached']), git(['diff'])];
    const capped = capDiff(diffChunks.filter(Boolean).join('\n'), diffLineCap);
    diff = capped.diff;
    diffTruncated = capped.diffTruncated;
    if (!baseResolved) warnings.push('diff_base_unavailable');
  }

  return {
    slug,
    baseRef: resolvedBase,
    baseResolved,
    repo: repoName,
    cwd: gitCwd,
    fallback,
    fallbackSource,
    fallbackInspectable,
    warnings,
    files,
    diff,
    diffTruncated,
  };
}
