/**
 * Adversarial probes (Amendment R5 rules 6/7): delivered evaluation and checkout context.
 * Each test asserts the EXPECTED (secure) behaviour; a failing test is a confirmed finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import matter from '../src/util/frontmatter.js';
import { EXIT } from '../src/cli/dispatch.js';
import { commitTreeDigest } from '../src/tokens/evidence.js';
import { boundFlow, cli, cloneOf, gatedFixture, GATES } from './helpers/evidence-fixture.js';

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };
const parse = (result) => { try { return JSON.parse(result.out); } catch { return { failed: 'unparsable' }; } };
const mergeIntoMain = (git) => {
  git('branch', 'main', git('rev-list', '--max-parents=0', 'HEAD').split('\n')[0]);
  git('checkout', '-q', 'main');
  git('merge', '-q', '--no-ff', '-m', 'merge demo', 'demo');
};

test('A1: report source_binding.repositories contradicting its pinned stage manifest is rejected on the base branch (validate --ci)', async () => {
  // Gates sealed on reviewed content X; unreviewed content committed; no binding possible.
  const state = await gatedFixture();
  const { cwd, git, change } = state;
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 666; // never reviewed\n');
  commit(git, 'unreviewed implementation');
  const evil = git('rev-parse', 'HEAD');
  const digest = commitTreeDigest({ root: cwd, commit: evil, changeId: 'demo' });
  // Forge only the report's own repository entry; the stage manifest it pins keeps the reviewed tree_hash.
  for (const [, , reportName] of GATES) {
    const file = path.join(change, reportName);
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    parsed.data.source_binding.repositories[0].commit_sha = evil;
    parsed.data.source_binding.repositories[0].tree_hash = digest;
    fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  }
  commit(git, 'forge report repository identity');
  mergeIntoMain(git);
  const result = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.notEqual(result.code, EXIT.OK, `provable chain break accepted on main:\n${result.out}`);
});

test('A1b (control): the same forgery on the change branch is rejected by validate --ci', async () => {
  const state = await gatedFixture();
  const { cwd, git, change } = state;
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 666;\n');
  commit(git, 'unreviewed implementation');
  const evil = git('rev-parse', 'HEAD');
  const digest = commitTreeDigest({ root: cwd, commit: evil, changeId: 'demo' });
  for (const [, , reportName] of GATES) {
    const file = path.join(change, reportName);
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    parsed.data.source_binding.repositories[0].commit_sha = evil;
    parsed.data.source_binding.repositories[0].tree_hash = digest;
    fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
  }
  commit(git, 'forge');
  const result = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.notEqual(result.code, EXIT.OK, result.out);
});

test('A2: a non-base branch that re-points github.base_branch at itself is not judged as delivered (validate --ci)', async () => {
  const state = await boundFlow();
  const { cwd, git } = state;
  git('checkout', '-q', '-b', 'evil');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 666; // never reviewed\n');
  const configFile = path.join(cwd, 'playbook.config.yaml');
  fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf8').replace('base_branch: main', 'base_branch: evil'));
  commit(git, 'unreviewed change + base re-pointed');
  const result = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  const out = parse(result);
  assert.notEqual(result.code, EXIT.OK,
    `branch "evil" with unreviewed code accepted as delivered; after_delivery=${JSON.stringify(out.after_delivery?.map((e) => e.check))}`);
});

test('A2b: a pull-request head named like the base, checked out as pull-request CI does (by commit), is not judged as delivered', async () => {
  const state = await boundFlow();
  const { cwd, git } = state;
  git('checkout', '-q', '-b', 'main'); // e.g. a fork's main used as PR head; not the real base branch
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 666; // never reviewed\n');
  commit(git, 'unreviewed change on a branch named main');
  const head = git('rev-parse', 'HEAD');
  // Pull-request CI checks out the head commit, never a branch name (design Amendment R5, rule 6).
  const clone = cloneOf(cwd);
  execFileSync('git', ['checkout', '-q', '--detach', head], { cwd: clone });
  const result = await cli(['validate', '--ci', '--cwd', clone]);
  assert.notEqual(result.code, EXIT.OK, `unreviewed content on a pull-request head named like the base passes:\n${result.out.slice(0, 1500)}`);
});
