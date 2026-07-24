import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintSkillFrontmatter, lintSkillsDir, readSkillFrontmatter } from '../src/install/skill-contract.js';
import { SKILL_PRECONDITIONS } from '../src/lifecycle/preconditions.js';

const SKILLS_DIR = fileURLToPath(new URL('../skills', import.meta.url));

function body(name) {
  return fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
}

test('lintSkillFrontmatter accepts a valid contract and rejects bad fields', () => {
  assert.equal(lintSkillFrontmatter({ name: 'sdd-x', description: 'ok', version: '0.1.0' }).valid, true);
  assert.equal(lintSkillFrontmatter({ name: 'Sdd X', description: 'ok', version: '0.1.0' }).valid, false);
  assert.equal(lintSkillFrontmatter({ name: 'sdd-x', description: '', version: '0.1.0' }).valid, false);
  assert.equal(lintSkillFrontmatter({ name: 'sdd-x', description: 'ok', requires: [] }).valid, false);
});

test('every authored skill lints clean', () => {
  const results = lintSkillsDir(SKILLS_DIR);
  const bad = results.filter((r) => !r.valid);
  assert.deepEqual(bad, [], `invalid skills: ${JSON.stringify(bad)}`);
  assert.ok(results.length >= 13);
});

test('the Confluence add-on skills lint clean', () => {
  const dir = fileURLToPath(new URL('../addons/confluence', import.meta.url));
  const results = lintSkillsDir(dir);
  assert.deepEqual(results.filter((r) => !r.valid), []);
  assert.deepEqual(results.map((r) => r.name).sort(), ['code-audit-comment', 'document-code', 'operational-guide']);
});

test('lintSkillsDir ignores broken symlinks in shared global skill dirs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-skill-contract-'));
  fs.symlinkSync(path.join(dir, 'missing-skill-target'), path.join(dir, 'find-skills'), 'dir');
  assert.deepEqual(lintSkillsDir(dir), []);
});

test('the core skills are present (13 skills)', () => {
  const names = ['sdd-enrich-us', 'sdd-new', 'sdd-design', 'sdd-plan', 'sdd-apply', 'sdd-code-review', 'sdd-security-gate', 'sdd-runtime-gate', 'sdd-commit', 'sdd-verify', 'sdd-archive', 'sdd-next', 'sdd-bootstrap-project'];
  assert.equal(names.length, 13);
  for (const name of names) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')), `${name} exists`);
  }
});

test('the 13 core skills satisfy the Codex filesystem-skill minimum contract', () => {
  for (const result of lintSkillsDir(SKILLS_DIR)) {
    const fm = readSkillFrontmatter(path.join(SKILLS_DIR, result.name));
    assert.equal(typeof fm.name, 'string', `${result.name} has a name`);
    assert.equal(typeof fm.description, 'string', `${result.name} has a description`);
    assert.ok(fm.description.length > 40, `${result.name} has a useful discovery description`);
  }
});

test('parity checklist: reconciled skills carry their key behavior', () => {
  assert.match(body('sdd-apply'), /TDD/);
  assert.match(body('sdd-apply'), /Never modify files outside/i);
  assert.match(body('sdd-code-review'), /Spec coverage/i);
  assert.match(body('sdd-verify'), /regression/i);
  assert.match(body('sdd-archive'), /openspec\/specs/);
  assert.match(body('sdd-new'), /OWNER\.md/);
  assert.match(body('sdd-enrich-us'), /decision/i);
});

test('diff-first: the 3 gates instruct changed-files --diff; security-gate keeps full-read on sensitive surface (AC-1, SEC-2)', () => {
  for (const name of ['sdd-code-review', 'sdd-security-gate', 'sdd-runtime-gate']) {
    assert.match(body(name), /changed-files .*--diff/, `${name} instructs diff-first`);
  }
  // SEC-2: diff-first must never strip the security gate's right to full-read on a sensitive surface.
  const sec = body('sdd-security-gate');
  assert.match(sec, /full-read/i, 'security gate keeps full-read clause');
  assert.match(sec, /sensitive surface/i, 'security gate scopes full-read to the sensitive surface');
});

test('section-first: gates + verify + commit instruct spec-read; apply/archive do not (AC-2)', () => {
  for (const name of ['sdd-code-review', 'sdd-security-gate', 'sdd-runtime-gate', 'sdd-verify', 'sdd-commit']) {
    assert.match(body(name), /spec-read/, `${name} instructs section-first`);
  }
  for (const name of ['sdd-apply', 'sdd-archive']) {
    assert.doesNotMatch(body(name), /spec-read/, `${name} must not instruct section-first`);
  }
});

test('sdd-verify re-runs SEC-N negatives post-merge and carries a Security considerations table (AC-3, SEC-3)', () => {
  const b = body('sdd-verify');
  assert.match(b, /SEC-N/, 'names the SEC-N considerations');
  assert.match(b, /post-merge|merged code|re-run/i, 'instructs re-running negatives against merged code');
  assert.match(b, /## Security considerations/, 'report template carries the Security considerations table');
});

test('sdd-enrich-us lists Security and data sensitivity as a mandatory decision dimension (AC-5)', () => {
  const b = body('sdd-enrich-us');
  assert.match(b, /security and data sensitivity/i);
});

test('core skills use approved, not a pending status', () => {
  for (const name of ['sdd-apply', 'sdd-new']) {
    assert.doesNotMatch(body(name), /status:\s*pending/);
  }
});

test('sdd-bootstrap-project is diff-then-approve; declining is a no-op', () => {
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

test('sdd-bootstrap-project proposes multi-repo topology without filtering candidates by naming', () => {
  const b = body('sdd-bootstrap-project');
  assert.match(b, /detectSiblingRepos/);
  assert.match(b, /repos:/);
  assert.match(b, /sort hint, never a filter/i);
  assert.match(b, /verification/i);
  assert.match(b, /role: sdd/);
});

test('sdd-bootstrap-project invokes the `playbook detect-siblings` command, not the JS function directly (AC-5, AC-7)', () => {
  const b = body('sdd-bootstrap-project');
  assert.match(b, /playbook detect-siblings/, 'invokes the CLI command');
});

test('sdd-bootstrap-project re-invokes the sibling detector on re-run instead of treating a populated repos: as already resolved (AC-1, AC-2)', () => {
  const b = body('sdd-bootstrap-project');
  assert.match(b, /re-run|re-invoke/i, 're-run/re-invoke instruction present');
  assert.match(b, /already (has entries|populated|confirmed)/i, 'addresses the populated-repos: case explicitly');
  assert.match(b, /never.*(skip|reason to skip)/i, 'states a populated repos: is never a reason to skip re-detection');
});

test('sdd-bootstrap-project detects and refreshes a stale workflow doc (closes the playbook doctor promise)', () => {
  const b = body('sdd-bootstrap-project');
  assert.match(b, /sdd-methodology/); // checks the same marker `playbook doctor` reads
  assert.match(b, /workflow/i);
  assert.match(b, /full replacement/i); // not a partial merge — the doc is methodology-owned
  assert.match(b, /playbook doctor/i); // description names the doctor-warning trigger explicitly
});

test('sdd-commit follows the GitHub model: no hardcoded branch, no auto-merge', () => {
  const b = body('sdd-commit');
  assert.match(b, /[Nn]ever hardcode/);
  assert.match(b, /base branch/i);
  assert.match(b, /[Nn]ever merge automatically/i);
  assert.match(b, /ci_passed/);
});

test('sdd-runtime-gate never fabricates passed and blocks on missing dependency', () => {
  const b = body('sdd-runtime-gate');
  assert.match(b, /Never fabricate `passed`/i);
  assert.match(b, /DEPENDENCY_UNAVAILABLE/);
  assert.match(b, /Playwright MCP/i);
  assert.match(b, /not_applicable/);
});

test('sdd-runtime-gate honors per-change runtime_relevant_capabilities', () => {
  const b = body('sdd-runtime-gate');
  assert.match(b, /runtime_relevant_capabilities/);
  assert.match(b, /NOT_RELEVANT_TO_CHANGE/);
  assert.match(b, /absent,\s+every[\s\S]*?enabled capability is relevant/i);
});

test('sdd-runtime-gate absorbs the UX/UI checklist into the browser adapter', () => {
  const b = body('sdd-runtime-gate');
  assert.match(b, /loading, empty, error, and\s*\n?success states|loading.*empty.*error/i);
  assert.match(b, /accessibility/i);
  assert.match(b, /responsive/i);
});

test('sdd-new proposes runtime_relevant_capabilities from signals, never a silent guess', () => {
  const b = body('sdd-new');
  assert.match(b, /runtime_relevant_capabilities/);
  assert.match(b, /omit the field entirely/i);
  assert.match(b, /as a guess/i);
});

test('sdd-new keeps impact, security triggers, and runtime capabilities separate', () => {
  const b = body('sdd-new');
  assert.match(b, /Keep the three proposal taxonomies separate/);
  assert.match(b, /impact\.public_contract: true/);
  assert.match(b, /security\.triggers/);
  assert.match(b, /runtime_relevant_capabilities/);
  assert.match(b, /Never place capability names \(`http`, `browser`, `cli`, `worker`\)/);
  assert.match(b, /impact keys\s*\(`public_contract`, `data_model`/);
  assert.match(b, /playbook validate` fail/);
});

test('sdd-new creates ADR drafts for decisions flagged in sdd-enrich-us', () => {
  const b = body('sdd-new');
  assert.match(b, /\[ADR candidate\]/);
  assert.match(b, /status: proposed/);
  assert.match(b, /ADR-NNN/);
});

test('sdd-security-gate states the non-replacement disclaimer and blocking rule', () => {
  const b = body('sdd-security-gate');
  assert.match(b, /does not replace a penetration test/i);
  assert.match(b, /never lowers/i);
  assert.match(b, /blocking finding/i);
});

test('sdd-apply / sdd-plan SKILL.md requires match the precondition table (no drift)', () => {
  assert.deepEqual(readSkillFrontmatter(path.join(SKILLS_DIR, 'sdd-apply')).requires, SKILL_PRECONDITIONS['sdd-apply']);
  assert.deepEqual(readSkillFrontmatter(path.join(SKILLS_DIR, 'sdd-plan')).requires, SKILL_PRECONDITIONS['sdd-plan']);
});

test('sdd-commit and sdd-runtime-gate read the context-packet instead of full proposal/tasks (AC-1, EC-1)', () => {
  for (const name of ['sdd-commit', 'sdd-runtime-gate']) {
    const b = body(name);
    assert.match(b, /context-packet\.md/, `${name} mentions context-packet.md`);
    assert.match(b, /read it instead of/i, `${name} instructs reading the packet instead of full sources`);
  }
});

test('no skill instructs spec-read against proposal.md/tasks.md — spec-read is confined to permanent specs (AC-2, SEC-2)', () => {
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const b = body(entry.name);
    assert.doesNotMatch(b, /proposal\.md#/, `${entry.name} must not spec-read proposal.md#...`);
    assert.doesNotMatch(b, /tasks\.md#/, `${entry.name} must not spec-read tasks.md#...`);
  }
});

test('the 5 section-first skills instruct spec-index discovery when the index is missing (AC-4, EC-1)', () => {
  for (const name of ['sdd-code-review', 'sdd-security-gate', 'sdd-runtime-gate', 'sdd-verify', 'sdd-commit']) {
    assert.match(body(name), /spec-index/, `${name} mentions spec-index`);
  }
});

test('sdd-apply references .specloom/runs/, not the stale .playbook/runs/ (AC-5, EC-1)', () => {
  const b = body('sdd-apply');
  assert.match(b, /\.specloom\/runs\//);
  assert.doesNotMatch(b, /\.playbook\/runs\//);
});

test('sdd-design authors the canonical contract when the proposal declares public_contract (AC-1, AC-2)', () => {
  const b = body('sdd-design');
  assert.match(b, /impact\.public_contract: true/, 'gated on the proposal impact flag');
  assert.match(b, /contract\.path_in_loom/, 'gated on the project declaring a contract path');
  assert.match(b, /skip this step and say so/i, 'contract-first is opt-in: skip and report, never invent a path');
  assert.match(b, /minimal skeleton/i, 'creates the contract when the configured path does not exist');
  assert.match(b, /detector, never the authoring mechanism/i, 'contract-drift does not substitute for authoring');
});

test('sdd-design takes the contract path from config and never hardcodes it (AC-2)', () => {
  const b = body('sdd-design');
  assert.doesNotMatch(b, /openspec\/specs\/contracts\/openapi\.yaml/, 'the write target must come from config, not a literal path');
  assert.match(b, /never hardcode/i);
  assert.match(b, /Never write a canonical contract when `contract\.path_in_loom` is absent/, 'the ## Rules guard');
  assert.match(b, /must stay\s+\*\*inside the repo\*\*/, 'the write target is contained to the project root');
  assert.match(b, /\*\*Output file:\*\*.*contract\.path_in_loom/, 'output_file names the conditional side-effect');
});

test("sdd-design keeps the canonical contract and design.md's public contracts in sync (AC-3)", () => {
  const b = body('sdd-design');
  assert.match(b, /Public contracts \/ interfaces/);
  assert.match(b, /same set/i, 'the contract and the design prose describe the same endpoints');
  assert.match(b, /mismatch is a design defect/i, 'a divergence blocks, it is not a formatting detail');
});

test('sdd-design forbids secrets and PII in the canonical contract (SEC-001, AC-4)', () => {
  const b = body('sdd-design');
  // Negative half first (SEC-001): an instruction that forbids leaking secrets
  // must not ship a credential-shaped literal of its own. Same shape as the
  // CI-template check in test/contract-first.test.js.
  assert.doesNotMatch(b, /Bearer\s+[A-Za-z0-9._-]{8,}/, 'no bearer token literal');
  assert.doesNotMatch(b, /api[_-]?key\s*[:=]\s*\S/i, 'no api key literal');
  assert.doesNotMatch(b, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'no private key material');
  // Positive half: the prohibition is stated where the authoring happens.
  assert.match(b, /secrets, real tokens, or PII/i);
  assert.match(b, /`example`,\s+`description`, or `servers`/, 'names the fields where a leak would hide');
});

test("sdd-plan does not author the canonical contract — that is sdd-design's step (AC-1)", () => {
  const b = body('sdd-plan');
  assert.doesNotMatch(b, /openapi/i, 'contract authoring belongs to the design stage, under human sign-off');
  assert.doesNotMatch(b, /contract\.path_in_loom/);
});

test('the README names sdd-design as the contract authoring stage (AC-5)', () => {
  const readme = fs.readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
  // Assert on the section slice, not the whole file: a failure here should show
  // the contract-first block, not dump the entire README into the output.
  const block = readme.split(/^## Contract-first/m)[1]?.split(/^## /m)[0];
  assert.ok(block, 'README has a "## Contract-first" section');
  assert.match(block, /authored in `openspec\/specs\/contracts\/openapi\.yaml`/, 'still documents the canonical path');
  assert.match(block, /during `sdd-design`/);
  assert.doesNotMatch(block, /during `sdd-plan`/, 'the pre-wiring promise pointed at the wrong stage');
});

test('sdd-new proposes a complete impact block + security (C-03/C-04)', () => {
  const b = body('sdd-new');
  for (const k of ['public_contract', 'data_model', 'architecture_boundary', 'external_integration',
    'cross_repository', 'authentication', 'authorization', 'infrastructure', 'concurrency', 'migration']) {
    assert.match(b, new RegExp(`\\b${k}\\b`), `impact indicator ${k}`);
  }
  assert.match(b, /security:/);
  assert.match(b, /risk:/);
});
