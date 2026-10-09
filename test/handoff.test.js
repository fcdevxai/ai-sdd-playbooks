import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeHandoffManifest, validateHandoffManifest, governedManifestHash } from '../src/tokens/handoff.js';
import { run, EXIT } from '../src/cli/dispatch.js';

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-handoff-'));
  execFileSync('git', ['init', '-q', '-b', 'example'], { cwd });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd });
  const change = path.join(cwd, 'openspec/changes/example');
  fs.mkdirSync(change, { recursive: true });
  fs.mkdirSync(path.join(cwd, 'openspec/specs/contracts'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'skills/sdd-apply'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), `version: 2
methodology: {compatible: ">=0.1.0 <1.0.0"}
capabilities: {cli: true}
github: {base_branch: main, require_pull_request: true, require_ci: true}
documents: {system_spec: openspec/specs/system.md, architecture: docs/doc_architecture.md}
repos: {hub: {role: sdd, path: .}}
contract: {path_in_loom: openspec/specs/contracts/openapi.yaml}
`);
  fs.writeFileSync(path.join(cwd, 'openspec/specs/system.md'), '# System\n');
  fs.writeFileSync(path.join(cwd, 'openspec/specs/contracts/openapi.yaml'), 'openapi: 3.1.0\n');
  fs.writeFileSync(path.join(cwd, 'docs/doc_architecture.md'), '# Architecture\n');
  fs.writeFileSync(path.join(cwd, 'skills/sdd-apply/canonical.md'), '# Apply\n');
  fs.writeFileSync(path.join(change, 'proposal.md'), `---
schema: proposal
status: approved
impact: {architecture_boundary: true}
---
# Example
## Impacted repos
- hub
## Acceptance criteria
- **AC-1:** works
## Error cases
- **EC-1:** fails safely
## Security considerations
- **SEC-1:** no secrets
## Constraints and non-goals
Only fixture work.
`);
  fs.writeFileSync(path.join(change, 'design.md'), '---\nschema: design\nstatus: approved\n---\n# Design\n');
  fs.writeFileSync(path.join(change, 'tasks.md'), `---
schema: tasks
status: in_progress
handoff:
  specs: []
  architecture: []
  contracts: []
  required_skills:
    - {name: sdd-apply, repository: hub, path: skills/sdd-apply/canonical.md}
  required_tools:
    - {name: playbook, context: hub, purpose: lifecycle}
  runtime_coverage:
    - {criterion: AC-1, repositories: [hub], capabilities: [cli]}
  unresolved_risks: []
  blockers: []
---
# Tasks
- **Done**: [ ]
- **Success criterion**: works
`);
  execFileSync('git', ['add', '.'], { cwd });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd });
  return { cwd, change };
}

test('generated handoff is complete, deterministic and contract-byte bound', () => {
  const { cwd, change } = fixture();
  const first = writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' });
  assert.equal(first.manifest.repositories.length, 1);
  assert.equal(first.manifest.acceptance_criteria[0].id, 'AC-1');
  assert.equal(first.manifest.error_cases[0].id, 'EC-1');
  assert.equal(first.manifest.security_criteria[0].id, 'SEC-1');
  assert.equal(first.manifest.required_skills[0].name, 'sdd-apply');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, true);
  const before = fs.readFileSync(path.join(change, 'handoff-manifest.json'));
  writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' });
  assert.deepEqual(fs.readFileSync(path.join(change, 'handoff-manifest.json')), before);
  fs.appendFileSync(path.join(cwd, 'openspec/specs/contracts/openapi.yaml'), '# changed\n');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, false);
});

test('handoff refuses missing design, required reference and identity', () => {
  const { cwd, change } = fixture();
  fs.unlinkSync(path.join(change, 'design.md'));
  assert.throws(() => writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' }), /design.*missing/i);
  fs.writeFileSync(path.join(change, 'design.md'), '---\nschema: design\nstatus: approved\n---\n# Design\n');
  assert.throws(() => writeHandoffManifest('example', { cwd, stage: 'sdd-apply' }), /agent/i);
  fs.unlinkSync(path.join(cwd, 'skills/sdd-apply/canonical.md'));
  assert.throws(() => writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' }), /missing reference/i);
});

test('missing or incomplete manifest fails strict validation', () => {
  const { cwd, change } = fixture();
  assert.equal(validateHandoffManifest('example', { cwd }).ok, false);
  fs.writeFileSync(path.join(change, 'handoff-manifest.json'), '{}');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, false);
});

test('packet CLI creates the manifest only with explicit stage and agent', async () => {
  const { cwd, change } = fixture();
  const output = []; const errors = [];
  const io = { out: (line) => output.push(line), err: (line) => errors.push(line) };
  assert.equal(await run(['packet', 'example', '--cwd', cwd], io), EXIT.VIOLATION);
  assert.equal(fs.existsSync(path.join(change, 'handoff-manifest.json')), false);
  assert.equal(await run(['packet', 'example', '--stage', 'sdd-apply', '--agent', 'Codex', '--cwd', cwd], io), EXIT.OK);
  assert.equal(validateHandoffManifest('example', { cwd }).ok, true);
  assert.match(fs.readFileSync(path.join(change, 'context-packet.md'), 'utf8'), /## Handoff manifest/);
});

test('context-only repository source is bound without becoming an impacted delivery target', () => {
  const { cwd, change } = fixture();
  const tooling = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-tooling-'));
  const git = (...args) => execFileSync('git', args, { cwd: tooling, stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'tooling'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(tooling, 'engine.js'), 'export const state = 1;\n');
  git('add', '.'); git('commit', '-qm', 'source');
  const configFile = path.join(cwd, 'playbook.config.yaml');
  fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf8').replace(
    'repos: {hub: {role: sdd, path: .}}', `repos: {hub: {role: sdd, path: .}, tooling: {path: ${tooling}}}`));
  const tasksFile = path.join(change, 'tasks.md');
  fs.writeFileSync(tasksFile, fs.readFileSync(tasksFile, 'utf8').replace('handoff:\n', 'handoff:\n  context_repositories: [tooling]\n'));
  const before = writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' }).manifest;
  assert.equal(before.repositories.length, 1);
  assert.equal(before.context_repositories[0].name, 'tooling');
  fs.writeFileSync(path.join(tooling, 'engine.js'), 'export const state = 2;\n');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, false);
  const after = writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' }).manifest;
  assert.notEqual(governedManifestHash(before), governedManifestHash(after));
});

test('declared cross-repository alias and owning resources independently stale a source-bound handoff', () => {
  const { cwd, change } = fixture();
  const owner = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-owner-'));
  const git = (...args) => execFileSync('git', args, { cwd: owner, stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'owner'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  fs.mkdirSync(path.join(owner, '.ai/skills/pattern/rules'), { recursive: true });
  fs.writeFileSync(path.join(owner, '.ai/skills/pattern/SKILL.md'), '# Pattern\n');
  fs.writeFileSync(path.join(owner, '.ai/skills/pattern/rules/a.md'), 'rule a\n');
  git('add', '.'); git('commit', '-qm', 'owner');
  const configFile = path.join(cwd, 'playbook.config.yaml');
  fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf8').replace(
    'repos: {hub: {role: sdd, path: .}}', `repos: {hub: {role: sdd, path: .}, owner: {path: ${owner}}}`));
  const alias = path.join(cwd, '.claude/skills/pattern');
  fs.mkdirSync(path.dirname(alias), { recursive: true });
  fs.symlinkSync(path.relative(path.dirname(alias), path.join(owner, '.ai/skills/pattern')), alias);
  const tasksFile = path.join(change, 'tasks.md');
  fs.writeFileSync(tasksFile, fs.readFileSync(tasksFile, 'utf8').replace('handoff:\n', `handoff:
  context_repositories: [owner]
  source_paths:
    hub:
      - .claude/skills/pattern
    owner:
      - .ai/skills/pattern/SKILL.md
      - .ai/skills/pattern/rules/a.md
`));
  writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' });
  assert.equal(validateHandoffManifest('example', { cwd }).ok, true);
  fs.writeFileSync(path.join(owner, '.ai/skills/pattern/rules/a.md'), 'rule a changed\n');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, false);
  fs.writeFileSync(path.join(owner, '.ai/skills/pattern/rules/a.md'), 'rule a\n');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, true);
  fs.writeFileSync(path.join(owner, '.ai/skills/pattern/SKILL.md'), '# Pattern changed\n');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, false);
  fs.writeFileSync(path.join(owner, '.ai/skills/pattern/SKILL.md'), '# Pattern\n');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, true);
  fs.unlinkSync(alias);
  fs.symlinkSync(path.relative(path.dirname(alias), path.join(owner, '.ai/skills/pattern/rules')), alias);
  assert.equal(validateHandoffManifest('example', { cwd }).ok, false);
});

// ---------------------------------------------------------------------------
// Content-based freshness: committing a manifest must not make it stale.
// ---------------------------------------------------------------------------

function gitIn(cwd) {
  return (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}

function declareSourcePaths(change, paths) {
  const tasksFile = path.join(change, 'tasks.md');
  fs.writeFileSync(tasksFile, fs.readFileSync(tasksFile, 'utf8')
    .replace('handoff:\n', `handoff:\n  source_paths:\n    hub:\n${paths.map((item) => `      - ${item}`).join('\n')}\n`));
}

test('a manifest committed with identical governed content stays fresh by content, never by ignoring the SHA', () => {
  const { cwd, change } = fixture();
  const git = gitIn(cwd);
  fs.mkdirSync(path.join(cwd, 'src'));
  fs.writeFileSync(path.join(cwd, 'src/feature.js'), 'export const feature = 1;\n');
  fs.writeFileSync(path.join(cwd, 'docs/doc_architecture.md'), '# Architecture\nchanged during implementation\n');
  declareSourcePaths(change, ['src/feature.js']);
  git('add', 'openspec'); git('commit', '-qm', 'plan with declared path');
  writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' });
  const saved = fs.readFileSync(path.join(change, 'handoff-manifest.json'), 'utf8');
  const stage = fs.readdirSync(change).filter((name) => name.startsWith('handoff-manifest-sdd-apply-'));
  assert.equal(validateHandoffManifest('example', { cwd }).ok, true);

  git('add', '-A'); git('commit', '-qm', 'implementation and manifest');
  assert.equal(validateHandoffManifest('example', { cwd }).ok, false, 'the exact-HEAD check stays strict by default');
  const fresh = validateHandoffManifest('example', { cwd, allowCommittedDescendants: true });
  assert.deepEqual(fresh.issues, []);
  assert.equal(fresh.ok, true);
  assert.equal(fs.readFileSync(path.join(change, 'handoff-manifest.json'), 'utf8'), saved, 'the observed SHA record is preserved');
  assert.deepEqual(fs.readdirSync(change).filter((name) => name.startsWith('handoff-manifest-sdd-apply-')), stage);

  git('commit', '-q', '--allow-empty', '-m', 'unrelated empty commit');
  assert.equal(validateHandoffManifest('example', { cwd, allowCommittedDescendants: true }).ok, true);
});

test('content freshness rejects changed bytes, partial commits, non-ancestors, legacy manifests and tampered hashes', () => {
  const build = () => {
    const { cwd, change } = fixture();
    const git = gitIn(cwd);
    fs.mkdirSync(path.join(cwd, 'src'));
    fs.writeFileSync(path.join(cwd, 'src/feature.js'), 'export const feature = 1;\n');
    declareSourcePaths(change, ['src/feature.js']);
    git('add', 'openspec'); git('commit', '-qm', 'plan');
    fs.writeFileSync(path.join(cwd, 'docs/doc_architecture.md'), '# Architecture\nchanged during implementation\n');
    writeHandoffManifest('example', { cwd, stage: 'sdd-apply', agent: 'Codex' });
    return { cwd, change, git };
  };
  const check = (cwd) => validateHandoffManifest('example', { cwd, allowCommittedDescendants: true });

  const changed = build();
  changed.git('add', '-A'); changed.git('commit', '-qm', 'impl');
  fs.writeFileSync(path.join(changed.cwd, 'src/feature.js'), 'export const feature = 2;\n');
  assert.equal(check(changed.cwd).ok, false, 'working tree changed after the commit');

  const partial = build();
  partial.git('add', '-A'); partial.git('reset', '-q', 'src/feature.js'); partial.git('commit', '-qm', 'partial');
  assert.match(check(partial.cwd).issues.join(' '), /governed content recorded in the destination commit differs/, 'declared file missing from the committed tree');

  const rewritten = build();
  rewritten.git('checkout', '-q', '--orphan', 'rewritten'); rewritten.git('add', '-A'); rewritten.git('commit', '-qm', 'root');
  rewritten.git('branch', '-M', 'example');
  assert.match(check(rewritten.cwd).issues.join(' '), /missing Git ancestry/, 'history that does not descend from the recorded commit');

  const legacy = build();
  const file = path.join(legacy.change, 'handoff-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const repository of manifest.repositories) delete repository.tree_hash;
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  legacy.git('add', '-A'); legacy.git('commit', '-qm', 'legacy');
  assert.equal(check(legacy.cwd).ok, false, 'no tree digest recorded: strict only');
  assert.equal(validateHandoffManifest('example', { cwd: legacy.cwd }).ok, false);

  const tampered = build();
  const tamperedFile = path.join(tampered.change, 'handoff-manifest.json');
  const record = JSON.parse(fs.readFileSync(tamperedFile, 'utf8'));
  record.requirement.hash = 'a'.repeat(64);
  fs.writeFileSync(tamperedFile, JSON.stringify(record, null, 2) + '\n');
  tampered.git('add', '-A'); tampered.git('commit', '-qm', 'tampered');
  assert.equal(check(tampered.cwd).ok, false, 'a changed normative hash is never forgiven');
});
