/**
 * Safe filesystem helpers (design §1.3, §8).
 *
 * Every destructive write funnels through here. Overwriting an existing file
 * requires an explicit per-file confirmation token; without it, the write is
 * refused. `sdd init` uses copyIfMissing (never overwrites); `migrate`/`--fix`
 * render a diff first and pass the token only after confirmation.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Per-file confirmation token. A caller must pass this to overwrite the file. */
export function confirmationToken(dest) {
  return `overwrite:${path.resolve(dest)}`;
}

/** Copy src→dest only if dest does not exist. Never overwrites. */
export function copyIfMissing(src, dest) {
  if (fs.existsSync(dest)) return { path: dest, action: 'skipped' };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return { path: dest, action: 'created' };
}

/** Write content only if dest does not exist. Never overwrites. */
export function writeIfMissing(dest, content) {
  if (fs.existsSync(dest)) return { path: dest, action: 'skipped' };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
  return { path: dest, action: 'created' };
}

/** Write, overwriting an existing file ONLY with a matching confirmation token. */
export function writeFileSafe(dest, content, { confirm = null } = {}) {
  const exists = fs.existsSync(dest);
  if (exists && confirm !== confirmationToken(dest)) {
    throw new Error(`refusing to overwrite ${dest} without a confirmation token`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
  return { path: dest, action: exists ? 'overwritten' : 'created' };
}

export function ensureDir(dir) {
  const existed = fs.existsSync(dir);
  if (!existed) fs.mkdirSync(dir, { recursive: true });
  return { path: dir, action: existed ? 'skipped' : 'created' };
}

/** Minimal line-oriented diff for previews (migrate / --fix / bootstrap). */
export function renderDiff(oldStr = '', newStr = '') {
  const o = String(oldStr).split('\n');
  const n = String(newStr).split('\n');
  const max = Math.max(o.length, n.length);
  const lines = [];
  for (let i = 0; i < max; i++) {
    if (o[i] === n[i]) continue;
    if (o[i] !== undefined) lines.push(`- ${o[i]}`);
    if (n[i] !== undefined) lines.push(`+ ${n[i]}`);
  }
  return lines.join('\n');
}
