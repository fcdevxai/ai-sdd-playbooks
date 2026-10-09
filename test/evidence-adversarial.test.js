/**
 * Adversarial matrix for design Amendment R5: every provable evidence defect fails in
 * every checkout mode, unknown history or selection is reported and never a clean pass,
 * and a clean change passes with only the annotations each mode must carry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { EXIT } from '../src/cli/dispatch.js';
import { interveningChanges } from '../src/tokens/equivalence.js';
import { writeHandoffManifest, validateHandoffManifest } from '../src/tokens/handoff.js';
import { loadChange } from '../src/config/artifacts.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import { boundFlow, cli, cloneOf, editBinding, gatedFixture, bindAll, commitEverything, REPORT, CONFIG } from './helpers/evidence-fixture.js';

const MODES = ['strict', 'clone', 'shallow', 'detached', 'delivered'];
const MERGED = { state: 'merged', per_repo: [{ repo: 'hub', state: 'merged' }] };
const COMMITTED = { state: 'committed', per_repo: [{ repo: 'hub', state: 'committed' }] };

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };
const implementationSha = (git) => git('log', '--format=%H', '-n', '2').split('\n')[1];
const stageManifest = (change) => path.join(change, fs.readdirSync(change).find((name) => name.startsWith('handoff-manifest-sdd-code-review-')));

function outsideCopy(file) {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-adv-outside-')), path.basename(file));
  fs.copyFileSync(file, target);
  return target;
}
function symlinkOutside(file) {
  const target = outsideCopy(file);
  fs.unlinkSync(file);
  fs.symlinkSync(target, file);
}
function symlinkInside(cwd, file) {
  const target = path.join(cwd, 'docs', `copy-${path.basename(file)}`);
  fs.copyFileSync(file, target);
  fs.unlinkSync(file);
  fs.symlinkSync(path.relative(path.dirname(file), target), file);
}

function json(result) {
  try {
    return JSON.parse(result.out);
  } catch {
    return { failed: 'unparsable', results: [], local_only: [], after_delivery: [] };
  }
}

/** Run one mode against the source repository (left on the change branch for all but `delivered`). */
async function runMode(mode, { cwd, git }) {
  if (mode === 'strict') return cli(['validate', '--json', '--cwd', cwd]);
  if (mode === 'clone') return cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  if (mode === 'shallow') return cli(['validate', '--ci', '--cwd', cloneOf(cwd, { depth: 1 })]);
  if (mode === 'detached') {
    const clone = cloneOf(cwd);
    execFileSync('git', ['checkout', '-q', '--detach', 'HEAD'], { cwd: clone });
    return cli(['validate', '--ci', '--cwd', clone]);
  }
  // delivered: the change branch merged into main with a merge commit, validated on main.
  const branch = git('symbolic-ref', '--short', 'HEAD');
  git('branch', 'main', git('rev-list', '--max-parents=0', 'HEAD').split('\n')[0]);
  git('checkout', '-q', 'main');
  git('merge', '-q', '--no-ff', '--allow-unrelated-histories', '-m', `merge ${branch}`, branch);
  return cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
}

const notes = (result, kind) => (json(result)[kind] || []).map((entry) => `${entry.check}: ${entry.reason}`).join('\n');

/**
 * `fail`: provable in that mode. `unknown`: not decidable there (shallow history or binding
 * selection); it must be reported, never a clean pass. `limit`: an accepted limit of
 * delivered evaluation (design Amendment R5, rule 7).
 */
const MUTATIONS = [
  { name: 'latest binding records a false governed digest', shallow: 'unknown',
    apply: ({ change, git }) => { editBinding(change, REPORT, implementationSha(git), (r) => { r.governed_hash = '8'.repeat(64); }); commit(git, 'corrupt'); } },
  { name: 'Issue 15: corrupt latest binding beside a nonexistent-SHA candidate', shallow: 'unknown',
    apply: ({ change, git }) => {
      const sha = implementationSha(git);
      editBinding(change, REPORT, sha, (r) => { r.governed_hash = '8'.repeat(64); });
      const bogus = 'f'.repeat(40);
      const record = JSON.parse(fs.readFileSync(path.join(change, `evidence-binding-code-review-report-hub-${sha}.json`), 'utf8'));
      record.current_commit_sha = bogus;
      fs.writeFileSync(path.join(change, `evidence-binding-code-review-report-hub-${bogus}.json`), JSON.stringify(record, null, 2) + '\n');
      commit(git, 'mask');
    } },
  { name: 'latest binding replaced by an external symlink', shallow: 'unknown',
    apply: ({ change, git }) => { symlinkOutside(path.join(change, `evidence-binding-code-review-report-hub-${implementationSha(git)}.json`)); commit(git, 'symlink'); } },
  { name: 'handoff-manifest.json replaced by an external symlink',
    apply: ({ change, git }) => { symlinkOutside(path.join(change, 'handoff-manifest.json')); commit(git, 'symlink'); } },
  { name: 'handoff-manifest.json replaced by an internal symlink',
    apply: ({ cwd, change, git }) => { symlinkInside(cwd, path.join(change, 'handoff-manifest.json')); commit(git, 'symlink'); } },
  { name: 'handoff-manifest.json replaced by a directory',
    apply: ({ change, git }) => {
      const file = path.join(change, 'handoff-manifest.json');
      fs.unlinkSync(file); fs.mkdirSync(file); fs.writeFileSync(path.join(file, 'keep'), 'x\n');
      commit(git, 'directory');
    } },
  { name: 'tasks.md replaced by an external symlink',
    apply: ({ change, git }) => { symlinkOutside(path.join(change, 'tasks.md')); commit(git, 'symlink'); } },
  { name: 'proposal.md replaced by an external symlink',
    apply: ({ change, git }) => { symlinkOutside(path.join(change, 'proposal.md')); commit(git, 'symlink'); } },
  { name: 'security report replaced by an external symlink',
    apply: ({ change, git }) => { symlinkOutside(path.join(change, 'security-report.md')); commit(git, 'symlink'); } },
  { name: 'stage manifest replaced by an external symlink',
    apply: ({ change, git }) => { symlinkOutside(stageManifest(change)); commit(git, 'symlink'); } },
  { name: 'stage manifest bytes altered',
    apply: ({ change, git }) => { fs.appendFileSync(stageManifest(change), ' '); commit(git, 'stage'); } },
  { name: 'sealed report front matter malformed',
    apply: ({ change, git }) => {
      const file = path.join(change, 'security-report.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/manifest_hash: [a-f0-9]{64}/, 'manifest_hash: nothex'));
      commit(git, 'malformed');
    } },
  { name: 'executable front matter in proposal.md',
    apply: ({ change, git }) => {
      const file = path.join(change, 'proposal.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^---\n/, '---js\n(globalThis.__playbookFrontMatterExecuted = true, {})\n---\n<!--\n') + '\n-->\n');
      commit(git, 'js front matter');
    } },
  { name: 'governed drift committed after the binding', delivered: 'limit',
    apply: ({ cwd, git }) => { fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 1000;\n'); commit(git, 'drift'); } },
  { name: 'sealed commit rewritten away with identical content', shallow: 'unknown',
    apply: ({ git }) => {
      git('checkout', '-q', '--orphan', 'rewritten'); commit(git, 'rewritten root');
      git('branch', '-D', 'demo'); git('branch', '-m', 'demo');
    } },
];

test('a clean bound change passes every mode with exactly the annotations the mode requires', async () => {
  const state = await boundFlow();
  for (const mode of MODES) {
    const result = await runMode(mode, state);
    assert.equal(result.code, EXIT.OK, `${mode}\n${result.out}${result.err}`);
    assert.equal(json(result).failed, 0, mode);
    if (mode === 'clone') assert.match(notes(result, 'local_only'), /receipt/i);
    if (mode === 'shallow') assert.match(notes(result, 'local_only'), /shallow|history/i);
    if (mode === 'detached') assert.match(notes(result, 'local_only'), /detached|branch identity/i);
    if (mode === 'detached') assert.doesNotMatch(notes(result, 'local_only'), /history/i, 'a complete detached clone has full history');
    if (mode === 'delivered') assert.match(notes(result, 'after_delivery'), /not applicable after delivery/i);
    if (mode === 'strict') assert.deepEqual(json(result).local_only, []);
  }
});

for (const mutation of MUTATIONS) {
  test(`provable defect fails in every mode: ${mutation.name}`, async () => {
    globalThis.__playbookFrontMatterExecuted = false;
    for (const mode of MODES) {
      const expected = mutation[mode] || 'fail';
      if (expected === 'limit') continue;
      const state = await boundFlow();
      mutation.apply(state);
      const result = await runMode(mode, state);
      const label = `${mutation.name} [${mode}]`;
      if (expected === 'fail') {
        assert.notEqual(result.code, EXIT.OK, `${label} must fail\n${result.out}`);
        assert.ok(json(result).failed === 'unparsable' || json(result).failed > 0, label);
      } else {
        assert.ok(result.code !== EXIT.OK || /history|shallow|selection/i.test(notes(result, 'local_only')),
          `${label} must not be a clean pass\n${result.out}`);
      }
    }
    assert.equal(globalThis.__playbookFrontMatterExecuted, false, 'front matter is never executed');
  });
}

test('history unknown in one repository never masks a provable defect in another', async () => {
  const state = await gatedFixture({ context: true });
  commitEverything(state);
  bindAll(state.cwd);
  commit(state.git, 'bindings');
  const tooling = fs.readFileSync(path.join(state.cwd, 'playbook.config.yaml'), 'utf8').match(/tooling: \{path: ([^}]+)\}/)[1];
  const inTooling = (...args) => execFileSync('git', args, { cwd: tooling, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  // The context repository's sealed commit is rewritten away with identical content: provable in its complete history.
  inTooling('checkout', '-q', '--orphan', 'rewritten'); inTooling('add', '-A'); inTooling('commit', '-qm', 'rewritten');
  inTooling('branch', '-D', 'tooling'); inTooling('branch', '-m', 'tooling');
  const shallowHub = cloneOf(state.cwd, { depth: 1 });
  const portable = validateHandoffManifest('demo', { cwd: shallowHub, allowCommittedDescendants: true, portable: true });
  assert.equal(portable.ok, false, JSON.stringify(portable));
  assert.match(portable.issues.join(' '), /tooling/);
});

test('changed paths include changes introduced by a merge commit', async () => {
  const state = await boundFlow();
  const { cwd, git } = state;
  const before = git('rev-parse', 'HEAD');
  git('checkout', '-q', '-b', 'side');
  fs.writeFileSync(path.join(cwd, 'docs', 'side.md'), '# side\n'); commit(git, 'side');
  git('checkout', '-q', 'demo');
  git('merge', '-q', '--no-ff', '--no-commit', 'side');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 77;\n');
  git('add', '-A'); git('commit', '-qm', 'evil merge');
  assert.ok(interveningChanges(cwd, before, git('rev-parse', 'HEAD'), 'demo').governed.includes('code.js'));
});

test('strict validation and writers refuse a detached HEAD; another branch never inherits evidence', async () => {
  const state = await boundFlow();
  const { cwd, git } = state;
  git('checkout', '-q', '--detach', 'HEAD');
  const strict = await cli(['validate', '--json', '--cwd', cwd]);
  assert.notEqual(strict.code, EXIT.OK);
  assert.match(strict.out, /detached HEAD/i);
  assert.throws(() => writeHandoffManifest('demo', { cwd, stage: 'sdd-commit', agent: 'Codex' }), /detached HEAD/i);
  git('checkout', '-q', '-b', 'renamed');
  for (const args of [['validate', '--json', '--cwd', cwd], ['validate', '--ci', '--cwd', cloneOf(cwd)]]) {
    const result = await cli(args);
    assert.notEqual(result.code, EXIT.OK, result.out);
    assert.match(result.out, /sealed on branch demo|branch demo/i);
  }
});

test('strict delivered evaluation on the base branch requires live merged delivery and still fails a corrupt chain', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  const implementation = implementationSha(git);
  git('branch', 'main', git('rev-list', '--max-parents=0', 'HEAD'));
  git('checkout', '-q', 'main');
  git('merge', '-q', '--no-ff', '-m', 'merge demo', 'demo');
  const evaluate = (delivery) => inspectEvidence('demo', { cwd, config: CONFIG, artifacts: loadChange(change).artifacts, delivery });
  const merged = evaluate(MERGED);
  assert.deepEqual(merged.issues, []);
  assert.ok(merged.afterDelivery.length > 0, 'content comparison is reported as not applicable, never as passed');
  assert.match(evaluate(COMMITTED).issues.join(' '), /merged delivery/i);
  editBinding(change, REPORT, implementation, (r) => { r.governed_hash = '9'.repeat(64); });
  commit(git, 'corrupt on main');
  assert.notDeepEqual(evaluate(MERGED).issues, []);
});

test('front matter in any language other than YAML or JSON is an error and never executed', async () => {
  const state = await boundFlow();
  globalThis.__playbookFrontMatterExecuted = false;
  const file = path.join(state.change, 'tasks.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^---\n/, '---javascript\n(globalThis.__playbookFrontMatterExecuted = true, {})\n---\n<!--\n') + '\n-->\n');
  for (const args of [['validate', '--json', '--cwd', state.cwd], ['status', 'demo', '--json', '--cwd', state.cwd], ['next', 'demo', '--json', '--cwd', state.cwd]]) {
    await cli(args);
  }
  assert.equal(globalThis.__playbookFrontMatterExecuted, false);
  const result = await cli(['validate', '--json', '--cwd', state.cwd]);
  assert.match(result.out, /front matter must be YAML or JSON/i);
  const next = JSON.parse((await cli(['next', 'demo', '--json', '--cwd', state.cwd])).out);
  assert.equal(next.next.action, 'blocked');
  assert.match(next.next.reason, /unreadable artifact/);
});

// ---------------------------------------------------------------------------
// Round 6: every repository is judged on its own context (Issue 17); change-local
// references, the packet contract and closure copies follow the contained-read rule (Issue 16).
// ---------------------------------------------------------------------------

import { validateEvidenceBinding } from '../src/tokens/binding.js';

async function deliveredHubWithContext() {
  const state = await gatedFixture({ context: true });
  commitEverything(state);
  bindAll(state.cwd);
  commit(state.git, 'bindings');
  const tooling = fs.readFileSync(path.join(state.cwd, 'playbook.config.yaml'), 'utf8').match(/tooling: \{path: ([^}]+)\}/)[1];
  const inTooling = (...args) => execFileSync('git', args, { cwd: tooling, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  state.git('branch', 'main', state.git('rev-list', '--max-parents=0', 'HEAD'));
  state.git('checkout', '-q', 'main');
  state.git('merge', '-q', '--no-ff', '-m', 'merge demo', 'demo');
  return { ...state, tooling, inTooling };
}

const judged = async (cwd) => ({
  manifest: [false, true].map((portable) => validateHandoffManifest('demo', { cwd, allowCommittedDescendants: true, portable })),
  binding: [false, true].map((portable) => validateEvidenceBinding('demo', REPORT, { cwd, portable })),
  ci: await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]),
});

test('a delivered SDD root never exempts a context repository still on its sealed branch (Issue 17)', async () => {
  const honest = await deliveredHubWithContext();
  const clean = await judged(honest.cwd);
  assert.ok(clean.manifest.every((result) => result.ok), JSON.stringify(clean.manifest));
  assert.ok(clean.binding.every((result) => result.ok), JSON.stringify(clean.binding));
  assert.equal(clean.ci.code, EXIT.OK, clean.ci.out);

  const drifted = await deliveredHubWithContext();
  fs.writeFileSync(path.join(drifted.tooling, 'engine.js'), 'export const engine = 999;\n');
  drifted.inTooling('add', '-A'); drifted.inTooling('commit', '-qm', 'unreviewed tooling change');
  const result = await judged(drifted.cwd);
  for (const outcome of [...result.manifest, ...result.binding]) {
    assert.equal(outcome.ok, false, JSON.stringify(outcome));
    assert.match(outcome.issues.join(' '), /tooling/);
  }
  assert.notEqual(result.ci.code, EXIT.OK, result.ci.out);
});

test('reverse control: a delivered context repository is exempt only for itself', async () => {
  const state = await gatedFixture({ context: true });
  commitEverything(state);
  bindAll(state.cwd);
  commit(state.git, 'bindings');
  const tooling = fs.readFileSync(path.join(state.cwd, 'playbook.config.yaml'), 'utf8').match(/tooling: \{path: ([^}]+)\}/)[1];
  const inTooling = (...args) => execFileSync('git', args, { cwd: tooling, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  inTooling('checkout', '-q', '-b', 'main');
  fs.writeFileSync(path.join(tooling, 'other.js'), 'export const other = 1;\n');
  inTooling('add', '-A'); inTooling('commit', '-qm', 'later work on the context base branch');
  const manifest = validateHandoffManifest('demo', { cwd: state.cwd, allowCommittedDescendants: true, portable: true });
  assert.equal(manifest.ok, true, JSON.stringify(manifest));
  assert.ok(manifest.localOnly.some((entry) => entry.kind === 'after-delivery' && /tooling/.test(entry.check)));
  const strict = inspectEvidence('demo', { cwd: state.cwd, config: CONFIG, artifacts: loadChange(state.change).artifacts, delivery: COMMITTED });
  assert.deepEqual(strict.issues, [], 'a context repository on its base branch never demands merged delivery of this change');
  fs.writeFileSync(path.join(state.cwd, 'code.js'), 'export const value = 4242;\n');
  commit(state.git, 'drift on the change branch');
  assert.equal(validateEvidenceBinding('demo', REPORT, { cwd: state.cwd }).ok, false, 'the SDD root on its change branch keeps full rules');
});

test('change-local references and the packet contract are never read through a symbolic link (Issue 16)', async () => {
  const reference = 'openspec/changes/demo/reference.md';
  const state = await gatedFixture({ prepare: ({ cwd, change }) => {
    fs.writeFileSync(path.join(cwd, reference), '# Reference architecture\n');
    const tasks = path.join(change, 'tasks.md');
    fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replace('  architecture: []', `  architecture: [{repository: hub, path: ${reference}}]`));
  } });
  commitEverything(state);
  bindAll(state.cwd);
  commit(state.git, 'bindings');
  assert.equal((await cli(['validate', '--json', '--cwd', state.cwd])).code, EXIT.OK, 'honest regular reference passes');
  symlinkInside(state.cwd, path.join(state.cwd, reference));
  commit(state.git, 'reference becomes an internal symlink with identical bytes');
  for (const args of [['validate', '--json', '--cwd', state.cwd], ['validate', '--ci', '--cwd', cloneOf(state.cwd)]]) {
    const result = await cli(args);
    assert.notEqual(result.code, EXIT.OK, `${args.join(' ')}\n${result.out}`);
  }
  const packet = await cli(['packet', 'demo', '--stage', 'sdd-commit', '--agent', 'Codex', '--cwd', state.cwd]);
  assert.notEqual(packet.code, EXIT.OK, packet.out + packet.err);

  const contract = await boundFlow();
  const target = 'openspec/changes/demo/contract.yaml';
  fs.writeFileSync(path.join(contract.cwd, 'docs', 'contract.yaml'), 'openapi: 3.0.0\n');
  fs.symlinkSync(path.relative(path.join(contract.cwd, 'openspec/changes/demo'), path.join(contract.cwd, 'docs', 'contract.yaml')), path.join(contract.cwd, target));
  const config = path.join(contract.cwd, 'playbook.config.yaml');
  fs.appendFileSync(config, `contract: {path_in_loom: ${target}}\n`);
  const refused = await cli(['packet', 'demo', '--stage', 'sdd-commit', '--agent', 'Codex', '--cwd', contract.cwd]);
  assert.notEqual(refused.code, EXIT.OK, 'a change-local contract that is a symbolic link is refused');
  assert.match(refused.err, /not a contained regular file|symbolic link/i);
});
