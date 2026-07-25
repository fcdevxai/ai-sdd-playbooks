import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { run, EXIT } from '../src/cli/dispatch.js';
import { validateConfig, readConfigFile } from '../src/config/config.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-init-')); }
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}
const has = (dir, rel) => fs.existsSync(path.join(dir, rel));

test('init on a fresh repo creates the full project-local set and no core copies (AC-03)', async () => {
  const dir = tmp();
  const { io } = capture();
  assert.equal(await run(['init', '--cwd', dir], io), EXIT.OK);
  for (const f of [
    'playbook.config.yaml', 'playbook.lock', 'AGENTS.md', 'CLAUDE.md',
    '.github/copilot-instructions.md', '.github/workflows/playbook-validation.yml',
    '.github/CODEOWNERS', '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/ISSUE_TEMPLATE/user-story.md', '.github/workflows/archive-cleanup.yml',
    'docs/agent_architecture.md', 'docs/doc_architecture.md',
    'docs/doc_verification_guide.md', 'docs/sdd-workflow.md', 'docs/security-checklist.md',
    'openspec/specs/system.md', 'openspec/changes', 'openspec/changes/.gitkeep',
  ]) {
    assert.ok(has(dir, f), `expected ${f}`);
  }
  // no core skills copied into the consumer repo
  assert.equal(has(dir, 'skills'), false);
  assert.equal(validateConfig(readConfigFile(path.join(dir, 'playbook.config.yaml'))).valid, true);
});

test('init hints to run sdd-bootstrap-project when capabilities are all false', async () => {
  const dir = tmp();
  const { io, out } = capture();
  await run(['init', '--cwd', dir], io);
  assert.match(out.join('\n'), /sdd-bootstrap-project/);
  // and the machine-readable flag
  const jr = capture();
  await run(['init', '--json', '--cwd', dir], jr.io);
  assert.equal(JSON.parse(jr.out.join('\n')).capabilities_unset, true);
});

test('init does not hint when a capability is already enabled', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'playbook.config.yaml'),
    'version: 2\nmethodology:\n  compatible: ">=0.1.0 <1.0.0"\ncapabilities:\n  http: true\ngithub:\n  base_branch: main\n  require_pull_request: true\n  require_ci: true\n');
  const { io, out } = capture();
  await run(['init', '--cwd', dir], io);
  assert.doesNotMatch(out.join('\n'), /sdd-bootstrap-project/);
});

test('init is idempotent: re-run creates nothing new and edits no content (AC-03)', async () => {
  const dir = tmp();
  await run(['init', '--cwd', dir], capture().io);
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# my customized agents doc\n');
  const { io, out } = capture();
  await run(['init', '--json', '--cwd', dir], io);
  const res = JSON.parse(out.join('\n'));
  assert.deepEqual(res.created, []); // nothing new
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), '# my customized agents doc\n');
});

test('init adopts an existing doc at the official path without overwriting (AC-04)', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'doc_architecture.md'), 'CUSTOM ARCH\n');
  const { io, out } = capture();
  await run(['init', '--json', '--cwd', dir], io);
  const res = JSON.parse(out.join('\n'));
  assert.ok(res.adopted.some((a) => a.startsWith('architecture')));
  assert.equal(fs.readFileSync(path.join(dir, 'docs', 'doc_architecture.md'), 'utf8'), 'CUSTOM ARCH\n');
});

test('init maps agent_architecture without cross-adopting it as architecture (R-05)', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  // a non-default-named agent-architecture doc: must be an agent_architecture
  // candidate, never an architecture candidate.
  fs.writeFileSync(path.join(dir, 'docs', 'agent_architecture_notes.md'), 'AGENT\n');
  const { io, out } = capture();
  await run(['init', '--json', '--cwd', dir], io);
  const res = JSON.parse(out.join('\n'));
  assert.ok(res.candidates.some((c) => c.startsWith('agent_architecture:') && c.includes('agent_architecture_notes.md')));
  assert.ok(!res.candidates.some((c) => c.startsWith('architecture:') && c.includes('agent_architecture_notes.md')));
});

test('init does NOT auto-adopt an ambiguous candidate (C-09)', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'arquitectura.md'), 'MINE\n'); // plausible but not the official path
  const { io, out } = capture();
  await run(['init', '--json', '--cwd', dir], io);
  const res = JSON.parse(out.join('\n'));
  assert.ok(res.candidates.some((c) => c.includes('arquitectura.md')));
  assert.equal(has(dir, 'docs/doc_architecture.md'), false); // no duplicate created at the default path
  assert.equal(fs.readFileSync(path.join(dir, 'docs', 'arquitectura.md'), 'utf8'), 'MINE\n');
});

test('init does not overwrite an existing openspec/changes/.gitkeep on re-run (AC-2)', async () => {
  const dir = tmp();
  await run(['init', '--cwd', dir], capture().io);
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', '.gitkeep'), 'custom content\n');
  await run(['init', '--cwd', dir], capture().io);
  assert.equal(fs.readFileSync(path.join(dir, 'openspec', 'changes', '.gitkeep'), 'utf8'), 'custom content\n');
});

test('doctor --fix creates openspec/changes/.gitkeep via the same helper as init (AC-2)', async () => {
  const dir = tmp();
  await run(['init', '--cwd', dir], capture().io);
  fs.rmSync(path.join(dir, 'openspec', 'changes'), { recursive: true, force: true });
  const global = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-doctor-global-'));
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = global;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-doctor-empty-'));
  fs.writeFileSync(path.join(global, '.playbook-version'), '0.1.0\n');
  try {
    await run(['doctor', '--fix', '--cwd', dir], capture().io);
    assert.ok(has(dir, 'openspec/changes/.gitkeep'));
  } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR; else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR; else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
});

test('the shipped playbook-validation.yml runs only `playbook validate --ci`', async () => {
  const dir = tmp();
  await run(['init', '--cwd', dir], capture().io);
  const wf = fs.readFileSync(path.join(dir, '.github', 'workflows', 'playbook-validation.yml'), 'utf8');
  assert.doesNotThrow(() => yaml.load(wf)); // valid YAML
  assert.match(wf, /playbook validate --ci/);
  assert.doesNotMatch(wf, /grep|READY FOR PR|REQUIRES FIXES/);
});
