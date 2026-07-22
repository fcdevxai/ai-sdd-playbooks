/**
 * `playbook gate-check <change-id>` — cross-repo verification gate, ported
 * from specloom's `normalizeGateCheckPlan`/`runGateCheck`
 * (framework/cli/lib.js, ADR-016/ADR-017). Runs the `verification:` commands
 * configured for every repo listed in a change's `## Impacted repos`,
 * locally — it never queries remote CI.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { splitCommand } from './command.js';
import { loadConfig } from '../config/config.js';
import { readImpactedRepos, defaultChangesDir } from './impacted.js';
import { resolveConfiguredRepoPath, normalizeVerificationCommands } from './config.js';
import { persistRun } from '../tokens/run.js';

export { splitCommand };

export function normalizeGateCheckPlan({ slug, cwd = process.cwd(), changesDir = defaultChangesDir(cwd) } = {}) {
  const impactedRepos = readImpactedRepos(slug, changesDir);
  if (impactedRepos.length === 0) {
    return { applicable: false, reason: 'no impacted repos declared', repos: [], impactedRepos };
  }

  const { config } = loadConfig({ cwd });
  if (!config || !config.repos) {
    return { applicable: false, reason: 'playbook.config.yaml has no repos', repos: [], impactedRepos };
  }
  if (config.gating?.strategy && config.gating.strategy !== 'per-feature') {
    throw new Error(`Unsupported gating.strategy "${config.gating.strategy}" (expected "per-feature")`);
  }

  const repos = [];
  for (const repoName of impactedRepos) {
    const repoConfig = config.repos[repoName];
    if (!repoConfig) {
      throw new Error(`Unknown impacted repo "${repoName}" (not found in playbook.config.yaml repos)`);
    }
    if (!repoConfig.path || typeof repoConfig.path !== 'string') {
      throw new Error(`Repo "${repoName}" has no path configured`);
    }
    const repoPath = resolveConfiguredRepoPath(repoName, { cwd });
    const commands = normalizeVerificationCommands(repoName, repoConfig.verification);
    repos.push({ name: repoName, path: repoPath, commands });
  }

  return { applicable: true, reason: null, repos, impactedRepos };
}

export function runGateCheck({ slug, cwd = process.cwd(), changesDir = defaultChangesDir(cwd) } = {}) {
  const plan = normalizeGateCheckPlan({ slug, cwd, changesDir });
  const results = [];
  const failures = [];
  if (!plan.applicable) return { ok: true, plan, results, failures };

  for (const repo of plan.repos) {
    if (!fs.existsSync(repo.path)) {
      const failure = { repo: repo.name, path: repo.path, error: `Repo "${repo.name}" path does not exist: ${repo.path}` };
      results.push(failure);
      failures.push(failure);
      continue;
    }
    for (const commandConfig of repo.commands) {
      const command = commandConfig.command;
      let exitCode = 0;
      let output = '';
      try {
        const [cmd, ...cmdArgs] = splitCommand(command);
        const child = spawnSync(cmd, cmdArgs, { cwd: repo.path, encoding: 'utf8', shell: false });
        output = `${child.stdout || ''}${child.stderr || ''}`;
        if (child.error) {
          exitCode = child.error.code === 'ENOENT' ? 127 : 1;
          output += `${child.error.message}\n`;
        } else {
          exitCode = child.status === null ? (child.signal ? 128 : 1) : child.status;
        }
      } catch (err) {
        exitCode = 1;
        output = `${err.message}\n`;
      }
      const telemetry = persistRun({
        command,
        changeId: slug,
        step: 'gate-check',
        harness: 'unknown',
        exitCode,
        output,
        cwd,
        metadata: { gateCheck: { repo: repo.name, repoPath: repo.path, verification: commandConfig.name } },
      });
      const result = { repo: repo.name, path: repo.path, verification: commandConfig.name, command, exitCode, ...telemetry };
      results.push(result);
      if (exitCode !== 0) failures.push(result);
    }
  }

  return { ok: failures.length === 0, plan, results, failures };
}
