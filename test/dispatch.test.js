import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

test('the command surface is exactly the seven SDD 3.0 commands (AC-01)', () => {
  assert.deepEqual(COMMAND_NAMES, [
    'install', 'init', 'doctor', 'status', 'next', 'validate', 'sync',
  ]);
});

test('migrate is no longer a command (removed in 3.0)', async () => {
  const { io, err } = capture();
  const code = await run(['migrate'], io);
  assert.equal(code, EXIT.USAGE);
  assert.match(err.join('\n'), /unknown command 'migrate'/);
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

test('--version prints the package version (T13.2)', async () => {
  const { io, out } = capture();
  const code = await run(['--version'], io);
  assert.equal(code, EXIT.OK);
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(out.join('\n').trim(), pkg.version);
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

test('every command is implemented — none falls through to the Phase 0 stub', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-cmd-'));
  const g = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-g-'));
  const saved = { c: process.env.SDD_CLAUDE_SKILLS_DIR, a: process.env.SDD_AGENTS_SKILLS_DIR };
  process.env.SDD_CLAUDE_SKILLS_DIR = g;
  process.env.SDD_AGENTS_SKILLS_DIR = g;
  try {
    for (const name of COMMAND_NAMES) {
      const { io, out, err } = capture();
      await run([name, '--cwd', dir], io);
      assert.doesNotMatch(out.concat(err).join('\n'), /not implemented yet/, `${name} should be implemented`);
    }
  } finally {
    if (saved.c === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR; else process.env.SDD_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.SDD_AGENTS_SKILLS_DIR; else process.env.SDD_AGENTS_SKILLS_DIR = saved.a;
  }
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
