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

// `prByBranch` is additive: when absent, the single-`pr` path below behaves exactly
// as before, so the pre-existing tests keep asserting the same thing (AC-2, AC-5).
function fakeGh({ authed = true, pr = null, checks = 'none', prByBranch = null, checksByBranch = null } = {}) {
  return (args) => {
    const cmd = args.join(' ');
    if (cmd.startsWith('auth status')) {
      if (!authed) throw new Error('not authenticated');
      return 'Logged in\n';
    }
    if (cmd.startsWith('pr view')) {
      const branch = args[2];
      if (prByBranch) {
        const found = prByBranch[branch];
        if (!found) throw new Error('no pull request');
        return JSON.stringify(found);
      }
      if (!pr) throw new Error('no pull request');
      return JSON.stringify(pr);
    }
    if (cmd.startsWith('pr checks')) {
      const branch = args[2];
      if (checksByBranch) return CHECKS[checksByBranch[branch] || 'none'];
      return CHECKS[checks];
    }
    throw new Error(`unexpected gh: ${cmd}`);
  };
}

function delivery(gitOpts, ghOpts) {
  return resolveDelivery({ runGit: fakeGit(gitOpts), runGh: fakeGh(ghOpts) });
}

test('dirty working tree → uncommitted (GitHub not consulted)', () => {
  assert.equal(delivery({ dirty: true }, {}).state, 'uncommitted');
});

test('post-merge evidence-only dirt is accepted only with matching merged PR head identity', () => {
  const sha = 'a'.repeat(40);
  const makeGit = (file, head = sha) => (args) => {
    const cmd = args.join(' ');
    if (cmd.includes('--is-inside-work-tree')) return 'true';
    if (cmd.startsWith('status --porcelain')) return `?? ${file}\n`;
    if (cmd === 'rev-parse HEAD') return head;
    if (cmd.includes('rev-parse --abbrev-ref')) return 'demo';
    throw new Error(`unexpected Git command: ${cmd}`);
  };
  const gh = fakeGh({ pr: { state: 'MERGED', number: 4, headRefOid: sha } });
  const options = { slug: 'demo', allowEvidenceDirty: true, runGh: gh };
  assert.equal(resolveDelivery({ ...options,
    runGit: makeGit('openspec/changes/demo/verification-report.md') }).state, 'merged');
  assert.equal(resolveDelivery({ ...options,
    runGit: makeGit('openspec/archive/demo/closure-index.json') }).state, 'merged');
  assert.equal(resolveDelivery({ ...options,
    runGit: makeGit('openspec/changes/demo/verification-report.md', 'b'.repeat(40)) }).state, 'unknown');
  assert.equal(resolveDelivery({ ...options,
    runGit: makeGit('openspec/specs/system.md') }).state, 'uncommitted');
});

// Merge-commit identity (change merged-delivery-identity): the merged result is delivered to a
// checkout whose HEAD is the pull request's merge commit or one of its descendants.
function ancestryGit({ head, ancestors = [], present = [], shallow = false, calls = [] }) {
  return (args) => {
    calls.push(args);
    const cmd = args.join(' ');
    if (cmd.includes('--is-inside-work-tree')) return 'true\n';
    if (cmd.startsWith('status --porcelain')) return '?? openspec/changes/demo/verification-report.md\n';
    if (cmd === 'rev-parse HEAD') return `${head}\n`;
    if (cmd === 'rev-parse --is-shallow-repository') return `${shallow}\n`;
    if (args[0] === 'cat-file' && args[1] === '-t') {
      if (args[2] === head || present.includes(args[2])) return 'commit\n';
      throw Object.assign(new Error('missing object'), { status: 128 });
    }
    if (args[0] === 'merge-base' && args[1] === '--is-ancestor') {
      if (args[2] === args[3] || ancestors.includes(args[2])) return '';
      throw Object.assign(new Error('not an ancestor'), { status: 1 });
    }
    throw new Error(`unexpected Git command: ${cmd}`);
  };
}

function mergedDelivery(gitOptions, { headRefOid = 'a'.repeat(40), mergeCommit } = {}) {
  const gh = fakeGh({ pr: { state: 'MERGED', number: 4, headRefOid, mergeCommit } });
  return resolveDelivery({ slug: 'demo', allowEvidenceDirty: true, runGh: gh, runGit: ancestryGit(gitOptions) });
}

test('AC-1: evidence-only dirt is delivered when the merge commit is HEAD or an ancestor of HEAD', () => {
  const merge = 'c'.repeat(40);
  assert.equal(mergedDelivery({ head: merge }, { mergeCommit: { oid: merge } }).state, 'merged');
  assert.equal(mergedDelivery({ head: 'd'.repeat(40), present: [merge], ancestors: [merge] }, { mergeCommit: { oid: merge } }).state, 'merged');
});

test('AC-2: HEAD equal to the pull-request head stays delivered, with or without a merge commit', () => {
  const head = 'a'.repeat(40);
  assert.equal(mergedDelivery({ head }, { headRefOid: head, mergeCommit: null }).state, 'merged');
  assert.equal(mergedDelivery({ head }, { headRefOid: head, mergeCommit: { oid: 'c'.repeat(40) } }).state, 'merged');
});

test('EC-1: a merge commit that is not an ancestor of HEAD leaves the identity unproven', () => {
  const merge = 'c'.repeat(40);
  assert.deepEqual(mergedDelivery({ head: 'd'.repeat(40), present: [merge] }, { mergeCommit: { oid: merge } }),
    { provider: 'github', state: 'unknown', blocked_reason: 'MERGED_HEAD_IDENTITY_UNPROVEN' });
});

test('EC-2: a merge commit absent from a complete history is reported as not in history', () => {
  assert.deepEqual(mergedDelivery({ head: 'd'.repeat(40) }, { mergeCommit: { oid: 'c'.repeat(40) } }),
    { provider: 'github', state: 'unknown', blocked_reason: 'MERGE_COMMIT_NOT_IN_HISTORY' });
});

test('EC-3: a shallow history that cannot decide is reported as unavailable history', () => {
  assert.deepEqual(mergedDelivery({ head: 'd'.repeat(40), shallow: true }, { mergeCommit: { oid: 'c'.repeat(40) } }),
    { provider: 'github', state: 'unknown', blocked_reason: 'MERGED_HISTORY_UNAVAILABLE' });
});

test('EC-4: a merged pull request without a merge commit is unproven off the pull-request head', () => {
  for (const mergeCommit of [null, undefined, {}, { oid: null }]) {
    assert.deepEqual(mergedDelivery({ head: 'd'.repeat(40) }, { mergeCommit }),
      { provider: 'github', state: 'unknown', blocked_reason: 'MERGED_HEAD_IDENTITY_UNPROVEN' });
  }
});

test('SEC-2: a malformed merge-commit identifier never reaches Git and is unproven', () => {
  for (const oid of ['--output=/tmp/x', 'HEAD', 'HEAD~1', 'main', 'c'.repeat(39), 'C'.repeat(40), `${'c'.repeat(40)}\n`, 'g'.repeat(40)]) {
    const calls = [];
    const gh = fakeGh({ pr: { state: 'MERGED', number: 4, headRefOid: 'a'.repeat(40), mergeCommit: { oid } } });
    const result = resolveDelivery({ slug: 'demo', allowEvidenceDirty: true, runGh: gh,
      runGit: ancestryGit({ head: 'd'.repeat(40), present: [oid], ancestors: [oid], calls }) });
    assert.deepEqual(result, { provider: 'github', state: 'unknown', blocked_reason: 'MERGED_HEAD_IDENTITY_UNPROVEN' }, oid);
    const identityCalls = calls.filter((args) => args[0] === 'merge-base' || args[0] === 'cat-file');
    assert.ok(!identityCalls.some((args) => args.includes(oid)), `malformed identifier reached Git: ${JSON.stringify(oid)}`);
  }
});

test('SEC-2: a 64-hexadecimal (SHA-256) merge-commit identifier is accepted', () => {
  const merge = 'e'.repeat(64);
  assert.equal(mergedDelivery({ head: merge }, { mergeCommit: { oid: merge } }).state, 'merged');
});

test('SEC-4: a clean tree after merge keeps the 0.10.0 result without any identity call', () => {
  const calls = [];
  const runGit = (args) => {
    calls.push(args.join(' '));
    if (args.join(' ').includes('--is-inside-work-tree')) return 'true\n';
    if (args[0] === 'status') return '';
    throw new Error(`unexpected Git command: ${args.join(' ')}`);
  };
  const gh = fakeGh({ pr: { state: 'MERGED', number: 4, headRefOid: 'a'.repeat(40), mergeCommit: { oid: 'c'.repeat(40) } } });
  assert.equal(resolveDelivery({ slug: 'demo', allowEvidenceDirty: true, runGh: gh, runGit }).state, 'merged');
  assert.ok(!calls.some((cmd) => cmd.startsWith('merge-base') || cmd.startsWith('cat-file')), calls.join('; '));
});

test('the pull-request lookup requests the merge commit and returns its identifier', async () => {
  const { prForBranch } = await import('../src/github/pull-request.js');
  let requested = null;
  const gh = (args) => { requested = args; return JSON.stringify({ state: 'MERGED', number: 9, headRefOid: 'a'.repeat(40), mergeCommit: { oid: 'c'.repeat(40) } }); };
  assert.deepEqual(prForBranch('demo', gh), { state: 'MERGED', number: 9, headRefOid: 'a'.repeat(40), mergeCommitOid: 'c'.repeat(40) });
  assert.ok(requested.at(-1).split(',').includes('mergeCommit'), requested.join(' '));
  const open = () => JSON.stringify({ state: 'OPEN', number: 10, headRefOid: 'a'.repeat(40), mergeCommit: null });
  assert.equal(prForBranch('demo', open).mergeCommitOid, null);
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

// --- A change's delivery resolves by its own branch, not the current one ---

test('an invalid slug fails closed to unknown without invoking gh (AC-6, EC-1)', () => {
  // Negative half first: the guard must run before any runner is touched, so a
  // malformed slug never becomes a `gh` argument. A counter proves it — if the
  // check sat after githubContext(), `gh auth status` would already have run.
  // `-R` / `--web` would be parsed by `gh` as options, not as a branch name: the
  // classic argv hazard, distinct from shell injection (there is no shell here).
  for (const bad of ['../evil', 'a/b', 'a\\b', '..', '.', '', '-R', '--web', '-']) {
    let ghCalls = 0;
    const countingGh = (args) => { ghCalls++; return fakeGh({ authed: true })(args); };
    const d = resolveDelivery({ runGit: fakeGit({ branch: 'main' }), runGh: countingGh, slug: bad });
    assert.equal(ghCalls, 0, `gh must not be invoked for slug ${JSON.stringify(bad)}`);
    assert.equal(d.state, 'unknown', `slug ${JSON.stringify(bad)} fails closed`);
    assert.equal(d.blocked_reason, 'INVALID_CHANGE_SLUG');
  }
});

test('a merged change resolves as merged from any branch (AC-1, AC-4)', () => {
  const gitOnMain = fakeGit({ branch: 'main' });
  const gh = fakeGh({ prByBranch: { 'my-change': { state: 'MERGED', number: 42 } } });

  // Without a slug the current branch is used: `main` has no PR → committed.
  assert.equal(resolveDelivery({ runGit: gitOnMain, runGh: gh }).state, 'committed');
  // With the slug, the change's own branch answers — regardless of what is checked out.
  assert.equal(resolveDelivery({ runGit: gitOnMain, runGh: gh, slug: 'my-change' }).state, 'merged');
});

test('the slug also selects which branch CI checks are read from (AC-1)', () => {
  const d = resolveDelivery({
    runGit: fakeGit({ branch: 'main' }),
    runGh: fakeGh({
      prByBranch: { 'my-change': { state: 'OPEN', number: 7 } },
      checksByBranch: { 'my-change': 'passed' },
    }),
    slug: 'my-change',
  });
  assert.equal(d.state, 'ci_passed');
});

test('no slug falls back to the current branch (AC-2, EC-4)', () => {
  const d = resolveDelivery({
    runGit: fakeGit({ branch: 'feature/x' }),
    runGh: fakeGh({ prByBranch: { 'feature/x': { state: 'MERGED', number: 3 } } }),
  });
  assert.equal(d.state, 'merged');
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

test('hub explicitly listed as impacted is included once in delivery identity', () => {
  const cwd = makeChange({ impactedReposSection: '- hub' });
  writeConfig(cwd, { repos: { hub: { role: 'sdd', path: '.' } } });
  const resolveOne = fakeResolveOne({ [cwd]: { state: 'merged' } });
  const result = resolveMultiRepoDelivery({ cwd, slug: 'demo', resolveOne });
  assert.equal(result.per_repo.length, 1);
  assert.deepEqual(resolveOne.calls, [cwd]);
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

// --- The slug must reach resolveDelivery, in both paths (AC-3) ---

test('resolveMultiRepoDelivery forwards the slug to resolveOne (AC-3)', () => {
  // Spy that records the FULL opts, not just cwd: the point is that `slug` arrives.
  function spy(statesByCwd) {
    const seen = [];
    const fn = (opts) => {
      seen.push(opts);
      const entry = statesByCwd[opts.cwd];
      if (!entry) throw new Error(`no fake state for cwd ${opts.cwd}`);
      return entry;
    };
    fn.seen = seen;
    return fn;
  }

  // single-repo path (no impacted repos → early return)
  const soloCwd = makeChange({ impactedReposSection: 'No aplica.' });
  const soloSpy = spy({ [soloCwd]: { state: 'merged' } });
  resolveMultiRepoDelivery({ cwd: soloCwd, slug: 'demo', resolveOne: soloSpy });
  assert.equal(soloSpy.seen.length, 1);
  assert.equal(soloSpy.seen[0].slug, 'demo', 'single-repo path forwards the slug');

  // per-repo fan-out: the hub and every impacted repo use the same change branch
  const multiCwd = makeChange({ impactedReposSection: '- backend' });
  const backendPath = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-backend-slug-'));
  writeConfig(multiCwd, { repos: { backend: { path: backendPath } } });
  const multiSpy = spy({ [multiCwd]: { state: 'merged' }, [backendPath]: { state: 'merged' } });
  resolveMultiRepoDelivery({ cwd: multiCwd, slug: 'demo', resolveOne: multiSpy });
  assert.equal(multiSpy.seen.length, 2);
  for (const opts of multiSpy.seen) {
    assert.equal(opts.slug, 'demo', `fan-out forwards the slug (cwd ${opts.cwd})`);
  }
});
