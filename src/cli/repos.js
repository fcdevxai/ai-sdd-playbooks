/**
 * Multi-repo CLI commands — thin wrappers around src/repos/*.
 *
 * `repo-plan` / `commit-plan` / `changed-files` are READ-ONLY. `prepare-repos`
 * is the only mutator (branches only — never add/commit/push). `gate-check`
 * runs each impacted repo's configured verification commands locally.
 */
import { EXIT } from './exit.js';
import { buildRepoPlan, buildCommitPlan, prepareRepos } from '../repos/plan.js';
import { runGateCheck } from '../repos/gate-check.js';
import { collectChangedFiles } from '../repos/changed-files.js';
import { checkContractDrift } from '../repos/contract-drift.js';
import { detectSiblingRepos } from '../config/detect-siblings.js';
import { loadConfig } from '../config/config.js';
import { resolveContainedPath } from '../util/fs-safe.js';

function positional(rest) {
  return rest.find((a) => !a.startsWith('-')) || null;
}

function flagValue(rest, flag) {
  const i = rest.indexOf(flag);
  return i === -1 ? null : rest[i + 1];
}

export async function repoPlanCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const changeId = positional(parsed.rest);
  if (!changeId) { io.err('error: playbook repo-plan requires a <change-id>'); return EXIT.USAGE; }
  try {
    const plan = buildRepoPlan(changeId, { cwd });
    if (parsed.flags.json) io.out(JSON.stringify(plan, null, 2));
    else {
      io.out(`Repo plan for ${changeId} (sdd repo: ${plan.sddRepo}):`);
      for (const r of plan.repos) {
        io.out(`  ${r.name} [${r.role}] branch=${r.currentBranch || '?'} base=${r.baseBranch || '?'} blocker=${r.blocker || 'none'}`);
      }
    }
    return EXIT.OK;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}

export async function detectSiblingsCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  try {
    const result = detectSiblingRepos({ cwd });
    if (parsed.flags.json) {
      io.out(JSON.stringify(result, null, 2));
    } else if (result.candidates.length === 0) {
      io.out(`No git-repo siblings found in ${result.parentDir}`);
    } else {
      io.out(`Sibling repos for ${result.ownName} (parent: ${result.parentDir}):`);
      for (const c of result.candidates) {
        const shared = c.sharedTokensWithOwn.length ? c.sharedTokensWithOwn.join(',') : '-';
        io.out(`  ${c.name} [${c.summary}] shared=${shared} cluster=${c.cluster.length}`);
      }
    }
    return EXIT.OK;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}

export async function commitPlanCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const changeId = positional(parsed.rest);
  if (!changeId) { io.err('error: playbook commit-plan requires a <change-id>'); return EXIT.USAGE; }
  try {
    const plan = buildCommitPlan(changeId, { cwd });
    if (parsed.flags.json) io.out(JSON.stringify(plan, null, 2));
    else {
      io.out(`Commit plan for ${changeId} (${plan.payloads.length} repo(s) with candidate changes):`);
      for (const p of plan.payloads) io.out(`  ${p.repo}: ${p.head} → ${p.base} (${p.files.length} file(s))`);
    }
    return EXIT.OK;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}

export async function prepareReposCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const changeId = positional(parsed.rest);
  if (!changeId) { io.err('error: playbook prepare-repos requires a <change-id>'); return EXIT.USAGE; }
  try {
    const result = prepareRepos(changeId, { cwd });
    if (parsed.flags.json) io.out(JSON.stringify(result, null, 2));
    else {
      for (const m of result.mutated) io.out(`  ${m.repo}: ${m.action} (${m.branch})`);
      for (const s of result.skipped) io.out(`  ${s.repo}: skipped (${s.blocker})`);
    }
    return EXIT.OK;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}

export async function gateCheckCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const changeId = positional(parsed.rest);
  if (!changeId) { io.err('error: playbook gate-check requires a <change-id>'); return EXIT.USAGE; }
  try {
    const result = runGateCheck({ slug: changeId, cwd });
    if (parsed.flags.json) io.out(JSON.stringify(result, null, 2));
    else if (!result.plan.applicable) io.out(`gate-check not applicable: ${result.plan.reason}`);
    else {
      for (const r of result.results) {
        io.out(`  ${r.repo} — ${r.verification || 'error'}: ${r.exitCode === 0 ? '✓' : `✗ exit ${r.exitCode}`}`);
      }
    }
    return result.ok ? EXIT.OK : EXIT.VIOLATION;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}

export async function changedFilesCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const changeId = positional(parsed.rest);
  if (!changeId) { io.err('error: playbook changed-files requires a <change-id>'); return EXIT.USAGE; }
  const baseRef = flagValue(parsed.rest, '--base');
  const repoName = flagValue(parsed.rest, '--repo');
  const includeDiff = parsed.rest.includes('--diff');
  try {
    const result = collectChangedFiles(changeId, { baseRef, repoName, includeDiff, cwd });
    if (parsed.flags.json) io.out(JSON.stringify(result, null, 2));
    else {
      for (const f of result.files) io.out(`  ${f}`);
      for (const w of result.warnings) io.err(`⚠ ${w}`);
    }
    return EXIT.OK;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}

export async function contractDriftCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const generatedPath = positional(parsed.rest);
  if (!generatedPath) { io.err('error: usage: playbook contract-drift <generated-openapi.yaml>'); return EXIT.USAGE; }
  const { config } = loadConfig({ cwd });
  const canonicalPath = config.contract?.path_in_loom;
  if (!canonicalPath) { io.err('error: playbook.config.yaml has no contract.path_in_loom configured'); return EXIT.USAGE; }
  let resolvedCanonicalPath;
  try {
    resolvedCanonicalPath = resolveContainedPath(cwd, canonicalPath);
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.USAGE;
  }
  try {
    const issues = checkContractDrift(resolvedCanonicalPath, generatedPath);
    if (issues.length === 0) {
      io.out('✅ No contract drift detected.');
      return EXIT.OK;
    }
    io.err(`❌ Contract drift detected (${issues.length} issue(s)):`);
    for (const i of issues) io.err(`  - ${i}`);
    return EXIT.VIOLATION;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}
