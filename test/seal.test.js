import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { captureRun } from '../src/tokens/capture.js';
import { sealReport } from '../src/tokens/seal.js';
import { loadChange } from '../src/config/artifacts.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import { validateArtifactFrontmatter } from '../src/schema/validate.js';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { computeState } from '../src/lifecycle/engine.js';
import { retainEvidence } from '../src/tokens/retention.js';
import { sha256 } from '../src/tokens/evidence.js';

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-seal-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  git('init', '-q', '-b', 'demo'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  const change = path.join(cwd, 'openspec/changes/demo');
  fs.mkdirSync(change, { recursive: true }); fs.mkdirSync(path.join(cwd, 'openspec/specs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), 'version: 2\ncapabilities: {browser: false, http: true, cli: false, worker: false}\nrepos: {hub: {role: sdd, path: ., capabilities: {browser: false, http: true, cli: false, worker: false}}}\n');
  fs.writeFileSync(path.join(cwd, 'openspec/specs/system.md'), '# System\n');
  fs.writeFileSync(path.join(cwd, 'docs/doc_architecture.md'), '# Architecture\n');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(change, 'proposal.md'), '---\nschema: proposal\nstatus: approved\n---\n# Demo\n## Impacted repos\n- hub\n## Acceptance criteria\n- **AC-1:** works\n## Security considerations\n- **SEC-1:** safe\n');
  fs.writeFileSync(path.join(change, 'tasks.md'), '---\nschema: tasks\nstatus: passed\nhandoff:\n  specs: []\n  architecture: []\n  contracts: []\n  required_skills: []\n  required_tools: [{name: playbook, context: hub, purpose: lifecycle}]\n  runtime_coverage: [{criterion: AC-1, repositories: [hub], capabilities: [cli]}]\n  non_runtime: [{criterion: SEC-1, rationale: Fixture security criterion proven by unit tests}]\n  unresolved_risks: []\n  blockers: []\n---\n# Tasks\n');
  git('add', '.'); git('commit', '-qm', 'source');
  writeHandoffManifest('demo', { cwd, stage: 'sdd-code-review', agent: 'Codex' });
  fs.writeFileSync(path.join(change, 'code-review-report.md'), '---\nschema: code-review-report\nschema_version: 1\nchange_id: demo\nstatus: passed\n---\n# Review\n');
  return { cwd, change, git };
}

test('seal creates a valid report binding from a real captured receipt; source mutation invalidates it', async () => {
  const { cwd, change } = fixture();
  const run = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'review', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  const sealed = sealReport('demo', 'code-review-report.md', { cwd, receipts: [run.receiptPath],
    delivery: { state: 'uncommitted', per_repo: [{ repo: 'hub', state: 'uncommitted' }] } });
  assert.equal(sealed.source_binding.receipts.length, 1);
  assert.equal(validateArtifactFrontmatter(matter(fs.readFileSync(sealed.report, 'utf8')).data).valid, true);
  const check = () => inspectEvidence('demo', { cwd, config: {}, artifacts: loadChange(change).artifacts,
    delivery: { state: 'uncommitted', per_repo: [{ repo: 'hub', state: 'uncommitted' }] } });
  assert.equal(check().gates['code-review-report.md'].ok, true);
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 2;\n');
  assert.equal(check().gates['code-review-report.md'].ok, false);
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 1;\n');
  fs.appendFileSync(path.join(cwd, 'openspec/specs/system.md'), '\nNew architecture rule.\n');
  writeHandoffManifest('demo', { cwd, stage: 'sdd-code-review', agent: 'Codex' });
  assert.match(check().gates['code-review-report.md'].issues.join(' '), /governed handoff|repository source/i);
});

test('seal refuses missing receipts and pre-merge verification', async () => {
  const { cwd, change } = fixture();
  assert.throws(() => sealReport('demo', 'code-review-report.md', { cwd, receipts: [] }), /receipt/);
  writeHandoffManifest('demo', { cwd, stage: 'sdd-verify', agent: 'Codex' });
  const run = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'verify', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  fs.writeFileSync(path.join(change, 'verification-report.md'), '---\nschema: verification-report\nschema_version: 2\nchange_id: demo\nstatus: passed\n---\n# Verification\n## Acceptance criteria\nAC-1 passed\n## Security considerations\nSEC-1 passed\n## Regression\nNo regression\n');
  assert.throws(() => sealReport('demo', 'verification-report.md', { cwd, receipts: [run.receiptPath],
    delivery: { state: 'pr_open', per_repo: [{ repo: 'hub', state: 'pr_open' }] } }), /merged delivery/);
});

test('valid review, security, runtime and post-merge receipts advance to archive only after retention', async () => {
  const { cwd, change } = fixture();
  const merged = { state: 'merged', per_repo: [{ repo: 'hub', state: 'merged' }] };
  const config = { capabilities: { http: true }, repos: { hub: { capabilities: { http: true } } } };
  const stages = [
    ['sdd-code-review', 'review', 'code-review-report.md', { schema: 'code-review-report', status: 'passed' }],
    ['sdd-security-gate', 'security', 'security-report.md', { schema: 'security-report', status: 'passed', risk: 'low' }],
    ['sdd-runtime-gate', 'runtime', 'runtime-gate-report.md', { schema: 'runtime-gate-report', status: 'passed' }],
    ['sdd-verify', 'verify', 'verification-report.md', { schema: 'verification-report', status: 'passed' }],
  ];
  fs.writeFileSync(path.join(change, 'tasks.md'), fs.readFileSync(path.join(change, 'tasks.md'), 'utf8').replace('capabilities: [cli]', 'capabilities: [http]'));
  for (const [handoffStage, step, reportName, fm] of stages) {
    writeHandoffManifest('demo', { cwd, stage: handoffStage, agent: 'Codex' });
    const run = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
      changeId: 'demo', step, harness: 'codex', repoName: 'hub', agent: 'Codex' });
    const ref = { repository: 'hub', path: path.relative(cwd, run.receiptPath),
      sha256: sha256(fs.readFileSync(run.receiptPath)) };
    const report = { ...fm, schema_version: 2, change_id: 'demo' };
    if (step === 'runtime') {
      report.adapters = { http: { status: 'passed', receipts: [ref] } };
      report.coverage = [{ criterion: 'AC-1', repository: 'hub', adapter: 'http', receipt: ref }];
    }
    fs.writeFileSync(path.join(change, reportName), `---\n${yaml.dump(report)}---\n# Report\n## Acceptance criteria\nAC-1 passed\n## Security considerations\nSEC-1 passed\n## Regression\nNo regression\n`);
    sealReport('demo', reportName, { cwd, receipts: [run.receiptPath], delivery: merged });
  }
  const inspect = () => inspectEvidence('demo', { cwd, config, artifacts: loadChange(change).artifacts, delivery: merged });
  const before = inspect();
  assert.deepEqual(before.issues, []);
  assert.equal(computeState(config, null, loadChange(change).artifacts, merged, before).next.skill, 'sdd-archive');
  const rawDestination = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-seal-private-'));
  retainEvidence('demo', { cwd, rawDestination, delivery: merged });
  const after = inspect();
  assert.equal(after.closure.ok, true);
  assert.equal(computeState(config, null, loadChange(change).artifacts, merged, after).next.action, 'done');
});

test('seal refuses a receipt whose evidence capture failed even though the child exited 0', async () => {
  const { cwd } = fixture();
  const real = fs.fsyncSync;
  let failed = false;
  fs.fsyncSync = (fd) => { if (!failed) { failed = true; throw new Error('injected fsync failure'); } return real(fd); };
  let run;
  try {
    run = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
      changeId: 'demo', step: 'review', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  } finally {
    fs.fsyncSync = real;
  }
  assert.equal(run.exitCode, 0);
  assert.ok(run.captureError);
  assert.throws(() => sealReport('demo', 'code-review-report.md', { cwd, receipts: [run.receiptPath],
    delivery: { state: 'uncommitted', per_repo: [{ repo: 'hub', state: 'uncommitted' }] } }), /capture error|ineligible/i);
});
