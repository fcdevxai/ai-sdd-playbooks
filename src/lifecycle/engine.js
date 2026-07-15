/**
 * Deterministic lifecycle engine (design §3) — PURE.
 *
 *   computeState(config, lock, artifactIndex, deliveryStatus)
 *     → { lifecycle, delivery, next, exception? }
 *
 * No filesystem, model, or network calls. `deliveryStatus` is an INPUT supplied
 * by the caller (from src/github in a later phase, or `unknown`). The CLI —
 * never the language model — is the authority on state and next step.
 */
import { computeDesignRequired } from './impact.js';
import {
  LIFECYCLE_ORDER, EXCEPTION_STATUSES, LIFECYCLE_NEXT, DELIVERY_NEXT, REMEDIATION_SKILL,
} from './model.js';

function statusOf(index, name) {
  return index[name] && index[name].frontmatter && index[name].frontmatter.status;
}

export function computeLifecycle(config, artifactIndex) {
  const proposal = artifactIndex['proposal.md'];
  if (!proposal) return { state: 'none', design_required: false, reached: {} };

  const proposalFm = proposal.frontmatter || {};
  const designRequired = computeDesignRequired(proposalFm, config);

  if (proposalFm.status === 'archived') {
    return { state: 'archived', design_required: designRequired, reached: {} };
  }

  const s = (name) => statusOf(artifactIndex, name);
  const reached = {};
  reached.proposal_draft = true;
  reached.proposal_approved = proposalFm.status === 'approved';
  reached.designed = reached.proposal_approved
    && (designRequired === false || ['approved', 'not_applicable'].includes(s('design.md')));
  reached.planned = reached.designed && ['ready', 'in_progress', 'passed'].includes(s('tasks.md'));
  reached.implementing = reached.planned && ['in_progress', 'passed'].includes(s('tasks.md'));
  reached.implemented = reached.planned && s('tasks.md') === 'passed';
  reached.reviewed = reached.implemented && s('code-review-report.md') === 'passed';
  reached.security_cleared = reached.reviewed
    && ['passed', 'not_applicable'].includes(s('security-report.md'));
  reached.runtime_cleared = reached.security_cleared
    && ['passed', 'not_applicable'].includes(s('runtime-gate-report.md'));
  reached.verified = reached.runtime_cleared && s('verification-report.md') === 'passed';

  let state = 'none';
  for (const stage of LIFECYCLE_ORDER) {
    if (reached[stage]) state = stage;
    else break;
  }
  return { state, design_required: designRequired, reached, design_status: s('design.md') };
}

function findException(artifactIndex) {
  for (const [name, a] of Object.entries(artifactIndex)) {
    const st = a && a.frontmatter && a.frontmatter.status;
    if (EXCEPTION_STATUSES.includes(st)) return { artifact: name, status: st };
  }
  return null;
}

function computeNext(lifecycle, deliveryState, exception) {
  if (exception) {
    return {
      action: 'remediate',
      skill: REMEDIATION_SKILL[exception.artifact] || null,
      reason: `${exception.artifact} is ${exception.status}`,
    };
  }
  // design written but awaiting human sign-off → don't re-run sdd-design (symmetric with proposal approval)
  if (lifecycle.state === 'proposal_approved' && lifecycle.design_required && lifecycle.design_status === 'draft') {
    return { action: 'await_human', reason: 'approve design.md (set status: approved)' };
  }
  if (lifecycle.state === 'runtime_cleared') {
    return DELIVERY_NEXT[deliveryState] || DELIVERY_NEXT.unknown;
  }
  return LIFECYCLE_NEXT[lifecycle.state] || { action: 'unknown' };
}

// eslint-disable-next-line no-unused-vars -- `lock` is part of the design signature (doctor uses it)
export function computeState(config, lock, artifactIndex, deliveryStatus = { state: 'unknown' }) {
  const lifecycle = computeLifecycle(config, artifactIndex);
  const exception = findException(artifactIndex);

  const delivery = { provider: 'github', state: (deliveryStatus && deliveryStatus.state) || 'unknown' };
  if (deliveryStatus && deliveryStatus.blocked_reason) delivery.blocked_reason = deliveryStatus.blocked_reason;

  const next = computeNext(lifecycle, delivery.state, exception);

  const result = {
    lifecycle: { state: lifecycle.state, design_required: lifecycle.design_required },
    delivery,
    next,
  };
  if (exception) result.exception = exception;
  return result;
}
