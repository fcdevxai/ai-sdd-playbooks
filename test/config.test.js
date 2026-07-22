import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_CONFIG, mergeConfig, loadConfig, validateConfig, writeConfig, readConfigFile,
} from '../src/config/config.js';
import { resolveDocument, resolveAllDocuments } from '../src/config/docmap.js';

test('mergeConfig with no file/env equals the defaults', () => {
  assert.deepEqual(mergeConfig(null, {}), DEFAULT_CONFIG);
});

test('mergeConfig: file overrides defaults', () => {
  const merged = mergeConfig({ capabilities: { browser: true }, project: { name: 'x' } }, {});
  assert.equal(merged.capabilities.browser, true);
  assert.equal(merged.capabilities.http, false); // untouched default preserved
  assert.equal(merged.project.name, 'x');
  assert.equal(merged.project.language, 'en'); // default preserved
});

test('mergeConfig: env overrides file (precedence)', () => {
  const merged = mergeConfig(
    { github: { base_branch: 'develop', require_pull_request: true, require_ci: true } },
    { PLAYBOOK_GITHUB_BASE_BRANCH: 'release' },
  );
  assert.equal(merged.github.base_branch, 'release');
});

test('the default config is schema-valid', () => {
  assert.equal(validateConfig(DEFAULT_CONFIG).valid, true);
});

test('a config with require_ci:false is rejected (AC-21)', () => {
  const cfg = mergeConfig(
    { github: { base_branch: 'main', require_pull_request: true, require_ci: false } },
    {},
  );
  assert.equal(validateConfig(cfg).valid, false);
});

test('loadConfig reads and merges a real playbook.config.yaml', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cfg-'));
  const file = path.join(dir, 'playbook.config.yaml');
  writeConfig(file, mergeConfig({ project: { name: 'demo', language: 'es' }, capabilities: { http: true } }, {}));
  const { config, exists } = loadConfig({ cwd: dir });
  assert.equal(exists, true);
  assert.equal(config.project.name, 'demo');
  assert.equal(config.project.language, 'es');
  assert.equal(config.capabilities.http, true);
  assert.equal(validateConfig(config).valid, true);
});

test('loadConfig falls back to defaults when no file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cfg-'));
  const { config, exists } = loadConfig({ cwd: dir });
  assert.equal(exists, false);
  assert.deepEqual(config, DEFAULT_CONFIG);
});

test('writeConfig round-trips through readConfigFile', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-cfg-'));
  const file = path.join(dir, 'playbook.config.yaml');
  writeConfig(file, DEFAULT_CONFIG);
  assert.deepEqual(readConfigFile(file), DEFAULT_CONFIG);
});

test('docmap: resolves defaults and marks config adoption (C-09)', () => {
  const arch = resolveDocument(DEFAULT_CONFIG, 'architecture');
  assert.equal(arch.path, 'docs/doc_architecture.md');
  assert.equal(arch.adopted, false);

  // the 4th consumer doc (3.0 alignment)
  assert.equal(resolveDocument(DEFAULT_CONFIG, 'agent_architecture').path, 'docs/agent_architecture.md');
  assert.equal(resolveDocument(DEFAULT_CONFIG, 'verification').path, 'docs/doc_verification_guide.md');

  const adopted = resolveDocument(
    { documents: { architecture: 'docs/Arquitectura-Tecnica.md' } },
    'architecture',
  );
  assert.equal(adopted.path, 'docs/Arquitectura-Tecnica.md');
  assert.equal(adopted.adopted, true);

  assert.equal(resolveAllDocuments(DEFAULT_CONFIG).length, 5);
});
