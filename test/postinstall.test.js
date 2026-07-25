import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'postinstall.js');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-postinstall-')); }

test('package.json declares exactly one lifecycle script, postinstall, pointing at scripts/postinstall.js, with prepare/preinstall absent (AC-10)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.postinstall, 'node scripts/postinstall.js');
  assert.equal('prepare' in pkg.scripts, false);
  assert.equal('preinstall' in pkg.scripts, false);
  assert.equal('install' in pkg.scripts, false);
  assert.ok(pkg.files.includes('scripts/'));
  assert.ok(fs.existsSync(SCRIPT));
});

test('running scripts/postinstall.js exits 0, prints at most 3 lines, and names `playbook install` (AC-10)', () => {
  const out = execFileSync('node', [SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
  const lines = out.split('\n').filter(Boolean);
  assert.ok(lines.length <= 3, `expected <=3 lines, got ${lines.length}: ${out}`);
  assert.match(out, /playbook install/);
});

test('copied to a directory where its package.json does not resolve, it exits 0 and prints nothing (EC-4)', () => {
  const dir = tmp();
  const copy = path.join(dir, 'postinstall.js');
  fs.copyFileSync(SCRIPT, copy);
  const out = execFileSync('node', [copy], { cwd: dir, encoding: 'utf8' });
  assert.equal(out, '');
});

test('the script source imports nothing from src/, performs no filesystem writes or network calls, and never re-throws (SEC-001)', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(src, /from\s+['"].*\/src\//, 'no import from src/');
  assert.doesNotMatch(src, /writeFile|mkdir|(?<!copy)[Rr]m\(|copyFile|appendFile/, 'no filesystem-write calls');
  assert.doesNotMatch(src, /\bfetch\(|require\(['"]https?['"]\)|require\(['"]net['"]\)|from ['"]node:https?['"]|from ['"]node:net['"]/, 'no network calls');
  assert.match(src, /try\s*{[\s\S]*catch/, 'body is wrapped in try/catch');
  assert.doesNotMatch(src, /catch[^}]*{\s*throw/, 'catch block never re-throws');
});
