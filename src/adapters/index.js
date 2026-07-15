/**
 * Runtime-gate adapters (design §7, C-06).
 *
 * Applicability comes from project capabilities. An incomplete adapter must
 * BLOCK — never fabricate `passed`:
 *   - capability false                              → not_applicable
 *   - capability true, supported adapter            → pending (skill runs it with evidence)
 *   - capability true, experimental adapter         → blocked: ADAPTER_NOT_IMPLEMENTED
 * A supported adapter whose dependency is missing or whose evidence is
 * insufficient is set to `blocked` by the skill (DEPENDENCY_UNAVAILABLE /
 * INSUFFICIENT_EVIDENCE) — the descriptors below name those reason codes.
 */
import browser from './browser.js';
import http from './http.js';
import cli from './cli.js';
import worker from './worker.js';

export const ADAPTERS = { browser, http, cli, worker };

export const REASON_CODES = {
  ADAPTER_NOT_IMPLEMENTED: 'ADAPTER_NOT_IMPLEMENTED',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
};

/** Deterministic starting plan from capabilities. Supported→pending, experimental→blocked. */
export function planRuntimeAdapters(capabilities = {}) {
  const plan = {};
  for (const [key, desc] of Object.entries(ADAPTERS)) {
    if (!capabilities[desc.capability]) {
      plan[key] = { status: 'not_applicable' };
    } else if (desc.support === 'experimental') {
      plan[key] = { status: 'blocked', reason_code: REASON_CODES.ADAPTER_NOT_IMPLEMENTED };
    } else {
      plan[key] = { status: 'pending' };
    }
  }
  return plan;
}

/** Aggregate a report's per-adapter statuses into the gate status. */
export function gateStatusFromAdapters(adapters = {}) {
  const applicable = Object.values(adapters)
    .map((a) => a && a.status)
    .filter((s) => s && s !== 'not_applicable');
  if (applicable.length === 0) return 'not_applicable';
  if (applicable.includes('blocked')) return 'blocked';
  if (applicable.includes('failed')) return 'failed';
  if (applicable.includes('pending')) return 'blocked'; // incomplete → not passable
  return 'passed';
}
