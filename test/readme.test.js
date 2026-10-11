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
  assert.match(section, /npm install -g github:fcdevxai\/ai-sdd-playbooks#semver:/);
});

test('methodology docs require a released global CLI and isolated change worktrees (AC-11)', () => {
  for (const file of ['docs/agent_architecture.md', 'docs/doc_verification_guide.md']) {
    const doc = fs.readFileSync(REPO_ROOT + file, 'utf8');
    for (const phrase of ['global `playbook`', 'release tag', 'detached', 'clean', 'worktree', 'node bin/playbook.js', 'human go']) {
      assert.ok(doc.includes(phrase), `${file} lacks ${phrase}`);
    }
  }
});

test('release version, changelog and CI pins agree at 0.11.0 (AC-14)', () => {
  const pkg = JSON.parse(fs.readFileSync(REPO_ROOT + 'package.json', 'utf8'));
  const lock = JSON.parse(fs.readFileSync(REPO_ROOT + 'package-lock.json', 'utf8'));
  assert.equal(pkg.version, '0.11.0');
  assert.equal(lock.version, '0.11.0');
  assert.equal(lock.packages[''].version, '0.11.0');
  assert.match(fs.readFileSync(REPO_ROOT + 'CHANGELOG.md', 'utf8'), /0\.11\.0/);
  for (const file of ['playbook-validation.yml', 'contract-drift-check.yml']) {
    const workflow = fs.readFileSync(REPO_ROOT + `templates/project/github/workflows/${file}`, 'utf8');
    assert.match(workflow, /github:fcdevxai\/ai-sdd-playbooks#semver:\^0\.11\.0/);
  }
});

test('README notes the repo is private and requires git access configured (AC-5)', () => {
  const section = installSection(readme);
  assert.match(section, /private/i);
  assert.match(section, /SSH|PAT/);
});
