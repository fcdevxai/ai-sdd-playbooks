/**
 * Shared SKILL.md frontmatter contract + lint (design §2.2, T5.1).
 *
 * One SKILL.md must load in Claude Code, GitHub Copilot, and Codex, so the
 * frontmatter is a small, stable contract. `playbook doctor` uses this lint; it
 * lives here so it can be reused without importing a CLI command.
 *
 * Contract (required): name (kebab), description, version.
 * Contract (optional, machine-readable, drives the lifecycle engine):
 *   lifecycle_stage (string|null), produces (array), requires (object).
 * Contract (optional, bilingual authoring metadata — merged from the
 * specloom lineage; description_es/title_es keep a Spanish surface for
 * consumer-facing skill catalogs without touching the English body):
 *   description_es (string), title_en (string), title_es (string).
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export function lintSkillFrontmatter(fm) {
  const errors = [];
  if (!fm || typeof fm !== 'object') return { valid: false, errors: ['missing frontmatter'] };
  if (typeof fm.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(fm.name)) {
    errors.push('`name` must be a kebab-case string');
  }
  if (typeof fm.description !== 'string' || !fm.description.trim()) errors.push('`description` is required');
  if (typeof fm.version !== 'string') errors.push('`version` must be a string');
  if ('lifecycle_stage' in fm && fm.lifecycle_stage !== null && typeof fm.lifecycle_stage !== 'string') {
    errors.push('`lifecycle_stage` must be a string or null');
  }
  if ('produces' in fm && !Array.isArray(fm.produces)) errors.push('`produces` must be an array');
  if ('requires' in fm && (typeof fm.requires !== 'object' || fm.requires === null || Array.isArray(fm.requires))) {
    errors.push('`requires` must be an object');
  }
  for (const field of ['description_es', 'title_en', 'title_es']) {
    if (field in fm && typeof fm[field] !== 'string') errors.push(`\`${field}\` must be a string`);
  }
  return { valid: errors.length === 0, errors };
}

export function readSkillFrontmatter(skillDir) {
  const p = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(p)) return null;
  return matter(fs.readFileSync(p, 'utf8')).data;
}

export function lintSkillsDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const name of fs.readdirSync(dir)) {
    const skillDir = path.join(dir, name);
    let fm;
    try {
      if (!fs.statSync(skillDir).isDirectory()) continue;
      fm = readSkillFrontmatter(skillDir);
    } catch (err) {
      // Global skill directories may contain dangling symlinks or entries that
      // disappear while doctor is reading them. They are not installed skills.
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
    if (fm === null) { results.push({ name, valid: false, errors: ['no SKILL.md'] }); continue; }
    const r = lintSkillFrontmatter(fm);
    results.push({ name, ...r });
  }
  return results;
}
