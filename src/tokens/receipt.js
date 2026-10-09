/** Private execution receipts with observed source and declared actor identity. */
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { validateNamed } from '../schema/validate.js';
import { validateHandoffManifest } from './handoff.js';
import { sha256, snapshotRepository } from './evidence.js';
import { readEvidenceFile } from '../util/fs-safe.js';

function declaredSourcePaths(hubCwd, changeId, repoName) {
  const relative = `openspec/changes/${changeId}/tasks.md`;
  if (!fs.lstatSync(path.join(hubCwd, relative), { throwIfNoEntry: false })) return [];
  const tasks = matter(readEvidenceFile(hubCwd, relative, 'utf8')).data;
  return tasks.handoff?.source_paths?.[repoName] || [];
}

export function observeSource({ repoRoot, hubCwd, changeId, repoName }) {
  try {
    const snapshot = snapshotRepository({ root: repoRoot, changeId, untrackedPaths: declaredSourcePaths(hubCwd, changeId, repoName) });
    if (snapshot.branch === null) return { ...snapshot, branch: 'unknown', issue: 'SOURCE_UNAVAILABLE: detached HEAD' };
    return { ...snapshot, issue: null };
  } catch (error) {
    return { branch: 'unknown', commit_sha: 'unknown', source_hash: 'unknown', issue: `SOURCE_UNAVAILABLE: ${error.message}` };
  }
}

export function manifestContext(hubCwd, changeId) {
  const relative = `openspec/changes/${changeId}/handoff-manifest.json`;
  if (!fs.lstatSync(path.join(hubCwd, relative), { throwIfNoEntry: false })) return { manifest: null, hash: 'unknown', issue: 'MANIFEST_UNAVAILABLE' };
  try {
    const bytes = readEvidenceFile(hubCwd, relative);
    const hash = sha256(bytes);
    const manifest = JSON.parse(bytes.toString('utf8'));
    const validation = validateHandoffManifest(changeId, { cwd: hubCwd });
    return { manifest, hash, issue: validation.ok ? null : 'MANIFEST_STALE' };
  } catch {
    return { manifest: null, hash: 'unknown', issue: 'MANIFEST_INVALID' };
  }
}

function rawEntry(entry, runDir) {
  if (!entry) return null;
  const relative = path.relative(runDir, entry.path);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`raw evidence path escapes run directory: ${entry.path}`);
  if (!fs.existsSync(entry.path) || fs.statSync(entry.path).size !== entry.bytes) {
    throw new Error(`raw evidence missing or incomplete: ${entry.path}`);
  }
  return { path: relative, bytes: entry.bytes, sha256: entry.sha256 };
}

export function writeExecutionReceipt({ runDir, argv, cwd, hubCwd = cwd, repoName = path.basename(cwd),
  changeId = 'unknown', stage = 'manual', agent = 'unknown', provider = 'unknown', model = 'unknown',
  container = 'unknown', before, after, rawFiles, startedAt, endedAt, exitCode, signal = null,
  captureError = null, summary, manifestBefore = null }) {
  const context = manifestContext(hubCwd, changeId);
  const issues = [
    ...(agent === 'unknown' ? ['AGENT_UNAVAILABLE'] : []),
    ...(provider === 'unknown' ? ['PROVIDER_UNAVAILABLE'] : []),
    ...(model === 'unknown' ? ['MODEL_UNAVAILABLE'] : []),
    ...(before.issue ? [before.issue] : []),
    ...(after.issue ? [after.issue] : []),
    ...(context.issue ? [context.issue] : []),
  ];
  const changed = before.commit_sha !== after.commit_sha || before.source_hash !== after.source_hash;
  if (changed) issues.push('SOURCE_CHANGED_DURING_RUN');
  // The governed artifacts the receipt records must be those in force for the whole run (F04, R2).
  if (manifestBefore) {
    if (manifestBefore.hash !== context.hash) issues.push('MANIFEST_CHANGED_DURING_RUN');
    else if (['MANIFEST_STALE', 'MANIFEST_INVALID'].includes(manifestBefore.issue) && !issues.includes(manifestBefore.issue)) issues.push(manifestBefore.issue);
  }
  const manifest = context.manifest;
  const raw = { full: rawEntry(rawFiles.combined, runDir) };
  if (rawFiles.stdout) raw.stdout = rawEntry(rawFiles.stdout, runDir);
  if (rawFiles.stderr) raw.stderr = rawEntry(rawFiles.stderr, runDir);
  const receipt = {
    schema: 'execution-receipt', schema_version: 1, run_id: path.basename(runDir),
    change_id: changeId, stage,
    repository: { name: repoName, branch: before.branch, commit_sha: before.commit_sha, source_hash: before.source_hash },
    actor: { agent, provider, model, provenance: agent === 'unknown' ? 'unavailable' : 'caller_declared', identity_issues: issues },
    command: { argv, cwd },
    environment: { platform: process.platform, runtime: process.version, container },
    started_at: startedAt, ended_at: endedAt, exit_code: exitCode, signal,
    capture_error: captureError, summary,
    raw,
    artifacts: {
      proposal_hash: manifest?.requirement?.hash || 'unknown',
      tasks_hash: manifest?.tasks?.hash || 'unknown',
      normative_tasks_hash: manifest?.tasks?.normative_hash || 'unknown',
      contract_hashes: (manifest?.contracts || []).map((entry) => ({ path: entry.path, hash: entry.content_hash })),
    },
    manifest_hash: context.hash,
    source_changed_during_run: changed,
    identity_issues: issues,
  };
  const validation = validateNamed('execution-receipt', receipt);
  if (!validation.valid) throw new Error(`invalid execution receipt: ${validation.errors.join('; ')}`);
  const file = path.join(runDir, 'execution-receipt.json');
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { path: file, receipt };
}

/** Why a validated receipt cannot count as evidence, or null when it is eligible. */
export function receiptIneligibility(receipt) {
  if (receipt.capture_error) return 'receipt records an evidence capture error';
  if (receipt.signal) return `receipt records termination by signal ${receipt.signal}`;
  const unavailableSource = (receipt.identity_issues || []).find((issue) => /^SOURCE_UNAVAILABLE/.test(issue));
  if (unavailableSource) return `receipt has no comparable source snapshot (${unavailableSource})`;
  if (receipt.exit_code !== 0 || receipt.source_changed_during_run || receipt.actor.agent === 'unknown') {
    return 'receipt execution or actor identity is ineligible';
  }
  // A receipt without any manifest never matches a sealed source; a stale or changing one is ineligible.
  const manifestIssue = (receipt.identity_issues || []).find((issue) => /^MANIFEST_(STALE|INVALID|CHANGED_DURING_RUN)$/.test(issue));
  if (manifestIssue) return `receipt was recorded without a current handoff manifest (${manifestIssue})`;
  return null;
}

/** A receipt reference names exactly one run directory; no `.`/`..` segment, no nesting, no other file. */
export const RECEIPT_REFERENCE_PATH = /^\.specloom\/runs\/[A-Za-z0-9][A-Za-z0-9._-]*\/execution-receipt\.json$/;

export function validateReceiptReference(reference, { cwd, changeId, stage = null, source = null,
  readEvidence = (relative) => readEvidenceFile(cwd, relative),
  readRaw = (receiptPath, rawPath) => readEvidenceFile(path.join(cwd, path.dirname(receiptPath)), rawPath),
} = {}) {
  try {
    if (!RECEIPT_REFERENCE_PATH.test(reference?.path || '') || !/^[a-f0-9]{64}$/.test(reference.sha256 || '')) {
      throw new Error('invalid execution receipt reference');
    }
    const bytes = readEvidence(reference.path);
    if (sha256(bytes) !== reference.sha256) throw new Error('receipt hash mismatch');
    const receipt = JSON.parse(bytes.toString('utf8'));
    const schema = validateNamed('execution-receipt', receipt);
    if (!schema.valid) throw new Error(`receipt schema invalid: ${schema.errors.join('; ')}`);
    if (receipt.change_id !== changeId || receipt.repository.name !== reference.repository) throw new Error('receipt change/repository mismatch');
    if (stage && receipt.stage !== stage) throw new Error(`receipt stage mismatch: ${receipt.stage}`);
    const ineligible = receiptIneligibility(receipt);
    if (ineligible) throw new Error(ineligible);
    if (source) {
      if (!source.manifest_path?.startsWith(`openspec/changes/${changeId}/handoff-manifest-sdd-`)
        || sha256(readEvidence(source.manifest_path)) !== source.manifest_hash) {
        throw new Error('receipt stage handoff manifest missing or stale');
      }
      const repo = source.repositories?.find(({ name }) => name === reference.repository);
      if (!repo || receipt.repository.branch !== repo.branch || receipt.repository.commit_sha !== repo.commit_sha
        || receipt.repository.source_hash !== repo.source_hash) throw new Error('receipt repository source differs');
      if (receipt.artifacts.proposal_hash !== source.proposal_hash
        || receipt.artifacts.normative_tasks_hash !== source.normative_tasks_hash
        || receipt.manifest_hash !== source.manifest_hash
        || JSON.stringify(receipt.artifacts.contract_hashes) !== JSON.stringify(source.contract_hashes)) {
        throw new Error('receipt governed artifact contents differ');
      }
    }
    for (const raw of Object.values(receipt.raw)) {
      let content;
      try {
        if (path.isAbsolute(raw.path) || raw.path.split(/[\\/]/).includes('..')) throw new Error('unsafe raw path');
        content = readRaw(reference.path, raw.path);
      } catch {
        throw new Error(`raw evidence missing or stale: ${raw.path}`);
      }
      if (content.length !== raw.bytes || sha256(content) !== raw.sha256) throw new Error(`raw evidence missing or stale: ${raw.path}`);
    }
    return { ok: true, issues: [], receipt };
  } catch (error) {
    return { ok: false, issues: [error.message] };
  }
}
