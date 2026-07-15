/**
 * `sdd sync` (design §1.2).
 *
 * Reconciles `sdd.lock`'s `resolved` with the installed global methodology
 * version (C-08 / R-01).
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from './exit.js';
import { resolveTargets } from '../install/targets.js';
import { readLock, writeLock, lockPathFor } from '../config/lock.js';

function readStamp(dir) {
  const p = path.join(dir, '.sdd-version');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
}

export async function syncCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const targets = resolveTargets(process.env);
  const installed = readStamp(targets.claude) || readStamp(targets.agents);
  const lockFile = lockPathFor(cwd, null);
  const lock = readLock(lockFile);

  if (!lock) { io.out('No sdd.lock in this project; nothing to reconcile.'); return EXIT.OK; }
  if (!installed) {
    io.err('No global methodology installed (run `sdd install`).');
    return EXIT.ENVIRONMENT;
  }

  lock.methodology = lock.methodology || {};
  lock.methodology.resolved = installed;
  writeLock(lockFile, lock);
  io.out(`Reconciled: sdd.lock resolved → ${installed} (compatible: ${lock.methodology.compatible}).`);
  return EXIT.OK;
}
