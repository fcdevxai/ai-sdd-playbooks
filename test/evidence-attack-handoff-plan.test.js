/**
 * Independent adversarial probes: plan normalization, packet writer, sealing.
 * Each test asserts the SAFE behaviour; a failing test is a confirmed finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { normativeTasksHash, sha256 } from '../src/tokens/evidence.js';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { writePacket } from '../src/tokens/packet.js';
import { sealReport } from '../src/tokens/seal.js';
import { captureRun } from '../src/tokens/capture.js';
import { bindEvidence } from '../src/tokens/binding.js';
import { DELIVERY, evidence, gatedFixture, refreshHandoff } from './helpers/evidence-fixture.js';

const FRONT = '---\nschema: tasks\n---\n';
const pair = (template) => [template.replace('CMD', 'npm test'), template.replace('CMD', 'true # skip every test')];

test('B1 normative hash: a fenced example "## Execution Report" line does not hide later task commands', () => {
  const [a, b] = pair(`${FRONT}# Tasks\n## Phase 1\nReport format example:\n\n\`\`\`markdown\n## Execution Report\n\`\`\`\n\n- **Regression**: CMD\n## Phase 2\n- task\n`);
  assert.notEqual(normativeTasksHash(a), normativeTasksHash(b));
});

test('B2 normative hash: a tab-separated level-two heading ends an Execution Report', () => {
  const [a, b] = pair(`${FRONT}# Tasks\n## Execution Report\nlog\n##\tPhase 2\n- **Regression**: CMD\n`);
  assert.notEqual(normativeTasksHash(a), normativeTasksHash(b));
});

test('B3 normative hash: an indented level-two heading ends an Execution Report', () => {
  const [a, b] = pair(`${FRONT}# Tasks\n## Execution Report\nlog\n ## Phase 2\n- **Regression**: CMD\n`);
  assert.notEqual(normativeTasksHash(a), normativeTasksHash(b));
});

test('B4 normative hash: a level-one heading after an Execution Report is normative', () => {
  const [a, b] = pair(`${FRONT}# Tasks\n## Execution Report\nlog\n# Phase 2 (added after the report)\n- **Regression**: CMD\n`);
  assert.notEqual(normativeTasksHash(a), normativeTasksHash(b));
});

test('B5 normative hash: a YAML comment "## Execution Report" in front matter does not hide the plan preamble', () => {
  const [a, b] = pair(`---\nschema: tasks\n## Execution Report\nstatus: approved\n---\n# Tasks\n- **Regression**: CMD\n## Phase 1\n- task\n`);
  assert.notEqual(normativeTasksHash(a), normativeTasksHash(b));
});

test('B1 end-to-end: changing a hidden task command after sealing makes the gates ineligible', async () => {
  const body = (cmd) => `# Tasks\n## Phase 1\nReport format example:\n\n\`\`\`markdown\n## Execution Report\n\`\`\`\n\n- **Files**: code.js\n- **Regression**: ${cmd}\n## Phase 2\n- task\n`;
  const setBody = (change, cmd) => {
    const file = path.join(change, 'tasks.md');
    const raw = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, raw.slice(0, raw.indexOf('# Tasks')) + body(cmd));
  };
  const { cwd, change } = await gatedFixture({
    prepare: ({ change: dir }) => setBody(dir, 'npm test'),
    tamper: ({ change: dir, cwd: root }) => { setBody(dir, 'true # skip every test'); refreshHandoff(root); },
  });
  assert.notDeepEqual(evidence(cwd, change, DELIVERY.uncommitted).issues, [], 'gates stayed eligible after a normative command change');
});

test('control: a visible task command change after sealing makes the gates ineligible', async () => {
  const setBody = (change, cmd) => {
    const file = path.join(change, 'tasks.md');
    const raw = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, raw.slice(0, raw.indexOf('# Tasks')) + `# Tasks\n## Phase 1\n- **Regression**: ${cmd}\n`);
  };
  const { cwd, change } = await gatedFixture({
    prepare: ({ change: dir }) => setBody(dir, 'npm test'),
    tamper: ({ change: dir, cwd: root }) => { setBody(dir, 'true # skip every test'); refreshHandoff(root); },
  });
  assert.notDeepEqual(evidence(cwd, change, DELIVERY.uncommitted).issues, []);
});

test('C1 packet writer: a symlinked context-packet.md never overwrites a sealed gate report', async () => {
  const { cwd, change } = await gatedFixture();
  const report = path.join(change, 'code-review-report.md');
  const before = fs.readFileSync(report, 'utf8');
  fs.symlinkSync('code-review-report.md', path.join(change, 'context-packet.md'));
  try { writePacket('demo', path.join(cwd, 'openspec/changes')); } catch { /* refusing is safe */ }
  assert.equal(fs.readFileSync(report, 'utf8'), before, 'sealed report bytes were replaced through the packet symlink');
});

test('C2 packet writer: a symlinked context-packet.md never writes outside the project', async () => {
  const { cwd, change } = await gatedFixture();
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-handoff-outside-')), 'victim.txt');
  fs.writeFileSync(outside, 'precious\n');
  fs.symlinkSync(outside, path.join(change, 'context-packet.md'));
  try { writePacket('demo', path.join(cwd, 'openspec/changes')); } catch { /* refusing is safe */ }
  assert.equal(fs.readFileSync(outside, 'utf8'), 'precious\n', 'a file outside the project was overwritten');
});

test('D1 seal: a verification report cannot be sealed on the base branch against a pre-merge manifest and receipt', async () => {
  const merged = { state: 'merged', per_repo: [{ repo: 'hub', state: 'merged' }] };
  const { cwd, change, git } = await gatedFixture();
  // Pre-merge: verify-stage manifest and a "verification" run on the feature branch's dirty tree.
  writeHandoffManifest('demo', { cwd, stage: 'sdd-verify', agent: 'Codex' });
  const run = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'verify', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  git('add', '-A'); git('commit', '-qm', 'implementation');
  git('checkout', '-q', '-b', 'main');
  fs.writeFileSync(path.join(change, 'verification-report.md'), `---\n${yaml.dump({ schema: 'verification-report', schema_version: 2, change_id: 'demo', status: 'passed' })}---\n# Verification\n`);
  let sealed = null;
  try {
    sealed = sealReport('demo', 'verification-report.md', { cwd, receipts: [run.receiptPath], delivery: merged });
  } catch (error) {
    sealed = { refused: error.message };
  }
  const head = git('rev-parse', 'HEAD');
  assert.ok(sealed.refused || sealed.source_binding.repositories.every((repo) => repo.commit_sha === head),
    `verification sealed on ${head} against pre-merge commit ${sealed.source_binding?.repositories?.[0]?.commit_sha}`);
});

test('D1 end-to-end: a pre-merge verification run sealed on the base branch is not eligible post-merge verification', async () => {
  const merged = { state: 'merged', per_repo: [{ repo: 'hub', state: 'merged' }] };
  const { cwd, change, git } = await gatedFixture();
  writeHandoffManifest('demo', { cwd, stage: 'sdd-verify', agent: 'Codex' });
  const run = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'verify', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  git('add', '-A'); git('commit', '-qm', 'implementation');
  git('checkout', '-q', '-b', 'main');
  fs.writeFileSync(path.join(change, 'verification-report.md'), `---\n${yaml.dump({ schema: 'verification-report', schema_version: 2, change_id: 'demo', status: 'passed' })}---\n# Verification\n`);
  try { sealReport('demo', 'verification-report.md', { cwd, receipts: [run.receiptPath], delivery: merged }); } catch { return; }
  const result = evidence(cwd, change, merged);
  assert.equal(result.gates['verification-report.md']?.ok, false,
    `pre-merge verification accepted on main: ${JSON.stringify(result.gates['verification-report.md'])}; head ${git('rev-parse', 'HEAD')}`);
});

test('D1 with binding: a pre-merge verification run sealed and bound on the base branch is not eligible post-merge verification', async () => {
  const merged = { state: 'merged', per_repo: [{ repo: 'hub', state: 'merged' }] };
  const { cwd, change, git } = await gatedFixture();
  writeHandoffManifest('demo', { cwd, stage: 'sdd-verify', agent: 'Codex' });
  const run = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'verify', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  git('add', '-A'); git('commit', '-qm', 'implementation');
  git('checkout', '-q', '-b', 'main');
  fs.writeFileSync(path.join(change, 'verification-report.md'), `---\n${yaml.dump({ schema: 'verification-report', schema_version: 2, change_id: 'demo', status: 'passed' })}---\n# Verification\n`);
  try { sealReport('demo', 'verification-report.md', { cwd, receipts: [run.receiptPath], delivery: merged }); } catch { return; }
  let bound;
  try { bound = bindEvidence('demo', 'verification-report.md', { cwd }); } catch (error) { bound = { refused: error.message }; }
  const result = evidence(cwd, change, merged);
  assert.equal(result.gates['verification-report.md']?.ok, false,
    `pre-merge verification accepted on main (bind: ${JSON.stringify(bound).slice(0, 200)})`);
});

test('B6 normative hash: a normative section merely titled "Execution Report requirements" stays normative', () => {
  const [a, b] = pair(`${FRONT}# Tasks\n## Execution Report requirements\n- **Regression**: CMD must be pasted verbatim\n## Phase 1\n- task\n`);
  assert.notEqual(normativeTasksHash(a), normativeTasksHash(b));
});
