import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ADR_STATUSES, ADR_REQUIRED_SECTIONS, ADR_CONSEQUENCE_SUBSECTIONS, ADR_IMPACT_SURFACES, validateADR,
} from '../src/adr/validate.js';
import {
  listAdrFiles, defaultAdrDir, defaultChangesDir, promoteAdrPlan, applyPromotePlan, renderAdrReadme,
} from '../src/adr/promote.js';
import { run, EXIT } from '../src/cli/dispatch.js';

function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-adr-')); }

function validAdrBody({ status = 'accepted', ticket = 'demo', date = '2026-07-22', supersedes } = {}) {
  return `---
schema: adr
status: ${status}
date: ${date}
ticket: ${ticket}
${supersedes ? `supersedes: ${supersedes}\n` : ''}---
# ADR: Use PATCH for partial updates

## Context
We need a consistent partial-update convention.

## Decision
Use PATCH for partial updates, PUT only for full replacement.

## Consequences

### Positive
Consistent API surface.

### Negative
Clients must learn the distinction.

### Risks
None significant.

## Alternatives considered

### PUT for everything
Rejected: loses partial-update semantics.

## Impact

- backend: implements the PATCH handler
- frontend: no impact
- security: no impact
- data: no impact
- deployment: no impact
- testing: new PATCH tests
`;
}

test('exported ADR contract constants are the expected shape', () => {
  assert.deepEqual(ADR_STATUSES, ['proposed', 'accepted', 'superseded', 'rejected']);
  assert.deepEqual(ADR_REQUIRED_SECTIONS, ['Context', 'Decision', 'Consequences', 'Alternatives considered', 'Impact']);
  assert.deepEqual(ADR_CONSEQUENCE_SUBSECTIONS, ['Positive', 'Negative', 'Risks']);
  assert.deepEqual(ADR_IMPACT_SURFACES, ['backend', 'frontend', 'security', 'data', 'deployment', 'testing']);
});

test('a valid ADR draft passes with no issues', () => {
  const dir = tmp();
  const file = path.join(dir, 'adr-patch-convention.md');
  fs.writeFileSync(file, validAdrBody());
  const result = validateADR(file);
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('missing frontmatter fields are reported individually', () => {
  const dir = tmp();
  const file = path.join(dir, 'adr-x.md');
  fs.writeFileSync(file, '---\nstatus: accepted\n---\n# ADR: X\n');
  const result = validateADR(file);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes('date')));
  assert.ok(result.issues.some((i) => i.includes('ticket')));
});

test('a status outside the enum is reported', () => {
  const dir = tmp();
  const file = path.join(dir, 'adr-x.md');
  fs.writeFileSync(file, validAdrBody().replace('status: accepted', 'status: maybe'));
  const result = validateADR(file);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => /invalid status/.test(i)));
});

test('each missing required section is reported', () => {
  const dir = tmp();
  const file = path.join(dir, 'adr-x.md');
  fs.writeFileSync(file, validAdrBody().replace(/## Alternatives considered[\s\S]*?(?=## Impact)/, ''));
  const result = validateADR(file);
  assert.ok(result.issues.some((i) => i.includes('Alternatives considered')));
});

test('an Impact section missing a surface is reported', () => {
  const dir = tmp();
  const file = path.join(dir, 'adr-x.md');
  fs.writeFileSync(file, validAdrBody().replace('- testing: new PATCH tests\n', ''));
  const result = validateADR(file);
  assert.ok(result.issues.some((i) => /testing/.test(i) && /Impact/.test(i)));
});

test('a missing file is reported, not thrown', () => {
  const result = validateADR('/nonexistent/adr-x.md');
  assert.equal(result.ok, false);
  assert.match(result.issues[0], /file not found/);
});

test('listAdrFiles only matches adr-*.md, sorted', () => {
  const changesDir = tmp();
  const changeDir = path.join(changesDir, 'demo');
  fs.mkdirSync(changeDir, { recursive: true });
  fs.writeFileSync(path.join(changeDir, 'adr-b.md'), '');
  fs.writeFileSync(path.join(changeDir, 'adr-a.md'), '');
  fs.writeFileSync(path.join(changeDir, 'proposal.md'), '');
  assert.deepEqual(listAdrFiles('demo', changesDir), ['adr-a.md', 'adr-b.md']);
});

function initGitRepo() {
  const cwd = tmp();
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
  return cwd;
}

test('promoteAdrPlan + applyPromotePlan: promotes an accepted draft, numbers it, updates README', () => {
  const cwd = initGitRepo();
  const changesDir = defaultChangesDir(cwd);
  const adrDir = defaultAdrDir(cwd);
  fs.mkdirSync(path.join(changesDir, 'demo'), { recursive: true });
  fs.mkdirSync(adrDir, { recursive: true });
  fs.writeFileSync(path.join(changesDir, 'demo', 'adr-patch-convention.md'), validAdrBody());
  execFileSync('git', ['add', '-A'], { cwd });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd });

  const plan = promoteAdrPlan('demo', { changesDir, adrDir });
  assert.equal(plan.promotions.length, 1);
  assert.equal(plan.promotions[0].id, 'ADR-001');
  assert.match(plan.readmeContent, /ADR-001/);

  applyPromotePlan(plan, { gitCwd: cwd });
  assert.ok(fs.existsSync(path.join(adrDir, 'ADR-001-patch-convention.md')));
  assert.equal(fs.existsSync(path.join(changesDir, 'demo', 'adr-patch-convention.md')), false);
  assert.match(fs.readFileSync(path.join(adrDir, 'README.md'), 'utf8'), /ADR-001/);
});

test('promoteAdrPlan rejects a draft still in status: proposed', () => {
  const cwd = tmp();
  const changesDir = defaultChangesDir(cwd);
  fs.mkdirSync(path.join(changesDir, 'demo'), { recursive: true });
  fs.writeFileSync(path.join(changesDir, 'demo', 'adr-x.md'), validAdrBody({ status: 'proposed' }));
  assert.throws(() => promoteAdrPlan('demo', { changesDir, adrDir: defaultAdrDir(cwd) }), /still has status: proposed/);
});

test('promoteAdrPlan with no drafts returns an empty plan', () => {
  const cwd = tmp();
  const changesDir = defaultChangesDir(cwd);
  fs.mkdirSync(path.join(changesDir, 'demo'), { recursive: true });
  const plan = promoteAdrPlan('demo', { changesDir, adrDir: defaultAdrDir(cwd) });
  assert.deepEqual(plan.promotions, []);
  assert.equal(plan.readmeContent, null);
});

test('promoteAdrPlan assigns sequential numbers and records supersession', () => {
  const cwd = initGitRepo();
  const changesDir = defaultChangesDir(cwd);
  const adrDir = defaultAdrDir(cwd);
  fs.mkdirSync(path.join(changesDir, 'first'), { recursive: true });
  fs.mkdirSync(adrDir, { recursive: true });
  fs.writeFileSync(path.join(changesDir, 'first', 'adr-one.md'), validAdrBody({ ticket: 'first' }));
  execFileSync('git', ['add', '-A'], { cwd });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd });
  applyPromotePlan(promoteAdrPlan('first', { changesDir, adrDir }), { gitCwd: cwd });
  execFileSync('git', ['add', '-A'], { cwd });
  execFileSync('git', ['commit', '-q', '-m', 'promote first'], { cwd });

  fs.mkdirSync(path.join(changesDir, 'second'), { recursive: true });
  fs.writeFileSync(
    path.join(changesDir, 'second', 'adr-two.md'),
    validAdrBody({ ticket: 'second', supersedes: 'ADR-001' }),
  );
  execFileSync('git', ['add', '-A'], { cwd });
  execFileSync('git', ['commit', '-q', '-m', 'seed second'], { cwd });

  const plan = promoteAdrPlan('second', { changesDir, adrDir });
  assert.equal(plan.promotions[0].id, 'ADR-002');
  assert.equal(plan.supersessionEdits.length, 1);
  applyPromotePlan(plan, { gitCwd: cwd });

  const supersededContent = fs.readFileSync(path.join(adrDir, 'ADR-001-one.md'), 'utf8');
  assert.match(supersededContent, /status:\s*superseded/);
  assert.match(supersededContent, /superseded_by:\s*ADR-002/);
  const readme = fs.readFileSync(path.join(adrDir, 'README.md'), 'utf8');
  assert.match(readme, /superseded by ADR-002/);
});

test('playbook adr promote <change-id> promotes via the CLI', async () => {
  const cwd = initGitRepo();
  fs.mkdirSync(path.join(cwd, 'openspec', 'changes', 'demo'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'openspec', 'specs', 'adr'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'openspec', 'changes', 'demo', 'adr-patch-convention.md'), validAdrBody());
  execFileSync('git', ['add', '-A'], { cwd });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd });

  const { io, out } = capture();
  const code = await run(['adr', 'promote', 'demo', '--cwd', cwd], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Promoted 1 ADR/);
  assert.ok(fs.existsSync(path.join(cwd, 'openspec', 'specs', 'adr', 'ADR-001-patch-convention.md')));
});

test('playbook adr promote --dry-run touches nothing', async () => {
  const cwd = tmp();
  fs.mkdirSync(path.join(cwd, 'openspec', 'changes', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'openspec', 'changes', 'demo', 'adr-patch-convention.md'), validAdrBody());
  const { io, out } = capture();
  const code = await run(['adr', 'promote', 'demo', '--dry-run', '--cwd', cwd], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Would promote 1/);
  assert.ok(fs.existsSync(path.join(cwd, 'openspec', 'changes', 'demo', 'adr-patch-convention.md')));
  assert.equal(fs.existsSync(path.join(cwd, 'openspec', 'specs', 'adr')), false);
});

test('playbook adr promote without a change-id is a usage error', async () => {
  const { io, err } = capture();
  const code = await run(['adr', 'promote', '--cwd', tmp()], io);
  assert.equal(code, EXIT.USAGE);
  assert.match(err.join('\n'), /requires a <change-id>/);
});

test('renderAdrReadme preserves prose before the table header', () => {
  const existing = '# ADR Index\n\nSome custom prose.\n\n| # | Title | Status | Date | Originating change |\n|---|---|---|---|---|\n';
  const out = renderAdrReadme(existing, [{ id: 'ADR-001', number: 1, title: 'X', status: 'accepted', date: '2026-07-22', ticket: 'demo' }]);
  assert.match(out, /Some custom prose\./);
  assert.match(out, /ADR-001/);
});
