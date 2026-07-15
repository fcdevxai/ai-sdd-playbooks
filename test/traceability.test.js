import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Each current product capability maps to at least one automated test that exists.
// (Capability-keyed for 3.0 — no legacy/migrate/sdd-ff entries.)
const COVERAGE = {
  'command-surface': 'test/dispatch.test.js',
  'global-install': 'test/install.test.js',
  'runtime-flag': 'test/install.test.js',
  'add-on-opt-in': 'test/install.test.js',
  'project-init': 'test/init.test.js',
  doctor: 'test/doctor.test.js',
  'status-two-dimensions': 'test/lifecycle-cli.test.js',
  'lifecycle-next': 'test/engine.test.js',
  preconditions: 'test/preconditions.test.js',
  schemas: 'test/schema.test.js',
  'validate-ci': 'test/validate.cli.test.js',
  'runtime-adapters': 'test/adapters.test.js',
  security: 'test/security.test.js',
  'skill-contract': 'test/skill-contract.test.js',
  delivery: 'test/delivery.test.js',
  'lock-range': 'test/lock.test.js',
  config: 'test/config.test.js',
  'capability-detect': 'test/detect-capabilities.test.js',
  'fs-safe': 'test/fs-safe.test.js',
  'package-contents': 'test/publish.test.js',
  e2e: 'test/e2e.test.js',
};

test('every product capability maps to a test that exists', () => {
  const entries = Object.entries(COVERAGE);
  assert.ok(entries.length >= 15);
  for (const [cap, rel] of entries) {
    const file = fileURLToPath(new URL(`../${rel}`, import.meta.url));
    assert.ok(fs.existsSync(file), `${cap} → ${rel} must exist`);
  }
});
