import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const readme = fs.readFileSync(REPO_ROOT + 'README.md', 'utf8');

function installSection(text) {
  const start = text.indexOf('## Install (global, once)');
  assert.notEqual(start, -1, 'README must have an "## Install (global, once)" section');
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

test('README documents the real acquisition command in the install section (AC-4)', () => {
  const section = installSection(readme);
  assert.match(section, /npm install -g github:lablab-outplacement\/lablab-playbook-ai-v2#semver:/);
});

test('README notes the repo is private and requires git access configured (AC-5)', () => {
  const section = installSection(readme);
  assert.match(section, /private/i);
  assert.match(section, /SSH|PAT/);
});
