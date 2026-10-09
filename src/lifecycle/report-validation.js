/** One gate-report contract for CLI validation and evidence eligibility. */
import { validateNamed } from '../schema/validate.js';
import { validateVerificationBody } from '../schema/body-rules.js';
import { gateStatusFromAdapters } from '../adapters/index.js';

export const REPORT_SCHEMAS = {
  'code-review-report.md': 'code-review-report',
  'security-report.md': 'security-report',
  'runtime-gate-report.md': 'runtime-gate-report',
  'verification-report.md': 'verification-report',
};

export function gateReportIssues(changeId, name, frontmatter, body = null) {
  const expected = REPORT_SCHEMAS[name];
  if (!expected) return [`unknown gate report ${name}`];
  const issues = [];
  if (frontmatter?.schema !== expected) issues.push(`expected ${expected} schema for ${name}`);
  const shape = validateNamed(expected, frontmatter || {});
  if (!shape.valid) issues.push(...shape.errors);
  if (frontmatter?.change_id !== changeId) issues.push(`${name} change_id differs from ${changeId}`);
  if (name === 'runtime-gate-report.md' && frontmatter?.adapters
    && frontmatter.status !== gateStatusFromAdapters(frontmatter.adapters)) {
    issues.push('runtime gate status disagrees with adapters aggregate');
  }
  if (name === 'verification-report.md' && body !== null) issues.push(...validateVerificationBody(body).issues);
  return issues;
}
