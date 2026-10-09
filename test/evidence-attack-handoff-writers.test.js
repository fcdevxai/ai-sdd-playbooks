/**
 * Independent adversarial probes: writers on detached/other branches, packet CLI symlink,
 * portable detached validation. Each test asserts the SAFE behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { EXIT } from '../src/cli/dispatch.js';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { sealReport } from '../src/tokens/seal.js';
import { captureRun } from '../src/tokens/capture.js';
import { boundFlow, cli, cloneOf, DELIVERY, gatedFixture } from './helpers/evidence-fixture.js';

async function freshReview(cwd, change) {
  writeHandoffManifest('demo', { cwd, stage: 'sdd-code-review', agent: 'Codex' });
  const run = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'review', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  fs.writeFileSync(path.join(change, 'code-review-report.md'), `---\n${yaml.dump({ schema: 'code-review-report', schema_version: 2, change_id: 'demo', status: 'passed' })}---\n# Report\n`);
  return run;
}

test('W1 seal refuses a detached HEAD', async () => {
  const { cwd, change, git } = await gatedFixture();
  git('add', '-A'); git('commit', '-qm', 'impl');
  const run = await freshReview(cwd, change);
  git('checkout', '-q', '--detach');
  assert.throws(() => sealReport('demo', 'code-review-report.md', { cwd, receipts: [run.receiptPath], delivery: DELIVERY.committed }));
});

test('W2 seal refuses another (non-base) branch', async () => {
  const { cwd, change, git } = await gatedFixture();
  git('add', '-A'); git('commit', '-qm', 'impl');
  const run = await freshReview(cwd, change);
  git('checkout', '-q', '-b', 'feature-x');
  assert.throws(() => sealReport('demo', 'code-review-report.md', { cwd, receipts: [run.receiptPath], delivery: DELIVERY.committed }));
});

test('W3 packet refuses a detached HEAD', async () => {
  const { cwd, git } = await gatedFixture();
  git('add', '-A'); git('commit', '-qm', 'impl');
  git('checkout', '-q', '--detach');
  const result = await cli(['packet', 'demo', '--stage', 'sdd-commit', '--agent', 'Codex', '--cwd', cwd]);
  assert.notEqual(result.code, EXIT.OK);
});

test('W4 seal refuses a manifest not generated at the current HEAD (same branch)', async () => {
  const { cwd, change, git } = await gatedFixture();
  const run = await freshReview(cwd, change);
  git('add', '-A'); git('commit', '-qm', 'impl with identical reviewed bytes');
  assert.throws(() => sealReport('demo', 'code-review-report.md', { cwd, receipts: [run.receiptPath], delivery: DELIVERY.committed }));
});

test('C3 playbook packet never writes through a symlinked context-packet.md onto a sealed report', async () => {
  const { cwd, change } = await gatedFixture();
  const report = path.join(change, 'security-report.md');
  const before = fs.readFileSync(report, 'utf8');
  fs.symlinkSync('security-report.md', path.join(change, 'context-packet.md'));
  await cli(['packet', 'demo', '--stage', 'sdd-commit', '--agent', 'Codex', '--cwd', cwd]);
  assert.equal(fs.readFileSync(report, 'utf8'), before);
});

test('P1 portable detached validation still fails a committed governed change after binding', async () => {
  const { cwd, git } = await boundFlow();
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 666;\n');
  git('add', '-A'); git('commit', '-qm', 'unreviewed change');
  const clone = cloneOf(cwd);
  const result = await cli(['validate', '--ci', '--cwd', clone]);
  assert.notEqual(result.code, EXIT.OK);
});

test('W5 a commit of staged bytes that differ from the reviewed working tree is never bound', async () => {
  const { bindAll, evidence } = await import('./helpers/evidence-fixture.js');
  const { cwd, change, git } = await gatedFixture();
  git('add', '-A');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 666;\n');
  git('add', 'code.js');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 2;\n'); // working tree back to reviewed bytes
  git('commit', '-qm', 'partial: index differs from reviewed tree');
  let bound = true;
  try { bindAll(cwd); } catch { bound = false; }
  assert.ok(!bound || evidence(cwd, change, DELIVERY.committed).issues.length > 0);
});
