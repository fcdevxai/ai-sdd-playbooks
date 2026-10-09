/** Resolve a checked-out repository's own runtime capability authority. */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { loadConfig, validateConfig } from '../config/config.js';
import { resolveConfiguredRepoPath } from '../repos/config.js';

export function ownRepositoryCapabilities(name, { cwd, sddName }) {
  if (name === sddName) return null;
  let root;
  try {
    root = resolveConfiguredRepoPath(name, { cwd, requireDirectory: true });
  } catch (error) {
    if (/path does not exist/.test(error.message)) return null;
    throw error;
  }
  const file = path.join(root, 'playbook.config.yaml');
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('playbook.config.yaml is not a regular file');
  const declared = yaml.load(fs.readFileSync(file, 'utf8'));
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) throw new Error('playbook.config.yaml is not a mapping');
  if (declared.capabilities !== undefined && (typeof declared.capabilities !== 'object'
    || declared.capabilities === null || Array.isArray(declared.capabilities)
    || Object.entries(declared.capabilities).some(([key, value]) => !['browser', 'http', 'cli', 'worker'].includes(key) || typeof value !== 'boolean'))) {
    throw new Error('playbook.config.yaml capabilities must be a boolean mapping');
  }
  const loaded = loadConfig({ cwd: root }).config;
  const checked = validateConfig(loaded);
  if (!checked.valid) throw new Error(`playbook.config.yaml invalid: ${checked.errors.join('; ')}`);
  return loaded.capabilities;
}
