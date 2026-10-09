/**
 * Change-folder artifact discovery.
 *
 * Reads only YAML frontmatter (via gray-matter); never the body. Used by
 * `sdd validate` now and by the lifecycle engine in a later phase.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { unsafeEvidenceReason } from '../util/fs-safe.js';

export const ARTIFACT_FILES = [
  'proposal.md',
  'design.md',
  'tasks.md',
  'code-review-report.md',
  'security-report.md',
  'runtime-gate-report.md',
  'verification-report.md',
];

function toDateString(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * YAML parses an unquoted `2026-07-14` into a Date. The machine-readable
 * contract stores dates as `YYYY-MM-DD` strings, so normalize Date → string
 * (deeply) regardless of whether the author quoted the value.
 */
export function normalizeFrontmatter(value) {
  if (value instanceof Date) return toDateString(value);
  if (Array.isArray(value)) return value.map(normalizeFrontmatter);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeFrontmatter(v);
    return out;
  }
  return value;
}

export function readFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return normalizeFrontmatter(matter(raw).data);
}

/** Load the artifacts present in a single change folder. */
export function loadChange(changeDir) {
  const artifacts = {};
  // Containment root: the project that holds openspec/changes/<id> (design Amendment R5, rule 4).
  const parent = path.dirname(changeDir);
  const root = path.basename(parent) === 'changes' && path.basename(path.dirname(parent)) === 'openspec'
    ? path.dirname(path.dirname(parent)) : changeDir;
  for (const name of ARTIFACT_FILES) {
    const p = path.join(changeDir, name);
    if (!fs.lstatSync(p, { throwIfNoEntry: false })) continue;
    const unsafe = unsafeEvidenceReason(root, path.relative(root, p));
    if (unsafe) {
      artifacts[name] = { path: p, frontmatter: {}, readError: `${name} is not a contained regular file (${unsafe})` };
      continue;
    }
    try {
      artifacts[name] = { path: p, frontmatter: readFrontmatter(p) };
    } catch (error) {
      artifacts[name] = { path: p, frontmatter: {}, readError: `${name}: ${error.message}` };
    }
  }
  return { changeId: path.basename(changeDir), dir: changeDir, artifacts };
}

/** List change folders under <cwd>/openspec/changes. */
export function findChangeDirs(cwd) {
  const base = path.join(cwd, 'openspec', 'changes');
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .map((d) => path.join(base, d))
    // Only real directories: a symbolic link (dangling or not) is never followed (design Amendment R5, rule 4).
    .filter((p) => fs.lstatSync(p).isDirectory());
}

// Canonical home is src/lifecycle/impact.js; re-exported here for existing callers.
export { computeDesignRequired } from '../lifecycle/impact.js';
