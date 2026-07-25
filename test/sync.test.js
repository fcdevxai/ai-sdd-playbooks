import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, EXIT } from '../src/cli/dispatch.js';
import { buildLock, writeLock, readLock } from '../src/config/lock.js';
import { installSkills, PACKAGE_ROOT } from '../src/install/skills.js';

function tmp(p) { return fs.mkdtempSync(path.join(os.tmpdir(), p)); }
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

test('playbook sync reconciles playbook.lock.resolved with the installed global version (C-08)', async () => {
  const cwd = tmp('playbook-sync-');
  writeLock(path.join(cwd, 'playbook.lock'), buildLock({ compatible: '>=0.1.0 <1.0.0', resolved: '0.1.0' }));
  const global = tmp('playbook-global-');
  fs.writeFileSync(path.join(global, '.playbook-version'), '0.1.5\n');

  const saved = process.env.PLAYBOOK_CLAUDE_SKILLS_DIR;
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = global;
  try {
    const { io } = capture();
    const code = await run(['sync', '--cwd', cwd], io);
    assert.equal(code, EXIT.OK);
    assert.equal(readLock(path.join(cwd, 'playbook.lock')).methodology.resolved, '0.1.5');
  } finally {
    if (saved === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR;
    else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved;
  }
});

test('playbook sync never propagates manifest mode or source into playbook.lock, even after install --link (AC-9, SEC-002)', async () => {
  const cwd = tmp('playbook-sync-');
  writeLock(path.join(cwd, 'playbook.lock'), buildLock({ compatible: '>=0.1.0 <1.0.0', resolved: '0.1.0' }));
  const global = tmp('playbook-global-');
  const src = tmp('playbook-src-');
  fs.cpSync(path.join(PACKAGE_ROOT, 'skills'), path.join(src, 'skills'), { recursive: true });
  installSkills({ targets: { claude: global }, version: '0.1.5', sourceRoot: src, mode: 'link' });

  const saved = process.env.PLAYBOOK_CLAUDE_SKILLS_DIR;
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = global;
  try {
    const { io } = capture();
    const code = await run(['sync', '--cwd', cwd], io);
    assert.equal(code, EXIT.OK);
    const resolved = readLock(path.join(cwd, 'playbook.lock')).methodology.resolved;
    assert.equal(resolved, '0.1.5');
    assert.doesNotMatch(resolved, /link/);
    assert.doesNotMatch(resolved, new RegExp(src.replace(/[/\\]/g, '.')));
    const rawLock = fs.readFileSync(path.join(cwd, 'playbook.lock'), 'utf8');
    assert.doesNotMatch(rawLock, /mode/);
    assert.doesNotMatch(rawLock, new RegExp(src.replace(/[/\\]/g, '.')));
  } finally {
    if (saved === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR;
    else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved;
  }
});

test('playbook sync with no lock reports nothing to reconcile', async () => {
  const cwd = tmp('playbook-sync-nolock-');
  const { io, out } = capture();
  const code = await run(['sync', '--cwd', cwd], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /nothing to reconcile/i);
});
