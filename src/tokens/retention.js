/** Preserve closure proof before an archive skill may remove the active change. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import matter from '../util/frontmatter.js';
import { readEvidenceFile, resolveContainedPath } from '../util/fs-safe.js';
import { resolveMultiRepoDelivery } from '../repos/delivery.js';
import { validateNamed } from '../schema/validate.js';
import { validateHandoffManifest, assertNormativeManifestAgreement } from './handoff.js';
import { validateEvidenceBinding, validatePinnedSource } from './binding.js';
import { normativeTasksHash } from './evidence.js';
import { receiptIneligibility, validateReceiptReference } from './receipt.js';
import { gateReportIssues } from '../lifecycle/report-validation.js';
import { validateRuntimeCoverage } from '../lifecycle/runtime-coverage.js';
import { loadConfig } from '../config/config.js';
import { resolveSddRepo } from '../repos/config.js';
import { ownRepositoryCapabilities } from '../lifecycle/repository-capabilities.js';
import { assertRuntimeReport } from './seal.js';

function hashFile(file) {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(65536);
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count));
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

const GATE_REPORTS = ['code-review-report.md', 'security-report.md', 'runtime-gate-report.md'];
const REQUIRED_CLOSURE_FILES = ['proposal.md', 'tasks.md', 'handoff-manifest.json', 'verification-report.md',
  'code-review-report.md', 'security-report.md', 'runtime-gate-report.md'];

/** Change-local references the handoff manifest pins (relative to the change directory), with their hashes. */
function changeLocalReferences(manifest, changeId) {
  const prefix = `openspec/changes/${changeId}/`;
  const sddName = manifest.repositories?.[0]?.name;
  return [manifest.requirement, manifest.design, manifest.tasks, ...(manifest.spec || []), ...(manifest.architecture || []),
    ...(manifest.required_skills || []), ...(manifest.contracts || []).map((entry) => ({ repository: entry.repository, path: entry.path, hash: entry.content_hash }))]
    .filter((entry) => entry && entry.repository === sddName && typeof entry.path === 'string' && entry.path.startsWith(prefix))
    .map((entry) => ({ path: entry.path.slice(prefix.length), hash: entry.hash }));
}

function artifactNames(changeDir) {
  const fixed = new Set(['OWNER.md', 'proposal.md', 'design.md', 'tasks.md', 'context-packet.md',
    'handoff-manifest.json', 'code-review-report.md', 'security-report.md',
    'runtime-gate-report.md', 'verification-report.md']);
  return fs.readdirSync(changeDir).filter((name) => fixed.has(name)
    || /^handoff-manifest-sdd-[a-z-]+-[a-f0-9]{64}\.json$/.test(name)
    || /^evidence-binding-[a-z0-9._-]+\.json$/.test(name)
    || /^[a-z0-9-]+-execution-report\.md$/.test(name)).sort();
}

function verifyDelivery(delivery, names) {
  if (delivery?.state !== 'merged') throw new Error(`closure requires merged delivery, got ${delivery?.state || 'unknown'}`);
  const states = delivery.per_repo || [];
  for (const name of names) {
    const observed = states.find((item) => item.repo === name);
    if (!observed || observed.state !== 'merged') throw new Error(`closure requires merged delivery for ${name}`);
  }
}

function receiptEvidence(cwd, reference, source, stage) {
  const checked = validateReceiptReference(reference, { cwd, changeId: source.change_id, stage, source });
  if (!checked.ok) throw new Error(`receipt is not eligible: ${checked.issues.join('; ')}`);
  if (!reference || typeof reference.path !== 'string' || !reference.path.startsWith('.specloom/runs/')) {
    throw new Error('receipt reference must be inside .specloom/runs');
  }
  const receiptPath = resolveContainedPath(cwd, reference.path);
  if (!fs.existsSync(receiptPath) || hashFile(receiptPath) !== reference.sha256) throw new Error(`receipt missing or stale: ${reference.path}`);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const validation = validateNamed('execution-receipt', receipt);
  if (!validation.valid) throw new Error(`invalid execution receipt: ${validation.errors.join('; ')}`);
  const ineligible = receiptIneligibility(receipt);
  if (ineligible) throw new Error(`receipt is not eligible: ${reference.path} (${ineligible})`);
  if (receipt.artifacts.proposal_hash !== source.proposal_hash
    || receipt.artifacts.normative_tasks_hash !== source.normative_tasks_hash) {
    throw new Error(`receipt governed artifacts differ: ${reference.path}`);
  }
  const runDir = path.dirname(receiptPath);
  const files = [{ file: receiptPath, relative: path.join(path.basename(runDir), 'execution-receipt.json'),
    original: reference.path, hash: reference.sha256 }];
  for (const [stream, raw] of Object.entries(receipt.raw)) {
    const rawPath = resolveContainedPath(runDir, raw.path);
    if (!fs.existsSync(rawPath) || !fs.statSync(rawPath).isFile()
      || fs.statSync(rawPath).size !== raw.bytes || hashFile(rawPath) !== raw.sha256) {
      throw new Error(`raw evidence missing or stale: ${reference.path}:${stream}`);
    }
    files.push({ file: rawPath, relative: path.join(path.basename(runDir), path.normalize(raw.path)),
      original: path.relative(cwd, rawPath), hash: raw.sha256 });
  }
  return files;
}

/** Every required execution edge must retain its original receipt and raw, not only the seal list. */
function reportReceiptReferences(report) {
  const references = [...(report.source_binding?.receipts || [])];
  for (const adapter of Object.values(report.adapters || {})) {
    references.push(...(adapter.receipts || []), ...(adapter.exclusion?.substitute_receipts || []));
  }
  for (const row of report.coverage || []) if (row.receipt) references.push(row.receipt);
  return [...new Map(references.map(ref => [`${ref.repository}\0${ref.path}\0${ref.sha256}`, ref])).values()];
}

export function retainEvidence(changeId, { cwd = process.cwd(), rawDestination, delivery = null } = {}) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(changeId)) throw new Error(`invalid change id: ${changeId}`);
  const changeDir = path.join(cwd, 'openspec', 'changes', changeId);
  if (!fs.existsSync(changeDir)) throw new Error(`active change missing: ${changeId}`);
  if (!rawDestination || !path.isAbsolute(rawDestination)) throw new Error('explicit absolute --raw-destination is required');
  const rawRoot = path.resolve(rawDestination);
  if (rawRoot === path.resolve(cwd) || rawRoot.startsWith(path.resolve(cwd) + path.sep)) {
    throw new Error('raw evidence destination must be outside the project repository');
  }
  const handoff = validateHandoffManifest(changeId, { cwd });
  if (!handoff.ok) throw new Error(`closure handoff invalid: ${handoff.issues.join('; ')}`);
  const manifest = JSON.parse(readEvidenceFile(cwd, `openspec/changes/${changeId}/handoff-manifest.json`, 'utf8'));
  verifyDelivery(delivery || resolveMultiRepoDelivery({ cwd, slug: changeId }), manifest.repositories.map((item) => item.name));
  const verificationPath = path.join(changeDir, 'verification-report.md');
  if (!fs.lstatSync(verificationPath, { throwIfNoEntry: false })) throw new Error('verification-report.md missing');
  const verification = matter(readEvidenceFile(cwd, `openspec/changes/${changeId}/verification-report.md`, 'utf8')).data;
  if (verification.status !== 'passed' || verification.source_binding?.delivery_state !== 'merged') {
    throw new Error('valid post-merge verification is required');
  }
  const binding = validateEvidenceBinding(changeId, 'verification-report.md', { cwd });
  if (!binding.ok) throw new Error(`verification source binding invalid: ${binding.issues.join('; ')}`);
  const verifiedManifest = JSON.parse(readEvidenceFile(cwd, verification.source_binding.manifest_path, 'utf8'));
  assertNormativeManifestAgreement(manifest, verifiedManifest);
  // Every gate the verification relied on is cleared and its sealed evidence still valid (F05).
  for (const report of GATE_REPORTS) {
    const relative = `openspec/changes/${changeId}/${report}`;
    if (!fs.lstatSync(path.join(cwd, relative), { throwIfNoEntry: false })) throw new Error(`closure requires the complete evidence chain; missing: ${report}`);
    const gate = matter(readEvidenceFile(cwd, relative, 'utf8')).data;
    if (!['passed', 'not_applicable'].includes(gate.status)) throw new Error(`closure requires cleared gates; ${report} is ${gate.status}`);
    const checked = validateEvidenceBinding(changeId, report, { cwd });
    if (!checked.ok) throw new Error(`${report} source binding invalid: ${checked.issues.join('; ')}`);
    const pinned = JSON.parse(readEvidenceFile(cwd, gate.source_binding.manifest_path, 'utf8'));
    assertNormativeManifestAgreement(pinned, verifiedManifest);
    assertRuntimeReport(changeId, report, gate, { cwd, manifest: pinned, source: gate.source_binding });
  }
  const rawFiles = [];
  for (const [report, stage] of [...GATE_REPORTS.map((name) => [name, name === 'code-review-report.md' ? 'review'
    : name === 'security-report.md' ? 'security' : 'runtime']), ['verification-report.md', 'verify']]) {
    const parsed = matter(readEvidenceFile(cwd, `openspec/changes/${changeId}/${report}`, 'utf8')).data;
    const refs = parsed.source_binding?.receipts;
    if (!Array.isArray(refs) || refs.length === 0) throw new Error(`${report} has no execution receipts`);
    for (const reference of reportReceiptReferences(parsed)) rawFiles.push(...receiptEvidence(cwd, reference,
      { ...parsed.source_binding, change_id: changeId }, stage));
  }
  const uniqueRaw = [...new Map(rawFiles.map((entry) => [entry.relative, entry])).values()];
  if (uniqueRaw.length !== rawFiles.length && rawFiles.some((entry) => uniqueRaw.find((item) => item.relative === entry.relative)?.hash !== entry.hash)) {
    throw new Error('execution raw references collide with different content');
  }
  const archiveRoot = path.join(cwd, 'openspec', 'archive');
  const archiveFinal = path.join(archiveRoot, changeId);
  const rawFinal = path.join(rawRoot, changeId);
  if (fs.existsSync(archiveFinal) || fs.existsSync(rawFinal)) throw new Error('closure destination already exists; refusing overwrite');
  for (const segment of ['openspec', 'openspec/archive']) {
    if (fs.lstatSync(path.join(cwd, segment), { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`closure destination ${segment} is a symbolic link; refusing to publish`);
    }
  }
  resolveContainedPath(cwd, 'openspec/archive');
  fs.mkdirSync(archiveRoot, { recursive: true });
  fs.mkdirSync(rawRoot, { recursive: true, mode: 0o700 });
  const realRawRoot = fs.realpathSync(rawRoot);
  if (realRawRoot === path.resolve(cwd) || realRawRoot.startsWith(path.resolve(cwd) + path.sep)) {
    throw new Error('raw evidence destination resolves inside the project repository');
  }
  const id = randomUUID();
  const archiveStage = path.join(archiveRoot, `.${changeId}.staging-${id}`);
  const rawStage = path.join(rawRoot, `.${changeId}.staging-${id}`);
  let rawPublished = false;
  try {
    fs.mkdirSync(archiveStage, { mode: 0o700 });
    fs.mkdirSync(rawStage, { mode: 0o700 });
    const retainedFiles = [];
    // The fixed artifacts plus every change-local reference the manifest pins (Issue 23).
    const names = [...new Set([...artifactNames(changeDir), ...changeLocalReferences(manifest, changeId).map((entry) => entry.path)])].sort();
    const missing = REQUIRED_CLOSURE_FILES.filter((name) => !names.includes(name));
    if (missing.length) throw new Error(`closure requires the complete evidence chain; missing: ${missing.join(', ')}`);
    for (const name of names) {
      // Contained regular file only (Amendment R5, rule 4): the bytes copied are the bytes checked.
      const bytes = readEvidenceFile(cwd, `openspec/changes/${changeId}/${name}`);
      const target = path.join(archiveStage, name);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (hashFile(target) !== hash) throw new Error(`closure copy failed integrity check: ${name}`);
      retainedFiles.push({ path: name, sha256: hash });
    }
    const restrictedRaw = [];
    for (const entry of uniqueRaw) {
      const destination = path.join(rawStage, entry.relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      fs.copyFileSync(entry.file, destination);
      fs.chmodSync(destination, 0o600);
      if (hashFile(destination) !== entry.hash) throw new Error(`raw evidence copy failed integrity check: ${entry.relative}`);
      restrictedRaw.push({ original_reference: entry.original,
        reference: path.join(realRawRoot, changeId, entry.relative), sha256: entry.hash,
        limitation: 'Private local evidence; access to the designated raw destination is required for reconstruction.' });
    }
    const index = {
      schema: 'closure-index', schema_version: 1, change_id: changeId,
      verified_commit_sha: verification.source_binding.repositories[0].commit_sha,
      reference_rebase: { from: `openspec/changes/${changeId}/`, to: `openspec/archive/${changeId}/` },
      repositories: manifest.repositories, files: retainedFiles, restricted_raw: restrictedRaw,
      raw_root: path.join(realRawRoot, changeId),
      created_at: new Date().toISOString(),
    };
    const validation = validateNamed('closure-index', index);
    if (!validation.valid) throw new Error(`invalid closure index: ${validation.errors.join('; ')}`);
    fs.writeFileSync(path.join(archiveStage, 'closure-index.json'), JSON.stringify(index, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(rawStage, rawFinal);
    rawPublished = true;
    fs.renameSync(archiveStage, archiveFinal);
    return { archive: archiveFinal, raw: rawFinal, index };
  } catch (error) {
    if (fs.existsSync(archiveStage)) fs.rmSync(archiveStage, { recursive: true });
    if (fs.existsSync(rawStage)) fs.rmSync(rawStage, { recursive: true });
    if (rawPublished && fs.existsSync(rawFinal)) fs.rmSync(rawFinal, { recursive: true });
    throw error;
  }
}

export function validateClosureIndex(changeId, { cwd = process.cwd() } = {}) {
  try {
    const archiveDir = path.join(cwd, 'openspec', 'archive', changeId);
    const index = JSON.parse(readEvidenceFile(cwd, `openspec/archive/${changeId}/closure-index.json`, 'utf8'));
    const validation = validateNamed('closure-index', index);
    if (!validation.valid || index.change_id !== changeId) throw new Error(`invalid closure index: ${validation.errors.join('; ')}`);
    if (index.reference_rebase.from !== `openspec/changes/${changeId}/`
      || index.reference_rebase.to !== `openspec/archive/${changeId}/`) throw new Error('closure reference rebase does not match change');
    for (const entry of index.files) {
      let content;
      try {
        content = readEvidenceFile(archiveDir, entry.path);
      } catch {
        throw new Error(`retained artifact stale: ${entry.path}`);
      }
      if (createHash('sha256').update(content).digest('hex') !== entry.sha256) throw new Error(`retained artifact stale: ${entry.path}`);
    }
    // Mandatory membership (Issue 23): a closure is the complete evidence chain, never a subset
    // whose remaining hashes happen to match.
    const listed = new Map(index.files.map((entry) => [entry.path, entry.sha256]));
    for (const name of REQUIRED_CLOSURE_FILES) {
      if (!listed.has(name)) throw new Error(`closure index omits required evidence: ${name}`);
    }
    const retainedManifest = JSON.parse(readEvidenceFile(archiveDir, 'handoff-manifest.json', 'utf8'));
    for (const reference of changeLocalReferences(retainedManifest, changeId)) {
      if (listed.get(reference.path) !== reference.hash) throw new Error(`closure index omits or alters a pinned reference: ${reference.path}`);
    }
    const verificationReport = matter(readEvidenceFile(archiveDir, 'verification-report.md', 'utf8')).data;
    if (verificationReport.status !== 'passed' || verificationReport.source_binding?.delivery_state !== 'merged') {
      throw new Error('retained verification report is not a passed post-merge verification');
    }
    const verification = verificationReport.source_binding || {};
    const verifiedStage = JSON.parse(readEvidenceFile(archiveDir, verification.manifest_path.split('/').at(-1), 'utf8'));
    assertNormativeManifestAgreement(retainedManifest, verifiedStage);
    // Retained gates are cleared and pin a retained stage manifest of their own stage.
    for (const [report, stage] of [['code-review-report.md', 'sdd-code-review'], ['security-report.md', 'sdd-security-gate'], ['runtime-gate-report.md', 'sdd-runtime-gate'], ['verification-report.md', 'sdd-verify']]) {
      const parsed = matter(readEvidenceFile(archiveDir, report, 'utf8'));
      const gate = parsed.data;
      const reportIssues = gateReportIssues(changeId, report, gate, parsed.content);
      if (reportIssues.length) throw new Error(`retained ${report} invalid: ${reportIssues.join('; ')}`);
      const source = gate.source_binding;
      if (!['passed', 'not_applicable'].includes(gate.status) || !source) throw new Error(`retained ${report} is not a cleared, sealed gate`);
      const pinned = typeof source.manifest_path === 'string' ? source.manifest_path.split('/').at(-1) : '';
      if (!pinned.startsWith(`handoff-manifest-${stage}-`) || listed.get(pinned) !== source.manifest_hash) {
        throw new Error(`retained ${report} does not pin a retained stage manifest of ${stage}`);
      }
      const stageManifest = JSON.parse(readEvidenceFile(archiveDir, pinned, 'utf8'));
      validatePinnedSource(changeId, report, source, stageManifest);
      assertNormativeManifestAgreement(stageManifest, verifiedStage);
    }
    // The verified normative sources are exactly the retained ones.
    const proposalHash = createHash('sha256').update(readEvidenceFile(archiveDir, 'proposal.md')).digest('hex');
    if (verification.proposal_hash !== proposalHash || verifiedStage.requirement?.hash !== proposalHash || retainedManifest.requirement?.hash !== proposalHash) {
      throw new Error('retained proposal differs from the verified proposal');
    }
    if (normativeTasksHash(readEvidenceFile(archiveDir, 'tasks.md', 'utf8')) !== verification.normative_tasks_hash) {
      throw new Error('retained plan differs from the verified plan');
    }
    const stageManifest = typeof verification.manifest_path === 'string' ? verification.manifest_path.split('/').at(-1) : null;
    if (!stageManifest || !listed.has(stageManifest)) throw new Error('closure index omits the verification stage manifest');
    if (index.verified_commit_sha !== verification.repositories?.[0]?.commit_sha) {
      throw new Error('closure verified commit differs from the retained verification report');
    }
    const rawByOriginal = new Map((index.restricted_raw || []).map((entry) => [entry.original_reference, entry]));
    const readRetained = (original) => {
      const activePrefix = `openspec/changes/${changeId}/`;
      if (original.startsWith(activePrefix)) {
        const name = original.slice(activePrefix.length);
        if (!listed.has(name) || name.includes('/')) throw new Error(`retained reference missing: ${original}`);
        return readEvidenceFile(archiveDir, name);
      }
      const entry = rawByOriginal.get(original);
      if (!entry) throw new Error(`retained raw reference missing: ${original}`);
      const relative = path.relative(index.raw_root, entry.reference);
      const bytes = readEvidenceFile(index.raw_root, relative);
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`retained raw reference stale: ${original}`);
      return bytes;
    };
    const readRetainedRaw = (receiptPath, rawPath) => readRetained(path.posix.join(path.posix.dirname(receiptPath), rawPath));
    const receipts = Array.isArray(verification.receipts) ? verification.receipts : [];
    if (receipts.length === 0) throw new Error('retained verification report has no execution receipts');
    for (const receipt of receipts) {
      const retained = rawByOriginal.get(receipt.path);
      if (!retained || retained.sha256 !== receipt.sha256) throw new Error(`closure index omits verification receipt ${receipt.path}`);
    }
    for (const entry of index.restricted_raw || []) {
      if (!entry.original_reference.startsWith('.specloom/runs/')
        || entry.original_reference.split('/').includes('..')) throw new Error('unsafe original raw evidence reference');
      // Contained to the recorded raw root, with no symbolic link anywhere on the path, before any
      // byte is read: the index can never make validation hash an arbitrary file (Amendment R5, rule 4).
      const rawRoot = index.raw_root;
      if (typeof rawRoot !== 'string' || !path.isAbsolute(rawRoot)) throw new Error('closure index has no absolute raw_root');
      const relative = path.relative(rawRoot, entry.reference);
      if (!path.isAbsolute(entry.reference) || relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`raw evidence reference is outside the recorded raw root: ${entry.reference}`);
      }
      const stat = fs.lstatSync(entry.reference, { throwIfNoEntry: false });
      if (!stat || !stat.isFile() || fs.realpathSync(entry.reference) !== entry.reference) {
        throw new Error(`retained raw evidence stale: ${entry.reference}`);
      }
      if (entry.reference === path.resolve(cwd) || entry.reference.startsWith(path.resolve(cwd) + path.sep)
        || hashFile(entry.reference) !== entry.sha256) {
        throw new Error(`retained raw evidence stale: ${entry.reference}`);
      }
    }
    for (const [report, stage] of [...GATE_REPORTS.map((name) => [name, name === 'code-review-report.md' ? 'review'
      : name === 'security-report.md' ? 'security' : 'runtime']), ['verification-report.md', 'verify']]) {
      const gate = matter(readEvidenceFile(archiveDir, report, 'utf8')).data;
      const source = gate.source_binding;
      if (!Array.isArray(source.receipts) || source.receipts.length === 0) throw new Error(`retained ${report} has no execution receipts`);
      for (const reference of source.receipts) {
        const checked = validateReceiptReference(reference, { cwd, changeId, stage, source,
          readEvidence: readRetained, readRaw: readRetainedRaw });
        if (!checked.ok) throw new Error(`retained ${report} receipt invalid: ${checked.issues.join('; ')}`);
      }
      if (stage === 'runtime') {
        const runtimeManifest = JSON.parse(readRetained(source.manifest_path).toString('utf8'));
        const runtimeIssues = validateRuntimeCoverage(gate, { manifest: runtimeManifest,
          config: loadConfig({ cwd }).config,
          repositoryCapabilities: (name) => ownRepositoryCapabilities(name, { cwd, sddName: resolveSddRepo({ cwd }).name }),
          validateReceipt: (reference) => validateReceiptReference(reference, { cwd, changeId, stage, source,
            readEvidence: readRetained, readRaw: readRetainedRaw }) });
        if (runtimeIssues.length) throw new Error(`retained runtime coverage invalid: ${runtimeIssues.join('; ')}`);
      }
    }
    // Each retained receipt's own raw streams are retained too (read from its verified retained copy).
    for (const receipt of receipts) {
      const record = JSON.parse(fs.readFileSync(rawByOriginal.get(receipt.path).reference, 'utf8'));
      // The private receipt anchors the chain: what it observed must be what the closure retains.
      if (record.artifacts?.proposal_hash !== verification.proposal_hash || record.artifacts?.normative_tasks_hash !== verification.normative_tasks_hash
        || record.manifest_hash !== verification.manifest_hash || record.change_id !== changeId) {
        throw new Error(`retained receipt ${receipt.path} disagrees with the retained verification`);
      }
      const runDir = path.posix.dirname(receipt.path);
      for (const raw of Object.values(record.raw || {})) {
        const retained = rawByOriginal.get(path.posix.join(runDir, raw.path));
        if (!retained || retained.sha256 !== raw.sha256) throw new Error(`closure index omits raw evidence ${raw.path} of ${receipt.path}`);
      }
    }
    return { ok: true, issues: [] };
  } catch (error) { return { ok: false, issues: [error.message] }; }
}
