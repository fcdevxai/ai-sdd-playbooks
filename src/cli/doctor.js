/**
 * `playbook doctor` (design §8.2) — READ-ONLY diagnostics by default.
 *
 * Reports: global-skill presence, version-vs-compatible-range (blocks on
 * incompatibility, C-08), config validity, missing docs, missing openspec
 * structure, and any change stuck in an exception view. Writes nothing unless
 * `--fix`, and `--fix` performs only safe ADDITIVE fixes (create missing dirs /
 * the validation workflow) — never edits existing content.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from './exit.js';
import { listSkills, PACKAGE_ROOT } from '../install/skills.js';
import { resolveTargets } from '../install/targets.js';
import { lintSkillsDir } from '../install/skill-contract.js';
import { loadConfig, validateConfig } from '../config/config.js';
import { resolveAllDocuments, resolveDocument } from '../config/docmap.js';
import { readLock, lockPathFor } from '../config/lock.js';
import { loadChange, findChangeDirs } from '../config/artifacts.js';
import { computeState } from '../lifecycle/engine.js';
import { satisfies } from '../util/semver.js';
import { ensureDir, copyIfMissing, writeIfMissing } from '../util/fs-safe.js';
import { discoverSpecFiles, defaultSpecIndexPath } from '../tokens/spec-index.js';
import { readManifest, verifyManifest } from '../install/manifest.js';

function readStamp(dir) {
  const p = path.join(dir, '.playbook-version');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
}

const TARGET_LABELS = {
  claude: 'Claude Code',
  agents: 'GitHub Copilot + Codex',
};

/**
 * Content verification (ADR "install verification by content"): compares what's
 * actually installed in `targetDir` against its `.playbook-manifest.json`. Pure,
 * read-only. A digest mismatch or dangling link-mode symlink is a `problems`
 * entry (the install isn't what it claims to be); an absent/unreadable manifest
 * is a `notes` entry — an install made by a version before this manifest existed
 * is unknown, not unhealthy. Link mode gets its own note naming the source,
 * since a link is verified by resolution, never by digest.
 */
function installedContentDiagnostics(targetKey, targetDir) {
  const label = TARGET_LABELS[targetKey] || targetKey;
  const manifest = readManifest(targetDir);
  if (!manifest) {
    return { problems: [], notes: [`${label} install has no manifest at ${targetDir} — it predates content verification (run \`playbook install\` to enable it)`] };
  }
  const notes = [];
  if (manifest.mode === 'link') {
    notes.push(`${label} install is linked to ${manifest.source} — content verified by symlink resolution, not by digest`);
  }
  const problems = verifyManifest(targetDir, manifest).map((f) => `${label} install: ${f}`);
  return { problems, notes };
}

function installedTargetDiagnostics(targetKey, targetDir, expectedCoreSkills) {
  const stamp = readStamp(targetDir);
  if (!stamp) return { target: targetKey, dir: targetDir, installed: null, problems: [], notes: [] };

  const problems = [];
  const installedNames = new Set(listSkills(targetDir).map((s) => s.name));
  for (const name of expectedCoreSkills) {
    if (!installedNames.has(name)) {
      problems.push(`${TARGET_LABELS[targetKey] || targetKey} install is missing core skill ${name} (${targetDir})`);
    }
  }

  for (const lint of lintSkillsDir(targetDir)) {
    if (expectedCoreSkills.includes(lint.name) && !lint.valid) {
      problems.push(`${TARGET_LABELS[targetKey] || targetKey} install has invalid skill ${lint.name}: ${lint.errors.join('; ')}`);
    }
  }

  const content = installedContentDiagnostics(targetKey, targetDir);
  problems.push(...content.problems);

  return { target: targetKey, dir: targetDir, installed: stamp, problems, notes: content.notes };
}

const METHODOLOGY_MARKER = /<!--\s*sdd-methodology:\s*([\d.]+)\s*-->/;

/**
 * Advisory check: is the project's `workflow` doc older than the installed
 * methodology? Returns a warning string or null. Pure/testable.
 *
 * Null (nothing to say) when no methodology is installed or the doc is absent —
 * those are already covered by doctor's `problems`. Warns when the doc carries no
 * methodology marker, or a major older than the installed one.
 */
export function workflowStaleness({ cwd, config, installed }) {
  if (!installed) return null;
  const resolved = resolveDocument(config, 'workflow');
  if (!resolved.path) return null;
  const abs = path.join(cwd, resolved.path);
  if (!fs.existsSync(abs)) return null;

  const installedMajor = parseInt(String(installed).split('.')[0], 10);
  const fix = 'refresh it with the `sdd-bootstrap-project` skill';
  const m = fs.readFileSync(abs, 'utf8').match(METHODOLOGY_MARKER);
  if (!m) {
    return `\`${resolved.path}\` has no methodology-version marker; it may predate methodology ${installedMajor}.x — ${fix}`;
  }
  const docMajor = parseInt(m[1].split('.')[0], 10);
  if (docMajor < installedMajor) {
    return `\`${resolved.path}\` predates the installed methodology (doc: ${docMajor}.x, installed: ${installedMajor}.x) — ${fix}`;
  }
  return null;
}

/**
 * Advisory check: is there a permanent-spec index to build but none built yet?
 * Returns a warning string or null. Pure/testable (same molde as `workflowStaleness`).
 *
 * Null when there are no permanent specs to index (`openspec/specs/system.md`
 * absent — nothing to say) or the index already exists. The index is a
 * gitignoreed session cache: its absence never blocks anything, it only means
 * skills fall back to full-reading specs instead of `spec-read`-ing a section.
 */
export function specIndexAdvisory({ cwd }) {
  if (discoverSpecFiles(cwd).length === 0) return null;
  if (fs.existsSync(defaultSpecIndexPath(cwd))) return null;
  return 'no spec index at `.specloom/index/spec-index.json` — run `playbook spec-index` to enable section-first reads of permanent specs and save tokens';
}

function runtimeReadinessNotes(config) {
  const notes = [];
  if (config && config.capabilities && config.capabilities.browser === true) {
    notes.push('runtime readiness: browser capability is enabled; `sdd-runtime-gate` requires Playwright MCP in the active agent runtime (Claude Code, Codex, or GitHub Copilot)');
  }
  if (config && config.addons && config.addons.confluence === true) {
    notes.push('runtime readiness: Confluence add-on is enabled; `document-code`, `operational-guide`, and `code-audit-comment` require Atlassian MCP in the active agent runtime');
  }
  return notes;
}

export async function doctorCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const fix = parsed.rest.includes('--fix');
  const problems = [];
  const warnings = [];
  const fixes = [];
  const notes = [];

  // global install + compatibility range (C-08)
  const targets = resolveTargets(process.env);
  const expectedCoreSkills = listSkills(path.join(PACKAGE_ROOT, 'skills')).map((s) => s.name).sort();
  const targetDiagnostics = Object.entries(targets).map(([target, dir]) =>
    installedTargetDiagnostics(target, dir, expectedCoreSkills),
  );
  const installed = targetDiagnostics.find((t) => t.installed)?.installed || null;
  const lock = readLock(lockPathFor(cwd, null));
  if (!installed) problems.push('no global methodology installed (run `playbook install`)');
  for (const d of targetDiagnostics) {
    problems.push(...d.problems);
    notes.push(...(d.notes || []));
  }
  const range = lock && lock.methodology && lock.methodology.compatible;
  if (installed && range && !satisfies(installed, range)) {
    problems.push(`installed methodology ${installed} is outside the project range "${range}" (run \`playbook install\` / \`playbook sync\`)`);
  }

  // config
  const configExists = fs.existsSync(path.join(cwd, 'playbook.config.yaml'));
  const { config } = loadConfig({ cwd });
  if (!configExists) problems.push('no playbook.config.yaml (run `playbook init`)');
  else {
    const v = validateConfig(config);
    if (!v.valid) problems.push(`playbook.config.yaml invalid: ${v.errors.join('; ')}`);
  }

  // documents
  for (const d of resolveAllDocuments(config)) {
    if (!d.path || !fs.existsSync(path.join(cwd, d.path))) problems.push(`missing document ${d.name} (${d.path})`);
  }

  // workflow doc staleness vs the installed methodology (advisory — never fails)
  const stale = workflowStaleness({ cwd, config, installed });
  if (stale) warnings.push(stale);
  const missingIndex = specIndexAdvisory({ cwd });
  if (missingIndex) warnings.push(missingIndex);
  notes.push(...runtimeReadinessNotes(config));

  // openspec structure (additive-fixable)
  const changesDir = path.join(cwd, 'openspec', 'changes');
  if (!fs.existsSync(changesDir)) {
    if (fix) {
      ensureDir(changesDir);
      writeIfMissing(path.join(changesDir, '.gitkeep'), '');
      fixes.push('created openspec/changes/');
    } else problems.push('missing openspec/changes/ (fixable: `playbook doctor --fix`)');
  }
  const wf = path.join(cwd, '.github', 'workflows', 'playbook-validation.yml');
  if (!fs.existsSync(wf)) {
    if (fix) {
      copyIfMissing(path.join(PACKAGE_ROOT, 'templates', 'project', 'github', 'workflows', 'playbook-validation.yml'), wf);
      fixes.push('created .github/workflows/playbook-validation.yml');
    } else {
      problems.push('missing .github/workflows/playbook-validation.yml (fixable: `playbook doctor --fix`)');
    }
  }

  // changes stuck in an exception view
  for (const dir of findChangeDirs(cwd)) {
    const change = loadChange(dir);
    const res = computeState(config, lock, change.artifacts, { state: 'unknown' });
    if (res.exception) problems.push(`change ${change.changeId}: ${res.exception.artifact} is ${res.exception.status}`);
  }

  // `warnings` are advisory: they never affect `healthy` or the exit code.
  const healthy = problems.length === 0;
  if (parsed.flags.json) {
    io.out(JSON.stringify({ command: 'doctor', healthy, problems, warnings, fixes, notes, targets: targetDiagnostics }, null, 2));
  } else {
    io.out('playbook doctor');
    for (const f of fixes) io.out(`  fixed: ${f}`);
    if (healthy) io.out('  ✓ healthy');
    for (const p of problems) io.err(`  ✗ ${p}`);
    for (const w of warnings) io.out(`  ⚠ ${w}`);
    for (const n of notes) io.out(`  note: ${n}`);
  }
  return healthy ? EXIT.OK : EXIT.ENVIRONMENT;
}
