/**
 * Provenance guards (Fase 1.5 / ADR-026): the specloom decision records and
 * runtime-dir identity must stay migrated and non-dangling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runsDir } from '../src/tokens/run.js';
import { defaultSpecIndexPath } from '../src/tokens/spec-index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkJs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkJs(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const SRC_FILES = walkJs(path.join(ROOT, 'src'));
const rel = (f) => path.relative(ROOT, f);

test('no dangling specloom source-path refs in src/ (framework/cli/lib.js)', () => {
  const offenders = SRC_FILES.filter((f) => fs.readFileSync(f, 'utf8').includes('framework/cli/lib.js'));
  assert.deepEqual(offenders.map(rel), []);
});

test('every ADR-NNN cited in src/ exists as a promoted ADR', () => {
  const adrDir = path.join(ROOT, 'openspec', 'specs', 'adr');
  const adrFiles = fs.readdirSync(adrDir);
  const text = SRC_FILES.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const cited = [...new Set([...text.matchAll(/ADR-(\d{3})/g)].map((m) => m[1]))];
  const missing = cited.filter((n) => !adrFiles.some((f) => f.startsWith(`ADR-${n}-`)));
  assert.deepEqual(missing, [], `ADRs cited in src/ but not present: ${missing.join(', ')}`);
});

test('runtime dir is .specloom/ (retained by ADR-026), not .playbook/', () => {
  assert.ok(runsDir('/x').endsWith(path.join('.specloom', 'runs')), 'runs under .specloom/');
  assert.ok(defaultSpecIndexPath('/x').includes(path.join('.specloom', 'index')), 'index under .specloom/');
  // The install stamp .playbook-version is allowed; a .playbook/ runtime dir is not.
  const bad = SRC_FILES.filter((f) => /\.playbook\//.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(bad.map(rel), []);
});
