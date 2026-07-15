/**
 * Security risk classification + gate helpers (design §6, C-04).
 *
 * Pure functions shared by the sdd-security-gate skill and the CLI:
 *   - classifyRisk: capabilities alone never elevate (http:true is NOT elevated
 *     by itself); any declared trigger warrants elevated scrutiny.
 *   - reconcileRisk: the gate may RAISE risk but never lowers an approved one.
 *   - gateStatusFromFindings: blocking finding → blocked; low risk → not_applicable.
 */

export const RISK_ORDER = ['low', 'standard', 'elevated'];

export const SECURITY_DISCLAIMER =
  'This gate is an automated pre-check and does not replace a penetration test or a human security audit.';

function idx(risk) {
  const i = RISK_ORDER.indexOf(risk);
  return i < 0 ? RISK_ORDER.indexOf('standard') : i;
}

export function maxRisk(a, b) {
  return RISK_ORDER[Math.max(idx(a), idx(b))];
}

/**
 * Classify risk from declared triggers. `capabilities` is accepted but
 * intentionally ignored for elevation: a capability like `http` never makes a
 * change elevated on its own (C-04). Any declared trigger → elevated scrutiny.
 */
export function classifyRisk({ capabilities = {}, triggers = [], defaultRisk = 'standard' } = {}) {
  void capabilities;
  if (!Array.isArray(triggers) || triggers.length === 0) return defaultRisk;
  return maxRisk(defaultRisk, 'elevated');
}

/** The gate may raise risk (declared vs detected) but never lowers it. */
export function reconcileRisk(declaredRisk, detectedRisk) {
  return maxRisk(declaredRisk, detectedRisk);
}

/** Normalized gate status from risk + structured findings. */
export function gateStatusFromFindings(risk, findings = []) {
  if (Array.isArray(findings) && findings.some((f) => f && f.blocking)) return 'blocked';
  if (risk === 'low') return 'not_applicable';
  return 'passed';
}
