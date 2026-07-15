import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { lintSkillFrontmatter, lintSkillsDir, readSkillFrontmatter } from '../src/install/skill-contract.js';
import { SKILL_PRECONDITIONS } from '../src/lifecycle/preconditions.js';

const SKILLS_DIR = fileURLToPath(new URL('../skills', import.meta.url));

function body(name) {
  return fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
}

test('lintSkillFrontmatter accepts a valid contract and rejects bad fields', () => {
  assert.equal(lintSkillFrontmatter({ name: 'sdd-x', description: 'ok', version: '2.0.0' }).valid, true);
  assert.equal(lintSkillFrontmatter({ name: 'Sdd X', description: 'ok', version: '2.0.0' }).valid, false);
  assert.equal(lintSkillFrontmatter({ name: 'sdd-x', description: '', version: '2.0.0' }).valid, false);
  assert.equal(lintSkillFrontmatter({ name: 'sdd-x', description: 'ok', requires: [] }).valid, false);
});

test('every authored skill lints clean (T5.1)', () => {
  const results = lintSkillsDir(SKILLS_DIR);
  const bad = results.filter((r) => !r.valid);
  assert.deepEqual(bad, [], `invalid skills: ${JSON.stringify(bad)}`);
  assert.ok(results.length >= 8);
});

test('the Phase 5 core skills are present (T5.2)', () => {
  for (const name of ['sdd-enrich-us', 'sdd-new', 'sdd-apply', 'sdd-code-review', 'sdd-verify', 'sdd-archive', 'sdd-next', 'sdd-ff']) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')), `${name} exists`);
  }
});

test('parity checklist: converted skills carry their key behavior (T5.2)', () => {
  assert.match(body('sdd-apply'), /TDD/);
  assert.match(body('sdd-apply'), /Never modify files outside/i);
  assert.match(body('sdd-code-review'), /Spec coverage/i);
  assert.match(body('sdd-verify'), /regression/i);
  assert.match(body('sdd-archive'), /openspec\/specs/);
  assert.match(body('sdd-new'), /OWNER\.md/);
  assert.match(body('sdd-enrich-us'), /decision/i);
});

test('2.0 skills use approved (not pending) and sdd-plan (not sdd-ff)', () => {
  for (const name of ['sdd-apply', 'sdd-new']) {
    assert.doesNotMatch(body(name), /status:\s*pending/);
  }
  // no core skill silently routes to sdd-ff
  assert.doesNotMatch(body('sdd-apply'), /sdd-ff/);
});

test('sdd-ff is deprecated without a silent alias (C-05, T5.3)', () => {
  const fm = readSkillFrontmatter(path.join(SKILLS_DIR, 'sdd-ff'));
  assert.equal(fm.deprecated, true);
  assert.deepEqual(fm.produces, []);
  const b = body('sdd-ff');
  assert.match(b, /deprecated in SDD 2\.0/i);
  assert.match(b, /sdd next/);
  assert.match(b, /Never execute `sdd-plan`/); // does not run the planner
  assert.match(b, /Never produce `tasks\.md`/);  // does not generate tasks.md
});

test('sdd-apply SKILL.md requires matches the precondition table (no drift)', () => {
  const fm = readSkillFrontmatter(path.join(SKILLS_DIR, 'sdd-apply'));
  assert.deepEqual(fm.requires, SKILL_PRECONDITIONS['sdd-apply']);
});
