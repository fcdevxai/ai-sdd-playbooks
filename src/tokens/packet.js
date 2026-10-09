/**
 * context-packet.md — ported from specloom's `buildPacket`/`writePacket`
 * (specloom, ADR-010/ADR-019). Generated once by `sdd-plan`,
 * consumed by the gates/commit/verify skills instead of re-reading the full
 * proposal.md + tasks.md every time — the core of the token-efficiency layer.
 *
 * Adapted to this repo's actual proposal/tasks templates:
 *   - verbatim sections pulled from proposal.md: "Acceptance criteria",
 *     "Constraints and non-goals", "Security considerations" (sdd-new's
 *     template headings, byte-exact — no markdown/YAML round-trip).
 *   - "Files touched" extracted from tasks.md's per-task `**Files**: ...`
 *     lines (sdd-plan's template).
 *   - "Verification commands" extracted from tasks.md's quality-gates phase
 *     `**Format/Lint/type-check/Feature tests/Regression**: ...` lines
 *     (sdd-plan's template).
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { createHash } from 'node:crypto';
import { parseMarkdownHeadings, headingSection, splitSections, isEmpty, extractLabeledTokens } from '../util/markdown.js';
import { readEvidenceFile, readReference, resolveContainedPath, writeEvidenceFile } from '../util/fs-safe.js';

export const PACKET_REQUIRED_SECTIONS = [
  'Ticket',
  'Acceptance criteria',
  'Constraints and non-goals',
  'Security considerations',
  'Files touched',
  'Verification commands',
  'Full sources',
];

function isSafeSlug(slug) {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    slug !== '.' &&
    slug !== '..' &&
    !slug.includes('/') &&
    !slug.includes('\\')
  );
}

export function defaultChangesDir(cwd = process.cwd()) {
  return path.join(cwd, 'openspec', 'changes');
}

const FILES_LABEL_RE = /\*\*Files\*\*:\s*(.+)/i;
const COMMAND_LABEL_RE = /\*\*(?:Format|Lint\/type-check|Feature tests|Regression)\*\*:\s*(.+)/i;
const REGRESSION_LABEL_RE = /\*\*Regression\*\*:\s*(.+)/i;

/** Contained read of a change file (design Amendment R5, rule 4); the project root holds openspec/changes. */
function readChangeFile(changesDir, slug, file) {
  const root = path.resolve(changesDir, '..', '..');
  return readEvidenceFile(root, path.relative(root, path.join(changesDir, slug, file)));
}

/**
 * sha256 hex digests of a change's packet source files, computed over their
 * raw bytes. Stamped into `sources` frontmatter when generating a packet, and
 * recomputed/compared when checking staleness.
 *
 * `contract` (optional) includes both the relevant topology from config and
 * the contract file's actual bytes. A topology-only hash cannot establish
 * whether the API contract changed while its path stayed fixed.
 * Omitted or null, the returned object carries no `contract` key at all —
 * this is what keeps a no-contract packet's `sources` shape unchanged.
 */
export function packetSourceHashes(slug, changesDir = defaultChangesDir(), contract = null) {
  if (!isSafeSlug(slug)) throw new Error(`Invalid change slug: "${slug}"`);
  const dir = path.join(changesDir, slug);
  const hashOf = (file) => createHash('sha256').update(readChangeFile(changesDir, slug, file)).digest('hex');
  const hashes = { proposal: hashOf('proposal.md'), tasks: hashOf('tasks.md') };
  if (contract && contract.path_in_loom) {
    hashes.contract = createHash('sha256').update(JSON.stringify(contract)).digest('hex');
    const root = path.resolve(changesDir, '..', '..');
    let content;
    try {
      content = readReference(root, contract.path_in_loom);
    } catch (error) {
      throw new Error(/not a contained regular file/.test(error.message) ? error.message : `contract source missing: ${contract.path_in_loom}`);
    }
    hashes.contract_content = createHash('sha256').update(content).digest('hex');
  }
  return hashes;
}

/**
 * Extracts the contract portion relevant to the packet from an already-loaded
 * config object — `{ path_in_loom, provided_by, consumed_by }`, or null when
 * no contract topology is declared. Takes a plain object, never `loadConfig`
 * itself: callers (`src/cli/packet.js`, `src/cli/validate.js`) already have
 * `cwd` and load the config themselves, keeping this module fs/config-free.
 */
export function contractPortionFromConfig(config) {
  const contract = config && config.contract;
  if (!contract || !contract.path_in_loom) return null;
  const { path_in_loom, provided_by, consumed_by } = contract;
  return { path_in_loom, provided_by, consumed_by };
}

/**
 * Renders the optional `## Contract` packet section from a contract portion
 * `{ path_in_loom, provided_by, consumed_by }` (the caller — `src/cli/packet.js`,
 * which already has `cwd` — extracts this from `playbook.config.yaml`; this
 * module never imports `loadConfig` itself, keeping the CLI/domain layer split
 * of `docs/doc_architecture.md`). Returns null when there's no contract
 * topology to report, so callers can omit the section entirely.
 *
 * SEC-001: `path_in_loom` is a path taken from config that a downstream agent
 * (`sdd-plan`/`sdd-apply`) will later read by following this packet's text —
 * so it must be contained to the repo BEFORE it's embedded, exactly like any
 * other config-derived read (`resolveContainedPath`, never string
 * concatenation). An escaping path throws here, before the packet is ever
 * written, so the escape is never even attempted downstream.
 */
function contractSection(contract, cwd) {
  if (!contract || !contract.path_in_loom) return null;
  resolveContainedPath(cwd, contract.path_in_loom); // throws, naming the path, if it escapes the repo
  const lines = [`- Path: \`${contract.path_in_loom}\``];
  if (contract.provided_by) lines.push(`- Provided by: \`${contract.provided_by}\``);
  if (Array.isArray(contract.consumed_by) && contract.consumed_by.length > 0) {
    lines.push(`- Consumed by: ${contract.consumed_by.map((r) => `\`${r}\``).join(', ')}`);
  }
  return `## Contract\n\n${lines.join('\n')}`;
}

/**
 * Builds a context-packet.md in memory from a change's proposal.md + tasks.md.
 * Returns { content, warnings }; never touches disk. Strict on the proposal
 * (a missing verbatim section, or a missing tasks.md, throws before any caller
 * can write), tolerant on tasks.md (an empty extracted section yields a
 * warning, not an error).
 *
 * `contract` (optional) is the config's contract portion — see
 * `contractSection` above. Omitted or null, the packet is byte-identical to
 * the no-contract path: no `## Contract` section, no `sources.contract`.
 */
export function buildPacket(slug, changesDir = defaultChangesDir(), contract = null) {
  if (!isSafeSlug(slug)) throw new Error(`Invalid change slug: "${slug}"`);
  const dir = path.join(changesDir, slug);
  const proposalPath = path.join(dir, 'proposal.md');
  const tasksPath = path.join(dir, 'tasks.md');

  if (!fs.existsSync(proposalPath)) {
    throw new Error(`proposal.md not found for "${slug}" at ${proposalPath}`);
  }
  if (!fs.existsSync(tasksPath)) {
    throw new Error(`tasks.md not found for "${slug}" — the packet derives from both sources`);
  }

  const proposalRaw = readChangeFile(changesDir, slug, 'proposal.md').toString('utf8');
  const proposalBody = matter(proposalRaw).content;
  const tasksRaw = readChangeFile(changesDir, slug, 'tasks.md').toString('utf8');

  const verbatim = {};
  for (const name of ['Acceptance criteria', 'Constraints and non-goals', 'Security considerations']) {
    const body = headingSection(proposalBody, name);
    if (body === null || body === '') {
      throw new Error(`proposal.md for "${slug}" is missing required section "## ${name}" — cannot build packet`);
    }
    verbatim[name] = body;
  }

  const warnings = [];
  const files = extractLabeledTokens(tasksRaw, FILES_LABEL_RE);
  if (files.length === 0) {
    warnings.push('Files touched section is empty — no "**Files**:" entries found in tasks.md');
  }
  const commands = extractLabeledTokens(tasksRaw, COMMAND_LABEL_RE);
  if (commands.length === 0) {
    // EC-6: an empty command list already says everything — naming the
    // missing Regression entry on top of it would just repeat the message.
    warnings.push('Verification commands section is empty — no quality-gate command entries found in tasks.md');
  } else if (extractLabeledTokens(tasksRaw, REGRESSION_LABEL_RE).length === 0) {
    warnings.push('tasks.md has no "**Regression**:" entry — the regression command will not reach the gates that read the packet');
  }

  const headings = parseMarkdownHeadings(proposalBody);
  const title = headings.find((h) => h.level === 1)?.title || slug;

  const filesBlock = files.map((f) => `- \`${f}\``).join('\n');
  const commandsBlock = commands.map((c) => `- \`${c}\``).join('\n');

  const sections = [
    `# Context Packet — ${title}`,
    `## Ticket\n\n${slug}`,
    `## Acceptance criteria\n\n${verbatim['Acceptance criteria']}`,
    `## Constraints and non-goals\n\n${verbatim['Constraints and non-goals']}`,
    `## Security considerations\n\n${verbatim['Security considerations']}`,
    `## Files touched\n\n${filesBlock}`,
    `## Verification commands\n\n${commandsBlock}`,
  ];
  // changesDir is always `<cwd>/openspec/changes` (defaultChangesDir's own shape,
  // and every caller's), so the project root is two segments up.
  const contractBlock = contractSection(contract, path.resolve(changesDir, '..', '..'));
  if (contractBlock) sections.push(contractBlock);
  if (matter(tasksRaw).data.handoff) {
    sections.push(`## Handoff manifest\n\n- openspec/changes/${slug}/handoff-manifest.json`);
  }
  sections.push(`## Full sources\n\n- openspec/changes/${slug}/proposal.md\n- openspec/changes/${slug}/tasks.md`);

  const body = sections.join('\n\n') + '\n';

  const sources = packetSourceHashes(slug, changesDir, contract);
  const content = matter.stringify(body, { sources });

  return { content, warnings };
}

/**
 * Persists buildPacket's output to openspec/changes/<slug>/context-packet.md.
 * Deterministic: unchanged sources yield byte-identical files, so it
 * overwrites without a flag — the packet is a derived artifact, never a
 * source of truth.
 */
export function writePacket(slug, changesDir = defaultChangesDir(), contract = null) {
  if (!isSafeSlug(slug)) throw new Error(`Invalid change slug: "${slug}"`);
  const { content, warnings } = buildPacket(slug, changesDir, contract);
  const packetPath = path.join(changesDir, slug, 'context-packet.md');
  const root = path.resolve(changesDir, '..', '..');
  writeEvidenceFile(root, path.relative(root, packetPath), content);
  return { path: packetPath, warnings };
}

/**
 * context-packet.md is optional — absence is valid; a present file must be
 * complete and fresh. `contract` (optional) is the project's CURRENT contract
 * portion (see `contractPortionFromConfig`), passed by the caller so a
 * topology change (`path_in_loom`/`provided_by`/`consumed_by`) is caught the
 * same way a proposal.md/tasks.md edit already is: recompute, compare to what
 * the packet stamped. A packet whose `sources` never had `contract` at all —
 * legacy, or a project without one at generation time — is never reported
 * stale by this path, same as the whole `sources` object already isn't for a
 * hand-written packet with no frontmatter.
 */
export function validatePacket(slug, changesDir = defaultChangesDir(), contract = null) {
  if (!isSafeSlug(slug)) {
    return { ok: false, issues: [`invalid change slug: "${slug}"`] };
  }
  const packetPath = path.join(changesDir, slug, 'context-packet.md');
  if (!fs.lstatSync(packetPath, { throwIfNoEntry: false })) return { ok: true, issues: [] };

  let parsed;
  try {
    parsed = matter(readChangeFile(changesDir, slug, 'context-packet.md').toString('utf8'));
  } catch (error) {
    return { ok: false, issues: [`context-packet.md: ${error.message}`] };
  }
  const sections = splitSections(parsed.content);
  const issues = [];
  for (const required of PACKET_REQUIRED_SECTIONS) {
    if (!(required in sections)) {
      issues.push(`context-packet.md: missing section: "## ${required}"`);
      continue;
    }
    if (isEmpty(sections[required])) issues.push(`context-packet.md: empty content in "## ${required}"`);
  }
  const tasksPath = path.join(changesDir, slug, 'tasks.md');
  let tasksHandoff = false;
  try {
    tasksHandoff = fs.existsSync(tasksPath) && !!matter(readChangeFile(changesDir, slug, 'tasks.md').toString('utf8')).data.handoff;
  } catch (error) {
    issues.push(`tasks.md: ${error.message}`);
  }
  if (tasksHandoff && !('Handoff manifest' in sections)) {
    issues.push('context-packet.md: missing section: "## Handoff manifest"');
  }

  // Hash-staleness: only CLI-generated packets carry `sources` frontmatter.
  // Legacy hand-written packets (no `sources`) are never reported stale.
  const sources = parsed.data.sources;
  if (sources && typeof sources === 'object') {
    const proposalPath = path.join(changesDir, slug, 'proposal.md');
    if (fs.existsSync(proposalPath) && fs.existsSync(tasksPath)) {
      try {
        const current = packetSourceHashes(slug, changesDir, contract);
        const contractStale = 'contract' in sources && current.contract !== sources.contract;
        const contentStale = 'contract_content' in sources && current.contract_content !== sources.contract_content;
        if (current.proposal !== sources.proposal || current.tasks !== sources.tasks || contractStale || contentStale) {
          issues.push(`context-packet.md stale — re-run \`playbook packet ${slug}\``);
        }
      } catch (err) {
        issues.push(`context-packet.md source unavailable: ${err.message}`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
