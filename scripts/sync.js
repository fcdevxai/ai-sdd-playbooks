#!/usr/bin/env node

/**
 * sync.js — Generates .github/skills/ and .claude/commands/ from canonical playbooks.
 *
 * Usage:
 *   node scripts/sync.js          → generate files into dist/
 *   node scripts/sync.js --check  → exit 1 if dist/ differs from what would be generated (CI use)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PLAYBOOKS_DIR = path.join(ROOT, 'playbooks');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const DIST_SKILLS = path.join(ROOT, 'dist', 'github-skills');
const DIST_COMMANDS = path.join(ROOT, 'dist', 'claude-commands');

const CHECK_MODE = process.argv.includes('--check');

// ── Section extraction ──────────────────────────────────────────────────────

/**
 * Extracts named H2 sections from a markdown body.
 * Returns a map of { headingText: bodyContent }.
 */
function extractSections(markdown) {
  const sections = {};
  const lines = markdown.split('\n');
  let current = null;
  let buffer = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      if (current !== null) {
        sections[current] = buffer.join('\n').trim().replace(/\n*---\s*$/, '').trimEnd();
      }
      current = h2Match[1].trim();
      buffer = [];
    } else if (current !== null) {
      buffer.push(line);
    }
  }
  if (current !== null) {
    sections[current] = buffer.join('\n').trim().replace(/\n*---\s*$/, '').trimEnd();
  }
  return sections;
}

// ── SKILL.md renderer ───────────────────────────────────────────────────────

function renderSkill(frontmatter, body) {
  const templatePath = path.join(TEMPLATES_DIR, 'skill.md.hbs');
  const template = fs.readFileSync(templatePath, 'utf8');

  return template
    .replaceAll('{{NAME}}', frontmatter.slug)
    .replaceAll('{{DESCRIPTION}}', frontmatter.description)
    .replaceAll('{{TITLE}}', frontmatter.title_en || frontmatter.slug)
    .replaceAll('{{BODY}}', body);
}

// ── command.md renderer ─────────────────────────────────────────────────────

function renderCommand(frontmatter, sections) {
  const templatePath = path.join(TEMPLATES_DIR, 'command.md.hbs');
  const template = fs.readFileSync(templatePath, 'utf8');

  return template
    .replaceAll('{{SLUG}}', frontmatter.slug)
    .replaceAll('{{TITLE_ES}}', frontmatter.title_es || frontmatter.slug)
    .replaceAll('{{OBJECTIVE_ES}}', sections['Objetivo'] || '')
    .replaceAll('{{WHEN_ES}}', frontmatter.when_es || '')
    .replaceAll('{{INSTRUCTIONS_ES}}', sections['Instrucciones'] || '')
    .replaceAll('{{CHECKLIST_ES}}', sections['Checklist'] || '')
    .replaceAll('{{REPORT_FORMAT_ES}}', sections['Formato de reporte'] || '')
    .replaceAll('{{BLOCKER_RULES_ES}}', sections['Criterio de bloqueo'] || '')
    .replaceAll('{{NOT_REPLACES_ES}}', sections['Qu\u00e9 NO reemplaza'] || '');
}

// ── File writer (or drift checker) ──────────────────────────────────────────

let driftFound = false;

function writeOrCheck(filePath, content) {
  if (CHECK_MODE) {
    if (!fs.existsSync(filePath)) {
      console.error(`DRIFT: missing file ${filePath}`);
      driftFound = true;
      return;
    }
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing !== content) {
      console.error(`DRIFT: ${filePath} is out of sync with canonical`);
      driftFound = true;
    }
  } else {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ ${path.relative(ROOT, filePath)}`);
  }
}

// ── Remove stale generated files ────────────────────────────────────────────

function cleanStale(dir, validSlugs, isDir = false) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const slug = isDir ? entry : path.basename(entry, '.md');
    if (!validSlugs.has(slug)) {
      const fullPath = path.join(dir, entry);
      if (!CHECK_MODE) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  ✗ removed stale: ${path.relative(ROOT, fullPath)}`);
      } else {
        console.error(`DRIFT: stale file ${fullPath}`);
        driftFound = true;
      }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

const slugs = fs.readdirSync(PLAYBOOKS_DIR).filter(d =>
  fs.statSync(path.join(PLAYBOOKS_DIR, d)).isDirectory()
);

const validSlugs = new Set(slugs);

if (!CHECK_MODE) {
  console.log(`\nGenerating playbooks (${slugs.length} flows)...\n`);
}

for (const slug of slugs) {
  const canonicalPath = path.join(PLAYBOOKS_DIR, slug, 'canonical.md');
  if (!fs.existsSync(canonicalPath)) {
    console.warn(`  ⚠ skipping ${slug}: canonical.md not found`);
    continue;
  }

  const raw = fs.readFileSync(canonicalPath, 'utf8');
  const { data: frontmatter, content } = matter(raw);

  // Extract skill body: everything before <!-- END_SKILL -->
  const END_SKILL = '<!-- END_SKILL -->';
  const delimIdx = content.indexOf(END_SKILL);
  const skillBody = (delimIdx !== -1 ? content.slice(0, delimIdx) : content).trim();

  // Extract sections for command rendering (uses full content)
  const sections = extractSections(content);

  // Generate SKILL.md
  const skillContent = renderSkill({ ...frontmatter, slug }, skillBody);
  writeOrCheck(path.join(DIST_SKILLS, slug, 'SKILL.md'), skillContent);

  // Generate command.md
  const commandContent = renderCommand({ ...frontmatter, slug }, sections);
  writeOrCheck(path.join(DIST_COMMANDS, `${slug}.md`), commandContent);
}

// Clean stale files
cleanStale(DIST_SKILLS, validSlugs, true);
cleanStale(DIST_COMMANDS, validSlugs, false);

if (CHECK_MODE) {
  if (driftFound) {
    console.error('\n❌ Drift detected. Run: node scripts/sync.js\n');
    process.exit(1);
  } else {
    console.log('✅ No drift detected — all generated files are in sync.\n');
    process.exit(0);
  }
} else {
  console.log(`\n✅ Done. Generated ${slugs.length * 2} files.\n`);
}
