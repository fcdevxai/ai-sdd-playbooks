import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, EXIT } from '../src/cli/dispatch.js';

function capture() {
  const out = [];
  const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-validate-'));
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'demo'), { recursive: true });
  return dir;
}

function writeChange(dir, name, body) {
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', 'demo', name), body);
}

const VALID_PROPOSAL = `---
schema: proposal
schema_version: 1
change_id: demo
status: approved
impact:
  public_contract: false
  data_model: false
  architecture_boundary: false
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: low
  triggers: []
---
# Demo proposal
`;

const VALID_TASKS = `---
schema: tasks
schema_version: 1
change_id: demo
status: ready
---
# Tasks
`;

test('validate: a valid change exits 0', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL);
  const { io } = capture();
  const code = await run(['validate', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
});

test('validate: a schema violation exits 1 (AC-10)', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL);
  // design with the illegal status "ready" (C-07)
  writeChange(dir, 'design.md', `---
schema: design
schema_version: 1
change_id: demo
status: ready
security:
  risk: low
  threat_model_required: false
  controls: []
---
`);
  const { io } = capture();
  const code = await run(['validate', '--cwd', dir], io);
  assert.equal(code, EXIT.VIOLATION);
});

test('validate: change_id mismatch with the folder is a violation', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL.replace('change_id: demo', 'change_id: other'));
  const { io } = capture();
  const code = await run(['validate', '--cwd', dir], io);
  assert.equal(code, EXIT.VIOLATION);
});

test('validate --ci --json emits machine-readable output and counts failures', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL);
  const { io, out } = capture();
  const code = await run(['validate', '--ci', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.command, 'validate');
  assert.equal(parsed.failed, 0);
  assert.ok(parsed.checked >= 1);
});

test('validate does not mutate any artifact (C-12)', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL);
  const file = path.join(dir, 'openspec', 'changes', 'demo', 'proposal.md');
  const before = fs.readFileSync(file, 'utf8');
  const beforeMtime = fs.statSync(file).mtimeMs;
  const { io } = capture();
  await run(['validate', '--ci', '--cwd', dir], io);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.statSync(file).mtimeMs, beforeMtime);
});

test('validate --precondition sdd-apply: met when proposal approved + tasks ready + design skipped', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL); // all impact false → design not required
  writeChange(dir, 'tasks.md', VALID_TASKS);
  const { io } = capture();
  const code = await run(['validate', '--precondition', 'sdd-apply', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
});

test('validate --precondition sdd-apply: unmet when tasks missing', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL);
  const { io } = capture();
  const code = await run(['validate', '--precondition', 'sdd-apply', '--cwd', dir], io);
  assert.equal(code, EXIT.VIOLATION);
});

test('validate: unquoted YAML dates are accepted (normalized Date → string)', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL.replace(
    '---\n# Demo proposal',
    'created: 2026-07-14\nupdated: 2026-07-14\n---\n# Demo proposal',
  ));
  const { io } = capture();
  const code = await run(['validate', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
});

const RUNTIME_REPORT = (status, adapterStatus) => `---
schema: runtime-gate-report
schema_version: 1
change_id: demo
status: ${status}
adapters:
  http: { status: ${adapterStatus} }
---
`;

test('validate: runtime-gate status consistent with adapters passes (C-06)', async () => {
  const dir = makeRepo();
  writeChange(dir, 'runtime-gate-report.md', RUNTIME_REPORT('passed', 'passed'));
  const { io } = capture();
  assert.equal(await run(['validate', '--cwd', dir], io), EXIT.OK);
});

test('validate: runtime-gate status disagreeing with adapters is a violation (C-06/C-12)', async () => {
  const dir = makeRepo();
  // declares passed but an applicable adapter is blocked → aggregate is blocked
  writeChange(dir, 'runtime-gate-report.md', RUNTIME_REPORT('passed', 'blocked'));
  const { io } = capture();
  assert.equal(await run(['validate', '--cwd', dir], io), EXIT.VIOLATION);
});

// Per-change relevance cross-check (design §5): only active when the proposal
// declares `runtime_relevant_capabilities`; project has worker:true throughout.
const CONFIG_WORKER_TRUE = `version: 2
methodology:
  compatible: ">=3.0.0 <4.0.0"
capabilities:
  http: true
  worker: true
github:
  base_branch: main
  require_pull_request: true
  require_ci: true
`;

const PROPOSAL_EXCLUDING_WORKER = VALID_PROPOSAL.replace(
  'security:\n  risk: low\n  triggers: []\n---',
  'security:\n  risk: low\n  triggers: []\nruntime_relevant_capabilities: [http]\n---',
);

test('validate: excluded-but-enabled capability reported as anything but not_applicable is a violation', async () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'sdd.config.yaml'), CONFIG_WORKER_TRUE);
  writeChange(dir, 'proposal.md', PROPOSAL_EXCLUDING_WORKER); // excludes worker
  writeChange(dir, 'runtime-gate-report.md', `---
schema: runtime-gate-report
schema_version: 1
change_id: demo
status: blocked
adapters:
  http: { status: passed }
  worker: { status: blocked }
---
`);
  const { io, err } = capture();
  const code = await run(['validate', '--cwd', dir], io);
  assert.equal(code, EXIT.VIOLATION);
  assert.match(err.join('\n'), /worker.*excludes it.*not_applicable/s);
});

test('validate: excluded capability correctly reported not_applicable is valid', async () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'sdd.config.yaml'), CONFIG_WORKER_TRUE);
  writeChange(dir, 'proposal.md', PROPOSAL_EXCLUDING_WORKER); // excludes worker
  writeChange(dir, 'runtime-gate-report.md', `---
schema: runtime-gate-report
schema_version: 1
change_id: demo
status: passed
adapters:
  http: { status: passed }
  worker: { status: not_applicable }
---
`);
  const { io } = capture();
  assert.equal(await run(['validate', '--cwd', dir], io), EXIT.OK);
});

test('validate: a proposal without runtime_relevant_capabilities triggers no new check (AC-08)', async () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'sdd.config.yaml'), CONFIG_WORKER_TRUE);
  writeChange(dir, 'proposal.md', VALID_PROPOSAL); // no runtime_relevant_capabilities at all
  writeChange(dir, 'runtime-gate-report.md', `---
schema: runtime-gate-report
schema_version: 1
change_id: demo
status: blocked
adapters:
  http: { status: passed }
  worker: { status: blocked }
---
`);
  const { io } = capture();
  // status matches the adapters aggregate (blocked), and the new check never
  // fires without the field — today's behavior, unaffected.
  assert.equal(await run(['validate', '--cwd', dir], io), EXIT.OK);
});

test('validate --precondition: unknown skill is a usage error', async () => {
  const dir = makeRepo();
  writeChange(dir, 'proposal.md', VALID_PROPOSAL);
  const { io } = capture();
  const code = await run(['validate', '--precondition', 'sdd-nope', '--cwd', dir], io);
  assert.equal(code, EXIT.USAGE);
});
