/**
 * Shared fixtures for evidence tests: a gated change whose three gates were sealed on a
 * dirty implementation, plus clones, CLI capture and binding helpers.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { writeHandoffManifest } from '../../src/tokens/handoff.js';
import { sha256 } from '../../src/tokens/evidence.js';
import { bindEvidence } from '../../src/tokens/binding.js';
import { run } from '../../src/cli/dispatch.js';
import { captureRun } from '../../src/tokens/capture.js';
import { sealReport } from '../../src/tokens/seal.js';
import { loadChange } from '../../src/config/artifacts.js';
import { inspectEvidence } from '../../src/lifecycle/eligibility.js';

export const CAPS = '{browser: false, http: true, cli: false, worker: false}';
export const GATES = [
  ['sdd-code-review', 'review', 'code-review-report.md', { schema: 'code-review-report', status: 'passed' }],
  ['sdd-security-gate', 'security', 'security-report.md', { schema: 'security-report', status: 'passed', risk: 'low' }],
  ['sdd-runtime-gate', 'runtime', 'runtime-gate-report.md', { schema: 'runtime-gate-report', status: 'passed' }],
];
export const DELIVERY = { uncommitted: { state: 'uncommitted', per_repo: [{ repo: 'hub', state: 'uncommitted' }] },
  committed: { state: 'committed', per_repo: [{ repo: 'hub', state: 'committed' }] } };
export const CONFIG = { capabilities: { http: true }, repos: { hub: { capabilities: { http: true } } } };

export async function gatedFixture({ prepare = () => {}, tamper = () => {}, prepareRuntime = () => {}, context = false } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-rebind-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
  git('init', '-q', '-b', 'demo'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture');
  const change = path.join(cwd, 'openspec/changes/demo');
  fs.mkdirSync(change, { recursive: true });
  fs.mkdirSync(path.join(cwd, 'openspec/specs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  let tooling = null;
  if (context) {
    tooling = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-rebind-tooling-'));
    const inTooling = (...args) => execFileSync('git', args, { cwd: tooling, stdio: ['ignore', 'pipe', 'pipe'] });
    inTooling('init', '-q', '-b', 'tooling'); inTooling('config', 'user.email', 'f@example.invalid'); inTooling('config', 'user.name', 'F');
    fs.writeFileSync(path.join(tooling, 'engine.js'), 'export const engine = 1;\n');
    inTooling('add', '-A'); inTooling('commit', '-qm', 'tooling');
  }
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), `version: 2\nmethodology: {compatible: ">=0.1.0 <1.0.0"}\ngithub: {base_branch: main, require_pull_request: true, require_ci: true}\ncapabilities: ${CAPS}\nrepos: {hub: {role: sdd, path: ., capabilities: ${CAPS}}${tooling ? `, tooling: {path: ${tooling}}` : ''}}\n`);
  fs.writeFileSync(path.join(cwd, '.gitignore'), '.specloom/\n');
  fs.writeFileSync(path.join(cwd, 'openspec/specs/system.md'), '# System\n');
  fs.writeFileSync(path.join(cwd, 'docs/doc_architecture.md'), '# Architecture\n');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(cwd, 'legacy.js'), 'export const legacy = true;\n');
  fs.writeFileSync(path.join(cwd, 'tool.sh'), '#!/bin/sh\n', { mode: 0o644 });
  fs.writeFileSync(path.join(change, 'proposal.md'), `---
schema: proposal
schema_version: 1
change_id: demo
status: approved
owner: tester
created: 2026-10-07
updated: 2026-10-07
impact: {public_contract: false, data_model: false, architecture_boundary: false, external_integration: false, cross_repository: false, authentication: false, authorization: false, infrastructure: false, concurrency: false, migration: false}
security: {risk: low, triggers: []}
---
# Demo
## Objective
Exercise portable validation.
## Guiding principle
Smallest change.
## Impacted modules
Fixture only.
## Impacted repos
- hub
## Expected behavior
Works.
## Acceptance criteria
- **AC-1:** works
## Error cases
- **EC-1:** fails safely
## Security considerations
- **SEC-1:** safe
## Constraints and non-goals
Fixture only.
## Open technical decisions
None.
`);
  fs.writeFileSync(path.join(change, 'tasks.md'), `---\nschema: tasks\nschema_version: 1\nchange_id: demo\nstatus: passed\nhandoff:\n${context ? '  context_repositories: [tooling]\n' : ''}  specs: []\n  architecture: []\n  contracts: []\n  required_skills: []\n  required_tools: [{name: playbook, context: hub, purpose: lifecycle}]\n  runtime_coverage: [{criterion: AC-1, repositories: [hub], capabilities: [http]}]\n  non_runtime: [{criterion: EC-1, rationale: Fixture error case proven by unit tests}, {criterion: SEC-1, rationale: Fixture security criterion proven by unit tests}]\n  unresolved_risks: []\n  blockers: []\n  source_paths:\n    hub:\n      - src/feature.js\n      - src/link\n---\n# Tasks\n`);
  git('add', '-A'); git('commit', '-qm', 'baseline');
  // Dirty implementation under review: modification, new declared file, deletion, mode change and a symlink.
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 2;\n');
  fs.mkdirSync(path.join(cwd, 'src'));
  fs.writeFileSync(path.join(cwd, 'src/feature.js'), 'export const feature = true;\n');
  fs.symlinkSync('../code.js', path.join(cwd, 'src/link'));
  fs.unlinkSync(path.join(cwd, 'legacy.js'));
  fs.chmodSync(path.join(cwd, 'tool.sh'), 0o755);
  await prepare({ cwd, git, change });
  for (const [handoffStage, step, reportName, fm] of GATES) {
    writeHandoffManifest('demo', { cwd, stage: handoffStage, agent: 'Codex' });
    const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
      changeId: 'demo', step, harness: 'codex', repoName: 'hub', agent: 'Codex' });
    const ref = { repository: 'hub', path: path.relative(cwd, captured.receiptPath), sha256: sha256(fs.readFileSync(captured.receiptPath)) };
    const report = { ...fm, schema_version: 2, change_id: 'demo' };
    if (step === 'runtime') {
      report.adapters = { http: { status: 'passed', receipts: [ref] } };
      report.coverage = [{ criterion: 'AC-1', repository: 'hub', adapter: 'http', receipt: ref }];
      await prepareRuntime({ report, manifest: JSON.parse(fs.readFileSync(path.join(change, 'handoff-manifest.json'))), ref });
    }
    fs.writeFileSync(path.join(change, reportName), `---\n${yaml.dump(report)}---\n# Report\n## Acceptance criteria\nAC-1 passed\n## Security considerations\nSEC-1 passed\n## Regression\nNo regression\n`);
    sealReport('demo', reportName, { cwd, receipts: [captured.receiptPath], delivery: DELIVERY.uncommitted });
  }
  await tamper({ cwd, git, change });
  return { cwd, git, change };
}

export const commitEverything = ({ git }) => { git('add', '-A'); git('commit', '-qm', 'implementation'); };
export const refreshHandoff = (cwd) => writeHandoffManifest('demo', { cwd, stage: 'sdd-commit', agent: 'Codex' });
export const evidence = (cwd, change, delivery = DELIVERY.committed) => inspectEvidence('demo', { cwd, config: CONFIG,
  artifacts: loadChange(change).artifacts, delivery });
export const bindAll = (cwd) => GATES.map(([, , report]) => bindEvidence('demo', report, { cwd }));
export const reportBytes = (change) => GATES.map(([, , report]) => fs.readFileSync(path.join(change, report), 'utf8'));

export const bindingFiles = (change) => fs.readdirSync(change).filter((name) => name.startsWith('evidence-binding-')).sort();
export const bindingFor = (change, report, sha) => path.join(change, `evidence-binding-${report.replace(/\.md$/, '')}-hub-${sha}.json`);
export const headOf = (git) => git('rev-parse', 'HEAD');

export async function cli(args) {
  const out = []; const err = [];
  const code = await run(args, { out: (line) => out.push(String(line)), err: (line) => err.push(String(line)) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

export async function boundFlow(options = {}) {
  const fixtureState = await gatedFixture(options);
  commitEverything(fixtureState);
  bindAll(fixtureState.cwd);
  fixtureState.git('add', '-A'); fixtureState.git('commit', '-qm', 'commit the bindings');
  return fixtureState;
}

export function cloneOf(cwd, { depth = null } = {}) {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-rebind-clone-'));
  fs.rmSync(dest, { recursive: true });
  execFileSync('git', ['clone', '-q', ...(depth ? ['--depth', String(depth)] : []), `file://${cwd}`, dest], { stdio: ['ignore', 'pipe', 'pipe'] });
  return dest;
}

export const localOnlyOf = (result) => JSON.parse(result.out).local_only || [];
export const failedOf = (result) => JSON.parse(result.out).results.filter((row) => !row.valid);

export function editBinding(change, report, sha, mutate) {
  const file = bindingFor(change, report, sha);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  mutate(record);
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
}

export const REPORT = 'code-review-report.md';
