/**
 * ADR (Architecture Decision Record) structural validation — ported from
 * specloom's `validateADR` (framework/cli/lib.js). Structural check for a
 * single ADR file (draft or promoted); issues are unprefixed, callers add the
 * file name. Pure with respect to the caller: takes a path, reads it once.
 */
import fs from 'node:fs';
import matter from 'gray-matter';
import { splitSections, splitSubSections, isEmpty } from '../util/markdown.js';

export const ADR_STATUSES = ['proposed', 'accepted', 'superseded', 'rejected'];
export const ADR_REQUIRED_SECTIONS = [
  'Context',
  'Decision',
  'Consequences',
  'Alternatives considered',
  'Impact',
];
export const ADR_CONSEQUENCE_SUBSECTIONS = ['Positive', 'Negative', 'Risks'];
export const ADR_IMPACT_SURFACES = ['backend', 'frontend', 'security', 'data', 'deployment', 'testing'];

export function readFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return matter(fs.readFileSync(filePath, 'utf8'));
}

export function validateADR(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, issues: [`file not found: ${filePath}`] };
  }
  const parsed = readFrontmatter(filePath);
  const issues = [];

  for (const field of ['status', 'date', 'ticket']) {
    if (!parsed.data[field]) issues.push(`missing frontmatter field: ${field}`);
  }
  if (parsed.data.status && !ADR_STATUSES.includes(parsed.data.status)) {
    issues.push(`invalid status: "${parsed.data.status}" (expected one of: ${ADR_STATUSES.join(', ')})`);
  }

  const sections = splitSections(parsed.content);
  for (const required of ADR_REQUIRED_SECTIONS) {
    if (!(required in sections)) {
      issues.push(`missing section: "## ${required}"`);
      continue;
    }
    if (isEmpty(sections[required])) issues.push(`empty content in "## ${required}"`);
  }

  if ('Consequences' in sections) {
    const subs = splitSubSections(sections['Consequences']);
    for (const sub of ADR_CONSEQUENCE_SUBSECTIONS) {
      if (!(sub in subs)) {
        issues.push(`missing subsection "### ${sub}" in "## Consequences"`);
        continue;
      }
      if (isEmpty(subs[sub])) issues.push(`empty subsection "### ${sub}" in "## Consequences"`);
    }
  }

  // Every surface must be addressed, even if only to state "no impact" explicitly.
  if ('Impact' in sections && !isEmpty(sections['Impact'])) {
    const impact = sections['Impact'].toLowerCase();
    for (const surface of ADR_IMPACT_SURFACES) {
      if (!impact.includes(surface)) {
        issues.push(`missing surface "${surface}" in "## Impact" (state it explicitly even if unaffected)`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
