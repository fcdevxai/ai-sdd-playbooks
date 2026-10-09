/**
 * Regressions for the seventh code review (Issues 18–25), judged under design Amendments
 * R5 and R6: each test asserts the required behaviour and failed on the previous source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';
import { EXIT } from '../src/cli/dispatch.js';
import { captureRun, captureRunSync } from '../src/tokens/capture.js';
import { normativeTasksHash } from '../src/tokens/evidence.js';
import { writeHandoffManifest, validateHandoffManifest } from '../src/tokens/handoff.js';
import { validateEvidenceBinding } from '../src/tokens/binding.js';
import { bindAll, boundFlow, cli, cloneOf, commitEverything, gatedFixture, REPORT } from './helpers/evidence-fixture.js';

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };
const node = (source) => [process.execPath, '-e', source];
const runsRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-round7-capture-'));

// Issue 18: a partial stdout line never swallows a stderr warning or the totals.
const MIXED = "process.stdout.write('Tests: 3, Assertions: 8'); process.stderr.write('WARNING: deprecated call\\n'); setTimeout(() => process.stdout.write('\\n'), 50);";

test('Issue 18: each stream is parsed on its own (asynchronous capture)', async () => {
  const cwd = runsRoot();
  const result = await captureRun({ argv: node(MIXED), cwd, changeId: 'demo', step: 'apply', harness: 'codex' });
  assert.equal(result.result.tests, 3);
  assert.equal(result.result.assertions, 8);
  assert.equal(result.result.warnings, 1);
  assert.match(result.summary, /1 warning line/);
});

test('Issue 18: each stream is parsed on its own (synchronous gate-check capture)', () => {
  const cwd = runsRoot();
  const result = captureRunSync({ argv: node(MIXED), cwd, changeId: 'demo', step: 'gate-check', harness: 'unknown' });
  assert.equal(result.exitCode, 0);
  assert.equal(result.result.tests, 3);
  assert.equal(result.result.warnings, 1);
  assert.ok(result.rawFiles.stdout && result.rawFiles.stderr, 'both raw streams are retained separately');
});

// Issue 19: a persistence failure after the child ran never replaces the child's own outcome.
test('Issue 19: the child exit code survives a capture persistence failure', async () => {
  const cwd = runsRoot();
  const original = fs.fsyncSync;
  let failed = false;
  fs.fsyncSync = (fd) => { if (!failed) { failed = true; throw new Error('injected fsync failure'); } return original(fd); };
  let result;
  try {
    result = await captureRun({ argv: node('process.exit(7)'), cwd, changeId: 'demo', step: 'apply', harness: 'codex' });
  } finally {
    fs.fsyncSync = original;
  }
  assert.equal(result.exitCode, 7);
  assert.match(String(result.captureError?.message || result.captureError), /injected fsync failure/);
  failed = false;
  fs.fsyncSync = (fd) => { if (!failed) { failed = true; throw new Error('injected fsync failure'); } return original(fd); };
  let sync;
  try {
    sync = captureRunSync({ argv: node('process.exit(7)'), cwd, changeId: 'demo', step: 'gate-check', harness: 'unknown' });
  } finally {
    fs.fsyncSync = original;
  }
  assert.equal(sync.exitCode, 7, 'the synchronous capture keeps the child outcome too');
});

// Issue 21: task content after an Execution Report is normative.
test('Issue 21: sections after an Execution Report stay in the normative plan hash', () => {
  const base = '---\nschema: tasks\n---\n# Tasks\n### Task 1\n- **Done**: [ ]\n- **Success criterion**: one\n';
  const report = '\n## Execution Report — run\n\nbookkeeping text\n';
  assert.equal(normativeTasksHash(base), normativeTasksHash(base + report), 'a report alone is bookkeeping');
  assert.equal(normativeTasksHash(base), normativeTasksHash(base.replace('[ ]', '[x]')), 'checkboxes are bookkeeping');
  const later = `${base}${report}\n## Phase 2\n\n### Task 2\n- **Files**: x.js\n- **Success criterion**: two\n`;
  assert.notEqual(normativeTasksHash(base + report), normativeTasksHash(later), 'a task after a report is normative');
  const editedReport = `${base}\n## Execution Report — run\n\nother bookkeeping\n\n## Phase 2\n\n### Task 2\n- **Files**: x.js\n- **Success criterion**: two\n`;
  assert.equal(normativeTasksHash(later), normativeTasksHash(editedReport), 'only report text changed');
});

// Issue 22: the handoff writer never reads an existing stage file through a symbolic link.
test('Issue 22: an existing immutable stage file must be a contained regular file', async () => {
  const state = await boundFlow();
  const { cwd, change } = state;
  const first = writeHandoffManifest('demo', { cwd, stage: 'sdd-commit', agent: 'Codex' });
  const stage = first.stagePath;
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-round7-outside-')), path.basename(stage));
  fs.copyFileSync(stage, outside);
  fs.unlinkSync(stage);
  fs.symlinkSync(outside, stage);
  // Unchanged content takes the idempotent branch, which confirms the existing stage file.
  assert.ok(change);
  assert.throws(() => writeHandoffManifest('demo', { cwd, stage: 'sdd-commit', agent: 'Codex' }), /not a contained regular file|symbolic link/i);
});

// Issue 24: a report must pin a manifest of its own stage.
test('Issue 24: a code-review report carrying a security-gate source_binding fails in every mode', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  const security = matter(fs.readFileSync(path.join(change, 'security-report.md'), 'utf8'));
  const review = path.join(change, 'code-review-report.md');
  const parsed = matter(fs.readFileSync(review, 'utf8'));
  parsed.data.source_binding = security.data.source_binding;
  fs.writeFileSync(review, matter.stringify(parsed.content, parsed.data));
  commit(git, 'cross-stage source binding');
  for (const portable of [false, true]) {
    const result = validateEvidenceBinding('demo', REPORT, { cwd, portable });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.match(result.issues.join(' '), /stage/i);
  }
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.notEqual(ci.code, EXIT.OK, ci.out);
});

// Issue 25: an absent sibling never hides a changed reference in an available repository.
test('Issue 25: an absent context sibling never hides a changed available reference', async () => {
  const reference = 'openspec/changes/demo/reference.md';
  const state = await gatedFixture({ context: true, prepare: ({ cwd, change }) => {
    fs.writeFileSync(path.join(cwd, reference), '# Reference architecture\n');
    const tasks = path.join(change, 'tasks.md');
    fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replace('  architecture: []', `  architecture: [{repository: hub, path: ${reference}}]`));
  } });
  // No commit since sealing: HEAD is the sealed commit, so only the reference checks can see the change.
  fs.appendFileSync(path.join(state.cwd, reference), 'Changed after review.\n');
  writeHandoffManifest('demo', { cwd: state.cwd, stage: 'sdd-commit', agent: 'Codex' });
  const control = validateEvidenceBinding('demo', REPORT, { cwd: state.cwd, portable: true });
  assert.equal(control.ok, false, 'present sibling: the changed reference fails');
  const tooling = fs.readFileSync(path.join(state.cwd, 'playbook.config.yaml'), 'utf8').match(/tooling: \{path: ([^}]+)\}/)[1];
  fs.renameSync(tooling, `${tooling}-gone`);
  try {
    const result = validateEvidenceBinding('demo', REPORT, { cwd: state.cwd, portable: true });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.match(result.issues.join(' '), /reference|governed|normative/i);
  } finally {
    fs.renameSync(`${tooling}-gone`, tooling);
  }
});

// Issue 20: a delivered context repository proves its reviewed content was committed.
test('Issue 20: a context repository reviewed with uncommitted content is not accepted on its base branch', async () => {
  let tooling;
  const state = await gatedFixture({ context: true, prepare: ({ cwd }) => {
    tooling = fs.readFileSync(path.join(cwd, 'playbook.config.yaml'), 'utf8').match(/tooling: \{path: ([^}]+)\}/)[1];
    fs.writeFileSync(path.join(tooling, 'engine.js'), 'export const engine = 2;\n'); // reviewed, never committed
  } });
  commitEverything(state);
  bindAll(state.cwd);
  commit(state.git, 'bindings');
  const inTooling = (...args) => execFileSync('git', args, { cwd: tooling, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  inTooling('checkout', '--', 'engine.js');
  inTooling('checkout', '-q', '-b', 'main');
  for (const result of [
    validateHandoffManifest('demo', { cwd: state.cwd, allowCommittedDescendants: true, portable: true }),
    validateEvidenceBinding('demo', REPORT, { cwd: state.cwd }),
    validateEvidenceBinding('demo', REPORT, { cwd: state.cwd, portable: true }),
  ]) {
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.match(result.issues.join(' '), /tooling/);
  }

  // Control: the reviewed content genuinely committed and then delivered is accepted.
  inTooling('checkout', '-q', 'tooling');
  fs.writeFileSync(path.join(tooling, 'engine.js'), 'export const engine = 2;\n');
  inTooling('add', '-A'); inTooling('commit', '-qm', 'commit the reviewed tooling content');
  inTooling('branch', '-f', 'main', 'tooling');
  inTooling('checkout', '-q', 'main');
  const delivered = validateEvidenceBinding('demo', REPORT, { cwd: state.cwd, portable: true });
  assert.equal(delivered.ok, true, JSON.stringify(delivered));
});
