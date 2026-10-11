/**
 * Equivalence between a sealed snapshot and a later commit: verifiable ancestry,
 * the governed tree actually recorded in Git, and the governed references at that
 * commit. Shared by evidence binding and handoff freshness (design Amendments R1, R2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { auditAtCommit, commitTreeDigest, currentBranch, isChangeEvidence, normativeTasksHash, sha256 } from './evidence.js';
import { resolveRepoBaseBranch } from '../repos/git-state.js';

/** The recorded commit cannot be examined here (shallow clone or absent history). Never a pass. */
export class HistoryUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.code = 'HISTORY_UNAVAILABLE';
  }
}

/** A sibling repository (or the methodology source) is not checked out here. Local-only in portable mode. */
export class RepositoryUnavailableError extends Error {
  constructor(name, message) {
    super(message);
    this.code = 'REPOSITORY_UNAVAILABLE';
    this.repository = name;
  }
}

/** Git as recorded: replace refs never substitute objects during evidence checks (Amendment R5, rule 2). */
export const GIT_ENV = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };

function git(root, args) {
  return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024, env: GIT_ENV }).toString('utf8').trim();
}

/** Grafts rewrite parentage outside the recorded objects; evidence is never judged under them. */
export function assertNoGrafts(root) {
  const file = git(root, ['rev-parse', '--git-path', 'info/grafts']);
  if (fs.existsSync(path.isAbsolute(file) ? file : path.join(root, file))) {
    throw new Error('the repository uses Git grafts; evidence is judged only on recorded history');
  }
}

/** Git runner over a repository root, `(args) => string`, with the recorded-history environment. */
function rootRunner(root) {
  return (args) => git(root, args);
}

/**
 * True only when `sha` names a commit object itself (a tag or tree with that id is not a commit).
 * `runGit` is an injected `(args) => string` Git runner, as in `src/github/`.
 */
export function commitExistsWith(runGit, sha) {
  try {
    return String(runGit(['cat-file', '-t', sha])).trim() === 'commit';
  } catch {
    return false;
  }
}

function isShallowWith(runGit) {
  try {
    return String(runGit(['rev-parse', '--is-shallow-repository'])).trim() === 'true';
  } catch {
    return false;
  }
}

function commitExists(root, sha) {
  return commitExistsWith(rootRunner(root), sha);
}

/**
 * Three-valued ancestry (design Amendment R5, rule 2): 'yes', 'no' or 'unknown'. In a
 * repository that is not shallow, an absent commit belongs to no history there, so the
 * answer is 'no'; 'unknown' exists only when a shallow history cannot decide it.
 * The single decision behind both evidence binding (`ancestry`) and post-merge delivery
 * (`src/github/index.js`), over an injected Git runner.
 */
export function ancestryWith(runGit, ancestor, descendant) {
  const shallow = isShallowWith(runGit);
  if (!commitExistsWith(runGit, ancestor) || !commitExistsWith(runGit, descendant)) return shallow ? 'unknown' : 'no';
  try {
    runGit(['merge-base', '--is-ancestor', ancestor, descendant]);
    return 'yes';
  } catch (error) {
    if (error.status !== 1) throw new Error(`cannot examine Git ancestry from ${ancestor} to ${descendant}`);
    return shallow ? 'unknown' : 'no';
  }
}

export function ancestry(root, ancestor, descendant) {
  return ancestryWith(rootRunner(root), ancestor, descendant);
}

/** Require ancestry: HistoryUnavailableError only when undecidable, otherwise a definitive failure. */
export function assertAncestry(root, ancestor, descendant) {
  const answer = ancestry(root, ancestor, descendant);
  if (answer === 'yes') return;
  if (answer === 'unknown') {
    throw new HistoryUnavailableError(`history is shallow; ancestry from ${ancestor} to ${descendant} cannot be verified`);
  }
  if (!commitExists(root, ancestor)) {
    throw new Error(`recorded commit ${ancestor} does not exist in this repository's complete history (history rewritten after sealing, or foreign evidence)`);
  }
  throw new Error(`missing Git ancestry from ${ancestor} to ${descendant}`);
}

/**
 * Same governed content across checkouts: the Git-comparable digest (content, file or symlink,
 * executable bit) when both sides have it, so a different umask on another machine is not a
 * change; the working-tree digest only as a fallback.
 */
export function sameContent(sealed, current) {
  if (sealed.tree_hash && current.tree_hash) return sealed.tree_hash === current.tree_hash;
  return sealed.source_hash === current.source_hash;
}

export function headCommit(root) {
  return git(root, ['rev-parse', 'HEAD']);
}

/**
 * Where a repository's checkout stands relative to the branch recorded in sealed evidence
 * (design Amendment R5, rule 6): 'sealed-branch', 'detached', 'delivered' (the base branch:
 * the configured one, else origin/HEAD) or 'other-branch'.
 */
export function checkoutContext(root, sealedBranch, { defaultBase = null } = {}) {
  assertNoGrafts(root);
  const branch = currentBranch(root);
  if (branch === sealedBranch) return { kind: 'sealed-branch', branch, base: null };
  if (branch === null) return { kind: 'detached', branch, base: null };
  // The configured base is authoritative; a clone's origin/HEAD is only a fallback.
  const baseBranch = defaultBase || resolveRepoBaseBranch({ repoPath: root }).baseBranch;
  if (baseBranch && branch === baseBranch) return { kind: 'delivered', branch, base: baseBranch };
  return { kind: 'other-branch', branch, base: baseBranch };
}

/**
 * Paths changed between the sealed SHA and the destination SHA. Evidence artifacts
 * (and tasks.md, whose normative content is checked separately) are one class;
 * everything else is a governed path that only an identical committed tree can excuse.
 */
export function interveningChanges(root, oldSha, currentSha, changeId) {
  assertAncestry(root, oldSha, currentSha);
  // Per-commit changes plus the net tree difference: a merge commit's own changes are never missed.
  const changed = [
    ...git(root, ['log', '--format=', '--name-only', '--no-renames', `${oldSha}..${currentSha}`]).split('\n'),
    ...git(root, ['diff', '--name-only', '--no-renames', oldSha, currentSha]).split('\n'),
  ].filter(Boolean);
  const commits = git(root, ['rev-list', '--reverse', `${oldSha}..${currentSha}`]).split('\n').filter(Boolean);
  const prefix = `openspec/changes/${changeId}/`;
  const paths = [...new Set(changed)].sort();
  // The same evidence set the governed digest excludes, as the plan records it at the destination.
  const audit = auditAtCommit(root, currentSha, changeId);
  const evidence = paths.filter((file) => file.startsWith(prefix) && isChangeEvidence(file.slice(prefix.length), audit));
  const governed = paths.filter((file) => !evidence.includes(file));
  return { paths, evidence, governed, commits };
}

export function showAtCommit(root, commit, file) {
  try {
    return execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, env: GIT_ENV });
  } catch {
    return null;
  }
}

/** The governed references recorded at the destination commit must keep their sealed hashes. */
export function verifyReferencesAtCommit(root, commit, repoName, savedManifest, expectedNormativeHash) {
  const references = [savedManifest.requirement, savedManifest.design, ...savedManifest.spec, ...savedManifest.architecture,
    ...savedManifest.required_skills,
    ...savedManifest.contracts.map((entry) => ({ repository: entry.repository, path: entry.path, hash: entry.content_hash })),
  ].filter((reference) => reference && reference.repository === repoName);
  for (const reference of references) {
    const content = showAtCommit(root, commit, reference.path);
    if (!content) throw new Error(`governed reference ${reference.path} is not recorded in the destination commit of ${repoName}`);
    if (sha256(content) !== reference.hash) throw new Error(`governed reference ${reference.path} differs in the destination commit of ${repoName}`);
  }
  if (savedManifest.tasks.repository === repoName) {
    const content = showAtCommit(root, commit, savedManifest.tasks.path);
    if (!content) throw new Error(`normative plan ${savedManifest.tasks.path} is not recorded in the destination commit of ${repoName}`);
    if (normativeTasksHash(content.toString('utf8')) !== expectedNormativeHash) {
      throw new Error(`normative plan differs in the destination commit of ${repoName}`);
    }
  }
}

export function verifyEvidenceOnlyTasks(root, oldSha, currentSha, changeId, expectedNormativeHash) {
  const file = `openspec/changes/${changeId}/tasks.md`;
  for (const sha of git(root, ['rev-list', `${oldSha}..${currentSha}`]).split('\n').filter(Boolean)) {
    const historical = showAtCommit(root, sha, file);
    if (historical && normativeTasksHash(historical.toString('utf8')) !== expectedNormativeHash) {
      throw new Error('intervening tasks.md commit changed normative plan content');
    }
  }
}

/**
 * Decide whether `current` (a later state of the repository) is equivalent to the
 * `sealed` snapshot. Throws when it is not, or HistoryUnavailableError when that
 * cannot be established here.
 */
export function assessRepository({ root, name, changeId, sealed, current, manifest, expectedNormativeHash }) {
  if (sealed.branch !== current.branch) throw new Error(`repository branch changed: ${name}`);
  const sameSource = () => {
    if (!sameContent(sealed, current)) throw new Error(`repository source changed: ${name}`);
  };
  if (sealed.commit_sha === current.commit_sha) {
    sameSource();
    return { old: sealed, current, mode: 'unchanged', evidenceOnlyPaths: [] };
  }
  // Provable without history: a different governed digest is a change in either mode (Amendment R5, rule 1).
  if (sealed.tree_hash && current.tree_hash && sealed.tree_hash !== current.tree_hash) {
    throw new Error(`repository source tree changed: ${name}`);
  }
  const changes = interveningChanges(root, sealed.commit_sha, current.commit_sha, changeId);
  if (changes.governed.length === 0) {
    sameSource();
    verifyEvidenceOnlyTasks(root, sealed.commit_sha, current.commit_sha, changeId, expectedNormativeHash);
    return { old: sealed, current, mode: 'evidence-only', evidenceOnlyPaths: changes.paths };
  }
  // An implementation commit: only a destination tree identical to the reviewed snapshot is excused.
  if (!sealed.tree_hash) {
    throw new Error(`${name}: report was sealed before the governed tree digest existed; rerun the gate on the committed SHA`);
  }
  if (!current.tree_hash || current.tree_hash !== sealed.tree_hash) throw new Error(`repository source tree changed: ${name}`);
  const committedTreeHash = commitTreeDigest({ root, commit: current.commit_sha, changeId });
  if (committedTreeHash === null) {
    throw new Error(`${name}: governed tree cannot be compared consistently at the destination commit; rerun the gate`);
  }
  if (committedTreeHash !== sealed.tree_hash) {
    throw new Error(`governed content recorded in the destination commit differs from the reviewed snapshot: ${name}`);
  }
  verifyReferencesAtCommit(root, current.commit_sha, name, manifest, expectedNormativeHash);
  return { old: sealed, current, mode: 'identical-governed-content', evidenceOnlyPaths: changes.evidence,
    equivalence: { kind: 'identical-governed-content', reviewed_tree_hash: sealed.tree_hash, committed_tree_hash: committedTreeHash,
      governed_paths_committed: changes.governed, intervening_commits: changes.commits } };
}

/**
 * A repository evaluated as delivered must prove its reviewed content is in its history: the
 * sealed commit, or a later commit on the ancestry path to HEAD, whose committed governed digest
 * equals the reviewed digest and whose governed references keep their sealed hashes (Amendment
 * R5, rules 6–7). Returns the covering commit; HistoryUnavailableError when undecidable.
 */
export function proveDeliveredContent({ root, name, sealed, headSha, changeId, manifest, expectedNormativeHash, limit = 500 }) {
  const reach = ancestry(root, sealed.commit_sha, headSha);
  if (reach === 'unknown') throw new HistoryUnavailableError(`history is shallow; delivery of ${sealed.commit_sha} cannot be verified`);
  if (reach === 'no') throw new Error(`sealed commit ${sealed.commit_sha} of ${name} is not in the history of HEAD`);
  if (!sealed.tree_hash) throw new Error(`${name}: sealed before the governed tree digest existed; rerun the gate`);
  const later = git(root, ['rev-list', '--reverse', '--ancestry-path', `${sealed.commit_sha}..${headSha}`]).split('\n').filter(Boolean);
  const candidates = [sealed.commit_sha, ...later];
  for (const commit of candidates.slice(0, limit)) {
    if (commitTreeDigest({ root, commit, changeId }) !== sealed.tree_hash) continue;
    verifyReferencesAtCommit(root, commit, name, manifest, expectedNormativeHash);
    return commit;
  }
  throw new Error(`${name}: the reviewed content is not recorded in any commit from the sealed commit to HEAD${candidates.length > limit ? ` (first ${limit} searched)` : ''}`);
}

