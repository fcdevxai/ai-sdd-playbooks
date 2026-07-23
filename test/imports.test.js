/**
 * Import-resolution regression guard.
 *
 * A single extensionless package import — `import ... from 'ajv/dist/2020'`
 * instead of `'ajv/dist/2020.js'` — throws ERR_MODULE_NOT_FOUND under strict
 * ESM (Node >= 20) and took the entire schema/config/validate/adr/tokens/repos
 * stack down with it (13 test files failed at load, silently, before any
 * assertion). This test dynamically imports the top module of every subsystem;
 * because ESM resolves the full transitive import graph eagerly, a broken
 * import anywhere under these entrypoints fails here with a clear message.
 *
 * bin/playbook.js is intentionally excluded — it invokes run() and process.exit
 * at load, which is not an importable side-effect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ENTRYPOINTS = [
  '../src/cli/dispatch.js', // transitively loads every command → repos, tokens, adr, github, lifecycle, schema, config, install
  '../src/schema/load.js', // the module that broke — ajv draft-2020 loader (canary)
  '../src/schema/validate.js',
  '../src/schema/body-rules.js',
  '../src/lifecycle/engine.js',
  '../src/github/index.js',
  '../src/repos/plan.js',
  '../src/repos/gate-check.js',
  '../src/repos/contract-drift.js',
  '../src/tokens/packet.js',
  '../src/tokens/spec-index.js',
  '../src/adr/promote.js',
  '../src/config/config.js',
  '../src/install/skills.js',
];

for (const entry of ENTRYPOINTS) {
  test(`resolves and imports ${entry}`, async () => {
    await assert.doesNotReject(
      () => import(entry),
      `${entry} (or something it imports) failed to resolve — likely an extensionless or wrong-path import`,
    );
  });
}
