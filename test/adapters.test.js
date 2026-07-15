import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADAPTERS, REASON_CODES, planRuntimeAdapters, gateStatusFromAdapters } from '../src/adapters/index.js';

test('adapter support levels: browser/http supported, cli/worker experimental (C-06)', () => {
  assert.equal(ADAPTERS.browser.support, 'supported');
  assert.equal(ADAPTERS.http.support, 'supported');
  assert.equal(ADAPTERS.cli.support, 'experimental');
  assert.equal(ADAPTERS.worker.support, 'experimental');
  assert.equal(ADAPTERS.browser.dependency, 'playwright-mcp');
});

test('planRuntimeAdapters: capability false → not_applicable; supported → pending', () => {
  const plan = planRuntimeAdapters({ browser: true, http: true, cli: false, worker: false });
  assert.deepEqual(plan.browser, { status: 'pending' });
  assert.deepEqual(plan.http, { status: 'pending' });
  assert.deepEqual(plan.cli, { status: 'not_applicable' });
  assert.deepEqual(plan.worker, { status: 'not_applicable' });
});

test('planRuntimeAdapters: experimental adapter with capability true → blocked (never passed)', () => {
  const plan = planRuntimeAdapters({ worker: true, cli: true });
  assert.equal(plan.worker.status, 'blocked');
  assert.equal(plan.worker.reason_code, REASON_CODES.ADAPTER_NOT_IMPLEMENTED);
  assert.equal(plan.cli.status, 'blocked');
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
