/**
 * Independent adversarial probes (handoff/snapshot subsystem). Each test asserts the SAFE
 * behaviour required by RULES.md; a failing test is a confirmed finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshotRepository } from '../src/tokens/evidence.js';
import { validateHandoffManifest } from '../src/tokens/handoff.js';
import { DELIVERY, evidence, gatedFixture } from './helpers/evidence-fixture.js';

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-handoff-snap-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
  git('init', '-q', '-b', 'demo'); git('config', 'user.email', 'a@example.invalid'); git('config', 'user.name', 'A');
  fs.writeFileSync(path.join(root, 'a.js'), 'a\n');
  git('add', '-A'); git('commit', '-qm', 'base');
  return { root, git };
}

test('baseline: a freshly gated fixture is eligible on its dirty tree', async () => {
  const { cwd, change } = await gatedFixture();
  const result = evidence(cwd, change, DELIVERY.uncommitted);
  assert.deepEqual(result.issues, []);
});

test('A1 snapshot: content inside a declared untracked directory is hashed', () => {
  const { root } = repo();
  fs.mkdirSync(path.join(root, 'gen'));
  fs.writeFileSync(path.join(root, 'gen/impl.js'), 'export const reviewed = 1;\n');
  const before = snapshotRepository({ root, changeId: 'demo', untrackedPaths: ['gen'] });
  fs.writeFileSync(path.join(root, 'gen/impl.js'), 'export const unreviewed = 666;\n');
  const after = snapshotRepository({ root, changeId: 'demo', untrackedPaths: ['gen'] });
  assert.notEqual(after.source_hash, before.source_hash, 'declared directory content changed but source_hash did not');
});

test('A1 end-to-end: changing a file in a declared untracked directory after sealing makes the gates ineligible', async () => {
  const { cwd, change } = await gatedFixture({
    prepare: ({ cwd: root, change: dir }) => {
      fs.mkdirSync(path.join(root, 'gen'));
      fs.writeFileSync(path.join(root, 'gen/impl.js'), 'export const reviewed = 1;\n');
      const tasks = path.join(dir, 'tasks.md');
      fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replace('      - src/link\n', '      - src/link\n      - gen\n'));
    },
    tamper: ({ cwd: root }) => fs.writeFileSync(path.join(root, 'gen/impl.js'), 'export const unreviewed = 666;\n'),
  });
  const observed = { handoffFresh: validateHandoffManifest('demo', { cwd }).ok, gateIssues: evidence(cwd, change, DELIVERY.uncommitted).issues.length };
  assert.deepEqual({ handoffFresh: observed.handoffFresh, gatesEligible: observed.gateIssues === 0 }, { handoffFresh: false, gatesEligible: false });
});

test('A2 snapshot: a tracked file whose name is not UTF-8 is hashed by content', () => {
  const { root, git } = repo();
  const name = Buffer.concat([Buffer.from(path.join(root, 'src-')), Buffer.from([0xff, 0xfe]), Buffer.from('.js')]);
  fs.writeFileSync(name, 'export const reviewed = 1;\n');
  git('add', '-A'); git('commit', '-qm', 'binary name');
  const before = snapshotRepository({ root, changeId: 'demo' });
  fs.writeFileSync(name, 'export const unreviewed = 666;\n');
  const after = snapshotRepository({ root, changeId: 'demo' });
  assert.notEqual(after.source_hash, before.source_hash, 'non-UTF-8 named file changed but source_hash did not');
});

test('A2 end-to-end: changing a non-UTF-8 named tracked file after sealing makes the gates ineligible', async () => {
  let file;
  const { cwd, change } = await gatedFixture({
    prepare: ({ cwd: root, git }) => {
      file = Buffer.concat([Buffer.from(path.join(root, 'src-')), Buffer.from([0xff, 0xfe]), Buffer.from('.js')]);
      fs.writeFileSync(file, 'export const reviewed = 1;\n');
      git('add', '-A');
    },
    tamper: () => fs.writeFileSync(file, 'export const unreviewed = 666;\n'),
  });
  const observed = { handoffFresh: validateHandoffManifest('demo', { cwd }).ok, gateIssues: evidence(cwd, change, DELIVERY.uncommitted).issues.length };
  assert.deepEqual({ handoffFresh: observed.handoffFresh, gatesEligible: observed.gateIssues === 0 }, { handoffFresh: false, gatesEligible: false });
});

test('A3 snapshot: a submodule checked out at another commit changes the governed digest', () => {
  const sub = repo();
  fs.writeFileSync(path.join(sub.root, 'a.js'), 'b\n');
  sub.git('commit', '-qam', 'second');
  const first = sub.git('rev-parse', 'HEAD~1');
  const { root, git } = repo();
  git('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub.root, 'vendor/lib');
  git('commit', '-qm', 'submodule');
  const before = snapshotRepository({ root, changeId: 'demo' });
  execFileSync('git', ['checkout', '-q', first], { cwd: path.join(root, 'vendor/lib'), stdio: 'ignore' });
  const after = snapshotRepository({ root, changeId: 'demo' });
  assert.notEqual(after.source_hash, before.source_hash, 'submodule moved to another commit but source_hash did not change');
});

test('A3 end-to-end: moving a tracked submodule after sealing makes the gates ineligible', async () => {
  const sub = repo();
  fs.writeFileSync(path.join(sub.root, 'a.js'), 'b\n');
  sub.git('commit', '-qam', 'second');
  const first = sub.git('rev-parse', 'HEAD~1');
  const { cwd, change } = await gatedFixture({
    prepare: ({ git }) => {
      git('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub.root, 'vendor/lib');
    },
    tamper: ({ cwd: root }) => execFileSync('git', ['checkout', '-q', first], { cwd: path.join(root, 'vendor/lib'), stdio: 'ignore' }),
  });
  const observed = { handoffFresh: validateHandoffManifest('demo', { cwd }).ok, gateIssues: evidence(cwd, change, DELIVERY.uncommitted).issues.length };
  assert.deepEqual({ handoffFresh: observed.handoffFresh, gatesEligible: observed.gateIssues === 0 }, { handoffFresh: false, gatesEligible: false });
});
