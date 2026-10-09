import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNamed } from '../src/schema/validate.js';

const hash = 'a'.repeat(64);
const commit = 'b'.repeat(40);
const reference = (file) => ({ repository: 'hub', path: file, hash });

function manifest() {
  return {
    schema: 'handoff-manifest', schema_version: 1, change_id: 'example', stage: 'sdd-apply',
    requirement: reference('openspec/changes/example/proposal.md'),
    spec: [reference('openspec/specs/system.md')],
    acceptance_criteria: [{ id: 'AC-1', reference: 'proposal.md#acceptance-criteria' }],
    error_cases: [{ id: 'EC-1', reference: 'proposal.md#error-cases' }],
    security_criteria: [{ id: 'SEC-1', reference: 'proposal.md#security-considerations' }],
    repositories: [{ name: 'hub', branch: 'example', commit_sha: commit, source_hash: hash }],
    design: reference('openspec/changes/example/design.md'),
    tasks: { ...reference('openspec/changes/example/tasks.md'), normative_hash: hash },
    contracts: [{ repository: 'hub', path: 'openspec/specs/contracts/api.yaml', content_hash: hash }],
    architecture: [reference('docs/doc_architecture.md')],
    required_skills: [{ name: 'sdd-apply', ...reference('skills/sdd-apply/canonical.md') }],
    required_tools: [{ name: 'playbook', context: 'hub', purpose: 'lifecycle' }],
    runtime_coverage: [{ criterion: 'AC-1', repositories: ['hub'], capabilities: ['cli'] }],
    unresolved_risks: [], blockers: [],
    producer: { agent: 'Codex', provider: 'unknown', model: 'unknown', provenance: 'caller_declared' },
    identity_issues: ['PROVIDER_UNAVAILABLE', 'MODEL_UNAVAILABLE'],
    created_at: '2026-10-06T00:00:00.000Z',
  };
}

test('handoff schema accepts complete generic identity and content references', () => {
  assert.deepEqual(validateNamed('handoff-manifest', manifest()).errors, []);
});

test('handoff schema rejects missing identity, missing repository SHA and malformed contract digest', () => {
  const missingIdentity = manifest();
  delete missingIdentity.producer;
  assert.equal(validateNamed('handoff-manifest', missingIdentity).valid, false);
  const missingSha = manifest();
  delete missingSha.repositories[0].commit_sha;
  assert.equal(validateNamed('handoff-manifest', missingSha).valid, false);
  const badContract = manifest();
  badContract.contracts[0].content_hash = 'metadata-only';
  assert.equal(validateNamed('handoff-manifest', badContract).valid, false);
  const escapingPath = manifest();
  escapingPath.contracts[0].path = '../secret';
  assert.equal(validateNamed('handoff-manifest', escapingPath).valid, false);
});

test('receipt and closure schemas require raw evidence and source identity', () => {
  const receipt = {
    schema: 'execution-receipt', schema_version: 1, run_id: 'run-1', change_id: 'example',
    stage: 'sdd-apply', repository: { name: 'hub', branch: 'example', commit_sha: commit, source_hash: hash },
    actor: { agent: 'Codex', provider: 'unknown', model: 'unknown', provenance: 'caller_declared', identity_issues: ['PROVIDER_UNAVAILABLE'] },
    command: { argv: ['node', '--test'], cwd: '/tmp/example' },
    environment: { platform: 'linux', runtime: 'node', container: 'unknown' },
    started_at: '2026-10-06T00:00:00.000Z', ended_at: '2026-10-06T00:00:01.000Z',
    exit_code: 0, summary: 'passed',
    raw: { stdout: { path: 'stdout.raw', bytes: 4, sha256: hash }, stderr: { path: 'stderr.raw', bytes: 0, sha256: hash }, full: { path: 'full.log', bytes: 4, sha256: hash } },
    artifacts: { proposal_hash: hash, tasks_hash: hash, normative_tasks_hash: hash, contract_hashes: [] },
  };
  assert.equal(validateNamed('execution-receipt', receipt).valid, true);
  delete receipt.raw;
  assert.equal(validateNamed('execution-receipt', receipt).valid, false);
  const binding = { schema: 'evidence-binding', schema_version: 1, change_id: 'example', repository: 'hub', report: reference('openspec/changes/example/runtime-gate-report.md'), previous_commit_sha: commit, current_commit_sha: 'c'.repeat(40), governed_hash: hash, evidence_only_paths: ['openspec/changes/example/runtime-gate-report.md'], created_at: '2026-10-06T00:00:00.000Z' };
  assert.equal(validateNamed('evidence-binding', binding).valid, true);
  delete binding.governed_hash;
  assert.equal(validateNamed('evidence-binding', binding).valid, false);
  const closure = { schema: 'closure-index', schema_version: 1, change_id: 'example', verified_commit_sha: commit,
    reference_rebase: { from: 'openspec/changes/example/', to: 'openspec/archive/example/' },
    files: [{ path: 'verification-report.md', sha256: hash }], created_at: '2026-10-06T00:00:00.000Z' };
  assert.equal(validateNamed('closure-index', closure).valid, true);
  closure.files = [];
  assert.equal(validateNamed('closure-index', closure).valid, false);
});

test('gate source binding requires immutable handoff, governed digest and receipt identity', () => {
  const source = {
    manifest_path: `openspec/changes/example/handoff-manifest-sdd-runtime-gate-${hash}.json`,
    manifest_hash: hash, governed_manifest_hash: hash,
    repositories: [{ name: 'hub', branch: 'example', commit_sha: commit, source_hash: hash }],
    proposal_hash: hash, design_hash: hash, normative_tasks_hash: hash, contract_hashes: [],
    receipts: [{ repository: 'hub', path: '.specloom/runs/run-1/execution-receipt.json', sha256: hash }],
    delivery_state: 'uncommitted',
  };
  assert.equal(validateNamed('source-binding', source).valid, true);
  delete source.governed_manifest_hash;
  assert.equal(validateNamed('source-binding', source).valid, false);
  source.governed_manifest_hash = hash;
  source.receipts = [];
  assert.equal(validateNamed('source-binding', source).valid, false);
});
