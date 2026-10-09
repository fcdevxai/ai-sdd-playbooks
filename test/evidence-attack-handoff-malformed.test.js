/**
 * Independent adversarial probes: malformed artifacts, executable front matter, manifest files.
 * Each test asserts the SAFE behaviour; a failing test is a confirmed finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from '../src/cli/dispatch.js';
import matter from '../src/util/frontmatter.js';
import { loadChange } from '../src/config/artifacts.js';
import { buildHandoffManifest, validateHandoffManifest, writeHandoffManifest } from '../src/tokens/handoff.js';
import { cli, DELIVERY, evidence, gatedFixture } from './helpers/evidence-fixture.js';

const editTasks = (change, from, to) => {
  const file = path.join(change, 'tasks.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(from, to));
};

for (const [label, from, to] of [
  ['null spec entry', '  specs: []\n', '  specs: [null]\n'],
  ['numeric source_paths', '    hub:\n      - src/feature.js\n      - src/link\n', '    hub: 5\n'],
  ['string runtime repositories', 'repositories: [hub], capabilities', 'repositories: 7, capabilities'],
  ['null required skill', '  required_skills: []\n', '  required_skills: [null]\n'],
]) {
  test(`E1 malformed tasks handoff (${label}) is a reported violation, never a crash or a pass`, async () => {
    const { cwd, change } = await gatedFixture();
    editTasks(change, from, to);
    const result = await cli(['validate', '--json', '--cwd', cwd]);
    assert.notEqual(result.code, EXIT.OK);
    assert.notDeepEqual(evidence(cwd, change, DELIVERY.uncommitted).issues, []);
  });
}

for (const [label, content] of [['null', 'null\n'], ['array', '[]\n'], ['string repositories', '{"repositories":"x"}\n']]) {
  test(`E2 malformed handoff-manifest.json (${label}) is a reported violation, never a crash`, async () => {
    const { cwd, change } = await gatedFixture();
    fs.writeFileSync(path.join(change, 'handoff-manifest.json'), content);
    const result = await cli(['validate', '--json', '--cwd', cwd]);
    assert.notEqual(result.code, EXIT.OK);
  });
}

for (const language of ['javascript', 'JavaScript', ' js ', 'JS', 'constructor', 'coffee']) {
  test(`F1 front matter "---${language}" is never evaluated`, async () => {
    globalThis.__auditPwned = false;
    const source = `---${language}\n(globalThis.__auditPwned = true, { status: 'approved' })\n---\n# Body\n`;
    try { matter(source); } catch { /* refusing is safe */ }
    assert.equal(globalThis.__auditPwned, false);
  });
}

test('F2 executable proposal front matter is never evaluated by packet/handoff/loadChange', async () => {
  const { cwd, change } = await gatedFixture();
  globalThis.__auditPwned = false;
  const file = path.join(change, 'proposal.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^---\n/, '---Javascript\n').replace(/^schema: proposal$/m, '(globalThis.__auditPwned = true, {schema: "proposal"})'));
  try { loadChange(change); } catch { /* safe */ }
  try { buildHandoffManifest('demo', { cwd, stage: 'sdd-code-review', agent: 'Codex' }); } catch { /* safe */ }
  await cli(['packet', 'demo', '--stage', 'sdd-code-review', '--agent', 'Codex', '--cwd', cwd]);
  await cli(['validate', '--json', '--cwd', cwd]);
  assert.equal(globalThis.__auditPwned, false);
});

test('G1 an immutable stage manifest that is a directory is refused, not reused', async () => {
  const { cwd, change } = await gatedFixture();
  const manifest = buildHandoffManifest('demo', { cwd, stage: 'sdd-apply', agent: 'Codex' });
  assert.ok(manifest);
  // Pre-create a directory at every plausible stage name is impossible (hash includes created_at); probe the reuse path instead.
  const first = writeHandoffManifest('demo', { cwd, stage: 'sdd-apply', agent: 'Codex' });
  fs.rmSync(first.stagePath);
  fs.mkdirSync(first.stagePath);
  assert.throws(() => writeHandoffManifest('demo', { cwd, stage: 'sdd-apply', agent: 'Codex' }));
});

