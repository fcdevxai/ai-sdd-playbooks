/**
 * Post-merge delivery identity with real Git (change merged-delivery-identity).
 *
 * After a pull request is merged, `sdd-verify` and `sdd-archive` write evidence on the base
 * branch. Delivery must be `merged` there when the pull request's merge commit is HEAD or an
 * ancestor of HEAD, whatever the merge strategy, and `unknown` whenever that cannot be proven.
 * GitHub is a test double that returns the real merge-commit object name; Git is real.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { resolveDelivery } from '../src/github/index.js';
import { resolveMultiRepoDelivery } from '../src/repos/delivery.js';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { captureRun } from '../src/tokens/capture.js';
import { sealReport } from '../src/tokens/seal.js';
import { loadChange } from '../src/config/artifacts.js';
import { loadConfig } from '../src/config/config.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import { computeState } from '../src/lifecycle/engine.js';
import { boundFlow } from './helpers/evidence-fixture.js';

const created = [];
after(() => { for (const dir of created) fs.rmSync(dir, { recursive: true, force: true }); });

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
}

function gitIn(cwd) {
  return (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}

/** GitHub double: the change branch has a merged pull request with these identities. */
function mergedPullRequest({ headRefOid, mergeCommitOid }) {
  return (args) => {
    const cmd = args.join(' ');
    if (cmd.startsWith('auth status')) return 'Logged in\n';
    if (cmd.startsWith('pr view')) {
      assert.match(cmd, /mergeCommit/, 'the pull-request lookup must request the merge commit');
      return JSON.stringify({ state: 'MERGED', number: 7, headRefOid, mergeCommit: mergeCommitOid ? { oid: mergeCommitOid } : null });
    }
    throw new Error(`unexpected gh: ${cmd}`);
  };
}

/**
 * A repository with a change branch `demo` (two commits) and a base branch `main`. `merge`
 * applies one strategy and returns the merge-commit object name GitHub would report.
 */
function repository() {
  const cwd = tempDir('playbook-merged-delivery-');
  const git = gitIn(cwd);
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture');
  fs.writeFileSync(path.join(cwd, 'base.txt'), 'base\n');
  git('add', '-A'); git('commit', '-qm', 'base');
  git('checkout', '-q', '-b', 'demo');
  fs.mkdirSync(path.join(cwd, 'src'));
  fs.writeFileSync(path.join(cwd, 'src/feature.js'), 'export const feature = 1;\n');
  git('add', '-A'); git('commit', '-qm', 'feature');
  fs.writeFileSync(path.join(cwd, 'src/feature.js'), 'export const feature = 2;\n');
  git('add', '-A'); git('commit', '-qm', 'feature follow-up');
  const head = git('rev-parse', 'HEAD');
  git('checkout', '-q', 'main');
  return { cwd, git, head };
}

const STRATEGIES = {
  'merge commit': (git) => { git('merge', '-q', '--no-ff', '-m', 'Merge pull request #7', 'demo'); return git('rev-parse', 'HEAD'); },
  squash: (git) => { git('merge', '-q', '--squash', 'demo'); git('commit', '-qm', 'Feature (#7)'); return git('rev-parse', 'HEAD'); },
  // GitHub's rebase merge replays the commits on top of the base: new object names, last one reported.
  rebase: (git, cwd) => {
    fs.writeFileSync(path.join(cwd, 'other.txt'), 'unrelated base work\n');
    git('add', '-A'); git('commit', '-qm', 'unrelated base work');
    git('cherry-pick', 'main~1..demo');
    return git('rev-parse', 'HEAD');
  },
};

/** Evidence-only uncommitted state, as the mandatory stage packet and the report leave it. */
function writeEvidence(cwd, slug = 'demo') {
  const dir = path.join(cwd, 'openspec/changes', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'verification-report.md'), '# Verification\n');
}

const deliveryOf = (cwd, gh) => resolveDelivery({ cwd, slug: 'demo', allowEvidenceDirty: true, runGh: gh });

for (const [name, strategy] of Object.entries(STRATEGIES)) {
  test(`AC-1: after a ${name} merge, evidence-only changes on the base branch are delivered`, () => {
    const { cwd, git, head } = repository();
    const mergeCommitOid = strategy(git, cwd);
    assert.notEqual(git('rev-parse', 'HEAD'), head, 'the base branch does not sit on the pull-request head');
    writeEvidence(cwd);
    assert.deepEqual(deliveryOf(cwd, mergedPullRequest({ headRefOid: head, mergeCommitOid })), { provider: 'github', state: 'merged' });
  });
}

test('AC-1: the base branch advanced after the merge is still delivered', () => {
  const { cwd, git, head } = repository();
  const mergeCommitOid = STRATEGIES['merge commit'](git, cwd);
  fs.writeFileSync(path.join(cwd, 'later.txt'), 'later work\n');
  git('add', '-A'); git('commit', '-qm', 'later work on main');
  writeEvidence(cwd);
  assert.equal(deliveryOf(cwd, mergedPullRequest({ headRefOid: head, mergeCommitOid })).state, 'merged');
});

test('AC-2: the change branch checked out at the pull-request head stays delivered without a merge commit', () => {
  const { cwd, git, head } = repository();
  git('checkout', '-q', 'demo');
  writeEvidence(cwd);
  assert.equal(deliveryOf(cwd, mergedPullRequest({ headRefOid: head, mergeCommitOid: null })).state, 'merged');
});

test('EC-1: a checkout that does not contain the merge commit is not delivered', () => {
  const { cwd, git, head } = repository();
  const base = git('rev-parse', 'HEAD');
  const mergeCommitOid = STRATEGIES['merge commit'](git, cwd);
  git('checkout', '-q', '-b', 'older', base);
  writeEvidence(cwd);
  assert.deepEqual(deliveryOf(cwd, mergedPullRequest({ headRefOid: head, mergeCommitOid })),
    { provider: 'github', state: 'unknown', blocked_reason: 'MERGED_HEAD_IDENTITY_UNPROVEN' });
});

test('EC-2: a base branch that was not pulled after the merge reports the missing merge commit', () => {
  const { cwd: origin, git: originGit, head } = repository();
  const stale = tempDir('playbook-merged-delivery-stale-');
  fs.rmSync(stale, { recursive: true });
  execFileSync('git', ['clone', '-q', `file://${origin}`, stale], { stdio: ['ignore', 'pipe', 'pipe'] });
  const mergeCommitOid = STRATEGIES['merge commit'](originGit, origin);
  writeEvidence(stale);
  assert.deepEqual(deliveryOf(stale, mergedPullRequest({ headRefOid: head, mergeCommitOid })),
    { provider: 'github', state: 'unknown', blocked_reason: 'MERGE_COMMIT_NOT_IN_HISTORY' });
});

test('EC-3: a shallow history that cannot decide reports unavailable history', () => {
  const { cwd: origin, git: originGit, head } = repository();
  const mergeCommitOid = STRATEGIES['merge commit'](originGit, origin);
  fs.writeFileSync(path.join(origin, 'later.txt'), 'later work\n');
  originGit('add', '-A'); originGit('commit', '-qm', 'later work on main');
  const shallow = tempDir('playbook-merged-delivery-shallow-');
  fs.rmSync(shallow, { recursive: true });
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${origin}`, shallow], { stdio: ['ignore', 'pipe', 'pipe'] });
  writeEvidence(shallow);
  assert.deepEqual(deliveryOf(shallow, mergedPullRequest({ headRefOid: head, mergeCommitOid })),
    { provider: 'github', state: 'unknown', blocked_reason: 'MERGED_HISTORY_UNAVAILABLE' });
});

test('EC-4: a merged pull request without a merge commit is not delivered off the pull-request head', () => {
  const { cwd, git, head } = repository();
  STRATEGIES['merge commit'](git, cwd);
  writeEvidence(cwd);
  assert.deepEqual(deliveryOf(cwd, mergedPullRequest({ headRefOid: head, mergeCommitOid: null })),
    { provider: 'github', state: 'unknown', blocked_reason: 'MERGED_HEAD_IDENTITY_UNPROVEN' });
});

test('EC-5: a change outside the evidence paths keeps delivery uncommitted', () => {
  const { cwd, git, head } = repository();
  const mergeCommitOid = STRATEGIES['merge commit'](git, cwd);
  fs.writeFileSync(path.join(cwd, 'src/feature.js'), 'export const feature = 3;\n');
  assert.equal(deliveryOf(cwd, mergedPullRequest({ headRefOid: head, mergeCommitOid })).state, 'uncommitted');
});

/**
 * AC-3 / AC-5: the LIA case end to end. Gates sealed and bound on the change branch, merged
 * with a merge commit, `sdd-verify` packet generated on the base branch: the same evaluator
 * `validate --precondition sdd-verify` and `next` use accepts it, the verification report
 * seals, and the change becomes verified and routes to archive.
 */
test('AC-5: sdd-verify on the base branch after a merge commit passes its precondition and seals', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  created.push(cwd);
  const head = git('rev-parse', 'HEAD');
  git('branch', 'main', git('rev-list', '--max-parents=0', 'HEAD'));
  git('checkout', '-q', 'main');
  git('merge', '-q', '--no-ff', '-m', 'Merge pull request #7', 'demo');
  const mergeCommitOid = git('rev-parse', 'HEAD');
  assert.notEqual(mergeCommitOid, head);

  writeHandoffManifest('demo', { cwd, stage: 'sdd-verify', agent: 'Codex' });
  const gh = mergedPullRequest({ headRefOid: head, mergeCommitOid });
  const resolveOne = (options) => resolveDelivery({ ...options, runGh: gh });
  const delivery = () => resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });
  const { config } = loadConfig({ cwd });
  const evaluate = (current) => {
    const artifacts = loadChange(change).artifacts;
    const evidence = inspectEvidence('demo', { cwd, config, artifacts, delivery: current });
    return { evidence, computed: computeState(config, null, artifacts, current, evidence) };
  };

  const before = delivery();
  assert.equal(before.state, 'merged', JSON.stringify(before));
  const precondition = evaluate(before);
  assert.deepEqual(precondition.evidence.issues, []);
  assert.equal(precondition.computed.lifecycle.state, 'runtime_cleared');
  assert.equal(precondition.computed.next.skill, 'sdd-verify');

  const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("ok")'], cwd,
    changeId: 'demo', step: 'verify', harness: 'codex', repoName: 'hub', agent: 'Codex' });
  const report = { schema: 'verification-report', schema_version: 2, change_id: 'demo', status: 'passed' };
  fs.writeFileSync(path.join(change, 'verification-report.md'),
    `---\n${yaml.dump(report)}---\n# Report\n## Acceptance criteria\nAC-1 passed\n## Security considerations\nSEC-1 passed\n## Regression\nNo regression\n`);
  assert.equal(delivery().state, 'merged', 'the written report is evidence-only');
  sealReport('demo', 'verification-report.md', { cwd, receipts: [captured.receiptPath], delivery: delivery() });

  const sealed = evaluate(delivery());
  assert.deepEqual(sealed.evidence.issues, []);
  assert.equal(sealed.evidence.gates['verification-report.md'].ok, true, JSON.stringify(sealed.evidence.gates['verification-report.md']));
  assert.equal(sealed.computed.lifecycle.state, 'verified');
  assert.equal(sealed.computed.next.skill, 'sdd-archive');
});
