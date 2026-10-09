/** Independent audit probes: runtime coverage accounting. Each asserts the SAFE behaviour. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bindAll, boundFlow, cli, cloneOf, commitEverything, gatedFixture } from './helpers/evidence-fixture.js';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { EXIT } from '../src/cli/dispatch.js';

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };
const statusOf = async (cwd) => JSON.parse((await cli(['status', 'demo', '--json', '--cwd', cwd])).out);

test('AB7: error cases and security criteria without a runtime mapping or a non-runtime rationale block the runtime gate (F05)', async () => {
  // Sealing rejects the omitted declaration before a cleared gate can be created.
  await assert.rejects(() => gatedFixture({ prepare: ({ change }) => {
    const tasks = path.join(change, 'tasks.md');
    fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replace(/^  non_runtime: .*\n/m, ''));
  } }), /EC-1 has no runtime criterion mapping/);
  // The live evaluator also rejects removal after a valid gate and binding.
  const { cwd, change } = await boundFlow();
  const tasks = path.join(change, 'tasks.md');
  fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replace(/^  non_runtime: .*\n/m, ''));
  writeHandoffManifest('demo', { cwd, stage: 'sdd-apply', agent: 'Fixture' });
  const status = await statusOf(cwd);
  const gate = status.evidence.gates['runtime-gate-report.md'];
  assert.match(gate.issues.join(' '), /EC-1 has no runtime criterion mapping or non-runtime rationale/);
  assert.equal(gate.ok, false, `runtime gate eligible although EC-1 and SEC-1 carry neither a mapping nor a rationale (lifecycle ${status.lifecycle.state})`);
});

async function siblingFixture(hubApiCaps, { afterCommit = null, ownCaps = '{browser: false, http: false, cli: false, worker: false}' } = {}) {
  const api = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-api-'));
  const inApi = (...args) => execFileSync('git', args, { cwd: api, stdio: ['ignore', 'pipe', 'pipe'] });
  inApi('init', '-q', '-b', 'feature'); inApi('config', 'user.email', 'a@example.invalid'); inApi('config', 'user.name', 'A');
  fs.writeFileSync(path.join(api, 'playbook.config.yaml'), `version: 2\ncapabilities: ${ownCaps}\n`);
  fs.writeFileSync(path.join(api, 'page.js'), 'export const page = 1;\n');
  inApi('add', '-A'); inApi('commit', '-qm', 'api');
  const state = await gatedFixture({ prepare: ({ cwd, change }) => {
    const configFile = path.join(cwd, 'playbook.config.yaml');
    fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf8').replace('capabilities: {browser: false, http: true, cli: false, worker: false}}}',
      `capabilities: {browser: false, http: true, cli: false, worker: false}}, api: {path: ${api}, capabilities: ${hubApiCaps}}}`));
    const proposal = path.join(change, 'proposal.md');
    fs.writeFileSync(proposal, fs.readFileSync(proposal, 'utf8').replace('## Impacted repos\n- hub\n', '## Impacted repos\n- hub\n- api\n'));
  } });
  commitEverything(state);
  if (afterCommit) afterCommit(api);
  bindAll(state.cwd);
  commit(state.git, 'bindings');
  return { ...state, api };
}

test('AB8: a repository whose own configuration enables a capability cannot pass the runtime gate without that adapter (F05)', async () => {
  const enabled = '{browser: true, http: true, cli: false, worker: false}';
  await assert.rejects(() => siblingFixture(enabled, { ownCaps: enabled }), /required runtime adapter browser missing/);
  for (const hubCaps of [enabled, '{browser: false, http: false, cli: false, worker: false}']) {
    const { cwd, api } = await siblingFixture(hubCaps);
    fs.writeFileSync(path.join(api, 'playbook.config.yaml'), `version: 2\ncapabilities: ${enabled}\n`);
    writeHandoffManifest('demo', { cwd, stage: 'sdd-apply', agent: 'Fixture' });
    const status = await statusOf(cwd), gate = status.evidence.gates['runtime-gate-report.md'];
    assert.equal(gate.ok, false, 'own enabled browser requires evidence regardless of Hub fallback');
    assert.match(gate.issues.join(' '), /required runtime adapter browser missing/);
  }
});

test('AB9: validate --ci still judges a sibling binding whose provable fields are corrupt when the sibling is not checked out', async () => {
  const state = await siblingFixture('{browser: true, http: true, cli: false, worker: false}'.replace('browser: true', 'browser: false'), {
    afterCommit: (api) => execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'empty api commit'], { cwd: api }) });
  const { cwd, git, change, api } = state;
  const file = fs.readdirSync(change).find((name) => name.startsWith('evidence-binding-code-review-report-api-'));
  assert.ok(file, 'fixture: an api binding exists');
  const record = JSON.parse(fs.readFileSync(path.join(change, file), 'utf8'));
  record.governed_hash = '9'.repeat(64);
  fs.writeFileSync(path.join(change, file), JSON.stringify(record, null, 2) + '\n');
  commit(git, 'corrupt api binding');
  const strict = await cli(['validate', '--json', '--cwd', cwd]);
  assert.match(strict.out, /governed digest differs from the sealed snapshot/, 'control: strict mode proves the corruption');
  const clone = cloneOf(cwd);
  fs.renameSync(api, `${api}-gone`);
  try {
    const ci = await cli(['validate', '--ci', '--cwd', clone]);
    const parsed = JSON.parse(ci.out);
    assert.notEqual(ci.code, EXIT.OK, `validate --ci accepted a binding whose governed_hash contradicts the sealed report:\n${JSON.stringify(parsed.results.filter((r) => !r.valid).map((r) => r.errors))}\nlocal-only: ${parsed.local_only.filter((e) => /api/.test(e.check)).map((e) => e.file + ' ' + e.check).join('; ')}`);
  } finally {
    fs.renameSync(`${api}-gone`, api);
  }
});
