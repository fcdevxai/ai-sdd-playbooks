/** Attacks that the implementation correctly rejects (these tests are expected to pass). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from '../src/cli/dispatch.js';
import matter from '../src/util/frontmatter.js';
import { boundFlow, cli, cloneOf, editBinding, REPORT } from './helpers/evidence-fixture.js';

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };
const implementationSha = (git) => git('log', '--format=%H', '-n', '2').split('\n')[1];

test('OK1: uppercase-SHA copy of the latest binding cannot replace it (the lowercase one is corrupt)', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  const sha = implementationSha(git);
  const lower = path.join(change, `evidence-binding-code-review-report-hub-${sha}.json`);
  fs.copyFileSync(lower, path.join(change, `evidence-binding-code-review-report-hub-${sha.toUpperCase()}.json`));
  editBinding(change, REPORT, sha, (r) => { r.governed_hash = '7'.repeat(64); });
  commit(git, 'upper');
  for (const args of [['validate', '--json', '--cwd', cwd], ['validate', '--ci', '--cwd', cloneOf(cwd)]]) {
    assert.notEqual((await cli(args)).code, EXIT.OK);
  }
});

test('OK2: annotated-tag SHA used as a duplicate binding destination does not mask a corrupt latest binding', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  const sha = implementationSha(git);
  git('tag', '-a', 'alias', '-m', 'alias', sha);
  const tagSha = git('rev-parse', 'alias');
  const record = JSON.parse(fs.readFileSync(path.join(change, `evidence-binding-code-review-report-hub-${sha}.json`), 'utf8'));
  record.current_commit_sha = tagSha;
  fs.writeFileSync(path.join(change, `evidence-binding-code-review-report-hub-${tagSha}.json`), JSON.stringify(record, null, 2) + '\n');
  editBinding(change, REPORT, sha, (r) => { r.governed_hash = '7'.repeat(64); });
  commit(git, 'tag alias');
  assert.notEqual((await cli(['validate', '--json', '--cwd', cwd])).code, EXIT.OK);
});

test('OK3: front matter languages other than YAML/JSON are refused and never evaluated', () => {
  globalThis.__attackFm = false;
  for (const lang of ['JS', ' javascript', 'Javascript', 'coffee']) {
    assert.throws(() => matter(`---${lang}\n(globalThis.__attackFm = true, {})\n---\nx`));
  }
  assert.equal(globalThis.__attackFm, false);
});

test('OK4: a binding whose destination commit is absent from complete history does not apply (no fallback)', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  const sha = implementationSha(git);
  const bogus = 'e'.repeat(40);
  fs.renameSync(path.join(change, `evidence-binding-code-review-report-hub-${sha}.json`), path.join(change, `evidence-binding-code-review-report-hub-${bogus}.json`));
  editBinding(change, REPORT, bogus, (r) => { r.current_commit_sha = bogus; });
  commit(git, 'foreign');
  assert.notEqual((await cli(['validate', '--ci', '--cwd', cloneOf(cwd)])).code, EXIT.OK);
});

test('OK5: receipt reference escaping the run store fails validate --ci (not local-only)', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  const file = path.join(change, 'security-report.md');
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  parsed.data.source_binding.receipts[0].path = '.specloom/runs/../../etc/execution-receipt.json';
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  commit(git, 'escape');
  assert.notEqual((await cli(['validate', '--ci', '--cwd', cloneOf(cwd)])).code, EXIT.OK);
});

test('OK6: governed drift on the change branch after binding fails validate --ci and strict', async () => {
  const state = await boundFlow();
  const { cwd, git } = state;
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 5;\n');
  commit(git, 'drift');
  for (const args of [['validate', '--json', '--cwd', cwd], ['validate', '--ci', '--cwd', cloneOf(cwd)], ['validate', '--ci', '--cwd', cloneOf(cwd, { depth: 1 })]]) {
    assert.notEqual((await cli(args)).code, EXIT.OK, args.join(' '));
  }
});
