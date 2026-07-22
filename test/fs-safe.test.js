import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeIfMissing, writeFileSafe, copyIfMissing, confirmationToken, renderDiff, ensureDir } from '../src/util/fs-safe.js';
import { satisfies, compare } from '../src/util/semver.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-fs-')); }

test('writeIfMissing creates then skips (never overwrites)', () => {
  const dir = tmp();
  const f = path.join(dir, 'a.txt');
  assert.equal(writeIfMissing(f, 'one').action, 'created');
  assert.equal(writeIfMissing(f, 'two').action, 'skipped');
  assert.equal(fs.readFileSync(f, 'utf8'), 'one'); // unchanged
});

test('writeFileSafe refuses to overwrite without a matching token', () => {
  const dir = tmp();
  const f = path.join(dir, 'b.txt');
  fs.writeFileSync(f, 'orig');
  assert.throws(() => writeFileSafe(f, 'new'), /without a confirmation token/);
  assert.equal(fs.readFileSync(f, 'utf8'), 'orig');
  const r = writeFileSafe(f, 'new', { confirm: confirmationToken(f) });
  assert.equal(r.action, 'overwritten');
  assert.equal(fs.readFileSync(f, 'utf8'), 'new');
});

test('copyIfMissing does not overwrite an existing file', () => {
  const dir = tmp();
  const src = path.join(dir, 'src.txt');
  const dest = path.join(dir, 'dest.txt');
  fs.writeFileSync(src, 'from-src');
  fs.writeFileSync(dest, 'keep-me');
  assert.equal(copyIfMissing(src, dest).action, 'skipped');
  assert.equal(fs.readFileSync(dest, 'utf8'), 'keep-me');
});

test('ensureDir is idempotent', () => {
  const dir = tmp();
  const d = path.join(dir, 'x', 'y');
  assert.equal(ensureDir(d).action, 'created');
  assert.equal(ensureDir(d).action, 'skipped');
});

test('renderDiff shows removed and added lines', () => {
  const d = renderDiff('a\nb\nc\n', 'a\nX\nc\n');
  assert.match(d, /- b/);
  assert.match(d, /\+ X/);
});

test('semver satisfies handles the compatibility range form (C-08)', () => {
  assert.equal(satisfies('2.0.5', '>=2.0.0 <3.0.0'), true);
  assert.equal(satisfies('3.0.0', '>=2.0.0 <3.0.0'), false);
  assert.equal(satisfies('1.9.9', '>=2.0.0 <3.0.0'), false);
  assert.equal(compare('2.0.10', '2.0.9'), 1);
});
