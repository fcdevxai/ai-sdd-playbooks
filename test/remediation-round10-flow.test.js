import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gatedFixture, boundFlow, cloneOf, cli, commitEverything, DELIVERY } from './helpers/evidence-fixture.js';
import { fixture, merged } from './helpers/closure-fixture.js';
import { governedManifestHash, writeHandoffManifest } from '../src/tokens/handoff.js';
import { captureRun } from '../src/tokens/capture.js';
import { receiptIneligibility } from '../src/tokens/receipt.js';
import { retainEvidence, validateClosureIndex } from '../src/tokens/retention.js';
import { sealReport } from '../src/tokens/seal.js';
import { bindEvidence } from '../src/tokens/binding.js';
import { sha256 } from '../src/tokens/evidence.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import { loadChange } from '../src/config/artifacts.js';
import { loadConfig } from '../src/config/config.js';
import matter from '../src/util/frontmatter.js';

for (const action of ['seal', 'bind']) test(`33: ${action} refuses additional experimental passed claims`, async () => {
  const state = await gatedFixture(), file = path.join(state.change, 'runtime-gate-report.md');
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  parsed.data.adapters.cli = { status: 'passed', receipts: parsed.data.adapters.http.receipts };
  if (action === 'seal') delete parsed.data.source_binding;
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  if (action === 'seal') {
    const references = parsed.data.adapters.http.receipts.map(ref => path.join(state.cwd, ref.path));
    assert.throws(() => sealReport('demo', 'runtime-gate-report.md', { cwd: state.cwd, receipts: references, delivery: DELIVERY.uncommitted }), /adapter cli|runtime coverage/);
  } else {
    commitEverything(state);
    assert.throws(() => bindEvidence('demo', 'runtime-gate-report.md', { cwd: state.cwd }), /adapter cli|runtime coverage/);
  }
});

for (const depth of [null, 1]) test(`33: extra adapters fail CI in private clone depth=${depth}`, async () => {
  const state = await boundFlow(), cwd = cloneOf(state.cwd, { depth });
  assert.equal((await cli(['validate', 'demo', '--ci', '--json', '--cwd', cwd])).code, 0, 'valid HTTP control');
  const file = path.join(cwd, 'openspec/changes/demo/runtime-gate-report.md'), parsed = matter(fs.readFileSync(file, 'utf8'));
  parsed.data.adapters.cli = { status: 'passed', receipts: parsed.data.adapters.http.receipts };
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  const result = await cli(['validate', 'demo', '--ci', '--json', '--cwd', cwd]);
  assert.notEqual(result.code, 0); assert.match(result.out, /cli.*(?:experimental|support)|adapter cli/);
});

for (const report of ['code-review-report.md', 'security-report.md', 'runtime-gate-report.md']) test(`30: live and portable cross-stage contradiction in ${report}`, async () => {
  const state = fixture(), file = path.join(state.change, report), parsed = matter(fs.readFileSync(file, 'utf8')), source = parsed.data.source_binding;
  const config = loadConfig({ cwd: state.cwd }).config;
  const check = ci => inspectEvidence('example', { cwd: state.cwd, config, artifacts: loadChange(state.change).artifacts, delivery: merged, ci });
  assert.equal(check(false).gates[report].ok, true, 'valid complete live control');
  const manifest = JSON.parse(fs.readFileSync(path.join(state.cwd, source.manifest_path)));
  manifest.requirement.hash = 'f'.repeat(64);
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), hash = sha256(bytes), name = `handoff-manifest-${manifest.stage}-${hash}.json`;
  fs.writeFileSync(path.join(state.change, name), bytes);
  source.manifest_path = `openspec/changes/example/${name}`; source.manifest_hash = hash;
  source.governed_manifest_hash = governedManifestHash(manifest); source.proposal_hash = manifest.requirement.hash;
  for (const ref of source.receipts) {
    const receiptFile = path.join(state.cwd, ref.path), receipt = JSON.parse(fs.readFileSync(receiptFile));
    receipt.manifest_hash = hash; receipt.artifacts.proposal_hash = source.proposal_hash;
    fs.writeFileSync(receiptFile, JSON.stringify(receipt) + '\n'); ref.sha256 = sha256(fs.readFileSync(receiptFile));
    for (const row of parsed.data.coverage || []) if (row.receipt.path === ref.path) row.receipt.sha256 = ref.sha256;
    for (const adapter of Object.values(parsed.data.adapters || {})) for (const row of adapter.exclusion?.substitute_receipts || []) if (row.path === ref.path) row.sha256 = ref.sha256;
  }
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  for (const ci of [false, true]) { const checked = check(ci); assert.equal(checked.gates[report].ok, false); assert.match(checked.gates[report].issues.join(' '), /normative/); }
  fs.rmSync(path.join(state.cwd, '.specloom/runs'), { recursive: true });
  const portable = check(true); assert.equal(portable.gates[report].ok, false); assert.ok(portable.localOnly.length > 0);
});

for (const tracked of [false, true]) for (const link of ['internal-parent', 'external-parent', 'final']) {
  test(`32: all live entry points refuse raw-byte ${link}, tracked=${tracked}, before reading`, async () => {
    let file, nested, target;
    const prepare = ({ cwd, change, git }) => {
      nested = path.join(change, 'nested'); fs.mkdirSync(nested);
      file = Buffer.concat([Buffer.from(nested + '/artifact-'), Buffer.from([0xff])]);
      fs.writeFileSync(file, 'regular fixture');
      if (tracked) git('add', '-A');
      target = link === 'internal-parent' ? path.join(cwd, 'internal-sentinel') : fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-'));
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(Buffer.concat([Buffer.from(target + '/artifact-'), Buffer.from([0xff])]), 'PRIVATE SENTINEL');
    };
    const state = await gatedFixture({ prepare });
    if (link === 'final') { fs.unlinkSync(file); fs.symlinkSync(path.join(target, 'artifact-') + '\ufffd', file); }
    else { fs.rmSync(nested, { recursive: true }); fs.symlinkSync(target, nested); }
    const reads = [], originalRead = fs.readFileSync, originalLink = fs.readlinkSync;
    const observed = candidate => Buffer.from(candidate).equals(file) || Buffer.from(candidate).subarray(0, Buffer.byteLength(target + '/')).equals(Buffer.from(target + '/'));
    fs.readFileSync = function(candidate, ...args) { if (typeof candidate !== 'number' && observed(candidate)) reads.push('read'); return originalRead.call(fs, candidate, ...args); };
    fs.readlinkSync = function(candidate, ...args) { if (observed(candidate)) reads.push('readlink'); return originalLink.call(fs, candidate, ...args); };
    try {
      assert.throws(() => writeHandoffManifest('demo', { cwd: state.cwd, stage: 'sdd-apply', agent: 'Fixture' }), /contained|symbolic|symlink/);
      assert.throws(() => sealReport('demo', 'runtime-gate-report.md', { cwd: state.cwd }), /contained|symbolic|symlink/);
      assert.throws(() => bindEvidence('demo', 'code-review-report.md', { cwd: state.cwd }), /contained|symbolic|symlink/);
      const captured = await captureRun({ argv: [process.execPath, '-e', 'console.log("capture control")'], cwd: state.cwd,
        changeId: 'demo', step: 'apply', harness: 'fixture', repoName: 'hub', agent: 'Fixture' });
      assert.ok(receiptIneligibility(JSON.parse(fs.readFileSync(captured.receiptPath))));
    } finally { fs.readFileSync = originalRead; fs.readlinkSync = originalLink; }
    assert.deepEqual(reads, []);
  });
}

test('32: retention refuses raw-byte parent redirection without reading sentinel', () => {
  let nested, file;
  const state = fixture({ prepare: ({ change }) => {
    nested = path.join(change, 'nested'); fs.mkdirSync(nested);
    file = Buffer.concat([Buffer.from(nested + '/artifact-'), Buffer.from([0xff])]); fs.writeFileSync(file, 'regular fixture');
  } });
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'retain-sentinel-'));
  fs.writeFileSync(Buffer.concat([Buffer.from(target + '/artifact-'), Buffer.from([0xff])]), 'PRIVATE SENTINEL');
  fs.rmSync(nested, { recursive: true }); fs.symlinkSync(target, nested);
  const reads = [], originalRead = fs.readFileSync, originalLink = fs.readlinkSync;
  fs.readFileSync = function(candidate, ...args) { if (Buffer.isBuffer(candidate) && candidate.equals(file)) reads.push('read'); return originalRead.call(fs, candidate, ...args); };
  fs.readlinkSync = function(candidate, ...args) { if (Buffer.isBuffer(candidate) && candidate.equals(file)) reads.push('readlink'); return originalLink.call(fs, candidate, ...args); };
  try { assert.throws(() => retainEvidence('example', { cwd: state.cwd, rawDestination: state.rawDestination, delivery: merged }), /contained|symbolic|symlink/); }
  finally { fs.readFileSync = originalRead; fs.readlinkSync = originalLink; }
  assert.deepEqual(reads, []);
});

test('33: retention rejects experimental passed claims before publishing', () => {
  const state = fixture(), file = path.join(state.change, 'runtime-gate-report.md');
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  parsed.data.status = 'passed';
  parsed.data.adapters.cli = { status: 'passed', receipts: parsed.data.source_binding.receipts };
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  assert.throws(() => retainEvidence('example', { cwd: state.cwd, rawDestination: state.rawDestination, delivery: merged }), /cli.*experimental|runtime coverage/);
  assert.equal(fs.existsSync(path.join(state.cwd, 'openspec/archive/example')), false);
});

test('31: retention traverses additional adapter receipts beyond source_binding', () => {
  const state = fixture(), file = path.join(state.change, 'runtime-gate-report.md');
  const parsed = matter(fs.readFileSync(file, 'utf8')), original = parsed.data.source_binding.receipts[0];
  const dir = path.join(state.cwd, '.specloom/runs/run-runtime-additional'); fs.mkdirSync(dir);
  const receipt = JSON.parse(fs.readFileSync(path.join(state.cwd, original.path)));
  receipt.run_id = 'run-runtime-additional';
  for (const raw of Object.values(receipt.raw)) fs.copyFileSync(path.join(path.dirname(path.join(state.cwd, original.path)), raw.path), path.join(dir, raw.path));
  const receiptPath = path.join(dir, 'execution-receipt.json'); fs.writeFileSync(receiptPath, JSON.stringify(receipt) + '\n');
  const ref = { repository: 'hub', path: path.relative(state.cwd, receiptPath), sha256: sha256(fs.readFileSync(receiptPath)) };
  parsed.data.adapters.cli.exclusion.substitute_receipts = [...parsed.data.adapters.cli.exclusion.substitute_receipts, ref];
  parsed.data.coverage.push({ criterion: 'AC-1', repository: 'hub', adapter: 'cli', receipt: ref });
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  const retained = retainEvidence('example', { cwd: state.cwd, rawDestination: state.rawDestination, delivery: merged });
  assert.ok(retained.index.restricted_raw.some(row => row.original_reference === ref.path), 'required additional original receipt is copied');
  fs.rmSync(state.change, { recursive: true }); fs.rmSync(path.join(state.cwd, '.specloom/runs'), { recursive: true });
  assert.equal(validateClosureIndex('example', { cwd: state.cwd }).ok, true);
});
