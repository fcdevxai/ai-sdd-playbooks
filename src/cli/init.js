/**
 * `sdd init` (design §8.1) — scaffold/connect the project-local structure.
 *
 * Creates only what is missing; never overwrites existing content. Core
 * methodology files are NOT copied here (they live globally). Document adoption
 * is tiered (C-09): existing file at the resolved path → adopt; a plausible but
 * ambiguous candidate → reported, never auto-adopted; otherwise → template.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from './exit.js';
import { PACKAGE_ROOT } from '../install/skills.js';
import { copyIfMissing, ensureDir } from '../util/fs-safe.js';
import { loadConfig } from '../config/config.js';
import { resolveDocument } from '../config/docmap.js';
import { lockPathFor, writeLock, buildLock } from '../config/lock.js';

const TPL = path.join(PACKAGE_ROOT, 'templates', 'project');

const FIXED = [
  ['AGENTS.md', 'AGENTS.md'],
  ['CLAUDE.md', 'CLAUDE.md'],
  ['copilot-instructions.md', '.github/copilot-instructions.md'],
  ['github/workflows/sdd-validation.yml', '.github/workflows/sdd-validation.yml'],
];

const LOGICAL = [
  ['openspec/system.md', 'system_spec'],
  ['docs/architecture.md', 'architecture'],
  ['docs/verification.md', 'verification'],
  ['docs/sdd-workflow.md', 'workflow'],
];

const CANDIDATE_PATTERNS = {
  architecture: /arquitect|architect/i,
  verification: /verif/i,
  workflow: /workflow|flujo/i,
};

function findCandidates(cwd, name, defaultRel) {
  const pat = CANDIDATE_PATTERNS[name];
  if (!pat) return [];
  const defaultBase = path.basename(defaultRel);
  const found = [];
  for (const dir of ['docs', '.']) {
    const abs = path.join(cwd, dir);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith('.md') || f === defaultBase) continue;
      if (pat.test(f)) found.push(path.posix.join(dir === '.' ? '' : dir, f));
    }
  }
  return found;
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export async function initCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const created = [];
  const skipped = [];
  const adopted = [];
  const candidates = [];

  const record = (r) => (r.action === 'created' ? created : skipped).push(path.relative(cwd, r.path) || r.path);

  // 1. config (create if missing, then load)
  record(copyIfMissing(path.join(TPL, 'sdd.config.yaml'), path.join(cwd, 'sdd.config.yaml')));
  const { config } = loadConfig({ cwd });

  // 2. fixed-path scaffolds
  for (const [tpl, dest] of FIXED) {
    record(copyIfMissing(path.join(TPL, tpl), path.join(cwd, dest)));
  }

  // 3. logical documents — tiered adoption (C-09)
  for (const [tpl, name] of LOGICAL) {
    const resolved = resolveDocument(config, name);
    const destAbs = path.join(cwd, resolved.path);
    if (fs.existsSync(destAbs)) { adopted.push(`${name} → ${resolved.path}`); continue; }
    const cand = findCandidates(cwd, name, resolved.path);
    if (cand.length) { candidates.push(`${name}: ${cand.join(', ')}`); continue; }
    record(copyIfMissing(path.join(TPL, tpl), destAbs));
  }

  // 4. openspec/changes
  record(ensureDir(path.join(cwd, 'openspec', 'changes')));

  // 5. sdd.lock
  const lockFile = lockPathFor(cwd, null);
  if (fs.existsSync(lockFile)) skipped.push('sdd.lock');
  else {
    writeLock(lockFile, buildLock({ compatible: config.methodology.compatible, installedAt: today() }));
    created.push('sdd.lock');
  }

  if (parsed.flags.json) {
    io.out(JSON.stringify({ command: 'init', cwd, created, skipped, adopted, candidates }, null, 2));
    return EXIT.OK;
  }

  io.out('sdd init');
  for (const f of created) io.out(`  + ${f}`);
  for (const f of skipped) io.out(`  = ${f} (exists, unchanged)`);
  for (const a of adopted) io.out(`  ~ adopted ${a}`);
  for (const c of candidates) {
    io.out(`  ? possible ${c} — not adopted; set documents.<name> in sdd.config.yaml or run sdd-bootstrap-project`);
  }
  io.out('\nNo core methodology files were copied — they live in ~/.claude/skills and ~/.agents/skills.');
  return EXIT.OK;
}
