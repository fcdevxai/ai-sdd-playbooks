import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPacket, writePacket, validatePacket, packetSourceHashes } from '../src/tokens/packet.js';
import { validateNamed } from '../src/schema/validate.js';
import { buildSpecIndex, writeSpecIndex, readSpecSection, discoverSpecFiles } from '../src/tokens/spec-index.js';
import { resolveRunMetadata, persistRun, formatRunSummary, countPriorRuns, filesInChange, runsDir } from '../src/tokens/run.js';
import { parseClaudeTranscript, findTranscripts, formatTable, projectSlug } from '../src/tokens/usage-report.js';
import { run, EXIT } from '../src/cli/dispatch.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-tokens-')); }
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

const PROPOSAL = `---
schema: proposal
status: approved
---
# Demo

## Acceptance criteria
AC-1: something testable.

## Constraints and non-goals
Only touch demo.md.

## Security considerations
Not applicable: no sensitive surface.
`;

const TASKS = `---
schema: tasks
status: passed
---
# Tasks — Demo

## Phase 1 — Core implementation
### Task 1.1 — write demo.md
- **Files**: \`demo.md\`, \`test/demo.test.js\`
- **Success criterion**: test passes

## Phase 2 — Quality gates
- **Format**: \`npm run format\`
- **Lint/type-check**: \`npm run lint\`
- **Feature tests**: \`npm test\`
- **Regression**: \`npm run regress\`
`;

function makeChange() {
  const cwd = tmp();
  const dir = path.join(cwd, 'openspec', 'changes', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'proposal.md'), PROPOSAL);
  fs.writeFileSync(path.join(dir, 'tasks.md'), TASKS);
  return { cwd, changesDir: path.join(cwd, 'openspec', 'changes') };
}

test('buildPacket extracts verbatim sections, files, and commands', () => {
  const { changesDir } = makeChange();
  const { content, warnings } = buildPacket('demo', changesDir);
  assert.deepEqual(warnings, []);
  assert.match(content, /AC-1: something testable\./);
  assert.match(content, /Only touch demo\.md\./);
  assert.match(content, /Not applicable: no sensitive surface\./);
  assert.match(content, /`demo\.md`/);
  assert.match(content, /`test\/demo\.test\.js`/);
  assert.match(content, /`npm test`/);
  assert.match(content, /sources:/);
});

test('buildPacket throws when proposal is missing a required section', () => {
  const { changesDir } = makeChange();
  fs.writeFileSync(
    path.join(changesDir, 'demo', 'proposal.md'),
    PROPOSAL.replace('## Security considerations\nNot applicable: no sensitive surface.\n', ''),
  );
  assert.throws(() => buildPacket('demo', changesDir), /missing required section/);
});

test('buildPacket warns (does not throw) when tasks.md has no Files/commands', () => {
  const { changesDir } = makeChange();
  fs.writeFileSync(path.join(changesDir, 'demo', 'tasks.md'), '# Tasks — Demo\n\nNo structured content.\n');
  const { warnings } = buildPacket('demo', changesDir);
  assert.equal(warnings.length, 2);
});

test('buildPacket warns when tasks.md declares Format/Feature tests but no Regression entry (AC-3)', () => {
  const { changesDir } = makeChange();
  const tasksNoRegression = `---
schema: tasks
status: passed
---
# Tasks — Demo

## Phase 1 — Core implementation
### Task 1.1 — write demo.md
- **Files**: \`demo.md\`
- **Success criterion**: test passes

## Phase 2 — Quality gates
- **Format**: \`npm run format\`
- **Feature tests**: \`npm test\`
`;
  fs.writeFileSync(path.join(changesDir, 'demo', 'tasks.md'), tasksNoRegression);
  const { content, warnings } = buildPacket('demo', changesDir);
  assert.ok(warnings.some((w) => /Regression/.test(w)));
  // advisory only: the packet content itself is unaffected — same commands as before
  assert.match(content, /`npm run format`/);
  assert.match(content, /`npm test`/);
});

test('buildPacket does not duplicate the empty-commands warning with a Regression warning when tasks.md has no commands at all (EC-6)', () => {
  const { changesDir } = makeChange();
  fs.writeFileSync(path.join(changesDir, 'demo', 'tasks.md'), '# Tasks — Demo\n\nNo structured content.\n');
  const { warnings } = buildPacket('demo', changesDir);
  assert.equal(warnings.filter((w) => /Regression/.test(w)).length, 0);
  assert.equal(warnings.length, 2); // Files + Verification commands empty — unchanged
});

test('buildPacket does not warn about Regression when tasks.md declares it', () => {
  const { changesDir } = makeChange(); // TASKS fixture declares Regression
  const { warnings } = buildPacket('demo', changesDir);
  assert.deepEqual(warnings, []);
});

test('writePacket persists to context-packet.md and is deterministic', () => {
  const { changesDir } = makeChange();
  const { path: p1 } = writePacket('demo', changesDir);
  const first = fs.readFileSync(p1, 'utf8');
  const { path: p2 } = writePacket('demo', changesDir);
  assert.equal(p1, p2);
  assert.equal(fs.readFileSync(p2, 'utf8'), first);
});

test('validatePacket: absent packet is valid; present packet must have all sections', () => {
  const { changesDir } = makeChange();
  assert.deepEqual(validatePacket('demo', changesDir), { ok: true, issues: [] });
  writePacket('demo', changesDir);
  const result = validatePacket('demo', changesDir);
  assert.equal(result.ok, true);
});

test('validatePacket detects staleness by source hash', () => {
  const { changesDir } = makeChange();
  writePacket('demo', changesDir);
  fs.appendFileSync(path.join(changesDir, 'demo', 'proposal.md'), '\n## Open technical decisions\nNone.\n');
  const result = validatePacket('demo', changesDir);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => /stale/.test(i)));
});

test('packetSourceHashes is stable for identical bytes', () => {
  const { changesDir } = makeChange();
  const a = packetSourceHashes('demo', changesDir);
  const b = packetSourceHashes('demo', changesDir);
  assert.deepEqual(a, b);
  assert.equal(a.proposal.length, 64);
});

test('playbook packet <change-id> writes the file via the CLI', async () => {
  const { cwd } = makeChange();
  const { io, out } = capture();
  const code = await run(['packet', 'demo', '--cwd', cwd], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Wrote/);
  assert.ok(fs.existsSync(path.join(cwd, 'openspec', 'changes', 'demo', 'context-packet.md')));
});

test('playbook packet without a change-id is a usage error', async () => {
  const { io, err } = capture();
  const code = await run(['packet', '--cwd', tmp()], io);
  assert.equal(code, EXIT.USAGE);
  assert.match(err.join('\n'), /requires a <change-id>/);
});

// --- Task 3.1 (AC-9, contract-first-consumption): sources.contract is optional in the context-packet schema ---

test('AC-9: context-packet schema still requires only proposal + tasks in sources (back-compat)', () => {
  assert.equal(validateNamed('context-packet', { sources: { proposal: 'a', tasks: 'b' } }).valid, true);
  assert.equal(validateNamed('context-packet', { sources: {} }).valid, false);
});

test('AC-9: context-packet schema accepts an optional sources.contract string', () => {
  assert.equal(validateNamed('context-packet', { sources: { proposal: 'a', tasks: 'b', contract: 'c' } }).valid, true);
  assert.equal(validateNamed('context-packet', { sources: { proposal: 'a', tasks: 'b', contract: 123 } }).valid, false);
});

// --- Task 3.2 (AC-9, contract-first-consumption): the packet carries a Contract section ---

const CONTRACT_PORTION = {
  path_in_loom: 'openspec/specs/contracts/openapi.yaml',
  provided_by: 'backend',
  consumed_by: ['frontend', 'mobile'],
};

test('buildPacket includes a Contract section with path + roles when a contract portion is passed (AC-9)', () => {
  const { changesDir } = makeChange();
  const { content } = buildPacket('demo', changesDir, CONTRACT_PORTION);
  assert.match(content, /## Contract/);
  assert.match(content, /openspec\/specs\/contracts\/openapi\.yaml/);
  assert.match(content, /backend/);
  assert.match(content, /frontend/);
  assert.match(content, /mobile/);
});

test('buildPacket omits the Contract section when no contract portion is passed — byte-identical whether the arg is omitted or null (AC-9)', () => {
  const { changesDir } = makeChange();
  const withoutArg = buildPacket('demo', changesDir);
  const withNull = buildPacket('demo', changesDir, null);
  assert.doesNotMatch(withoutArg.content, /## Contract/);
  assert.equal(withoutArg.content, withNull.content);
});

test('the Contract section is not in PACKET_REQUIRED_SECTIONS — a packet without it still validates (AC-9)', () => {
  const { changesDir } = makeChange();
  writePacket('demo', changesDir); // no contract param -> no section
  const result = validatePacket('demo', changesDir);
  assert.equal(result.ok, true);
});

test('playbook packet reads contract.path_in_loom/provided_by/consumed_by from playbook.config.yaml and threads it into the packet (AC-9)', async () => {
  const { cwd } = makeChange();
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'),
    'version: 2\nmethodology:\n  compatible: ">=0.1.0 <1.0.0"\ncapabilities:\n  http: true\n' +
    'github:\n  base_branch: main\n  require_pull_request: true\n  require_ci: true\n' +
    'contract:\n  path_in_loom: openspec/specs/contracts/openapi.yaml\n  provided_by: backend\n  consumed_by: [frontend]\n');

  const { io } = capture();
  const code = await run(['packet', 'demo', '--cwd', cwd], io);
  assert.equal(code, EXIT.OK);
  const content = fs.readFileSync(path.join(cwd, 'openspec', 'changes', 'demo', 'context-packet.md'), 'utf8');
  assert.match(content, /## Contract/);
  assert.match(content, /openspec\/specs\/contracts\/openapi\.yaml/);
  assert.match(content, /backend/);
  assert.match(content, /frontend/);
});

test('playbook packet without a contract: block in config produces a packet with no Contract section (AC-9 back-compat)', async () => {
  const { cwd } = makeChange();
  const { io } = capture();
  const code = await run(['packet', 'demo', '--cwd', cwd], io);
  assert.equal(code, EXIT.OK);
  const content = fs.readFileSync(path.join(cwd, 'openspec', 'changes', 'demo', 'context-packet.md'), 'utf8');
  assert.doesNotMatch(content, /## Contract/);
});

// --- Task 3.3 (AC-9, contract-first-consumption): staleness by contract topology change ---

test('packetSourceHashes includes a contract hash when a contract portion is passed, omits it otherwise (AC-9)', () => {
  const { changesDir } = makeChange();
  const withContract = packetSourceHashes('demo', changesDir, CONTRACT_PORTION);
  assert.equal(typeof withContract.contract, 'string');
  assert.equal(withContract.contract.length, 64);
  const withoutContract = packetSourceHashes('demo', changesDir);
  assert.equal('contract' in withoutContract, false);
});

test('validatePacket reports the packet obsolete when provided_by/consumed_by/path_in_loom changes (AC-9)', () => {
  const { changesDir } = makeChange();
  writePacket('demo', changesDir, CONTRACT_PORTION);
  assert.equal(validatePacket('demo', changesDir, CONTRACT_PORTION).ok, true);

  assert.equal(validatePacket('demo', changesDir, { ...CONTRACT_PORTION, provided_by: 'other-backend' }).ok, false);
  assert.equal(validatePacket('demo', changesDir, { ...CONTRACT_PORTION, consumed_by: ['frontend'] }).ok, false);
  assert.equal(validatePacket('demo', changesDir, { ...CONTRACT_PORTION, path_in_loom: 'openspec/specs/contracts/other.yaml' }).ok, false);
});

test('validatePacket is unaffected by an unrelated config change when the contract portion itself is unchanged (AC-9)', () => {
  const { changesDir } = makeChange();
  writePacket('demo', changesDir, CONTRACT_PORTION);
  // Simulates e.g. github.base_branch changing elsewhere in playbook.config.yaml —
  // the contract portion passed in is unaffected, so no staleness from this path.
  assert.equal(validatePacket('demo', changesDir, CONTRACT_PORTION).ok, true);
});

test('a packet without sources.contract is never reported stale via the contract path, even if the project now declares one (AC-9)', () => {
  const { changesDir } = makeChange();
  writePacket('demo', changesDir); // no contract at build time
  const result = validatePacket('demo', changesDir, CONTRACT_PORTION); // config now has one
  assert.equal(result.ok, true);
});

function makeSpecs() {
  const cwd = tmp();
  const specsDir = path.join(cwd, 'openspec', 'specs');
  fs.mkdirSync(specsDir, { recursive: true });
  fs.writeFileSync(path.join(specsDir, 'system.md'), `---
status: implemented
---
# System

## Product principles

Least data. Clear ownership. Security by design.
`);
  return cwd;
}

test('discoverSpecFiles finds system.md first, then domain spec.md files sorted', () => {
  const cwd = makeSpecs();
  fs.mkdirSync(path.join(cwd, 'openspec', 'specs', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'openspec', 'specs', 'auth', 'spec.md'), '# Auth\n');
  const files = discoverSpecFiles(cwd);
  assert.deepEqual(files, ['openspec/specs/system.md', 'openspec/specs/auth/spec.md']);
});

test('buildSpecIndex stores structure only (headings), never section bodies', () => {
  const cwd = makeSpecs();
  const index = buildSpecIndex(cwd);
  assert.equal(index.files.length, 1);
  assert.equal(index.files[0].title, 'System');
  assert.equal(index.files[0].frontmatter.status, 'implemented');
  assert.ok(index.files[0].headings.some((h) => h.title === 'Product principles'));
  assert.equal(JSON.stringify(index).includes('Least data'), false);
});

test('readSpecSection returns the live section body', () => {
  const cwd = makeSpecs();
  const body = readSpecSection('openspec/specs/system.md#product-principles', { cwd });
  assert.match(body, /Least data\. Clear ownership\. Security by design\./);
});

test('readSpecSection rejects paths outside openspec/specs', () => {
  const cwd = makeSpecs();
  assert.throws(() => readSpecSection('../../etc/passwd#x', { cwd }), /Invalid spec path|outside openspec\/specs/);
});

test('playbook spec-index writes the cache and playbook spec-read reads a section', async () => {
  const cwd = makeSpecs();
  const idx = capture();
  const code1 = await run(['spec-index', '--cwd', cwd], idx.io);
  assert.equal(code1, EXIT.OK);
  assert.ok(fs.existsSync(path.join(cwd, '.specloom', 'index', 'spec-index.json')));

  const rd = capture();
  const code2 = await run(['spec-read', 'openspec/specs/system.md#product-principles', '--cwd', cwd], rd.io);
  assert.equal(code2, EXIT.OK);
  assert.match(rd.out.join('\n'), /Least data/);
});

test('resolveRunMetadata falls back to git branch, then "manual"/"unknown"', () => {
  const cwd = tmp();
  const meta = resolveRunMetadata({ cwd });
  assert.equal(meta.changeId, 'unknown'); // no git repo here
  assert.equal(meta.step, 'manual');
  assert.equal(meta.harness, 'unknown');

  const explicit = resolveRunMetadata({ change: 'demo', step: 'apply', harness: 'claude', cwd });
  assert.deepEqual(explicit, { changeId: 'demo', step: 'apply', harness: 'claude' });
});

test('countPriorRuns counts matching {changeId, step, command} triples on disk', () => {
  const cwd = tmp();
  const dir = runsDir(cwd);
  assert.equal(countPriorRuns(dir, { changeId: 'demo', step: 'apply', command: 'npm test' }), 0);
  persistRun({ command: 'npm test', changeId: 'demo', step: 'apply', harness: 'claude', exitCode: 0, output: 'ok\n', cwd });
  assert.equal(countPriorRuns(dir, { changeId: 'demo', step: 'apply', command: 'npm test' }), 1);
  persistRun({ command: 'npm test', changeId: 'demo', step: 'apply', harness: 'claude', exitCode: 0, output: 'ok\n', cwd });
  assert.equal(countPriorRuns(dir, { changeId: 'demo', step: 'apply', command: 'npm test' }), 2);
});

test('persistRun writes full.log + usage.json; formatRunSummary compacts on failure', () => {
  const cwd = tmp();
  const bigOutput = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n') + '\n';
  const { logPath, rawOutputLines } = persistRun({
    command: 'npm test', changeId: 'demo', step: 'apply', harness: 'claude', exitCode: 1, output: bigOutput, cwd,
  });
  assert.equal(rawOutputLines, 100);
  assert.equal(fs.readFileSync(logPath, 'utf8'), bigOutput);
  const usage = JSON.parse(fs.readFileSync(path.join(path.dirname(logPath), 'usage.json'), 'utf8'));
  assert.equal(usage.command, 'npm test');
  assert.equal(usage.exitCode, 1);

  const summary = formatRunSummary({ exitCode: 1, output: bigOutput, logPath, rawOutputLines });
  assert.match(summary, /✗ exit 1/);
  assert.equal(summary.split('\n').length - 1, 41); // 40 tail lines + the "✗ exit" line
});

test('filesInChange lists top-level files, [] for an unsafe/missing slug', () => {
  const { cwd } = makeChange();
  const changesDir = path.join(cwd, 'openspec', 'changes');
  const files = filesInChange('demo', changesDir);
  assert.ok(files.includes('proposal.md'));
  assert.ok(files.includes('tasks.md'));
  assert.deepEqual(filesInChange('../escape', changesDir), []);
  assert.deepEqual(filesInChange('nonexistent', changesDir), []);
});

test('playbook run executes a command, exits 0, and writes telemetry', async () => {
  const cwd = tmp();
  const { io, out } = capture();
  const code = await run(['run', '--change', 'demo', '--step', 'apply', '--cwd', cwd, '--', 'node', '-e', 'console.log("hi")'], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /✓ passed/);
  assert.ok(fs.existsSync(runsDir(cwd)));
});

test('playbook run reports a non-zero exit and exits VIOLATION', async () => {
  const cwd = tmp();
  const { io, err } = capture();
  const code = await run(['run', '--cwd', cwd, '--', 'node', '-e', 'process.exit(3)'], io);
  assert.equal(code, EXIT.VIOLATION);
  assert.match(err.join('\n'), /✗ exit 3/);
});

test('playbook run without a command is a usage error', async () => {
  const { io, err } = capture();
  const code = await run(['run', '--cwd', tmp()], io);
  assert.equal(code, EXIT.USAGE);
  assert.match(err.join('\n'), /usage: playbook run/);
});

test('parseClaudeTranscript sums usage tokens and detects invoked skills', () => {
  const dir = tmp();
  const file = path.join(dir, 'session-abc.jsonl');
  const lines = [
    JSON.stringify({ sessionId: 'session-abc', type: 'assistant', message: { usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 } } }),
    JSON.stringify({ type: 'user', message: { content: 'Launching skill: sdd-apply' } }),
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 3, output_tokens: 1 } } }),
  ];
  fs.writeFileSync(file, lines.join('\n') + '\n');
  const summary = parseClaudeTranscript(file);
  assert.equal(summary.inputTokens, 13);
  assert.equal(summary.outputTokens, 6);
  assert.equal(summary.cacheReadTokens, 2);
  assert.deepEqual(summary.commands, ['sdd-apply']);
});

test('findTranscripts prefers the current project dir, falls back to all projects', () => {
  const projectsDir = tmp();
  const cwd = '/some/project';
  const slug = projectSlug(cwd);
  fs.mkdirSync(path.join(projectsDir, slug), { recursive: true });
  fs.writeFileSync(path.join(projectsDir, slug, 's1.jsonl'), '');
  const files = findTranscripts(projectsDir, cwd);
  assert.equal(files.length, 1);
  assert.match(files[0], /s1\.jsonl$/);
});

test('formatTable renders a padded, parseable table', () => {
  const table = formatTable([{ sessionId: 'abcdefgh12', commands: ['sdd-apply'], inputTokens: 100, outputTokens: 50, cacheReadTokens: 0 }]);
  assert.match(table, /SESSION\s+COMMAND\(S\)\s+INPUT\s+OUTPUT\s+CACHE-READ/);
  assert.match(table, /abcdefgh\s+sdd-apply\s+100\s+50\s+0/);
});
