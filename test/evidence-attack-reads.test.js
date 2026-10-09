/**
 * Adversarial probes (Amendment R5 rules 4/5): contained reads and front matter handling.
 * Each test asserts the EXPECTED (secure) behaviour; a failing test is a confirmed finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EXIT } from '../src/cli/dispatch.js';
import { boundFlow, cli, cloneOf } from './helpers/evidence-fixture.js';

const commit = (git, message) => { git('add', '-A'); git('commit', '-qm', message); };
const outsideFile = (name, content) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-attack-outside-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
};
const SECRET = 'OUTSIDE_SECRET_7f3a';

test('R1: an ADR draft that is a symlink to a file outside the project is refused before reading (validate --ci)', async () => {
  const state = await boundFlow();
  const { git, change, cwd } = state;
  const target = outsideFile('secret.md', `---\nstatus: ${SECRET}\ndate: 2026-10-08\nticket: X\n---\n# t\n`);
  fs.symlinkSync(target, path.join(change, 'adr-leak.md'));
  commit(git, 'adr symlink');
  const result = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  assert.doesNotMatch(result.out + result.err, new RegExp(SECRET), 'bytes of a file outside the project root were read and echoed');
  assert.match(result.out, /adr-leak\.md[\s\S]*(symbolic link|contained)/i, 'refusal must name the containment rule');
});

test('R2: executable front matter in an ADR draft is a reported violation, not a crash', async () => {
  const state = await boundFlow();
  const { git, change, cwd } = state;
  globalThis.__attackAdrExecuted = false;
  fs.writeFileSync(path.join(change, 'adr-js.md'), '---js\n(globalThis.__attackAdrExecuted = true, {status: "accepted"})\n---\n# ADR\n');
  commit(git, 'adr js');
  let result;
  let crash = null;
  try {
    result = await cli(['validate', '--ci', '--cwd', cloneOf(cwd)]);
  } catch (error) {
    crash = error;
  }
  assert.equal(globalThis.__attackAdrExecuted, false, 'front matter executed');
  assert.equal(crash, null, `validate threw instead of reporting a violation: ${crash?.message}`);
  assert.equal(result.code, EXIT.VIOLATION);
});

test('R3: `playbook packet` refuses a tasks.md symlinked outside the project before reading it', async () => {
  const state = await boundFlow();
  const { change, cwd } = state;
  // Malformed YAML: if the outside bytes are parsed, the YAML error (not a containment refusal) is reported.
  const target = outsideFile('tasks.md', `---\nhandoff: [${SECRET}\n---\n# Tasks\n`);
  fs.unlinkSync(path.join(change, 'tasks.md'));
  fs.symlinkSync(target, path.join(change, 'tasks.md'));
  const result = await cli(['packet', 'demo', '--cwd', cwd, '--stage', 'sdd-commit', '--agent', 'Codex']);
  assert.notEqual(result.code, EXIT.OK);
  assert.match(result.err + result.out, /symbolic link|contained regular file/i,
    `the outside file was parsed before any containment check: ${(result.err + result.out).slice(0, 400)}`);
});

test('R4: status/next never read a proposal.md symlinked outside the project (delivery resolution path)', async () => {
  const state = await boundFlow();
  const { change, cwd } = state;
  const target = outsideFile('proposal.md', '---\nschema: proposal\n---\n# Outside\n## Impacted repos\n- leaked_outside_repo_name\n');
  fs.unlinkSync(path.join(change, 'proposal.md'));
  fs.symlinkSync(target, path.join(change, 'proposal.md'));
  for (const command of ['status', 'next']) {
    const result = await cli([command, 'demo', '--json', '--cwd', cwd]);
    assert.doesNotMatch(result.out, /leaked_outside_repo_name/, `${command} read and used bytes of a file outside the project root`);
  }
});
