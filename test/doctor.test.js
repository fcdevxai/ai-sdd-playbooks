import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, EXIT } from '../src/cli/dispatch.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-doctor-')); }
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

// Run `fn` with a stamped global methodology dir so doctor sees an install.
async function withGlobalVersion(version, fn) {
  const global = tmp();
  fs.writeFileSync(path.join(global, '.sdd-version'), `${version}\n`);
  const saved = process.env.SDD_CLAUDE_SKILLS_DIR;
  process.env.SDD_CLAUDE_SKILLS_DIR = global;
  try { return await fn(); } finally {
    if (saved === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR;
    else process.env.SDD_CLAUDE_SKILLS_DIR = saved;
  }
}

function snapshot(dir) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(`${path.relative(dir, p)}:${fs.statSync(p).mtimeMs}:${fs.readFileSync(p, 'utf8').length}`);
    }
  };
  walk(dir);
  return files.sort();
}

async function initRepo() {
  const dir = tmp();
  await run(['init', '--cwd', dir], capture().io);
  return dir;
}

test('doctor is read-only by default — writes nothing (AC-05)', async () => {
  const dir = await initRepo();
  const before = snapshot(dir);
  await withGlobalVersion('2.0.0', () => run(['doctor', '--cwd', dir], capture().io));
  assert.deepEqual(snapshot(dir), before);
});

test('a freshly initialized repo with a compatible global install is healthy (exit 0)', async () => {
  const dir = await initRepo();
  const code = await withGlobalVersion('2.0.0', () => run(['doctor', '--cwd', dir], capture().io));
  assert.equal(code, EXIT.OK);
});

test('doctor reports "no global methodology installed" when none is present', async () => {
  const dir = await initRepo();
  const saved = process.env.SDD_CLAUDE_SKILLS_DIR;
  const empty = tmp(); // no .sdd-version here
  process.env.SDD_CLAUDE_SKILLS_DIR = empty;
  try {
    const { io, err } = capture();
    const code = await run(['doctor', '--cwd', dir], io);
    assert.equal(code, EXIT.ENVIRONMENT);
    assert.match(err.join('\n'), /no global methodology installed/);
  } finally {
    if (saved === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR;
    else process.env.SDD_CLAUDE_SKILLS_DIR = saved;
  }
});

test('doctor blocks when the installed version is outside the compatible range (C-08)', async () => {
  const dir = await initRepo(); // lock compatible ">=2.0.0 <3.0.0"
  await withGlobalVersion('3.0.0', async () => {
    const { io, err } = capture();
    const code = await run(['doctor', '--cwd', dir], io);
    assert.equal(code, EXIT.ENVIRONMENT);
    assert.match(err.join('\n'), /outside the project range/);
  });
});

test('doctor --fix is additive only: creates missing openspec/changes, edits nothing existing (AC-05)', async () => {
  const dir = await initRepo();
  fs.rmSync(path.join(dir, 'openspec', 'changes'), { recursive: true, force: true });
  const before = snapshot(dir);
  await withGlobalVersion('2.0.0', () => run(['doctor', '--fix', '--cwd', dir], capture().io));
  assert.ok(fs.existsSync(path.join(dir, 'openspec', 'changes')));
  const after = new Map(snapshot(dir).map((s) => [s.split(':')[0], s]));
  for (const b of before) assert.equal(after.get(b.split(':')[0]), b);
});
