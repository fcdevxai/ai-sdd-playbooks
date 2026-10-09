/**
 * Adversarial probes (Amendment R5 rule 1 / item 4): malformed sealed evidence must be a
 * reported violation, never an uncaught exception of validate/status/next.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import matter from '../src/util/frontmatter.js';
import { EXIT } from '../src/cli/dispatch.js';
import { validateClosureIndex } from '../src/tokens/retention.js';
import { boundFlow, cli, cloneOf } from './helpers/evidence-fixture.js';

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };
const editReport = (change, name, mutate) => {
  const file = path.join(change, name);
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  mutate(parsed.data.source_binding);
  fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
};

for (const [label, mutate] of [
  ['receipts is an object', (source) => { source.receipts = { a: 1 }; }],
  ['a repository entry is null', (source) => { source.repositories = [null]; }],
]) {
  test(`C1: sealed report whose source_binding ${label} is reported, not a crash`, async () => {
    const state = await boundFlow();
    const { cwd, git, change } = state;
    editReport(change, 'security-report.md', mutate);
    commit(git, 'malformed source binding');
    for (const args of [['validate', '--ci', '--cwd', cloneOf(cwd)], ['validate', '--json', '--cwd', cwd], ['status', 'demo', '--json', '--cwd', cwd], ['next', 'demo', '--json', '--cwd', cwd]]) {
      let result = null;
      let crash = null;
      try {
        result = await cli(args);
      } catch (error) {
        crash = error;
      }
      assert.equal(crash, null, `${args[0]} crashed: ${crash?.message}`);
      if (args[0] === 'validate') assert.notEqual(result.code, EXIT.OK);
    }
  });
}

test('C2: the closure index never makes validation read or hash a file outside the project root', async () => {
  const state = await boundFlow();
  const { cwd } = state;
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-attack-closure-'));
  const outside = path.join(outsideDir, 'secret.txt');
  fs.writeFileSync(outside, 'guess-me\n');
  const archive = path.join(cwd, 'openspec', 'archive', 'demo');
  fs.mkdirSync(archive, { recursive: true });
  fs.writeFileSync(path.join(archive, 'OWNER.md'), 'x\n');
  const index = (guess) => ({
    schema: 'closure-index', schema_version: 1, change_id: 'demo', verified_commit_sha: 'a'.repeat(40),
    reference_rebase: { from: 'openspec/changes/demo/', to: 'openspec/archive/demo/' },
    files: [{ path: 'OWNER.md', sha256: createHash('sha256').update('x\n').digest('hex') }],
    restricted_raw: [{ original_reference: '.specloom/runs/r/full.log', reference: outside,
      sha256: createHash('sha256').update(guess).digest('hex'), limitation: 'probe' }],
    created_at: '2026-10-08T00:00:00Z',
  });
  fs.writeFileSync(path.join(archive, 'closure-index.json'), JSON.stringify(index('wrong\n')));
  const wrong = validateClosureIndex('demo', { cwd });
  fs.writeFileSync(path.join(archive, 'closure-index.json'), JSON.stringify(index('guess-me\n')));
  const right = validateClosureIndex('demo', { cwd });
  assert.equal(right.ok, wrong.ok, `closure validation is an oracle over ${outside}: right=${JSON.stringify(right)} wrong=${JSON.stringify(wrong)}`);
});

test('C3: a dangling symlink under openspec/changes is reported, not a crash of validate/status', async () => {
  const state = await boundFlow();
  const { cwd } = state;
  fs.symlinkSync('/nonexistent-playbook-attack-target', path.join(cwd, 'openspec', 'changes', 'broken'));
  for (const args of [['validate', '--json', '--cwd', cwd], ['status', 'demo', '--json', '--cwd', cwd]]) {
    let crash = null;
    try {
      await cli(args);
    } catch (error) {
      crash = error;
    }
    assert.equal(crash, null, `${args[0]} crashed: ${crash?.message}`);
  }
});

test('C4: a binding carrying an unrecognised top-level field ("__proto__") differs from the recomputed binding (R4)', async () => {
  const state = await boundFlow();
  const { cwd, git, change } = state;
  const name = fs.readdirSync(change).find((file) => file.startsWith('evidence-binding-code-review-report-hub-'));
  const file = path.join(change, name);
  const text = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, text.replace(/^\{\n/, '{\n  "__proto__": {},\n'));
  assert.match(fs.readFileSync(file, 'utf8'), /__proto__/);
  commit(git, 'unknown field');
  const strict = await cli(['validate', '--json', '--cwd', cwd]);
  assert.notEqual(strict.code, EXIT.OK, 'an unrecognised binding field was accepted');
});
