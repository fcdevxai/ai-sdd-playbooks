/**
 * `playbook init` (design §8.1) — scaffold/connect the project-local structure.
 *
 * Creates only what is missing; never overwrites existing content. Core
 * methodology files are NOT copied here (they live globally). Document adoption
 * is tiered (C-09): existing file at the resolved path → adopt; a plausible but
 * ambiguous candidate → reported, never auto-adopted; otherwise → template.
 *
 * The planning/scaffolding is exposed as `projectActions(cwd, { write })`: with
 * `write: false` it is a pure preview (dry-run), with `write: true` it applies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from './exit.js';
import { PACKAGE_ROOT } from '../install/skills.js';
import { copyIfMissing, ensureDir } from '../util/fs-safe.js';
import { loadConfig } from '../config/config.js';
import { resolveDocument } from '../config/docmap.js';
import { lockPathFor, writeLock, buildLock } from '../config/lock.js';

export const TPL = path.join(PACKAGE_ROOT, 'templates', 'project');

const FIXED = [
  ['AGENTS.md', 'AGENTS.md'],
  ['CLAUDE.md', 'CLAUDE.md'],
  ['copilot-instructions.md', '.github/copilot-instructions.md'],
  ['github/CODEOWNERS', '.github/CODEOWNERS'],
  ['github/PULL_REQUEST_TEMPLATE.md', '.github/PULL_REQUEST_TEMPLATE.md'],
  ['github/ISSUE_TEMPLATE/user-story.md', '.github/ISSUE_TEMPLATE/user-story.md'],
  ['github/workflows/playbook-validation.yml', '.github/workflows/playbook-validation.yml'],
  ['github/workflows/archive-cleanup.yml', '.github/workflows/archive-cleanup.yml'],
  ['docs/security-checklist.md', 'docs/security-checklist.md'],
];

const LOGICAL = [
  ['openspec/system.md', 'system_spec'],
  ['docs/agent_architecture.md', 'agent_architecture'],
  ['docs/doc_architecture.md', 'architecture'],
  ['docs/doc_verification_guide.md', 'verification'],
  ['docs/sdd-workflow.md', 'workflow'],
];

// Candidate patterns are specific so agent_architecture.md and doc_architecture.md
// are never adopted as each other (R-05): the agent pattern requires "agent";
// the plain architecture pattern excludes any filename containing "agent".
const CANDIDATE_PATTERNS = {
  agent_architecture: /agent[_\- ]?(arquitect|architect)/i,
  architecture: /^(?!.*agent)(?=.*(?:arquitect|architect))/i,
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

/**
 * Compute (and optionally apply) the project-local scaffolding actions.
 * Returns { created, skipped, adopted, candidates }. With `write: false` it is a
 * pure preview (no filesystem writes).
 */
export function projectActions(cwd, { write = false } = {}) {
  const created = [];
  const skipped = [];
  const adopted = [];
  const candidates = [];

  const plan = (destRel, apply) => {
    const dest = path.join(cwd, destRel);
    if (fs.existsSync(dest)) { skipped.push(destRel); return; }
    if (write) apply(dest);
    created.push(destRel);
  };

  // 1. config (create if missing, then load — dry mode reads defaults)
  plan('playbook.config.yaml', (dest) => copyIfMissing(path.join(TPL, 'playbook.config.yaml'), dest));
  const { config } = loadConfig({ cwd });

  // 2. fixed-path scaffolds
  for (const [tpl, dest] of FIXED) {
    plan(dest, (abs) => copyIfMissing(path.join(TPL, tpl), abs));
  }

  // 3. logical documents — tiered adoption (C-09)
  for (const [tpl, name] of LOGICAL) {
    const resolved = resolveDocument(config, name);
    if (fs.existsSync(path.join(cwd, resolved.path))) { adopted.push(`${name} → ${resolved.path}`); continue; }
    const cand = findCandidates(cwd, name, resolved.path);
    if (cand.length) { candidates.push(`${name}: ${cand.join(', ')}`); continue; }
    plan(resolved.path, (abs) => copyIfMissing(path.join(TPL, tpl), abs));
  }

  // 4. openspec/changes
  plan('openspec/changes', (abs) => ensureDir(abs));

  // 5. playbook.lock
  plan('playbook.lock', () => writeLock(
    lockPathFor(cwd, null),
    buildLock({ compatible: config.methodology.compatible, installedAt: today() }),
  ));

  return { created, skipped, adopted, candidates };
}

export function printProjectPlan(io, { created, skipped, adopted, candidates }) {
  for (const f of created) io.out(`  + ${f}`);
  for (const f of skipped) io.out(`  = ${f} (exists, unchanged)`);
  for (const a of adopted) io.out(`  ~ adopted ${a}`);
  for (const c of candidates) {
    io.out(`  ? possible ${c} — not adopted; set documents.<name> in playbook.config.yaml or run sdd-bootstrap-project`);
  }
}

const BOOTSTRAP_HINT = 'Capabilities are all false. Run the `sdd-bootstrap-project` skill (in Claude Code, GitHub Copilot, or Codex) to detect and propose them.';

export async function initCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const result = projectActions(cwd, { write: true });

  const { config } = loadConfig({ cwd });
  const capabilitiesUnset = Object.values(config.capabilities || {}).every((v) => v === false);

  if (parsed.flags.json) {
    io.out(JSON.stringify({ command: 'init', cwd, ...result, capabilities_unset: capabilitiesUnset }, null, 2));
    return EXIT.OK;
  }
  io.out('playbook init');
  printProjectPlan(io, result);
  io.out('\nNo core methodology files were copied — they live in ~/.claude/skills and ~/.agents/skills (GitHub Copilot + Codex).');
  if (capabilitiesUnset) io.out(`\n${BOOTSTRAP_HINT}`);
  return EXIT.OK;
}
