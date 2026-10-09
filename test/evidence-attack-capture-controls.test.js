/**
 * Adversarial controls (receipt references): attacks expected to be rejected. All should pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { captureRun } from '../src/tokens/capture.js';
import { validateReceiptReference } from '../src/tokens/receipt.js';
import { sha256 } from '../src/tokens/evidence.js';

async function setup(source = 'console.log("ok")', extra = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-capture-ctl-'));
  execFileSync('git', ['init', '-q', '-b', 'demo'], { cwd });
  execFileSync('git', ['-c', 'user.email=a@b.invalid', '-c', 'user.name=A', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd });
  const result = await captureRun({ argv: [process.execPath, '-e', source], cwd, changeId: 'demo', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex', ...extra });
  const ref = () => ({ repository: 'repo', path: path.relative(cwd, result.receiptPath), sha256: sha256(fs.readFileSync(result.receiptPath)) });
  return { cwd, result, ref, check: (r = ref(), o = {}) => validateReceiptReference(r, { cwd, changeId: 'demo', ...o }) };
}

test('CTL-1 baseline receipt validates', async () => {
  const s = await setup();
  assert.equal(s.check().ok, true, s.check().issues?.join());
});

test('CTL-2 same-size raw swap is rejected', async () => {
  const s = await setup('process.stdout.write("FAIL\\n")');
  fs.writeFileSync(s.result.rawFiles.stdout.path, 'PASS\n');
  assert.equal(s.check().ok, false);
});

test('CTL-3 raw file replaced by symlink to identical bytes outside is rejected', async () => {
  const s = await setup('process.stdout.write("ok\\n")');
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ctl-out-')), 'stdout.raw');
  fs.copyFileSync(s.result.rawFiles.stdout.path, outside);
  fs.rmSync(s.result.rawFiles.stdout.path); fs.symlinkSync(outside, s.result.rawFiles.stdout.path);
  assert.equal(s.check().ok, false);
});

test('CTL-4 run directory symlinked outside the project is rejected', async () => {
  const s = await setup();
  const dir = path.dirname(s.result.receiptPath);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-ctl-dir-'));
  fs.cpSync(dir, outside, { recursive: true });
  const linked = path.join(path.dirname(dir), 'linkedrun');
  fs.symlinkSync(outside, linked);
  const r = { ...s.ref(), path: `.specloom/runs/linkedrun/execution-receipt.json` };
  assert.equal(s.check(r).ok, false);
});

test('CTL-5 wrong change, wrong stage, wrong repository and traversal paths are rejected', async () => {
  const s = await setup();
  assert.equal(validateReceiptReference(s.ref(), { cwd: s.cwd, changeId: 'other' }).ok, false);
  assert.equal(s.check(s.ref(), { stage: 'runtime' }).ok, false);
  assert.equal(s.check({ ...s.ref(), repository: 'other' }).ok, false);
  assert.equal(s.check({ ...s.ref(), path: `.specloom/runs/../runs/${path.basename(path.dirname(s.result.receiptPath))}/execution-receipt.json` }).ok, false);
});

test('CTL-6 failing, signalled, unknown-agent and source-changing runs are ineligible', async () => {
  assert.equal((await setup('process.exit(7)')).check().ok, false);
  assert.equal((await setup('process.kill(process.pid, "SIGKILL")')).check().ok, false);
  assert.equal((await setup('1', { agent: 'unknown' })).check().ok, false);
  assert.equal((await setup('require("fs").writeFileSync("new.txt","x"); require("child_process").execSync("git add new.txt")')).check().ok, false);
});
