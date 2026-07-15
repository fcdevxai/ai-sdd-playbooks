import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

function packedFiles() {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO_ROOT }).toString();
  const json = JSON.parse(out);
  return json[0].files.map((f) => f.path);
}

test('npm pack ships exactly the intended top-level dirs (T13.2)', () => {
  const files = packedFiles();
  const included = (prefix) => files.some((f) => f.startsWith(prefix));

  for (const p of ['bin/', 'src/', 'skills/', 'addons/', 'schemas/', 'templates/project/']) {
    assert.ok(included(p), `package should include ${p}`);
  }
  assert.ok(files.includes('package.json'));
  assert.ok(files.some((f) => /^README\.md$/i.test(f)));
});

test('npm pack excludes dev/legacy/consumer artifacts (T13.2)', () => {
  const files = packedFiles();
  for (const p of ['node_modules/', 'test/', 'playbooks/', 'dist/', 'legacy/', 'scripts/', 'openspec/', 'templates/docs/', 'templates/claude/']) {
    assert.ok(!files.some((f) => f.startsWith(p)), `package must not include ${p}`);
  }
});
