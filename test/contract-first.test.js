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
