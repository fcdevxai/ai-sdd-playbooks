import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADAPTERS, REASON_CODES, planRuntimeAdapters, gateStatusFromAdapters } from '../src/adapters/index.js';

test('adapter support levels: browser/http/worker supported, cli experimental (C-06)', () => {
  assert.equal(ADAPTERS.browser.support, 'supported');
  assert.equal(ADAPTERS.http.support, 'supported');
  assert.equal(ADAPTERS.cli.support, 'experimental');
  assert.equal(ADAPTERS.worker.support, 'supported');
  assert.equal(ADAPTERS.browser.dependency, 'playwright-mcp');
});

test('planRuntimeAdapters: capability false → not_applicable; supported → pending', () => {
  const plan = planRuntimeAdapters({ browser: true, http: true, cli: false, worker: false });
  assert.deepEqual(plan.browser, { status: 'pending' });
  assert.deepEqual(plan.http, { status: 'pending' });
  assert.deepEqual(plan.cli, { status: 'not_applicable' });
  assert.deepEqual(plan.worker, { status: 'not_applicable' });
});

test('planRuntimeAdapters: experimental cli with capability true → blocked (never passed)', () => {
  const plan = planRuntimeAdapters({ worker: false, cli: true });
  assert.equal(plan.cli.status, 'blocked');
  assert.equal(plan.cli.reason_code, REASON_CODES.ADAPTER_NOT_IMPLEMENTED);
});

test('planRuntimeAdapters: supported worker with capability true → pending', () => {
  const plan = planRuntimeAdapters({ worker: true, cli: false });
  assert.deepEqual(plan.worker, { status: 'pending' });
  assert.deepEqual(plan.cli, { status: 'not_applicable' });
});

test('gateStatusFromAdapters aggregates correctly', () => {
  assert.equal(gateStatusFromAdapters({ browser: { status: 'passed' }, cli: { status: 'not_applicable' } }), 'passed');
  assert.equal(gateStatusFromAdapters({ cli: { status: 'not_applicable' }, worker: { status: 'not_applicable' } }), 'not_applicable');
  assert.equal(gateStatusFromAdapters({ browser: { status: 'passed' }, worker: { status: 'blocked' } }), 'blocked');
  assert.equal(gateStatusFromAdapters({ http: { status: 'failed' } }), 'failed');
  assert.equal(gateStatusFromAdapters({ http: { status: 'pending' } }), 'blocked'); // incomplete
});

test('none applicable → not_applicable (backend-only project with no runtime capabilities)', () => {
  const plan = planRuntimeAdapters({ browser: false, http: false, cli: false, worker: false });
  assert.equal(gateStatusFromAdapters(plan), 'not_applicable');
});

test('planRuntimeAdapters: no relevantCapabilities arg → byte-identical to today (backward compat)', () => {
  const capabilities = { browser: true, http: true, cli: true, worker: true };
  assert.deepEqual(planRuntimeAdapters(capabilities), planRuntimeAdapters(capabilities, null));
  assert.deepEqual(planRuntimeAdapters(capabilities, undefined), planRuntimeAdapters(capabilities));
});

test('planRuntimeAdapters: relevantCapabilities excludes an enabled experimental capability → not_applicable, not blocked', () => {
  const plan = planRuntimeAdapters({ worker: true, cli: true }, ['cli']);
  assert.deepEqual(plan.worker, { status: 'not_applicable', reason_code: REASON_CODES.NOT_RELEVANT_TO_CHANGE });
  // cli IS relevant here, so it keeps its normal (blocked) outcome
  assert.equal(plan.cli.status, 'blocked');
  assert.equal(plan.cli.reason_code, REASON_CODES.ADAPTER_NOT_IMPLEMENTED);
});

test('planRuntimeAdapters: relevantCapabilities excludes an enabled supported capability → not_applicable, not pending', () => {
  const plan = planRuntimeAdapters({ browser: true, http: true }, ['browser']);
  assert.equal(plan.browser.status, 'pending'); // browser IS relevant
  assert.deepEqual(plan.http, { status: 'not_applicable', reason_code: REASON_CODES.NOT_RELEVANT_TO_CHANGE });
});

test('planRuntimeAdapters: relevantCapabilities never affects an already-disabled (false) capability', () => {
  const plan = planRuntimeAdapters({ worker: false }, []);
  assert.deepEqual(plan.worker, { status: 'not_applicable' }); // no reason_code — plain "project doesn't have it"
});

test('a change excluding worker can reach a passing gate (fixes the permanent deadlock)', () => {
  const plan = planRuntimeAdapters({ browser: true, http: true, cli: false, worker: true }, ['browser', 'http']);
  assert.equal(plan.worker.status, 'not_applicable'); // excluded — can never force `blocked` for this change
  assert.equal(plan.cli.status, 'not_applicable'); // capability false anyway
  // once real evidence turns the relevant adapters to `passed`, the gate itself can pass —
  // something a project with worker: true could never do before this change
  const evidenced = { ...plan, browser: { status: 'passed' }, http: { status: 'passed' } };
  assert.equal(gateStatusFromAdapters(evidenced), 'passed');
});
