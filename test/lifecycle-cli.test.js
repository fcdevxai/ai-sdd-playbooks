import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { run, EXIT } from '../src/cli/dispatch.js';

function makeRepo(changeId = 'demo') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-life-'));
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', changeId), { recursive: true });
  return dir;
}

function writeArtifact(dir, changeId, name, status) {
  fs.writeFileSync(
    path.join(dir, 'openspec', 'changes', changeId, name),
    `---\nstatus: ${status}\n---\n`,
  );
}

function capture() {
  const out = [];
  const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

test('sdd status prints both dimensions for a planned change', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved'); // no impact → design not required
  writeArtifact(dir, 'demo', 'tasks.md', 'ready');
  const { io, out } = capture();
  const code = await run(['status', '--json', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.lifecycle.state, 'planned');
  assert.equal(parsed.delivery.state, 'unknown');
});

test('sdd next on a planned change → sdd-apply', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved');
  writeArtifact(dir, 'demo', 'tasks.md', 'ready');
  const { io, out } = capture();
  const code = await run(['next', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Next skill: sdd-apply/);
});

test('sdd next at runtime_cleared with unknown delivery → blocked (exit 2)', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved');
  writeArtifact(dir, 'demo', 'tasks.md', 'passed');
  writeArtifact(dir, 'demo', 'code-review-report.md', 'passed');
  writeArtifact(dir, 'demo', 'security-report.md', 'passed');
  writeArtifact(dir, 'demo', 'runtime-gate-report.md', 'passed');
  const { io, out } = capture();
  const code = await run(['next', '--json', '--cwd', dir], io);
  assert.equal(code, EXIT.BLOCKED);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.lifecycle.state, 'runtime_cleared');
  assert.equal(parsed.next.reason, 'GITHUB_CONTEXT_UNAVAILABLE');
});

test('sdd next on a design-required approved proposal → sdd-design, writing no design.md (T6.2)', async () => {
  const dir = makeRepo();
  fs.writeFileSync(
    path.join(dir, 'openspec', 'changes', 'demo', 'proposal.md'),
    '---\nschema: proposal\nstatus: approved\nimpact:\n  architecture_boundary: true\n---\n',
  );
  const { io, out } = capture();
  const code = await run(['next', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /sdd-design/);
  assert.equal(fs.existsSync(path.join(dir, 'openspec', 'changes', 'demo', 'design.md')), false);
});

test('sdd next at reviewed → sdd-security-gate carries the disclaimer (T7.3)', async () => {
  const dir = makeRepo();
  writeArtifact(dir, 'demo', 'proposal.md', 'approved'); // no impact → design not required
  writeArtifact(dir, 'demo', 'tasks.md', 'passed');
  writeArtifact(dir, 'demo', 'code-review-report.md', 'passed');
  const { io, out } = capture();
  const code = await run(['next', '--json', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  const parsed = JSON.parse(out.join('\n'));
  assert.equal(parsed.next.skill, 'sdd-security-gate');
  assert.match(parsed.security_disclaimer, /penetration test/i);
});

test('sdd next reads real delivery: a dirty git repo at runtime_cleared → sdd-commit (Phase 10)', async () => {
  const dir = makeRepo();
  execFileSync('git', ['init', '-q'], { cwd: dir }); // untracked artifacts → uncommitted
  writeArtifact(dir, 'demo', 'proposal.md', 'approved');
  writeArtifact(dir, 'demo', 'tasks.md', 'passed');
  writeArtifact(dir, 'demo', 'code-review-report.md', 'passed');
  writeArtifact(dir, 'demo', 'security-report.md', 'passed');
  writeArtifact(dir, 'demo', 'runtime-gate-report.md', 'passed');
  const { io, out } = capture();
  const code = await run(['next', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Next skill: sdd-commit/);
});

test('sdd status with no change folders is a usage error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-empty-'));
  const { io } = capture();
  const code = await run(['status', '--cwd', dir], io);
  assert.equal(code, EXIT.USAGE);
});

test('sdd next resolves an explicit change-id among many', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-multi-'));
  for (const id of ['a', 'b']) {
    fs.mkdirSync(path.join(dir, 'openspec', 'changes', id), { recursive: true });
    writeArtifact(dir, id, 'proposal.md', 'approved');
    writeArtifact(dir, id, 'tasks.md', 'ready');
  }
  const { io, out } = capture();
  const code = await run(['next', 'b', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  assert.match(out.join('\n'), /Next skill: sdd-apply/);
});
