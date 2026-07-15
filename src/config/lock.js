/**
 * sdd.lock IO (design §5.2, C-08/C-10).
 *
 * The lock records the project's methodology contract as a COMPATIBLE RANGE
 * plus the last RESOLVED version — never a false exact pin. It must NEVER store
 * current GitHub delivery state (CI/PR/merge): buildLock() only emits the
 * allowed keys, so delivery state cannot leak into the lock (C-10).
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { validateNamed } from '../schema/validate.js';

export function lockPathFor(cwd, lockPath) {
  return lockPath || path.join(cwd, 'sdd.lock');
}

/**
 * Build a lock object. `compatible` is the authoritative contract; `resolved`
 * is informational (the version validated last). No delivery/CI/PR fields.
 */
export function buildLock({ compatible, resolved = null, skills = {}, capabilities = {}, installedAt = null }) {
  const lock = { version: 2, methodology: { compatible } };
  if (resolved) lock.methodology.resolved = resolved;
  if (installedAt) lock.installed_at = installedAt;
  if (skills && Object.keys(skills).length) lock.skills = skills;
  if (capabilities && Object.keys(capabilities).length) lock.capabilities_snapshot = capabilities;
  return lock;
}

export function readLock(file) {
  if (!fs.existsSync(file)) return null;
  return yaml.load(fs.readFileSync(file, 'utf8')) || {};
}

export function writeLock(file, lock) {
  fs.writeFileSync(file, yaml.dump(lock, { lineWidth: 100, noRefs: true }), 'utf8');
}

export function validateLock(lock) {
  return validateNamed('sdd.lock', lock);
}
