import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { run, EXIT } from '../src/cli/dispatch.js';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { captureRun } from '../src/tokens/capture.js';
import { sealReport } from '../src/tokens/seal.js';
import { sha256 } from '../src/tokens/evidence.js';

function makeRepo(changeId = 'demo') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-life-'));
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', changeId), { recursive: true });
  return dir;
}

function writeArtifact(dir, changeId, name, status) {
  fs.writeFileSync(
    path.join(dir, 'openspec', 'changes', changeId, name),
    `---\nstatus: ${status}\n---\n`,
  );
}

function capture() {
  const out = [];
  const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

test('playbook status prints both dimensions for a planned change', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved'); // no impact → design not required
  writeArtifact(dir, 'demo', 'tasks.md', 'ready');
  const { io, out } = capture();
  const code = await run(['status', '--json', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.lifecycle.state, 'planned');
  assert.equal(parsed.delivery.state, 'unknown');
});

test('playbook next on a planned change → sdd-apply', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved');
  writeArtifact(dir, 'demo', 'tasks.md', 'ready');
  const { io, out } = capture();
  const code = await run(['next', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Next skill: sdd-apply/);
});

test('playbook next rejects scalar passed gates without source-bound evidence', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved');
  writeArtifact(dir, 'demo', 'tasks.md', 'passed');
  writeArtifact(dir, 'demo', 'code-review-report.md', 'passed');
  writeArtifact(dir, 'demo', 'security-report.md', 'passed');
  writeArtifact(dir, 'demo', 'runtime-gate-report.md', 'passed');
  const { io, out } = capture();
  const code = await run(['next', '--json', '--cwd', dir], io);
  assert.equal(code, EXIT.BLOCKED);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.lifecycle.state, 'implemented');
  assert.match(parsed.next.reason, /EVIDENCE_INVALID/);
});

test('playbook next on a design-required approved proposal → sdd-design, writing no design.md', async () => {
  const dir = makeRepo();
  fs.writeFileSync(
    path.join(dir, 'openspec', 'changes', 'demo', 'proposal.md'),
    '---\nschema: proposal\nstatus: approved\nimpact:\n  architecture_boundary: true\n---\n',
  );
  const { io, out } = capture();
  const code = await run(['next', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /sdd-design/);
  assert.equal(fs.existsSync(path.join(dir, 'openspec', 'changes', 'demo', 'design.md')), false);
});

test('playbook next blocks unbound review evidence', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved'); // no impact → design not required
  writeArtifact(dir, 'demo', 'tasks.md', 'passed');
  writeArtifact(dir, 'demo', 'code-review-report.md', 'passed');
  const { io, out } = capture();
  const code = await run(['next', '--json', '--cwd', dir], io);
  assert.equal(code, EXIT.BLOCKED);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.next.action, 'blocked');
  assert.match(parsed.next.reason, /code-review-report.md/);
});

test('playbook next does not recommend commit from unbound gate reports in a dirty Git repo', async () => {
  const dir = makeRepo();
  execFileSync('git', ['init', '-q'], { cwd: dir }); // untracked artifacts → uncommitted
  writeArtifact(dir, 'demo', 'proposal.md', 'approved');
  writeArtifact(dir, 'demo', 'tasks.md', 'passed');
  writeArtifact(dir, 'demo', 'code-review-report.md', 'passed');
  writeArtifact(dir, 'demo', 'security-report.md', 'passed');
  writeArtifact(dir, 'demo', 'runtime-gate-report.md', 'passed');
  const { io, out } = capture();
  const code = await run(['next', '--cwd', dir], io);
  assert.equal(code, EXIT.BLOCKED);
  assert.match(out.join('\n'), /EVIDENCE_INVALID/);
});

test('playbook status with no change folders is a usage error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-empty-'));
  const { io } = capture();
  const code = await run(['status', '--cwd', dir], io);
  assert.equal(code, EXIT.USAGE);
});

test('playbook next resolves an explicit change-id among many', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-multi-'));
  for (const id of ['a', 'b']) {
    fs.mkdirSync(path.join(dir, 'openspec', 'changes', id), { recursive: true });
    writeArtifact(dir, id, 'proposal.md', 'approved');
    writeArtifact(dir, id, 'tasks.md', 'ready');
  }
  const { io, out } = capture();
  const code = await run(['next', 'b', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Next skill: sdd-apply/);
});

// --- Task 2.1: multi-repo delivery aggregation wired into status/next ---

test('playbook status --json on a single-repo change (no ## Impacted repos) includes delivery.per_repo with just the hub (AC-5/AC-6, no regression)', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved');
  writeArtifact(dir, 'demo', 'tasks.md', 'ready');
  const { io, out } = capture();
  const code = await run(['status', '--json', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.lifecycle.state, 'planned'); // unchanged from the pre-existing test above
  assert.equal(parsed.delivery.state, 'unknown'); // unchanged: no git repo here either
  assert.ok(Array.isArray(parsed.delivery.per_repo));
  assert.equal(parsed.delivery.per_repo.length, 1);
  assert.equal(parsed.delivery.per_repo[0].state, 'unknown');
});

test('playbook status (text) prints a per-repo breakdown line', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved');
  writeArtifact(dir, 'demo', 'tasks.md', 'ready');
  const { io, out } = capture();
  const code = await run(['status', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Per-repo:/);
});

test('verification and archive preconditions reject scalar passed reports while delivery is unmerged', async () => {
  const dir = makeRepo();
  for (const name of ['proposal.md', 'tasks.md', 'code-review-report.md', 'security-report.md',
    'runtime-gate-report.md', 'verification-report.md']) {
    writeArtifact(dir, 'demo', name, name === 'proposal.md' ? 'approved' : 'passed');
  }
  for (const skill of ['sdd-verify', 'sdd-archive']) {
    const { io, out } = capture();
    const code = await run(['validate', 'demo', '--precondition', skill, '--json', '--cwd', dir], io);
    assert.equal(code, EXIT.VIOLATION);
    const result = JSON.parse(out.join('\n'));
    assert.equal(result.met, false);
    assert.match(result.missing.join(' '), /evidence|merged/i);
  }
});

async function runtimeOnlyFixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-precondition-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  git('init', '-q', '-b', 'demo'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  const change = path.join(cwd, 'openspec/changes/demo');
  fs.mkdirSync(change, { recursive: true }); fs.mkdirSync(path.join(cwd, 'openspec/specs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'),
    'version: 2\ncapabilities: {browser: false, http: true, cli: false, worker: false}\nrepos: {hub: {role: sdd, path: .}}\n');
  fs.writeFileSync(path.join(cwd, 'openspec/specs/system.md'), '# System\n');
  fs.writeFileSync(path.join(cwd, 'docs/doc_architecture.md'), '# Architecture\n');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(change, 'proposal.md'), '---\nschema: proposal\nstatus: approved\n---\n# Demo\n## Impacted repos\n- hub\n## Acceptance criteria\n- **AC-1:** works\n## Security considerations\n- **SEC-1:** safe\n');
  fs.writeFileSync(path.join(change, 'tasks.md'), '---\nschema: tasks\nstatus: passed\nhandoff:\n  specs: []\n  architecture: []\n  contracts: []\n  required_skills: []\n  required_tools: [{name: playbook, context: hub, purpose: lifecycle}]\n  runtime_coverage: [{criterion: AC-1, repositories: [hub], capabilities: [http]}]\n  non_runtime: [{criterion: SEC-1, rationale: Fixture security criterion proven by unit tests}]\n  unresolved_risks: []\n  blockers: []\n---\n# Tasks\n');
  git('add', '.'); git('commit', '-qm', 'source');
  writeHandoffManifest('demo', { cwd, stage: 'sdd-runtime-gate', agent: 'Codex' });
  const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'runtime', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  const ref = { repository: 'hub', path: path.relative(cwd, captured.receiptPath), sha256: sha256(fs.readFileSync(captured.receiptPath)) };
  fs.writeFileSync(path.join(change, 'runtime-gate-report.md'), `---\n${yaml.dump({ schema: 'runtime-gate-report', schema_version: 2,
    change_id: 'demo', status: 'passed', adapters: { http: { status: 'passed', receipts: [ref] } },
    coverage: [{ criterion: 'AC-1', repository: 'hub', adapter: 'http', receipt: ref }] })}---\n# Runtime\n`);
  sealReport('demo', 'runtime-gate-report.md', { cwd, receipts: [captured.receiptPath],
    delivery: { state: 'uncommitted', per_repo: [{ repo: 'hub', state: 'uncommitted' }] } });
  return { cwd, change };
}

test('sdd-commit precondition agrees with next when only a runtime gate is sealed', async () => {
  const { cwd } = await runtimeOnlyFixture();
  const next = capture();
  assert.equal(await run(['next', 'demo', '--json', '--cwd', cwd], next.io), EXIT.OK);
  const routed = JSON.parse(next.out.join('\n'));
  assert.equal(routed.next.skill, 'sdd-code-review');
  for (const skill of ['sdd-commit', 'sdd-verify']) {
    const { io, out } = capture();
    const code = await run(['validate', 'demo', '--precondition', skill, '--json', '--cwd', cwd], io);
    const result = JSON.parse(out.join('\n'));
    assert.equal(result.met, false, skill);
    assert.equal(code, EXIT.VIOLATION, skill);
    assert.match(result.missing.join(' '), /code-review|security|lifecycle|runtime_cleared/i, skill);
  }
});

function withGitHubUnavailable(fn) {
  const keys = ['GH_CONFIG_DIR', 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  process.env.GH_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-gh-'));
  return Promise.resolve(fn()).finally(() => {
    for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  });
}

async function sealedThroughSecurity() {
  const { cwd, change } = await runtimeOnlyFixture();
  for (const [name, stage, schema] of [['code-review-report.md', 'sdd-code-review', 'code-review-report'],
    ['security-report.md', 'sdd-security-gate', 'security-report']]) {
    writeHandoffManifest('demo', { cwd, stage, agent: 'Codex' });
    const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
      changeId: 'demo', step: stage === 'sdd-code-review' ? 'review' : 'security', harness: 'codex', repoName: 'hub', agent: 'Codex' });
    fs.writeFileSync(path.join(change, name), `---\nschema: ${schema}\nschema_version: 2\nchange_id: demo\nstatus: passed\n${schema === 'security-report' ? 'risk: low\n' : ''}---\n# Report\n## Acceptance criteria\nAC-1 passed\n## Security considerations\nSEC-1 passed\n## Regression\nNo regression\n`);
    sealReport('demo', name, { cwd, receipts: [captured.receiptPath],
      delivery: { state: 'uncommitted', per_repo: [{ repo: 'hub', state: 'uncommitted' }] } });
  }
  return { cwd, change };
}

test('sdd-commit precondition is not met while next is blocked by an unavailable GitHub context (closure C7)', async () => {
  const { cwd } = await sealedThroughSecurity();
  await withGitHubUnavailable(async () => {
    const next = capture();
    await run(['next', 'demo', '--json', '--cwd', cwd], next.io);
    const routed = JSON.parse(next.out.join('\n')).next;
    assert.equal(routed.action, 'blocked', JSON.stringify(routed));
    const pre = capture();
    const code = await run(['validate', 'demo', '--precondition', 'sdd-commit', '--json', '--cwd', cwd], pre.io);
    const result = JSON.parse(pre.out.join('\n'));
    assert.equal(result.met, false, JSON.stringify(result.missing));
    assert.equal(code, EXIT.VIOLATION);
    assert.match(result.missing.join(' '), /next routes to blocked/);
  });
});

test('sdd-commit precondition is met exactly when next routes to commit', async () => {
  const { cwd, change } = await runtimeOnlyFixture();
  for (const [name, stage, schema] of [['code-review-report.md', 'sdd-code-review', 'code-review-report'],
    ['security-report.md', 'sdd-security-gate', 'security-report']]) {
    writeHandoffManifest('demo', { cwd, stage, agent: 'Codex' });
    const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
      changeId: 'demo', step: stage === 'sdd-code-review' ? 'review' : 'security', harness: 'codex', repoName: 'hub', agent: 'Codex' });
    fs.writeFileSync(path.join(change, name), `---\nschema: ${schema}\nschema_version: 2\nchange_id: demo\nstatus: passed\n${schema === 'security-report' ? 'risk: low\n' : ''}---\n# Report\n## Acceptance criteria\nAC-1 passed\n## Security considerations\nSEC-1 passed\n## Regression\nNo regression\n`);
    sealReport('demo', name, { cwd, receipts: [captured.receiptPath],
      delivery: { state: 'uncommitted', per_repo: [{ repo: 'hub', state: 'uncommitted' }] } });
  }
  // Sealing the later gates changed the handoff the runtime gate was bound to? Re-seal runtime on the final handoff.
  const next = capture();
  await run(['next', 'demo', '--json', '--cwd', cwd], next.io);
  const routed = JSON.parse(next.out.join('\n')).next;
  const pre = capture();
  const code = await run(['validate', 'demo', '--precondition', 'sdd-commit', '--json', '--cwd', cwd], pre.io);
  const result = JSON.parse(pre.out.join('\n'));
  assert.equal(result.met, routed.skill === 'sdd-commit', `${JSON.stringify(routed)} vs ${JSON.stringify(result.missing)}`);
  assert.equal(code === EXIT.OK, result.met);
});
