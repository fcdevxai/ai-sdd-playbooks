import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SELF = 'no-legacy-refs.test.js';

// Surfaces that must carry NO legacy reference after 3.0 (AC-02): source, tests,
// skills, shipped templates, and the shipped docs (README/CHANGELOG). The
// historical openspec/changes/ records and this change's own artifacts are exempt.
const SCAN_DIRS = ['src', 'bin', 'skills', 'addons', 'templates/project', 'test'];
const SCAN_FILES = ['README.md', 'CHANGELOG.md'];
const EXTS = new Set(['.js', '.mjs', '.md', '.json', '.yaml', '.yml']);

// Removed 1.x paths and old terms that must not reappear, plus the pre-rename
// consumer doc paths superseded by the 3.0 alignment (AC-08).
const FORBIDDEN = [
  /playbooks\//, /dist\/claude/, /scripts\/sync/, /--legacy/, /sdd-ff/, /\b1\.x\b/, /deprecat/i,
  /docs\/architecture\.md/, /docs\/verification\.md/,
];

function walk(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (EXTS.has(path.extname(entry.name)) && entry.name !== SELF) out.push(rel);
  }
  return out;
}

test('no source/skill/addon/template/test/shipped-doc file references a removed 1.x path or old term (AC-02)', () => {
  const files = [...SCAN_DIRS.flatMap(walk), ...SCAN_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)))];
  const offenders = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const pat of FORBIDDEN) {
      if (pat.test(text)) offenders.push(`${rel} :: ${pat}`);
    }
  }
  assert.deepEqual(offenders, [], `legacy references remain:\n${offenders.join('\n')}`);
});

test('templates/project survives the legacy purge (R-02 guard)', () => {
  for (const p of ['templates/project', 'templates/project/docs', 'templates/project/sdd.config.yaml']) {
    assert.ok(fs.existsSync(path.join(ROOT, p)), `${p} must survive`);
  }
});
