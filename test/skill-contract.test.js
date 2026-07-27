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

// --- contract-first-consumption Task 4.1 (AC-1, AC-2, AC-3): three-condition guard, declared skip, playbook.config.yaml in Context ---

test('sdd-design guards contract authoring on three explicit conditions, not two (AC-1)', () => {
  const b = body('sdd-design');
  assert.match(b, /impact\.public_contract:\s*true/, 'condition 1: proposal impact flag');
  assert.match(b, /contract\.path_in_loom/, 'condition 2: contract path declared');
  assert.match(b, /capabilities\.http:\s*true/, 'condition 3: project has HTTP capability');
  assert.match(b, /all three/i, 'the guard names itself as requiring all three, not two');
});

test('sdd-design declares the skip reason in design.md for both new skip cases, never silently (AC-2)', () => {
  const b = body('sdd-design');
  assert.match(b, /capabilities\.http:\s*false/, 'names the no-HTTP-project skip case');
  assert.match(b, /per change, not per project/i, 'the http:true + non-HTTP-change case is a per-change determination');
  assert.match(b, /## Public contracts \/ interfaces/, 'both skips are declared in this design.md section');
  assert.match(b, /never silent/i, 'the skip is always declared, never silent');
});

test('sdd-design reads playbook.config.yaml as part of ## Context (AC-3)', () => {
  const b = body('sdd-design');
  const contextSection = b.split(/^## Context/m)[1]?.split(/^## /m)[0];
  assert.ok(contextSection, 'sdd-design has a ## Context section');
  assert.match(contextSection, /playbook\.config\.yaml/, 'Context names playbook.config.yaml, the file the guard reads');
});

test("sdd-design's ## Rules names all three contract-authoring conditions, not just contract.path_in_loom (AC-1, alcanzabilidad)", () => {
  const b = body('sdd-design');
  const rules = b.split(/^## Rules/m)[1];
  assert.ok(rules, 'has a ## Rules section');
  assert.match(rules, /Never write a canonical contract when `contract\.path_in_loom` is absent/, 'condition 1 kept verbatim (back-compat)');
  assert.match(rules, /capabilities\.http`?\s*is\s*`?false/i, 'condition 2: no HTTP surface in the project');
  assert.match(rules, /per change, not per project/i, 'condition 3: per-change HTTP determination');
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

test("sdd-plan reads the contract to plan against it, but never authors one — that is sdd-design's step (AC-1)", () => {
  const b = body('sdd-plan');
  assert.doesNotMatch(b, /openapi/i, 'contract authoring belongs to the design stage, under human sign-off');
});

// --- contract-first-consumption Task 4.2 (AC-6, AC-8, EC-3): sdd-plan plans against the contract ---

test('sdd-plan plans tasks against the contract endpoints when contract.path_in_loom is declared and the change touches the API (AC-6)', () => {
  const b = body('sdd-plan');
  assert.match(b, /contract\.path_in_loom/, 'gated on the project declaring a contract path');
  assert.match(b, /endpoints? declared in the contract|contract.*endpoints/i, 'plans against the contract endpoints');
  assert.match(b, /touches? the API/i, 'scoped to a change that touches the API');
});

test('sdd-plan reads the contract by path from the hub and explicitly states it never copies it (AC-8)', () => {
  const b = body('sdd-plan');
  assert.match(b, /by path/i, 'reads the contract by path, not by copy');
  assert.match(b, /never cop(?:y|ies|ied)|not copied/i, 'explicitly says the contract is never copied — AC-8');
  assert.doesNotMatch(b, /copy (it |the contract )?(to|into)/i, 'never instructs actually copying the contract anywhere');
});

test('sdd-plan reports a missing contract file and continues without inventing endpoints (EC-3)', () => {
  const b = body('sdd-plan');
  assert.match(b, /does not exist/i, 'names the missing-file case');
  assert.match(b, /report/i, 'instructs reporting it');
  assert.match(b, /without inventing|never invent/i, 'never fabricates endpoints in place of the missing contract');
});

// --- sdd-security-gate finding F-1: contract-read steps must instruct containment, not just reading (SEC-001) ---

test('sdd-plan instructs containment before reading the contract, mirroring sdd-design\'s write-side guard (SEC-001)', () => {
  const b = body('sdd-plan');
  assert.match(b, /must stay\s+\*\*inside the repo\*\*/, 'the read target is contained to the project root');
  assert.match(b, /if\s+it\s+escapes\s+the\s+project\s+root,\s+stop\s+and\s+report\s+it\s+instead\s+of\s+reading/i,
    'stop-and-report guard, phrased for the read path (sdd-design has the write-side equivalent)');
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

test('sdd-verify verifies pwd before running feature and regression commands (AC-1)', () => {
  const b = body('sdd-verify');
  assert.match(b, /Verify `pwd` first/i, 'before the feature/domain commands');
  assert.match(b, /`pwd`[\s\S]{0,80}regression command/i, 'again before the regression commands');
  assert.match(b, /Before running any command from `tasks\.md`\/`context-packet\.md`, verify `pwd`/, 'the ## Rules guard');
});

test("sdd-verify's pwd rule covers context-packet.md commands, not just tasks.md (AC-2)", () => {
  const b = body('sdd-verify');
  // Post-token-saving-parity the verification commands come from the packet, so a
  // rule naming only tasks.md would miss the file actually being read.
  assert.match(b, /context-packet\.md[\s\S]{0,120}`cd`/i, 'names the packet where an older change folder may assume a cd');
  assert.match(b, /`tasks\.md`\/`context-packet\.md`/, 'the rule covers both sources');
});

test('sdd-commit caps the fix→validate→re-run loop at 3 iterations (AC-3)', () => {
  const b = body('sdd-commit');
  assert.match(b, /capped at \*\*3\s*\n?\s*iterations\*\*|capped at \*\*3 iterations\*\*|capped at 3 iterations/, 'the numeric cap');
  assert.match(b, /4th failed attempt/, 'the stop condition');
  assert.match(b, /exactly as `playbook validate` returns them/, 'reports validate output verbatim');
  // The Preconditions block is read before Behavior; a flat "validate passes, else
  // stop" there would make the loop below unreachable and the wiring inert.
  assert.match(b, /derived\s*\n?\s*artifact this stage may regenerate, which step 1 handles/,
    'the precondition defers to step 1 instead of contradicting it');
});

test('sdd-commit forbids blind edits inside the retry loop (AC-4)', () => {
  const b = body('sdd-commit');
  assert.match(b, /don't reason about the reports\s*\n?\s*yourself/i, 'no self-reasoning over the reports');
  assert.match(b, /without further blind edits/i);
});

test("sdd-commit's retry loop regenerates derived artifacts and never edits signed ones (AC-5)", () => {
  const b = body('sdd-commit');
  assert.match(b, /playbook packet <change-id>/, 'the permitted deterministic regeneration');
  assert.match(b, /Never edit\s*\n?\s*`proposal\.md`, `design\.md`, `tasks\.md`, an `adr-\*\.md` draft, or a gate report/, 'the signed-artifact prohibition');
  // An ADR draft is `status: proposed`, so the "human-signed" rationale alone would
  // read as permission to edit it. It is validated by `playbook validate`, so it can
  // realistically be the thing that fails at commit time — name it explicitly.
  assert.match(b, /`status:\s*\n?\s*proposed` draft is unreviewed, not unprotected/, 'ADR drafts are protected too');
  assert.match(b, /without consuming an iteration/i, 'a forbidden fix does not burn the budget');
  assert.match(b, /not named regenerable counts as signed/i, 'the default is the strict side');
});

test('sdd-commit never makes validate pass by weakening a gate status (SEC-001)', () => {
  const b = body('sdd-commit');
  // Negative half first: the skill must carry no instruction that writes or flips a
  // report status. A retry budget is never a reason to weaken a security verdict.
  assert.doesNotMatch(b, /(set|change|update|edit|flip)[^.\n]{0,60}(security-report|gate report|report'?s? status)/i,
    'no instruction to rewrite a gate report status');
  assert.doesNotMatch(b, /status:\s*passed/i, 'no example of writing a passed status');
  // Positive half: the prohibition is stated, and the pre-existing rule it leans on survives.
  assert.match(b, /weakening a gate report's `status`/i);
  assert.match(b, /retry budget never overrides a security rule/i);
  assert.match(b, /Do not commit around a blocking finding/, 'SEC-001 is orphaned without this rule');
});

test('sdd-apply and sdd-new keep the conventions this change replicates (AC-1, AC-3)', () => {
  // This change replicates FROM these two skills; if the source is deleted the
  // convention silently goes half-wired again — the exact drift being fixed here.
  assert.match(body('sdd-apply'), /pwd/, 'sdd-apply keeps its cwd check');
  assert.match(body('sdd-new'), /capped at 3 iterations/, 'sdd-new keeps its retry cap');
});

// --- contract-first-consumption Task 4.3 (AC-7, AC-8, SEC-003): sdd-apply reads the contract per repo role ---

test('sdd-apply reads the contract per repo role: provider must-fulfill vs consumer available-to-call (AC-7)', () => {
  const b = body('sdd-apply');
  assert.match(b, /contract\.path_in_loom/, 'gated on the project declaring a contract path');
  assert.match(b, /provider/i, 'names the provider role');
  assert.match(b, /consumer/i, 'names the consumer role');
  assert.match(b, /must fulfill/i, "provider's obligation: the spec to fulfill");
  assert.match(b, /available to call/i, "consumer's obligation: the spec of what's available to call");
  assert.match(b, /error codes.*handle/i, 'consumer obligation includes the error codes to handle');
});

test('sdd-apply reads the contract by path from the hub and explicitly states it never copies it (AC-8)', () => {
  const b = body('sdd-apply');
  assert.match(b, /by path/i, 'reads the contract by path, not by copy');
  assert.match(b, /never cop(?:y|ies|ied)|not copied/i, 'explicitly says the contract is never copied — AC-8');
});

test('sdd-apply instructs containment before reading the contract, mirroring sdd-design\'s write-side guard (SEC-001)', () => {
  const b = body('sdd-apply');
  assert.match(b, /must stay\s+\*\*inside the repo\*\*/, 'the read target is contained to the project root');
  assert.match(b, /if\s+it\s+escapes\s+the\s+project\s+root,\s+stop\s+and\s+report\s+it\s+instead\s+of\s+reading/i,
    'stop-and-report guard, phrased for the read path (sdd-design has the write-side equivalent)');
});

test('sdd-apply states SEC-003: declaring provided_by does not install contract-drift in CI by itself (SEC-003)', () => {
  const b = body('sdd-apply');
  assert.match(b, /provided_by/);
  assert.match(b, /contract-drift/);
  assert.match(b, /if it is installed/i, 'conformance is verified by the provider CI only if installed');
  assert.match(b, /does not install/i, 'declaring the role does not itself install the CI check');
});

test('sdd-plan requires the Regression entry unconditionally and Rules names why (AC-4)', () => {
  const b = body('sdd-plan');
  assert.doesNotMatch(b, /Regression\*\*:\s*`<command>`\s*\(if required by risk\)/, 'the qualifier must be gone');
  assert.match(b, /\*\*Regression\*\*:\s*`<command>`/, 'the template still declares the entry');
  assert.match(b, /Regression.*mandatory|mandatory.*Regression|is required[\s\S]{0,80}Regression|Regression[\s\S]{0,80}required/i, '## Rules states it is required');
  assert.match(b, /playbook packet/i, 'names the command that extracts it, so the requirement is grounded');
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
