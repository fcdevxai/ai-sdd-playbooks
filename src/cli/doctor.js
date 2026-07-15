/**
 * `sdd doctor` (design §8.2) — READ-ONLY diagnostics by default.
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
import { PACKAGE_ROOT } from '../install/skills.js';
import { resolveTargets } from '../install/targets.js';
import { loadConfig, validateConfig } from '../config/config.js';
import { resolveAllDocuments } from '../config/docmap.js';
import { readLock, lockPathFor } from '../config/lock.js';
import { loadChange, findChangeDirs } from '../config/artifacts.js';
import { computeState } from '../lifecycle/engine.js';
import { satisfies } from '../util/semver.js';
import { ensureDir, copyIfMissing } from '../util/fs-safe.js';

function readStamp(dir) {
  const p = path.join(dir, '.sdd-version');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
}

export async function doctorCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const fix = parsed.rest.includes('--fix');
  const problems = [];
  const fixes = [];
  const notes = [];

  // global install + compatibility range (C-08)
  const targets = resolveTargets(process.env);
  const installed = readStamp(targets.claude) || readStamp(targets.agents);
  const lock = readLock(lockPathFor(cwd, null));
  if (!installed) problems.push('no global methodology installed (run `sdd install`)');
  const range = lock && lock.methodology && lock.methodology.compatible;
  if (installed && range && !satisfies(installed, range)) {
    problems.push(`installed methodology ${installed} is outside the project range "${range}" (run \`sdd install\` / \`sdd sync\`)`);
  }

  // config
  const configExists = fs.existsSync(path.join(cwd, 'sdd.config.yaml'));
  const { config } = loadConfig({ cwd });
  if (!configExists) problems.push('no sdd.config.yaml (run `sdd init`)');
  else {
    const v = validateConfig(config);
    if (!v.valid) problems.push(`sdd.config.yaml invalid: ${v.errors.join('; ')}`);
  }

  // documents
  for (const d of resolveAllDocuments(config)) {
    if (!d.path || !fs.existsSync(path.join(cwd, d.path))) problems.push(`missing document ${d.name} (${d.path})`);
  }

  // openspec structure (additive-fixable)
  const changesDir = path.join(cwd, 'openspec', 'changes');
  if (!fs.existsSync(changesDir)) {
    if (fix) { ensureDir(changesDir); fixes.push('created openspec/changes/'); }
    else problems.push('missing openspec/changes/ (fixable: `sdd doctor --fix`)');
  }
  const wf = path.join(cwd, '.github', 'workflows', 'sdd-validation.yml');
  if (!fs.existsSync(wf)) {
    if (fix) {
      copyIfMissing(path.join(PACKAGE_ROOT, 'templates', 'project', 'github', 'workflows', 'sdd-validation.yml'), wf);
      fixes.push('created .github/workflows/sdd-validation.yml');
    } else {
      problems.push('missing .github/workflows/sdd-validation.yml (fixable: `sdd doctor --fix`)');
    }
  }

  // changes stuck in an exception view
  for (const dir of findChangeDirs(cwd)) {
    const change = loadChange(dir);
    const res = computeState(config, lock, change.artifacts, { state: 'unknown' });
    if (res.exception) problems.push(`change ${change.changeId}: ${res.exception.artifact} is ${res.exception.status}`);
  }

  notes.push('GitHub delivery reader lands in a later phase; delivery is reported as unknown');

  const healthy = problems.length === 0;
  if (parsed.flags.json) {
    io.out(JSON.stringify({ command: 'doctor', healthy, problems, fixes, notes }, null, 2));
  } else {
    io.out('sdd doctor');
    for (const f of fixes) io.out(`  fixed: ${f}`);
    if (healthy) io.out('  ✓ healthy');
    for (const p of problems) io.err(`  ✗ ${p}`);
    for (const n of notes) io.out(`  note: ${n}`);
  }
  return healthy ? EXIT.OK : EXIT.ENVIRONMENT;
}
