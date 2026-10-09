import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { captureRun } from '../src/tokens/capture.js';
import { validateNamed } from '../src/schema/validate.js';
import { run, EXIT } from '../src/cli/dispatch.js';
import { validateReceiptReference } from '../src/tokens/receipt.js';

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-receipt-'));
  execFileSync('git', ['init', '-q', '-b', 'example'], { cwd });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd });
  fs.writeFileSync(path.join(cwd, 'code.js'), 'const answer = 1;\n');
  execFileSync('git', ['add', '.'], { cwd });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd });
  return cwd;
}

test('playbook capture emits private schema-valid receipt with actor, source, exit and exact raw hash', async () => {
  const cwd = fixture();
  const result = await captureRun({ argv: [process.execPath, '-e', 'process.stdout.write("ok\\n")'], cwd,
    changeId: 'example', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex', provider: 'unknown', model: 'unknown' });
  assert.equal(result.exitCode, 0);
  const file = path.join(path.dirname(result.logPath), 'execution-receipt.json');
  assert.equal(fs.existsSync(file), true);
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(validateNamed('execution-receipt', receipt).valid, true);
  assert.equal(receipt.actor.agent, 'Codex');
  assert.equal(receipt.repository.branch, 'example');
  assert.match(receipt.repository.commit_sha, /^[a-f0-9]{40}$/);
  assert.equal(receipt.exit_code, 0);
  assert.equal(receipt.raw.stdout.sha256, createHash('sha256').update('ok\n').digest('hex'));
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(Object.keys(receipt.environment).sort(), ['container', 'platform', 'runtime']);
  assert.ok(receipt.identity_issues.includes('MANIFEST_UNAVAILABLE'));
});

test('source mutation during execution makes the receipt ineligible', async () => {
  const cwd = fixture();
  const script = 'require("fs").writeFileSync("code.js", "const answer = 2;\\n")';
  const result = await captureRun({ argv: [process.execPath, '-e', script], cwd,
    changeId: 'example', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex' });
  const receipt = JSON.parse(fs.readFileSync(path.join(path.dirname(result.logPath), 'execution-receipt.json'), 'utf8'));
  assert.equal(receipt.source_changed_during_run, true);
  assert.ok(receipt.identity_issues.includes('SOURCE_CHANGED_DURING_RUN'));
});

test('CLI --repo binds execution to configured repository context', async () => {
  const cwd = fixture();
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), 'repos:\n  repo:\n    path: .\n');
  const out = []; const err = [];
  const code = await run(['run', '--change', 'example', '--step', 'apply', '--repo', 'repo', '--agent', 'Codex', '--cwd', cwd, '--', process.execPath, '-e', 'console.log("ok")'],
    { out: (line) => out.push(line), err: (line) => err.push(line) });
  assert.equal(code, EXIT.OK, err.join('\n'));
  const runs = fs.readdirSync(path.join(cwd, '.specloom/runs'));
  const receipt = JSON.parse(fs.readFileSync(path.join(cwd, '.specloom/runs', runs[0], 'execution-receipt.json'), 'utf8'));
  assert.equal(receipt.repository.name, 'repo');
  assert.equal(receipt.actor.agent, 'Codex');
  assert.equal(receipt.stage, 'apply');
});

test('CLI --repo accepts the implicit SDD repository without a repos map', async () => {
  const cwd = fixture();
  const out = []; const err = [];
  const code = await run(['run', '--change', 'example', '--step', 'apply', '--repo', 'loom', '--agent', 'Codex', '--cwd', cwd,
    '--', process.execPath, '-e', 'console.log("ok")'], { out: (line) => out.push(line), err: (line) => err.push(line) });
  assert.equal(code, EXIT.OK, err.join('\n'));
  const runs = fs.readdirSync(path.join(cwd, '.specloom/runs'));
  const receipt = JSON.parse(fs.readFileSync(path.join(cwd, '.specloom/runs', runs[0], 'execution-receipt.json'), 'utf8'));
  assert.equal(receipt.repository.name, 'loom');
});

test('a receipt written after an evidence persistence failure is never eligible evidence', async () => {
  const cwd = fixture();
  const real = fs.fsyncSync;
  let failed = false;
  fs.fsyncSync = (fd) => { if (!failed) { failed = true; throw new Error('injected fsync failure'); } return real(fd); };
  let result;
  try {
    result = await captureRun({ argv: [process.execPath, '-e', 'process.stdout.write("ok\\n")'], cwd,
      changeId: 'example', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex', provider: 'unknown', model: 'unknown' });
  } finally {
    fs.fsyncSync = real;
  }
  assert.equal(failed, true);
  assert.equal(result.exitCode, 0);
  assert.match(result.captureError.message, /injected fsync failure/);
  const file = result.receiptPath;
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(receipt.exit_code, 0);
  assert.match(receipt.capture_error, /injected fsync failure/);
  const reference = { repository: 'repo', path: path.relative(cwd, file),
    sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
  const checked = validateReceiptReference(reference, { cwd, changeId: 'example' });
  assert.equal(checked.ok, false);
  assert.match(checked.issues.join(' '), /capture/i);
});

test('a receipt for a signalled child is never eligible evidence', async () => {
  const cwd = fixture();
  const result = await captureRun({ argv: [process.execPath, '-e', 'process.kill(process.pid, "SIGTERM")'], cwd,
    changeId: 'example', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex' });
  const receipt = JSON.parse(fs.readFileSync(result.receiptPath, 'utf8'));
  assert.equal(receipt.signal, 'SIGTERM');
  const reference = { repository: 'repo', path: path.relative(cwd, result.receiptPath),
    sha256: createHash('sha256').update(fs.readFileSync(result.receiptPath)).digest('hex') };
  const forged = { ...receipt, exit_code: 0 };
  fs.writeFileSync(result.receiptPath, JSON.stringify(forged, null, 2) + '\n');
  reference.sha256 = createHash('sha256').update(fs.readFileSync(result.receiptPath)).digest('hex');
  const checked = validateReceiptReference(reference, { cwd, changeId: 'example' });
  assert.equal(checked.ok, false);
  assert.match(checked.issues.join(' '), /signal|ineligible/i);
});
