import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadValidators } from '../src/schema/load.js';
import { validateArtifactFrontmatter, validateNamed } from '../src/schema/validate.js';
import { validateVerificationBody } from '../src/schema/body-rules.js';

const EXPECTED_SCHEMAS = [
  'adr', 'code-review-report', 'context-packet', 'design', 'proposal', 'runtime-gate-report',
  'playbook.config', 'playbook.lock', 'security-report', 'tasks', 'verification-report',
];

function validProposal(overrides = {}) {
  return {
    schema: 'proposal',
    schema_version: 1,
    change_id: 'demo',
    status: 'draft',
    impact: {
      public_contract: false, data_model: false, architecture_boundary: false,
      external_integration: false, cross_repository: false, authentication: false,
      authorization: false, infrastructure: false, concurrency: false, migration: false,
    },
    security: { risk: 'low', triggers: [] },
    ...overrides,
  };
}

test('schema-lint: all schemas compile via ajv (T1.1)', () => {
  const { keys } = loadValidators();
  assert.deepEqual(keys.slice().sort(), EXPECTED_SCHEMAS.slice().sort());
});

test('proposal: a well-formed proposal is accepted (T1.2)', () => {
  assert.equal(validateArtifactFrontmatter(validProposal()).valid, true);
});

test('proposal: missing impact is rejected (C-03)', () => {
  const fm = validProposal();
  delete fm.impact;
  assert.equal(validateArtifactFrontmatter(fm).valid, false);
});

test('proposal: missing security is rejected (C-04)', () => {
  const fm = validProposal();
  delete fm.security;
  assert.equal(validateArtifactFrontmatter(fm).valid, false);
});

test('proposal: illegal status is rejected', () => {
  assert.equal(validateArtifactFrontmatter(validProposal({ status: 'ready' })).valid, false);
});

test('proposal: unknown security trigger is rejected', () => {
  const fm = validProposal({ security: { risk: 'low', triggers: ['made_up_trigger'] } });
  assert.equal(validateArtifactFrontmatter(fm).valid, false);
});

test('proposal: change_id with spaces is rejected', () => {
  assert.equal(validateArtifactFrontmatter(validProposal({ change_id: 'not valid' })).valid, false);
});

test('proposal: valid runtime_relevant_capabilities is accepted; an unknown capability is rejected', () => {
  assert.equal(validateArtifactFrontmatter(validProposal({ runtime_relevant_capabilities: ['http', 'worker'] })).valid, true);
  assert.equal(validateArtifactFrontmatter(validProposal({ runtime_relevant_capabilities: ['queue'] })).valid, false);
});

test('proposal: omitting runtime_relevant_capabilities is still valid (backward compat)', () => {
  const fm = validProposal();
  assert.ok(!('runtime_relevant_capabilities' in fm));
  assert.equal(validateArtifactFrontmatter(fm).valid, true);
});

test('design: status "ready" is illegal, "approved" is legal (C-07)', () => {
  const base = {
    schema: 'design', schema_version: 1, change_id: 'demo',
    security: { risk: 'low', threat_model_required: false, controls: [] },
  };
  assert.equal(validateArtifactFrontmatter({ ...base, status: 'ready' }).valid, false);
  assert.equal(validateArtifactFrontmatter({ ...base, status: 'approved' }).valid, true);
  assert.equal(validateArtifactFrontmatter({ ...base, status: 'not_applicable' }).valid, true);
});

test('tasks: draft and ready are legal (C-07)', () => {
  const base = { schema: 'tasks', schema_version: 1, change_id: 'demo' };
  assert.equal(validateArtifactFrontmatter({ ...base, status: 'draft' }).valid, true);
  assert.equal(validateArtifactFrontmatter({ ...base, status: 'ready' }).valid, true);
  assert.equal(validateArtifactFrontmatter({ ...base, status: 'approved' }).valid, false);
});

test('runtime-gate-report: adapter "blocked" is legal (C-06)', () => {
  const base = { schema: 'runtime-gate-report', schema_version: 1, change_id: 'demo', status: 'blocked' };
  assert.equal(validateArtifactFrontmatter({
    ...base, adapters: { worker: { status: 'blocked', reason_code: 'ADAPTER_NOT_IMPLEMENTED' } },
  }).valid, true);
  assert.equal(validateArtifactFrontmatter({
    ...base, adapters: { worker: { status: 'skipped' } },
  }).valid, false);
});

test('unknown artifact schema is reported, not silently accepted', () => {
  const r = validateArtifactFrontmatter({ schema: 'nope', schema_version: 1, change_id: 'demo', status: 'draft' });
  assert.equal(r.valid, false);
});

test('no-frontmatter file is skipped, not failed', () => {
  const r = validateArtifactFrontmatter({});
  assert.equal(r.skipped, true);
  assert.equal(r.valid, true);
});

test('playbook.config: require_ci/require_pull_request must be true (AC-21)', () => {
  const good = {
    version: 2,
    methodology: { scope: 'user', compatible: '>=0.1.0 <1.0.0' },
    capabilities: { browser: true, http: true, cli: false, worker: false },
    github: { base_branch: 'master', require_pull_request: true, require_ci: true },
  };
  assert.equal(validateNamed('playbook.config', good).valid, true);
  assert.equal(validateNamed('playbook.config', { ...good, github: { ...good.github, require_ci: false } }).valid, false);
});

test('playbook.lock: compatible range is required (C-08)', () => {
  assert.equal(validateNamed('playbook.lock', {
    version: 2, methodology: { compatible: '>=0.1.0 <1.0.0', resolved: '0.1.3' },
  }).valid, true);
  assert.equal(validateNamed('playbook.lock', { version: 2, methodology: {} }).valid, false);
});

// --- validateVerificationBody (Task 1.1 — SEC-1 enforcement) ---

const VERIFICATION_BODY_FULL = [
  '# Verification Report — Demo',
  '',
  '## Acceptance criteria',
  '| # | Criterion | Test/Check | Result |',
  '|---|---|---|---|',
  '| AC-01 | does the thing | `test/foo.test.js` | passed |',
  '',
  '## Security considerations',
  '| SEC-N | control | test/check | result |',
  '|---|---|---|---|',
  '| SEC-1 | rejects unauth | `test/foo.test.js` | passed |',
  '',
  '## Regression',
  '**Result**: green',
].join('\n');

// SEC-1 negative case FIRST: a report with no security evidence is rejected.
test('validateVerificationBody: a body without "## Security considerations" is rejected (SEC-1 negative)', () => {
  const body = VERIFICATION_BODY_FULL.replace(/## Security considerations[\s\S]*?\n## Regression/, '## Regression');
  const r = validateVerificationBody(body);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /missing section: "## Security considerations"/.test(i)), JSON.stringify(r.issues));
});

test('validateVerificationBody: an empty "## Security considerations" is rejected (EC-2)', () => {
  const body = VERIFICATION_BODY_FULL.replace(
    /## Security considerations[\s\S]*?\n\n## Regression/,
    '## Security considerations\n\n## Regression',
  );
  const r = validateVerificationBody(body);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /empty content in "## Security considerations"/.test(i)), JSON.stringify(r.issues));
});

test('validateVerificationBody: all three required sections non-empty is accepted', () => {
  const r = validateVerificationBody(VERIFICATION_BODY_FULL);
  assert.deepEqual(r.issues, []);
  assert.equal(r.ok, true);
});

test('validateVerificationBody: "Not applicable: <reason>" counts as content (same as proposal body)', () => {
  const body = VERIFICATION_BODY_FULL.replace(
    /## Security considerations[\s\S]*?\n\n## Regression/,
    '## Security considerations\nNot applicable: no SEC-N declared in the proposal.\n\n## Regression',
  );
  const r = validateVerificationBody(body);
  assert.deepEqual(r.issues, []);
  assert.equal(r.ok, true);
});
