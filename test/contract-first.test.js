/**
 * Contract-first operativo (change restore-contract-first).
 * Covers AC-1..AC-4, EC-1..EC-2, SEC-1 from
 * openspec/changes/restore-contract-first/proposal.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { run } from '../src/cli/dispatch.js';
import { validateNamed } from '../src/schema/validate.js';
import { buildPacket } from '../src/tokens/packet.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'contract-first-')); }
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

const CANONICAL_REL = 'openspec/specs/contracts/openapi.yaml';

function makeConfig(cwd, { withContract = true } = {}) {
  const contractBlock = withContract
    ? `contract:\n  source_of_truth: loom-first\n  path_in_loom: ${CANONICAL_REL}\n`
    : '';
  fs.writeFileSync(
    path.join(cwd, 'playbook.config.yaml'),
    `version: 2\nmethodology:\n  compatible: ">=0.1.0 <1.0.0"\n` +
      `capabilities:\n  http: false\ngithub:\n  base_branch: main\n  require_pull_request: true\n  require_ci: true\n${contractBlock}`,
  );
}

function writeCanonical(cwd, paths = {}) {
  const abs = path.join(cwd, CANONICAL_REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, yaml.dump({ openapi: '3.0.3', info: { title: 'playbook-ai contract', version: '1.0.0' }, paths }));
}

// --- AC-1: canonical with paths:{} → contract-drift runs, 0 diffs, exit 0 ---

test('AC-1: contract-drift on an empty canonical contract reports no drift', async () => {
  const cwd = tmp();
  makeConfig(cwd);
  writeCanonical(cwd, {});
  const generatedPath = path.join(cwd, 'generated.yaml');
  fs.writeFileSync(generatedPath, yaml.dump({ openapi: '3.0.3', info: { title: 'x', version: '1' }, paths: {} }));

  const { io, out, err } = capture();
  const code = await run(['contract-drift', generatedPath, '--cwd', cwd], io);
  assert.equal(code, 0);
  assert.doesNotMatch(err.join('\n'), /no contract\.path_in_loom configured/);
  assert.match(out.join('\n'), /No contract drift detected/);
});

// --- AC-2: an extra endpoint in generated → UNDOCUMENTED, exit != 0 ---

test('AC-2: an endpoint present in generated but not canonical is reported UNDOCUMENTED', async () => {
  const cwd = tmp();
  makeConfig(cwd);
  writeCanonical(cwd, {});
  const generatedPath = path.join(cwd, 'generated.yaml');
  fs.writeFileSync(generatedPath, yaml.dump({
    openapi: '3.0.3',
    info: { title: 'x', version: '1' },
    paths: { '/widgets': { get: {} } },
  }));

  const { io, err } = capture();
  const code = await run(['contract-drift', generatedPath, '--cwd', cwd], io);
  assert.notEqual(code, 0);
  assert.match(err.join('\n'), /UNDOCUMENTED: GET \/widgets/);
});

// --- AC-3: `playbook validate --ci` accepts a config with `contract:` ---

test('AC-3: validate --ci accepts a playbook.config.yaml that declares contract:', async () => {
  const cwd = tmp();
  makeConfig(cwd);
  writeCanonical(cwd, {});
  fs.mkdirSync(path.join(cwd, 'openspec', 'changes'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'playbook.lock'), 'version: 2\nmethodology:\n  compatible: ">=0.1.0 <1.0.0"\ninstalled_at: "2026-07-23"\n');

  const { io, out } = capture();
  const code = await run(['validate', '--ci', '--cwd', cwd], io);
  assert.equal(code, 0, out.join('\n'));
});

// --- AC-4 / Task 1.3-1.4: the CI template exists, documents backend install, and is valid YAML ---

test('AC-4: the contract-drift-check.yml template exists, is valid YAML, and documents backend install', () => {
  const tplPath = path.join(process.cwd(), 'templates', 'project', 'github', 'workflows', 'contract-drift-check.yml');
  assert.ok(fs.existsSync(tplPath), 'template should exist');
  const raw = fs.readFileSync(tplPath, 'utf8');
  assert.doesNotThrow(() => yaml.load(raw));
  assert.match(raw, /backend/i);
  assert.match(raw, /playbook-ai contract-drift/);
});

// --- EC-1: missing contract.path_in_loom → clear, actionable error (not a stack trace) ---

test('EC-1: a config without contract.path_in_loom fails with a clear message, not a stack trace', async () => {
  const cwd = tmp();
  makeConfig(cwd, { withContract: false });
  const generatedPath = path.join(cwd, 'generated.yaml');
  fs.writeFileSync(generatedPath, yaml.dump({ openapi: '3.0.3', info: { title: 'x', version: '1' }, paths: {} }));

  const { io, err } = capture();
  const code = await run(['contract-drift', generatedPath, '--cwd', cwd], io);
  assert.notEqual(code, 0);
  assert.match(err.join('\n'), /no contract\.path_in_loom configured/);
  assert.doesNotMatch(err.join('\n'), /at Object\.|node:internal/); // no raw stack trace leaking to the user
});

// --- EC-2: canonical file missing → clear "not found" error ---

test('EC-2: a missing canonical contract file fails with a clear "not found" message', async () => {
  const cwd = tmp();
  makeConfig(cwd);
  // canonical NOT written on purpose
  const generatedPath = path.join(cwd, 'generated.yaml');
  fs.writeFileSync(generatedPath, yaml.dump({ openapi: '3.0.3', info: { title: 'x', version: '1' }, paths: {} }));

  const { io, err } = capture();
  const code = await run(['contract-drift', generatedPath, '--cwd', cwd], io);
  assert.notEqual(code, 0);
  assert.match(err.join('\n'), /File not found/);
});

// --- SEC-1: the shipped CI template carries no secrets/credentials ---

test('SEC-1: the contract-drift-check.yml template contains no secrets or credential material', () => {
  const tplPath = path.join(process.cwd(), 'templates', 'project', 'github', 'workflows', 'contract-drift-check.yml');
  const raw = fs.readFileSync(tplPath, 'utf8');
  assert.doesNotMatch(raw, /\$\{\{\s*secrets\./i, 'must not reference GitHub Actions secrets');
  assert.doesNotMatch(raw, /password\s*[:=]/i);
  assert.doesNotMatch(raw, /-----BEGIN [A-Z ]*PRIVATE KEY-----/);
});

/**
 * Contract-first consumption (change contract-first-consumption).
 * Covers AC-4, AC-5, AC-10, AC-11, EC-2 from
 * openspec/changes/contract-first-consumption/proposal.md.
 */

const GOOD_CONFIG = {
  version: 2,
  methodology: { compatible: '>=0.1.0 <1.0.0' },
  capabilities: { http: true },
  github: { base_branch: 'main', require_pull_request: true, require_ci: true },
};

// --- Task 1.1 (AC-5): schema accepts contract.provided_by/consumed_by, both optional ---

test('AC-5: schema accepts contract.provided_by (string) and contract.consumed_by (array of strings)', () => {
  const withRoles = {
    ...GOOD_CONFIG,
    contract: { path_in_loom: 'openspec/specs/contracts/openapi.yaml', provided_by: 'backend', consumed_by: ['frontend', 'mobile'] },
  };
  assert.equal(validateNamed('playbook.config', withRoles).valid, true);
});

test('AC-5: a config that omits contract.provided_by/consumed_by stays valid (back-compat)', () => {
  const withoutRoles = { ...GOOD_CONFIG, contract: { path_in_loom: 'openspec/specs/contracts/openapi.yaml' } };
  assert.equal(validateNamed('playbook.config', withoutRoles).valid, true);
  assert.equal(validateNamed('playbook.config', GOOD_CONFIG).valid, true); // no `contract:` block at all
});

test('AC-5: contract.provided_by must be a string, contract.consumed_by must be an array', () => {
  assert.equal(validateNamed('playbook.config', { ...GOOD_CONFIG, contract: { provided_by: 123 } }).valid, false);
  assert.equal(validateNamed('playbook.config', { ...GOOD_CONFIG, contract: { consumed_by: 'backend' } }).valid, false);
  assert.equal(validateNamed('playbook.config', { ...GOOD_CONFIG, contract: { consumed_by: [1, 2] } }).valid, false);
});

// --- Task 1.2 (AC-10): the template's commented multi-repo block, uncommented as documented, validates ---

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'project', 'playbook.config.yaml');

/**
 * Uncomments a contiguous `# key:` ... comment block starting at `startMarker`:
 * takes every consecutive line starting with `#` from there, stopping at the
 * first line that doesn't (blank line or real content), then strips the `#`/`# `
 * prefix from each.
 */
function uncommentBlock(raw, startMarker) {
  const idx = raw.indexOf(startMarker);
  assert.ok(idx !== -1, `template should contain "${startMarker}"`);
  const lines = raw.slice(idx).split('\n');
  const block = [];
  for (const line of lines) {
    if (!line.startsWith('#')) break;
    block.push(line);
  }
  return block.join('\n').replace(/^#\s?/gm, '');
}

test('AC-10: the template no longer documents `role: impacted` — the schema only allows `role: sdd`', () => {
  const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  assert.doesNotMatch(raw, /role:\s*impacted/, '`role: impacted` must be removed from the template');
});

test('AC-10: the template explains that "impacted" is read from the proposal, not from repos: config', () => {
  const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  assert.match(raw, /## Impacted repos/, 'the template must point at the proposal section, not a config role');
});

test('AC-10: the multi-repo block, uncommented exactly as documented, passes playbook validate schema', () => {
  const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const uncommented = uncommentBlock(raw, '# repos:');
  const parsed = yaml.load(uncommented);
  assert.ok(parsed.repos, 'parsed block should declare repos:');
  assert.ok(parsed.gating, 'parsed block should declare gating:');

  const merged = { ...GOOD_CONFIG, repos: parsed.repos, gating: parsed.gating };
  const result = validateNamed('playbook.config', merged);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

// --- Task 1.3 (AC-11): the template documents provided_by/consumed_by, coherent with its repos: example ---

test('AC-11: the template documents contract.provided_by/consumed_by with names coherent with its repos: example', () => {
  const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const contractBlock = yaml.load(uncommentBlock(raw, '# contract:'));
  const reposBlock = yaml.load(uncommentBlock(raw, '# repos:'));

  assert.ok(contractBlock.contract.provided_by, 'template contract: example should declare provided_by');
  assert.ok(Array.isArray(contractBlock.contract.consumed_by) && contractBlock.contract.consumed_by.length > 0,
    'template contract: example should declare consumed_by');

  const repoNames = Object.keys(reposBlock.repos);
  assert.ok(repoNames.includes(contractBlock.contract.provided_by),
    `provided_by "${contractBlock.contract.provided_by}" should exist among the repos: example (${repoNames.join(', ')})`);
  for (const name of contractBlock.contract.consumed_by) {
    assert.ok(repoNames.includes(name), `consumed_by "${name}" should exist among the repos: example (${repoNames.join(', ')})`);
  }
});

// --- Task 2.1 (AC-4): advisory `notices` channel in `playbook validate` ---

function writeRawConfig(cwd, { http, withContractPath = true } = {}) {
  fs.mkdirSync(cwd, { recursive: true });
  const contractBlock = withContractPath ? `contract:\n  path_in_loom: ${CANONICAL_REL}\n` : '';
  fs.writeFileSync(
    path.join(cwd, 'playbook.config.yaml'),
    `version: 2\nmethodology:\n  compatible: ">=0.1.0 <1.0.0"\n` +
      `capabilities:\n  http: ${http}\ngithub:\n  base_branch: main\n  require_pull_request: true\n  require_ci: true\n${contractBlock}`,
  );
  fs.mkdirSync(path.join(cwd, 'openspec', 'changes'), { recursive: true });
}

test('AC-4: path_in_loom + http:false emits an advisory notice naming both keys, exit 0, zero invalid artifacts', async () => {
  const cwd = tmp();
  writeRawConfig(cwd, { http: false });

  const { io, out } = capture();
  const code = await run(['validate', '--json', '--cwd', cwd], io);
  assert.equal(code, 0);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.failed, 0);
  assert.ok(Array.isArray(parsed.notices) && parsed.notices.length === 1, JSON.stringify(parsed.notices));
  assert.match(parsed.notices[0], /contract\.path_in_loom/);
  assert.match(parsed.notices[0], /capabilities\.http/);
});

test('AC-4: with http:true there is no advisory notice', async () => {
  const cwd = tmp();
  writeRawConfig(cwd, { http: true });

  const { io, out } = capture();
  const code = await run(['validate', '--json', '--cwd', cwd], io);
  assert.equal(code, 0);
  const parsed = JSON.parse(out.join('\n'));
  assert.deepEqual(parsed.notices, []);
});

test('AC-4: --json keeps checked/failed/results shape and values unchanged; notices is a new top-level key', async () => {
  const cwd = tmp();
  writeRawConfig(cwd, { http: false });

  const { io, out } = capture();
  await run(['validate', '--json', '--cwd', cwd], io);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(typeof parsed.checked, 'number');
  assert.equal(typeof parsed.failed, 'number');
  assert.ok(Array.isArray(parsed.results));
  assert.ok('notices' in parsed);
});

test('AC-4: the text output prints the notice with the `note:` prefix, same as doctor', async () => {
  const cwd = tmp();
  writeRawConfig(cwd, { http: false });

  const { io, out } = capture();
  const code = await run(['validate', '--cwd', cwd], io);
  assert.equal(code, 0);
  assert.match(out.join('\n'), /note: .*contract\.path_in_loom.*capabilities\.http/);
});

// --- Task 2.2 (AC-5, EC-2, SEC-002): blocking cross-check of contract roles against repos: ---

function writeConfigWithRolesAndRepos(cwd, { provided_by, consumed_by, repos } = {}) {
  fs.mkdirSync(cwd, { recursive: true });
  const contract = { path_in_loom: CANONICAL_REL };
  if (provided_by !== undefined) contract.provided_by = provided_by;
  if (consumed_by !== undefined) contract.consumed_by = consumed_by;
  const config = {
    version: 2,
    methodology: { compatible: '>=0.1.0 <1.0.0' },
    capabilities: { http: true },
    github: { base_branch: 'main', require_pull_request: true, require_ci: true },
    contract,
    repos,
  };
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'), yaml.dump(config));
  fs.mkdirSync(path.join(cwd, 'openspec', 'changes'), { recursive: true });
}

test('EC-2/SEC-002: contract.provided_by naming a repo absent from repos: fails, naming the unknown repo, without touching the filesystem', async () => {
  const cwd = tmp();
  writeConfigWithRolesAndRepos(cwd, {
    provided_by: 'noexiste',
    repos: { backend: { path: '../backend' } }, // path deliberately does not exist on disk
  });

  const { io, out } = capture();
  const code = await run(['validate', '--json', '--cwd', cwd], io);
  assert.notEqual(code, 0);
  const parsed = JSON.parse(out.join('\n'));
  const cfgResult = parsed.results.find((r) => r.file === 'playbook.config.yaml');
  assert.equal(cfgResult.valid, false);
  assert.ok(cfgResult.errors.some((e) => /noexiste/.test(e)), JSON.stringify(cfgResult.errors));
});

test('EC-2/SEC-002: contract.consumed_by naming a repo absent from repos: fails, naming the unknown repo', async () => {
  const cwd = tmp();
  writeConfigWithRolesAndRepos(cwd, {
    consumed_by: ['frontend', 'noexiste'],
    repos: { frontend: { path: '../frontend' } },
  });

  const { io, out } = capture();
  const code = await run(['validate', '--json', '--cwd', cwd], io);
  assert.notEqual(code, 0);
  const parsed = JSON.parse(out.join('\n'));
  const cfgResult = parsed.results.find((r) => r.file === 'playbook.config.yaml');
  assert.equal(cfgResult.valid, false);
  assert.ok(cfgResult.errors.some((e) => /noexiste/.test(e)), JSON.stringify(cfgResult.errors));
});

test('AC-5: contract roles that do exist in repos: validate cleanly', async () => {
  const cwd = tmp();
  writeConfigWithRolesAndRepos(cwd, {
    provided_by: 'backend',
    consumed_by: ['frontend'],
    repos: { backend: { path: '../backend' }, frontend: { path: '../frontend' } },
  });

  const { io, out } = capture();
  const code = await run(['validate', '--json', '--cwd', cwd], io);
  assert.equal(code, 0, out.join('\n'));
});

test('EC-4: consumed_by declared without provided_by is not an error', async () => {
  const cwd = tmp();
  writeConfigWithRolesAndRepos(cwd, {
    consumed_by: ['frontend'],
    repos: { frontend: { path: '../frontend' } },
  });

  const { io, out } = capture();
  const code = await run(['validate', '--json', '--cwd', cwd], io);
  assert.equal(code, 0, out.join('\n'));
});

// --- Task 3.4 (SEC-001, AC-9, EC-1): containment of the contract read in the packet ---

const MIN_PROPOSAL = `---
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

const MIN_TASKS = `---
schema: tasks
status: passed
---
# Tasks — Demo

## Phase 1 — Core implementation
### Task 1.1 — write demo.md
- **Files**: \`demo.md\`
- **Success criterion**: test passes

## Phase 2 — Quality gates
- **Regression**: \`npm test\`
`;

function makePacketChange() {
  const cwd = tmp();
  const dir = path.join(cwd, 'openspec', 'changes', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'proposal.md'), MIN_PROPOSAL);
  fs.writeFileSync(path.join(dir, 'tasks.md'), MIN_TASKS);
  return { cwd, changesDir: path.join(cwd, 'openspec', 'changes') };
}

test('SEC-001/EC-1: a contract.path_in_loom escaping via `..` is rejected, naming the path, before any read is attempted', () => {
  const { changesDir } = makePacketChange();
  assert.throws(
    () => buildPacket('demo', changesDir, { path_in_loom: '../../etc/passwd' }),
    /refusing to resolve path outside the project root.*\.\.\/\.\.\/etc\/passwd/s,
  );
});

test('SEC-001/EC-1: a contract.path_in_loom that is absolute to another tree is rejected', () => {
  const { changesDir } = makePacketChange();
  assert.throws(
    () => buildPacket('demo', changesDir, { path_in_loom: '/etc/passwd' }),
    /refusing to resolve path outside the project root/,
  );
});

test('SEC-001/EC-1: a contract.path_in_loom that escapes via a symlink is rejected', () => {
  const { cwd, changesDir } = makePacketChange();
  const outside = tmp();
  fs.mkdirSync(path.join(cwd, 'openspec', 'specs', 'contracts'), { recursive: true });
  fs.symlinkSync(outside, path.join(cwd, 'openspec', 'specs', 'contracts', 'linked'), 'dir');
  assert.throws(
    () => buildPacket('demo', changesDir, { path_in_loom: 'openspec/specs/contracts/linked/openapi.yaml' }),
    /refusing to resolve path outside the project root/,
  );
});

test('SEC-001: a relative, contained contract.path_in_loom still resolves and builds the Contract section (regression)', () => {
  const { changesDir } = makePacketChange();
  const { content } = buildPacket('demo', changesDir, { path_in_loom: 'openspec/specs/contracts/openapi.yaml' });
  assert.match(content, /## Contract/);
  assert.match(content, /openspec\/specs\/contracts\/openapi\.yaml/);
});
