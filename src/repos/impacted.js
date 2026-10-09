/**
 * `## Impacted repos` extraction from proposal.md — ported from specloom's
 * `extractImpactedRepos`/`readImpactedRepos` (specloom, ADR-015).
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { headingSection } from '../util/markdown.js';
import { assertSafeSlug } from './slug.js';
import { readEvidenceFile } from '../util/fs-safe.js';

export function defaultChangesDir(cwd = process.cwd()) {
  return path.join(cwd, 'openspec', 'changes');
}

export function readProposalBody(slug, changesDir) {
  assertSafeSlug(slug);
  const proposalPath = path.join(changesDir, slug, 'proposal.md');
  if (!fs.lstatSync(proposalPath, { throwIfNoEntry: false })) {
    throw new Error(`proposal.md not found for "${slug}" at ${proposalPath}`);
  }
  // Contained read (design Amendment R5, rule 4): the project root holds openspec/changes.
  const root = path.resolve(changesDir, '..', '..');
  return readEvidenceFile(root, path.relative(root, proposalPath), 'utf8');
}

export function extractImpactedRepos(content) {
  const section = headingSection(content, 'Impacted repos');
  if (!section) return [];
  const stripped = section.replace(/<!--.*?-->/gs, '').trim();
  if (!stripped || /^no aplica\.?$/i.test(stripped) || /^not applicable\.?$/i.test(stripped)) return [];

  const repos = [];
  for (const line of stripped.split('\n')) {
    const match = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!match) continue;
    if (/\b(no aplica|not applicable)\b/i.test(match[1])) continue;
    let repo = match[1].trim();
    repo = repo.replace(/^`([^`]+)`.*$/, '$1');
    repo = repo.replace(/^([^:]+):.*$/, '$1').trim();
    if (!/^[A-Za-z0-9_.-]+$/.test(repo)) continue;
    if (repo && !/^no aplica\.?$/i.test(repo) && !/^not applicable\.?$/i.test(repo)) repos.push(repo);
  }
  return [...new Set(repos)];
}

export function readImpactedRepos(slug, changesDir = defaultChangesDir()) {
  return extractImpactedRepos(matter(readProposalBody(slug, changesDir)).content);
}
