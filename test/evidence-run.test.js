import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runGateCheck } from '../src/repos/gate-check.js';

const cli = fileURLToPath(new URL('../bin/playbook.js', import.meta.url));

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-evidence-run-'));
  return {
    cwd,
    invoke(args, source) {
      return spawnSync(process.execPath, [cli, 'run', '--cwd', cwd, ...args, '--', process.execPath, '-e', source], {
        cwd,
        encoding: null,
        maxBuffer: 16 * 1024 * 1024,
      });
    },
    latest() {
      const root = path.join(cwd, '.specloom', 'runs');
      const name = fs.readdirSync(root).sort().at(-1);
      const dir = path.join(root, name);
      return { dir, usage: JSON.parse(fs.readFileSync(path.join(dir, 'usage.json'), 'utf8')) };
    },
  };
}

test('a failing child retains its exact exit code and unrecognized diagnostics', () => {
  const f = fixture();
  const result = f.invoke([], 'process.stderr.write("alien failure pattern: violet\\n"); process.exit(7)');
  assert.equal(result.status, 7);
  assert.match(result.stderr.toString(), /alien failure pattern: violet/);
  const { dir, usage } = f.latest();
  assert.equal(usage.exitCode, 7);
  assert.equal(fs.readFileSync(path.join(dir, 'full.log'), 'utf8'), 'alien failure pattern: violet\n');
});

test('recognized assertion failure keeps the diagnostic and observed totals', () => {
  const f = fixture();
  const result = f.invoke([], 'process.stderr.write("FAILURES!\\nFailed asserting that false is true\\nTests: 1, Assertions: 2\\n"); process.exit(1)');
  assert.equal(result.status, 1);
  assert.match(result.stderr.toString(), /Failed asserting that false is true/);
  assert.match(result.stderr.toString(), /1 tests, 2 assertions/);
});

test('a successful test summary retains test counts, assertions, warnings and skips', () => {
  const f = fixture();
  const result = f.invoke([], 'process.stdout.write("Tests: 12, Assertions: 45, Skipped: 2\\nWARNING: fallback used\\n")');
  assert.equal(result.status, 0);
  const summary = result.stdout.toString();
  assert.match(summary, /12/);
  assert.match(summary, /45/);
  assert.match(summary, /[Ww]arn/);
  assert.match(summary, /[Ss]kip/);
});

test('warning-only success and incomplete tests remain visible', () => {
  const f = fixture();
  const result = f.invoke([], 'process.stdout.write("Tests: 4, Assertions: 9, Skipped: 1, Incomplete: 1\\nWARNING: cache fallback\\n")');
  assert.equal(result.status, 0);
  assert.match(result.stdout.toString(), /1 warning line/);
  assert.match(result.stdout.toString(), /1 skipped line/);
  assert.match(result.stdout.toString(), /1 incomplete line/);
});

test('large raw stdout and stderr are complete, with independent byte hashes', () => {
  const f = fixture();
  const result = f.invoke([], 'process.stdout.write("A".repeat(2300000)); process.stderr.write("B".repeat(2400000));');
  assert.equal(result.status, 0);
  const { dir, usage } = f.latest();
  assert.equal(fs.readFileSync(path.join(dir, 'stdout.raw')).length, 2300000);
  assert.equal(fs.readFileSync(path.join(dir, 'stderr.raw')).length, 2400000);
  assert.equal(usage.rawFiles.stdout.sha256, createHash('sha256').update(Buffer.alloc(2300000, 65)).digest('hex'));
  assert.equal(usage.rawFiles.stderr.sha256, createHash('sha256').update(Buffer.alloc(2400000, 66)).digest('hex'));
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(dir, 'full.log')).mode & 0o777, 0o600);
  assert.equal(usage.exitCode, 0);
});

test('RAW sends exact non-UTF-8 bytes to their original streams', () => {
  const f = fixture();
  const result = f.invoke(['--raw'], 'process.stdout.write(Buffer.from([0,255,10])); process.stderr.write(Buffer.from([128,13,10]));');
  assert.equal(result.status, 0);
  assert.deepEqual(result.stdout, Buffer.from([0, 255, 10]));
  assert.deepEqual(result.stderr, Buffer.from([128, 13, 10]));
});

test('child global-looking flags after -- are forwarded unchanged', () => {
  const f = fixture();
  const result = spawnSync(process.execPath, [cli, 'run', '--cwd', f.cwd, '--', process.execPath, '-e',
    'process.stdout.write(process.argv.slice(1).join(","))', '--', '--json', '--help'], {
    cwd: f.cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(fs.readFileSync(path.join(f.latest().dir, 'full.log'), 'utf8'), '--json,--help');
});

test('a shell-looking child argument is data, never a command', () => {
  const f = fixture();
  const marker = path.join(f.cwd, 'unexpected-file');
  const value = `; touch ${marker}`;
  const result = spawnSync(process.execPath, [cli, 'run', '--cwd', f.cwd, '--', process.execPath, '-e',
    'process.stdout.write(process.argv[1])', '--', value], { cwd: f.cwd, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.readFileSync(path.join(f.latest().dir, 'full.log'), 'utf8'), value);
});

test('RAW and JSON are rejected together before child execution', () => {
  const f = fixture();
  const marker = path.join(f.cwd, 'unexpected-file');
  const result = f.invoke(['--raw', '--json'], `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`);
  assert.equal(result.status, 3);
  assert.equal(fs.existsSync(marker), false);
});

test('missing executable produces a distinct exit and retained diagnostic', () => {
  const f = fixture();
  const result = spawnSync(process.execPath, [cli, 'run', '--cwd', f.cwd, '--', 'missing-executable-for-evidence-test'], {
    cwd: f.cwd, encoding: 'utf8',
  });
  assert.equal(result.status, 127);
  assert.match(result.stderr, /ENOENT|missing-executable/);
  assert.equal(f.latest().usage.exitCode, 127);
});

test('incomplete tests and long diagnostics remain visible within display bounds', () => {
  const f = fixture();
  const result = f.invoke([], 'process.stdout.write("Tests: 3, Assertions: 8, Incomplete: 1\\n" + "X".repeat(100000) + "\\n")');
  assert.equal(result.status, 0);
  assert.match(result.stdout.toString(), /[Ii]ncomplete/);
  assert.ok(result.stdout.length < 5000);
  assert.equal(fs.readFileSync(path.join(f.latest().dir, 'full.log')).length,
    Buffer.byteLength('Tests: 3, Assertions: 8, Incomplete: 1\n') + 100001);
});

test('gate-check retains a large failing command without a process buffer limit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-gate-evidence-'));
  const hub = path.join(root, 'hub');
  const backend = path.join(root, 'backend');
  fs.mkdirSync(path.join(hub, 'openspec', 'changes', 'demo'), { recursive: true });
  fs.mkdirSync(backend);
  fs.writeFileSync(path.join(backend, 'verify.cjs'), 'process.stdout.write("A".repeat(2300000)); process.exit(7);');
  fs.writeFileSync(path.join(hub, 'openspec', 'changes', 'demo', 'proposal.md'),
    '# Demo\n\n## Impacted repos\n\n- backend\n');
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
  const result = runGateCheck({ slug: 'demo', cwd: hub });
  assert.equal(result.ok, false);
  assert.equal(result.results[0].exitCode, 7);
  assert.equal(fs.readFileSync(result.results[0].logPath).length, 2300000);
  assert.equal(fs.statSync(result.results[0].logPath).mode & 0o777, 0o600);
});

test('a non-executable command exits 126, distinct from a missing executable', () => {
  const f = fixture();
  const script = path.join(f.cwd, 'not-executable');
  fs.writeFileSync(script, '#!/bin/sh\necho unreachable\n', { mode: 0o644 });
  const result = spawnSync(process.execPath, [cli, 'run', '--cwd', f.cwd, '--', script], { cwd: f.cwd, encoding: 'utf8' });
  assert.equal(result.status, 126);
  assert.match(result.stderr, /EACCES|permission/i);
  assert.equal(f.latest().usage.exitCode, 126);
});

test('signal termination exits 128 plus the platform signal number', () => {
  const f = fixture();
  for (const name of ['SIGTERM', 'SIGUSR2', 'SIGABRT']) {
    const result = f.invoke([], `process.kill(process.pid, '${name}')`);
    assert.equal(result.status, 128 + os.constants.signals[name], name);
    assert.equal(f.latest().usage.exitCode, 128 + os.constants.signals[name], name);
  }
});
