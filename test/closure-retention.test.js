import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { writeHandoffManifest, governedManifestHash } from '../src/tokens/handoff.js';
import { sha256 } from '../src/tokens/evidence.js';
import { retainEvidence, validateClosureIndex } from '../src/tokens/retention.js';
import { fixture, merged } from './helpers/closure-fixture.js';


test('retained closure and raw evidence survive active change deletion', () => {
  const { cwd, change, rawDestination } = fixture();
  const result = retainEvidence('example', { cwd, rawDestination, delivery: merged });
  assert.equal(result.index.schema, 'closure-index');
  const indexPath = path.join(cwd, 'openspec/archive/example/closure-index.json');
  assert.equal(fs.existsSync(indexPath), true);
  fs.rmSync(change, { recursive: true });
  assert.equal(fs.existsSync(path.join(cwd, 'openspec/archive/example/verification-report.md')), true);
  assert.equal(fs.existsSync(path.join(rawDestination, 'example/run-verify/full.log')), true);
  assert.deepEqual(validateClosureIndex('example', { cwd }).issues, []);
  fs.appendFileSync(path.join(rawDestination, 'example/run-verify/full.log'), 'tamper');
  assert.match(validateClosureIndex('example', { cwd }).issues.join(' '), /raw evidence stale/i);
});

test('open PR, missing raw log and unsafe receipt path block retention without deleting originals', () => {
  const open = fixture();
  assert.throws(() => retainEvidence('example', { cwd: open.cwd, rawDestination: open.rawDestination,
    delivery: { state: 'pr_open', per_repo: [{ repo: 'hub', state: 'pr_open' }] } }), /merged/i);
  const missing = fixture(); fs.unlinkSync(missing.raw);
  assert.throws(() => retainEvidence('example', { cwd: missing.cwd, rawDestination: missing.rawDestination, delivery: merged }), /raw evidence/i);
  assert.equal(fs.existsSync(missing.change), true);
  assert.equal(fs.existsSync(path.join(missing.cwd, 'openspec/archive/example')), false);
  const unsafe = fixture();
  const bad = JSON.parse(fs.readFileSync(unsafe.receipt, 'utf8')); bad.raw.full.path = '../outside';
  fs.writeFileSync(unsafe.receipt, JSON.stringify(bad));
  assert.throws(() => retainEvidence('example', { cwd: unsafe.cwd, rawDestination: unsafe.rawDestination, delivery: merged }), /receipt|raw evidence|stale/i);
  assert.equal(fs.existsSync(unsafe.change), true);
});

test('a failed copy leaves no published or staged closure and preserves the active change', () => {
  const { cwd, change, rawDestination } = fixture();
  const originalCopy = fs.copyFileSync;
  let copies = 0;
  fs.copyFileSync = (...args) => {
    copies++;
    if (copies === 2) throw new Error('synthetic copy failure');
    return originalCopy(...args);
  };
  try {
    assert.throws(() => retainEvidence('example', { cwd, rawDestination, delivery: merged }), /synthetic copy failure/);
  } finally {
    fs.copyFileSync = originalCopy;
  }
  assert.equal(fs.existsSync(change), true);
  assert.deepEqual(fs.readdirSync(path.join(cwd, 'openspec/archive')), []);
  assert.deepEqual(fs.readdirSync(rawDestination), []);
});

test('closure copies refuse an internal symbolic link in the change directory (Amendment R5, rule 4)', () => {
  const { cwd, change, rawDestination } = fixture();
  fs.writeFileSync(path.join(change, 'tasks-copy.md'), fs.readFileSync(path.join(change, 'tasks.md')));
  fs.writeFileSync(path.join(change, 'OWNER.md'), 'placeholder\n');
  fs.unlinkSync(path.join(change, 'OWNER.md'));
  fs.symlinkSync('tasks-copy.md', path.join(change, 'OWNER.md'));
  // Files added to the change directory are reviewed content now, so the stale handoff refuses first.
  assert.throws(() => retainEvidence('example', { cwd, rawDestination, delivery: merged }), /not a contained regular file|symbolic link|stale/i);
  assert.equal(fs.existsSync(path.join(cwd, 'openspec/archive/example')), false, 'nothing is published');
});

test('a valid raw_root validates and a symbolic link on a retained raw path fails', () => {
  const { cwd, change, rawDestination } = fixture();
  retainEvidence('example', { cwd, rawDestination, delivery: merged });
  assert.equal(validateClosureIndex('example', { cwd }).ok, true);
  const runDir = path.join(rawDestination, 'example', 'run-verify');
  const moved = path.join(rawDestination, 'moved-run-verify');
  fs.renameSync(runDir, moved);
  fs.symlinkSync(moved, runDir);
  assert.equal(validateClosureIndex('example', { cwd }).ok, false);
  assert.ok(change);
});

test('Issue 23: closure retains change-local references pinned by the handoff manifest', () => {
  const { cwd, change, rawDestination } = fixture({ changeLocalReference: true });
  retainEvidence('example', { cwd, rawDestination, delivery: merged });
  assert.equal(fs.existsSync(path.join(cwd, 'openspec/archive/example/required-architecture.md')), true);
  const index = JSON.parse(fs.readFileSync(path.join(cwd, 'openspec/archive/example/closure-index.json'), 'utf8'));
  assert.ok(index.files.some((entry) => entry.path === 'required-architecture.md'));
  assert.ok(change);
});

test('Issue 23: a reduced closure index never validates', () => {
  const { cwd, change, rawDestination } = fixture();
  retainEvidence('example', { cwd, rawDestination, delivery: merged });
  assert.equal(validateClosureIndex('example', { cwd }).ok, true);
  const archive = path.join(cwd, 'openspec/archive/example');
  const indexFile = path.join(archive, 'closure-index.json');
  const original = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const variants = {
    'proposal only': (index) => { index.files = index.files.filter((entry) => entry.path === 'proposal.md'); },
    'no raw evidence': (index) => { index.restricted_raw = []; },
    'foreign verified commit': (index) => { index.verified_commit_sha = 'f'.repeat(40); },
    'no verification report': (index) => { index.files = index.files.filter((entry) => entry.path !== 'verification-report.md'); },
    'no stage manifest': (index) => { index.files = index.files.filter((entry) => !entry.path.startsWith('handoff-manifest-sdd-')); },
  };
  for (const [label, mutate] of Object.entries(variants)) {
    const index = JSON.parse(JSON.stringify(original));
    mutate(index);
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
    assert.equal(validateClosureIndex('example', { cwd }).ok, false, label);
  }
  assert.ok(change);
});

test('Issue 23: retention refuses to publish a closure without every gate report', () => {
  const { cwd, change, rawDestination } = fixture();
  fs.unlinkSync(path.join(change, 'security-report.md'));
  assert.throws(() => retainEvidence('example', { cwd, rawDestination, delivery: merged }), /complete evidence chain; missing: security-report\.md/);
  assert.equal(fs.existsSync(path.join(cwd, 'openspec/archive/example')), false);
});
