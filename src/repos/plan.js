/**
 * Multi-repo planning + branch prep — ported from specloom's
 * `buildRepoPlan`/`buildCommitPlan`/`prepareRepos` (framework/cli/lib.js,
 * ADR-023/ADR-024). playbook-ai PLANS; the agent + `gh` EXECUTE.
 * `repo-plan`/`commit-plan` are read-only; `prepareRepos` is the only
 * mutator and only creates/switches branches — never add/commit/push/--force,
 * never a destructive checkout, never touches a git-unsafe repo. Every git
 * call goes through execFileSync('git', argv) with no shell.
 */
import matter from 'gray-matter';
import { execFileSync } from 'node:child_process';
import { parseMarkdownHeadings, headingSection } from '../util/markdown.js';
import { assertSafeSlug } from './slug.js';
import { resolveSddRepo, resolveConfiguredRepoPath, REPO_PLAN_SCHEMA_VERSION, SDD_REPO_DEFAULT_NAME } from './config.js';
import { readRepoGitState, resolveRepoBaseBranch } from './git-state.js';
import { classifyRepoFiles, parseGroupedFilesTouched } from './classify.js';
import { collectChangedFiles } from './changed-files.js';
import { readImpactedRepos, readProposalBody, defaultChangesDir } from './impacted.js';
import { loadConfig } from '../config/config.js';

export { REPO_PLAN_SCHEMA_VERSION };

function sddRepoRoleName(name, sddRepoName) {
  return name === sddRepoName ? 'sdd' : 'sibling';
}

function verificationDescriptors(repoConfig) {
  const verification = repoConfig?.verification;
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) return [];
  return Object.entries(verification)
    .filter(([, command]) => typeof command === 'string' && command.trim() !== '')
    .map(([name, command]) => ({ name, command: command.trim() }));
}

/** Builds one read-only plan entry for a single repo. No git mutation, no writes. */
function buildRepoEntry({ name, sddRepoName, repoPath, repoConfig, declared, slug, cwd }) {
  const role = sddRepoRoleName(name, sddRepoName);
  const gitState = readRepoGitState({ repoPath, targetBranch: slug });
  const entry = {
    name,
    role,
    path: repoPath,
    baseBranch: null,
    baseResolved: false,
    baseSource: null,
    currentBranch: gitState.currentBranch,
    targetBranch: slug,
    dirty: gitState.dirty,
    candidateFiles: [],
    unrelatedFiles: [],
    expectedButMissing: [],
    protectedStaged: [],
    validations: [],
    requiresHuman: false,
    blocker: null,
  };

  // repo_declared_but_missing / ambiguous_git_state win before anything else.
  if (gitState.blocker === 'repo_declared_but_missing' || gitState.blocker === 'ambiguous_git_state') {
    entry.blocker = gitState.blocker;
    entry.requiresHuman = true;
    return entry;
  }

  const base = resolveRepoBaseBranch({ repoPath, defaultBase: repoConfig?.default_base ?? null });
  entry.baseBranch = base.baseBranch;
  entry.baseResolved = base.baseResolved;
  entry.baseSource = base.baseSource;

  let changed = [];
  if (base.baseResolved) {
    try {
      changed = collectChangedFiles(slug, {
        baseRef: base.baseBranch,
        repoName: role === 'sdd' ? null : name,
        cwd,
      }).files;
    } catch {
      changed = [];
    }
  }

  const classified = classifyRepoFiles({
    declared,
    changed,
    protectedPaths: Array.isArray(repoConfig?.protected_paths) ? repoConfig.protected_paths : [],
  });
  Object.assign(entry, classified);

  entry.validations =
    role === 'sdd'
      ? [{ name: 'validate', command: `playbook validate ${slug}` }]
      : verificationDescriptors(repoConfig);

  // Blocker precedence, first-wins, fail-closed:
  //   ...missing/ambiguous (above) -> dirty_worktree_on_wrong_branch -> base_branch_unresolved
  //   -> undeclared_files_modified (only when the repo declared zero files)
  //   -> expected_files_absent -> protected_path_staged.
  let blocker = gitState.blocker || null; // only dirty_worktree_on_wrong_branch can survive to here
  if (!blocker && !base.baseResolved) blocker = 'base_branch_unresolved';
  if (!blocker && declared.length === 0 && classified.unrelatedFiles.length > 0) {
    blocker = 'undeclared_files_modified';
  }
  if (!blocker && classified.expectedButMissing.length > 0) blocker = 'expected_files_absent';
  if (!blocker && classified.protectedStaged.length > 0) blocker = 'protected_path_staged';
  entry.blocker = blocker;
  entry.requiresHuman = !!blocker;
  return entry;
}

/**
 * Read-only multi-repo plan. One entry per impacted repo (from
 * `readImpactedRepos`) plus the SDD repo, deduped by name. A repo not in
 * `## Impacted repos` is never included. No git mutation, no filesystem writes.
 */
export function buildRepoPlan(slug, { cwd = process.cwd(), changesDir = defaultChangesDir(cwd) } = {}) {
  assertSafeSlug(slug);
  const sddRepo = resolveSddRepo({ cwd });
  const { config } = loadConfig({ cwd });
  const configRepos =
    config && config.repos && typeof config.repos === 'object' && !Array.isArray(config.repos) ? config.repos : {};

  const proposalBody = matter(readProposalBody(slug, changesDir)).content;
  const filesSection = headingSection(proposalBody, 'Files touched');
  const filesMap = parseGroupedFilesTouched(filesSection, {
    allowlist: Object.keys(configRepos),
    sddRepoName: sddRepo.name,
  });

  const impacted = readImpactedRepos(slug, changesDir);
  const names = [sddRepo.name, ...impacted.filter((n) => n !== sddRepo.name)];

  const repos = names.map((name) => {
    const isSdd = name === sddRepo.name;
    let repoPath;
    let repoConfig;
    if (isSdd) {
      repoPath = sddRepo.path;
      repoConfig = configRepos[name] || null;
    } else {
      repoConfig = configRepos[name];
      if (!repoConfig) {
        throw new Error(`Unknown impacted repo "${name}" (not found in playbook.config.yaml repos)`);
      }
      // Resolve the declared path without requiring the directory to exist —
      // a missing directory surfaces as the repo_declared_but_missing blocker.
      repoPath = resolveConfiguredRepoPath(name, { cwd, requireDirectory: false });
    }
    return buildRepoEntry({ name, sddRepoName: sddRepo.name, repoPath, repoConfig, declared: filesMap[name] || [], slug, cwd });
  });

  return { schemaVersion: REPO_PLAN_SCHEMA_VERSION, slug, sddRepo: sddRepo.name, repos };
}

/**
 * PR-payload plan. For each repo with candidate changes and no blocker,
 * builds `{ repo, title, body, base, head, files, validationEvidence,
 * rollbackNote }`. This never invokes `gh` — it only assembles data.
 */
export function buildCommitPlan(slug, { cwd = process.cwd(), changesDir = defaultChangesDir(cwd) } = {}) {
  const plan = buildRepoPlan(slug, { cwd, changesDir });
  const proposalBody = matter(readProposalBody(slug, changesDir)).content;
  const title = parseMarkdownHeadings(proposalBody).find((h) => h.level === 1)?.title || slug;

  const payloads = plan.repos
    .filter((entry) => !entry.blocker && entry.candidateFiles.length > 0)
    .map((entry) => ({
      repo: entry.name,
      title,
      body:
        `Implements \`${slug}\` in \`${entry.name}\`.\n\n` +
        `See openspec/changes/${slug}/ for the proposal, acceptance criteria, and context packet.\n\n` +
        `Files:\n${entry.candidateFiles.map((f) => `- ${f}`).join('\n')}`,
      base: entry.baseBranch,
      head: slug,
      files: entry.candidateFiles,
      validationEvidence: entry.validations,
      rollbackNote:
        `Delete branch \`${slug}\` in \`${entry.name}\` (from base \`${entry.baseBranch}\`); ` +
        `playbook-ai pushed no commits and opened no PR.`,
    }));

  return { schemaVersion: REPO_PLAN_SCHEMA_VERSION, slug, sddRepo: plan.sddRepo, payloads };
}

/** Reject a slug that could be read by git as an option when used as a branch name. */
function assertSafeBranchName(slug) {
  assertSafeSlug(slug);
  if (slug.startsWith('-')) {
    throw new Error(`Invalid branch name (starts with "-"): "${slug}"`);
  }
}

/**
 * Blockers that make branch mutation itself unsafe or impossible — the only
 * ones that make prepare-repos refuse to touch a repo. The remaining,
 * commit-readiness blockers (expected_files_absent, undeclared_files_modified,
 * protected_path_staged) describe what may be *committed*, not whether the
 * `[slug]` branch can be safely created/switched on a git-clean tree.
 */
export const BRANCH_PREP_BLOCKERS = new Set([
  'repo_declared_but_missing',
  'ambiguous_git_state',
  'dirty_worktree_on_wrong_branch',
  'base_branch_unresolved',
]);

/**
 * The only mutator. Builds the plan, then for each repo not in a git-unsafe
 * state (BRANCH_PREP_BLOCKERS) prepares the `[slug]` branch: creates it from
 * the resolved base (`git switch -c`) if absent, or switches to it
 * (`git switch`) if present. Never `-f`/`--force`, never add/commit/push,
 * never a destructive checkout, never a git-unsafe repo (skipped and reported).
 */
export function prepareRepos(slug, { cwd = process.cwd(), changesDir = defaultChangesDir(cwd) } = {}) {
  assertSafeBranchName(slug);
  const plan = buildRepoPlan(slug, { cwd, changesDir });
  const mutated = [];
  const skipped = [];

  for (const entry of plan.repos) {
    if (entry.blocker && BRANCH_PREP_BLOCKERS.has(entry.blocker)) {
      skipped.push({ repo: entry.name, blocker: entry.blocker });
      continue;
    }
    const git = (args) => execFileSync('git', args, { cwd: entry.path, encoding: 'utf8' });
    if (entry.currentBranch === slug) {
      mutated.push({ repo: entry.name, action: 'already-on-branch', branch: slug });
      continue;
    }
    let branchExists = false;
    try {
      git(['rev-parse', '--verify', '--quiet', `refs/heads/${slug}`]);
      branchExists = true;
    } catch {
      branchExists = false;
    }
    if (branchExists) {
      git(['switch', slug]);
      mutated.push({ repo: entry.name, action: 'switched', branch: slug });
    } else {
      git(['switch', '-c', slug, entry.baseBranch]);
      mutated.push({ repo: entry.name, action: 'created', branch: slug, from: entry.baseBranch });
    }
  }

  return { schemaVersion: REPO_PLAN_SCHEMA_VERSION, slug, mutated, skipped };
}

export { SDD_REPO_DEFAULT_NAME };
