/**
 * Adversarial probes (Amendment R1 rule 3, R5 rules 1-3): governed inventory and history tricks.
 * Each test asserts the EXPECTED (secure) behaviour; a failing test is a confirmed finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from '../src/cli/dispatch.js';
import { bindEvidence } from '../src/tokens/binding.js';
import { boundFlow, cli, cloneOf, GATES } from './helpers/evidence-fixture.js';

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };

for (const [label, file] of [
  ['a committed source file under a "vendor" directory', 'resources/views/vendor/mail/layout.blade.php'],
  ['a committed source file under a "node_modules" directory', 'web/node_modules/local-lib/index.js'],
  ['a committed file named *.log', 'scripts/deploy.log'],
  ['a committed .env.example', '.env.example'],
]) {
  test(`H1: unreviewed change to ${label} after the gates is rejected (validate --ci)`, async () => {
    const state = await boundFlow();
    const { cwd, git } = state;
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), 'UNREVIEWED PAYLOAD\n');
    commit(git, 'unreviewed change');
    const result = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
    assert.notEqual(result.code, EXIT.OK, `${file} changed after review yet validate --ci is green`);
  });
}

test('H2: replace refs cannot make strict validation accept a HEAD whose committed content was never reviewed', async () => {
  const state = await boundFlow();
  const { cwd, git } = state;
  const reviewed = git('rev-parse', 'HEAD');
  const reviewedCode = fs.readFileSync(path.join(cwd, 'code.js'), 'utf8');
  fs.writeFileSync(path.join(cwd, 'code.js'), 'export const value = 666; // never reviewed\n');
  commit(git, 'unreviewed');
  const evil = git('rev-parse', 'HEAD');
  // Local history trick: substitute the commit object; restore reviewed bytes in the working tree only.
  git('replace', evil, reviewed);
  fs.writeFileSync(path.join(cwd, 'code.js'), reviewedCode);
  // Binding is judged on recorded objects, so the substituted commit cannot be bound.
  for (const [, , report] of GATES) assert.throws(() => bindEvidence('demo', report, { cwd }), /differs from the reviewed snapshot/);
  const committed = git('--no-replace-objects', 'show', `${evil}:code.js`);
  assert.match(committed, /666/, 'precondition: the real HEAD commit holds unreviewed content');
  const result = await cli(['validate', '--json', '--cwd', cwd]);
  assert.notEqual(result.code, EXIT.OK, 'strict validation accepted evidence for a HEAD commit whose real content differs from the reviewed content');
});

test('H1-strict: the same vendor-path drift is rejected by strict validation', async () => {
  const state = await boundFlow();
  const { cwd, git } = state;
  const file = 'resources/views/vendor/mail/layout.blade.php';
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), 'UNREVIEWED PAYLOAD\n');
  commit(git, 'unreviewed change');
  const result = await cli(['validate', '--json', '--cwd', cwd]);
  assert.notEqual(result.code, EXIT.OK, 'strict validation is green with unreviewed vendor-path code');
});
