import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeCoverage } from '../src/lifecycle/runtime-coverage.js';

const authority = { repository: 'hub', path: 'docs/policy.md', hash: 'c'.repeat(64) };
const manifest = {
  repositories: [{ name: 'hub' }, { name: 'service' }],
  requirement: { repository: 'hub', path: 'proposal.md', hash: 'a'.repeat(64) },
  spec: [], contracts: [{ repository: 'hub', path: 'contract.yaml', content_hash: 'e'.repeat(64) }],
  architecture: [authority],
  acceptance_criteria: [{ id: 'AC-1' }],
  runtime_coverage: [{ criterion: 'AC-1', repositories: ['service'], capabilities: ['http'] }],
};
const config = { capabilities: { browser: false, http: true, cli: false, worker: false },
  repos: { hub: { capabilities: { browser: false, http: false, cli: false, worker: false } },
    service: { capabilities: { browser: false, http: true, cli: false, worker: false } } } };
const receipt = { repository: 'service', path: '.specloom/runs/one/execution-receipt.json', sha256: 'a'.repeat(64) };
function report() {
  return { status: 'passed', adapters: { http: { status: 'passed', receipts: [receipt] } },
    coverage: [{ criterion: 'AC-1', repository: 'service', adapter: 'http', receipt }] };
}
const validReceipt = () => ({ ok: true, issues: [] });

test('runtime coverage requires each enabled and task-declared adapter', () => {
  assert.deepEqual(validateRuntimeCoverage(report(), { manifest, config, validateReceipt: validReceipt }), []);
  const missing = report(); delete missing.adapters.http;
  assert.match(validateRuntimeCoverage(missing, { manifest, config, validateReceipt: validReceipt }).join(' '), /http.*missing/);
  assert.match(validateRuntimeCoverage({ status: 'passed', adapters: {} }, { manifest, config, validateReceipt: validReceipt }).join(' '), /http.*missing/);
});

test('runtime coverage rejects empty or unrelated evidence and unmapped criteria', () => {
  const empty = report(); empty.adapters.http.receipts = [];
  assert.match(validateRuntimeCoverage(empty, { manifest, config, validateReceipt: validReceipt }).join(' '), /receipt/i);
  const unrelated = report(); unrelated.coverage[0].receipt = { ...receipt, repository: 'other' };
  assert.match(validateRuntimeCoverage(unrelated, { manifest, config, validateReceipt: validReceipt }).join(' '), /repository|receipt/i);
  const unmapped = report(); unmapped.coverage = [];
  assert.match(validateRuntimeCoverage(unmapped, { manifest, config, validateReceipt: validReceipt }).join(' '), /AC-1.*service.*http/);
});

test('runtime exclusion requires an explicit reason and valid substitute evidence', () => {
  const excluded = report(); excluded.adapters.http = { status: 'not_applicable', reason_code: 'NOT_RELEVANT_TO_CHANGE',
    exclusion: { reason: 'Harness-only change', authority, covered_criteria: ['AC-1'], substitute_receipts: [receipt] } };
  excluded.coverage = [{ criterion: 'AC-1', repository: 'service', adapter: 'http', receipt }];
  excluded.status = 'not_applicable';
  assert.deepEqual(validateRuntimeCoverage(excluded, { manifest, config, validateReceipt: validReceipt }), []);
  delete excluded.adapters.http.exclusion.substitute_receipts;
  assert.match(validateRuntimeCoverage(excluded, { manifest, config, validateReceipt: validReceipt }).join(' '), /substitute/i);
  excluded.adapters.http.exclusion.substitute_receipts = [receipt];
  assert.match(validateRuntimeCoverage(excluded, { manifest, config, validateReceipt: () => ({ ok: false, issues: ['bad receipt'] }) }).join(' '), /bad receipt/);
});

test('fabricated passed adapter and invalid status aggregate fail closed', () => {
  const fabricated = report(); fabricated.adapters.http.receipts = [{ ...receipt, sha256: 'b'.repeat(64) }];
  assert.match(validateRuntimeCoverage(fabricated, { manifest, config, validateReceipt: () => ({ ok: false, issues: ['receipt hash mismatch'] }) }).join(' '), /receipt hash mismatch/);
  const falseAggregate = report(); falseAggregate.adapters.http.status = 'blocked';
  assert.match(validateRuntimeCoverage(falseAggregate, { manifest, config, validateReceipt: validReceipt }).join(' '), /aggregate|not passed/);
});

test('repository-specific capability applicability excludes unrelated workspaces', () => {
  const scoped = { ...config, repos: { hub: { capabilities: {} }, service: { capabilities: { http: true } },
    web: { capabilities: { browser: true } } } };
  assert.deepEqual(validateRuntimeCoverage(report(), { manifest, config: scoped, validateReceipt: validReceipt }), []);
  scoped.repos.service.capabilities.worker = true;
  assert.match(validateRuntimeCoverage(report(), { manifest, config: scoped, validateReceipt: validReceipt }).join(' '), /worker.*missing/);

  const unmapped = report();
  unmapped.adapters.worker = { status: 'passed', receipts: [receipt] };
  assert.match(validateRuntimeCoverage(unmapped, { manifest, config: scoped, validateReceipt: validReceipt }).join(' '),
    /AC-1.*service.*worker.*not mapped/);
  unmapped.adapters.worker = { status: 'not_applicable', reason_code: 'NOT_RELEVANT_TO_CHANGE',
    exclusion: { reason: 'No worker behavior changed', authority, covered_criteria: ['AC-1'], substitute_receipts: [receipt] } };
  assert.match(validateRuntimeCoverage(unmapped, { manifest, config: scoped, validateReceipt: validReceipt }).join(' '),
    /AC-1.*service.*worker.*not mapped/);

  const completeManifest = { ...manifest, runtime_coverage: [
    { criterion: 'AC-1', repositories: ['service'], capabilities: ['http', 'worker'] },
  ] };
  unmapped.adapters.worker = { status: 'passed', receipts: [receipt] };
  unmapped.coverage.push({ criterion: 'AC-1', repository: 'service', adapter: 'worker', receipt });
  assert.deepEqual(validateRuntimeCoverage(unmapped,
    { manifest: completeManifest, config: scoped, validateReceipt: validReceipt }), []);
});

test('a multi-repository change needs explicit per-repository capabilities, not the aggregate', () => {
  const aggregateOnly = { capabilities: { http: true } };
  const issues = validateRuntimeCoverage(report(), { manifest, config: aggregateOnly, validateReceipt: validReceipt });
  assert.match(issues.join(' '), /service.*no explicit capabilities/i);
  assert.match(issues.join(' '), /hub.*no explicit capabilities/i);
  const explicit = { capabilities: { http: true }, repos: { hub: { capabilities: {} }, service: { capabilities: { http: true } } } };
  assert.deepEqual(validateRuntimeCoverage(report(), { manifest, config: explicit, validateReceipt: validReceipt }), []);
});

test('a single-repository change may use the aggregate capabilities', () => {
  const single = { repositories: [{ name: 'hub' }], acceptance_criteria: [{ id: 'AC-1' }],
    runtime_coverage: [{ criterion: 'AC-1', repositories: ['hub'], capabilities: ['http'] }] };
  const hubReceipt = { ...receipt, repository: 'hub' };
  const hubReport = { status: 'passed', adapters: { http: { status: 'passed', receipts: [hubReceipt] } },
    coverage: [{ criterion: 'AC-1', repository: 'hub', adapter: 'http', receipt: hubReceipt }] };
  assert.deepEqual(validateRuntimeCoverage(hubReport, { manifest: single,
    config: { capabilities: { http: true } }, validateReceipt: validReceipt }), []);
});

test('a criterion mapped to a capability its repository declares disabled is a contradictory mapping', () => {
  const scoped = { repos: { hub: { capabilities: { cli: true } }, service: { capabilities: { http: true, cli: false } } } };
  const contradictory = { ...manifest, runtime_coverage: [
    { criterion: 'AC-1', repositories: ['service'], capabilities: ['http', 'cli'] },
  ] };
  const withCli = report();
  withCli.adapters.cli = { status: 'passed', receipts: [receipt] };
  withCli.coverage.push({ criterion: 'AC-1', repository: 'service', adapter: 'cli', receipt });
  const issues = validateRuntimeCoverage(withCli, { manifest: contradictory, config: scoped, validateReceipt: validReceipt });
  assert.match(issues.join(' '), /AC-1 service maps disabled capability cli/);
});

function excluded(overrides = {}) {
  const base = report();
  base.adapters.http = { status: 'not_applicable', reason_code: 'NOT_RELEVANT_TO_CHANGE',
    exclusion: { reason: 'Policy-bounded substitute', authority, covered_criteria: ['AC-1'], substitute_receipts: [receipt], ...overrides } };
  base.status = 'not_applicable';
  return base;
}
const check = (candidate) => validateRuntimeCoverage(candidate, { manifest, config, validateReceipt: validReceipt }).join(' ');

test('a complete exclusion with a governed authority and covered criteria is accepted', () => {
  assert.equal(check(excluded()), '');
});

test('an exclusion needs an approving authority that the handoff governs', () => {
  assert.match(check(excluded({ authority: undefined })), /approving authority/i);
  assert.match(check(excluded({ authority: { repository: 'hub', path: 'docs/other.md', hash: 'c'.repeat(64) } })), /approving authority/i);
  assert.match(check(excluded({ authority: { ...authority, hash: 'd'.repeat(64) } })), /approving authority/i);
  assert.match(check(excluded({ authority: { ...authority, repository: 'service' } })), /approving authority/i);
});

test('an exclusion must cover every criterion that maps the adapter and no unknown one', () => {
  assert.match(check(excluded({ covered_criteria: undefined })), /covered criteria/i);
  assert.match(check(excluded({ covered_criteria: [] })), /covered criteria/i);
  assert.match(check(excluded({ covered_criteria: ['AC-9'] })), /covered criteria/i);
  assert.match(check(excluded({ covered_criteria: ['AC-1', 'AC-9'] })), /unknown/i);
});

test('an exclusion with only a reason string and any receipt is no longer enough', () => {
  const lax = excluded();
  lax.adapters.http.exclusion = { reason: 'Harness-only change', substitute_receipts: [receipt] };
  const issues = check(lax);
  assert.match(issues, /approving authority/i);
  assert.match(issues, /covered criteria/i);
});
