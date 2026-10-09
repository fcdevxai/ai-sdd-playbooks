/** Independent audit probes (binding/eligibility/validate). Each asserts the SAFE behaviour. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from '../src/util/frontmatter.js';
import { EXIT } from '../src/cli/dispatch.js';
import { sha256 } from '../src/tokens/evidence.js';
import { bindAll, boundFlow, cli, cloneOf, commitEverything, editBinding, gatedFixture, headOf, evidence, DELIVERY } from './helpers/evidence-fixture.js';

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };

test('AB1: validate --ci rejects a gate whose recorded receipt names a repository the gate never covered', async () => {
  const state = await gatedFixture();
  const { cwd, git, change } = state;
  commitEverything(state);
  bindAll(cwd);
  const implementation = headOf(git);
  const report = 'security-report.md';
  const file = path.join(change, report);
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  parsed.data.source_binding.receipts[0].repository = 'foreign-repository';
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  editBinding(change, report, implementation, (record) => { record.report.hash = sha256(fs.readFileSync(file)); });
  commit(git, 'bindings');
  const strict = await cli(['validate', '--json', '--cwd', cwd]);
  assert.notEqual(strict.code, EXIT.OK, 'control: strict mode rejects the foreign receipt');
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.notEqual(ci.code, EXIT.OK, `validate --ci accepted a receipt reference for a repository outside the gate:\n${ci.out}`);
  const reasons = JSON.parse(ci.out).results.filter((row) => !row.valid).flatMap((row) => row.errors).join('\n');
  assert.match(reasons, /receipt|repository/i, reasons);
});

test('AB2: an ADR draft rewritten after the gates is not accepted as reviewed (strict and --ci)', async () => {
  const state = await gatedFixture({ prepare: ({ change }) => {
    fs.writeFileSync(path.join(change, 'adr-storage-choice.md'), '---\nschema: adr\n---\n# ADR: storage\n## Decision\nUse PostgreSQL.\n');
  } });
  const { cwd, git, change } = state;
  commitEverything(state);
  bindAll(cwd);
  commit(git, 'bindings');
  assert.deepEqual(evidence(cwd, change, DELIVERY.committed).issues, [], 'control: valid before the rewrite');
  fs.writeFileSync(path.join(change, 'adr-storage-choice.md'), '---\nschema: adr\n---\n# ADR: storage\n## Decision\nStore everything in a public bucket.\n');
  commit(git, 'rewrite ADR after review');
  const strict = evidence(cwd, change, DELIVERY.committed);
  assert.notDeepEqual(strict.issues, [], 'strict eligibility accepted an ADR decision nobody reviewed');
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  const rows = JSON.parse(ci.out).results.filter((row) => row.file.endsWith('#evidence'));
  assert.ok(rows.some((row) => !row.valid), `validate --ci gate rows accept the rewritten ADR:\n${JSON.stringify(rows.map((r) => [r.file, r.valid]))}`);
});

test('AB3: an arbitrary non-evidence file added to the change directory after the gates is not accepted', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  assert.deepEqual(evidence(cwd, change, DELIVERY.committed).issues, [], 'control: valid before the addition');
  fs.writeFileSync(path.join(change, 'migration.sql'), 'DROP TABLE users;\n');
  commit(git, 'add unreviewed file inside the change directory');
  const strict = evidence(cwd, change, DELIVERY.committed);
  assert.notDeepEqual(strict.issues, [], 'unreviewed file in the change directory treated as evidence-only/ungoverned');
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.notEqual(ci.code, EXIT.OK, 'validate --ci accepted it');
});

test('AB4: validate --precondition sdd-commit reports (never crashes on) a proposal symlinked outside the project', async () => {
  const { cwd, change } = await boundFlow();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-outside-'));
  fs.copyFileSync(path.join(change, 'proposal.md'), path.join(outside, 'proposal.md'));
  fs.rmSync(path.join(change, 'proposal.md'));
  fs.symlinkSync(path.join(outside, 'proposal.md'), path.join(change, 'proposal.md'));
  let result;
  await assert.doesNotReject(async () => { result = await cli(['validate', 'demo', '--precondition', 'sdd-commit', '--json', '--cwd', cwd]); });
  assert.equal(result.code, EXIT.VIOLATION, result.out + result.err);
});

test('AB1b: validate --ci rejects a foreign-repository receipt reference behind an evidence-only binding', async () => {
  const state = await gatedFixture({ prepare: ({ git }) => { git('add', '-A'); git('commit', '-qm', 'implementation before review'); } });
  const { cwd, git, change } = state;
  commit(git, 'reports');
  bindAll(cwd);
  const head = headOf(git);
  const report = 'security-report.md';
  const file = path.join(change, report);
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  parsed.data.source_binding.receipts[0].repository = 'foreign-repository';
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  editBinding(change, report, head, (record) => { record.report.hash = sha256(fs.readFileSync(file)); });
  commit(git, 'bindings');
  const strict = await cli(['validate', '--json', '--cwd', cwd]);
  assert.notEqual(strict.code, EXIT.OK, 'control: strict mode rejects the foreign receipt');
  assert.match(strict.out, /repository source differs|change\/repository mismatch|which the report does not cover/);
  const clone = cloneOf(cwd);
  fs.chmodSync(path.join(clone, 'tool.sh'), 0o755); // neutralise checkout-mode noise (see AB5)
  const ci = await cli(['validate', '--ci', '--cwd', clone]);
  assert.notEqual(ci.code, EXIT.OK, `validate --ci accepted a receipt reference for a repository outside the gate:\n${JSON.stringify(JSON.parse(ci.out).local_only.filter((e) => e.file === report), null, 1)}`);
});

test('AB5: an honest evidence-only flow (implementation committed before review) passes validate --ci in a clean clone', async () => {
  const state = await gatedFixture({ prepare: ({ git }) => { git('add', '-A'); git('commit', '-qm', 'implementation before review'); } });
  const { cwd, git } = state;
  commit(git, 'reports');
  bindAll(cwd);
  commit(git, 'bindings');
  const strict = await cli(['validate', '--json', '--cwd', cwd]);
  assert.equal(strict.code, EXIT.OK, 'control: valid in the sealing checkout\n' + strict.out);
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.equal(ci.code, EXIT.OK, `honest evidence rejected in a clean clone:\n${JSON.stringify(JSON.parse(ci.out).results.filter((r) => !r.valid).map((r) => r.errors))}`);
});

for (const [label, value] of [['coverage: 7', { coverage: 7 }], ['adapter receipts: 7', { adapters: { http: { status: 'passed', receipts: 7 } } }]]) {
  test(`AB6: a malformed runtime report (${label}) is a reported violation, never a crash (validate --ci, status, next)`, async () => {
    const { cwd, change } = await boundFlow();
    const file = path.join(change, 'runtime-gate-report.md');
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    Object.assign(parsed.data, value);
    fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
    for (const args of [['validate', '--ci', '--cwd', cwd], ['status', '--json', '--cwd', cwd], ['next', '--json', '--cwd', cwd]]) {
      let result;
      await assert.doesNotReject(async () => { result = await cli(args); }, args.join(' '));
      if (args[0] !== 'status') assert.notEqual(result.code, EXIT.OK, args.join(' '));
    }
  });
}

test('AB3c: validate --ci rejects an unreviewed non-evidence file added to the change directory after the gates', async () => {
  const { cwd, git, change } = await boundFlow();
  fs.writeFileSync(path.join(change, 'migration.sql'), 'DROP TABLE users;\n');
  commit(git, 'add unreviewed file inside the change directory');
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.notEqual(ci.code, EXIT.OK, 'validate --ci accepted it');
});

for (const command of ['status', 'next']) {
  test(`AB6b: ${command} reports (never crashes on) a runtime report with a non-iterable coverage`, async () => {
    const { cwd, change } = await boundFlow();
    const file = path.join(change, 'runtime-gate-report.md');
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    parsed.data.coverage = 7;
    fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
    await assert.doesNotReject(() => cli([command, '--json', '--cwd', cwd]));
  });
}
