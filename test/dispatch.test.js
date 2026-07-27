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

test('the command surface is exactly these twenty commands', () => {
  assert.deepEqual(COMMAND_NAMES, [
    'install', 'init', 'doctor', 'status', 'next', 'validate', 'sync', 'adr',
    'packet', 'spec-read', 'spec-index', 'run', 'usage-report',
    'repo-plan', 'commit-plan', 'prepare-repos', 'gate-check', 'changed-files', 'detect-siblings', 'contract-drift',
  ]);
});

test('migrate is not a command', async () => {
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

test('--version prints the package version', async () => {
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
  assert.match(out.join('\n'), /Usage: playbook/);
});

test('unknown command exits 3 (usage error)', async () => {
  const { io, err } = capture();
  const code = await run(['bogus'], io);
  assert.equal(code, EXIT.USAGE);
  assert.match(err.join('\n'), /unknown command/);
});

test('every command is implemented — none falls through to a stub', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cmd-'));
  const g = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-g-'));
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = g;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = g;
  try {
    for (const name of COMMAND_NAMES) {
      const { io, out, err } = capture();
      await run([name, '--cwd', dir], io);
      assert.doesNotMatch(out.concat(err).join('\n'), /not implemented yet/, `${name} should be implemented`);
    }
  } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR; else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR; else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
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
  const p = parseArgs(['validate', '--config', './playbook.config.yaml', '--ci']);
  assert.equal(p.command, 'validate');
  assert.equal(p.flags.config, './playbook.config.yaml');
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

// ---------------------------------------------------------------------------
// Self-extinguishing install notice (AC-6, AC-7, AC-8, SEC-2)
// ---------------------------------------------------------------------------

function withTargets(claude, agents, fn) {
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = claude;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = agents;
  return Promise.resolve(fn()).finally(() => {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR; else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR; else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  });
}

test('no target installed + command "status" → the install notice appears before the command output (AC-6, AC-8)', async () => {
  const claude = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-c-'));
  const agents = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-a-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-w-'));
  await withTargets(claude, agents, async () => {
    const { io, out } = capture();
    await run(['status', '--cwd', cwd], io);
    assert.match(out[0], /playbook install/);
  });
});

test('no target installed + command "install" → the notice does not appear (AC-7)', async () => {
  const claude = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-c-'));
  const agents = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-a-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-w-'));
  await withTargets(claude, agents, async () => {
    const { io, out } = capture();
    await run(['install', '--cwd', cwd], io);
    assert.doesNotMatch(out.join('\n'), /run `playbook install`/);
  });
});

test('no target installed + --json → the notice does not appear (SEC-2)', async () => {
  const claude = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-c-'));
  const agents = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-a-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-w-'));
  await withTargets(claude, agents, async () => {
    const { io, out } = capture();
    await run(['doctor', '--json', '--cwd', cwd], io);
    assert.equal(out.length, 1); // exactly one io.out call: the JSON payload, no notice line prepended
    assert.doesNotThrow(() => JSON.parse(out[0]));
  });
});

test('no target installed + "validate --ci" (JSON via a command-specific flag, not global --json) → the notice does not contaminate the output (SEC-2)', async () => {
  const claude = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-c-'));
  const agents = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-a-'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-w-'));
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', 'demo', 'proposal.md'), [
    '---',
    'schema: proposal',
    'schema_version: 1',
    'change_id: demo',
    'status: draft',
    'owner: x',
    'created: 2026-01-01',
    'updated: 2026-01-01',
    'impact: { public_contract: false, data_model: false, architecture_boundary: false, external_integration: false, cross_repository: false, authentication: false, authorization: false, infrastructure: false, concurrency: false, migration: false }',
    'security: { risk: low, triggers: [] }',
    '---',
    '# Demo',
    '## Objective',
    'x',
    '## Impacted modules',
    'x',
    '## Expected behavior',
    '### Happy path (Given/When/Then)',
    'x',
    '## Acceptance criteria',
    '**AC-1:** x',
    '## Error cases',
    '**EC-1:** x',
    '## Constraints and non-goals',
    'x',
    '## Open technical decisions',
    'x',
  ].join('\n'));
  await withTargets(claude, agents, async () => {
    const { io, out } = capture();
    await run(['validate', '--ci', '--cwd', dir], io);
    assert.equal(out.length, 1); // exactly one io.out call: the JSON payload, no notice line prepended
    assert.doesNotThrow(() => JSON.parse(out[0]));
  });
});

test('at least one target installed + command "status" → the notice does not appear (AC-8)', async () => {
  const claude = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-c-'));
  fs.writeFileSync(path.join(claude, '.playbook-version'), '0.1.0\n');
  const agents = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-a-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-w-'));
  await withTargets(claude, agents, async () => {
    const { io, out } = capture();
    await run(['status', '--cwd', cwd], io);
    assert.doesNotMatch(out.join('\n'), /run `playbook install`/);
  });
});
