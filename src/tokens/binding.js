/**
 * Explicit, immutable lineage from a sealed gate snapshot to later commits (design Amendments
 * R1–R4), evaluated under the model of Amendment R5: every repository, binding and lineage
 * entry is a unit that passes, fails or is unknown; a failure always wins, an unknown is
 * reported and never a pass, and no unit stops the evaluation of another.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { validateNamed } from '../schema/validate.js';
import { resolveSddRepo } from '../repos/config.js';
import { buildHandoffManifest, governedManifestHash, repoRoot, reviewedBaseFor, sealedSddCommit } from './handoff.js';
import { commitTreeDigest, hashReference, sha256, snapshotRepository } from './evidence.js';
import {
  ancestry, assessRepository, checkoutContext, headCommit, HistoryUnavailableError, interveningChanges,
  proveDeliveredContent, RepositoryUnavailableError, sameContent, verifyEvidenceOnlyTasks, verifyReferencesAtCommit,
} from './equivalence.js';
import { REPORT_STAGES, assertRuntimeReport } from './seal.js';
import { validateReceiptReference } from './receipt.js';
import { readEvidenceFile, unsafeEvidenceReason } from '../util/fs-safe.js';
import { gateReportIssues } from '../lifecycle/report-validation.js';

const LOCAL_ONLY = 'local-only';
const STAGE_OF_REPORT = { 'code-review-report.md': 'sdd-code-review', 'security-report.md': 'sdd-security-gate',
  'runtime-gate-report.md': 'sdd-runtime-gate', 'verification-report.md': 'sdd-verify' };
const AFTER_DELIVERY = 'after-delivery';

function reportRelative(changeId, reportName) {
  if (!/^[a-z0-9][a-z0-9-]*-report\.md$/.test(reportName)) throw new Error(`invalid report path: ${reportName}`);
  return `openspec/changes/${changeId}/${reportName}`;
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function changeDirectory(changeId, cwd) {
  return path.join(cwd, 'openspec', 'changes', changeId);
}

/** Bindings are keyed by report, repository and destination SHA, and are never overwritten. */
function bindingFileName(reportName, repoName, sha) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(repoName)) throw new Error(`invalid repository: ${repoName}`);
  return `evidence-binding-${reportName.slice(0, -3)}-${repoName}-${sha}.json`;
}

const BINDING_NAME = /^evidence-binding-[a-z0-9][a-z0-9._-]*\.json$/;
const BINDING_KEYS = new Set(['schema', 'schema_version', 'change_id', 'repository', 'report', 'previous_commit_sha',
  'current_commit_sha', 'governed_hash', 'evidence_only_paths', 'equivalence', 'supersedes', 'created_at']);

/**
 * Why a binding reference cannot be read, or null when it is an exact change-local binding
 * file that is regular, not a symbolic link, and inside the project root. Nothing is read first.
 */
function unsafeBindingReason(cwd, changeId, relative) {
  const prefix = `openspec/changes/${changeId}/`;
  if (typeof relative !== 'string' || path.isAbsolute(relative) || !relative.startsWith(prefix)
    || !BINDING_NAME.test(relative.slice(prefix.length))) return 'not an exact change-local binding file name';
  return unsafeEvidenceReason(cwd, relative);
}

function listBindingFiles(changeId, reportName, repoName, cwd) {
  const pattern = new RegExp(`^evidence-binding-${escapeRegExp(reportName.slice(0, -3))}-${escapeRegExp(repoName)}-([a-f0-9]{40})\\.json$`);
  const dir = changeDirectory(changeId, cwd);
  return fs.readdirSync(dir).filter((name) => pattern.test(name)).sort().map((name) => {
    const relative = path.relative(cwd, path.join(dir, name));
    return { name, file: path.join(dir, name), relative, sha: name.match(pattern)[1], unsafe: unsafeBindingReason(cwd, changeId, relative) };
  });
}

/** Load the sealed report and its stage manifest through contained reads and verify the portable hash chain. */
function loadSealed(changeId, reportName, cwd) {
  const relative = reportRelative(changeId, reportName);
  if (!fs.lstatSync(path.join(cwd, relative), { throwIfNoEntry: false })) throw new Error(`report missing: ${relative}`);
  const reportBytes = readEvidenceFile(cwd, relative);
  const parsed = matter(reportBytes.toString('utf8'));
  const reportIssues = gateReportIssues(changeId, reportName, parsed.data, parsed.content);
  if (reportIssues.length) throw new Error(`invalid gate report: ${reportIssues.join('; ')}`);
  const source = parsed.data.source_binding;
  if (!source || typeof source !== 'object') throw new Error('report source_binding missing');
  const shape = validateNamed('source-binding', source);
  if (!shape.valid) throw new Error(`report source_binding invalid: ${shape.errors.join('; ')}`);
  const expectedPrefix = `openspec/changes/${changeId}/handoff-manifest-sdd-`;
  if (typeof source.manifest_path !== 'string' || !source.manifest_path.startsWith(expectedPrefix)) throw new Error('report stage handoff reference missing');
  if (!fs.lstatSync(path.join(cwd, source.manifest_path), { throwIfNoEntry: false })) throw new Error('report stage handoff manifest missing');
  const manifestBytes = readEvidenceFile(cwd, source.manifest_path);
  if (sha256(manifestBytes) !== source.manifest_hash) throw new Error('report stage handoff hash mismatch');
  const savedManifest = JSON.parse(manifestBytes.toString('utf8'));
  // The pinned manifest belongs to this change and to this report's stage (portable, before any private check).
  const manifestShape = validateNamed('handoff-manifest', savedManifest);
  if (!manifestShape.valid) throw new Error(`report stage handoff manifest invalid: ${manifestShape.errors.join('; ')}`);
  validatePinnedSource(changeId, reportName, source, savedManifest);
  return { relative, reportHash: sha256(reportBytes), source, savedManifest };
}

/** Portable semantic checks shared by live binding and retained closure. */
export function validatePinnedSource(changeId, reportName, source, savedManifest) {
  const sourceShape = validateNamed('source-binding', source);
  if (!sourceShape.valid) throw new Error(`report source_binding invalid: ${sourceShape.errors.join('; ')}`);
  const manifestShape = validateNamed('handoff-manifest', savedManifest);
  if (!manifestShape.valid) throw new Error(`report stage handoff manifest invalid: ${manifestShape.errors.join('; ')}`);
  const expectedStage = STAGE_OF_REPORT[reportName];
  if (savedManifest.change_id !== changeId) throw new Error('report stage handoff manifest belongs to another change');
  if (!expectedStage || savedManifest.stage !== expectedStage || !source.manifest_path.startsWith(`openspec/changes/${changeId}/handoff-manifest-${expectedStage}-`)) {
    throw new Error(`report stage handoff manifest is for stage ${savedManifest.stage}, not ${expectedStage || 'a gate'} (${reportName})`);
  }
  if (source.governed_manifest_hash !== governedManifestHash(savedManifest)) {
    throw new Error('stage handoff manifest does not match the sealed governed hash');
  }
  // The report's own copy of the sealed identities must equal the manifest it pins (Amendment R5, rule 7).
  const pick = ({ name, branch, commit_sha, source_hash, tree_hash }) => ({ name, branch, commit_sha, source_hash, ...(tree_hash ? { tree_hash } : {}) });
  const sealedChain = {
    repositories: (savedManifest.repositories || []).map(pick), proposal_hash: savedManifest.requirement?.hash,
    design_hash: savedManifest.design?.hash || 'unknown', normative_tasks_hash: savedManifest.tasks?.normative_hash,
    contract_hashes: (savedManifest.contracts || []).map(({ path: file, content_hash }) => ({ path: file, hash: content_hash })),
  };
  for (const [key, expected] of Object.entries(sealedChain)) {
    const recorded = key === 'repositories' ? (source.repositories || []).map(pick) : source[key];
    if (canonical(recorded) !== canonical(expected)) throw new Error(`report source_binding.${key} differs from its pinned stage handoff manifest`);
  }
}

/** Only a cleared gate with valid original receipts may be rebound; rebinding never creates evidence. */
function assertClearedEvidence(changeId, reportName, cwd) {
  const stage = REPORT_STAGES[reportName];
  if (!stage) throw new Error(`not a gate report: ${reportName}`);
  const parsed = matter(readEvidenceFile(cwd, reportRelative(changeId, reportName), 'utf8'));
  const reportIssues = gateReportIssues(changeId, reportName, parsed.data, parsed.content);
  if (reportIssues.length) throw new Error(`invalid gate report: ${reportIssues.join('; ')}`);
  if (!['passed', 'not_applicable'].includes(parsed.data.status)) {
    throw new Error(`only cleared gate reports can be rebound; ${reportName} is ${parsed.data.status}`);
  }
  const source = parsed.data.source_binding;
  if (!source || !Array.isArray(source.receipts) || source.receipts.length === 0) {
    throw new Error('rebind needs the original execution receipts; none are recorded');
  }
  for (const receipt of source.receipts) {
    const checked = validateReceiptReference(receipt, { cwd, changeId, stage, source });
    if (!checked.ok) throw new Error(`original execution receipt is not valid evidence: ${checked.issues.join('; ')}`);
  }
  if (stage === 'runtime') {
    const { savedManifest } = loadSealed(changeId, reportName, cwd);
    assertRuntimeReport(changeId, reportName, parsed.data, { cwd, manifest: savedManifest, source });
  }
}

const sameList = (left, right) => JSON.stringify([...(left || [])].sort()) === JSON.stringify([...(right || [])].sort());
const canonical = (value) => JSON.stringify(value, (key, item) => (item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => (left < right ? -1 : 1))) : item));
const byPath = (left, right) => (left.path < right.path ? -1 : 1);

/** Run one unit: a returned { issues, unknown } is merged; a thrown error is a failure, or unknown when history is undecidable. */
function settle(verdict, label, fn) {
  try {
    const out = fn();
    if (out) {
      verdict.issues.push(...out.issues);
      verdict.unknown.push(...out.unknown);
    }
  } catch (error) {
    if (error instanceof HistoryUnavailableError) verdict.unknown.push(`${label}: ${error.message}`);
    else verdict.issues.push(`${label}: ${error.message}`);
  }
}

/**
 * Validate one binding file against the original sealed snapshot and its destination commit
 * (Amendments R3–R5). Checks that need no history always run; those that need the history
 * between the sealed commit and the destination, or the order of sibling bindings, are
 * reported unknown when a shallow history cannot decide them.
 */
function bindingIssues(candidate, unit) {
  const { changeId, reportName, cwd, reportHash, old, name, source, savedManifest, root, siblings, sddName } = unit;
  const issues = [];
  const unknown = [];
  const tag = (message) => `${candidate.name}: ${message}`;
  if (candidate.unsafe) return { issues: [tag(`binding is not a contained regular file (${candidate.unsafe})`)], unknown };
  let binding;
  try {
    binding = JSON.parse(fs.readFileSync(candidate.file, 'utf8'));
  } catch (error) {
    return { issues: [tag(`unreadable binding (${error.message})`)], unknown };
  }
  const validation = validateNamed('evidence-binding', binding);
  if (!validation.valid) return { issues: [tag(`invalid evidence binding: ${validation.errors.join('; ')}`)], unknown };
  const unrecognised = Object.getOwnPropertyNames(binding).filter((key) => !BINDING_KEYS.has(key));
  if (unrecognised.length) return { issues: [tag(`unrecognised binding fields: ${unrecognised.join(', ')}`)], unknown };
  if (binding.current_commit_sha !== candidate.sha) issues.push(tag('destination identity does not match the file name'));
  if (binding.change_id !== changeId || binding.repository !== name) issues.push(tag('change or repository mismatch'));
  const reportReference = reportRelative(changeId, reportName);
  if (binding.report.hash !== reportHash || binding.report.path !== reportReference || binding.report.repository !== sddName) {
    issues.push(tag('sealed report identity differs from the binding'));
  }
  if (binding.previous_commit_sha !== old.commit_sha) issues.push(tag('sealed commit differs from the binding'));
  const sealedDigest = old.tree_hash || old.source_hash;
  if (binding.governed_hash !== sealedDigest) issues.push(tag('governed digest differs from the sealed snapshot'));
  if (issues.length) return { issues, unknown };
  const destination = binding.current_commit_sha;

  // The destination commit holds the reviewed content and references (needs no history). A report
  // sealed before the governed tree digest existed can only be covered on its branch, where HEAD's
  // working tree is compared with the sealed snapshot; delivered evaluation needs the digest.
  let committed = null;
  if (!old.tree_hash) {
    if (unit.delivered) issues.push(tag('the report was sealed before the governed tree digest existed; rerun the gate on the committed SHA'));
  } else {
    committed = commitTreeDigest({ root, commit: destination, changeId });
    if (committed !== old.tree_hash) issues.push(tag('governed content recorded in the destination commit differs from the reviewed snapshot'));
  }
  try {
    verifyReferencesAtCommit(root, destination, name, savedManifest, source.normative_tasks_hash);
  } catch (error) {
    issues.push(tag(error.message));
  }
  const recorded = binding.equivalence;
  if (recorded) {
    if (recorded.reviewed_tree_hash !== old.tree_hash) issues.push(tag('reviewed digest differs from the sealed snapshot'));
    if (JSON.stringify(recorded.original_receipts) !== JSON.stringify(source.receipts || [])) issues.push(tag('original receipts differ from the sealed report'));
    if (committed !== null && recorded.committed_tree_hash !== committed) issues.push(tag('committed digest differs from the destination tree'));
    if (recorded.committed_tree_hash !== recorded.reviewed_tree_hash) issues.push(tag('committed digest is not the reviewed digest'));
  }

  // The history between the sealed commit and the destination.
  let changes = null;
  try {
    changes = interveningChanges(root, binding.previous_commit_sha, destination, changeId);
  } catch (error) {
    if (error instanceof HistoryUnavailableError) unknown.push(tag(`sealed-to-destination history: ${error.message}`));
    else issues.push(tag(error.message));
  }
  let implementation = null;
  if (changes) {
    implementation = changes.governed.length > 0;
    if (!sameList(binding.evidence_only_paths, implementation ? changes.evidence : changes.paths)) {
      issues.push(tag('evidence-only paths differ from the recomputed destination'));
    }
    if (implementation && !recorded) {
      issues.push(tag('an implementation commit needs the recorded equivalence section'));
    } else if (!implementation && recorded) {
      issues.push(tag('equivalence recorded for an evidence-only destination'));
    } else if (recorded) {
      if (!sameList(recorded.governed_paths_committed, changes.governed)) issues.push(tag('committed governed paths differ from the recomputed destination'));
      if (JSON.stringify(recorded.intervening_commits) !== JSON.stringify(changes.commits)) issues.push(tag('intervening commits differ from the recomputed destination'));
    }
    if (!implementation) {
      try {
        verifyEvidenceOnlyTasks(root, binding.previous_commit_sha, destination, changeId, source.normative_tasks_hash);
      } catch (error) {
        issues.push(tag(error.message));
      }
    }
  }

  // Lineage: every listed entry is a contained regular binding with its recorded hash, and the
  // list is exactly the sibling bindings whose destination is a proper ancestor.
  for (const earlier of binding.supersedes || []) {
    const unsafe = unsafeBindingReason(cwd, changeId, earlier.path);
    if (unsafe) issues.push(tag(`lineage reference ${earlier.path} is not a contained regular binding file (${unsafe})`));
    else if (sha256(fs.readFileSync(path.join(cwd, earlier.path))) !== earlier.sha256) issues.push(tag(`lineage reference ${earlier.path} is missing or altered`));
  }
  let lineageKnown = true;
  const predecessors = [];
  for (const other of siblings) {
    if (other.name === candidate.name) continue;
    const answer = ancestry(root, other.sha, destination);
    if (answer === 'unknown') lineageKnown = false;
    if (answer === 'yes') predecessors.push(other);
  }
  if (!lineageKnown) {
    unknown.push(tag('lineage completeness cannot be decided in this shallow history'));
  } else {
    const expectedPaths = predecessors.map((other) => other.relative);
    const listed = (binding.supersedes || []).map((entry) => entry.path);
    for (const missing of expectedPaths.filter((entry) => !listed.includes(entry))) issues.push(tag(`predecessor ${missing} is not recorded in the lineage`));
    for (const extra of listed.filter((entry) => !expectedPaths.includes(entry))) issues.push(tag(`lineage entry ${extra} is not a predecessor of this binding`));
  }

  // The complete expected record over every key that could be recomputed here.
  if (issues.length === 0) {
    const expected = {
      schema: 'evidence-binding', schema_version: 1, change_id: changeId, repository: name,
      report: { repository: sddName, path: reportReference, hash: reportHash },
      previous_commit_sha: old.commit_sha, current_commit_sha: candidate.sha, governed_hash: sealedDigest,
    };
    if (changes) {
      expected.evidence_only_paths = [...(implementation ? changes.evidence : changes.paths)].sort();
      if (implementation) {
        expected.equivalence = { kind: 'identical-governed-content', reviewed_tree_hash: old.tree_hash, committed_tree_hash: old.tree_hash,
          governed_paths_committed: [...changes.governed].sort(), intervening_commits: changes.commits, original_receipts: source.receipts || [] };
      }
    }
    if (lineageKnown) {
      const lineage = predecessors.filter((other) => !other.unsafe)
        .map((other) => ({ path: other.relative, sha256: sha256(fs.readFileSync(other.file)) })).sort(byPath);
      if (lineage.length) expected.supersedes = lineage;
    }
    const skipped = new Set(['created_at', ...(changes ? [] : ['evidence_only_paths', 'equivalence']), ...(lineageKnown ? [] : ['supersedes'])]);
    const normalized = {
      ...binding,
      evidence_only_paths: [...(binding.evidence_only_paths || [])].sort(),
      ...(binding.equivalence ? { equivalence: { ...binding.equivalence, governed_paths_committed: [...(binding.equivalence.governed_paths_committed || [])].sort() } } : {}),
      ...(binding.supersedes ? { supersedes: [...binding.supersedes].sort(byPath) } : {}),
    };
    const own = (object, key) => (Object.hasOwn(object, key) ? object[key] : undefined);
    for (const key of new Set([...Object.getOwnPropertyNames(expected), ...Object.getOwnPropertyNames(normalized)])) {
      if (skipped.has(key)) continue;
      if (canonical(own(expected, key)) !== canonical(own(normalized, key))) issues.push(tag(`${key} differs from the recomputed binding`));
    }
  }
  return { issues, unknown };
}

/**
 * The latest applicable binding (Amendments R4, R5 rule 3): one whose destination is HEAD
 * wins; otherwise every candidate must be placeable, the applicable ones must lie on one
 * line of history, and nothing older is validated in place of an undecidable latest.
 */
function selectLatest(candidates, root, headSha) {
  const atHead = candidates.find((candidate) => candidate.sha === headSha);
  if (atHead) return { latest: atHead };
  const placed = candidates.map((candidate) => ({ candidate, answer: ancestry(root, candidate.sha, headSha) }));
  const undecided = placed.filter(({ answer }) => answer === 'unknown');
  if (undecided.length) return { unknown: `the destination of ${undecided.length} binding candidate(s) cannot be placed in this shallow history` };
  const applicable = placed.filter(({ answer }) => answer === 'yes').map(({ candidate }) => candidate);
  if (applicable.length === 0) return { none: true };
  const latest = [];
  for (const candidate of applicable) {
    let superseded = false;
    for (const other of applicable) {
      if (other === candidate) continue;
      const answer = ancestry(root, candidate.sha, other.sha);
      if (answer === 'unknown') return { unknown: 'the order of the applicable bindings cannot be decided in this shallow history' };
      if (answer === 'yes') { superseded = true; break; }
    }
    if (!superseded) latest.push(candidate);
  }
  if (latest.length !== 1) return { ambiguous: latest.length ? latest : applicable };
  return { latest: latest[0] };
}

function bindingVerdict(unit) {
  const { changeId, reportName, name, root, headSha } = unit;
  const candidates = unit.siblings;
  if (candidates.length === 0) {
    return { issues: [`explicit evidence binding missing: ${name} (run: playbook evidence bind ${changeId} ${reportName})`], unknown: [] };
  }
  const selection = selectLatest(candidates, root, headSha);
  if (selection.unknown) return { issues: [], unknown: [`binding selection for ${name}: ${selection.unknown}; fetch full history (fetch-depth: 0)`] };
  if (selection.none) {
    return { issues: [`no evidence binding applies to ${name}: no recorded destination is in the history of HEAD (run: playbook evidence bind ${changeId} ${reportName})`], unknown: [] };
  }
  if (selection.ambiguous) {
    return { issues: [`ambiguous evidence bindings for ${name}: ${selection.ambiguous.map((candidate) => candidate.name).join(', ')} are not on one line of history`], unknown: [] };
  }
  const result = bindingIssues(selection.latest, unit);
  return {
    issues: result.issues.length ? [`the latest applicable evidence binding for ${name} is invalid: ${result.issues.join('; ')}`] : [],
    unknown: result.unknown,
  };
}

/** Declared untracked source paths, read through the contained-read rule. */
function declaredSources(changeId, cwd) {
  return matter(readEvidenceFile(cwd, `openspec/changes/${changeId}/tasks.md`, 'utf8')).data.handoff?.source_paths || {};
}

/** The normative sources and governed handoff semantics the gate was sealed on. */
function normativeVerdict(shared, contexts, portable) {
  const { changeId, cwd, source, savedManifest } = shared;
  // Portable: an unavailable repository keeps its sealed entries; every available reference is compared.
  const current = buildHandoffManifest(changeId, { cwd, stage: savedManifest.stage, agent: savedManifest.producer.agent,
    provider: savedManifest.producer.provider, model: savedManifest.producer.model,
    resolveDetached: (name) => contexts.get(name)?.sealedBranch, fallback: portable ? { manifest: savedManifest } : null });
  for (const group of ['repositories', 'context_repositories']) {
    current[group] = (current[group] || []).map((entry) => (contexts.get(entry.name)?.kind === 'delivered'
      ? (savedManifest[group] || []).find((item) => item.name === entry.name) || entry : entry));
  }
  const issues = [];
  if (source.governed_manifest_hash !== governedManifestHash(current)) issues.push('governed handoff semantics changed since report execution');
  if (source.proposal_hash !== current.requirement.hash || source.design_hash !== (current.design?.hash || 'unknown')
    || source.normative_tasks_hash !== current.tasks.normative_hash) issues.push('normative source changed since report execution');
  const contracts = current.contracts.map(({ path: file, content_hash }) => ({ path: file, hash: content_hash }));
  if (JSON.stringify(source.contract_hashes) !== JSON.stringify(contracts)) issues.push('contract content changed since report execution');
  if (source.repositories.length !== current.repositories.length) issues.push('report repository coverage differs from handoff');
  return { issues, unknown: [] };
}

/** Classify every repository the gate's stage manifest names (Amendment R5, rule 6). */
function classify(shared, portable) {
  const { cwd, savedManifest } = shared;
  const sddName = resolveSddRepo({ cwd }).name;
  const contexts = new Map();
  for (const group of ['repositories', 'context_repositories']) {
    for (const sealed of savedManifest[group] || []) {
      let root;
      try {
        root = repoRoot(sealed.name, cwd, sddName);
      } catch (error) {
        if (portable && error instanceof RepositoryUnavailableError) {
          contexts.set(sealed.name, { kind: 'unavailable', sealedBranch: sealed.branch });
          continue;
        }
        throw error;
      }
      contexts.set(sealed.name, { ...checkoutContext(root, sealed.branch,
        { defaultBase: reviewedBaseFor(cwd, sealedSddCommit(savedManifest, sddName), sealed.name) }), root, sealedBranch: sealed.branch });
    }
  }
  return { contexts, sddName };
}

function unitFor(shared, old, context, sddName) {
  const { changeId, reportName, cwd } = shared;
  return { ...shared, name: old.name, old, root: context.root, headSha: headCommit(context.root), sddName,
    siblings: listBindingFiles(changeId, reportName, old.name, cwd) };
}

/** On the sealed branch (or a detached checkout in portable mode): HEAD content and the latest binding. */
function onBranchVerdict(unit, verdict) {
  const { changeId, cwd, old, name, root, headSha, source, savedManifest } = unit;
  const current = () => {
    const entry = { name, ...snapshotRepository({ root, changeId, untrackedPaths: declaredSources(changeId, cwd)[name] || [] }) };
    if (entry.branch === null) entry.branch = old.branch;
    return entry;
  };
  if (headSha === old.commit_sha) {
    settle(verdict, `content of repository ${name}`, () => {
      if (!sameContent(old, current())) throw new Error(`repository source changed: ${name}`);
      return null;
    });
    return;
  }
  settle(verdict, `content of repository ${name}`, () => {
    assessRepository({ root, name, changeId, sealed: old, current: current(), manifest: savedManifest,
      expectedNormativeHash: source.normative_tasks_hash });
    return null;
  });
  settle(verdict, `evidence binding for repository ${name}`, () => bindingVerdict(unit));
}

/**
 * On the base branch after merge (Amendment R5, rule 7): the covered commit must be in the
 * history of HEAD and hold the reviewed content; the base branch's own content is not compared.
 */
function deliveredVerdict(unit, context, verdict) {
  const { changeId, old, name, root, headSha, source, savedManifest } = unit;
  verdict.notes.push({ kind: AFTER_DELIVERY, check: `content of repository ${name} on ${context.branch}`,
    reason: `not applicable after delivery: the gate was sealed on ${old.branch} and is judged at its covered commit; post-merge verification governs ${context.branch}` });
  settle(verdict, `delivered evidence for repository ${name}`, () => {
    if (unit.siblings.length) {
      const selection = selectLatest(unit.siblings, root, headSha);
      if (!selection.none) return bindingVerdict({ ...unit, delivered: true });
    }
    const delivered = ancestry(root, old.commit_sha, headSha);
    if (delivered === 'unknown') throw new HistoryUnavailableError(`history is shallow; delivery of ${old.commit_sha} cannot be verified`);
    if (delivered === 'no') throw new Error(`sealed commit ${old.commit_sha} is not in the history of ${context.branch}`);
    if (!old.tree_hash || commitTreeDigest({ root, commit: old.commit_sha, changeId }) !== old.tree_hash) {
      throw new Error('the reviewed content is not recorded at the sealed commit and no applicable evidence binding records the commit that holds it');
    }
    verifyReferencesAtCommit(root, old.commit_sha, name, savedManifest, source.normative_tasks_hash);
    return null;
  });
}

/**
 * Context repositories are units of their own (Amendment R5, rules 1 and 6): only one that is
 * itself on its base branch is exempt from content comparison; one on its sealed branch keeps
 * its governed content and references, whatever the context of the SDD root.
 */
function contextRepositoriesVerdict(shared, contexts, portable, verdict) {
  const { changeId, cwd, savedManifest } = shared;
  for (const sealed of savedManifest.context_repositories || []) {
    const context = contexts.get(sealed.name);
    if (!context) continue;
    if (context.kind === 'unavailable') {
      verdict.notes.push({ kind: LOCAL_ONLY, check: `context repository ${sealed.name}`, reason: `repository ${sealed.name} is not available in this environment` });
      continue;
    }
    if (context.kind === 'delivered') {
      verdict.notes.push({ kind: AFTER_DELIVERY, context: true, check: `content of context repository ${sealed.name} on ${context.branch}`,
        reason: `not applicable after delivery: sealed on ${sealed.branch}` });
      settle(verdict, `context repository ${sealed.name}`, () => {
        proveDeliveredContent({ root: context.root, name: sealed.name, sealed, headSha: headCommit(context.root), changeId,
          manifest: savedManifest, expectedNormativeHash: savedManifest.tasks.normative_hash });
        return null;
      });
      continue;
    }
    if (context.kind === 'other-branch') {
      verdict.issues.push(`context repository ${sealed.name} is on branch ${context.branch}; this evidence was sealed on branch ${sealed.branch}`);
      continue;
    }
    if (context.kind === 'detached') {
      if (!portable) {
        verdict.issues.push(`context repository ${sealed.name} is in detached HEAD; check out branch ${sealed.branch}`);
        continue;
      }
      verdict.notes.push({ kind: LOCAL_ONLY, check: `branch identity of context repository ${sealed.name}`, reason: `detached checkout; the content is compared as branch ${sealed.branch}` });
    }
    settle(verdict, `context repository ${sealed.name}`, () => {
      const root = context.root;
      const current = { name: sealed.name, ...snapshotRepository({ root, changeId, untrackedPaths: declaredSources(changeId, cwd)[sealed.name] || [] }) };
      if (current.branch === null) current.branch = sealed.branch;
      if (current.commit_sha === sealed.commit_sha) {
        if (!sameContent(sealed, current)) throw new Error(`repository source changed: ${sealed.name}`);
      } else {
        assessRepository({ root, name: sealed.name, changeId, sealed, current, manifest: savedManifest,
          expectedNormativeHash: savedManifest.tasks.normative_hash });
      }
      const issues = [];
      const references = [savedManifest.requirement, savedManifest.design, ...savedManifest.spec, ...savedManifest.architecture,
        ...savedManifest.required_skills, ...savedManifest.contracts.map((entry) => ({ repository: entry.repository, path: entry.path, hash: entry.content_hash }))]
        .filter((reference) => reference && reference.repository === sealed.name);
      for (const reference of references) {
        try {
          if (hashReference(root, reference.path) !== reference.hash) issues.push(`reference ${reference.path} of ${sealed.name} changed since report execution`);
        } catch (error) {
          issues.push(error.message);
        }
      }
      return { issues, unknown: [] };
    });
  }
}

/**
 * Without the repository's history the latest binding cannot be selected, but every binding
 * that claims this exact sealed report (same report hash) must agree with the seal in every
 * field that needs no history (Amendment R5, rule 1). Older bindings of earlier report
 * versions stay out of scope, as they do when history is available.
 */
function sealedIdentityVerdict(shared, old, sddName) {
  const { changeId, reportName, cwd, reportHash } = shared;
  const issues = [];
  const reportReference = reportRelative(changeId, reportName);
  for (const candidate of listBindingFiles(changeId, reportName, old.name, cwd)) {
    if (candidate.unsafe) continue;
    let binding;
    try {
      binding = JSON.parse(fs.readFileSync(candidate.file, 'utf8'));
    } catch {
      continue;
    }
    if (binding?.report?.hash !== reportHash) continue;
    const tag = (message) => `${candidate.name}: ${message}`;
    const validation = validateNamed('evidence-binding', binding);
    if (!validation.valid) { issues.push(tag(`invalid evidence binding: ${validation.errors.join('; ')}`)); continue; }
    const unrecognised = Object.getOwnPropertyNames(binding).filter((key) => !BINDING_KEYS.has(key));
    if (unrecognised.length) issues.push(tag(`unrecognised binding fields: ${unrecognised.join(', ')}`));
    if (binding.current_commit_sha !== candidate.sha) issues.push(tag('destination identity does not match the file name'));
    if (binding.change_id !== changeId || binding.repository !== old.name) issues.push(tag('change or repository mismatch'));
    if (binding.report.path !== reportReference || binding.report.repository !== sddName) issues.push(tag('sealed report identity differs from the binding'));
    if (binding.previous_commit_sha !== old.commit_sha) issues.push(tag('sealed commit differs from the binding'));
    if (binding.governed_hash !== (old.tree_hash || old.source_hash)) issues.push(tag('governed digest differs from the sealed snapshot'));
    if (binding.equivalence && binding.equivalence.reviewed_tree_hash !== old.tree_hash) issues.push(tag('reviewed digest differs from the sealed snapshot'));
    for (const earlier of binding.supersedes || []) {
      const unsafe = unsafeBindingReason(cwd, changeId, earlier.path);
      if (unsafe) issues.push(tag(`lineage reference ${earlier.path} is not a contained regular binding file (${unsafe})`));
      else if (sha256(fs.readFileSync(path.join(cwd, earlier.path))) !== earlier.sha256) issues.push(tag(`lineage reference ${earlier.path} is missing or altered`));
    }
  }
  return { issues, unknown: [] };
}

export function validateEvidenceBinding(changeId, reportName, { cwd = process.cwd(), portable = false } = {}) {
  const verdict = { issues: [], unknown: [], notes: [] };
  const finish = () => {
    const issues = [...verdict.issues];
    if (portable) {
      verdict.notes.push(...verdict.unknown.map((entry) => ({ kind: LOCAL_ONLY, check: 'binding ancestry and committed content',
        reason: `${entry}${/fetch-depth/.test(entry) ? '' : '; fetch full history (fetch-depth: 0)'}` })));
    } else {
      issues.push(...verdict.unknown);
    }
    return { ok: issues.length === 0, issues, localOnly: verdict.notes };
  };
  let shared;
  let classified;
  try {
    const loaded = loadSealed(changeId, reportName, cwd);
    shared = { changeId, reportName, cwd, reportHash: loaded.reportHash, source: loaded.source, savedManifest: loaded.savedManifest };
    classified = classify(shared, portable);
  } catch (error) {
    verdict.issues.push(error.message);
    return finish();
  }
  const { contexts, sddName } = classified;
  const sddContext = contexts.get(sddName);
  if (sddContext?.kind === 'delivered') {
    verdict.notes.push({ kind: AFTER_DELIVERY, check: `normative sources on ${sddContext.branch}`,
      reason: 'not applicable after delivery: normative sources are verified at the covered commit' });
  } else if (sddContext?.kind === 'sealed-branch' || (sddContext?.kind === 'detached' && portable)) {
    settle(verdict, 'normative sources', () => normativeVerdict(shared, contexts, portable));
  }
  contextRepositoriesVerdict(shared, contexts, portable, verdict);
  for (const old of shared.source.repositories) {
    const context = contexts.get(old.name);
    if (!context) {
      verdict.issues.push(`repository ${old.name} is not in the stage handoff manifest`);
      continue;
    }
    if (context.kind === 'unavailable') {
      verdict.notes.push({ kind: LOCAL_ONLY, check: `governed content of repository ${old.name}`, reason: `repository ${old.name} is not available in this environment` });
      settle(verdict, `evidence binding for repository ${old.name}`, () => sealedIdentityVerdict(shared, old, sddName));
      continue;
    }
    if (context.kind === 'other-branch') {
      verdict.issues.push(`repository ${old.name} is on branch ${context.branch}; this evidence was sealed on branch ${old.branch}`);
      continue;
    }
    if (context.kind === 'detached') {
      if (!portable) {
        verdict.issues.push(`repository ${old.name} is in detached HEAD; check out branch ${old.branch}`);
        continue;
      }
      verdict.notes.push({ kind: LOCAL_ONLY, check: `branch identity of repository ${old.name}`, reason: `detached checkout; the content is compared as branch ${old.branch}` });
    }
    let unit;
    try {
      unit = unitFor(shared, old, context, sddName);
    } catch (error) {
      verdict.issues.push(`repository ${old.name}: ${error.message}`);
      continue;
    }
    if (context.kind === 'delivered') deliveredVerdict(unit, context, verdict);
    else onBranchVerdict(unit, verdict);
  }
  return finish();
}

export function bindEvidence(changeId, reportName, { cwd = process.cwd() } = {}) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(changeId)) throw new Error(`invalid change id: ${changeId}`);
  assertClearedEvidence(changeId, reportName, cwd);
  const loaded = loadSealed(changeId, reportName, cwd);
  const shared = { changeId, reportName, cwd, reportHash: loaded.reportHash, source: loaded.source, savedManifest: loaded.savedManifest };
  const { contexts, sddName } = classify(shared, false);
  for (const [name, context] of contexts) {
    if (context.kind !== 'sealed-branch') {
      throw new Error(`repository ${name} ${context.kind === 'detached' ? 'is in detached HEAD' : `is on branch ${context.branch}`}; bind on branch ${context.sealedBranch}`);
    }
  }
  const normative = normativeVerdict(shared, contexts, false);
  if (normative.issues.length) throw new Error(normative.issues.join('; '));
  const written = [];
  const existing = [];
  const pending = [];
  let changed = false;
  for (const old of shared.source.repositories) {
    const context = contexts.get(old.name);
    if (!context) throw new Error(`repository ${old.name} is not in the stage handoff manifest`);
    const unit = unitFor(shared, old, context, sddName);
    const { root, headSha, siblings: candidates } = unit;
    const entry = { name: old.name, ...snapshotRepository({ root, changeId, untrackedPaths: declaredSources(changeId, cwd)[old.name] || [] }) };
    if (headSha === old.commit_sha) {
      if (!sameContent(old, entry)) throw new Error(`repository source changed: ${old.name}`);
      continue;
    }
    changed = true;
    const row = assessRepository({ root, name: old.name, changeId, sealed: old, current: entry, manifest: shared.savedManifest,
      expectedNormativeHash: shared.source.normative_tasks_hash });
    if (old.tree_hash && commitTreeDigest({ root, commit: headSha, changeId }) !== old.tree_hash) {
      throw new Error(`governed content recorded in commit ${headSha} differs from the reviewed snapshot: commit exactly what was reviewed before binding`);
    }
    const unsafe = candidates.find((candidate) => candidate.unsafe);
    if (unsafe) throw new Error(`unsafe binding file ${unsafe.name}: ${unsafe.unsafe}; it must be a contained regular file`);
    const exact = candidates.find((candidate) => candidate.sha === headSha);
    if (exact) {
      const problems = bindingIssues(exact, unit);
      if (problems.issues.length || problems.unknown.length) {
        throw new Error(`contradictory evidence binding for destination ${headSha}: ${[...problems.issues, ...problems.unknown].join('; ')}`);
      }
      existing.push(exact.relative);
      continue;
    }
    const selection = selectLatest(candidates, root, headSha);
    if (selection.unknown) throw new HistoryUnavailableError(selection.unknown);
    if (selection.ambiguous) throw new Error(`ambiguous evidence bindings for ${old.name}: ${selection.ambiguous.map((candidate) => candidate.name).join(', ')}`);
    if (selection.latest) {
      const problems = bindingIssues(selection.latest, unit);
      if (!problems.issues.length && !problems.unknown.length) {
        existing.push(selection.latest.relative);
        continue;
      }
    }
    const predecessors = candidates.filter((candidate) => ancestry(root, candidate.sha, headSha) === 'yes');
    const binding = {
      schema: 'evidence-binding', schema_version: 1, change_id: changeId, repository: old.name,
      report: { repository: sddName, path: loaded.relative, hash: loaded.reportHash },
      previous_commit_sha: old.commit_sha, current_commit_sha: headSha,
      governed_hash: old.tree_hash || old.source_hash, evidence_only_paths: row.evidenceOnlyPaths,
      ...(row.equivalence ? { equivalence: { ...row.equivalence, original_receipts: shared.source.receipts || [] } } : {}),
      ...(predecessors.length ? { supersedes: predecessors.map((candidate) => ({ path: candidate.relative, sha256: sha256(fs.readFileSync(candidate.file)) })) } : {}),
      created_at: new Date().toISOString(),
    };
    const validation = validateNamed('evidence-binding', binding);
    if (!validation.valid) throw new Error(`invalid evidence binding: ${validation.errors.join('; ')}`);
    pending.push(binding);
  }
  if (!changed) throw new Error('no repository commit changed; evidence binding is unnecessary');
  for (const binding of pending) {
    const file = path.join(changeDirectory(changeId, cwd), bindingFileName(reportName, binding.repository, binding.current_commit_sha));
    fs.writeFileSync(file, JSON.stringify(binding, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    written.push(binding);
  }
  return { bindings: written, existing, created: written.length > 0 };
}
