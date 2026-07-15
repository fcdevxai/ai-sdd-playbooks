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

test('the Confluence add-on skills lint clean (T12.1)', () => {
  const dir = fileURLToPath(new URL('../addons/confluence', import.meta.url));
  const results = lintSkillsDir(dir);
  assert.deepEqual(results.filter((r) => !r.valid), []);
  assert.deepEqual(results.map((r) => r.name).sort(), ['document-code', 'write-in-confluence']);
});

test('the Phase 5 core skills are present (T5.2)', () => {
  for (const name of ['sdd-enrich-us', 'sdd-new', 'sdd-design', 'sdd-plan', 'sdd-apply', 'sdd-code-review', 'sdd-security-gate', 'sdd-runtime-gate', 'sdd-commit', 'sdd-verify', 'sdd-archive', 'sdd-next', 'sdd-ff', 'sdd-bootstrap-project']) {
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

test('sdd-bootstrap-project is diff-then-approve; declining is a no-op (T11.3)', () => {
  const b = body('sdd-bootstrap-project');
  assert.match(b, /diff/i);
  assert.match(b, /approv/i);
  assert.match(b, /no-op|declin/i);
  assert.match(b, /unchanged/i);
});

test('sdd-bootstrap-project detects and proposes capabilities (Option A)', () => {
  const b = body('sdd-bootstrap-project');
  assert.match(b, /capabilit/i);
  assert.match(b, /browser/);
  assert.match(b, /http/);
  assert.match(b, /signal/i); // proposal is grounded in signals, not guesses
});

test('sdd-commit follows the GitHub model: no hardcoded branch, no auto-merge (C-11)', () => {
  const b = body('sdd-commit');
  assert.match(b, /[Nn]ever hardcode/);
  assert.match(b, /base branch/i);
  assert.match(b, /[Nn]ever merge automatically/i);
  assert.match(b, /ci_passed/);
});

test('sdd-runtime-gate never fabricates passed and blocks on missing dependency (T8.2/T8.3)', () => {
  const b = body('sdd-runtime-gate');
  assert.match(b, /Never fabricate `passed`/i);
  assert.match(b, /DEPENDENCY_UNAVAILABLE/);
  assert.match(b, /Playwright MCP/i);
  assert.match(b, /not_applicable/);
});

test('sdd-security-gate states the non-replacement disclaimer and blocking rule (T7.2/T7.3)', () => {
  const b = body('sdd-security-gate');
  assert.match(b, /does not replace a penetration test/i);
  assert.match(b, /never lowers/i);
  assert.match(b, /blocking finding/i);
});

test('sdd-apply / sdd-plan SKILL.md requires match the precondition table (no drift)', () => {
  assert.deepEqual(readSkillFrontmatter(path.join(SKILLS_DIR, 'sdd-apply')).requires, SKILL_PRECONDITIONS['sdd-apply']);
  assert.deepEqual(readSkillFrontmatter(path.join(SKILLS_DIR, 'sdd-plan')).requires, SKILL_PRECONDITIONS['sdd-plan']);
});

test('sdd-new proposes a complete impact block + security (T6.1/C-03/C-04)', () => {
  const b = body('sdd-new');
  for (const k of ['public_contract', 'data_model', 'architecture_boundary', 'external_integration',
    'cross_repository', 'authentication', 'authorization', 'infrastructure', 'concurrency', 'migration']) {
    assert.match(b, new RegExp(`\\b${k}\\b`), `impact indicator ${k}`);
  }
  assert.match(b, /security:/);
  assert.match(b, /risk:/);
});
