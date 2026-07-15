import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePreconditions, SKILL_PRECONDITIONS } from '../src/lifecycle/preconditions.js';

const applied = SKILL_PRECONDITIONS['sdd-apply'];
const planned = SKILL_PRECONDITIONS['sdd-plan'];

test('sdd-apply: met when proposal approved, design approved, tasks ready (design required)', () => {
  const ctx = {
    design_required: true,
    artifacts: {
      'proposal.md': { status: 'approved' },
      'design.md': { status: 'approved' },
      'tasks.md': { status: 'ready' },
    },
  };
  assert.equal(evaluatePreconditions(applied, ctx).met, true);
});

test('sdd-apply: unmet when tasks not ready', () => {
  const ctx = {
    design_required: true,
    artifacts: {
      'proposal.md': { status: 'approved' },
      'design.md': { status: 'approved' },
      'tasks.md': { status: 'draft' },
    },
  };
  const r = evaluatePreconditions(applied, ctx);
  assert.equal(r.met, false);
  assert.match(r.missing.join('\n'), /tasks\.md/);
});

test('sdd-apply: design requirement is skipped when design_required is false (C-03/C-07)', () => {
  const ctx = {
    design_required: false,
    artifacts: {
      'proposal.md': { status: 'approved' },
      // no design.md at all
      'tasks.md': { status: 'ready' },
    },
  };
  assert.equal(evaluatePreconditions(applied, ctx).met, true);
});

test('sdd-apply: design required but missing → unmet', () => {
  const ctx = {
    design_required: true,
    artifacts: {
      'proposal.md': { status: 'approved' },
      'tasks.md': { status: 'ready' },
    },
  };
  const r = evaluatePreconditions(applied, ctx);
  assert.equal(r.met, false);
  assert.match(r.missing.join('\n'), /design\.md/);
});

test('sdd-plan: design not_applicable satisfies the design requirement', () => {
  const ctx = {
    design_required: true,
    artifacts: {
      'proposal.md': { status: 'approved' },
      'design.md': { status: 'not_applicable' },
    },
  };
  assert.equal(evaluatePreconditions(planned, ctx).met, true);
});

test('capabilities are enforced when required', () => {
  const requires = { capabilities: ['browser'] };
  assert.equal(evaluatePreconditions(requires, { capabilities: { browser: true } }).met, true);
  assert.equal(evaluatePreconditions(requires, { capabilities: { browser: false } }).met, false);
});
