/**
 * Multi-repo topology — ported from specloom's `resolveSddRepo`/
 * `resolveConfiguredRepoPath`/`resolveRepoRunTarget` (specloom,
 * ADR-020/ADR-024). Reads the SAME `playbook.config.yaml` the single-repo
 * engine uses — `repos:`/`contract:`/`gating:` are additive keys on top of
 * `capabilities:`/`github:`/etc., not a separate file.
 *
 * Adapted to the cwd-only path model: no `consumerRoot(cwd, repoRoot)` — every
 * path resolves directly against the consumer's own `cwd`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/config.js';
import { splitCommand } from './command.js';

/**
 * Reserved name for the SDD hub repo when no `repos.<name>.role: sdd` is
 * declared — preserves back-compat for configs written before role:sdd existed.
 */
export const SDD_REPO_DEFAULT_NAME = 'loom';

/** The schema version stamped into every repo-plan, so downstream consumers can gate on shape. */
export const REPO_PLAN_SCHEMA_VERSION = 1;

function reposMap(cwd) {
  const { config } = loadConfig({ cwd });
  return config && config.repos && typeof config.repos === 'object' && !Array.isArray(config.repos)
    ? config.repos
    : {};
}

/**
 * Resolves the SDD hub repo from playbook.config.yaml: the single entry
 * declaring `role: sdd` (whose resolved path must equal cwd), or — when none
 * is declared — an implicit entry under SDD_REPO_DEFAULT_NAME at cwd. Throws
 * on more than one `role: sdd`, or a declared one whose path is not cwd.
 * Returns `{ name, role: 'sdd', path, implicit }`.
 */
export function resolveSddRepo({ cwd = process.cwd() } = {}) {
  const repos = reposMap(cwd);
  const declared = Object.entries(repos).filter(([, repoConfig]) => repoConfig && repoConfig.role === 'sdd');
  if (declared.length > 1) {
    throw new Error(
      `playbook.config.yaml declares ${declared.length} repos with role: sdd (at most one is allowed): ${declared
        .map(([name]) => name)
        .join(', ')}`,
    );
  }
  if (declared.length === 1) {
    const [name, repoConfig] = declared[0];
    if (!repoConfig.path || typeof repoConfig.path !== 'string') {
      throw new Error(`SDD repo "${name}" (role: sdd) has no path configured`);
    }
    const resolved = path.isAbsolute(repoConfig.path) ? repoConfig.path : path.resolve(cwd, repoConfig.path);
    if (path.resolve(resolved) !== path.resolve(cwd)) {
      throw new Error(`SDD repo "${name}" (role: sdd) must resolve to the consumer root (${cwd}); got "${repoConfig.path}"`);
    }
    return { name, role: 'sdd', path: cwd, implicit: false };
  }
  return { name: SDD_REPO_DEFAULT_NAME, role: 'sdd', path: cwd, implicit: true };
}

export function resolveRepoConfig(repoName, { cwd = process.cwd() } = {}) {
  const repos = reposMap(cwd);
  const repoConfig = repos[repoName];
  if (!repoConfig) {
    throw new Error(`Unknown repo "${repoName}" (not found in playbook.config.yaml repos)`);
  }
  return repoConfig;
}

export function resolveConfiguredRepoPath(repoName, { cwd = process.cwd(), requireDirectory = false } = {}) {
  const repos = reposMap(cwd);
  if (Object.keys(repos).length === 0) throw new Error('playbook.config.yaml has no repos');
  const repoConfig = repos[repoName];
  if (!repoConfig) throw new Error(`Unknown repo "${repoName}" (not found in playbook.config.yaml repos)`);
  if (!repoConfig.path || typeof repoConfig.path !== 'string') {
    throw new Error(`Repo "${repoName}" has no path configured`);
  }
  const repoPath = path.isAbsolute(repoConfig.path) ? repoConfig.path : path.resolve(cwd, repoConfig.path);
  if (requireDirectory && !fs.existsSync(repoPath)) {
    throw new Error(`Repo "${repoName}" path does not exist: ${repoPath}`);
  }
  if (requireDirectory && !fs.statSync(repoPath).isDirectory()) {
    throw new Error(`Repo "${repoName}" path is not a directory: ${repoPath}`);
  }
  return repoPath;
}

export function normalizeVerificationCommands(repoName, verification) {
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) {
    throw new Error(`Repo "${repoName}" has no verification commands configured`);
  }
  const commands = Object.entries(verification)
    .filter(([, command]) => typeof command === 'string' && command.trim() !== '')
    .map(([name, command]) => ({ name, command: command.trim() }));
  if (commands.length === 0) {
    throw new Error(`Repo "${repoName}" has no verification commands configured`);
  }
  return commands;
}

function resolveVerificationCommand(repoName, verificationKey, verification) {
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) {
    throw new Error(`Repo "${repoName}" has no verification commands configured`);
  }
  const command = verification[verificationKey];
  if (typeof command !== 'string' || command.trim() === '') {
    const available = Object.keys(verification).sort();
    throw new Error(
      `Verification "${verificationKey}" not found for repo "${repoName}"` +
        (available.length > 0 ? ` (available: ${available.join(', ')})` : ''),
    );
  }
  return command.trim();
}

/** Resolves where a command should run: a configured repo's path + verification command, or an explicit passthrough command. */
export function resolveRepoRunTarget({ repoName, verificationKey = null, commandArgv = null, cwd = process.cwd() } = {}) {
  if (!repoName) throw new Error('Missing --repo <name>');
  const repoConfig = resolveRepoConfig(repoName, { cwd });
  const repoPath = resolveConfiguredRepoPath(repoName, { cwd, requireDirectory: true });

  if (verificationKey) {
    const command = resolveVerificationCommand(repoName, verificationKey, repoConfig.verification);
    return { repo: repoName, cwd: repoPath, command, commandArgv: splitCommand(command), verification: verificationKey };
  }

  if (!Array.isArray(commandArgv) || commandArgv.length === 0) {
    throw new Error('Missing command after --');
  }
  return { repo: repoName, cwd: repoPath, command: commandArgv.join(' '), commandArgv, verification: null };
}
