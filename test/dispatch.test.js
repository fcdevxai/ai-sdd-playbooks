import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { run, parseArgs, EXIT, COMMAND_NAMES } from '../src/cli/dispatch.js';

function capture() {
  const out = [];
  const err = [];
  return {
    io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) },
    out,
    err,
  };
}

test('exit-code map matches design §1.4', () => {
  assert.deepEqual(EXIT, { OK: 0, VIOLATION: 1, BLOCKED: 2, USAGE: 3, ENVIRONMENT: 4 });
});

test('the command surface is exactly the eight SDD 2.0 commands (AC-01)', () => {
  assert.deepEqual(COMMAND_NAMES, [
    'install', 'init', 'doctor', 'status', 'next', 'validate', 'sync', 'migrate',
  ]);
});

test('--help lists every command and exits 0 (AC-01)', async () => {
  const { io, out } = capture();
  const code = await run(['--help'], io);
  assert.equal(code, EXIT.OK);
  const text = out.join('\n');
  for (const name of COMMAND_NAMES) {
    assert.match(text, new RegExp(`\\b${name}\\b`), `help should mention ${name}`);
  }
});

test('no command prints help and exits 0', async () => {
  const { io, out } = capture();
  const code = await run([], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Usage: sdd/);
});

test('unknown command exits 3 (usage error)', async () => {
  const { io, err } = capture();
  const code = await run(['bogus'], io);
  assert.equal(code, EXIT.USAGE);
  assert.match(err.join('\n'), /unknown command/);
});

test('not-yet-implemented commands route to their stub', async () => {
  const stubbed = COMMAND_NAMES.filter((n) => !['validate', 'install', 'status', 'next', 'sync', 'init', 'doctor'].includes(n));
  for (const name of stubbed) {
    const { io, out } = capture();
    const code = await run([name], io);
    assert.equal(code, EXIT.OK, `${name} should route and exit 0`);
    assert.match(out.join('\n'), new RegExp(`^sdd ${name}:`), `${name} handler should run`);
  }
});

test('validate routes to its real handler (Phase 1)', async () => {
  const { io } = capture();
  // os.tmpdir() has no openspec/changes → "No SDD artifacts found", exit 0.
  const code = await run(['validate', '--cwd', os.tmpdir()], io);
  assert.equal(code, EXIT.OK);
});

test('parseArgs: boolean and value flags are captured', () => {
  const p = parseArgs(['status', '--json', '--cwd', '/tmp/x', '--yes']);
  assert.equal(p.command, 'status');
  assert.equal(p.flags.json, true);
  assert.equal(p.flags.yes, true);
  assert.equal(p.flags.cwd, '/tmp/x');
});

test('parseArgs: global flags may precede the command', () => {
  const p = parseArgs(['--quiet', 'validate']);
  assert.equal(p.command, 'validate');
  assert.equal(p.flags.quiet, true);
});

test('parseArgs: command-specific flags are forwarded in rest, not rejected', () => {
  const p = parseArgs(['validate', '--config', './sdd.config.yaml', '--ci']);
  assert.equal(p.command, 'validate');
  assert.equal(p.flags.config, './sdd.config.yaml');
  assert.deepEqual(p.rest, ['--ci']);
});

test('parseArgs: a value flag without a value is a usage error', () => {
  const p = parseArgs(['status', '--cwd']);
  assert.ok(p.error);
});

test('parseArgs: a flag where a command is expected is a usage error', () => {
  const p = parseArgs(['--nope']);
  assert.ok(p.error);
});
