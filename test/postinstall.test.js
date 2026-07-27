import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

test('package.json declares no npm lifecycle scripts — reintroducing scripts.postinstall requires an ADR superseding adr-remove-postinstall-lifecycle-script.md (AC-3, EC-3, SEC-1)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal('postinstall' in (pkg.scripts || {}), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'scripts', 'postinstall.cjs')), false);
});
