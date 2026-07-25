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
import matter from 'gray-matter';
import { createHash } from 'node:crypto';
import { parseMarkdownHeadings, headingSection, splitSections, isEmpty, extractLabeledTokens } from '../util/markdown.js';

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

/**
 * sha256 hex digests of a change's packet source files, computed over their
 * raw bytes. Stamped into `sources` frontmatter when generating a packet, and
 * recomputed/compared when checking staleness.
 */
export function packetSourceHashes(slug, changesDir = defaultChangesDir()) {
  if (!isSafeSlug(slug)) throw new Error(`Invalid change slug: "${slug}"`);
  const dir = path.join(changesDir, slug);
  const hashOf = (file) => createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex');
  return { proposal: hashOf('proposal.md'), tasks: hashOf('tasks.md') };
}

/**
 * Builds a context-packet.md in memory from a change's proposal.md + tasks.md.
 * Returns { content, warnings }; never touches disk. Strict on the proposal
 * (a missing verbatim section, or a missing tasks.md, throws before any caller
 * can write), tolerant on tasks.md (an empty extracted section yields a
 * warning, not an error).
 */
export function buildPacket(slug, changesDir = defaultChangesDir()) {
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

  const proposalRaw = fs.readFileSync(proposalPath, 'utf8');
  const proposalBody = matter(proposalRaw).content;
  const tasksRaw = fs.readFileSync(tasksPath, 'utf8');

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

  const body =
    [
      `# Context Packet — ${title}`,
      `## Ticket\n\n${slug}`,
      `## Acceptance criteria\n\n${verbatim['Acceptance criteria']}`,
      `## Constraints and non-goals\n\n${verbatim['Constraints and non-goals']}`,
      `## Security considerations\n\n${verbatim['Security considerations']}`,
      `## Files touched\n\n${filesBlock}`,
      `## Verification commands\n\n${commandsBlock}`,
      `## Full sources\n\n- openspec/changes/${slug}/proposal.md\n- openspec/changes/${slug}/tasks.md`,
    ].join('\n\n') + '\n';

  const sources = packetSourceHashes(slug, changesDir);
  const content = matter.stringify(body, { sources });

  return { content, warnings };
}

/**
 * Persists buildPacket's output to openspec/changes/<slug>/context-packet.md.
 * Deterministic: unchanged sources yield byte-identical files, so it
 * overwrites without a flag — the packet is a derived artifact, never a
 * source of truth.
 */
export function writePacket(slug, changesDir = defaultChangesDir()) {
  if (!isSafeSlug(slug)) throw new Error(`Invalid change slug: "${slug}"`);
  const { content, warnings } = buildPacket(slug, changesDir);
  const packetPath = path.join(changesDir, slug, 'context-packet.md');
  fs.writeFileSync(packetPath, content);
  return { path: packetPath, warnings };
}

/** context-packet.md is optional — absence is valid; a present file must be complete and fresh. */
export function validatePacket(slug, changesDir = defaultChangesDir()) {
  if (!isSafeSlug(slug)) {
    return { ok: false, issues: [`invalid change slug: "${slug}"`] };
  }
  const packetPath = path.join(changesDir, slug, 'context-packet.md');
  if (!fs.existsSync(packetPath)) return { ok: true, issues: [] };

  const parsed = matter(fs.readFileSync(packetPath, 'utf8'));
  const sections = splitSections(parsed.content);
  const issues = [];
  for (const required of PACKET_REQUIRED_SECTIONS) {
    if (!(required in sections)) {
      issues.push(`context-packet.md: missing section: "## ${required}"`);
      continue;
    }
    if (isEmpty(sections[required])) issues.push(`context-packet.md: empty content in "## ${required}"`);
  }

  // Hash-staleness: only CLI-generated packets carry `sources` frontmatter.
  // Legacy hand-written packets (no `sources`) are never reported stale.
  const sources = parsed.data.sources;
  if (sources && typeof sources === 'object') {
    const proposalPath = path.join(changesDir, slug, 'proposal.md');
    const tasksPath = path.join(changesDir, slug, 'tasks.md');
    if (fs.existsSync(proposalPath) && fs.existsSync(tasksPath)) {
      const current = packetSourceHashes(slug, changesDir);
      if (current.proposal !== sources.proposal || current.tasks !== sources.tasks) {
        issues.push(`context-packet.md stale — re-run \`playbook packet ${slug}\``);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
