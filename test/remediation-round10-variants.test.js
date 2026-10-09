import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshotRepository, normativeTasksHash, sha256 } from '../src/tokens/evidence.js';
import { governedManifestHash } from '../src/tokens/handoff.js';
import { captureRun } from '../src/tokens/capture.js';
import { receiptIneligibility } from '../src/tokens/receipt.js';
import { fixture, merged } from './helpers/closure-fixture.js';
import { gatedFixture, cli, DELIVERY } from './helpers/evidence-fixture.js';
import { retainEvidence, validateClosureIndex } from '../src/tokens/retention.js';
import { validateRuntimeCoverage } from '../src/lifecycle/runtime-coverage.js';
import { loadConfig } from '../src/config/config.js';
import { loadChange } from '../src/config/artifacts.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import matter from '../src/util/frontmatter.js';

const git = (root, ...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'round10-source-'));
  git(root, 'init', '-q', '-b', 'demo'); git(root, 'config', 'user.name', 'Fixture'); git(root, 'config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(root, 'a.js'), 'reviewed\n');
  fs.writeFileSync(path.join(root, '.gitignore'), '*.ignored\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'source');
  return root;
}
function submodules(nested) {
  const leaf = repository(), middle = repository(), outer = repository();
  const add = (parent, source, name) => { git(parent, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, name); git(parent, 'add', '-A'); git(parent, 'commit', '-qm', 'child'); };
  if (nested) add(middle, leaf, 'nested');
  add(outer, nested ? middle : leaf, 'child');
  git(outer, '-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '--recursive');
  return { outer, child: path.join(outer, nested ? 'child/nested' : 'child') };
}
const snap = root => snapshotRepository({ root, changeId: 'demo' });

for (const flag of ['--assume-unchanged', '--skip-worktree']) for (const nested of [false, true]) {
  test(`26: actual child bytes under ${flag}, nested=${nested}`, async t => {
    for (const mutation of ['edit', 'delete', 'symlink', 'directory', 'executable']) await t.test(mutation, () => {
      const { outer, child } = submodules(nested), file = path.join(child, 'a.js');
      const before = snap(outer);
      git(child, 'update-index', flag, 'a.js');
      assert.equal(snap(outer).tree_hash, before.tree_hash, 'clean hints do not change content');
      if (mutation === 'edit') fs.writeFileSync(file, 'unreviewed\n');
      else if (mutation === 'delete') fs.unlinkSync(file);
      else if (mutation === 'symlink') { fs.unlinkSync(file); fs.symlinkSync('.gitignore', file); }
      else if (mutation === 'directory') { fs.unlinkSync(file); fs.mkdirSync(file); }
      else fs.chmodSync(file, 0o755);
      assert.throws(() => snap(outer), /submodule|unreviewed/);
    });
  });
}
test('26: ignored content is outside scope; relevant untracked content is refused', () => {
  const { outer, child } = submodules(true), before = snap(outer);
  fs.writeFileSync(path.join(child, 'private.ignored'), 'ignored fixture');
  assert.equal(snap(outer).tree_hash, before.tree_hash);
  fs.writeFileSync(path.join(child, 'new.js'), 'unreviewed');
  assert.throws(() => snap(outer), /submodule|unreviewed/);
});
for (const flag of ['--assume-unchanged', '--skip-worktree']) test(`26: hidden mutation during capture ${flag}`, async () => {
  const source = repository();
  const state = await gatedFixture({ prepare: ({ git: g }) => g('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'child') });
  git(path.join(state.cwd, 'child'), 'update-index', flag, 'a.js');
  const captured = await captureRun({ argv: [process.execPath, '-e', 'require("node:fs").writeFileSync("child/a.js","changed")'],
    cwd: state.cwd, changeId: 'demo', step: 'runtime', repoName: 'hub', agent: 'Codex' });
  const receipt = JSON.parse(fs.readFileSync(captured.receiptPath));
  assert.equal(receipt.source_changed_during_run, true);
  assert.ok(receiptIneligibility(receipt));
});

test('28: Markdown containers preserve executed heredoc literals and report-like text', () => {
  const script = "cat <<'TEXT'\n- **Done**: [x]\n- [x] literal\n## Execution Report\n\n\nend\nTEXT\n";
  const cases = [
    ['list-first', '- ```sh\n', '  ', '  ```\n'],
    ['ordered-first', '1. ```sh\n', '   ', '   ```\n'],
    ['nested-list', '- parent\n  - ```sh\n', '    ', '    ```\n'],
    ['quote-list', '> - ```sh\n', '>   ', '>   ```\n'],
    ['nested-quote', '> > ```sh\n', '> > ', '> > ```\n'],
    ['tab-list', '-\t```sh\n', '\t', '\t```\n'],
    ['continuation', '- task\n\n  ```sh\n', '  ', '  ```\n'],
  ];
  for (const [name, open, prefix, close] of cases) {
    const body = '# Tasks\n' + open + script.split('\n').slice(0, -1).map(line => prefix + line).join('\n') + '\n' + close;
    const changed = body.replace('[x]', '[ ]');
    const before = execFileSync('sh', ['-s'], { input: script });
    const after = execFileSync('sh', ['-s'], { input: script.replace('[x]', '[ ]') });
    assert.notDeepEqual(before, after, `${name}: actual command output differs`);
    assert.notEqual(normativeTasksHash(body), normativeTasksHash(changed), name);
    assert.notEqual(normativeTasksHash(body), normativeTasksHash(body.replace('\n' + prefix + '\n' + prefix + '\n', '\n' + prefix + '\n')), `${name}: literal newline`);
    assert.notEqual(normativeTasksHash(body), normativeTasksHash(body.replace('literal', 'different')), `${name}: checkbox literal`);
  }
  const admin = '# Tasks\n- **Done**: [x]\n- [x] implement\n## Execution Report\nResult old\n## Later tasks\n- [x] later\n';
  assert.equal(normativeTasksHash(admin), normativeTasksHash(admin.replaceAll('[x]', '[ ]').replace('Result old', 'Result new')));
  assert.notEqual(normativeTasksHash(admin), normativeTasksHash(admin.replace('later', 'changed')));
});

for (const tracked of [false, true]) for (const parent of ['regular', 'internal', 'external', 'final']) {
  test(`32: byte-safe change file, tracked=${tracked}, parent=${parent}`, () => {
    const root = repository(), change = path.join(root, 'openspec/changes/demo'), nested = path.join(change, 'nested');
    fs.mkdirSync(nested, { recursive: true }); fs.writeFileSync(path.join(change, 'tasks.md'), '# Tasks\n');
    const name = Buffer.concat([Buffer.from('a'), Buffer.from([255]), Buffer.from('.md')]);
    const file = Buffer.concat([Buffer.from(nested + '/'), name]);
    fs.writeFileSync(file, 'reviewed');
    if (tracked) { git(root, 'add', '-A'); git(root, 'commit', '-qm', 'byte name'); }
    if (parent === 'regular') { assert.ok(snap(root).tree_hash); return; }
    const target = parent === 'external' ? fs.mkdtempSync(path.join(os.tmpdir(), 'round10-sentinel-')) : path.join(root, 'target');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(Buffer.concat([Buffer.from(target + '/'), name]), 'private benign sentinel');
    if (parent === 'final') { fs.unlinkSync(file); fs.symlinkSync(path.join(target, 'missing'), file); }
    else { fs.rmSync(nested, { recursive: true }); fs.symlinkSync(target, nested); }
    const reads = [], originalRead = fs.readFileSync, originalLink = fs.readlinkSync;
    fs.readFileSync = function(candidate, ...args) { if (Buffer.isBuffer(candidate) && candidate.equals(file)) reads.push('read'); return originalRead.call(fs, candidate, ...args); };
    fs.readlinkSync = function(candidate, ...args) { if (Buffer.isBuffer(candidate) && candidate.equals(file)) reads.push('readlink'); return originalLink.call(fs, candidate, ...args); };
    try { assert.throws(() => snap(root), /contained|symbolic|symlink/); }
    finally { fs.readFileSync = originalRead; fs.readlinkSync = originalLink; }
    assert.deepEqual(reads, [], 'reject before source content or link bytes are read');
  });
}

function corruptStage(archive, index, report, mutation) {
  const reportFile = path.join(archive, report), parsed = matter(fs.readFileSync(reportFile, 'utf8')), source = parsed.data.source_binding;
  const oldName = path.basename(source.manifest_path), manifest = JSON.parse(fs.readFileSync(path.join(archive, oldName)));
  mutation(manifest);
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), hash = sha256(bytes), newName = `handoff-manifest-${manifest.stage}-${hash}.json`;
  fs.writeFileSync(path.join(archive, newName), bytes);
  const item = index.files.find(row => row.path === oldName); item.path = newName; item.sha256 = hash;
  Object.assign(source, { manifest_path: `openspec/changes/example/${newName}`, manifest_hash: hash,
    governed_manifest_hash: governedManifestHash(manifest), proposal_hash: manifest.requirement.hash, design_hash: manifest.design?.hash || 'unknown',
    normative_tasks_hash: manifest.tasks.normative_hash, contract_hashes: manifest.contracts.map(row => ({ path: row.path, hash: row.content_hash })) });
  for (const ref of source.receipts) {
    const entry = index.restricted_raw.find(row => row.original_reference === ref.path), receipt = JSON.parse(fs.readFileSync(entry.reference));
    receipt.manifest_hash = hash; receipt.artifacts.proposal_hash = source.proposal_hash; receipt.artifacts.normative_tasks_hash = source.normative_tasks_hash; receipt.artifacts.contract_hashes = source.contract_hashes;
    fs.writeFileSync(entry.reference, JSON.stringify(receipt, null, 2) + '\n'); ref.sha256 = entry.sha256 = sha256(fs.readFileSync(entry.reference));
    for (const row of parsed.data.coverage || []) if (row.receipt.path === ref.path) row.receipt.sha256 = ref.sha256;
    for (const adapter of Object.values(parsed.data.adapters || {})) for (const row of adapter.exclusion?.substitute_receipts || []) if (row.path === ref.path) row.sha256 = ref.sha256;
  }
  fs.writeFileSync(reportFile, matter.stringify(parsed.content, parsed.data)); index.files.find(row => row.path === report).sha256 = sha256(fs.readFileSync(reportFile));
}
test('30: each prerequisite and combinations must agree with verified normative identities', async t => {
  const mutations = {
    proposal: m => m.requirement.hash = 'f'.repeat(64),
    design: m => m.design.hash = 'f'.repeat(64),
    tasks: m => m.tasks.normative_hash = 'f'.repeat(64),
    architecture: m => m.architecture[0].hash = 'f'.repeat(64),
    contract: m => m.contracts.push({ repository: 'hub', path: 'docs/other.yaml', content_hash: 'f'.repeat(64) }),
  };
  for (const reports of [['code-review-report.md'], ['security-report.md'], ['runtime-gate-report.md'], ['code-review-report.md', 'security-report.md', 'runtime-gate-report.md']]) {
    for (const [kind, mutation] of Object.entries(mutations)) await t.test(`${reports.join('+')} ${kind}`, () => {
      const state = fixture({ changeLocalReference: true }), retained = retainEvidence('example', { cwd: state.cwd, rawDestination: state.rawDestination, delivery: merged });
      fs.rmSync(state.change, { recursive: true }); fs.rmSync(path.join(state.cwd, '.specloom/runs'), { recursive: true });
      assert.equal(validateClosureIndex('example', { cwd: state.cwd }).ok, true);
      for (const report of reports) corruptStage(retained.archive, retained.index, report, mutation);
      fs.writeFileSync(path.join(retained.archive, 'closure-index.json'), JSON.stringify(retained.index, null, 2) + '\n');
      const checked = validateClosureIndex('example', { cwd: state.cwd });
      assert.equal(checked.ok, false, JSON.stringify(checked));
    });
  }
});

test('33: all adapters need support, capabilities and correlated coverage', async () => {
  const state = await gatedFixture(), reportFile = path.join(state.change, 'runtime-gate-report.md'), parsed = matter(fs.readFileSync(reportFile, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(state.change, 'handoff-manifest.json'))), config = loadConfig({ cwd: state.cwd }).config;
  const check = report => validateRuntimeCoverage(report, { manifest, config, validateReceipt: () => ({ ok: true, issues: [] }) });
  assert.deepEqual(check(parsed.data), []);
  for (const name of ['cli', 'browser', 'worker', 'unknown', 'toString', '__proto__']) {
    const candidate = structuredClone(parsed.data);
    Object.defineProperty(candidate.adapters, name, { value: { status: 'passed', receipts: candidate.adapters.http.receipts }, enumerable: true });
    assert.notDeepEqual(check(candidate), [], name);
  }
  const unrelated = structuredClone(parsed.data); unrelated.adapters.http.receipts.push({ ...unrelated.adapters.http.receipts[0], path: '.specloom/runs/unmapped/execution-receipt.json' });
  assert.notDeepEqual(check(unrelated), [], 'every receipt must correlate with this adapter coverage');
  parsed.data.adapters.cli = { status: 'passed', receipts: parsed.data.adapters.http.receipts };
  fs.writeFileSync(reportFile, matter.stringify(parsed.content, parsed.data));
  const live = inspectEvidence('demo', { cwd: state.cwd, config, artifacts: loadChange(state.change).artifacts, delivery: DELIVERY.uncommitted });
  assert.equal(live.gates['runtime-gate-report.md'].ok, false);
  assert.notEqual((await cli(['validate', 'demo', '--ci', '--cwd', state.cwd])).code, 0);
});
