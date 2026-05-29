#!/usr/bin/env node
/**
 * fix-bodies.mjs — One-shot migration script.
 * Reads committed datayo SKILL.md files and updates canonical.md bodies + title_en
 * so the generator produces output identical to the committed datayo content.
 *
 * Usage: node scripts/fix-bodies.mjs
 */

import { execSync } from 'child_process';
import fs from 'fs';
import matter from 'gray-matter';

const DATAYO = '/home/ubuntu/datayo';
const PLAYBOOKS = '/home/ubuntu/ai-sdd-playbooks/playbooks';
const skills = [
  'enrich-us',
  'sdd-apply',
  'sdd-ff',
  'sdd-new',
  'sdd-commit',
  'sdd-verify',
  'sdd-code-review',
];

const END_SKILL = '<!-- END_SKILL -->';

for (const skill of skills) {
  // 1. Get committed SKILL.md from datayo git
  const committed = execSync(
    `git show HEAD:.ai/skills/${skill}/SKILL.md`,
    { cwd: DATAYO }
  ).toString();

  // 2. Parse committed SKILL.md manually (gray-matter may choke on unquoted
  //    description values containing colons like "status: pending")
  const committedLines = committed.split('\n');

  // Skip the YAML frontmatter block (---...---)
  let inFrontmatter = false;
  let afterFrontmatterIdx = 0;
  for (let i = 0; i < committedLines.length; i++) {
    if (i === 0 && committedLines[i] === '---') { inFrontmatter = true; continue; }
    if (inFrontmatter && committedLines[i] === '---') {
      afterFrontmatterIdx = i + 1;
      break;
    }
  }
  const bodyLines = committedLines.slice(afterFrontmatterIdx);

  // Find the # Title line (first non-empty line after frontmatter)
  let titleLineIdx = -1;
  for (let i = 0; i < bodyLines.length; i++) {
    if (bodyLines[i].startsWith('# ')) { titleLineIdx = i; break; }
  }
  if (titleLineIdx === -1) {
    console.error(`❌ No # title found in ${skill}`);
    continue;
  }
  const title = bodyLines[titleLineIdx].slice(2);

  // Body = everything after "# title\n\n" (skip title line + blank separator)
  const skillBody = bodyLines.slice(titleLineIdx + 2).join('\n');

  // 3. Read canonical.md
  const canonicalPath = `${PLAYBOOKS}/${skill}/canonical.md`;
  const raw = fs.readFileSync(canonicalPath, 'utf8');

  // 4. Parse canonical.md to separate frontmatter from content
  // We do this manually to preserve YAML formatting exactly
  const fmMatch = raw.match(/^(---\n[\s\S]+?\n---\n)([\s\S]*)$/);
  if (!fmMatch) {
    console.error(`❌ Could not parse frontmatter in ${skill}/canonical.md`);
    continue;
  }
  const fmBlock = fmMatch[1]; // "---\n...\n---\n"
  const contentBlock = fmMatch[2]; // everything after frontmatter

  // 5. Update title_en in the frontmatter block
  const updatedFm = fmBlock.replace(
    /^title_en:.*$/m,
    `title_en: "${title.replace(/"/g, '\\"')}"`
  );

  // 6. Preserve everything after <!-- END_SKILL --> in the content
  const delimIdx = contentBlock.indexOf(END_SKILL);
  const afterDelim = delimIdx !== -1 ? contentBlock.slice(delimIdx) : '';

  // 7. Build new canonical.md
  // Body = skillBody, then END_SKILL delimiter, then Spanish content
  const newContent = updatedFm + '\n' + skillBody + '\n' + afterDelim;

  fs.writeFileSync(canonicalPath, newContent, 'utf8');
  console.log(`✓ Updated ${skill} (title: "${title}")`);
}

console.log('\nDone. Run: node scripts/sync.js && node scripts/sync.js --check');
