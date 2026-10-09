/**
 * Independent closure audit (round 7): each probe asserts the safe behaviour.
 */
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

import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import { computeLifecycle, computeState } from '../src/lifecycle/engine.js';
import { createHash } from 'node:crypto';

const h = (buf) => createHash('sha256').update(buf).digest('hex');
const archiveOf = (cwd) => path.join(cwd, 'openspec/archive/example');
function rewriteIndex(cwd, mutate) {
  const file = path.join(archiveOf(cwd), 'closure-index.json');
  const index = JSON.parse(fs.readFileSync(file, 'utf8'));
  mutate(index);
  fs.writeFileSync(file, JSON.stringify(index, null, 2) + '\n');
}
function rehash(cwd, name) {
  const bytes = fs.readFileSync(path.join(archiveOf(cwd), name));
  rewriteIndex(cwd, (index) => { for (const e of index.files) if (e.path === name) e.sha256 = h(bytes); });
}

test('AUDIT-1 altered archived proposal (manifest re-pinned, index re-hashed) must not validate against the retained receipt', () => {
  const { cwd, change, rawDestination } = fixture();
  retainEvidence('example', { cwd, rawDestination, delivery: merged });
  fs.rmSync(change, { recursive: true });
  const archive = archiveOf(cwd);
  fs.writeFileSync(path.join(archive, 'proposal.md'), '---\nschema: proposal\nstatus: approved\n---\n# Something never verified\n');
  const manifestFile = path.join(archive, 'handoff-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.requirement.hash = h(fs.readFileSync(path.join(archive, 'proposal.md')));
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  rehash(cwd, 'proposal.md'); rehash(cwd, 'handoff-manifest.json');
  assert.equal(validateClosureIndex('example', { cwd }).ok, false);
});

test('AUDIT-2 archived verification report rewritten to status failed must not validate', () => {
  const { cwd, change, rawDestination } = fixture();
  retainEvidence('example', { cwd, rawDestination, delivery: merged });
  fs.rmSync(change, { recursive: true });
  const file = path.join(archiveOf(cwd), 'verification-report.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('status: passed', 'status: failed').replace('delivery_state: merged', 'delivery_state: pr_open'));
  rehash(cwd, 'verification-report.md');
  assert.equal(validateClosureIndex('example', { cwd }).ok, false);
});

test('AUDIT-3 retention refuses a closure whose security report is failed', () => {
  const { cwd, change, rawDestination } = fixture();
  fs.writeFileSync(path.join(change, 'security-report.md'), '---\nschema: security-report\nstatus: failed\n---\n# Blocking finding\n');
  assert.throws(() => retainEvidence('example', { cwd, rawDestination, delivery: merged }));
  assert.equal(fs.existsSync(archiveOf(cwd)), false);
});

test('AUDIT-4 a failed active security gate never yields an archived lifecycle from closure', () => {
  const { cwd, change, rawDestination } = fixture();
  retainEvidence('example', { cwd, rawDestination, delivery: merged });
  fs.writeFileSync(path.join(change, 'security-report.md'), '---\nschema: security-report\nstatus: failed\n---\n# Blocking finding\n');
  const read = (n) => ({ frontmatter: yaml.load(fs.readFileSync(path.join(change, n), 'utf8').split('---\n')[1]) });
  const artifacts = Object.fromEntries(['proposal.md', 'design.md', 'tasks.md', 'code-review-report.md', 'security-report.md', 'runtime-gate-report.md', 'verification-report.md'].map((n) => [n, read(n)]));
  const evidence = inspectEvidence('example', { cwd, config: { version: 2, repos: { hub: { role: 'sdd', path: '.' } } }, artifacts, delivery: merged });
  const lifecycle = computeLifecycle({ version: 2, repos: { hub: { role: 'sdd', path: '.' } } }, artifacts, merged, evidence);
  const st = computeState({ version: 2, repos: { hub: { role: 'sdd', path: '.' } } }, null, artifacts, merged, evidence);
  assert.notEqual(lifecycle.state, 'archived', `next=${JSON.stringify(st.next).slice(0,80)} closure.ok=${evidence.closure.ok} issues=${evidence.issues.join(' | ')}`);
});

test('AUDIT-5 a symlinked --cwd cannot place raw evidence inside the project (the active change)', () => {
  const { cwd, change, rawDestination } = fixture();
  const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-link-')), 'proj');
  fs.symlinkSync(cwd, link);
  const inside = path.join(change, 'private-raw');
  let threw = false;
  try { retainEvidence('example', { cwd: link, rawDestination: inside, delivery: merged }); } catch { threw = true; }
  const leaked = fs.existsSync(path.join(inside, 'example/run-1/full.log'));
  assert.ok(threw && !leaked, `retention accepted a raw destination inside the repository (leaked=${leaked}); validates=${validateClosureIndex('example', { cwd: link }).ok}`);
  assert.ok(rawDestination);
});

test('AUDIT-6 raw streams sharing a basename are all retained or retention refuses', () => {
  const { cwd, rawDestination, receipt, change } = fixture();
  const runDir = path.dirname(receipt);
  fs.mkdirSync(path.join(runDir, 'sub'));
  fs.writeFileSync(path.join(runDir, 'sub/full.log'), 'stdout bytes\n');
  const record = JSON.parse(fs.readFileSync(receipt, 'utf8'));
  const b = fs.readFileSync(path.join(runDir, 'sub/full.log'));
  record.raw.stdout = { path: 'sub/full.log', bytes: b.length, sha256: h(b) };
  fs.writeFileSync(receipt, JSON.stringify(record));
  const vfile = path.join(change, 'verification-report.md');
  fs.writeFileSync(vfile, fs.readFileSync(vfile, 'utf8').replace(/sha256: [a-f0-9]{64}/, `sha256: ${h(fs.readFileSync(receipt))}`));
  let published = false;
  try { retainEvidence('example', { cwd, rawDestination, delivery: merged }); published = true; } catch (e) { /* refusal is safe */ void e; }
  if (published) assert.deepEqual(validateClosureIndex('example', { cwd }).issues, [], 'retention published a closure that does not validate');
});

test('AUDIT-7 a symlinked openspec/archive cannot place the closure inside the active change', () => {
  const { cwd, change, rawDestination } = fixture();
  fs.mkdirSync(path.join(change, 'hidden'));
  fs.symlinkSync(path.join(change, 'hidden'), path.join(cwd, 'openspec/archive'));
  let threw = false;
  try { retainEvidence('example', { cwd, rawDestination, delivery: merged }); } catch { threw = true; }
  const insideChange = fs.existsSync(path.join(change, 'hidden/example/closure-index.json'));
  const ok = validateClosureIndex('example', { cwd }).ok;
  assert.ok(threw && !insideChange, `retention published the closure inside the active change (validates=${ok})`);
});

test('AUDIT-8 malformed indexes never crash validation', () => {
  const { cwd, rawDestination } = fixture();
  retainEvidence('example', { cwd, rawDestination, delivery: merged });
  const file = path.join(archiveOf(cwd), 'closure-index.json');
  const original = fs.readFileSync(file, 'utf8');
  for (const body of ['null', '[]', '{', '"x"', JSON.stringify({ ...JSON.parse(original), restricted_raw: [{ original_reference: '.specloom/runs/run-1/execution-receipt.json', reference: 5, sha256: 'a'.repeat(64), limitation: 'x' }] }),
    JSON.stringify({ ...JSON.parse(original), raw_root: 7 }), JSON.stringify({ ...JSON.parse(original), files: [{ path: {}, sha256: 1 }] })]) {
    fs.writeFileSync(file, body);
    const r = validateClosureIndex('example', { cwd });
    assert.equal(r.ok, false, body.slice(0, 40));
  }
});

test('AUDIT-9 rejected: raw symlink inside run dir, empty per_repo delivery, raw destination inside repo, existing destination', () => {
  const a = fixture();
  const runDir = path.dirname(a.receipt);
  fs.renameSync(a.raw, path.join(runDir, 'real.log')); fs.symlinkSync('real.log', a.raw);
  assert.throws(() => retainEvidence('example', { cwd: a.cwd, rawDestination: a.rawDestination, delivery: merged }));
  const b = fixture();
  assert.throws(() => retainEvidence('example', { cwd: b.cwd, rawDestination: b.rawDestination, delivery: { state: 'merged', per_repo: [] } }), /merged/);
  const c = fixture();
  assert.throws(() => retainEvidence('example', { cwd: c.cwd, rawDestination: path.join(c.cwd, 'raw'), delivery: merged }), /outside/);
  const d = fixture();
  fs.mkdirSync(path.join(d.rawDestination, 'example'));
  assert.throws(() => retainEvidence('example', { cwd: d.cwd, rawDestination: d.rawDestination, delivery: merged }), /already exists/);
  assert.equal(fs.existsSync(d.change), true);
});

test('AUDIT-10 rejected: archived proposal without closure, closure of another change id', () => {
  const { cwd, change, rawDestination } = fixture();
  const artifacts = { 'proposal.md': { frontmatter: { status: 'archived' } } };
  const evidence = inspectEvidence('example', { cwd, config: {}, artifacts, delivery: merged });
  assert.match(evidence.issues.join(' '), /archived proposal has no valid retained post-merge closure/);
  retainEvidence('example', { cwd, rawDestination, delivery: merged });
  fs.cpSync(archiveOf(cwd), path.join(cwd, 'openspec/archive/other'), { recursive: true });
  assert.equal(validateClosureIndex('other', { cwd }).ok, false);
  assert.ok(change);
});
