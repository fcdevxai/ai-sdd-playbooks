import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { resolveDelivery } from '../src/github/index.js';
import { reduceDelivery, resolveMultiRepoDelivery } from '../src/repos/delivery.js';

// Fake git runner: reports a repo with the given local state + branch.
function fakeGit({ repo = true, dirty = false, branch = 'feature/x' } = {}) {
  return (args) => {
    const cmd = args.join(' ');
    if (cmd.includes('--is-inside-work-tree')) {
      if (!repo) throw new Error('not a git repo');
      return 'true\n';
    }
    if (cmd.includes('status --porcelain')) return dirty ? ' M file.txt\n' : '';
    if (cmd.includes('rev-parse --abbrev-ref HEAD')) return `${branch}\n`;
    throw new Error(`unexpected git: ${cmd}`);
  };
}

const CHECKS = {
  passed: '✓ build\tsuccess\n',
  failed: '✗ build\tfail\n',
  pending: '• build\tpending\n',
  none: '',
};

function fakeGh({ authed = true, pr = null, checks = 'none' } = {}) {
  return (args) => {
    const cmd = args.join(' ');
    if (cmd.startsWith('auth status')) {
      if (!authed) throw new Error('not authenticated');
      return 'Logged in\n';
    }
    if (cmd.startsWith('pr view')) {
      if (!pr) throw new Error('no pull request');
      return JSON.stringify(pr);
    }
    if (cmd.startsWith('pr checks')) return CHECKS[checks];
    throw new Error(`unexpected gh: ${cmd}`);
  };
}

function delivery(gitOpts, ghOpts) {
  return resolveDelivery({ runGit: fakeGit(gitOpts), runGh: fakeGh(ghOpts) });
}

test('dirty working tree → uncommitted (GitHub not consulted)', () => {
  assert.equal(delivery({ dirty: true }, {}).state, 'uncommitted');
});

test('not a git repo → unknown (GIT_UNAVAILABLE)', () => {
  const d = delivery({ repo: false }, {});
  assert.equal(d.state, 'unknown');
  assert.equal(d.blocked_reason, 'GIT_UNAVAILABLE');
});

test('committed + GitHub unavailable → unknown, never assumed (C-10)', () => {
  const d = delivery({ dirty: false }, { authed: false });
  assert.equal(d.state, 'unknown');
  assert.equal(d.blocked_reason, 'GITHUB_CONTEXT_UNAVAILABLE');
});

test('committed + no PR → committed', () => {
  assert.equal(delivery({ dirty: false }, { authed: true, pr: null }).state, 'committed');
});

test('PR merged → merged', () => {
  assert.equal(delivery({ dirty: false }, { pr: { state: 'MERGED', number: 1 } }).state, 'merged');
});

test('PR open maps checks → ci_passed / ci_failed / ci_pending / pr_open', () => {
  assert.equal(delivery({ dirty: false }, { pr: { state: 'OPEN', number: 2 }, checks: 'passed' }).state, 'ci_passed');
  assert.equal(delivery({ dirty: false }, { pr: { state: 'OPEN', number: 2 }, checks: 'failed' }).state, 'ci_failed');
  assert.equal(delivery({ dirty: false }, { pr: { state: 'OPEN', number: 2 }, checks: 'pending' }).state, 'ci_pending');
  assert.equal(delivery({ dirty: false }, { pr: { state: 'OPEN', number: 2 }, checks: 'none' }).state, 'pr_open');
});

// --- Task 1.1: reduceDelivery — "eslabón más débil" precedence table ---

test('reduceDelivery: some unknown → unknown, names the first unknown repo', () => {
  const r = reduceDelivery([
    { repo: 'hub', state: 'merged' },
    { repo: 'backend', state: 'unknown', blocked_reason: 'GIT_UNAVAILABLE' },
  ]);
  assert.equal(r.state, 'unknown');
  assert.equal(r.blocked_reason, 'GIT_UNAVAILABLE @backend');
});

test('reduceDelivery: some ci_failed (no unknown) → ci_failed, names the repo', () => {
  const r = reduceDelivery([
    { repo: 'hub', state: 'merged' },
    { repo: 'backend', state: 'ci_failed' },
  ]);
  assert.equal(r.state, 'ci_failed');
  assert.equal(r.blocked_reason, 'GITHUB_CI_FAILED @backend');
});

test('reduceDelivery: some uncommitted (no unknown/ci_failed) → uncommitted', () => {
  const r = reduceDelivery([
    { repo: 'hub', state: 'merged' },
    { repo: 'backend', state: 'uncommitted' },
  ]);
  assert.equal(r.state, 'uncommitted');
});

test('reduceDelivery: some committed (no worse state) → committed', () => {
  const r = reduceDelivery([
    { repo: 'hub', state: 'merged' },
    { repo: 'backend', state: 'committed' },
  ]);
  assert.equal(r.state, 'committed');
});

test('reduceDelivery: some pr_open/ci_pending (no worse state) → ci_pending', () => {
  const r1 = reduceDelivery([
    { repo: 'hub', state: 'merged' },
    { repo: 'backend', state: 'pr_open' },
  ]);
  assert.equal(r1.state, 'ci_pending');
  const r2 = reduceDelivery([
    { repo: 'hub', state: 'merged' },
    { repo: 'backend', state: 'ci_pending' },
  ]);
  assert.equal(r2.state, 'ci_pending');
});

test('reduceDelivery: all ci_passed, or ci_passed+merged mix (not all merged) → ci_passed', () => {
  const allPassed = reduceDelivery([
    { repo: 'hub', state: 'ci_passed' },
    { repo: 'backend', state: 'ci_passed' },
  ]);
  assert.equal(allPassed.state, 'ci_passed');
  const mix = reduceDelivery([
    { repo: 'hub', state: 'merged' },
    { repo: 'backend', state: 'ci_passed' },
  ]);
  assert.equal(mix.state, 'ci_passed');
});

test('reduceDelivery: all merged → merged (unanimous)', () => {
  const r = reduceDelivery([
    { repo: 'hub', state: 'merged' },
    { repo: 'backend', state: 'merged' },
    { repo: 'frontend', state: 'merged' },
  ]);
  assert.equal(r.state, 'merged');
  assert.equal(r.blocked_reason, undefined);
});

// --- Task 1.2/1.3: resolveMultiRepoDelivery ---

function makeChange({ impactedReposSection = 'No aplica.' } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-delivery-'));
  const changeDir = path.join(cwd, 'openspec', 'changes', 'demo');
  fs.mkdirSync(changeDir, { recursive: true });
  fs.writeFileSync(
    path.join(changeDir, 'proposal.md'),
    `---\nschema: proposal\n---\n\n# Demo\n\n## Impacted repos\n\n${impactedReposSection}\n`,
  );
  return cwd;
}

function writeConfig(cwd, config) {
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), yaml.dump(config));
}

function fakeResolveOne(statesByCwd) {
  const calls = [];
  const fn = ({ cwd }) => {
    calls.push(cwd);
    const entry = statesByCwd[cwd];
    if (!entry) throw new Error(`no fake state for cwd ${cwd}`);
    return entry;
  };
  fn.calls = calls;
  return fn;
}

test('resolveMultiRepoDelivery: single-repo early-return (AC-5, back-compat)', () => {
  const cwd = makeChange({ impactedReposSection: 'No aplica.' });
  const resolveOne = fakeResolveOne({ [cwd]: { state: 'ci_passed' } });
  const result = resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });
  assert.equal(result.state, 'ci_passed');
  assert.equal(result.per_repo.length, 1);
  assert.equal(result.per_repo[0].path, cwd);
  assert.equal(result.per_repo[0].state, 'ci_passed');
});

test('resolveMultiRepoDelivery: AC-1/AC-3/AC-4/AC-6 — 3 repos, only hub merged → not merged', () => {
  const cwd = makeChange({ impactedReposSection: '- backend\n- frontend' });
  const backendPath = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-backend-'));
  const frontendPath = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-frontend-'));
  writeConfig(cwd, { repos: { backend: { path: backendPath }, frontend: { path: frontendPath } } });

  const resolveOne = fakeResolveOne({
    [cwd]: { state: 'merged' },
    [backendPath]: { state: 'ci_pending' },
    [frontendPath]: { state: 'ci_pending' },
  });
  const result = resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });
  assert.notEqual(result.state, 'merged');
  assert.equal(result.state, 'ci_pending');
  assert.equal(result.per_repo.length, 3);
  assert.equal(result.per_repo[0].repo, 'loom');
  assert.deepEqual(result.per_repo.map((r) => r.repo).slice(1), ['backend', 'frontend']);
});

test('resolveMultiRepoDelivery: AC-2 — all 3 merged → merged', () => {
  const cwd = makeChange({ impactedReposSection: '- backend\n- frontend' });
  const backendPath = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-backend-'));
  const frontendPath = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-frontend-'));
  writeConfig(cwd, { repos: { backend: { path: backendPath }, frontend: { path: frontendPath } } });

  const resolveOne = fakeResolveOne({
    [cwd]: { state: 'merged' },
    [backendPath]: { state: 'merged' },
    [frontendPath]: { state: 'merged' },
  });
  const result = resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });
  assert.equal(result.state, 'merged');
});

test('resolveMultiRepoDelivery: AC-3 — ci_failed repo names the repo in per_repo', () => {
  const cwd = makeChange({ impactedReposSection: '- backend' });
  const backendPath = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-backend-'));
  writeConfig(cwd, { repos: { backend: { path: backendPath } } });

  const resolveOne = fakeResolveOne({
    [cwd]: { state: 'merged' },
    [backendPath]: { state: 'ci_failed' },
  });
  const result = resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });
  assert.equal(result.state, 'ci_failed');
  assert.equal(result.blocked_reason, 'GITHUB_CI_FAILED @backend');
  const backendEntry = result.per_repo.find((r) => r.repo === 'backend');
  assert.equal(backendEntry.state, 'ci_failed');
});

test('resolveMultiRepoDelivery: AC-4/SEC-1 — GitHub unavailable repo mixed with merged → unknown, never merged', () => {
  const cwd = makeChange({ impactedReposSection: '- backend' });
  const backendPath = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-backend-'));
  writeConfig(cwd, { repos: { backend: { path: backendPath } } });

  const resolveOne = fakeResolveOne({
    [cwd]: { state: 'merged' },
    [backendPath]: { state: 'unknown', blocked_reason: 'GITHUB_CONTEXT_UNAVAILABLE' },
  });
  const result = resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });
  assert.equal(result.state, 'unknown');
  assert.notEqual(result.state, 'merged');
  assert.equal(result.blocked_reason, 'GITHUB_CONTEXT_UNAVAILABLE @backend');
});

test('resolveMultiRepoDelivery: EC-2 — hub not a git repo → unknown', () => {
  const cwd = makeChange({ impactedReposSection: 'No aplica.' });
  const resolveOne = fakeResolveOne({ [cwd]: { state: 'unknown', blocked_reason: 'GIT_UNAVAILABLE' } });
  const result = resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });
  assert.equal(result.state, 'unknown');
});

// --- Task 1.3: EC-1/SEC-2 — fail-closed on unresolvable repo path ---

test('resolveMultiRepoDelivery: EC-1/SEC-2 — impacted repo not declared in config.repos → unknown, resolveOne never called for it', () => {
  const cwd = makeChange({ impactedReposSection: '- backend\n- ghost' });
  const backendPath = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-backend-'));
  writeConfig(cwd, { repos: { backend: { path: backendPath } } }); // "ghost" is not declared

  const resolveOne = fakeResolveOne({
    [cwd]: { state: 'merged' },
    [backendPath]: { state: 'merged' },
  });
  const result = resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });

  const ghostEntry = result.per_repo.find((r) => r.repo === 'ghost');
  assert.equal(ghostEntry.state, 'unknown');
  assert.equal(ghostEntry.path, null);
  assert.equal(ghostEntry.blocked_reason, 'REPO_PATH_UNRESOLVED @ghost');
  assert.equal(result.state, 'unknown'); // contaminates the aggregate (fail-closed)

  // resolveOne must never be called with a path for the undeclared repo — only
  // cwd (hub) and backendPath were passed, never anything else.
  assert.equal(resolveOne.calls.length, 2);
  assert.deepEqual(new Set(resolveOne.calls), new Set([cwd, backendPath]));
});
