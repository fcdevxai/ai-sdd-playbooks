/**
 * `playbook gate-check <change-id>` — cross-repo verification gate, ported
 * from specloom's `normalizeGateCheckPlan`/`runGateCheck`
 * (specloom, ADR-016/ADR-017). Runs the `verification:` commands
 * configured for every repo listed in a change's `## Impacted repos`,
 * locally — it never queries remote CI.
 */
import fs from 'node:fs';
import { splitCommand } from './command.js';
import { loadConfig } from '../config/config.js';
import { readImpactedRepos, defaultChangesDir } from './impacted.js';
import { resolveConfiguredRepoPath, normalizeVerificationCommands } from './config.js';
import { persistRun } from '../tokens/run.js';
import { captureRunSync } from '../tokens/capture.js';

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

export function runGateCheck({ slug, cwd = process.cwd(), changesDir = defaultChangesDir(cwd), agent = 'unknown', provider = 'unknown', model = 'unknown' } = {}) {
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
      let result;
      try {
        const [cmd, ...cmdArgs] = splitCommand(command);
        result = captureRunSync({
          argv: [cmd, ...cmdArgs], cwd: repo.path, evidenceCwd: cwd,
          changeId: slug, step: 'gate-check', harness: 'unknown', repoName: repo.name,
          agent, provider, model,
          metadata: { gateCheck: { repo: repo.name, repoPath: repo.path, verification: commandConfig.name } },
        });
      } catch (err) {
        result = { exitCode: 1, ...persistRun({
          command, changeId: slug, step: 'gate-check', harness: 'unknown',
          exitCode: 1, output: `${err.message}\n`, cwd,
          metadata: { gateCheck: { repo: repo.name, repoPath: repo.path, verification: commandConfig.name } },
        }) };
      }
      const reported = { repo: repo.name, path: repo.path, verification: commandConfig.name, command, ...result };
      results.push(reported);
      if (result.exitCode !== 0 || result.captureError) failures.push(reported);
    }
  }

  return { ok: failures.length === 0, plan, results, failures };
}
