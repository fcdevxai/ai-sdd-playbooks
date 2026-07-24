import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { classifyRepoFiles, parseGroupedFilesTouched, parseFilesTouchedBullet, PROTECTED_PATHS_BUILTIN } from '../src/repos/classify.js';
import { readRepoGitState, resolveRepoBaseBranch, resolveImplicitBase, IMPLICIT_BASE_CANDIDATES } from '../src/repos/git-state.js';
import { extractImpactedRepos, readImpactedRepos } from '../src/repos/impacted.js';
import { resolveSddRepo, resolveConfiguredRepoPath, resolveRepoRunTarget, SDD_REPO_DEFAULT_NAME } from '../src/repos/config.js';
import { collectChangedFiles } from '../src/repos/changed-files.js';
import { buildRepoPlan, buildCommitPlan, prepareRepos, BRANCH_PREP_BLOCKERS } from '../src/repos/plan.js';
import { normalizeGateCheckPlan, runGateCheck, splitCommand } from '../src/repos/gate-check.js';
import { diffContract, checkContractDrift } from '../src/repos/contract-drift.js';
import { run, EXIT } from '../src/cli/dispatch.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-repos-')); }
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function initRepo(cwd, { branch = 'main' } = {}) {
  git(cwd, ['init', '-q', '-b', branch]);
  git(cwd, ['config', 'user.email', 'test@example.com']);
  git(cwd, ['config', 'user.name', 'Test']);
}

function commitAll(cwd, message) {
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-q', '-m', message]);
}

// ---------------------------------------------------------------------------
// classify.js
// ---------------------------------------------------------------------------

test('classifyRepoFiles buckets declared/changed files, protects the built-in denylist', () => {
  const result = classifyRepoFiles({
    declared: ['src/a.js', 'src/b.js', '.env'],
    changed: ['src/a.js', 'src/c.js', '.env'],
    protectedPaths: [],
  });
  assert.deepEqual(result.candidateFiles, ['src/a.js']);
  assert.deepEqual(result.unrelatedFiles, ['src/c.js']);
  assert.deepEqual(result.expectedButMissing, ['src/b.js']);
  assert.deepEqual(result.protectedStaged, ['.env']);
});

test('classifyRepoFiles applies project protected_paths on top of the built-in denylist', () => {
  const result = classifyRepoFiles({
    declared: ['config/secrets/x.yaml'],
    changed: ['config/secrets/x.yaml'],
    protectedPaths: ['config/secrets/**'],
  });
  assert.deepEqual(result.protectedStaged, ['config/secrets/x.yaml']);
  assert.deepEqual(result.candidateFiles, []);
});

test('PROTECTED_PATHS_BUILTIN always includes secrets/specs/build outputs', () => {
  assert.ok(PROTECTED_PATHS_BUILTIN.includes('.env'));
  assert.ok(PROTECTED_PATHS_BUILTIN.includes('openspec/specs/**'));
  assert.ok(PROTECTED_PATHS_BUILTIN.includes('node_modules/'));
});

test('parseFilesTouchedBullet understands grouped and flat/backtick forms', () => {
  assert.deepEqual(parseFilesTouchedBullet('backend: src/api.js'), { repo: 'backend', path: 'src/api.js' });
  assert.deepEqual(parseFilesTouchedBullet('`src/api.js`'), { repo: null, path: 'src/api.js' });
  assert.deepEqual(parseFilesTouchedBullet('src/plain.js'), { repo: null, path: 'src/plain.js' });
});

test('parseGroupedFilesTouched maps repo-prefixed bullets, defaults flat bullets to the SDD repo', () => {
  const section = '- backend: src/api.js\n- `docs/readme.md`\n- ../escaped.js\n';
  const map = parseGroupedFilesTouched(section, { allowlist: ['backend'], sddRepoName: 'loom' });
  assert.deepEqual(map.backend, ['src/api.js']);
  assert.deepEqual(map.loom, ['docs/readme.md']);
});

test('parseGroupedFilesTouched throws on an undeclared repo name', () => {
  assert.throws(() => parseGroupedFilesTouched('- ghost: x.js\n', { allowlist: ['backend'], sddRepoName: 'loom' }), /Unknown repo "ghost"/);
});

// ---------------------------------------------------------------------------
// git-state.js
// ---------------------------------------------------------------------------

test('readRepoGitState reports repo_declared_but_missing for a nonexistent path', () => {
  const state = readRepoGitState({ repoPath: '/nonexistent/path/xyz', targetBranch: 'demo' });
  assert.equal(state.blocker, 'repo_declared_but_missing');
});

test('readRepoGitState: clean repo on target branch has no blocker', () => {
  const cwd = tmp();
  initRepo(cwd, { branch: 'demo' });
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'x');
  commitAll(cwd, 'init');
  const state = readRepoGitState({ repoPath: cwd, targetBranch: 'demo' });
  assert.equal(state.blocker, null);
  assert.equal(state.currentBranch, 'demo');
  assert.equal(state.dirty, false);
});

test('readRepoGitState: dirty tree on a DIFFERENT branch is dirty_worktree_on_wrong_branch', () => {
  const cwd = tmp();
  initRepo(cwd, { branch: 'main' });
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'x');
  commitAll(cwd, 'init');
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'dirty');
  const state = readRepoGitState({ repoPath: cwd, targetBranch: 'demo' });
  assert.equal(state.blocker, 'dirty_worktree_on_wrong_branch');
});

test('readRepoGitState: dirty tree ALREADY on the target branch has no blocker', () => {
  const cwd = tmp();
  initRepo(cwd, { branch: 'demo' });
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'x');
  commitAll(cwd, 'init');
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'dirty');
  const state = readRepoGitState({ repoPath: cwd, targetBranch: 'demo' });
  assert.equal(state.blocker, null);
  assert.equal(state.dirty, true);
});

test('resolveImplicitBase probes candidates in order and finds the first that resolves', () => {
  const cwd = tmp();
  initRepo(cwd, { branch: 'master' });
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'x');
  commitAll(cwd, 'init');
  const gitFn = (args) => git(cwd, args);
  const probe = resolveImplicitBase(gitFn);
  assert.equal(probe.baseResolved, true);
  assert.equal(probe.baseRef, 'master');
  assert.ok(IMPLICIT_BASE_CANDIDATES.includes('master'));
});

test('resolveRepoBaseBranch falls back to config default_base, then probe, then unresolved', () => {
  const cwd = tmp();
  initRepo(cwd, { branch: 'develop' }); // not an implicit candidate, no remote
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'x');
  commitAll(cwd, 'init');

  const withDefault = resolveRepoBaseBranch({ repoPath: cwd, defaultBase: 'develop' });
  assert.deepEqual(withDefault, { baseBranch: 'develop', baseResolved: true, baseSource: 'config-default' });

  const withoutDefault = resolveRepoBaseBranch({ repoPath: cwd, defaultBase: null });
  assert.equal(withoutDefault.baseResolved, false);
});

// ---------------------------------------------------------------------------
// impacted.js
// ---------------------------------------------------------------------------

test('extractImpactedRepos parses a bulleted list, ignores "not applicable"', () => {
  const content = '## Impacted repos\n\n- backend\n- frontend\n';
  assert.deepEqual(extractImpactedRepos(content), ['backend', 'frontend']);
  assert.deepEqual(extractImpactedRepos('## Impacted repos\n\nNot applicable.\n'), []);
  assert.deepEqual(extractImpactedRepos('## Impacted repos\n\n<!-- none -->\n'), []);
  assert.deepEqual(extractImpactedRepos('# no such section\n'), []);
});

test('readImpactedRepos reads it from a real proposal.md', () => {
  const cwd = tmp();
  const dir = path.join(cwd, 'openspec', 'changes', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'proposal.md'), '---\nstatus: approved\n---\n# Demo\n\n## Impacted repos\n\n- backend\n');
  assert.deepEqual(readImpactedRepos('demo', path.join(cwd, 'openspec', 'changes')), ['backend']);
});

// ---------------------------------------------------------------------------
// Toy two-repo fixture: a "loom" (SDD hub) repo + a "backend" sibling repo.
// ---------------------------------------------------------------------------

function makeMultiRepoFixture() {
  const root = tmp();
  const loomDir = path.join(root, 'loom');
  const backendDir = path.join(root, 'backend');
  fs.mkdirSync(loomDir, { recursive: true });
  fs.mkdirSync(backendDir, { recursive: true });

  initRepo(loomDir, { branch: 'main' });
  fs.writeFileSync(path.join(loomDir, 'README.md'), '# loom\n');
  commitAll(loomDir, 'init loom');

  initRepo(backendDir, { branch: 'main' });
  fs.writeFileSync(path.join(backendDir, 'index.js'), 'console.log("ok")\n');
  commitAll(backendDir, 'init backend');

  fs.writeFileSync(path.join(loomDir, 'playbook.config.yaml'), `version: 2
methodology:
  compatible: ">=0.1.0 <1.0.0"
capabilities:
  http: false
github:
  base_branch: main
  require_pull_request: true
  require_ci: true
repos:
  loom:
    role: sdd
    path: "."
    default_base: main
  backend:
    path: "../backend"
    stack: "Node"
    default_base: main
    verification:
      test: "node -e \\"console.log('backend tests ok')\\""
`);

  const changeDir = path.join(loomDir, 'openspec', 'changes', 'demo');
  fs.mkdirSync(changeDir, { recursive: true });
  fs.writeFileSync(path.join(changeDir, 'proposal.md'), `---
status: approved
---
# Demo cross-repo feature

## Impacted repos

- backend

## Files touched

- backend: index.js
- loom: openspec/changes/demo/proposal.md
`);

  return { root, loomDir, backendDir };
}

test('resolveSddRepo: implicit hub when no role:sdd is declared', () => {
  const cwd = tmp();
  const result = resolveSddRepo({ cwd });
  assert.equal(result.name, SDD_REPO_DEFAULT_NAME);
  assert.equal(result.implicit, true);
  assert.equal(result.path, cwd);
});

test('resolveSddRepo: explicit role:sdd repo resolves to cwd', () => {
  const { loomDir } = makeMultiRepoFixture();
  const result = resolveSddRepo({ cwd: loomDir });
  assert.equal(result.name, 'loom');
  assert.equal(result.implicit, false);
});

test('resolveConfiguredRepoPath resolves a sibling repo path relative to cwd', () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  const resolved = resolveConfiguredRepoPath('backend', { cwd: loomDir, requireDirectory: true });
  assert.equal(path.resolve(resolved), path.resolve(backendDir));
});

test('resolveConfiguredRepoPath throws for an unknown repo', () => {
  const { loomDir } = makeMultiRepoFixture();
  assert.throws(() => resolveConfiguredRepoPath('ghost', { cwd: loomDir }), /Unknown repo "ghost"/);
});

test('resolveRepoRunTarget resolves a configured verification command for a sibling repo', () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  const target = resolveRepoRunTarget({ repoName: 'backend', verificationKey: 'test', cwd: loomDir });
  assert.equal(path.resolve(target.cwd), path.resolve(backendDir));
  assert.match(target.command, /backend tests ok/);
});

test('collectChangedFiles: explicit base diffs a real git repo', () => {
  const cwd = tmp();
  initRepo(cwd, { branch: 'main' });
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'one');
  commitAll(cwd, 'base');
  git(cwd, ['switch', '-c', 'feature']);
  fs.writeFileSync(path.join(cwd, 'b.txt'), 'two');
  commitAll(cwd, 'feature work');
  const result = collectChangedFiles('demo', { baseRef: 'main', cwd });
  assert.equal(result.baseResolved, true);
  assert.ok(result.files.includes('b.txt'));
  assert.equal(result.fallback, false);
});

test('collectChangedFiles: no resolvable base falls back to context-packet/tasks + local state', () => {
  const cwd = tmp();
  initRepo(cwd, { branch: 'weird-branch-name' }); // not an implicit candidate
  const dir = path.join(cwd, 'openspec', 'changes', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tasks.md'), '# Tasks\n\n- **Files**: `src/a.js`, `src/b.js`\n');
  fs.writeFileSync(path.join(cwd, 'untracked.txt'), 'x');
  const result = collectChangedFiles('demo', { cwd });
  assert.equal(result.baseResolved, false);
  assert.equal(result.fallback, true);
  assert.equal(result.fallbackSource, 'tasks.md');
  assert.ok(result.files.includes('src/a.js'));
  assert.ok(result.files.includes('untracked.txt'));
  assert.ok(result.warnings.length > 0);
});

test('buildRepoPlan: two-repo fixture produces sdd + backend entries with candidate files', () => {
  const { loomDir } = makeMultiRepoFixture();
  const plan = buildRepoPlan('demo', { cwd: loomDir });
  assert.equal(plan.sddRepo, 'loom');
  const names = plan.repos.map((r) => r.name).sort();
  assert.deepEqual(names, ['backend', 'loom']);
  const backend = plan.repos.find((r) => r.name === 'backend');
  assert.equal(backend.role, 'sibling');
  assert.equal(backend.baseResolved, true);
  assert.equal(backend.baseBranch, 'main');
});

test('buildRepoPlan: undeclared-but-changed files surface as undeclared_files_modified', () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  // Remove the declared "backend: index.js" bullet so backend declares NOTHING,
  // while a real (committed, on the target branch) change still exists.
  const proposalPath = path.join(loomDir, 'openspec', 'changes', 'demo', 'proposal.md');
  fs.writeFileSync(
    proposalPath,
    fs.readFileSync(proposalPath, 'utf8').replace('- backend: index.js\n', ''),
  );
  git(backendDir, ['switch', '-c', 'demo']);
  fs.writeFileSync(path.join(backendDir, 'index.js'), 'console.log("changed")\n');
  commitAll(backendDir, 'unrelated backend change');

  const plan = buildRepoPlan('demo', { cwd: loomDir });
  const backend = plan.repos.find((r) => r.name === 'backend');
  assert.equal(backend.blocker, 'undeclared_files_modified');
  assert.equal(backend.requiresHuman, true);
});

/** Simulates the post-prepare-repos, mid-implementation state: backend already
 * switched to the change branch with a real commit ahead of its base. */
function advanceBackendOnDemoBranch(backendDir) {
  git(backendDir, ['switch', '-c', 'demo']);
  fs.writeFileSync(path.join(backendDir, 'index.js'), 'console.log("changed")\n');
  commitAll(backendDir, 'implement demo in backend');
}

test('buildCommitPlan: assembles a PR payload per repo with candidate files, never calls gh', () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  advanceBackendOnDemoBranch(backendDir);
  const plan = buildCommitPlan('demo', { cwd: loomDir });
  assert.equal(plan.sddRepo, 'loom');
  const backendPayload = plan.payloads.find((p) => p.repo === 'backend');
  assert.ok(backendPayload);
  assert.equal(backendPayload.base, 'main');
  assert.equal(backendPayload.head, 'demo');
  assert.deepEqual(backendPayload.files, ['index.js']);
  assert.match(backendPayload.body, /Implements `demo` in `backend`/);
});

test('prepareRepos: creates the change branch from base in a clean sibling repo', () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  const result = prepareRepos('demo', { cwd: loomDir });
  const backendMutation = result.mutated.find((m) => m.repo === 'backend');
  assert.equal(backendMutation.action, 'created');
  assert.equal(backendMutation.from, 'main');
  assert.equal(git(backendDir, ['symbolic-ref', '--short', 'HEAD']).trim(), 'demo');
});

test('prepareRepos: skips a repo in a git-unsafe state (dirty on the wrong branch)', () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  fs.writeFileSync(path.join(backendDir, 'index.js'), 'dirty, uncommitted');
  const result = prepareRepos('demo', { cwd: loomDir });
  const skipped = result.skipped.find((s) => s.repo === 'backend');
  assert.ok(skipped);
  assert.ok(BRANCH_PREP_BLOCKERS.has(skipped.blocker));
});

test('prepareRepos never runs add/commit/push — only branch switch state changes', () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  prepareRepos('demo', { cwd: loomDir });
  // Working tree must still be clean — nothing was staged or committed.
  const status = git(backendDir, ['status', '--porcelain']);
  assert.equal(status.trim(), '');
});

// ---------------------------------------------------------------------------
// gate-check.js
// ---------------------------------------------------------------------------

test('normalizeGateCheckPlan: not applicable when no impacted repos are declared', () => {
  const cwd = tmp();
  const dir = path.join(cwd, 'openspec', 'changes', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'proposal.md'), '---\nstatus: approved\n---\n# Demo\n\n## Impacted repos\n\nNot applicable.\n');
  const plan = normalizeGateCheckPlan({ slug: 'demo', cwd });
  assert.equal(plan.applicable, false);
});

test('runGateCheck: executes real verification commands per repo and reports pass/fail', () => {
  const { loomDir } = makeMultiRepoFixture();
  const result = runGateCheck({ slug: 'demo', cwd: loomDir });
  assert.equal(result.ok, true);
  const backendResult = result.results.find((r) => r.repo === 'backend');
  assert.equal(backendResult.exitCode, 0);
  assert.ok(fs.existsSync(backendResult.logPath));
});

test('runGateCheck: a failing verification command is reported as a failure', () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  fs.writeFileSync(path.join(loomDir, 'playbook.config.yaml'),
    fs.readFileSync(path.join(loomDir, 'playbook.config.yaml'), 'utf8')
      .replace(`test: "node -e \\"console.log('backend tests ok')\\""`, 'test: "node -e \\"process.exit(1)\\""'));
  const result = runGateCheck({ slug: 'demo', cwd: loomDir });
  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].repo, 'backend');
});

test('splitCommand tokenizes quotes and escapes correctly', () => {
  assert.deepEqual(splitCommand('npm test'), ['npm', 'test']);
  assert.deepEqual(splitCommand('node -e "console.log(1)"'), ['node', '-e', 'console.log(1)']);
  assert.throws(() => splitCommand('node -e "unterminated'), /unmatched quote/);
  assert.throws(() => splitCommand('   '), /Empty verification command/);
});

// ---------------------------------------------------------------------------
// contract-drift.js
// ---------------------------------------------------------------------------

const CANONICAL_OPENAPI = {
  paths: {
    '/users': {
      post: { requestBody: { content: { 'application/json': { schema: { required: ['name', 'email'] } } } } },
    },
  },
};

test('diffContract: identical specs produce no issues', () => {
  assert.deepEqual(diffContract(CANONICAL_OPENAPI, CANONICAL_OPENAPI), []);
});

test('diffContract: detects a missing endpoint, an undocumented endpoint, and a field mismatch', () => {
  const generated = {
    paths: {
      '/users': {
        post: { requestBody: { content: { 'application/json': { schema: { required: ['name'] } } } } },
      },
      '/extra': { get: {} },
    },
  };
  const issues = diffContract(CANONICAL_OPENAPI, generated);
  assert.ok(issues.some((i) => /FIELD MISMATCH.*"email"/.test(i)));
  assert.ok(issues.some((i) => /UNDOCUMENTED: GET \/extra/.test(i)));
});

test('checkContractDrift throws for a missing file', () => {
  assert.throws(() => checkContractDrift('/nope/a.yaml', '/nope/b.yaml'), /File not found/);
});

// ---------------------------------------------------------------------------
// CLI wrappers
// ---------------------------------------------------------------------------

test('playbook repo-plan prints the plan and exits 0', async () => {
  const { loomDir } = makeMultiRepoFixture();
  const { io, out } = capture();
  const code = await run(['repo-plan', 'demo', '--cwd', loomDir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /backend/);
});

test('playbook commit-plan --json emits the payload list', async () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  advanceBackendOnDemoBranch(backendDir);
  const { io, out } = capture();
  const code = await run(['commit-plan', 'demo', '--json', '--cwd', loomDir], io);
  assert.equal(code, EXIT.OK);
  const parsed = JSON.parse(out.join('\n'));
  assert.ok(parsed.payloads.some((p) => p.repo === 'backend'));
});

test('playbook prepare-repos creates branches via the CLI', async () => {
  const { loomDir, backendDir } = makeMultiRepoFixture();
  const { io } = capture();
  const code = await run(['prepare-repos', 'demo', '--cwd', loomDir], io);
  assert.equal(code, EXIT.OK);
  assert.equal(git(backendDir, ['symbolic-ref', '--short', 'HEAD']).trim(), 'demo');
});

test('playbook gate-check runs and exits according to the result', async () => {
  const { loomDir } = makeMultiRepoFixture();
  const { io, out } = capture();
  const code = await run(['gate-check', 'demo', '--cwd', loomDir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /backend/);
});

test('playbook changed-files lists files for a change', async () => {
  const cwd = tmp();
  initRepo(cwd, { branch: 'main' });
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'one');
  commitAll(cwd, 'base');
  fs.writeFileSync(path.join(cwd, 'b.txt'), 'two');
  const { io, out } = capture();
  const code = await run(['changed-files', 'demo', '--base', 'main', '--cwd', cwd], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /b\.txt/);
});

test('playbook contract-drift reports drift via exit code', async () => {
  const cwd = tmp();
  fs.mkdirSync(path.join(cwd, 'openspec', 'specs', 'contracts'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, 'openspec', 'specs', 'contracts', 'openapi.yaml'),
    'paths:\n  /users:\n    post:\n      requestBody:\n        content:\n          application/json:\n            schema:\n              required: [name, email]\n',
  );
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), `version: 2
methodology:
  compatible: ">=0.1.0 <1.0.0"
capabilities:
  http: true
github:
  base_branch: main
  require_pull_request: true
  require_ci: true
contract:
  source_of_truth: "loom-first"
  path_in_loom: "openspec/specs/contracts/openapi.yaml"
`);
  const generatedPath = path.join(cwd, 'generated.yaml');
  fs.writeFileSync(generatedPath, 'paths:\n  /users:\n    post:\n      requestBody:\n        content:\n          application/json:\n            schema:\n              required: [name]\n');

  const { io, err } = capture();
  const code = await run(['contract-drift', generatedPath, '--cwd', cwd], io);
  assert.equal(code, EXIT.VIOLATION);
  assert.match(err.join('\n'), /FIELD MISMATCH/);
});

test('playbook detect-siblings lists git-repo siblings of the parent dir (text)', async () => {
  const { loomDir } = makeMultiRepoFixture();
  const { io, out } = capture();
  const code = await run(['detect-siblings', '--cwd', loomDir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /backend/);
});

test('playbook detect-siblings --json emits the detector object', async () => {
  const { loomDir } = makeMultiRepoFixture();
  const { io, out } = capture();
  const code = await run(['detect-siblings', '--json', '--cwd', loomDir], io);
  assert.equal(code, EXIT.OK);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.ownName, 'loom');
  assert.ok(Array.isArray(parsed.candidates));
  assert.ok(parsed.candidates.some((c) => c.name === 'backend'));
});

test('playbook detect-siblings with no git siblings returns empty candidates, exit 0', async () => {
  const root = tmp();
  const solo = path.join(root, 'solo');
  fs.mkdirSync(solo, { recursive: true });
  initRepo(solo, { branch: 'main' });
  fs.writeFileSync(path.join(solo, 'README.md'), '# solo\n');
  commitAll(solo, 'init solo');
  const { io, out } = capture();
  const code = await run(['detect-siblings', '--json', '--cwd', solo], io);
  assert.equal(code, EXIT.OK);
  const parsed = JSON.parse(out.join('\n'));
  assert.deepEqual(parsed.candidates, []);
});
