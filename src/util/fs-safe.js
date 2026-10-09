/**
 * Safe filesystem helpers (design §1.3, §8).
 *
 * The boundary for every filesystem access DERIVED FROM CONFIGURATION —
 * reads as much as writes. Every destructive write funnels through here:
 * overwriting an existing file requires an explicit per-file confirmation
 * token; without it, the write is refused. `sdd init` uses copyIfMissing
 * (never overwrites); `--fix`/bootstrap render a diff first and pass the
 * token only after confirmation. `resolveContainedPath` extends the same
 * boundary to reads: any path taken from a project's `playbook.config.yaml`
 * (e.g. `contract.path_in_loom`) must resolve through it before being read,
 * because the source of a path — config, not code — is what decides whether
 * it needs containment, not whether the access is a read or a write.
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

/**
 * Resolves `candidate` (typically taken from project config) against `root`
 * and throws, naming the rejected path, if the result escapes `root` — via
 * `..`, an absolute path to another tree, or a symlink that resolves outside.
 * Never reads `candidate` itself when it's already outside; only existing
 * intermediate segments are realpath-checked, so a not-yet-created file under
 * a contained directory still resolves.
 */
export function resolveContainedPath(root, candidate) {
  const absRoot = path.resolve(root);
  const absCandidate = path.resolve(absRoot, candidate);
  const withinRoot = (p) => p === absRoot || p.startsWith(absRoot + path.sep);
  if (!withinRoot(absCandidate)) {
    throw new Error(`refusing to resolve path outside the project root: "${candidate}"`);
  }

  // Walk up from the nearest existing ancestor and confirm the realpath (which
  // resolves any symlinks along the way) is still contained.
  let existing = absCandidate;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  if (fs.existsSync(existing)) {
    const real = fs.realpathSync(existing);
    if (!withinRoot(real)) {
      throw new Error(`refusing to resolve path outside the project root: "${candidate}" (resolves via symlink to "${real}")`);
    }
  }

  return absCandidate;
}

/**
 * Why an evidence file cannot be read safely, or null when `relative` is a regular file
 * that is not a symbolic link and resolves inside `root` (design Amendment R5, rule 4).
 * Nothing is read; `lstat` never follows the final component.
 */
export function unsafeEvidenceReason(root, relative) {
  if (typeof relative !== 'string' && !Buffer.isBuffer(relative)) return 'not a contained relative path';
  const bytes = Buffer.isBuffer(relative) ? relative : Buffer.from(relative);
  if (!bytes.length || bytes[0] === 47 || bytes[0] === 92 || bytes.includes(0)) return 'not a contained relative path';
  const segments = [];
  let start = 0;
  for (let i = 0; i <= bytes.length; i++) {
    if (i !== bytes.length && bytes[i] !== 47 && bytes[i] !== 92) continue;
    const segment = bytes.subarray(start, i);
    if (!segment.length || segment.equals(Buffer.from('..')) || segment.equals(Buffer.from('.'))) return 'not a contained relative path';
    segments.push(segment);
    start = i + 1;
  }
  // Walk raw components before looking up the final file: no index/display decoding or parent
  // symlink may redirect an evidence read, even when the link stays inside the repository.
  let file = Buffer.from(path.resolve(root));
  for (let i = 0; i < segments.length; i++) {
    file = Buffer.concat([file, Buffer.from(path.sep), segments[i]]);
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) return 'missing';
    if (stat.isSymbolicLink()) return 'symbolic link';
    if (i === segments.length - 1 ? !stat.isFile() : !stat.isDirectory()) return 'not a regular file';
  }
  return null;
}

/**
 * Read a governed reference. Inside a change directory (`openspec/changes/`) the evidence rule
 * applies: a regular file that is not a symbolic link. Elsewhere a contained path may resolve
 * through a symbolic link that stays inside the root (for example native skill-directory aliases).
 */
export function readReference(root, relative) {
  if (typeof relative !== 'string' || relative === '' || path.isAbsolute(relative)) throw new Error(`invalid reference path: ${relative}`);
  if (path.posix.normalize(relative.split(path.sep).join('/')).startsWith('openspec/changes/')) return readEvidenceFile(root, relative);
  const file = resolveContainedPath(root, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`missing reference: ${relative}`);
  return fs.readFileSync(file);
}

/**
 * Write an evidence file only when its path is contained and is either absent or an existing
 * regular file (never through a symbolic link or onto a directory). Design Amendment R5, rule 4.
 */
export function writeEvidenceFile(root, relative, content) {
  const reason = unsafeEvidenceReason(root, relative);
  if (reason && reason !== 'missing') throw new Error(`${relative}: refusing to write; not a contained regular file (${reason})`);
  if (reason === 'missing') resolveContainedPath(root, path.dirname(relative));
  fs.writeFileSync(path.join(root, relative), content, reason === 'missing' ? { flag: 'wx' } : undefined);
}

/** Read an evidence file only when it is a contained regular file; otherwise refuse before reading. */
export function readEvidenceFile(root, relative, encoding) {
  const reason = unsafeEvidenceReason(root, relative);
  if (reason) throw new Error(`${relative}: not a contained regular file (${reason})`);
  const file = Buffer.isBuffer(relative) ? Buffer.concat([Buffer.from(path.resolve(root) + path.sep), relative]) : path.join(root, relative);
  return fs.readFileSync(file, encoding);
}

export function ensureDir(dir) {
  const existed = fs.existsSync(dir);
  if (!existed) fs.mkdirSync(dir, { recursive: true });
  return { path: dir, action: existed ? 'skipped' : 'created' };
}

/** Minimal line-oriented diff for previews (--fix / bootstrap). */
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
