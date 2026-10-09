/** Independent audit probes expected to be rejected (controls of the attack surface). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXIT } from '../src/cli/dispatch.js';
import { boundFlow, cli, cloneOf } from './helpers/evidence-fixture.js';

test('AC1: a base branch containing only the sealed commit (implementation and binding never merged) is not delivered evidence', async () => {
  const { cwd, git } = await boundFlow();
  const sealed = git('rev-list', '--max-parents=0', 'HEAD');
  git('checkout', '-q', '-b', 'main', sealed);
  git('commit', '-q', '--allow-empty', '-m', 'unrelated work on main');
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.notEqual(ci.code, EXIT.OK, ci.out);
  const strict = await cli(['validate', '--json', '--cwd', cwd]);
  assert.notEqual(strict.code, EXIT.OK, strict.out);
});

test('AC2: a binding copied under a sibling report name is not accepted', async () => {
  const { cwd, git, change } = await boundFlow();
  const fs = await import('node:fs');
  const path = await import('node:path');
  const head = git('rev-parse', 'HEAD~1');
  const from = path.join(change, `evidence-binding-security-report-hub-${head}.json`);
  const to = path.join(change, `evidence-binding-code-review-report-hub-${head}.json`);
  fs.copyFileSync(from, to);
  git('add', '-A'); git('commit', '-qm', 'swap');
  const ci = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.notEqual(ci.code, EXIT.OK, ci.out);
});
