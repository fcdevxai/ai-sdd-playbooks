/**
 * Per-skill precondition evaluation (design §3.6).
 *
 * Pure: `evaluatePreconditions(requires, ctx)` takes a `requires` spec and a
 * context and returns { met, missing[] }. The lifecycle engine (a later phase)
 * and `sdd validate --precondition` both use this.
 *
 * A `requires.artifacts[name]` entry may carry `when: 'design_required'`, which
 * means the requirement is enforced only when `ctx.design_required` is true —
 * a skipped design needs no `design.md` (C-03/C-07).
 */

// Precondition contracts for the lifecycle skills that gate on artifact state.
// These mirror design §2.2 / §3.6; the authored SKILL.md files (Phase 5/6) will
// carry the same `requires` blocks in their frontmatter.
export const SKILL_PRECONDITIONS = {
  'sdd-plan': {
    artifacts: {
      'proposal.md': { status: 'approved' },
      'design.md': { status: ['approved', 'not_applicable'], when: 'design_required' },
    },
  },
  'sdd-apply': {
    artifacts: {
      'proposal.md': { status: 'approved' },
      'design.md': { status: ['approved', 'not_applicable'], when: 'design_required' },
      'tasks.md': { status: 'ready' },
    },
  },
};

function asList(v) {
  return Array.isArray(v) ? v : [v];
}

export function evaluatePreconditions(requires, ctx) {
  const missing = [];
  const artifacts = (ctx && ctx.artifacts) || {};
  const capabilities = (ctx && ctx.capabilities) || {};
  const designRequired = !!(ctx && ctx.design_required);

  for (const [name, spec] of Object.entries((requires && requires.artifacts) || {})) {
    if (spec.when === 'design_required' && !designRequired) continue; // skipped
    const actual = artifacts[name] && artifacts[name].status;
    const allowed = asList(spec.status);
    if (actual === undefined) {
      missing.push(`${name} is required (status ${allowed.join('|')}) but is missing`);
    } else if (!allowed.includes(actual)) {
      missing.push(`${name}.status is '${actual}', expected ${allowed.join('|')}`);
    }
  }

  for (const cap of (requires && requires.capabilities) || []) {
    if (!capabilities[cap]) missing.push(`capability '${cap}' is required but not enabled`);
  }

  return { met: missing.length === 0, missing };
}
