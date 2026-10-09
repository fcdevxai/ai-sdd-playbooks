import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshotRepository, hashReference, normativeTasksHash } from '../src/tokens/evidence.js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-source-'));
  execFileSync('git', ['init', '-q', '-b', 'example'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd: root });
  fs.mkdirSync(path.join(root, 'src'));
  fs.mkdirSync(path.join(root, 'openspec/changes/example'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/code.js'), 'export const answer = 1;\n');
  fs.writeFileSync(path.join(root, 'openspec/changes/example/proposal.md'), '# Proposal\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: root });
  return root;
}

test('repository source hash observes tracked and untracked code but excludes derived change evidence', () => {
  const root = fixture();
  const initial = snapshotRepository({ root, changeId: 'example' });
  assert.match(initial.commit_sha, /^[a-f0-9]{40}$/);
  assert.equal(initial.branch, 'example');
  fs.writeFileSync(path.join(root, 'openspec/changes/example/runtime-gate-report.md'), 'result');
  assert.equal(snapshotRepository({ root, changeId: 'example' }).source_hash, initial.source_hash);
  fs.writeFileSync(path.join(root, 'src/new.js'), 'new source');
  assert.equal(snapshotRepository({ root, changeId: 'example' }).source_hash, initial.source_hash);
  assert.notEqual(snapshotRepository({ root, changeId: 'example', untrackedPaths: ['src/new.js'] }).source_hash, initial.source_hash);
  fs.unlinkSync(path.join(root, 'src/new.js'));
  fs.writeFileSync(path.join(root, 'src/code.js'), 'export const answer = 2;\n');
  assert.notEqual(snapshotRepository({ root, changeId: 'example' }).source_hash, initial.source_hash);
});

test('references hash file bytes and reject containment escape or missing files', () => {
  const root = fixture();
  const first = hashReference(root, 'src/code.js');
  fs.appendFileSync(path.join(root, 'src/code.js'), '// changed\n');
  assert.notEqual(hashReference(root, 'src/code.js'), first);
  assert.throws(() => hashReference(root, '../outside'), /outside the project root/);
  assert.throws(() => hashReference(root, 'src/missing.js'), /missing reference/);
});

test('normative task hash ignores execution bookkeeping only', () => {
  const base = '---\nschema: tasks\nstatus: in_progress\n---\n# Tasks\n- **Done**: [ ]\n- **Success criterion**: test\n';
  const complete = base.replace('[ ]', '[x]') + '\n## Execution Report — phase\n\n- Passed.\n';
  assert.equal(normativeTasksHash(base), normativeTasksHash(complete));
  assert.notEqual(normativeTasksHash(base), normativeTasksHash(base.replace('test', 'different test')));
});

function sibling() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-owner-'));
  execFileSync('git', ['init', '-q', '-b', 'owner'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd: root });
  fs.mkdirSync(path.join(root, '.ai/skills/pattern/rules'), { recursive: true });
  fs.writeFileSync(path.join(root, '.ai/skills/pattern/SKILL.md'), '# Pattern\n');
  fs.writeFileSync(path.join(root, '.ai/skills/pattern/rules/a.md'), 'rule a\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'owner'], { cwd: root });
  return root;
}

function aliasTo(root, owner, alias = '.claude/skills/pattern', target = '.ai/skills/pattern') {
  fs.mkdirSync(path.dirname(path.join(root, alias)), { recursive: true });
  fs.symlinkSync(path.relative(path.dirname(path.join(root, alias)), path.join(owner, target)), path.join(root, alias));
}

test('declared untracked alias to an owning repository is inventoried by link identity without reading through it', () => {
  const root = fixture();
  const owner = sibling();
  const before = snapshotRepository({ root, changeId: 'example' });
  aliasTo(root, owner);
  assert.equal(snapshotRepository({ root, changeId: 'example' }).source_hash, before.source_hash);
  const declared = snapshotRepository({ root, changeId: 'example', untrackedPaths: ['.claude/skills/pattern'] });
  assert.notEqual(declared.source_hash, before.source_hash);
  assert.equal(declared.inventory_count, before.inventory_count + 1);
  assert.equal(snapshotRepository({ root, changeId: 'example', untrackedPaths: ['.claude/skills/pattern'] }).source_hash, declared.source_hash);
  // Owning content is not read through the alias; only the link bytes identify it here.
  fs.writeFileSync(path.join(owner, '.ai/skills/pattern/SKILL.md'), '# Pattern changed\n');
  assert.equal(snapshotRepository({ root, changeId: 'example', untrackedPaths: ['.claude/skills/pattern'] }).source_hash, declared.source_hash);
  // Retargeting the alias changes identity.
  fs.unlinkSync(path.join(root, '.claude/skills/pattern'));
  aliasTo(root, owner, '.claude/skills/pattern', '.ai/skills/pattern/rules');
  assert.notEqual(snapshotRepository({ root, changeId: 'example', untrackedPaths: ['.claude/skills/pattern'] }).source_hash, declared.source_hash);
});

test('owning repository snapshot detects canonical and resource mutation behind an alias', () => {
  const owner = sibling();
  const files = ['.ai/skills/pattern/SKILL.md', '.ai/skills/pattern/rules/a.md'];
  const before = snapshotRepository({ root: owner, changeId: 'example', untrackedPaths: files });
  fs.writeFileSync(path.join(owner, files[1]), 'rule a changed\n');
  assert.notEqual(snapshotRepository({ root: owner, changeId: 'example', untrackedPaths: files }).source_hash, before.source_hash);
});

test('declared alias inventory still rejects unsafe descriptors and dangling or escaping parents', () => {
  const root = fixture();
  const owner = sibling();
  aliasTo(root, owner);
  assert.throws(() => snapshotRepository({ root, changeId: 'example', untrackedPaths: ['../outside'] }), /outside the project root/);
  assert.throws(() => snapshotRepository({ root, changeId: 'example', untrackedPaths: [path.join(owner, '.ai/skills/pattern/SKILL.md')] }), /outside the project root/);
  assert.throws(() => snapshotRepository({ root, changeId: 'example', untrackedPaths: ['.env'] }), /excluded/);
  assert.throws(() => snapshotRepository({ root, changeId: 'example', untrackedPaths: ['.claude/skills/missing-alias'] }), /missing/);
  fs.symlinkSync(path.join(owner, '.ai'), path.join(root, 'escape'));
  assert.throws(() => snapshotRepository({ root, changeId: 'example', untrackedPaths: ['escape/skills/pattern/SKILL.md'] }), /outside the project root/);
  fs.symlinkSync(path.join(owner, '.ai/skills/pattern'), path.join(owner, '.ai/inner-alias'));
  assert.throws(() => snapshotRepository({ root, changeId: 'example', untrackedPaths: ['escape/inner-alias'] }), /outside the project root/);
  fs.symlinkSync(path.join(owner, '.ai/skills/gone'), path.join(root, 'dangling'));
  assert.throws(() => snapshotRepository({ root, changeId: 'example', untrackedPaths: ['dangling'] }), /missing/);
});

test('canonical reference reads through an alias outside the root remain rejected', () => {
  const root = fixture();
  const owner = sibling();
  aliasTo(root, owner);
  assert.throws(() => hashReference(root, '.claude/skills/pattern/SKILL.md'), /outside the project root/);
});

import { commitTreeDigest } from '../src/tokens/evidence.js';

function commitAll(root, message = 'commit') {
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-qm', message], { cwd: root });
}

test('the reviewed tree digest equals the digest of the same bytes once committed', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'src/new.js'), 'new source');
  fs.writeFileSync(path.join(root, 'src/tool.sh'), '#!/bin/sh\n', { mode: 0o775 });
  fs.symlinkSync('code.js', path.join(root, 'src/link'));
  fs.writeFileSync(path.join(root, 'src/code.js'), 'export const answer = 2;\n');
  fs.unlinkSync(path.join(root, 'openspec/changes/example/proposal.md'));
  const declared = ['src/new.js', 'src/tool.sh', 'src/link'];
  const reviewed = snapshotRepository({ root, changeId: 'example', untrackedPaths: declared });
  assert.match(reviewed.tree_hash, /^[a-f0-9]{64}$/);
  const dirty = snapshotRepository({ root, changeId: 'example', untrackedPaths: declared });
  assert.equal(dirty.tree_hash, reviewed.tree_hash);
  commitAll(root);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  assert.equal(commitTreeDigest({ root, commit: head, changeId: 'example' }), reviewed.tree_hash);
  assert.equal(snapshotRepository({ root, changeId: 'example' }).tree_hash, reviewed.tree_hash);
});

test('the committed tree digest changes with content, extra files, partial commits, deletions, modes and links', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'src/new.js'), 'new source');
  const reviewed = snapshotRepository({ root, changeId: 'example', untrackedPaths: ['src/new.js'] });
  const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  const digest = () => commitTreeDigest({ root, commit: head(), changeId: 'example' });

  // Partial commit: the declared untracked file stays out of the commit.
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'partial'], { cwd: root });
  assert.notEqual(digest(), reviewed.tree_hash);
  assert.equal(snapshotRepository({ root, changeId: 'example', untrackedPaths: ['src/new.js'] }).tree_hash, reviewed.tree_hash,
    'the working tree alone cannot prove what the commit recorded');

  // Exact commit matches; an extra undeclared file does not.
  execFileSync('git', ['add', 'src/new.js'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'exact'], { cwd: root });
  assert.equal(digest(), reviewed.tree_hash);
  fs.writeFileSync(path.join(root, 'src/extra.js'), 'unreviewed');
  commitAll(root, 'extra');
  assert.notEqual(digest(), reviewed.tree_hash);

  // Mode and link-target changes are part of the digest.
  const base = digest();
  fs.chmodSync(path.join(root, 'src/new.js'), 0o755);
  commitAll(root, 'mode');
  assert.notEqual(digest(), base);
  fs.symlinkSync('code.js', path.join(root, 'src/link'));
  commitAll(root, 'link');
  const linked = digest();
  fs.unlinkSync(path.join(root, 'src/link'));
  fs.symlinkSync('new.js', path.join(root, 'src/link'));
  commitAll(root, 'retarget');
  assert.notEqual(digest(), linked);

  // A deletion that is not committed differs from one that is.
  const withFile = snapshotRepository({ root, changeId: 'example' });
  fs.unlinkSync(path.join(root, 'src/extra.js'));
  const deletedInTree = snapshotRepository({ root, changeId: 'example' });
  assert.notEqual(deletedInTree.tree_hash, withFile.tree_hash);
  assert.notEqual(digest(), deletedInTree.tree_hash);
  commitAll(root, 'delete');
  assert.equal(digest(), deletedInTree.tree_hash);
});

test('a submodule is governed by the commit it points to, in the working tree and in a commit', () => {
  const root = fixture();
  const sub = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-sub-'));
  execFileSync('git', ['init', '-q', '-b', 'sub'], { cwd: sub });
  execFileSync('git', ['-c', 'user.email=f@example.invalid', '-c', 'user.name=F', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd: sub });
  execFileSync('git', ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub, 'vendor-sub'], { cwd: root });
  commitAll(root, 'submodule');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  const committed = commitTreeDigest({ root, commit: head, changeId: 'example' });
  const working = snapshotRepository({ root, changeId: 'example' });
  assert.match(committed, /^[a-f0-9]{64}$/);
  assert.equal(working.tree_hash, committed, 'the same gitlink commit gives the same governed digest');
  execFileSync('git', ['-c', 'user.email=f@example.invalid', '-c', 'user.name=F', 'commit', '-q', '--allow-empty', '-m', 'y'], { cwd: path.join(root, 'vendor-sub') });
  const moved = snapshotRepository({ root, changeId: 'example' });
  assert.notEqual(moved.source_hash, working.source_hash);
  assert.notEqual(moved.tree_hash, working.tree_hash);
});
