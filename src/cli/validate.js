/**
 * `playbook validate` — schema + body validation of SDD artifacts.
 *
 * Scope:
 *   - validate each change artifact's frontmatter against its JSON Schema,
 *   - validate proposal.md/design.md BODY sections (src/schema/body-rules.js —
 *     the half of validation JSON Schema cannot express),
 *   - a cheap cross-check that needs no engine (change_id matches folder),
 *   - `--precondition <skill>` evaluates a skill's precondition contract,
 *   - `--ci` / `--json` emit machine-readable output; exit 1 on any violation.
 *     `--ci` judges only what a clean checkout can prove. Checks needing private
 *     receipts, sibling repositories or unavailable Git history are listed under
 *     `local_only` with their reason: they are never passed, never not-applicable,
 *     and `--ci` never satisfies a `--precondition` (that is always evaluated strictly).
 *
 * It never matches verdict phrases/emojis and never writes a file (C-12).
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { EXIT } from './exit.js';
import { validateArtifactFrontmatter, validateNamed } from '../schema/validate.js';
import { validateProposalBody, validateDesignBody, validateVerificationBody } from '../schema/body-rules.js';
import { loadChange, findChangeDirs, computeDesignRequired } from '../config/artifacts.js';
import { loadConfig, readConfigFile } from '../config/config.js';
import { readLock } from '../config/lock.js';
import { gateStatusFromAdapters } from '../adapters/index.js';
import { evaluatePreconditions, SKILL_PRECONDITIONS } from '../lifecycle/preconditions.js';
import { listAdrFiles } from '../adr/promote.js';
import { validateADR } from '../adr/validate.js';
import { validatePacket, contractPortionFromConfig } from '../tokens/packet.js';
import { validateHandoffManifest } from '../tokens/handoff.js';
import { resolveConfiguredRepoPath } from '../repos/config.js';
import { inspectEvidence } from '../lifecycle/eligibility.js';
import { gateReportIssues, REPORT_SCHEMAS } from '../lifecycle/report-validation.js';
import { computeState } from '../lifecycle/engine.js';
import { resolveMultiRepoDelivery } from '../repos/delivery.js';
import { readEvidenceFile } from '../util/fs-safe.js';

function parseValidateArgs(rest) {
  let ci = false;
  let precondition = null;
  const positionals = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--ci') ci = true;
    else if (a === '--precondition') { precondition = rest[i + 1]; i++; }
    else if (!a.startsWith('-')) positionals.push(a);
  }
  return { ci, precondition, changeId: positionals[0] || null };
}

export async function validateCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const { ci, precondition, changeId } = parseValidateArgs(parsed.rest);
  const json = parsed.flags.json || ci;

  if (precondition) return runPrecondition({ cwd, precondition, changeId, json, io });
  return runValidate({ cwd, changeId, json, io, ci });
}

// Artifacts whose BODY (not just frontmatter) carries required sections.
const BODY_VALIDATORS = {
  'proposal.md': validateProposalBody,
  'design.md': validateDesignBody,
  'verification-report.md': validateVerificationBody,
};

/**
 * Advisory (never blocking) config-coherence notices — reuses `doctor`'s
 * `notices`/`note:` vocabulary instead of a new one. `contract.path_in_loom`
 * declared with `capabilities.http: false` is a legitimate config (a CLI-only
 * hub keeping a contract for fixtures), so it warns, never fails.
 */
function configNotices(config) {
  const notices = [];
  if (config && config.contract && config.contract.path_in_loom && config.capabilities && config.capabilities.http === false) {
    notices.push(
      'playbook.config.yaml declares contract.path_in_loom but capabilities.http is false — contract-first authoring will not trigger',
    );
  }
  return notices;
}

/**
 * Blocking (unlike `configNotices`) cross-check: every name in
 * `contract.provided_by`/`consumed_by` must exist in `repos:` — no legitimate
 * config names a repo that isn't declared, so this is a config error, not a
 * warning. Reuses `resolveConfiguredRepoPath` (SEC-002) instead of rehashing
 * path resolution; called with the default `requireDirectory: false`, so it
 * never touches the filesystem — only `playbook.config.yaml`'s own shape is
 * checked. `consumed_by` without `provided_by` is not an error (EC-4).
 */
function contractRoleErrors(config, cwd) {
  const contract = config && config.contract;
  if (!contract) return [];
  const names = [];
  if (contract.provided_by) names.push(contract.provided_by);
  if (Array.isArray(contract.consumed_by)) names.push(...contract.consumed_by);
  const errors = [];
  for (const name of names) {
    try {
      resolveConfiguredRepoPath(name, { cwd });
    } catch (err) {
      errors.push(err.message);
    }
  }
  return errors;
}

/** Split evidence notes by kind into the result-row fields `local_only` and `after_delivery`. */
function notesOf(entries) {
  const localOnly = entries.filter((entry) => entry.kind !== 'after-delivery');
  const afterDelivery = entries.filter((entry) => entry.kind === 'after-delivery');
  return { ...(localOnly.length ? { local_only: localOnly } : {}), ...(afterDelivery.length ? { after_delivery: afterDelivery } : {}) };
}

function runValidate({ cwd, changeId, json, io, ci = false }) {
  const dirs = findChangeDirs(cwd);
  const targets = changeId ? dirs.filter((d) => path.basename(d) === changeId) : dirs;
  const results = [];
  // A change entry that is not a real directory (symbolic link, dangling or not) is never followed.
  const changesRoot = path.join(cwd, 'openspec', 'changes');
  for (const name of fs.existsSync(changesRoot) ? fs.readdirSync(changesRoot) : []) {
    if (changeId && name !== changeId) continue;
    if (fs.lstatSync(path.join(changesRoot, name)).isSymbolicLink()) {
      results.push({ file: path.relative(cwd, path.join(changesRoot, name)), valid: false, errors: ['change entry is a symbolic link; it is never followed'] });
    }
  }
  const { config } = loadConfig({ cwd });
  const notices = configNotices(config);

  for (const dir of targets) {
    const change = loadChange(dir);
    const proposalReadable = change.artifacts['proposal.md'] && !change.artifacts['proposal.md'].readError;
    const proposalFm = proposalReadable ? change.artifacts['proposal.md'].frontmatter : null;
    const relevant = proposalFm && proposalFm.runtime_relevant_capabilities;
    for (const [name, a] of Object.entries(change.artifacts)) {
      if (a.readError) {
        results.push({ file: path.relative(cwd, a.path), valid: false, errors: [a.readError] });
        continue;
      }
      const r = validateArtifactFrontmatter(a.frontmatter);
      const errors = REPORT_SCHEMAS[name]
        ? gateReportIssues(change.changeId, name, a.frontmatter)
        : r.skipped ? [] : [...r.errors];

      if (!r.skipped && a.frontmatter.change_id && a.frontmatter.change_id !== change.changeId) {
        errors.push(`change_id '${a.frontmatter.change_id}' does not match folder '${change.changeId}'`);
      }
      if (!r.skipped && r.valid && a.frontmatter.schema === 'runtime-gate-report' && a.frontmatter.adapters) {
        // the declared status must equal the aggregate of its adapters (C-06/C-12)
        const expected = gateStatusFromAdapters(a.frontmatter.adapters);
        if (a.frontmatter.status !== expected) {
          errors.push(`status '${a.frontmatter.status}' disagrees with adapters aggregate '${expected}'`);
        }
        // per-change relevance: only active when the proposal declares it.
        // An excluded-but-project-enabled capability must be reported not_applicable.
        if (relevant) {
          for (const [adapterName, adapter] of Object.entries(a.frontmatter.adapters)) {
            const enabled = config.capabilities && config.capabilities[adapterName];
            if (enabled && !relevant.includes(adapterName) && adapter.status !== 'not_applicable') {
              errors.push(`adapter '${adapterName}' is status '${adapter.status}' but proposal.md's runtime_relevant_capabilities excludes it — expected 'not_applicable'`);
            }
          }
        }
      }

      const bodyValidator = BODY_VALIDATORS[name];
      if (bodyValidator) {
        const body = matter(readEvidenceFile(cwd, path.relative(cwd, a.path), 'utf8')).content;
        const bodyResult = bodyValidator(body);
        errors.push(...bodyResult.issues);
      }

      if (r.skipped && !bodyValidator && !REPORT_SCHEMAS[name]) continue;
      results.push({ file: path.relative(cwd, a.path), valid: errors.length === 0, errors });
    }

    // ADR drafts (adr-<decision-slug>.md) aren't in the fixed ARTIFACT_FILES
    // set — discover them by pattern and validate frontmatter (ajv, via the
    // `schema: adr` field) + body structure (src/adr/validate.js) together.
    const changesDir = path.join(cwd, 'openspec', 'changes');
    for (const file of listAdrFiles(change.changeId, changesDir)) {
      const adrPath = path.join(dir, file);
      let errors;
      try {
        // Contained read first (design Amendment R5, rule 4); validateADR then reads the same safe file.
        const parsed = matter(readEvidenceFile(cwd, path.relative(cwd, adrPath), 'utf8'));
        const frontmatterResult = validateArtifactFrontmatter(parsed.data);
        const structuralResult = validateADR(adrPath);
        errors = [...(frontmatterResult.skipped ? [] : frontmatterResult.errors), ...structuralResult.issues];
      } catch (error) {
        errors = [error.message];
      }
      results.push({ file: path.relative(cwd, adrPath), valid: errors.length === 0, errors });
    }

    // context-packet.md is optional (like design.md) and not in ARTIFACT_FILES
    // (its name never changes, but its presence does) — same split as ADRs:
    // ajv on `schema: context-packet` frontmatter + structural/staleness check.
    const packetPath = path.join(dir, 'context-packet.md');
    if (fs.lstatSync(packetPath, { throwIfNoEntry: false })) {
      let parsed;
      try {
        parsed = matter(readEvidenceFile(cwd, path.relative(cwd, packetPath), 'utf8'));
      } catch (error) {
        results.push({ file: path.relative(cwd, packetPath), valid: false, errors: [error.message] });
        parsed = null;
      }
      if (parsed) {
        const frontmatterResult = validateArtifactFrontmatter({ schema: 'context-packet', ...parsed.data });
        const structuralResult = validatePacket(change.changeId, changesDir, contractPortionFromConfig(config));
        const errors = [
          ...(frontmatterResult.skipped ? [] : frontmatterResult.errors),
          ...structuralResult.issues,
        ];
        results.push({ file: path.relative(cwd, packetPath), valid: errors.length === 0, errors });
      }
    }
    const manifestPath = path.join(dir, 'handoff-manifest.json');
    const declaredHandoff = !!change.artifacts['tasks.md']?.frontmatter?.handoff;
    if (declaredHandoff || fs.lstatSync(manifestPath, { throwIfNoEntry: false })) {
      const result = declaredHandoff
        ? validateHandoffManifest(change.changeId, { cwd, allowCommittedDescendants: true, portable: ci })
        : { ok: false, issues: ['handoff-manifest.json has no tasks.md handoff declaration'] };
      results.push({ file: path.relative(cwd, manifestPath), valid: result.ok, errors: result.issues, ...notesOf(result.localOnly || []) });
    }
    // An unreadable proposal is already reported above; delivery is then unknown, never a crash.
    let delivery = { state: 'unknown', per_repo: [] };
    if (proposalFm) {
      try {
        delivery = resolveMultiRepoDelivery({ cwd, slug: change.changeId });
      } catch {
        delivery = { state: 'unknown', per_repo: [] };
      }
    }
    const evidence = inspectEvidence(change.changeId, { cwd, config, artifacts: change.artifacts, delivery, ci });
    for (const [name, gate] of Object.entries(evidence.gates)) {
      const notes = [...evidence.localOnly, ...evidence.afterDelivery].filter((entry) => entry.file === name);
      results.push({ file: path.relative(cwd, path.join(dir, name)) + '#evidence', valid: gate.ok, errors: gate.issues, ...notesOf(notes) });
    }
    if (change.artifacts['proposal.md']?.frontmatter?.status === 'archived') {
      results.push({ file: path.relative(cwd, dir) + '#closure', valid: evidence.closure.ok,
        errors: evidence.closure.ok ? [] : ['archived proposal has no valid retained post-merge closure'] });
    }
  }

  // Project config + lock, when present.
  const cfgFile = path.join(cwd, 'playbook.config.yaml');
  if (fs.existsSync(cfgFile)) {
    const r = validateNamed('playbook.config', readConfigFile(cfgFile) || {});
    const errors = [...r.errors, ...contractRoleErrors(config, cwd)];
    results.push({ file: path.relative(cwd, cfgFile), valid: errors.length === 0, errors });
  }
  const lockFile = path.join(cwd, 'playbook.lock');
  if (fs.existsSync(lockFile)) {
    const r = validateNamed('playbook.lock', readLock(lockFile) || {});
    results.push({ file: path.relative(cwd, lockFile), valid: r.valid, errors: r.errors });
  }

  const failures = results.filter((r) => !r.valid);

  // Checks a clean checkout cannot prove (local-only) and comparisons that do not apply on the base
  // branch after delivery are reported separately; neither is ever counted as passed.
  const collect = (key) => results.flatMap((r) => (r[key] || []).map((entry) => ({ ...entry, file: entry.file || r.file })));
  const localOnly = collect('local_only');
  const afterDelivery = collect('after_delivery');
  if (json) {
    io.out(JSON.stringify(
      { command: 'validate', cwd, checked: results.length, failed: failures.length, results, notices, local_only: localOnly, after_delivery: afterDelivery },
      null, 2,
    ));
  } else if (results.length === 0) {
    io.out('No SDD artifacts found.');
    for (const n of notices) io.out(`  note: ${n}`);
  } else {
    for (const r of results) {
      if (r.valid && (r.local_only?.length || r.after_delivery?.length)) {
        io.out(`  ~ ${r.file} (partially checked)`);
        for (const entry of r.local_only || []) io.out(`      local-only: ${entry.check}: ${entry.reason}`);
        for (const entry of r.after_delivery || []) io.out(`      after delivery: ${entry.check}: ${entry.reason}`);
      } else if (r.valid) io.out(`  ✓ ${r.file}`);
      else {
        io.err(`  ✗ ${r.file}`);
        for (const e of r.errors) io.err(`      ${e}`);
      }
    }
    io.out(failures.length
      ? `\n${failures.length} invalid artifact(s).`
      : `\nAll ${results.length} artifact(s) valid.`);
    for (const n of notices) io.out(`  note: ${n}`);
  }

  // `notices` are advisory: they never affect the exit code, same contract as `doctor`'s `warnings`.
  return failures.length ? EXIT.VIOLATION : EXIT.OK;
}

function runPrecondition({ cwd, precondition, changeId, json, io }) {
  const requires = SKILL_PRECONDITIONS[precondition];
  if (!requires) {
    io.err(`error: no precondition contract for skill '${precondition}'`);
    return EXIT.USAGE;
  }

  const dirs = findChangeDirs(cwd);
  const dir = changeId ? dirs.find((d) => path.basename(d) === changeId) : dirs[0];
  if (!dir) {
    io.err('error: no change folder found under openspec/changes/');
    return EXIT.USAGE;
  }

  const change = loadChange(dir);
  const artifacts = {};
  for (const [name, a] of Object.entries(change.artifacts)) {
    artifacts[name] = { status: a.frontmatter.status };
  }
  const proposalFm = change.artifacts['proposal.md'] && change.artifacts['proposal.md'].frontmatter;
  const ctx = {
    artifacts,
    capabilities: {},
    design_required: computeDesignRequired(proposalFm, null),
  };

  const res = evaluatePreconditions(requires, ctx);
  if (['sdd-commit', 'sdd-verify', 'sdd-archive'].includes(precondition)) {
    const { config } = loadConfig({ cwd });
    let delivery = { state: 'unknown', per_repo: [] };
    try {
      delivery = resolveMultiRepoDelivery({ cwd, slug: change.changeId });
    } catch (error) {
      res.missing.push(`delivery cannot be resolved: ${error.message}`);
    }
    const evidence = inspectEvidence(change.changeId, { cwd, config, artifacts: change.artifacts, delivery });
    // One evaluator for `next` and the precondition: the lifecycle state it computes
    // (which already requires every earlier gate to be eligible) and its evidence issues.
    const computed = computeState(config, null, change.artifacts, delivery, evidence);
    const required = precondition === 'sdd-archive' ? 'verified' : 'runtime_cleared';
    if (computed.lifecycle.state !== required) {
      res.missing.push(`lifecycle state is '${computed.lifecycle.state}', ${precondition} requires '${required}' (next: ${computed.next.skill || computed.next.action})`);
    } else if (precondition === 'sdd-commit' && computed.next.skill !== 'sdd-commit') {
      // Same delivery routing as `next`: an unavailable GitHub context or an open PR is not a commit step.
      res.missing.push(`next routes to ${computed.next.skill || computed.next.action}${computed.next.reason ? ` (${computed.next.reason})` : ''}, not sdd-commit`);
    }
    for (const issue of evidence.issues) res.missing.push(`evidence: ${issue}`);
    const requiredGate = precondition === 'sdd-archive' ? 'verification-report.md' : 'runtime-gate-report.md';
    if (!evidence.gates[requiredGate]?.ok) res.missing.push(`${requiredGate} evidence is not source-bound and valid`);
    if (['sdd-verify', 'sdd-archive'].includes(precondition) && delivery.state !== 'merged') {
      res.missing.push(`unanimous merged delivery required; observed ${delivery.state}`);
    }
    for (const row of delivery.per_repo || []) {
      if (['sdd-verify', 'sdd-archive'].includes(precondition) && row.state !== 'merged') {
        res.missing.push(`${row.repo} delivery is ${row.state}, expected merged`);
      }
    }
    res.met = res.missing.length === 0;
  }

  if (json) {
    io.out(JSON.stringify(
      { command: 'validate', precondition, change: change.changeId, met: res.met, missing: res.missing },
      null, 2,
    ));
  } else if (res.met) {
    io.out(`✓ preconditions for ${precondition} are met (change ${change.changeId}).`);
  } else {
    io.err(`✗ preconditions for ${precondition} not met (change ${change.changeId}):`);
    for (const m of res.missing) io.err(`    - ${m}`);
  }

  return res.met ? EXIT.OK : EXIT.VIOLATION;
}
