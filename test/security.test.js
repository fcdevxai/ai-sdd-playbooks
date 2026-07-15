import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRisk, reconcileRisk, gateStatusFromFindings, maxRisk, SECURITY_DISCLAIMER,
} from '../src/security/classify.js';

test('http capability alone does NOT classify as elevated (C-04, T7.1)', () => {
  const risk = classifyRisk({ capabilities: { http: true }, triggers: [], defaultRisk: 'standard' });
  assert.notEqual(risk, 'elevated');
  assert.equal(risk, 'standard');
});

test('any declared trigger warrants elevated scrutiny', () => {
  assert.equal(classifyRisk({ triggers: ['authorization'], defaultRisk: 'standard' }), 'elevated');
  assert.equal(classifyRisk({ triggers: ['secrets'], defaultRisk: 'low' }), 'elevated');
});

test('no triggers keeps the default risk', () => {
  assert.equal(classifyRisk({ triggers: [], defaultRisk: 'low' }), 'low');
  assert.equal(classifyRisk({ triggers: [], defaultRisk: 'standard' }), 'standard');
});

test('reconcileRisk raises but never lowers (T7.2)', () => {
  assert.equal(reconcileRisk('standard', 'elevated'), 'elevated'); // raised
  assert.equal(reconcileRisk('elevated', 'low'), 'elevated'); // not lowered
  assert.equal(reconcileRisk('low', 'standard'), 'standard');
});

test('maxRisk is order-correct and tolerant of unknowns', () => {
  assert.equal(maxRisk('low', 'elevated'), 'elevated');
  assert.equal(maxRisk('bogus', 'low'), 'standard'); // unknown treated as standard
});

test('gateStatusFromFindings: blocking → blocked; low → not_applicable; else passed', () => {
  assert.equal(gateStatusFromFindings('elevated', [{ blocking: true }]), 'blocked');
  assert.equal(gateStatusFromFindings('low', []), 'not_applicable');
  assert.equal(gateStatusFromFindings('low', [{ blocking: true }]), 'blocked'); // blocking wins over low
  assert.equal(gateStatusFromFindings('standard', [{ blocking: false }]), 'passed');
  assert.equal(gateStatusFromFindings('elevated', []), 'passed');
});

test('the non-replacement disclaimer exists and mentions penetration test', () => {
  assert.match(SECURITY_DISCLAIMER, /penetration test/i);
});
