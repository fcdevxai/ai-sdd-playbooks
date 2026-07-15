import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildLock, writeLock, readLock, validateLock } from '../src/config/lock.js';

test('buildLock records compatible + resolved, not a bare version (C-08)', () => {
  const lock = buildLock({ compatible: '>=2.0.0 <3.0.0', resolved: '2.0.3', installedAt: '2026-07-14' });
  assert.equal(lock.version, 2);
  assert.equal(lock.methodology.compatible, '>=2.0.0 <3.0.0');
  assert.equal(lock.methodology.resolved, '2.0.3');
  assert.equal(lock.methodology_version, undefined); // no bare pin
  assert.equal(validateLock(lock).valid, true);
});

test('a lock without a compatible range is rejected (C-08)', () => {
  assert.equal(validateLock({ version: 2, methodology: {} }).valid, false);
});

test('buildLock never emits GitHub delivery/CI/PR fields (C-10)', () => {
  const lock = buildLock({
    compatible: '>=2.0.0 <3.0.0',
    resolved: '2.0.3',
    skills: { 'sdd-plan': { version: '2.0.3' } },
    capabilities: { browser: true, http: true },
    installedAt: '2026-07-14',
  });
  const serialized = JSON.stringify(lock).toLowerCase();
  for (const forbidden of ['delivery', 'pr_open', 'ci_passed', 'ci_pending', 'merged', 'pull_request']) {
    assert.equal(serialized.includes(forbidden), false, `lock must not contain '${forbidden}'`);
  }
});

test('lock round-trips through write/read', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-lock-'));
  const file = path.join(dir, 'sdd.lock');
  const lock = buildLock({
    compatible: '>=2.0.0 <3.0.0',
    resolved: '2.0.3',
    skills: { 'sdd-plan': { version: '2.0.3' } },
    capabilities: { browser: true, http: true, cli: false, worker: false },
    installedAt: '2026-07-14',
  });
  writeLock(file, lock);
  assert.deepEqual(readLock(file), lock);
});
