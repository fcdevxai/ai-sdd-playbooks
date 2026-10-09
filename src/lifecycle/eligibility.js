/** Shared evidence eligibility for validation, status, next, and preconditions. */
import { readEvidenceFile, unsafeEvidenceReason } from '../util/fs-safe.js';
import { validateHandoffManifest, assertNormativeManifestAgreement } from '../tokens/handoff.js';
import { validateEvidenceBinding } from '../tokens/binding.js';
import { RECEIPT_REFERENCE_PATH, validateReceiptReference } from '../tokens/receipt.js';
import { validateRuntimeCoverage } from './runtime-coverage.js';
import { validateClosureIndex } from '../tokens/retention.js';
import { validateNamed } from '../schema/validate.js';
import { gateReportIssues } from './report-validation.js';
import matter from '../util/frontmatter.js';
import { resolveSddRepo } from '../repos/config.js';
import { ownRepositoryCapabilities } from './repository-capabilities.js';

const GATES = [
  ['code-review-report.md', 'review'],
  ['security-report.md', 'security'],
  ['runtime-gate-report.md', 'runtime'],
  ['verification-report.md', 'verify'],
];

function mergedDelivery(delivery, manifest) {
  if (delivery?.state !== 'merged') return false;
  return manifest.repositories.every(({ name }) => delivery.per_repo?.some((row) => row.repo === name && row.state === 'merged'));
}

/**
 * Evidence eligibility. With `ci: true` only what a clean checkout can prove is judged:
 * checks needing private receipts, sibling repositories or unavailable history are
 * returned in `localOnly` (never as passed) and never hide a provable failure.
 */
export function inspectEvidence(changeId, { cwd, config, artifacts, delivery, ci = false }) {
  const result = { gates: {}, issues: [], closure: { ok: false }, localOnly: [], afterDelivery: [] };
  // Notes carry a kind: local-only (not provable here) or after-delivery (not applicable on the base branch).
  const file = (name) => (entry) => ({ file: name, ...entry });
  const route = (entries) => {
    for (const entry of entries) (entry.kind === 'after-delivery' ? result.afterDelivery : result.localOnly).push(entry);
  };
  const hasPassedGate = GATES.some(([name]) => ['passed', 'not_applicable'].includes(artifacts[name]?.frontmatter?.status));
  const handoff = validateHandoffManifest(changeId, { cwd, allowCommittedDescendants: true, portable: ci });
  if (!handoff.ok && hasPassedGate) result.issues.push(...handoff.issues);
  if (hasPassedGate) route((handoff.localOnly || []).map(file('handoff-manifest.json')));
  let manifest = null;
  if (handoff.ok) manifest = JSON.parse(readEvidenceFile(cwd, `openspec/changes/${changeId}/handoff-manifest.json`, 'utf8'));
  // Shape and containment are judged first. Only a well-formed reference whose private file is
  // absent from the checkout is "absent"; a malformed, escaping or unsafe one is validated and fails.
  const receiptPresent = (reference) => {
    if (typeof reference?.path !== 'string' || !RECEIPT_REFERENCE_PATH.test(reference.path)) return null;
    return unsafeEvidenceReason(cwd, reference.path) !== 'missing';
  };

  // A sibling repository's own playbook.config.yaml decides its capabilities when it is checked out (F05).
  const sddName = resolveSddRepo({ cwd }).name;
  const ownCapabilities = (name) => ownRepositoryCapabilities(name, { cwd, sddName });
  const pinnedStages = [];

  for (const [name, stage] of GATES) {
    if (artifacts[name]?.readError) {
      result.gates[name] = { ok: false, issues: [artifacts[name].readError] };
      result.issues.push(`${name}: ${artifacts[name].readError}`);
      continue;
    }
    const frontmatter = artifacts[name]?.frontmatter;
    if (!frontmatter || !['passed', 'not_applicable'].includes(frontmatter.status)) continue;
    const issues = [];
    const body = name === 'verification-report.md'
      ? matter(readEvidenceFile(cwd, `openspec/changes/${changeId}/${name}`, 'utf8')).content : null;
    issues.push(...gateReportIssues(changeId, name, frontmatter, body));
    const localOnly = [];
    const checkReceipt = (reference, source) => {
      // Decidable from the report alone, before any private file is needed.
      if (!(source.repositories || []).some((entry) => entry?.name === reference?.repository)) {
        return { ok: false, issues: [`receipt ${reference?.path} names repository ${reference?.repository}, which the report does not cover`] };
      }
      if (ci && receiptPresent(reference) === false) {
        localOnly.push({ file: name, kind: 'local-only', check: `execution receipt ${reference?.path}`, reason: 'private execution receipts are not versioned and are not available in this environment' });
        return { ok: true, issues: [] };
      }
      return validateReceiptReference(reference, { cwd, changeId, stage, source });
    };
    if (!manifest) issues.push('fresh handoff manifest required');
    if (!frontmatter.source_binding) issues.push('source_binding missing');
    const shape = frontmatter.source_binding ? validateNamed('source-binding', frontmatter.source_binding) : { valid: true };
    if (!shape.valid) issues.push(`source_binding invalid: ${shape.errors.join('; ')}`);
    if (manifest && frontmatter.source_binding && shape.valid) {
      try {
        pinnedStages.push({ name, manifest: JSON.parse(readEvidenceFile(cwd, frontmatter.source_binding.manifest_path, 'utf8')) });
      } catch (error) { issues.push(`stage handoff unavailable: ${error.message}`); }
      const binding = validateEvidenceBinding(changeId, name, { cwd, portable: ci });
      issues.push(...binding.issues);
      const notes = (binding.localOnly || []).map(file(name));
      localOnly.push(...notes);
      // An impacted repository evaluated as delivered on its base branch: eligible only with live
      // unanimous merged delivery. A context repository on its own base branch does not deliver this change.
      if (!ci && notes.some((entry) => entry.kind === 'after-delivery' && !entry.context) && !mergedDelivery(delivery, manifest)) {
        issues.push('evaluated on the base branch after delivery: live unanimous merged delivery is required');
      }
      const source = frontmatter.source_binding;
      if (!/^[a-f0-9]{64}$/.test(source.manifest_hash || '')) issues.push('manifest_hash missing or malformed');
      if (!Array.isArray(source.receipts) || source.receipts.length === 0) issues.push('execution receipts missing');
      for (const receipt of source.receipts || []) {
        const checked = checkReceipt(receipt, source);
        issues.push(...checked.issues);
      }
      if (stage === 'runtime') {
        issues.push(...validateRuntimeCoverage(frontmatter, { manifest, config, repositoryCapabilities: ownCapabilities,
          validateReceipt: (reference) => checkReceipt(reference, source) }));
      }
      if (stage === 'verify') {
        if (source.delivery_state !== 'merged' || !mergedDelivery(delivery, manifest)) {
          issues.push('post-merge unanimous delivery required for verification');
        }
      }
    }
    const entry = { ok: issues.length === 0, issues };
    result.gates[name] = entry;
    result.issues.push(...issues.map((issue) => `${name}: ${issue}`));
    route(localOnly);
  }
  const anchor = pinnedStages.find(({ name }) => name === 'verification-report.md') || pinnedStages[0];
  for (const stage of pinnedStages) {
    try { assertNormativeManifestAgreement(stage.manifest, anchor.manifest); }
    catch (error) {
      result.gates[stage.name].ok = false;
      result.gates[stage.name].issues.push(error.message);
      result.issues.push(`${stage.name}: ${error.message}`);
    }
  }
  // A closure is valid only when every gate, not just verification, is cleared and eligible (F05).
  result.closure = { ok: GATES.every(([name]) => result.gates[name]?.ok === true)
    && mergedDelivery(delivery, manifest || { repositories: [] })
    && validateClosureIndex(changeId, { cwd }).ok };
  if (artifacts['proposal.md']?.frontmatter?.status === 'archived' && !result.closure.ok) {
    result.issues.push('archived proposal has no valid retained post-merge closure');
  }
  return result;
}
