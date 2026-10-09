import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gatedFixture, DELIVERY, evidence } from './helpers/evidence-fixture.js';
import { snapshotRepository, commitTreeDigest, normativeTasksHash } from '../src/tokens/evidence.js';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { sealReport } from '../src/tokens/seal.js';
import { bindEvidence } from '../src/tokens/binding.js';
import matter from '../src/util/frontmatter.js';
import { fixture, merged } from './helpers/closure-fixture.js';
import { retainEvidence, validateClosureIndex } from '../src/tokens/retention.js';
import { captureRun } from '../src/tokens/capture.js';
import { receiptIneligibility } from '../src/tokens/receipt.js';

const mkrepo = (name) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), name));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  git('init', '-q', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  return { root, git };
};

test('26: nested submodule dirty bytes must stale the reviewed gate', async () => {
  const leaf = mkrepo('review9-leaf-');
  fs.writeFileSync(path.join(leaf.root, 'a.js'), 'export const value = 1;\n');
  leaf.git('add', '-A'); leaf.git('commit', '-qm', 'leaf');
  const middle = mkrepo('review9-middle-');
  middle.git('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', leaf.root, 'nested');
  middle.git('add', '-A'); middle.git('commit', '-qm', 'middle');
  let before, after;
  const state = await gatedFixture({
    prepare: ({ cwd, git }) => {
      git('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', middle.root, 'vendor/lib');
      git('-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '--recursive');
      before = snapshotRepository({ root: cwd, changeId: 'demo', untrackedPaths: ['src/feature.js', 'src/link'] });
    },
    tamper: ({ cwd }) => {
      fs.writeFileSync(path.join(cwd, 'vendor/lib/nested/a.js'), 'export const value = 2;\n');
      try { after = snapshotRepository({ root: cwd, changeId: 'demo', untrackedPaths: ['src/feature.js', 'src/link'] }); } catch (error) { after = { error: error.message }; }
    },
  });
  const checked = evidence(state.cwd, state.change, DELIVERY.uncommitted);
  console.log(JSON.stringify({ issue: 26, before, after, issues: checked.issues }));
  assert.notDeepEqual(checked.issues, []);
  assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd: state.cwd }), /submodule|source changed/);
  const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("probe")'], cwd: state.cwd,
    changeId: 'demo', step: 'runtime', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  assert.match(receiptIneligibility(JSON.parse(fs.readFileSync(captured.receiptPath))), /no comparable source snapshot|current handoff/);
});

test('26: changing a child during capture makes the receipt ineligible', async () => {
  const child = mkrepo('remediation-capture-child-');
  fs.writeFileSync(path.join(child.root, 'a.js'), 'reviewed\n');
  child.git('add', '-A'); child.git('commit', '-qm', 'reviewed');
  const state = await gatedFixture({ prepare: ({ git }) => {
    git('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', child.root, 'vendor/lib');
  } });
  const target = path.join(state.cwd, 'vendor/lib/a.js');
  const command = `require('node:fs').writeFileSync(${JSON.stringify(target)}, 'changed\\n')`;
  const captured = await captureRun({ argv: [process.execPath, '-e', command], cwd: state.cwd,
    changeId: 'demo', step: 'runtime', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  const receipt = JSON.parse(fs.readFileSync(captured.receiptPath));
  assert.equal(receipt.source_changed_during_run, true);
  assert.match(receiptIneligibility(receipt), /ineligible|source snapshot/);
});

test('27: committed non-UTF-8 path must not inherit the valid UTF-8 audit exclusion', () => {
  const { root, git } = mkrepo('review9-nonutf8-');
  const change = path.join(root, 'openspec/changes/demo');
  fs.mkdirSync(change, { recursive: true });
  fs.writeFileSync(path.join(change, 'tasks.md'), '---\nschema: tasks\nhandoff:\n  audit_evidence: ["log\uFFFD.md"]\n---\n# Tasks\n');
  fs.writeFileSync(path.join(change, 'log\uFFFD.md'), 'declared audit\n');
  const invalid = Buffer.concat([Buffer.from(change + '/log'), Buffer.from([0xff]), Buffer.from('.md')]);
  fs.writeFileSync(invalid, 'reviewed bytes\n');
  git('add', '-A'); git('commit', '-qm', 'first');
  const first = git('rev-parse', 'HEAD');
  const before = commitTreeDigest({ root, commit: first, changeId: 'demo' });
  fs.writeFileSync(invalid, 'different bytes\n');
  git('add', '-A'); git('commit', '-qm', 'second');
  const second = git('rev-parse', 'HEAD');
  const after = commitTreeDigest({ root, commit: second, changeId: 'demo' });
  console.log(JSON.stringify({ issue: 27, first, second, before, after }));
  assert.notEqual(before, after);
});

test('28: literal command line and whitespace changes must alter normative hash', () => {
  const cases = [
    ['done-literal', '# Tasks\n```sh\ncat <<\'TEXT\'\n- **Done**: [x]\nTEXT\n```\n', '# Tasks\n```sh\ncat <<\'TEXT\'\n- **Done**: [ ]\nTEXT\n```\n'],
    ['blank-line', '# Tasks\n```sh\nnode - <<\'NODE\'\nconsole.log(`a\n\n\nb`);\nNODE\n```\n', '# Tasks\n```sh\nnode - <<\'NODE\'\nconsole.log(`a\n\nb`);\nNODE\n```\n'],
  ];
  for (const [label, a, b] of cases) {
    const before = normativeTasksHash(a), after = normativeTasksHash(b);
    console.log(JSON.stringify({ issue: 28, label, before, after }));
    assert.notEqual(before, after, label);
  }
});

test('31: archive must carry review, security and runtime originals after disposable stores vanish', () => {
  const state = fixture();
  const retained = retainEvidence('example', { cwd: state.cwd, rawDestination: state.rawDestination, delivery: merged });
  fs.rmSync(state.change, { recursive: true });
  fs.rmSync(path.join(state.cwd, '.specloom', 'runs'), { recursive: true });
  const originals = ['run-review', 'run-security', 'run-runtime'];
  const stored = retained.index.restricted_raw.map(row => row.original_reference);
  const missing = originals.filter(name => !stored.some(ref => ref.includes(name)));
  const validation = validateClosureIndex('example', { cwd: state.cwd });
  console.log(JSON.stringify({ issue: 31, missing, closure_ok: validation.ok, stored }));
  assert.deepEqual(missing, []);
});

test('29: seal and bind must reject a foreign report even with an otherwise valid chain', async () => {
  const state = await gatedFixture();
  const report = path.join(state.change, 'code-review-report.md');
  const parsed = matter(fs.readFileSync(report, 'utf8'));
  const receipts = parsed.data.source_binding.receipts.map(ref => path.join(state.cwd, ref.path));
  delete parsed.data.source_binding;
  parsed.data.change_id = 'foreign';
  fs.writeFileSync(report, matter.stringify(parsed.content, parsed.data));
  writeHandoffManifest('demo', { cwd: state.cwd, stage: 'sdd-code-review', agent: 'Codex' });
  let sealed = null, bound = null;
  try { sealed = sealReport('demo', 'code-review-report.md', { cwd: state.cwd, receipts, delivery: DELIVERY.uncommitted }); }
  catch (error) { sealed = { error: error.message }; }
  if (!sealed.error) {
    state.git('add', '-A'); state.git('commit', '-qm', 'synthetic evidence commit');
    try { bound = bindEvidence('demo', 'code-review-report.md', { cwd: state.cwd }); }
    catch (error) { bound = { error: error.message }; }
  }
  console.log(JSON.stringify({ issue: 29, seal_rejected: !!sealed.error, bind_rejected: !!bound?.error, seal_error: sealed.error, bind_error: bound?.error }));
  assert.ok(sealed.error, 'seal accepted a foreign report');
});

test('29: bind must reject a sealed report whose own change identity is foreign', async () => {
  const state = await gatedFixture();
  const report = path.join(state.change, 'code-review-report.md');
  const parsed = matter(fs.readFileSync(report, 'utf8'));
  parsed.data.change_id = 'foreign';
  fs.writeFileSync(report, matter.stringify(parsed.content, parsed.data));
  state.git('add', '-A'); state.git('commit', '-qm', 'synthetic implementation and evidence');
  let outcome;
  try { outcome = { accepted: !!bindEvidence('demo', 'code-review-report.md', { cwd: state.cwd }) }; }
  catch (error) { outcome = { accepted: false, error: error.message }; }
  console.log(JSON.stringify({ issue: 29, ...outcome }));
  assert.equal(outcome.accepted, false);
});
