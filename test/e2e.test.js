import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { run, EXIT } from '../src/cli/dispatch.js';
import { planRuntimeAdapters } from '../src/adapters/index.js';

const IMPACT_NONE = {
  public_contract: false, data_model: false, architecture_boundary: false,
  external_integration: false, cross_repository: false, authentication: false,
  authorization: false, infrastructure: false, concurrency: false, migration: false,
};

function repo(capabilities) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-e2e-'));
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'feat'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sdd.config.yaml'), yaml.dump({
    version: 2,
    methodology: { compatible: '>=2.0.0 <3.0.0' },
    capabilities,
    github: { base_branch: 'main', require_pull_request: true, require_ci: true },
  }));
  return dir;
}

function fm(dir, name, obj) {
  fs.writeFileSync(
    path.join(dir, 'openspec', 'changes', 'feat', name),
    `---\n${yaml.dump(obj)}---\n`,
  );
}

async function nextText(dir) {
  const out = [];
  await run(['next', '--cwd', dir], { out: (m) => out.push(String(m)), err: (m) => out.push(String(m)) });
  return out.join('\n');
}

test('E2E: full lifecycle sweep for a browser+http project (methodological chain)', async () => {
  const dir = repo({ browser: true, http: true, cli: false, worker: false });

  fm(dir, 'proposal.md', { schema: 'proposal', schema_version: 1, change_id: 'feat', status: 'draft', impact: IMPACT_NONE, security: { risk: 'low', triggers: [] } });
  assert.match(await nextText(dir), /await human/i);

  fm(dir, 'proposal.md', { schema: 'proposal', schema_version: 1, change_id: 'feat', status: 'approved', impact: IMPACT_NONE, security: { risk: 'low', triggers: [] } });
  assert.match(await nextText(dir), /sdd-plan/); // design not required → designed → plan

  fm(dir, 'tasks.md', { schema: 'tasks', schema_version: 1, change_id: 'feat', status: 'ready' });
  assert.match(await nextText(dir), /sdd-apply/);

  fm(dir, 'tasks.md', { schema: 'tasks', schema_version: 1, change_id: 'feat', status: 'passed' });
  assert.match(await nextText(dir), /sdd-code-review/);

  fm(dir, 'code-review-report.md', { schema: 'code-review-report', schema_version: 1, change_id: 'feat', status: 'passed' });
  assert.match(await nextText(dir), /sdd-security-gate/);

  fm(dir, 'security-report.md', { schema: 'security-report', schema_version: 1, change_id: 'feat', status: 'passed', risk: 'low' });
  assert.match(await nextText(dir), /sdd-runtime-gate/);

  fm(dir, 'runtime-gate-report.md', { schema: 'runtime-gate-report', schema_version: 1, change_id: 'feat', status: 'passed', adapters: { http: { status: 'passed' } } });
  // non-git repo → delivery unknown → blocked (needs remote to commit)
  assert.match(await nextText(dir), /GITHUB_CONTEXT_UNAVAILABLE/);

  // make it a dirty git repo → delivery uncommitted → commit
  execFileSync('git', ['init', '-q'], { cwd: dir });
  assert.match(await nextText(dir), /sdd-commit/);

  // archived is terminal → done
  fm(dir, 'proposal.md', { schema: 'proposal', schema_version: 1, change_id: 'feat', status: 'archived', impact: IMPACT_NONE, security: { risk: 'low', triggers: [] } });
  assert.match(await nextText(dir), /done/);
});

test('E2E: validate --ci passes for a well-formed change', async () => {
  const dir = repo({ http: true });
  fm(dir, 'proposal.md', { schema: 'proposal', schema_version: 1, change_id: 'feat', status: 'approved', impact: IMPACT_NONE, security: { risk: 'low', triggers: [] } });
  fm(dir, 'runtime-gate-report.md', { schema: 'runtime-gate-report', schema_version: 1, change_id: 'feat', status: 'passed', adapters: { http: { status: 'passed' } } });
  const code = await run(['validate', '--ci', '--cwd', dir], { out: () => {}, err: () => {} });
  assert.equal(code, EXIT.OK);
});

test('E2E: http-only project → browser adapter not_applicable, http applies', () => {
  const plan = planRuntimeAdapters({ browser: false, http: true, cli: false, worker: false });
  assert.equal(plan.browser.status, 'not_applicable');
  assert.equal(plan.http.status, 'pending');
});

test('E2E: worker-capable project → worker adapter blocks (experimental, never passed)', () => {
  const plan = planRuntimeAdapters({ worker: true });
  assert.equal(plan.worker.status, 'blocked');
});
