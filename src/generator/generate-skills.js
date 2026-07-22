#!/usr/bin/env node
/**
 * Skill generator — canonical.md → SKILL.md (design: merged authoring model).
 *
 * lablab authored SKILL.md directly; specloom authored a `canonical.md` per
 * playbook and generated SKILL.md (+ slash commands) from it via
 * `framework/scripts/sync.js`. This repo keeps ONE canonical source per skill
 * (`skills/<name>/canonical.md`) and generates `skills/<name>/SKILL.md` next to
 * it — the sibling that `src/install/skills.js` actually copies into the
 * global targets (canonical.md never travels there).
 *
 * Unlike specloom's generator, this one does NOT strip the frontmatter down to
 * {name, description} — it keeps the full merged contract (lifecycle_stage,
 * produces, requires, description_es, title_es, ...) so a human or agent
 * reading the installed SKILL.md sees the same rich metadata as the source.
 *
 * Usage:
 *   node src/generator/generate-skills.js            → generate all skills/<name>/SKILL.md
 *   node src/generator/generate-skills.js --check     → exit 1 on drift (CI use)
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';
import { splitSections } from '../util/markdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
export const SKILLS_DIR = path.join(PACKAGE_ROOT, 'skills');

const SECTION_ORDER = ['Purpose', 'Context', 'Behavior', 'Output', 'Rules'];

function renderSkillBody(frontmatter, sections) {
  const lines = [];
  lines.push(`# ${frontmatter.title_en || frontmatter.name}`);
  lines.push('');
  if (frontmatter.when) {
    lines.push(`**When to run:** ${frontmatter.when}`);
    lines.push('');
  }
  for (const title of SECTION_ORDER) {
    if (!(title in sections)) continue;
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(sections[title]);
    lines.push('');
  }
  // Any section not in the canonical order still gets rendered, in source order.
  for (const [title, body] of Object.entries(sections)) {
    if (SECTION_ORDER.includes(title)) continue;
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(body);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push(`**Output file:** ${frontmatter.output_file || 'N/A'}`);
  lines.push(`**Requires terminal:** ${frontmatter.requires_terminal ? 'yes' : 'no'}`);
  return lines.join('\n').trimEnd() + '\n';
}

// Frontmatter fields that pass through verbatim into the generated SKILL.md.
// `when`/`output_file`/`requires_terminal` are folded into the body instead
// (see renderSkillBody) so they don't duplicate as raw YAML noise.
const PASSTHROUGH_FRONTMATTER_KEYS = [
  'name', 'description', 'description_es', 'title_es',
  'version', 'lifecycle_stage', 'produces', 'requires',
];

function renderSkillFrontmatter(frontmatter) {
  const out = {};
  for (const key of PASSTHROUGH_FRONTMATTER_KEYS) {
    if (key in frontmatter) out[key] = frontmatter[key];
  }
  return out;
}

export function renderSkill(frontmatter, sections) {
  const body = renderSkillBody(frontmatter, sections);
  return matter.stringify(body, renderSkillFrontmatter(frontmatter));
}

export function listSkillSlugs(skillsDir = SKILLS_DIR) {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir).filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory());
}

export function generateOne(slug, skillsDir = SKILLS_DIR) {
  const canonicalPath = path.join(skillsDir, slug, 'canonical.md');
  if (!fs.existsSync(canonicalPath)) return null;
  const raw = fs.readFileSync(canonicalPath, 'utf8');
  const { data: frontmatter, content } = matter(raw);
  const sections = splitSections(content);
  return renderSkill({ ...frontmatter, name: frontmatter.name || slug }, sections);
}

function main() {
  const checkMode = process.argv.includes('--check');
  const slugs = listSkillSlugs();
  let driftFound = false;

  for (const slug of slugs) {
    const generated = generateOne(slug);
    if (generated === null) {
      console.warn(`  ⚠ skipping ${slug}: canonical.md not found`);
      continue;
    }
    const outPath = path.join(SKILLS_DIR, slug, 'SKILL.md');
    if (checkMode) {
      const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
      if (existing !== generated) {
        console.error(`DRIFT: ${path.relative(PACKAGE_ROOT, outPath)} is out of sync with canonical.md`);
        driftFound = true;
      }
    } else {
      fs.writeFileSync(outPath, generated, 'utf8');
      console.log(`  ✓ skills/${slug}/SKILL.md`);
    }
  }

  if (checkMode) {
    if (driftFound) {
      console.error('\n❌ Drift detected. Run: node src/generator/generate-skills.js\n');
      process.exit(1);
    }
    console.log(`✅ No drift — ${slugs.length} skill(s) in sync.\n`);
    return;
  }
  console.log(`\n✅ Generated ${slugs.length} skill(s).\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
