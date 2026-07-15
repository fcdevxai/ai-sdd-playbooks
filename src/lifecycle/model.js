/**
 * Lifecycle + delivery state model (design §3) — data only, no logic.
 *
 * Two independent dimensions:
 *   - lifecycle: methodological, computed from local artifacts (§3.1/§3.3)
 *   - delivery:  local Git + GitHub, supplied to the engine as input (§3.2)
 *
 * `sdd-enrich-us` is a pre-process with no lifecycle state (C-02).
 * `failed`/`blocked` are exception views, not linear states (§3.5).
 */

export const LIFECYCLE_STATES = [
  'none', // no proposal yet (pre-process / before sdd-new)
  'proposal_draft',
  'proposal_approved',
  'designed',
  'planned',
  'implementing',
  'implemented',
  'reviewed',
  'security_cleared',
  'runtime_cleared',
  'verified',
  'archived',
];

// Ordered stages the engine walks to find the furthest-reached state.
export const LIFECYCLE_ORDER = [
  'proposal_draft', 'proposal_approved', 'designed', 'planned', 'implementing',
  'implemented', 'reviewed', 'security_cleared', 'runtime_cleared', 'verified',
];

export const DELIVERY_STATES = [
  'uncommitted', 'committed', 'pr_open', 'ci_pending', 'ci_passed', 'ci_failed', 'merged', 'unknown',
];

export const EXCEPTION_STATUSES = ['failed', 'blocked'];

// Next action per lifecycle state (when no exception; runtime_cleared defers to delivery).
export const LIFECYCLE_NEXT = {
  none: { action: 'run_skill', skill: 'sdd-new' },
  proposal_draft: { action: 'await_human', reason: 'set proposal.status: approved' },
  proposal_approved: { action: 'run_skill', skill: 'sdd-design' },
  designed: { action: 'run_skill', skill: 'sdd-plan' },
  planned: { action: 'run_skill', skill: 'sdd-apply' },
  implementing: { action: 'run_skill', skill: 'sdd-apply' },
  implemented: { action: 'run_skill', skill: 'sdd-code-review' },
  reviewed: { action: 'run_skill', skill: 'sdd-security-gate' },
  security_cleared: { action: 'run_skill', skill: 'sdd-runtime-gate' },
  verified: { action: 'run_skill', skill: 'sdd-archive' },
  archived: { action: 'done' },
};

// Next action at runtime_cleared, keyed by delivery state (§3.4).
export const DELIVERY_NEXT = {
  uncommitted: { action: 'run_skill', skill: 'sdd-commit' },
  committed: { action: 'run_skill', skill: 'sdd-commit', reason: 'push and open the pull request' },
  pr_open: { action: 'wait_for_github_ci' },
  ci_pending: { action: 'wait_for_github_ci' },
  ci_failed: { action: 'blocked', reason: 'GITHUB_CI_FAILED' },
  ci_passed: { action: 'merge', reason: 'awaiting human merge' },
  merged: { action: 'run_skill', skill: 'sdd-verify' },
  unknown: { action: 'blocked', reason: 'GITHUB_CONTEXT_UNAVAILABLE' },
};

// Which skill remediates a failed/blocked artifact (exception view, §3.5).
export const REMEDIATION_SKILL = {
  'tasks.md': 'sdd-apply',
  'code-review-report.md': 'sdd-code-review',
  'security-report.md': 'sdd-security-gate',
  'runtime-gate-report.md': 'sdd-runtime-gate',
  'verification-report.md': 'sdd-verify',
};
