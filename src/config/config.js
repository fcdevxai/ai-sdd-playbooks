/**
 * sdd.config.yaml IO and merge (design §5.1).
 *
 * Precedence: package defaults → sdd.config.yaml → env overrides.
 * Machine-readable fields are stable in English. `github.require_pull_request`
 * and `github.require_ci` are pinned `const: true` in the schema (AC-21), so a
 * config that sets them false is rejected by validateConfig().
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { validateNamed } from '../schema/validate.js';

export const DEFAULT_DOCUMENTS = {
  system_spec: 'openspec/specs/system.md',
  agent_architecture: 'docs/agent_architecture.md',
  architecture: 'docs/doc_architecture.md',
  verification: 'docs/doc_verification_guide.md',
  workflow: 'docs/sdd-workflow.md',
};

export const DEFAULT_CONFIG = {
  version: 2,
  project: { language: 'en' },
  methodology: { scope: 'user', compatible: '>=3.0.0 <4.0.0' },
  capabilities: { browser: false, http: false, cli: false, worker: false },
  design: { always: false },
  security: { default_risk: 'standard', threat_model: 'auto' },
  github: { base_branch: 'main', require_pull_request: true, require_ci: true },
  documents: { ...DEFAULT_DOCUMENTS },
  addons: { confluence: false },
};

// Documented env overrides (env → config path). Kept small and explicit.
export const ENV_OVERRIDES = [
  ['SDD_METHODOLOGY_COMPATIBLE', ['methodology', 'compatible']],
  ['SDD_GITHUB_BASE_BRANCH', ['github', 'base_branch']],
  ['SDD_PROJECT_LANGUAGE', ['project', 'language']],
];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

function setPath(obj, keys, value) {
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!isPlainObject(cur[keys[i]])) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

/** Pure merge: defaults → fromFile → env. Testable without the filesystem. */
export function mergeConfig(fromFile, env = {}) {
  const merged = structuredClone(deepMerge(DEFAULT_CONFIG, fromFile || {}));
  for (const [name, keys] of ENV_OVERRIDES) {
    const val = env[name];
    if (val !== undefined && val !== '') setPath(merged, keys, val);
  }
  return merged;
}

export function configPathFor(cwd, configPath) {
  return configPath || path.join(cwd, 'sdd.config.yaml');
}

export function readConfigFile(file) {
  if (!fs.existsSync(file)) return null;
  return yaml.load(fs.readFileSync(file, 'utf8')) || {};
}

export function loadConfig({ cwd = process.cwd(), configPath = null, env = process.env } = {}) {
  const file = configPathFor(cwd, configPath);
  const fromFile = readConfigFile(file);
  return { config: mergeConfig(fromFile, env), path: file, exists: fromFile !== null };
}

export function validateConfig(config) {
  return validateNamed('sdd.config', config);
}

export function writeConfig(file, config) {
  fs.writeFileSync(file, yaml.dump(config, { lineWidth: 100, noRefs: true }), 'utf8');
}
