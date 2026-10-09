/** Construct a gate report's source binding from actual manifests and receipts. */
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { validateHandoffManifest, governedManifestHash } from './handoff.js';
import { validateReceiptReference } from './receipt.js';
import { sha256 } from './evidence.js';
import { readEvidenceFile, writeEvidenceFile } from '../util/fs-safe.js';
import { resolveMultiRepoDelivery } from '../repos/delivery.js';
import { gateReportIssues } from '../lifecycle/report-validation.js';
import { validateRuntimeCoverage } from '../lifecycle/runtime-coverage.js';
import { ownRepositoryCapabilities } from '../lifecycle/repository-capabilities.js';
import { loadConfig } from '../config/config.js';
import { resolveSddRepo } from '../repos/config.js';

export const REPORT_STAGES = {
  'code-review-report.md': 'review',
  'security-report.md': 'security',
  'runtime-gate-report.md': 'runtime',
  'verification-report.md': 'verify',
};

/** Apply the same runtime semantics before any operation can create cleared evidence. */
export function assertRuntimeReport(changeId, reportName, report, { cwd, manifest, source }) {
  if (REPORT_STAGES[reportName] !== 'runtime') return;
  const config = loadConfig({ cwd }).config;
  const sddName = resolveSddRepo({ cwd }).name;
  const issues = validateRuntimeCoverage(report, { manifest, config,
    repositoryCapabilities: name => ownRepositoryCapabilities(name, { cwd, sddName }),
    validateReceipt: reference => validateReceiptReference(reference, { cwd, changeId, stage: 'runtime', source }) });
  if (issues.length) throw new Error(`invalid runtime coverage: ${issues.join('; ')}`);
}

export function sealReport(changeId, reportName, { cwd = process.cwd(), receipts = [], delivery = null } = {}) {
  const stage = REPORT_STAGES[reportName];
  if (!stage || !/^[a-z0-9][a-z0-9._-]*$/.test(changeId)) throw new Error('invalid change or gate report');
  const check = validateHandoffManifest(changeId, { cwd });
  if (!check.ok) throw new Error(`handoff invalid: ${check.issues.join('; ')}`);
  if ((check.localOnly || []).length) throw new Error('handoff is not current here (evaluated after delivery or partially); regenerate the packet on the evaluated commit before sealing');
  const manifestBytes = readEvidenceFile(cwd, `openspec/changes/${changeId}/handoff-manifest.json`);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.stage !== `sdd-${stage === 'review' ? 'code-review' : stage === 'security' ? 'security-gate' : stage === 'runtime' ? 'runtime-gate' : 'verify'}`) {
    throw new Error(`handoff stage ${manifest.stage} does not match ${reportName}`);
  }
  const reportPath = path.join(cwd, 'openspec', 'changes', changeId, reportName);
  const parsed = matter(readEvidenceFile(cwd, `openspec/changes/${changeId}/${reportName}`, 'utf8'));
  const reportIssues = gateReportIssues(changeId, reportName, parsed.data, parsed.content);
  if (reportIssues.length) throw new Error(`invalid gate report: ${reportIssues.join('; ')}`);
  if (!['passed', 'not_applicable'].includes(parsed.data.status)) throw new Error('only cleared gate reports can be sealed');
  if (parsed.data.source_binding) throw new Error('report already has source_binding; refusing overwrite');
  if (!Array.isArray(receipts) || receipts.length === 0) throw new Error('at least one execution receipt is required');
  const deliveryState = delivery || resolveMultiRepoDelivery({ cwd, slug: changeId });
  if (stage === 'verify' && (deliveryState.state !== 'merged'
    || manifest.repositories.some(({ name }) => !deliveryState.per_repo?.some((row) => row.repo === name && row.state === 'merged')))) {
    throw new Error('verification seal requires unanimous merged delivery');
  }
  const source = {
    manifest_path: `openspec/changes/${changeId}/handoff-manifest-${manifest.stage}-${sha256(manifestBytes)}.json`,
    manifest_hash: sha256(manifestBytes),
    governed_manifest_hash: governedManifestHash(manifest),
    repositories: manifest.repositories.map(({ name, branch, commit_sha, source_hash, tree_hash }) => ({ name, branch, commit_sha, source_hash, ...(tree_hash ? { tree_hash } : {}) })),
    proposal_hash: manifest.requirement.hash, design_hash: manifest.design?.hash || 'unknown',
    normative_tasks_hash: manifest.tasks.normative_hash,
    contract_hashes: manifest.contracts.map(({ path: file, content_hash }) => ({ path: file, hash: content_hash })),
    receipts: [], delivery_state: deliveryState.state,
  };
  for (const receiptPath of receipts) {
    const relative = path.isAbsolute(receiptPath) ? path.relative(cwd, receiptPath) : receiptPath;
    if (!relative.startsWith('.specloom/runs/')) throw new Error(`receipt path outside private run store: ${receiptPath}`);
    const bytes = readEvidenceFile(cwd, relative);
    const raw = JSON.parse(bytes.toString('utf8'));
    const reference = { repository: raw.repository?.name, path: relative, sha256: sha256(bytes) };
    const verified = validateReceiptReference(reference, { cwd, changeId, stage, source });
    if (!verified.ok) throw new Error(`ineligible receipt: ${verified.issues.join('; ')}`);
    source.receipts.push(reference);
  }
  assertRuntimeReport(changeId, reportName, parsed.data, { cwd, manifest, source });
  const frontmatter = { ...parsed.data, source_binding: source };
  writeEvidenceFile(cwd, `openspec/changes/${changeId}/${reportName}`, matter.stringify(parsed.content, frontmatter));
  return { report: reportPath, source_binding: source };
}
