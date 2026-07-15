import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, EXIT } from '../src/cli/dispatch.js';
import { detectLegacy } from '../src/cli/migrate.js';

function legacyConsumer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-legacy-'));
  fs.mkdirSync(path.join(dir, '.ai-sdd-playbooks'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.claude', 'commands'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'commands', 'sdd-apply.md'), '# legacy command\n');
  fs.writeFileSync(path.join(dir, 'sync-playbooks.sh'), '#!/usr/bin/env bash\n');
  return dir;
}
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}
const has = (d, rel) => fs.existsSync(path.join(d, rel));

test('detectLegacy recognizes 1.x signals', () => {
  const dir = legacyConsumer();
  const d = detectLegacy(dir);
  assert.equal(d.isLegacy, true);
  assert.equal(d.signals.submodule, true);
  assert.equal(d.signals.claudeCommands, true);
  assert.equal(d.signals.syncScript, true);
});

test('migrate dry-run shows the plan and writes nothing (C-13)', async () => {
  const dir = legacyConsumer();
  const { io, out } = capture();
  const code = await run(['migrate', '--json', '--cwd', dir], io);
  assert.equal(code, EXIT.OK);
  const res = JSON.parse(out.join('\n'));
  assert.equal(res.dryRun, true);
  assert.equal(res.applied, false);
  assert.equal(res.legacy.isLegacy, true);
  assert.ok(res.plan.created.includes('sdd.config.yaml'));
  assert.equal(has(dir, 'sdd.config.yaml'), false); // nothing written
});

test('migrate --yes applies the plan and leaves legacy files intact (AC-13/AC-16)', async () => {
  const dir = legacyConsumer();
  await run(['migrate', '--yes', '--cwd', dir], capture().io);
  // 2.0 structure created
  assert.ok(has(dir, 'sdd.config.yaml'));
  assert.ok(has(dir, 'sdd.lock'));
  assert.ok(has(dir, 'AGENTS.md'));
  assert.ok(has(dir, '.github/workflows/sdd-validation.yml'));
  // legacy preserved
  assert.ok(has(dir, '.ai-sdd-playbooks'));
  assert.ok(has(dir, '.claude/commands/sdd-apply.md'));
  assert.ok(has(dir, 'sync-playbooks.sh'));
});

test('migrate on a non-legacy repo still scaffolds 2.0', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-fresh-'));
  const { io, out } = capture();
  await run(['migrate', '--json', '--cwd', dir], io);
  const res = JSON.parse(out.join('\n'));
  assert.equal(res.legacy.isLegacy, false);
  assert.ok(res.plan.created.includes('sdd.config.yaml'));
});
