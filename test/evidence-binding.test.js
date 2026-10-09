import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import matter from 'gray-matter';
import { writeHandoffManifest, governedManifestHash } from '../src/tokens/handoff.js';
import { sha256 } from '../src/tokens/evidence.js';
import { bindEvidence, validateEvidenceBinding } from '../src/tokens/binding.js';
import { run, EXIT } from '../src/cli/dispatch.js';
import { captureRun } from '../src/tokens/capture.js';
import { sealReport } from '../src/tokens/seal.js';
import { loadChange } from '../src/config/artifacts.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import { computeState } from '../src/lifecycle/engine.js';
import { CAPS, CONFIG, DELIVERY, GATES, REPORT, bindAll, bindingFiles, bindingFor, boundFlow, cli, cloneOf, commitEverything, editBinding, evidence, failedOf, gatedFixture, headOf, localOnlyOf, refreshHandoff, reportBytes } from './helpers/evidence-fixture.js';

async function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-bind-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
  git('init', '-q', '-b', 'example');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Fixture');
  const change = path.join(cwd, 'openspec/changes/example');
  fs.mkdirSync(change, { recursive: true });
  fs.mkdirSync(path.join(cwd, 'openspec/specs/contracts'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), 'version: 2\ncapabilities: {browser: false, http: true, cli: false, worker: false}\nrepos: {hub: {role: sdd, path: ., capabilities: {browser: false, http: true, cli: false, worker: false}}}\ncontract: {path_in_loom: openspec/specs/contracts/openapi.yaml}\n');
  fs.writeFileSync(path.join(cwd, 'openspec/specs/system.md'), '# System\n');
  fs.writeFileSync(path.join(cwd, 'openspec/specs/contracts/openapi.yaml'), 'openapi: 3.1.0\n');
  fs.writeFileSync(path.join(cwd, 'docs/doc_architecture.md'), '# Architecture\n');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const n = 1;\n');
  fs.writeFileSync(path.join(cwd, '.gitignore'), '.specloom/\n');
  fs.writeFileSync(path.join(change, 'proposal.md'), '---\nschema: proposal\nstatus: approved\nimpact: {architecture_boundary: true}\n---\n# Example\n## Impacted repos\n- hub\n## Acceptance criteria\n- **AC-1:** works\n## Security considerations\n- **SEC-1:** safe\n## Constraints and non-goals\nOnly fixture.\n');
  fs.writeFileSync(path.join(change, 'design.md'), '---\nschema: design\nstatus: approved\n---\n# Design\n');
  fs.writeFileSync(path.join(change, 'tasks.md'), '---\nschema: tasks\nstatus: in_progress\nhandoff:\n  specs: []\n  architecture: []\n  contracts: []\n  required_skills: []\n  required_tools: [{name: playbook, context: hub, purpose: lifecycle}]\n  runtime_coverage: [{criterion: AC-1, repositories: [hub], capabilities: [http]}]\n  non_runtime: [{criterion: SEC-1, rationale: Security fixture is covered by unit tests.}]\n  unresolved_risks: []\n  blockers: []\n---\n# Tasks\n- **Done**: [ ]\n');
  git('add', '.'); git('commit', '-qm', 'baseline');
  const { manifest, stagePath } = writeHandoffManifest('example', { cwd, stage: 'sdd-runtime-gate', agent: 'Codex' });
  const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'example', step: 'runtime', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  const receipt = { repository: 'hub', path: path.relative(cwd, captured.receiptPath), sha256: sha256(fs.readFileSync(captured.receiptPath)) };
  const manifestPath = path.join(change, 'handoff-manifest.json');
  const report = path.join(change, 'runtime-gate-report.md');
  const source_binding = {
    manifest_path: path.relative(cwd, stagePath),
    manifest_hash: sha256(fs.readFileSync(manifestPath)),
    governed_manifest_hash: governedManifestHash(manifest),
    repositories: manifest.repositories.map(({ name, branch, commit_sha, source_hash, tree_hash }) => ({ name, branch, commit_sha, source_hash, ...(tree_hash ? { tree_hash } : {}) })),
    proposal_hash: manifest.requirement.hash,
    design_hash: manifest.design.hash,
    normative_tasks_hash: manifest.tasks.normative_hash,
    contract_hashes: manifest.contracts.map(({ path: file, content_hash }) => ({ path: file, hash: content_hash })),
    receipts: [receipt], delivery_state: 'uncommitted',
  };
  fs.writeFileSync(report, `---\n${yaml.dump({ schema: 'runtime-gate-report', schema_version: 2, change_id: 'example', status: 'passed', adapters: { http: { status: 'passed', receipts: [receipt] } }, coverage: [{ criterion: 'AC-1', repository: 'hub', adapter: 'http', receipt }], source_binding })}---\n# Gate\n`);
  git('add', '.'); git('commit', '-qm', 'evidence only');
  return { cwd, change, git, report };
}

test('evidence-only commit can be rebound with explicit lineage', async () => {
  const { cwd, git } = await fixture();
  assert.equal(validateEvidenceBinding('example', 'runtime-gate-report.md', { cwd }).ok, false);
  const result = bindEvidence('example', 'runtime-gate-report.md', { cwd });
  assert.equal(result.bindings.length, 1);
  assert.equal(result.bindings[0].current_commit_sha, git('rev-parse', 'HEAD'));
  assert.equal(validateEvidenceBinding('example', 'runtime-gate-report.md', { cwd }).ok, true);
});

test('changed source or contract rejects rebinding', async () => {
  const source = await fixture();
  fs.writeFileSync(path.join(source.cwd, 'code.js'), 'export const n = 2;\n');
  source.git('add', '.'); source.git('commit', '-qm', 'source changed');
  assert.throws(() => bindEvidence('example', 'runtime-gate-report.md', { cwd: source.cwd }), /source|evidence.only|governed handoff/i);
  const contract = await fixture();
  fs.appendFileSync(path.join(contract.cwd, 'openspec/specs/contracts/openapi.yaml'), '# changed\n');
  contract.git('add', '.'); contract.git('commit', '-qm', 'contract changed');
  assert.throws(() => bindEvidence('example', 'runtime-gate-report.md', { cwd: contract.cwd }), /contract|source|evidence.only|governed handoff/i);
});

test('missing ancestry and path traversal reject binding', async () => {
  const { cwd } = await fixture();
  assert.throws(() => bindEvidence('example', '../outside.md', { cwd }), /report path|outside/i);
  const report = path.join(cwd, 'openspec/changes/example/runtime-gate-report.md');
  fs.writeFileSync(report, fs.readFileSync(report, 'utf8').replace(/commit_sha: [a-f0-9]{40}/, `commit_sha: ${'f'.repeat(40)}`));
  assert.throws(() => bindEvidence('example', 'runtime-gate-report.md', { cwd }), /ancestry|commit|receipt/i);
});

test('playbook evidence bind routes to canonical lineage operation', async () => {
  const { cwd } = await fixture();
  const out = []; const err = [];
  const code = await run(['evidence', 'bind', 'example', 'runtime-gate-report.md', '--cwd', cwd],
    { out: (line) => out.push(line), err: (line) => err.push(line) });
  assert.equal(code, EXIT.OK, err.join('\n'));
  assert.match(out.join('\n'), /Bound hub/);
});

// ---------------------------------------------------------------------------
// Real lifecycle order: dirty implementation -> approved gates -> commit -> bind.
// ---------------------------------------------------------------------------


test('real order: gates sealed on a dirty implementation survive an identical commit through explicit bind', async () => {
  const { cwd, git, change } = await gatedFixture();
  assert.deepEqual(evidence(cwd, change, DELIVERY.uncommitted).issues, []);
  commitEverything({ git, cwd });
  refreshHandoff(cwd);
  const stale = evidence(cwd, change);
  assert.match(stale.issues.join(' '), /explicit evidence binding missing|stale/i);
  assert.equal(computeState(CONFIG, null, loadChange(change).artifacts, DELIVERY.committed, stale).next.action, 'blocked');

  const before = reportBytes(change);
  const results = bindAll(cwd);
  assert.deepEqual(reportBytes(change), before, 'the original gate reports are preserved byte for byte');
  const [binding] = results[0].bindings;
  assert.equal(binding.previous_commit_sha.length, 40);
  assert.equal(binding.current_commit_sha, git('rev-parse', 'HEAD'));
  assert.equal(binding.equivalence.kind, 'identical-governed-content');
  assert.match(binding.equivalence.reviewed_tree_hash, /^[a-f0-9]{64}$/);
  assert.equal(binding.equivalence.committed_tree_hash, binding.equivalence.reviewed_tree_hash);
  assert.ok(binding.equivalence.governed_paths_committed.includes('src/feature.js'));
  assert.ok(binding.equivalence.governed_paths_committed.includes('legacy.js'));
  assert.ok(binding.equivalence.intervening_commits.includes(git('rev-parse', 'HEAD')));
  assert.equal(binding.equivalence.original_receipts.length, 1);

  const fresh = evidence(cwd, change);
  assert.deepEqual(fresh.issues, []);
  const next = computeState(CONFIG, null, loadChange(change).artifacts, DELIVERY.committed, fresh).next;
  assert.equal(next.action, 'run_skill');
  assert.equal(next.skill, 'sdd-commit');
});

test('bind validates every gate report independently and is explicit: no bind, no forgiveness', async () => {
  const { cwd, git, change } = await gatedFixture();
  commitEverything({ git });
  refreshHandoff(cwd);
  bindEvidence('demo', 'code-review-report.md', { cwd });
  const partial = evidence(cwd, change);
  assert.equal(partial.gates['code-review-report.md'].ok, true);
  assert.equal(partial.gates['security-report.md'].ok, false);
  assert.equal(partial.gates['runtime-gate-report.md'].ok, false);
});

test('a partial commit that leaves the working tree identical is rejected', async () => {
  const { cwd, git } = await gatedFixture();
  git('add', '-A'); git('reset', '-q', 'src/feature.js');
  git('commit', '-qm', 'partial: declared new file left out');
  assert.equal(git('status', '--short', 'src/feature.js'), '?? src/feature.js');
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd }), /governed content recorded in the destination commit differs/);
});

test('an uncommitted deletion, an unrecorded mode change and an extra committed file are rejected', async () => {
  for (const [label, commit, expected] of [
    ['deletion left uncommitted', ({ git }) => { git('add', '-A'); git('reset', '-q', '--', 'legacy.js'); git('commit', '-qm', 'x'); }, /governed content recorded in the destination commit differs/],
    ['mode not recorded', ({ git }) => { git('-c', 'core.fileMode=false', 'add', '-A'); git('-c', 'core.fileMode=false', 'commit', '-qm', 'x'); }, /governed content recorded in the destination commit differs/],
    ['extra unreviewed file', ({ git, cwd }) => { fs.writeFileSync(path.join(cwd, 'unreviewed.js'), 'x'); git('add', '-A'); git('commit', '-qm', 'x'); }, /governed handoff semantics changed/],
  ]) {
    const { cwd, git } = await gatedFixture();
    commit({ git, cwd });
    assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd }), expected, label);
  }
});

test('a normative artifact missing from the destination commit rejects the rebind', async () => {
  const { cwd, git, change } = await gatedFixture({ prepare: ({ change: dir }) => {
    fs.appendFileSync(path.join(dir, 'proposal.md'), '\nClarification added during review.\n');
  } });
  git('add', '-A'); git('reset', '-q', 'openspec/changes/demo/proposal.md');
  git('commit', '-qm', 'implementation without the edited proposal');
  assert.match(git('status', '--short', 'openspec/changes/demo/proposal.md'), /M/);
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd }), /governed reference .*proposal\.md differs in the destination commit|governed content recorded in the destination commit differs/);
  git('add', '-A'); git('commit', '-qm', 'now complete');
  refreshHandoff(cwd);
  assert.equal(bindAll(cwd).length, 3);
  assert.deepEqual(evidence(cwd, change).issues, []);
});

test('changed implementation bytes or changed normative content after sealing still reject', async () => {
  const bytes = await gatedFixture();
  fs.writeFileSync(path.join(bytes.cwd, 'code.js'), 'export const value = 3;\n');
  commitEverything(bytes);
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd: bytes.cwd }), /source changed|repository source|governed handoff/i);
  const normative = await gatedFixture();
  fs.appendFileSync(path.join(normative.change, 'proposal.md'), '\nNew requirement.\n');
  commitEverything(normative);
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd: normative.cwd }), /normative|governed/i);
});

test('a non-ancestor destination rejects the rebind and requires a rerun', async () => {
  const { cwd, git } = await gatedFixture();
  // Same content and branch name, but a history that does not descend from the sealed SHA.
  git('checkout', '-q', '--orphan', 'rewritten');
  git('add', '-A');
  git('commit', '-qm', 'rewritten root');
  git('branch', '-M', 'demo');
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd }), /missing Git ancestry/);
});

test('rebind never turns failed into passed or accepts missing, corrupt or capture-failed evidence', async () => {
  const failed = await gatedFixture();
  commitEverything(failed);
  const reviewPath = path.join(failed.change, 'code-review-report.md');
  fs.writeFileSync(reviewPath, fs.readFileSync(reviewPath, 'utf8').replace('status: passed', 'status: failed'));
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd: failed.cwd }), /cleared|passed|failed/i);

  const missing = await gatedFixture();
  commitEverything(missing);
  const securityPath = path.join(missing.change, 'security-report.md');
  const parsed = matter(fs.readFileSync(securityPath, 'utf8'));
  parsed.data.source_binding.receipts = [];
  fs.writeFileSync(securityPath, matter.stringify(parsed.content, parsed.data));
  assert.throws(() => bindEvidence('demo', 'security-report.md', { cwd: missing.cwd }), /receipt/i);

  const corrupt = await gatedFixture();
  commitEverything(corrupt);
  const runtimeParsed = matter(fs.readFileSync(path.join(corrupt.change, 'runtime-gate-report.md'), 'utf8'));
  const receiptFile = path.join(corrupt.cwd, runtimeParsed.data.source_binding.receipts[0].path);
  fs.appendFileSync(receiptFile, ' ');
  assert.throws(() => bindEvidence('demo', 'runtime-gate-report.md', { cwd: corrupt.cwd }), /receipt|hash/i);

  const capture = await gatedFixture();
  commitEverything(capture);
  const reviewParsed = matter(fs.readFileSync(path.join(capture.change, 'code-review-report.md'), 'utf8'));
  const reference = reviewParsed.data.source_binding.receipts[0];
  const file = path.join(capture.cwd, reference.path);
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...receipt, capture_error: 'fsync failed' }, null, 2) + '\n');
  reviewParsed.data.source_binding.receipts[0] = { ...reference, sha256: sha256(fs.readFileSync(file)) };
  fs.writeFileSync(path.join(capture.change, 'code-review-report.md'), matter.stringify(reviewParsed.content, reviewParsed.data));
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd: capture.cwd }), /capture/i);
});

test('a report sealed before the tree digest existed cannot be rebound across an implementation commit', async () => {
  const { cwd, git, change } = await gatedFixture();
  const file = path.join(change, 'code-review-report.md');
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  for (const repository of parsed.data.source_binding.repositories) delete repository.tree_hash;
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  commitEverything({ git });
  // Stripping the digest from a report sealed with one is a forgery of the pinned manifest (Amendment R5).
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd }), /sealed before the governed tree digest existed|differs from its pinned stage handoff manifest/);
});

test('rebinding is not delivery: a bound change still needs merged delivery before verification', async () => {
  const { cwd, git, change } = await gatedFixture();
  commitEverything({ git });
  refreshHandoff(cwd);
  bindAll(cwd);
  const state = computeState(CONFIG, null, loadChange(change).artifacts, DELIVERY.committed, evidence(cwd, change));
  assert.notEqual(state.lifecycle.state, 'verified');
  assert.notEqual(state.lifecycle.state, 'archived');
  assert.notEqual(state.next.skill, 'sdd-archive');
});

// ---------------------------------------------------------------------------
// Amendment R2: immutable bindings keyed by destination SHA; commit cycle ends.
// ---------------------------------------------------------------------------


test('flow: seal, implementation commit, bind, commit the binding, second evidence commit, all valid and terminating', async () => {
  const { cwd, git, change } = await gatedFixture();
  commitEverything({ git });
  const implementation = headOf(git);
  assert.equal(evidence(cwd, change).gates['code-review-report.md'].ok, false, 'unbound until the explicit bind');
  const results = bindAll(cwd);
  assert.ok(results.every((result) => result.created === true));
  assert.deepEqual(bindingFiles(change), GATES.map(([, , report]) => `evidence-binding-${report.replace(/\.md$/, '')}-hub-${implementation}.json`).sort());

  git('add', '-A'); git('commit', '-qm', 'commit the bindings');
  const evidenceCommit = headOf(git);
  assert.notEqual(evidenceCommit, implementation);
  assert.deepEqual(evidence(cwd, change).issues, [], 'an ancestral binding covers the later HEAD');
  assert.equal(git('status', '--short'), '', 'validation needed no further versioned file');

  fs.writeFileSync(path.join(change, 'extra-report.md'), '# Another evidence artifact\n');
  git('add', '-A'); git('commit', '-qm', 'second evidence commit');
  assert.deepEqual(evidence(cwd, change).issues, [], 'a second evidence commit still terminates');
  // Plan bookkeeping changes the full tasks hash: the packet is regenerated explicitly, the binding still covers HEAD.
  fs.appendFileSync(path.join(change, 'tasks.md'), '\n## Execution Report — bookkeeping\n\nrecorded after the gates\n');
  assert.match(evidence(cwd, change).issues.join(' '), /stale|fresh handoff/i);
  refreshHandoff(cwd);
  assert.deepEqual(evidence(cwd, change).issues, []);
  git('add', '-A'); git('commit', '-qm', 'bookkeeping and refreshed packet');
  assert.deepEqual(evidence(cwd, change).issues, []);
  git('commit', '-q', '--allow-empty', '-m', 'empty');
  assert.deepEqual(evidence(cwd, change).issues, []);
  const next = computeState(CONFIG, null, loadChange(change).artifacts, DELIVERY.committed, evidence(cwd, change)).next;
  assert.equal(next.skill, 'sdd-commit');

  const before = bindingFiles(change);
  const again = bindEvidence('demo', 'code-review-report.md', { cwd });
  assert.equal(again.created, false);
  assert.deepEqual(bindingFiles(change), before, 'repeating bind on a covered HEAD writes nothing');
});

test('bind is idempotent for the same destination and fails on a contradictory binding', async () => {
  const { cwd, git, change } = await gatedFixture();
  commitEverything({ git });
  const first = bindEvidence('demo', 'code-review-report.md', { cwd });
  assert.equal(first.created, true);
  const second = bindEvidence('demo', 'code-review-report.md', { cwd });
  assert.equal(second.created, false);
  assert.equal(second.existing.length, 1);

  const file = bindingFor(change, 'code-review-report.md', headOf(git));
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.equivalence.committed_tree_hash = 'f'.repeat(64);
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd }), /contradictory/i);
});

test('manipulated lineage is rejected by validation', async () => {
  const mutations = {
    'sealed commit': (record) => { record.previous_commit_sha = 'a'.repeat(40); },
    'report hash': (record) => { record.report.hash = 'b'.repeat(64); },
    'reviewed digest': (record) => { record.equivalence.reviewed_tree_hash = 'c'.repeat(64); },
    'committed digest': (record) => { record.equivalence.committed_tree_hash = 'd'.repeat(64); },
    'original receipts': (record) => { record.equivalence.original_receipts = []; },
    'destination identity': (record) => { record.current_commit_sha = 'e'.repeat(40); },
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const { cwd, git, change } = await gatedFixture();
    commitEverything({ git });
    bindAll(cwd);
    const file = bindingFor(change, 'code-review-report.md', headOf(git));
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    mutate(record);
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    const result = validateEvidenceBinding('demo', 'code-review-report.md', { cwd });
    assert.equal(result.ok, false, label);
  }
});

test('superseded bindings stay as verifiable lineage and tampering with them is detected', async () => {
  const { cwd, git, change } = await gatedFixture();
  commitEverything({ git });
  bindEvidence('demo', 'code-review-report.md', { cwd });
  const first = bindingFor(change, 'code-review-report.md', headOf(git));
  // The earlier binding file is corrupted; a new HEAD gets a new, versioned binding that records it as lineage.
  const damaged = JSON.parse(fs.readFileSync(first, 'utf8'));
  damaged.equivalence.reviewed_tree_hash = '0'.repeat(64);
  fs.writeFileSync(first, JSON.stringify(damaged, null, 2) + '\n');
  git('add', '-A'); git('commit', '-qm', 'evidence');
  const result = bindEvidence('demo', 'code-review-report.md', { cwd });
  assert.equal(result.created, true);
  const second = bindingFor(change, 'code-review-report.md', headOf(git));
  const record = JSON.parse(fs.readFileSync(second, 'utf8'));
  assert.equal(record.supersedes.length, 1);
  assert.equal(record.supersedes[0].path, path.relative(cwd, first));
  assert.equal(record.supersedes[0].sha256, sha256(fs.readFileSync(first)));
  const lineage = validateEvidenceBinding('demo', 'code-review-report.md', { cwd });
  assert.equal(lineage.ok, true, lineage.issues.join('; '));
  fs.appendFileSync(first, ' again');
  assert.equal(validateEvidenceBinding('demo', 'code-review-report.md', { cwd }).ok, false, 'lineage hash no longer matches');
});

test('a real code or contract change after binding is rejected and requires revalidation', async () => {
  const code = await gatedFixture();
  commitEverything(code);
  bindAll(code.cwd);
  code.git('add', '-A'); code.git('commit', '-qm', 'evidence');
  fs.writeFileSync(path.join(code.cwd, 'code.js'), 'export const value = 99;\n');
  code.git('add', '-A'); code.git('commit', '-qm', 'review fix');
  assert.equal(validateEvidenceBinding('demo', 'code-review-report.md', { cwd: code.cwd }).ok, false);
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd: code.cwd }), /governed handoff|source|differs/i);

  const architecture = await gatedFixture();
  commitEverything(architecture);
  bindAll(architecture.cwd);
  fs.appendFileSync(path.join(architecture.cwd, 'docs/doc_architecture.md'), '\nNew rule.\n');
  architecture.git('add', '-A'); architecture.git('commit', '-qm', 'architecture change');
  assert.equal(validateEvidenceBinding('demo', 'code-review-report.md', { cwd: architecture.cwd }).ok, false);
});

test('an ancestral binding cannot cover a history that does not descend from its destination', async () => {
  const { cwd, git } = await gatedFixture();
  commitEverything({ git });
  bindAll(cwd);
  git('checkout', '-q', '--orphan', 'rewritten');
  git('add', '-A');
  git('commit', '-qm', 'rewritten root');
  git('branch', '-M', 'demo');
  const result = validateEvidenceBinding('demo', 'code-review-report.md', { cwd });
  assert.equal(result.ok, false);
  assert.match(result.issues.join(' '), /ancestry/i);
});

// ---------------------------------------------------------------------------
// Amendment R2: portable `validate --ci` from a clean clone; local-only is never a pass.
// ---------------------------------------------------------------------------


test('CI from a clean clone without private receipts or sibling repositories passes with explicit local-only entries', async () => {
  const { cwd } = await boundFlow({ context: true });
  const clone = cloneOf(cwd);
  const tooling = fs.readFileSync(path.join(clone, 'playbook.config.yaml'), 'utf8').match(/tooling: \{path: ([^}]+)\}/)[1];
  fs.renameSync(tooling, `${tooling}-gone`);
  try {
    const result = await cli(['validate', '--ci', '--cwd', clone]);
    assert.equal(result.code, EXIT.OK, result.out + result.err);
    assert.deepEqual(failedOf(result).map((row) => [row.file, row.errors]), []);
    const reasons = localOnlyOf(result).map((entry) => `${entry.file} ${entry.check} ${entry.reason}`).join('\n');
    assert.match(reasons, /receipt/i);
    assert.match(reasons, /tooling/);
    assert.ok(localOnlyOf(result).every((entry) => entry.reason && entry.check && entry.file));
    const text = await cli(['validate', '--cwd', clone]);
    assert.notEqual(text.code, EXIT.OK, 'without --ci the missing receipts and sibling remain violations');
  } finally {
    fs.renameSync(`${tooling}-gone`, tooling);
  }
});

test('CI still rejects every defect a clean clone can prove', async () => {
  const mutations = {
    'stage manifest bytes': (clone, change) => {
      const file = fs.readdirSync(change).find((name) => name.startsWith('handoff-manifest-sdd-code-review-'));
      fs.appendFileSync(path.join(change, file), ' ');
    },
    'binding lineage': (clone, change) => {
      const file = fs.readdirSync(change).find((name) => name.startsWith('evidence-binding-code-review-report-hub-'));
      const record = JSON.parse(fs.readFileSync(path.join(change, file), 'utf8'));
      record.equivalence.reviewed_tree_hash = '9'.repeat(64);
      fs.writeFileSync(path.join(change, file), JSON.stringify(record, null, 2));
    },
    'report schema': (clone, change) => {
      const file = path.join(change, 'security-report.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/manifest_hash: [a-f0-9]{64}/, 'manifest_hash: nothex'));
    },
    'governed content': (clone) => {
      fs.writeFileSync(path.join(clone, 'code.js'), 'export const value = 1000;\n');
      execFileSync('git', ['add', '-A'], { cwd: clone });
      execFileSync('git', ['-c', 'user.email=f@example.invalid', '-c', 'user.name=F', 'commit', '-qm', 'drift'], { cwd: clone });
    },
  };
  const expected = {
    'stage manifest bytes': /stage handoff hash mismatch/,
    'binding lineage': /reviewed digest differs/,
    'report schema': /manifest_hash/,
    'governed content': /stale: source or content changed|differs from the reviewed snapshot|source tree changed/,
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const { cwd } = await boundFlow();
    const clone = cloneOf(cwd);
    mutate(clone, path.join(clone, 'openspec/changes/demo'));
    const result = await cli(['validate', '--ci', '--cwd', clone]);
    assert.equal(result.code, EXIT.VIOLATION, `${label}\n${result.out}`);
    const reasons = failedOf(result).flatMap((row) => row.errors).join('\n');
    assert.match(reasons, expected[label], label);
  }
});

test('a shallow clone never declares ancestry valid and reports it local-only with the remedy', async () => {
  const { cwd, git } = await boundFlow();
  git('commit', '-q', '--allow-empty', '-m', 'more history');
  const shallow = cloneOf(cwd, { depth: 1 });
  const result = await cli(['validate', '--ci', '--cwd', shallow]);
  assert.equal(result.code, EXIT.OK, result.out);
  const reasons = localOnlyOf(result).map((entry) => entry.reason).join('\n');
  assert.match(reasons, /history|shallow/i);
  assert.match(reasons, /fetch-depth|full history/i);
  const full = cloneOf(cwd);
  const complete = await cli(['validate', '--ci', '--cwd', full]);
  assert.equal(complete.code, EXIT.OK, complete.out);
  assert.doesNotMatch(localOnlyOf(complete).map((entry) => entry.reason).join('\n'), /history|shallow/i);
});

test('--ci cannot be used to satisfy a precondition and receipts that are present are still validated', async () => {
  const { cwd, change } = await boundFlow();
  const strict = await cli(['validate', 'demo', '--precondition', 'sdd-commit', '--json', '--cwd', cwd]);
  const withCi = await cli(['validate', 'demo', '--precondition', 'sdd-commit', '--ci', '--cwd', cwd]);
  assert.equal(JSON.parse(strict.out).met, JSON.parse(withCi.out).met);

  const clone = cloneOf(cwd);
  const bypass = await cli(['validate', 'demo', '--precondition', 'sdd-commit', '--ci', '--cwd', clone]);
  assert.equal(JSON.parse(bypass.out).met, false, 'strict evaluation in a clone without receipts');
  assert.notEqual(bypass.code, EXIT.OK);

  const parsed = matter(fs.readFileSync(path.join(change, 'code-review-report.md'), 'utf8'));
  const receipt = path.join(cwd, parsed.data.source_binding.receipts[0].path);
  fs.appendFileSync(receipt, ' ');
  const corrupt = await cli(['validate', '--ci', '--cwd', cwd]);
  assert.equal(corrupt.code, EXIT.VIOLATION, 'a present but altered receipt fails even in CI');
});

test('CI workflows fetch full history and check out the pull-request head commit', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  for (const file of ['.github/workflows/playbook-validation.yml', 'templates/project/github/workflows/playbook-validation.yml']) {
    const workflow = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(workflow, /fetch-depth:\s*0/, file);
    assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.ref \}\}/, `${file}: pull requests check out the exact head commit`);
  }
});

// ---------------------------------------------------------------------------
// Amendment R3: receipt references are validated for shape and containment
// before availability is decided; bindings are verified field by field.
// ---------------------------------------------------------------------------

import { validateNamed } from '../src/schema/validate.js';

const BAD_RECEIPT_PATHS = {
  traversal: '.specloom/runs/../../../escape/execution-receipt.json',
  'dot segment': '.specloom/runs/./x/execution-receipt.json',
  'extra segment': '.specloom/runs/a/b/execution-receipt.json',
  'wrong suffix': '.specloom/runs/a/other.json',
  absolute: '/etc/passwd',
};

test('the receipt reference schema accepts exactly one run directory', () => {
  const base = { repository: 'hub', sha256: 'a'.repeat(64) };
  const check = (receiptPath) => validateNamed('source-binding', {
    manifest_path: `openspec/changes/demo/handoff-manifest-sdd-apply-${'b'.repeat(64)}.json`, manifest_hash: 'c'.repeat(64),
    governed_manifest_hash: 'd'.repeat(64), repositories: [{ name: 'hub', branch: 'demo', commit_sha: 'e'.repeat(40), source_hash: 'f'.repeat(64) }],
    proposal_hash: '1'.repeat(64), design_hash: 'unknown', normative_tasks_hash: '2'.repeat(64), contract_hashes: [],
    receipts: [{ ...base, path: receiptPath }], delivery_state: 'uncommitted',
  }).valid;
  assert.equal(check('.specloom/runs/1791394026195-cdae6a0f-knSVIw/execution-receipt.json'), true);
  for (const [label, receiptPath] of Object.entries(BAD_RECEIPT_PATHS)) assert.equal(check(receiptPath), false, label);
});

test('a malformed or escaping receipt reference is a provable defect in CI and strict mode, never local-only', async () => {
  for (const [label, receiptPath] of Object.entries(BAD_RECEIPT_PATHS)) {
    const { cwd, change } = await gatedFixture();
    const file = path.join(change, 'code-review-report.md');
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    parsed.data.source_binding.receipts[0] = { ...parsed.data.source_binding.receipts[0], path: receiptPath };
    fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
    const ci = await cli(['validate', '--ci', '--cwd', cwd]);
    assert.equal(ci.code, EXIT.VIOLATION, `${label}\n${ci.out}`);
    const strict = await cli(['validate', '--cwd', cwd]);
    assert.notEqual(strict.code, EXIT.OK, label);
    const direct = inspectEvidence('demo', { cwd, config: CONFIG, artifacts: loadChange(change).artifacts, delivery: DELIVERY.uncommitted, ci: true });
    assert.equal(direct.gates['code-review-report.md'].ok, false, `${label}: ${JSON.stringify(direct.issues)}`);
    assert.ok(!direct.localOnly.some((entry) => /execution receipt/.test(entry.check) && entry.file === 'code-review-report.md' && entry.check.includes(receiptPath)), label);
  }
});

test('only a well-formed contained receipt that is absent from the checkout is local-only', async () => {
  const { cwd, change } = await gatedFixture();
  const file = path.join(change, 'code-review-report.md');
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  parsed.data.source_binding.receipts[0] = { ...parsed.data.source_binding.receipts[0], path: '.specloom/runs/1700000000000-deadbeef-ABCDEF/execution-receipt.json' };
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  const direct = inspectEvidence('demo', { cwd, config: CONFIG, artifacts: loadChange(change).artifacts, delivery: DELIVERY.uncommitted, ci: true });
  assert.ok(direct.localOnly.some((entry) => /execution receipt/.test(entry.check)), JSON.stringify(direct.localOnly));
  assert.equal(direct.issues.filter((issue) => /outside|receipt reference/i.test(issue)).length, 0);
});


test('every recorded binding field is verified against the sealed snapshot and the recomputed destination', async () => {
  const mutations = {
    'governed digest': (record) => { record.governed_hash = '1'.repeat(64); },
    'evidence-only paths': (record) => { record.evidence_only_paths = ['openspec/changes/demo/unrelated-report.md']; },
    'erased equivalence': (record) => { delete record.equivalence; },
    'committed paths': (record) => { record.equivalence.governed_paths_committed = ['code.js']; },
    'intervening commits': (record) => { record.equivalence.intervening_commits = ['a'.repeat(40)]; },
    'committed differs from reviewed': (record) => { record.equivalence.committed_tree_hash = record.equivalence.reviewed_tree_hash.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')); },
  };
  const expected = {
    'governed digest': /governed digest differs/, 'evidence-only paths': /evidence-only paths differ/,
    'erased equivalence': /needs the recorded equivalence/, 'committed paths': /committed governed paths differ/,
    'intervening commits': /intervening commits differ/, 'committed differs from reviewed': /committed digest/,
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const { cwd, git, change } = await boundFlow();
    editBinding(change, REPORT, git('log', '--format=%H', '-n', '2').split('\n')[1], mutate);
    const strict = validateEvidenceBinding('demo', REPORT, { cwd });
    assert.equal(strict.ok, false, `strict: ${label}`);
    assert.match(strict.issues.join(' '), expected[label], label);
    const portable = validateEvidenceBinding('demo', REPORT, { cwd, portable: true });
    assert.equal(portable.ok, false, `portable: ${label}`);
  }
});

test('an equivalence section on an evidence-only destination is rejected', async () => {
  const { cwd, git, change } = await fixture();
  bindEvidence('example', 'runtime-gate-report.md', { cwd });
  const file = fs.readdirSync(change).find((name) => name.startsWith('evidence-binding-runtime-gate-report-hub-'));
  const record = JSON.parse(fs.readFileSync(path.join(change, file), 'utf8'));
  assert.equal(validateEvidenceBinding('example', 'runtime-gate-report.md', { cwd }).ok, true);
  record.equivalence = { kind: 'identical-governed-content', reviewed_tree_hash: 'a'.repeat(64), committed_tree_hash: 'a'.repeat(64),
    governed_paths_committed: ['code.js'], intervening_commits: [git('rev-parse', 'HEAD')], original_receipts: [] };
  fs.writeFileSync(path.join(change, file), JSON.stringify(record, null, 2) + '\n');
  assert.equal(validateEvidenceBinding('example', 'runtime-gate-report.md', { cwd }).ok, false);
});

test('the complete predecessor chain is required, including omitted and foreign entries', async () => {
  const build = async () => {
    const state = await gatedFixture();
    commitEverything(state);
    bindEvidence('demo', REPORT, { cwd: state.cwd });
    const first = headOf(state.git);
    const firstFile = bindingFor(state.change, REPORT, first);
    const damaged = JSON.parse(fs.readFileSync(firstFile, 'utf8'));
    damaged.equivalence.original_receipts = [];
    fs.writeFileSync(firstFile, JSON.stringify(damaged, null, 2) + '\n');
    state.git('add', '-A'); state.git('commit', '-qm', 'evidence');
    bindEvidence('demo', REPORT, { cwd: state.cwd });
    const second = headOf(state.git);
    return { ...state, first, second, secondFile: bindingFor(state.change, REPORT, second) };
  };
  const honest = await build();
  assert.equal(validateEvidenceBinding('demo', REPORT, { cwd: honest.cwd }).ok, true, 'an honest chain passes');
  assert.equal(JSON.parse(fs.readFileSync(honest.secondFile, 'utf8')).supersedes.length, 1);

  const omitted = await build();
  editBinding(omitted.change, REPORT, omitted.second, (record) => { delete record.supersedes; });
  for (const portable of [false, true]) {
    const result = validateEvidenceBinding('demo', REPORT, { cwd: omitted.cwd, portable });
    assert.equal(result.ok, false, `omitted predecessor (portable=${portable})`);
    assert.match(result.issues.join(' '), /predecessor|lineage|supersedes/i);
  }

  const foreign = await build();
  const other = path.join(foreign.change, `evidence-binding-security-report-hub-${foreign.first}.json`);
  fs.writeFileSync(other, '{}\n');
  editBinding(foreign.change, REPORT, foreign.second, (record) => {
    record.supersedes.push({ path: path.relative(foreign.cwd, other), sha256: sha256(fs.readFileSync(other)) });
  });
  const result = validateEvidenceBinding('demo', REPORT, { cwd: foreign.cwd });
  assert.equal(result.ok, false);
  assert.match(result.issues.join(' '), /predecessor|lineage|supersedes/i);
});

test('portable CI also rejects an altered governed digest in a complete clean clone', async () => {
  const { cwd, git, change } = await gatedFixture();
  commitEverything({ git });
  bindAll(cwd);
  editBinding(change, REPORT, headOf(git), (record) => { record.governed_hash = '7'.repeat(64); });
  git('add', '-A'); git('commit', '-qm', 'altered metadata');
  const clone = cloneOf(cwd);
  const result = await cli(['validate', '--ci', '--cwd', clone]);
  assert.equal(result.code, EXIT.VIOLATION, result.out);
  assert.match(failedOf(result).flatMap((row) => row.errors).join('\n'), /governed digest|governed_hash/i);
});

// ---------------------------------------------------------------------------
// Amendment R4: contained regular reads, exact expected binding, latest applicable binding.
// ---------------------------------------------------------------------------

const bothModes = (cwd, report = REPORT) => [false, true].map((portable) => validateEvidenceBinding('demo', report, { cwd, portable }));

async function twoBindingChain() {
  const state = await gatedFixture();
  commitEverything(state);
  bindEvidence('demo', REPORT, { cwd: state.cwd });
  const first = headOf(state.git);
  const firstFile = bindingFor(state.change, REPORT, first);
  const damaged = JSON.parse(fs.readFileSync(firstFile, 'utf8'));
  damaged.equivalence.original_receipts = [];
  fs.writeFileSync(firstFile, JSON.stringify(damaged, null, 2) + '\n');
  state.git('add', '-A'); state.git('commit', '-qm', 'evidence');
  bindEvidence('demo', REPORT, { cwd: state.cwd });
  const second = headOf(state.git);
  return { ...state, first, second, firstFile, secondFile: bindingFor(state.change, REPORT, second) };
}

test('binding files and predecessors are read only when contained and regular', async () => {
  const symlinked = await boundFlow();
  const implementation = symlinked.git('log', '--format=%H', '-n', '2').split('\n')[1];
  const file = bindingFor(symlinked.change, REPORT, implementation);
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-rebind-outside-')), 'binding.json');
  fs.copyFileSync(file, outside);
  fs.unlinkSync(file);
  fs.symlinkSync(outside, file);
  for (const result of bothModes(symlinked.cwd)) {
    assert.equal(result.ok, false, 'a symlinked binding is never read');
    assert.match(result.issues.join(' '), /regular file|symbolic link|contained/i);
  }
  assert.throws(() => bindEvidence('demo', REPORT, { cwd: symlinked.cwd }), /regular file|symbolic link|contained/i);

  const predecessor = await twoBindingChain();
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-rebind-outside-')), 'predecessor.json');
  fs.copyFileSync(predecessor.firstFile, copy);
  fs.unlinkSync(predecessor.firstFile);
  fs.symlinkSync(copy, predecessor.firstFile);
  for (const result of bothModes(predecessor.cwd)) {
    assert.equal(result.ok, false, 'a symlinked predecessor is never hashed');
    assert.match(result.issues.join(' '), /regular file|symbolic link|contained|lineage/i);
  }
});

test('predecessor paths must be exact change-local binding names', async () => {
  const shapes = {
    traversal: (relative) => relative.replace('/evidence-binding-', '/../demo/evidence-binding-'),
    absolute: (relative, cwd) => path.join(cwd, relative),
    'other directory': (relative) => relative.replace('openspec/changes/demo/', 'docs/'),
  };
  for (const [label, rewrite] of Object.entries(shapes)) {
    const state = await twoBindingChain();
    editBinding(state.change, REPORT, state.second, (record) => {
      record.supersedes[0].path = rewrite(record.supersedes[0].path, state.cwd);
    });
    for (const result of bothModes(state.cwd)) {
      assert.equal(result.ok, false, label);
      assert.match(result.issues.join(' '), /lineage|predecessor|invalid evidence binding/i, label);
    }
  }
});

test('the complete expected binding is compared, including report identity and unknown fields', async () => {
  const mutations = {
    'report repository': (record) => { record.report.repository = 'foreign'; },
    'report path': (record) => { record.report.path = 'openspec/changes/foreign/code-review-report.md'; },
    'report path within the change': (record) => { record.report.path = 'openspec/changes/demo/other-code-review-report.md'; },
    'unknown field': (record) => { record.note = 'not recorded by the tool'; },
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const { cwd, git, change } = await boundFlow();
    editBinding(change, REPORT, git('log', '--format=%H', '-n', '2').split('\n')[1], mutate);
    for (const result of bothModes(cwd)) {
      assert.equal(result.ok, false, label);
      assert.match(result.issues.join(' '), /report|differs from the recomputed binding/i, label);
    }
    git('add', '-A'); git('commit', '-qm', 'altered identity');
    const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
    assert.equal(ci.code, EXIT.VIOLATION, `clean-clone CI: ${label}`);
  }
});

test('a contradictory latest binding fails instead of falling back to an older valid one', async () => {
  const { cwd, git, change } = await boundFlow();
  const implementation = git('log', '--format=%H', '-n', '2').split('\n')[1];
  const evidenceHead = headOf(git);
  const earlier = path.relative(cwd, bindingFor(change, REPORT, implementation));
  const later = JSON.parse(fs.readFileSync(bindingFor(change, REPORT, implementation), 'utf8'));
  later.current_commit_sha = evidenceHead;
  later.governed_hash = '8'.repeat(64);
  later.supersedes = [{ path: earlier, sha256: sha256(fs.readFileSync(path.join(cwd, earlier))) }];
  fs.writeFileSync(bindingFor(change, REPORT, evidenceHead), JSON.stringify(later, null, 2) + '\n');
  for (const result of bothModes(cwd)) {
    assert.equal(result.ok, false, 'the older valid binding does not mask the later contradiction');
    assert.match(result.issues.join(' '), /governed digest|latest/i);
  }
  assert.throws(() => bindEvidence('demo', REPORT, { cwd }), /contradictory/i);
  git('add', '-A'); git('commit', '-qm', 'contradictory later binding');
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.equal(ci.code, EXIT.VIOLATION, ci.out);
});

test('bindings outside the HEAD history are ignored and a non-linear history is ambiguous', async () => {
  const side = await boundFlow();
  const implementation = side.git('log', '--format=%H', '-n', '2').split('\n')[1];
  const base = headOf(side.git);
  side.git('checkout', '-q', '-b', 'side', implementation);
  fs.writeFileSync(path.join(side.change, 'side-report.md'), '# side evidence\n');
  side.git('add', '-A'); side.git('commit', '-qm', 'side');
  const sideSha = headOf(side.git);
  side.git('checkout', '-q', 'demo');
  assert.equal(headOf(side.git), base);
  fs.copyFileSync(bindingFor(side.change, REPORT, implementation), bindingFor(side.change, REPORT, sideSha));
  for (const result of bothModes(side.cwd)) assert.equal(result.ok, true, `a binding for a destination outside this history is ignored: ${result.issues}`);

  side.git('merge', '-q', '--no-ff', '-m', 'merge side', 'side');
  fs.copyFileSync(bindingFor(side.change, REPORT, implementation), bindingFor(side.change, REPORT, base));
  for (const result of bothModes(side.cwd)) {
    assert.equal(result.ok, false, 'two incomparable applicable bindings');
    assert.match(result.issues.join(' '), /ambiguous|latest/i);
  }
});

test('a superseded damaged predecessor stays allowed and the honest latest binding wins', async () => {
  const state = await twoBindingChain();
  for (const result of bothModes(state.cwd)) assert.equal(result.ok, true, result.issues.join('; '));
  const again = bindEvidence('demo', REPORT, { cwd: state.cwd });
  assert.equal(again.created, false);
});
