import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Each acceptance criterion (proposal.md) maps to at least one automated test.
const AC_COVERAGE = {
  'AC-01': 'test/dispatch.test.js', // command surface / --help
  'AC-02': 'test/install.test.js', // global install, no consumer files
  'AC-03': 'test/init.test.js', // init fresh + idempotent
  'AC-04': 'test/init.test.js', // doc adoption
  'AC-05': 'test/doctor.test.js', // doctor read-only + --fix
  'AC-06': 'test/lifecycle-cli.test.js', // status two dimensions
  'AC-07': 'test/engine.test.js', // next combines dimensions
  'AC-08': 'test/preconditions.test.js', // precondition refusal
  'AC-09': 'test/schema.test.js', // normalized statuses / legal subsets
  'AC-10': 'test/validate.cli.test.js', // validate --ci, no grep, no mutation
  'AC-11': 'test/adapters.test.js', // incomplete adapters block
  'AC-12': 'test/security.test.js', // security classification + disclaimer
  'AC-13': 'test/migrate.test.js', // migrate diff-then-confirm
  'AC-14': 'test/install.test.js', // add-on opt-in only
  'AC-15': 'test/skill-contract.test.js', // sdd-bootstrap-project diff-then-approve
  'AC-16': 'test/sync.test.js', // legacy byte-stable / preserved
  'AC-17': 'test/delivery.test.js', // delivery unknown, never assumed
  'AC-18': 'test/skill-contract.test.js', // sdd-commit no hardcode / no auto-merge
  'AC-19': 'test/lock.test.js', // compatible range + resolved
  'AC-20': 'test/skill-contract.test.js', // sdd-ff deprecated, no silent alias
  'AC-21': 'test/config.test.js', // require_pr / require_ci const true
};

test('every acceptance criterion AC-01..AC-21 has a mapped test that exists', () => {
  const keys = Object.keys(AC_COVERAGE);
  assert.equal(keys.length, 21);
  for (let i = 1; i <= 21; i++) {
    const ac = `AC-${String(i).padStart(2, '0')}`;
    assert.ok(AC_COVERAGE[ac], `${ac} must be mapped`);
    const file = fileURLToPath(new URL(`../${AC_COVERAGE[ac]}`, import.meta.url));
    assert.ok(fs.existsSync(file), `${AC_COVERAGE[ac]} must exist for ${ac}`);
  }
});
