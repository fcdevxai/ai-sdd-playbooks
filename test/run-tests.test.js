/**
 * Test runner with one temporary root per run (change identity-flags-and-test-isolation).
 *
 * `npm test` runs `test/helpers/run-tests.js`, which creates a temporary root under the
 * inherited temporary directory, hands it to the test processes as `TMPDIR`, and removes it
 * on every exit path. These tests drive the real runner as a child process against small
 * fixture test files in a scratch directory.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUN_ROOT_PREFIX, createRunRoot, removeRunRoot, defaultTestFiles } from './helpers/run-tests.js';

const RUNNER = fileURLToPath(new URL('./helpers/run-tests.js', import.meta.url));
const created = [];
after(() => { for (const dir of created) fs.rmSync(dir, { recursive: true, force: true }); });

function scratch(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
}

/** A project with fixture tests, an isolated parent temporary directory and a report directory. */
function project(files) {
  const cwd = scratch('runner-project-');
  const parent = scratch('runner-parent-');
  const reports = scratch('runner-reports-');
  fs.mkdirSync(path.join(cwd, 'test'));
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"type": "module"}\n'); // Node 18 has no ESM syntax detection
  for (const [name, source] of Object.entries(files)) fs.writeFileSync(path.join(cwd, 'test', name), source);
  return { cwd, parent, reports };
}

// The runner must see a plain environment: a nested `node --test` would otherwise inherit the
// outer runner's child-process context.
function runnerEnv(parent, reports) {
  const env = { ...process.env, TMPDIR: parent, REPORTS: reports };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function runSync({ cwd, parent, reports }, args = []) {
  return spawnSync(process.execPath, [RUNNER, ...args], { cwd, env: runnerEnv(parent, reports), encoding: 'utf8' });
}

// A fixture test that records the temporary directory it sees and leaves a directory behind.
const LEAKY = `import { test } from 'node:test';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
test('leaks a fixture directory', () => {
  fs.mkdtempSync(path.join(os.tmpdir(), 'leaked-'));
  fs.writeFileSync(path.join(process.env.REPORTS, path.basename(new URL(import.meta.url).pathname) + '.tmpdir'), os.tmpdir());
});
`;
const FAILING = `import { test } from 'node:test';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
test('fails after leaking', () => { fs.mkdtempSync(path.join(os.tmpdir(), 'leaked-')); throw new Error('expected failure'); });
`;
const SLOW = `import { test } from 'node:test';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
test('waits to be interrupted', async () => {
  fs.mkdtempSync(path.join(os.tmpdir(), 'leaked-'));
  fs.writeFileSync(path.join(process.env.REPORTS, 'started'), os.tmpdir());
  await new Promise((resolve) => setTimeout(resolve, 60000));
});
`;

test('AC-3: the test processes get a fresh root under the inherited temporary directory, removed after success', () => {
  const p = project({ 'a.test.js': LEAKY });
  const result = runSync(p, ['test/a.test.js']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const seen = fs.readFileSync(path.join(p.reports, 'a.test.js.tmpdir'), 'utf8');
  assert.equal(path.dirname(seen), fs.realpathSync(p.parent));
  assert.ok(path.basename(seen).startsWith(RUN_ROOT_PREFIX), seen);
  assert.deepEqual(fs.readdirSync(p.parent), [], 'the run leaves nothing in the parent temporary directory');
});

test('AC-3: with no arguments the runner runs every test/*.test.js file and nothing else', () => {
  const p = project({ 'a.test.js': LEAKY, 'b.test.js': LEAKY, 'helper.js': 'throw new Error("not a test file");\n' });
  const result = runSync(p);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(fs.readdirSync(p.reports).sort(), ['a.test.js.tmpdir', 'b.test.js.tmpdir']);
  assert.deepEqual(defaultTestFiles(p.cwd), ['test/a.test.js', 'test/b.test.js']);
  assert.deepEqual(fs.readdirSync(p.parent), []);
});

test('AC-5: file arguments are forwarded and the exit code is preserved', () => {
  const p = project({ 'a.test.js': LEAKY, 'b.test.js': FAILING });
  assert.equal(runSync(p, ['test/a.test.js']).status, 0);
  assert.deepEqual(fs.readdirSync(p.reports), ['a.test.js.tmpdir'], 'only the named file ran');
  assert.notEqual(runSync(p, ['test/b.test.js']).status, 0);
});

test('EC-1: a failing test still removes the root and the runner exits non-zero', () => {
  const p = project({ 'b.test.js': FAILING });
  const result = runSync(p, ['test/b.test.js']);
  assert.notEqual(result.status, 0);
  assert.equal(result.signal, null);
  assert.deepEqual(fs.readdirSync(p.parent), []);
});

test('EC-2: SIGTERM reaches the tests, removes the root and ends the runner with the signal', async () => {
  const p = project({ 'slow.test.js': SLOW });
  const child = spawn(process.execPath, [RUNNER, 'test/slow.test.js'], { cwd: p.cwd, env: runnerEnv(p.parent, p.reports), stdio: 'ignore' });
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  const started = path.join(p.reports, 'started');
  for (let i = 0; i < 200 && !fs.existsSync(started); i++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(fs.existsSync(started), 'the slow test started');
  child.kill('SIGTERM');
  const { signal } = await exited;
  assert.equal(signal, 'SIGTERM');
  assert.deepEqual(fs.readdirSync(p.parent), []);
});

test('EC-3: an unusable parent temporary directory fails before any test runs', () => {
  const p = project({ 'a.test.js': LEAKY });
  const missing = path.join(p.parent, 'does-not-exist');
  const result = spawnSync(process.execPath, [RUNNER, 'test/a.test.js'], { cwd: p.cwd, env: runnerEnv(missing, p.reports), encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot create the test temporary root/);
  assert.deepEqual(fs.readdirSync(p.reports), [], 'no test ran');
});

test('SEC-1: the runner removes only a root it created directly under the parent', () => {
  const parent = scratch('runner-scope-');
  const outside = scratch('runner-outside-');
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep\n');
  const notOurs = path.join(parent, 'unrelated');
  fs.mkdirSync(notOurs);
  const nested = path.join(createRunRoot(parent), `${RUN_ROOT_PREFIX}nested`);
  fs.mkdirSync(nested);
  const link = path.join(parent, `${RUN_ROOT_PREFIX}link`);
  fs.symlinkSync(outside, link);
  for (const target of [outside, parent, notOurs, nested, link, path.join(parent, '..', path.basename(outside)), '/']) {
    assert.throws(() => removeRunRoot(target, parent), /refusing to remove/, target);
  }
  assert.ok(fs.existsSync(path.join(outside, 'keep.txt')), 'nothing outside the root was removed');
  assert.ok(fs.existsSync(notOurs));
  const root = createRunRoot(parent);
  fs.writeFileSync(path.join(root, 'file'), 'x');
  removeRunRoot(root, parent);
  assert.equal(fs.existsSync(root), false);
});
