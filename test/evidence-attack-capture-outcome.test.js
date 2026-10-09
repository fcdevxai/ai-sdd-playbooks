/**
 * Adversarial probes (capture subsystem): child outcome, raw completeness and containment
 * under design F06/F04 and Amendment R5 rule 4. Each test asserts the SAFE behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { captureRun, captureRunSync } from '../src/tokens/capture.js';
import { run } from '../src/cli/dispatch.js';

const cli = fileURLToPath(new URL('../bin/playbook.js', import.meta.url));
const root = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `audit-capture-${tag}-`));
const node = (source) => [process.execPath, '-e', source];
const latestRun = (cwd) => {
  const dir = path.join(cwd, '.specloom', 'runs');
  return path.join(dir, fs.readdirSync(dir).sort().at(-1));
};

test('AUD-O1: RAW mode survives a consumer that closes the pipe — child outcome and full raw evidence are kept or the failure is explicit', async () => {
  const cwd = root('epipe');
  const total = 200 * 65536;
  const source = 'let n = 0; const b = Buffer.alloc(65536, 65); (function w() { if (n++ >= 200) return; process.stdout.write(b, () => setImmediate(w)); })();';
  const child = spawn(process.execPath, [cli, 'run', '--raw', '--change', 'demo', '--step', 'apply', '--agent', 'Codex', '--cwd', cwd, '--', ...node(source)],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  child.stdout.once('data', () => child.stdout.destroy());
  const [code] = await new Promise((resolve) => child.on('close', (...args) => resolve(args)));
  const dir = latestRun(cwd);
  const receipt = path.join(dir, 'execution-receipt.json');
  const explicit = /evidence capture failed/.test(stderr);
  assert.ok(fs.existsSync(receipt) || explicit,
    `wrapper exit ${code}; no receipt and no explicit evidence error. stderr: ${stderr.split('\n').slice(0, 6).join(' | ')}`);
  if (fs.existsSync(receipt) && !explicit) {
    assert.equal(fs.statSync(path.join(dir, 'stdout.raw')).size, total, 'raw stdout incomplete');
  }
});

test('AUD-O2: gate-check never prints a success mark for a command whose evidence capture failed', async () => {
  const base = root('gate');
  const hub = path.join(base, 'hub');
  const backend = path.join(base, 'backend');
  fs.mkdirSync(path.join(hub, 'openspec', 'changes', 'demo'), { recursive: true });
  fs.mkdirSync(backend);
  fs.writeFileSync(path.join(backend, 'verify.cjs'), 'console.log("ok")');
  fs.writeFileSync(path.join(hub, 'openspec', 'changes', 'demo', 'proposal.md'), '# Demo\n\n## Impacted repos\n\n- backend\n');
  fs.writeFileSync(path.join(hub, 'playbook.config.yaml'), `version: 2
methodology:
  compatible: ">=0.1.0 <1.0.0"
capabilities:
  http: false
github:
  base_branch: main
  require_pull_request: true
  require_ci: true
repos:
  hub:
    role: sdd
    path: .
  backend:
    path: ../backend
    verification:
      tests: node verify.cjs
`);
  const original = fs.fsyncSync;
  let failed = false;
  fs.fsyncSync = (fd) => { if (!failed) { failed = true; throw new Error('injected fsync failure'); } return original(fd); };
  const out = []; const err = [];
  let code;
  try {
    code = await run(['gate-check', 'demo', '--cwd', hub], { out: (l) => out.push(String(l)), err: (l) => err.push(String(l)) });
  } finally {
    fs.fsyncSync = original;
  }
  assert.equal(failed, true);
  assert.notEqual(code, 0);
  const line = out.find((l) => l.includes('backend')) || '';
  assert.doesNotMatch(line, /✓/, `per-repo display claims success for a failed capture: "${line}" (exit ${code})`);
});

test('AUD-O3: `playbook run` telemetry never reads a usage.json that is a symbolic link outside the project', { todo: 'Non-blocking follow-up under design Amendment R6 (round 7 audit N7/N8): telemetry and run-store paths through symlinks; validation already rejects the result.' }, async () => {
  const cwd = root('usage-link');
  const outside = root('usage-outside');
  const argv = node('console.log(1)');
  fs.writeFileSync(path.join(outside, 'usage.json'), JSON.stringify({ changeId: 'demo', step: 'apply', command: argv.join(' ') }));
  fs.mkdirSync(path.join(cwd, '.specloom', 'runs', 'planted'), { recursive: true });
  fs.symlinkSync(path.join(outside, 'usage.json'), path.join(cwd, '.specloom', 'runs', 'planted', 'usage.json'));
  const result = await captureRun({ argv, cwd, changeId: 'demo', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex' });
  const usage = JSON.parse(fs.readFileSync(path.join(path.dirname(result.receiptPath), 'usage.json'), 'utf8'));
  assert.equal(usage.retryCount, 0, 'retryCount was derived from a file read through a symlink outside the project');
});

test('AUD-O4: raw evidence is never written outside the project through a symlinked .specloom', { todo: 'Non-blocking follow-up under design Amendment R6 (round 7 audit N7/N8): telemetry and run-store paths through symlinks; validation already rejects the result.' }, async () => {
  const cwd = root('specloom-link');
  const outside = root('specloom-outside');
  fs.symlinkSync(outside, path.join(cwd, '.specloom'));
  let result;
  try {
    result = await captureRun({ argv: node('console.log("secret-output")'), cwd, changeId: 'demo', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex' });
  } catch {
    return; // refusing is safe
  }
  const written = fs.existsSync(path.join(outside, 'runs')) ? fs.readdirSync(path.join(outside, 'runs')) : [];
  assert.equal(written.length, 0, `raw evidence and receipt written outside the project: ${path.join(outside, 'runs', written[0] || '')} (exit ${result.exitCode})`);
});

test('AUD-O5: synchronous capture keeps raw stderr byte-exact — a spawn error is recorded separately, not injected into the child stream', () => {
  const cwd = root('sync-enoent');
  const result = captureRunSync({ argv: ['definitely-not-a-real-binary-xyz'], cwd, changeId: 'demo', step: 'gate-check', harness: 'unknown', repoName: 'repo', agent: 'Codex' });
  assert.equal(result.exitCode, 127);
  assert.equal(fs.readFileSync(result.rawFiles.stderr.path).length, 0,
    `stderr.raw holds bytes the child never wrote: ${JSON.stringify(fs.readFileSync(result.rawFiles.stderr.path, 'utf8'))}`);
});

test('AUD-O6 (control): asynchronous missing executable keeps 127 in the receipt, separate spawn error', async () => {
  const cwd = root('async-enoent');
  const result = await captureRun({ argv: ['definitely-not-a-real-binary-xyz'], cwd, changeId: 'demo', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex' });
  assert.equal(result.exitCode, 127);
  const receipt = JSON.parse(fs.readFileSync(result.receiptPath, 'utf8'));
  assert.equal(receipt.exit_code, 127);
  assert.equal(fs.readFileSync(result.rawFiles.stderr.path).length, 0);
  assert.equal(result.rawFiles.combined.sha256, createHash('sha256').update('').digest('hex'));
});
