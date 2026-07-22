/**
 * Body-markdown validation — the half of validation JSON Schema cannot express.
 *
 * `src/schema/validate.js` (ajv) checks an artifact's FRONTMATTER against
 * schemas/*.schema.json. Frontmatter alone cannot say "the `## Objective`
 * section exists and has real content" — that requires reading the markdown
 * body. This module is specloom's `validateProposal`/`validateDesign`/
 * `validatePacket` lineage, ported onto `src/util/markdown.js` instead of a
 * private copy of the same section-splitting code (C-12 still holds: this
 * never matches verdict strings or emojis, only section presence/emptiness).
 *
 * Pure with respect to callers: functions here take already-read file content,
 * never a path — path/fs concerns stay in the CLI layer (src/cli/validate.js).
 */
import { splitSections, isEmpty } from '../util/markdown.js';

// Sections that must exist AND have real (non-empty, non-placeholder) content.
export const PROPOSAL_REQUIRED_SECTIONS = [
  'Objective',
  'Guiding principle',
  'Impacted modules',
  'Expected behavior',
  'Acceptance criteria',
  'Error cases',
  'Security considerations',
  'Constraints and non-goals',
];

// Sections that must exist as a header, but may legitimately be left empty.
export const PROPOSAL_SECTIONS_MAY_BE_EMPTY = ['Open technical decisions'];

export const DESIGN_REQUIRED_SECTIONS = ['Approach', 'Module impact', 'Trade-offs'];

/** Checks a proposal.md BODY (not frontmatter) for missing/empty required sections. */
export function validateProposalBody(body) {
  const sections = splitSections(body);
  const issues = [];

  for (const required of PROPOSAL_REQUIRED_SECTIONS) {
    if (!(required in sections)) {
      issues.push(`missing section: "## ${required}"`);
      continue;
    }
    if (isEmpty(sections[required])) issues.push(`empty content in "## ${required}"`);
  }

  for (const required of PROPOSAL_SECTIONS_MAY_BE_EMPTY) {
    if (!(required in sections)) {
      issues.push(`missing section: "## ${required}" (may be empty, but the header must exist)`);
    }
  }

  return { ok: issues.length === 0, issues };
}

/** design.md is optional at the artifact level; when present its body must be complete. */
export function validateDesignBody(body) {
  const sections = splitSections(body);
  const issues = [];
  for (const required of DESIGN_REQUIRED_SECTIONS) {
    if (!(required in sections)) {
      issues.push(`missing section: "## ${required}"`);
      continue;
    }
    if (isEmpty(sections[required])) issues.push(`empty content in "## ${required}"`);
  }
  return { ok: issues.length === 0, issues };
}
