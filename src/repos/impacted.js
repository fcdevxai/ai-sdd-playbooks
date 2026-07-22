/**
 * `## Impacted repos` extraction from proposal.md — ported from specloom's
 * `extractImpactedRepos`/`readImpactedRepos` (framework/cli/lib.js, ADR-015).
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { headingSection } from '../util/markdown.js';
import { assertSafeSlug } from './slug.js';

export function defaultChangesDir(cwd = process.cwd()) {
  return path.join(cwd, 'openspec', 'changes');
}

export function readProposalBody(slug, changesDir) {
  assertSafeSlug(slug);
  const proposalPath = path.join(changesDir, slug, 'proposal.md');
  if (!fs.existsSync(proposalPath)) {
    throw new Error(`proposal.md not found for "${slug}" at ${proposalPath}`);
  }
  return fs.readFileSync(proposalPath, 'utf8');
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
