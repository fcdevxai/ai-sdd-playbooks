/**
 * `sdd sync` (design §1.2).
 *
 *   sdd sync            Reconcile sdd.lock's `resolved` with the installed global
 *                       methodology version (C-08 / R-01).
 *   sdd sync --legacy   Transitional dual-emit: regenerate the frozen 1.x command
 *                       files from the package's playbooks (T5.4). Byte-stable when
 *                       the sources are unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { EXIT } from './exit.js';
import { resolveTargets } from '../install/targets.js';
import { PACKAGE_ROOT } from '../install/skills.js';
import { readLock, writeLock, lockPathFor } from '../config/lock.js';

function readStamp(dir) {
  const p = path.join(dir, '.sdd-version');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
}

function runLegacy(parsed, io) {
  const gen = path.join(PACKAGE_ROOT, 'scripts', 'sync.js');
  if (!fs.existsSync(gen)) {
    io.err('legacy generator not found (scripts/sync.js)');
    return EXIT.ENVIRONMENT;
  }
  try {
    const out = execFileSync('node', [gen], { cwd: PACKAGE_ROOT }).toString().trim();
    if (!parsed.flags.quiet && out) io.out(out);
    io.out('sdd sync --legacy: legacy command files regenerated (dual-emit).');
    return EXIT.OK;
  } catch (e) {
    io.err(String((e && e.stderr) || (e && e.message) || e));
    return EXIT.VIOLATION;
  }
}

function runReconcile(parsed, io) {
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

export async function syncCommand(parsed, io) {
  if (parsed.rest.includes('--legacy')) return runLegacy(parsed, io);
  return runReconcile(parsed, io);
}
