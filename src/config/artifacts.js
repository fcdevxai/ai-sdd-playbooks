/**
 * Change-folder artifact discovery.
 *
 * Reads only YAML frontmatter (via gray-matter); never the body. Used by
 * `sdd validate` now and by the lifecycle engine in a later phase.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

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
  for (const name of ARTIFACT_FILES) {
    const p = path.join(changeDir, name);
    if (fs.existsSync(p)) {
      artifacts[name] = { path: p, frontmatter: readFrontmatter(p) };
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
    .filter((p) => fs.statSync(p).isDirectory());
}

// Canonical home is src/lifecycle/impact.js; re-exported here for existing callers.
export { computeDesignRequired } from '../lifecycle/impact.js';
