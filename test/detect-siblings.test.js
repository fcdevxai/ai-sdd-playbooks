import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { detectSiblingRepos } from '../src/config/detect-siblings.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-siblings-')); }

function makeGitRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: dir });
}

function makePlainDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// Scenario A — the exact case the user asked about: a hub whose name shares
// NO token with its siblings ("playbook-ai" vs "frontend"/"backend"). Proves
// naming affinity is not required for a sibling to be detected.
test('detects hub + frontend + backend even with zero shared naming tokens', () => {
  const parent = tmp();
  const cwd = path.join(parent, 'playbook-ai');
  makeGitRepo(cwd);
  makeGitRepo(path.join(parent, 'frontend'));
  fs.writeFileSync(path.join(parent, 'frontend', 'package.json'), JSON.stringify({ dependencies: { react: '^18.0.0' } }));
  makeGitRepo(path.join(parent, 'backend'));
  fs.writeFileSync(path.join(parent, 'backend', 'package.json'), JSON.stringify({ dependencies: { express: '^4.0.0' } }));

  const { candidates } = detectSiblingRepos({ cwd });
  const names = candidates.map((c) => c.name).sort();
  assert.deepEqual(names, ['backend', 'frontend']);

  const frontend = candidates.find((c) => c.name === 'frontend');
  assert.deepEqual(frontend.sharedTokensWithOwn, []); // no shared token with "playbook-ai" — still detected
  assert.equal(frontend.capabilities.browser, true);

  const backend = candidates.find((c) => c.name === 'backend');
  assert.equal(backend.capabilities.http, true);
});

// Scenario B — the real naming-cluster found empirically in a live home
// directory (miguru-cv-back / miguru-search / miguru-vespa): siblings that
// share a token WITH EACH OTHER but not with the hub running bootstrap.
test('clusters siblings that share a naming token with each other, not just with the hub', () => {
  const parent = tmp();
  const cwd = path.join(parent, 'unrelated-hub');
  makeGitRepo(cwd);
  makeGitRepo(path.join(parent, 'miguru-cv-back'));
  makeGitRepo(path.join(parent, 'miguru-search'));
  makeGitRepo(path.join(parent, 'miguru-vespa'));

  const { candidates } = detectSiblingRepos({ cwd });
  const search = candidates.find((c) => c.name === 'miguru-search');
  assert.deepEqual(search.sharedTokensWithOwn, []); // "unrelated-hub" shares nothing
  assert.deepEqual(search.cluster.sort(), ['miguru-cv-back', 'miguru-vespa']); // but clusters with its siblings
});

test('a real dev-machine home directory is noisy: unrelated repos are still listed, never silently dropped', () => {
  const parent = tmp();
  const cwd = path.join(parent, 'playbook-ai');
  makeGitRepo(cwd);
  makeGitRepo(path.join(parent, 'some-unrelated-crawler'));
  makeGitRepo(path.join(parent, 'another-old-project'));

  const { candidates } = detectSiblingRepos({ cwd });
  // Never filtered away — the human decides relevance, not the heuristic.
  assert.deepEqual(candidates.map((c) => c.name).sort(), ['another-old-project', 'some-unrelated-crawler']);
});

test('a sibling directory that is NOT a git repo is excluded (nothing to branch/plan against)', () => {
  const parent = tmp();
  const cwd = path.join(parent, 'playbook-ai');
  makeGitRepo(cwd);
  makePlainDir(path.join(parent, 'not-a-repo'));
  makeGitRepo(path.join(parent, 'real-sibling'));

  const { candidates } = detectSiblingRepos({ cwd });
  assert.deepEqual(candidates.map((c) => c.name), ['real-sibling']);
});

test('candidates sharing a token with the hub sort before unrelated ones', () => {
  const parent = tmp();
  const cwd = path.join(parent, 'athly-loom');
  makeGitRepo(cwd);
  makeGitRepo(path.join(parent, 'zzz-unrelated'));
  makeGitRepo(path.join(parent, 'athly-web'));

  const { candidates } = detectSiblingRepos({ cwd });
  assert.equal(candidates[0].name, 'athly-web');
  assert.deepEqual(candidates[0].sharedTokensWithOwn, ['athly']);
});

test('no parent directory yields an empty candidate list, not a throw', () => {
  const result = detectSiblingRepos({ cwd: '/nonexistent/hub', parentDir: '/nonexistent' });
  assert.deepEqual(result.candidates, []);
});
