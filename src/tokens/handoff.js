/** Stage-specific, source-bound context for memory-independent agent handoffs. */
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/config.js';
import { computeDesignRequired } from '../lifecycle/impact.js';
import { resolveSddRepo, resolveConfiguredRepoPath } from '../repos/config.js';
import { readImpactedRepos } from '../repos/impacted.js';
import { headingSection } from '../util/markdown.js';
import { validateNamed } from '../schema/validate.js';
import { auditEvidenceOf, hashReference, normativeTasksHash, sha256, snapshotRepository } from './evidence.js';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { assessRepository, checkoutContext, GIT_ENV, headCommit, HistoryUnavailableError, proveDeliveredContent, RepositoryUnavailableError, sameContent } from './equivalence.js';
import { readEvidenceFile, unsafeEvidenceReason, writeEvidenceFile } from '../util/fs-safe.js';

const methodologyRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function repoRoot(name, cwd, sddName) {
  if (name === sddName) return cwd;
  if (name === 'methodology') {
    // A packaged install has no Git history: unavailable, not an error.
    if (!fs.existsSync(path.join(methodologyRoot, '.git'))) {
      throw new RepositoryUnavailableError(name, 'the methodology source is not a Git checkout in this environment');
    }
    return methodologyRoot;
  }
  try {
    return resolveConfiguredRepoPath(name, { cwd, requireDirectory: true });
  } catch (error) {
    if (/path does not exist|is not a directory/.test(error.message)) throw new RepositoryUnavailableError(name, error.message);
    throw error;
  }
}

function reference(name, relativePath, cwd, sddName) {
  return { repository: name, path: relativePath, hash: hashReference(repoRoot(name, cwd, sddName), relativePath) };
}

/**
 * The base branch as recorded in the reviewed configuration: `playbook.config.yaml` at the
 * sealed commit of the SDD repository, never the checkout being evaluated, whose content may
 * be unreviewed (design Amendment R5, rule 6). Null when that commit or file is not available.
 */
export function reviewedBaseFor(cwd, sealedSddCommit, name) {
  if (!/^[a-f0-9]{40}$/.test(sealedSddCommit || '')) return null;
  try {
    const raw = execFileSync('git', ['show', `${sealedSddCommit}:playbook.config.yaml`],
      { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV }).toString('utf8');
    const config = yaml.load(raw) || {};
    return config.repos?.[name]?.default_base || config.github?.base_branch || null;
  } catch {
    return null;
  }
}

/** The sealed SDD-repository commit recorded in a manifest. */
export function sealedSddCommit(manifest, sddName) {
  return (manifest.repositories || []).find((entry) => entry.name === sddName)?.commit_sha || null;
}

function uniqueRefs(entries) {
  return [...new Map(entries.map((item) => [`${item.repository}:${item.path}`, item])).values()];
}

function criteria(body, heading, prefix, changeId) {
  const section = headingSection(body, heading) || '';
  const ids = [...new Set([...section.matchAll(new RegExp(`\\b${prefix}-[0-9]+\\b`, 'g'))].map((match) => match[0]))];
  return ids.map((id) => ({ id, reference: `openspec/changes/${changeId}/proposal.md#${heading.toLowerCase().replaceAll(' ', '-')}` }));
}

function declaredReferences(items, cwd, sddName) {
  if (!Array.isArray(items)) throw new Error('handoff reference declaration must be an array');
  return items.map(({ repository, path: relativePath }) => reference(repository, relativePath, cwd, sddName));
}

function requireDeclaration(handoff) {
  if (!handoff || typeof handoff !== 'object') throw new Error('tasks.md handoff declaration missing');
  for (const field of ['specs', 'architecture', 'contracts', 'required_skills', 'required_tools', 'runtime_coverage', 'unresolved_risks', 'blockers']) {
    if (!Array.isArray(handoff[field])) throw new Error(`tasks.md handoff.${field} declaration missing`);
  }
  return handoff;
}

/**
 * `resolveDetached(name)` is used only by portable validation: it supplies the sealed branch
 * for a detached checkout. Without it a detached HEAD is refused (design Amendment R5, rule 6).
 */
export function buildHandoffManifest(changeId, { cwd = process.cwd(), stage, agent, provider = 'unknown', model = 'unknown', resolveDetached = null, fallback = null } = {}) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(changeId)) throw new Error(`invalid change id: ${changeId}`);
  if (!stage || !agent) throw new Error('handoff stage and agent identity are required');
  const { config } = loadConfig({ cwd });
  const changeDir = path.join(cwd, 'openspec', 'changes', changeId);
  const proposalRaw = readEvidenceFile(cwd, `openspec/changes/${changeId}/proposal.md`, 'utf8');
  const proposal = matter(proposalRaw);
  const tasksRaw = readEvidenceFile(cwd, `openspec/changes/${changeId}/tasks.md`, 'utf8');
  const handoff = requireDeclaration(matter(tasksRaw).data.handoff);
  auditEvidenceOf(tasksRaw);
  const sdd = resolveSddRepo({ cwd });
  const impacted = readImpactedRepos(changeId, path.join(cwd, 'openspec', 'changes'));
  const names = [sdd.name, ...impacted.filter((name) => name !== sdd.name)];
  // Portable validation only: a repository that is not checked out keeps its sealed entries, so
  // every reference in the available repositories is still compared (Amendment R5, rule 1).
  const unavailable = (name, error) => {
    if (!fallback || !(error instanceof RepositoryUnavailableError)) throw error;
    fallback.onUnavailable?.(name);
  };
  const savedReference = (name, relativePath) => {
    const saved = fallback.manifest;
    const pool = [saved.requirement, saved.design, ...(saved.spec || []), ...(saved.architecture || []), ...(saved.required_skills || []),
      saved.tasks, ...(saved.contracts || []).map((entry) => ({ repository: entry.repository, path: entry.path, hash: entry.content_hash }))];
    const found = pool.find((entry) => entry && entry.repository === name && entry.path === relativePath);
    if (!found) throw new Error(`reference ${relativePath} of unavailable repository ${name} is not in the sealed manifest`);
    return { repository: name, path: relativePath, hash: found.hash };
  };
  const ref = (name, relativePath) => {
    try {
      return reference(name, relativePath, cwd, sdd.name);
    } catch (error) {
      unavailable(name, error);
      return savedReference(name, relativePath);
    }
  };
  const refs = (items) => {
    if (!Array.isArray(items)) throw new Error('handoff reference declaration must be an array');
    return items.map(({ repository, path: relativePath }) => ref(repository, relativePath));
  };
  const snapshot = (name) => {
    let root;
    try {
      root = repoRoot(name, cwd, sdd.name);
    } catch (error) {
      unavailable(name, error);
      const saved = [...(fallback.manifest.repositories || []), ...(fallback.manifest.context_repositories || [])].find((entry) => entry.name === name);
      if (!saved) throw new Error(`unavailable repository ${name} is not in the sealed manifest`);
      return { ...saved };
    }
    const entry = { name, ...snapshotRepository({ root, changeId, untrackedPaths: handoff.source_paths?.[name] || [] }) };
    if (entry.branch === null) {
      if (!resolveDetached) throw new Error(`detached HEAD in repository ${name}: check out the change branch first`);
      entry.branch = resolveDetached(name);
    }
    return entry;
  };
  const repositories = names.map(snapshot);
  const contextNames = handoff.context_repositories || [];
  if (contextNames.some((name) => names.includes(name))) throw new Error('context repository duplicates an impacted repository');
  const context_repositories = contextNames.map(snapshot);
  const requirement = ref(sdd.name, `openspec/changes/${changeId}/proposal.md`);
  const spec = uniqueRefs([
    ref(sdd.name, config.documents.system_spec),
    ...refs(handoff.specs),
  ]);
  const architecture = uniqueRefs([
    ref(sdd.name, config.documents.architecture),
    ...refs(handoff.architecture),
  ]);
  const designPath = path.join(changeDir, 'design.md');
  const designRequired = computeDesignRequired(proposal.data, config);
  if (designRequired && !fs.existsSync(designPath)) throw new Error(`required design missing: ${designPath}`);
  let design = null;
  if (fs.existsSync(designPath)) {
    const parsed = matter(readEvidenceFile(cwd, `openspec/changes/${changeId}/design.md`, 'utf8'));
    if (parsed.data.status !== 'approved') throw new Error(`design is not approved: ${designPath}`);
    design = ref(sdd.name, `openspec/changes/${changeId}/design.md`);
  }
  const tasks = { ...ref(sdd.name, `openspec/changes/${changeId}/tasks.md`), normative_hash: normativeTasksHash(tasksRaw) };
  const contractDeclarations = [
    ...(config.contract?.path_in_loom ? [{ repository: sdd.name, path: config.contract.path_in_loom }] : []),
    ...handoff.contracts,
  ];
  const contracts = uniqueRefs(refs(contractDeclarations))
    .map(({ repository, path: file, hash }) => ({ repository, path: file, content_hash: hash }));
  const required_skills = handoff.required_skills.map(({ name, repository, path: file }) => ({
    name, ...ref(repository, file),
  }));
  const acceptance_criteria = criteria(proposal.content, 'Acceptance criteria', 'AC', changeId);
  if (acceptance_criteria.length === 0) throw new Error('proposal has no numbered acceptance criteria');
  const error_cases = criteria(proposal.content, 'Error cases', 'EC', changeId);
  const security_criteria = criteria(proposal.content, 'Security considerations', 'SEC', changeId);
  // Every AC, EC and SEC either maps to runtime evidence or is declared non-runtime with a rationale (F05).
  const knownCriteria = new Set([...acceptance_criteria, ...error_cases, ...security_criteria].map((item) => item.id));
  const nonRuntime = handoff.non_runtime || [];
  if (!Array.isArray(nonRuntime)) throw new Error('tasks.md handoff.non_runtime must be a list');
  for (const entry of nonRuntime) {
    if (!knownCriteria.has(entry?.criterion)) throw new Error(`unknown non-runtime criterion: ${entry?.criterion}`);
    if (typeof entry.rationale !== 'string' || !entry.rationale.trim()) throw new Error(`non-runtime criterion ${entry.criterion} needs a rationale`);
  }
  for (const entry of handoff.runtime_coverage) {
    if (!knownCriteria.has(entry.criterion)) throw new Error(`unknown runtime criterion: ${entry.criterion}`);
    for (const name of entry.repositories) {
      if (!names.includes(name)) throw new Error(`unknown runtime repository: ${name}`);
    }
  }
  const identity_issues = [
    ...(provider === 'unknown' ? ['PROVIDER_UNAVAILABLE'] : []),
    ...(model === 'unknown' ? ['MODEL_UNAVAILABLE'] : []),
  ];
  const manifest = {
    schema: 'handoff-manifest', schema_version: 1, change_id: changeId, stage,
    requirement, spec, acceptance_criteria, error_cases, security_criteria,
    repositories, context_repositories, design, tasks, contracts, architecture, required_skills,
    required_tools: handoff.required_tools, runtime_coverage: handoff.runtime_coverage,
    ...(nonRuntime.length ? { non_runtime_criteria: nonRuntime.map(({ criterion, rationale }) => ({ criterion, rationale })) } : {}),
    unresolved_risks: handoff.unresolved_risks, blockers: handoff.blockers,
    producer: { agent, provider, model, provenance: 'caller_declared' },
    identity_issues, created_at: new Date().toISOString(),
  };
  if (!design) manifest.design_not_applicable_reason = 'Design not required by proposal impact and project configuration';
  const validation = validateNamed('handoff-manifest', manifest);
  if (!validation.valid) throw new Error(`invalid handoff manifest: ${validation.errors.join('; ')}`);
  return manifest;
}

/** Stage-stable governed semantics; evidence-only SHAs and task checkboxes are excluded. */
export function governedManifestHash(manifest) {
  return sha256(JSON.stringify(governedManifestContent(manifest)));
}

function governedManifestContent(manifest) {
  // The Git-comparable tree digest is the stable identity of governed content: unlike
  // `source_hash` it does not change when identical bytes are committed (a deletion
  // stops being a listed entry). Legacy manifests without it keep `source_hash`.
  const repositories = (items) => (items || []).map(({ name, branch, source_hash, tree_hash }) => (
    tree_hash ? { name, branch, tree_hash } : { name, branch, source_hash }));
  const governed = {
    change_id: manifest.change_id, stage: manifest.stage,
    requirement: manifest.requirement, spec: manifest.spec,
    acceptance_criteria: manifest.acceptance_criteria, error_cases: manifest.error_cases,
    security_criteria: manifest.security_criteria,
    repositories: repositories(manifest.repositories),
    context_repositories: repositories(manifest.context_repositories),
    design: manifest.design,
    tasks: { repository: manifest.tasks.repository, path: manifest.tasks.path, normative_hash: manifest.tasks.normative_hash },
    contracts: manifest.contracts, architecture: manifest.architecture,
    required_skills: manifest.required_skills, required_tools: manifest.required_tools,
    runtime_coverage: manifest.runtime_coverage, non_runtime_criteria: manifest.non_runtime_criteria,
    unresolved_risks: manifest.unresolved_risks, blockers: manifest.blockers,
  };
  return governed;
}

/** Shared normative identity across stages; commits, delivered branches and task bookkeeping may differ. */
export function assertNormativeManifestAgreement(manifest, verified) {
  const identity = (value) => {
    const { stage, repositories, context_repositories, ...normative } = governedManifestContent(value);
    return { ...normative, repositories: repositories.map(({ name }) => name),
      context_repositories: context_repositories.map(({ name }) => name) };
  };
  if (JSON.stringify(identity(manifest)) !== JSON.stringify(identity(verified))) {
    throw new Error('stage handoff normative identity differs from the shared evidence chain');
  }
}

function withoutTimestamp(manifest) {
  const { created_at, ...rest } = manifest;
  return rest;
}

/** Create an immutable stage file, or confirm an existing one; an existing file is read only if contained and regular. */
function writeImmutableStage(cwd, file, content) {
  const relative = path.relative(cwd, file);
  const unsafe = unsafeEvidenceReason(cwd, relative);
  if (unsafe === 'missing') {
    fs.writeFileSync(file, content, { flag: 'wx' });
    return;
  }
  if (readEvidenceFile(cwd, relative, 'utf8') !== content) throw new Error(`immutable handoff version differs: ${file}`);
}

export function writeHandoffManifest(changeId, options = {}) {
  const cwd = options.cwd || process.cwd();
  const file = path.join(cwd, 'openspec', 'changes', changeId, 'handoff-manifest.json');
  const manifest = buildHandoffManifest(changeId, options);
  if (!/^sdd-[a-z-]+$/.test(manifest.stage)) throw new Error(`invalid handoff stage: ${manifest.stage}`);
  const content = JSON.stringify(manifest, null, 2) + '\n';
  const stageFile = path.join(cwd, 'openspec', 'changes', changeId,
    `handoff-manifest-${manifest.stage}-${sha256(content)}.json`);
  if (fs.lstatSync(file, { throwIfNoEntry: false })) {
    const old = JSON.parse(readEvidenceFile(cwd, `openspec/changes/${changeId}/handoff-manifest.json`, 'utf8'));
    if (JSON.stringify(withoutTimestamp(old)) === JSON.stringify(withoutTimestamp(manifest))) {
      const stageContent = JSON.stringify(old, null, 2) + '\n';
      const oldStageFile = path.join(cwd, 'openspec', 'changes', changeId,
        `handoff-manifest-${old.stage}-${sha256(stageContent)}.json`);
      writeImmutableStage(cwd, oldStageFile, stageContent);
      return { path: file, stagePath: oldStageFile, manifest: old, changed: false };
    }
  }
  writeImmutableStage(cwd, stageFile, content);
  writeEvidenceFile(cwd, `openspec/changes/${changeId}/handoff-manifest.json`, content);
  return { path: file, stagePath: stageFile, manifest, changed: true };
}

const COMMIT_IDENTITY = ['commit_sha', 'source_hash', 'inventory_count'];

function withoutCommitIdentity(manifest) {
  const strip = (items) => (items || []).map((item) => {
    const copy = { ...item };
    for (const key of COMMIT_IDENTITY) delete copy[key];
    return copy;
  });
  const { created_at, ...rest } = manifest;
  return { ...rest, repositories: strip(manifest.repositories), context_repositories: strip(manifest.context_repositories) };
}

const LOCAL_ONLY = 'local-only';
const AFTER_DELIVERY = 'after-delivery';

/**
 * A manifest whose only differences are repository commit identity is fresh by content
 * when, per repository, ancestry is verifiable and the Git tree recorded at the current
 * commit still has the recorded governed digest and references. Every repository is
 * evaluated; a history that cannot be examined in one never stops the others
 * (design Amendment R5, rule 1). The saved manifest is never rewritten.
 */
function committedDescendantCheck(saved, current, { cwd, changeId }) {
  if (JSON.stringify(withoutCommitIdentity(saved)) !== JSON.stringify(withoutCommitIdentity(current))) {
    return { issues: ['source or content changed'], unknown: [] };
  }
  const issues = [];
  const unknown = [];
  const sddName = resolveSddRepo({ cwd }).name;
  for (const group of ['repositories', 'context_repositories']) {
    for (const entry of current[group] || []) {
      const sealed = (saved[group] || []).find((item) => item.name === entry.name);
      if (!sealed) { issues.push(`repository ${entry.name} is not in the saved manifest`); continue; }
      if (sealed.commit_sha === entry.commit_sha) {
        if (!sameContent(sealed, entry)) issues.push(`repository ${entry.name}: source or content changed`);
        continue;
      }
      try {
        assessRepository({ root: repoRoot(entry.name, cwd, sddName), name: entry.name, changeId, sealed, current: entry,
          manifest: saved, expectedNormativeHash: saved.tasks.normative_hash });
      } catch (error) {
        if (error instanceof HistoryUnavailableError) unknown.push(`repository ${entry.name}: ${error.message}`);
        else issues.push(`repository ${entry.name}: ${error.message}`);
      }
    }
  }
  return { issues, unknown };
}

/**
 * Per-repository freshness, used when the whole manifest cannot be rebuilt: siblings that are
 * not checked out (portable), or an SDD root on its base branch. Every repository that is not
 * itself delivered keeps its full content check (design Amendment R5, rules 1, 6 and 7).
 */
function perRepositoryCheck(saved, { cwd, changeId, contexts }) {
  const issues = [];
  const unknown = [];
  const notes = [];
  const sddName = resolveSddRepo({ cwd }).name;
  const rootOf = (name) => {
    const context = contexts.get(name);
    if (context && context.kind !== 'unavailable') return context.root;
    if (context) return null;
    try {
      return repoRoot(name, cwd, sddName);
    } catch (error) {
      if (error instanceof RepositoryUnavailableError) {
        contexts.set(name, { kind: 'unavailable' });
        return null;
      }
      throw error;
    }
  };
  const deliveredSdd = contexts.get(sddName)?.kind === 'delivered';
  const references = [saved.requirement, saved.design, ...saved.spec, ...saved.architecture, ...saved.required_skills,
    ...saved.contracts.map((entry) => ({ repository: entry.repository, path: entry.path, hash: entry.content_hash }))].filter(Boolean);
  for (const reference of references) {
    if (contexts.get(reference.repository)?.kind === 'delivered') continue;
    const root = rootOf(reference.repository);
    if (!root) continue;
    try {
      if (hashReference(root, reference.path) !== reference.hash) issues.push(`reference ${reference.path} differs from the recorded hash`);
    } catch (error) {
      issues.push(error.message);
    }
  }
  const tasksRoot = deliveredSdd ? null : rootOf(saved.tasks.repository);
  if (tasksRoot) {
    try {
      const raw = readEvidenceFile(tasksRoot, saved.tasks.path);
      if (sha256(raw) !== saved.tasks.hash || normativeTasksHash(raw.toString('utf8')) !== saved.tasks.normative_hash) {
        issues.push(`tasks reference ${saved.tasks.path} differs from the recorded hash`);
      }
    } catch (error) {
      issues.push(error.message);
    }
  }
  const declared = matter(readEvidenceFile(cwd, `openspec/changes/${changeId}/tasks.md`, 'utf8')).data.handoff || {};
  for (const group of ['repositories', 'context_repositories']) {
    for (const sealed of saved[group] || []) {
      const context = contexts.get(sealed.name);
      if (context?.kind === 'delivered') continue;
      const root = rootOf(sealed.name);
      if (!root) continue;
      const entry = { name: sealed.name, ...snapshotRepository({ root, changeId, untrackedPaths: declared.source_paths?.[sealed.name] || [] }) };
      if (entry.branch === null) entry.branch = sealed.branch;
      try {
        if (sealed.commit_sha === entry.commit_sha) {
          if (!sameContent(sealed, entry)) issues.push(`repository ${sealed.name}: source or content changed`);
        } else {
          assessRepository({ root, name: sealed.name, changeId, sealed, current: entry, manifest: saved, expectedNormativeHash: saved.tasks.normative_hash });
        }
      } catch (error) {
        if (error instanceof HistoryUnavailableError) {
          unknown.push(`repository ${sealed.name}: ${error.message}`);
        } else {
          issues.push(`repository ${sealed.name}: ${error.message}`);
        }
      }
    }
  }
  for (const [name, context] of contexts) {
    if (context.kind === 'unavailable') {
      notes.push({ kind: LOCAL_ONLY, check: `handoff freshness for repository ${name}`, reason: `repository ${name} is not available in this environment` });
    }
  }
  return { issues, unknown, notes };
}

/**
 * Classify each sealed repository's checkout (design Amendment R5, rule 6). Returns the
 * contexts plus the definitive issues and notes that the classification alone settles.
 */
function classifyCheckouts(saved, { cwd, portable }) {
  const sddName = resolveSddRepo({ cwd }).name;
  const contexts = new Map();
  const issues = [];
  const notes = [];
  for (const group of ['repositories', 'context_repositories']) {
    for (const sealed of saved[group] || []) {
      let root;
      try {
        root = repoRoot(sealed.name, cwd, sddName);
      } catch (error) {
        if (portable && error instanceof RepositoryUnavailableError) {
          contexts.set(sealed.name, { kind: 'unavailable' });
          continue;
        }
        throw error;
      }
      const context = { ...checkoutContext(root, sealed.branch, { defaultBase: reviewedBaseFor(cwd, sealedSddCommit(saved, sddName), sealed.name) }), root, sealed };
      contexts.set(sealed.name, context);
      if (context.kind === 'other-branch') {
        issues.push(`repository ${sealed.name} is on branch ${context.branch}; this handoff was sealed on branch ${sealed.branch}`);
      } else if (context.kind === 'detached') {
        if (portable) {
          notes.push({ kind: LOCAL_ONLY, check: `branch identity of repository ${sealed.name}`, reason: `detached checkout; the content is compared as branch ${sealed.branch}` });
        } else {
          issues.push(`repository ${sealed.name} is in detached HEAD; check out branch ${sealed.branch}`);
        }
      } else if (context.kind === 'delivered') {
        notes.push({ kind: AFTER_DELIVERY, check: `handoff freshness of repository ${sealed.name} on ${context.branch}`,
          reason: `not applicable after delivery: sealed on ${sealed.branch}; post-merge verification governs ${context.branch}` });
        try {
          proveDeliveredContent({ root, name: sealed.name, sealed, headSha: headCommit(root), changeId: saved.change_id,
            manifest: saved, expectedNormativeHash: saved.tasks.normative_hash });
        } catch (error) {
          if (!(error instanceof HistoryUnavailableError)) issues.push(`repository ${sealed.name}: ${error.message}`);
          else if (portable) notes.push({ kind: LOCAL_ONLY, check: `delivery of repository ${sealed.name}`, reason: `${error.message}; fetch full history (fetch-depth: 0)` });
          else issues.push(`repository ${sealed.name}: delivery to ${context.branch} cannot be verified in a shallow history`);
        }
      }
    }
  }
  return { contexts, issues, notes };
}

/**
 * Freshness of the saved manifest. By default the exact HEAD must match. With
 * `allowCommittedDescendants` a later commit with identical governed content is
 * accepted after verification (design Amendment R2); sealing and receipts never use it.
 * Checkout context and aggregation follow design Amendment R5.
 */
export function validateHandoffManifest(changeId, { cwd = process.cwd(), allowCommittedDescendants = false, portable = false } = {}) {
  const relative = `openspec/changes/${changeId}/handoff-manifest.json`;
  if (!fs.lstatSync(path.join(cwd, relative), { throwIfNoEntry: false })) return { ok: false, issues: ['handoff-manifest.json missing'] };
  try {
    const saved = JSON.parse(readEvidenceFile(cwd, relative, 'utf8'));
    const validation = validateNamed('handoff-manifest', saved);
    if (!validation.valid) return { ok: false, issues: validation.errors };
    const classified = classifyCheckouts(saved, { cwd, portable });
    const { contexts, notes } = classified;
    const issues = classified.issues.map((issue) => `handoff-manifest.json: ${issue}`);
    const finish = (more = [], unknown = []) => {
      const all = [...issues, ...more];
      if (!portable) all.push(...unknown.map((entry) => `handoff-manifest.json: ${entry}`));
      else notes.push(...unknown.map((entry) => ({ kind: LOCAL_ONLY, check: 'handoff ancestry and committed content', reason: `${entry}; fetch full history (fetch-depth: 0)` })));
      return { ok: all.length === 0, issues: all, localOnly: notes };
    };
    if (issues.length) return finish();
    const sddName = resolveSddRepo({ cwd }).name;
    if (contexts.get(sddName)?.kind === 'delivered') {
      const checked = perRepositoryCheck(saved, { cwd, changeId, contexts });
      notes.push(...checked.notes);
      return finish(checked.issues.map((issue) => `handoff-manifest.json: ${issue}`), checked.unknown);
    }
    const current = buildHandoffManifest(changeId, {
      cwd, stage: saved.stage, agent: saved.producer.agent,
      provider: saved.producer.provider, model: saved.producer.model,
      resolveDetached: (name) => contexts.get(name)?.sealed?.branch,
      fallback: portable ? { manifest: saved } : null,
    });
    for (const [name, context] of contexts) {
      if (context.kind === 'unavailable') {
        notes.push({ kind: LOCAL_ONLY, check: `handoff freshness for repository ${name}`, reason: `repository ${name} is not available in this environment` });
      }
    }
    // A delivered sibling is compared as sealed: its freshness is not applicable after delivery.
    for (const group of ['repositories', 'context_repositories']) {
      current[group] = (current[group] || []).map((entry) => (contexts.get(entry.name)?.kind === 'delivered'
        ? (saved[group] || []).find((item) => item.name === entry.name) || entry : entry));
    }
    if (JSON.stringify(withoutTimestamp(saved)) === JSON.stringify(withoutTimestamp(current))) return finish();
    if (!allowCommittedDescendants) return finish(['handoff-manifest.json stale: source or content changed']);
    const outcome = committedDescendantCheck(saved, current, { cwd, changeId });
    return finish(outcome.issues.map((issue) => `handoff-manifest.json stale: ${issue}`), outcome.unknown);
  } catch (err) {
    return { ok: false, issues: [`handoff-manifest.json invalid: ${err.message}`] };
  }
}
