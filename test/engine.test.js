import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState, computeLifecycle } from '../src/lifecycle/engine.js';

const CFG = {};
const IMPACT_NONE = {
  public_contract: false, data_model: false, architecture_boundary: false,
  external_integration: false, cross_repository: false, authentication: false,
  authorization: false, infrastructure: false, concurrency: false, migration: false,
};
const IMPACT_SOME = { ...IMPACT_NONE, architecture_boundary: true };

function index(spec) {
  const a = {};
  if (spec.proposal) {
    a['proposal.md'] = { frontmatter: { schema: 'proposal', status: spec.proposal, impact: spec.impact } };
  }
  const map = {
    design: 'design.md', tasks: 'tasks.md', review: 'code-review-report.md',
    security: 'security-report.md', runtime: 'runtime-gate-report.md', verify: 'verification-report.md',
  };
  for (const [k, file] of Object.entries(map)) {
    if (spec[k]) a[file] = { frontmatter: { status: spec[k] } };
  }
  return a;
}

function state(spec, delivery = { state: 'unknown' }) {
  return computeState(CFG, null, index(spec), delivery);
}

test('no proposal → lifecycle none, next sdd-new', () => {
  const r = state({});
  assert.equal(r.lifecycle.state, 'none');
  assert.deepEqual(r.next, { action: 'run_skill', skill: 'sdd-new' });
});

test('proposal draft → proposal_draft, await human approval', () => {
  const r = state({ proposal: 'draft', impact: IMPACT_NONE });
  assert.equal(r.lifecycle.state, 'proposal_draft');
  assert.equal(r.next.action, 'await_human');
});

test('approved + design NOT required + no design.md → designed, next sdd-plan', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_NONE });
  assert.equal(r.lifecycle.design_required, false);
  assert.equal(r.lifecycle.state, 'designed');
  assert.deepEqual(r.next, { action: 'run_skill', skill: 'sdd-plan' });
});

test('approved + design REQUIRED + no design.md → proposal_approved, next sdd-design', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_SOME });
  assert.equal(r.lifecycle.design_required, true);
  assert.equal(r.lifecycle.state, 'proposal_approved');
  assert.deepEqual(r.next, { action: 'run_skill', skill: 'sdd-design' });
});

test('design required + design approved → designed → sdd-plan', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_SOME, design: 'approved' });
  assert.equal(r.lifecycle.state, 'designed');
  assert.equal(r.next.skill, 'sdd-plan');
});

test('tasks ready → planned → sdd-apply', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'ready' });
  assert.equal(r.lifecycle.state, 'planned');
  assert.equal(r.next.skill, 'sdd-apply');
});

test('tasks in_progress → implementing; tasks passed → implemented → sdd-code-review', () => {
  assert.equal(state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'in_progress' }).lifecycle.state, 'implementing');
  const r = state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'passed' });
  assert.equal(r.lifecycle.state, 'implemented');
  assert.equal(r.next.skill, 'sdd-code-review');
});

test('review passed → reviewed → sdd-security-gate', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'passed', review: 'passed' });
  assert.equal(r.lifecycle.state, 'reviewed');
  assert.equal(r.next.skill, 'sdd-security-gate');
});

test('security cleared → sdd-runtime-gate', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'passed', review: 'passed', security: 'passed' });
  assert.equal(r.lifecycle.state, 'security_cleared');
  assert.equal(r.next.skill, 'sdd-runtime-gate');
});

test('security not_applicable still clears', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'passed', review: 'passed', security: 'not_applicable' });
  assert.equal(r.lifecycle.state, 'security_cleared');
});

const RUNTIME_CLEARED = {
  proposal: 'approved', impact: IMPACT_NONE, tasks: 'passed',
  review: 'passed', security: 'passed', runtime: 'passed',
};

test('runtime_cleared combines with delivery (§3.4)', () => {
  const cases = {
    uncommitted: { action: 'run_skill', skill: 'sdd-commit' },
    committed: { action: 'run_skill', skill: 'sdd-commit' },
    pr_open: { action: 'wait_for_github_ci' },
    ci_pending: { action: 'wait_for_github_ci' },
    ci_failed: { action: 'blocked', reason: 'GITHUB_CI_FAILED' },
    ci_passed: { action: 'merge' },
    merged: { action: 'run_skill', skill: 'sdd-verify' },
    unknown: { action: 'blocked', reason: 'GITHUB_CONTEXT_UNAVAILABLE' },
  };
  for (const [delivery, expect] of Object.entries(cases)) {
    const r = state(RUNTIME_CLEARED, { state: delivery });
    assert.equal(r.lifecycle.state, 'runtime_cleared', `lifecycle for ${delivery}`);
    assert.equal(r.next.action, expect.action, `action for ${delivery}`);
    if (expect.skill) assert.equal(r.next.skill, expect.skill, `skill for ${delivery}`);
    if (expect.reason) assert.equal(r.next.reason, expect.reason, `reason for ${delivery}`);
  }
});

test('planned + delivery unknown does NOT block (local step)', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'ready' }, { state: 'unknown' });
  assert.equal(r.next.skill, 'sdd-apply'); // not blocked
});

test('merged + verification passed → verified → sdd-archive', () => {
  const r = state({ ...RUNTIME_CLEARED, verify: 'passed' }, { state: 'merged' });
  assert.equal(r.lifecycle.state, 'verified');
  assert.deepEqual(r.next, { action: 'run_skill', skill: 'sdd-archive' });
});

test('proposal archived → archived → done', () => {
  const r = state({ proposal: 'archived', impact: IMPACT_NONE });
  assert.equal(r.lifecycle.state, 'archived');
  assert.equal(r.next.action, 'done');
});

test('exception view: tasks blocked → remediate sdd-apply (§3.5)', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'blocked' });
  assert.ok(r.exception);
  assert.equal(r.exception.artifact, 'tasks.md');
  assert.equal(r.next.action, 'remediate');
  assert.equal(r.next.skill, 'sdd-apply');
});

test('exception view: security blocked → remediate sdd-security-gate', () => {
  const r = state({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'passed', review: 'passed', security: 'blocked' });
  assert.equal(r.lifecycle.state, 'reviewed');
  assert.equal(r.next.action, 'remediate');
  assert.equal(r.next.skill, 'sdd-security-gate');
});

test('delivery is passed through, not invented', () => {
  const r = state(RUNTIME_CLEARED, { state: 'ci_passed' });
  assert.equal(r.delivery.state, 'ci_passed');
  assert.equal(r.delivery.provider, 'github');
});

test('computeLifecycle is monotonic (breaks at first unreached stage)', () => {
  // review missing while tasks passed → stops at implemented
  const l = computeLifecycle(CFG, index({ proposal: 'approved', impact: IMPACT_NONE, tasks: 'passed' }));
  assert.equal(l.state, 'implemented');
});
