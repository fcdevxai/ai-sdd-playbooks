import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, EXIT } from '../src/cli/dispatch.js';
import { buildLock, writeLock, readLock } from '../src/config/lock.js';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

function tmp(p) { return fs.mkdtempSync(path.join(os.tmpdir(), p)); }
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

test('sdd sync reconciles sdd.lock.resolved with the installed global version (C-08)', async () => {
  const cwd = tmp('sdd-sync-');
  writeLock(path.join(cwd, 'sdd.lock'), buildLock({ compatible: '>=2.0.0 <3.0.0', resolved: '2.0.0' }));
  const global = tmp('sdd-global-');
  fs.writeFileSync(path.join(global, '.sdd-version'), '2.0.5\n');

  const saved = process.env.SDD_CLAUDE_SKILLS_DIR;
  process.env.SDD_CLAUDE_SKILLS_DIR = global;
  try {
    const { io } = capture();
    const code = await run(['sync', '--cwd', cwd], io);
    assert.equal(code, EXIT.OK);
    assert.equal(readLock(path.join(cwd, 'sdd.lock')).methodology.resolved, '2.0.5');
  } finally {
    if (saved === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR;
    else process.env.SDD_CLAUDE_SKILLS_DIR = saved;
  }
});

test('sdd sync with no lock reports nothing to reconcile', async () => {
  const cwd = tmp('sdd-sync-nolock-');
  const { io, out } = capture();
  const code = await run(['sync', '--cwd', cwd], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /nothing to reconcile/i);
});

test('sdd sync --legacy regenerates legacy files byte-stable when sources are unchanged (T5.4)', async () => {
  const distFile = path.join(REPO_ROOT, 'dist', 'claude-commands', 'sdd-apply.md');
  const before = fs.readFileSync(distFile, 'utf8');
  const { io } = capture();
  const code = await run(['sync', '--legacy', '--quiet'], io);
  assert.equal(code, EXIT.OK);
  assert.equal(fs.readFileSync(distFile, 'utf8'), before); // byte-stable
});
