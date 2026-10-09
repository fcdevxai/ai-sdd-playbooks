/**
 * `playbook run [--change <id>] [--step <step>] [--harness <name>] [--raw] -- <cmd...>`
 *
 * Runs a verification command through the telemetry/compaction layer
 * (src/tokens/capture.js) instead of a buffered shell command. Raw stdout,
 * stderr and combined evidence live in a private run directory. NORMAL emits
 * a bounded summary; RAW forwards each child stream byte-for-byte.
 */
import { EXIT } from './exit.js';
import { resolveRunMetadata, runsDir } from '../tokens/run.js';
import { captureRun } from '../tokens/capture.js';
import { resolveConfiguredRepoPath, resolveSddRepo } from '../repos/config.js';
import path from 'node:path';

function parseRunArgs(rest) {
  let change = null;
  let step = null;
  let harness = null;
  let raw = false;
  let repo = null;
  let agent = 'unknown';
  let provider = 'unknown';
  let model = 'unknown';
  let container = 'unknown';
  let i = 0;
  for (; i < rest.length; i++) {
    if (rest[i] === '--') { i++; break; }
    if (rest[i] === '--change') { change = rest[++i]; }
    else if (rest[i] === '--step') { step = rest[++i]; }
    else if (rest[i] === '--harness') { harness = rest[++i]; }
    else if (rest[i] === '--raw') { raw = true; }
    else if (rest[i] === '--repo') { repo = rest[++i]; }
    else if (rest[i] === '--agent') { agent = rest[++i]; }
    else if (rest[i] === '--provider') { provider = rest[++i]; }
    else if (rest[i] === '--model') { model = rest[++i]; }
    else if (rest[i] === '--container') { container = rest[++i]; }
    else break;
  }
  return { change, step, harness, raw, repo, agent, provider, model, container, command: rest.slice(i) };
}

export async function runCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const { change, step, harness, raw, repo, agent, provider, model, container, command } = parseRunArgs(parsed.rest);

  if (command.length === 0) {
    io.err('error: usage: playbook run [--change <id>] [--step <step>] [--harness <name>] [--raw] -- <cmd...>');
    return EXIT.USAGE;
  }
  if (raw && parsed.flags.json) {
    io.err('error: --raw and --json cannot be combined');
    return EXIT.USAGE;
  }

  const meta = resolveRunMetadata({ change, step, harness, cwd });
  let executionCwd = cwd;
  try {
    if (repo) executionCwd = repo === resolveSddRepo({ cwd }).name
      ? cwd : resolveConfiguredRepoPath(repo, { cwd, requireDirectory: true });
  } catch (error) {
    io.err(`error: ${error.message}`);
    return EXIT.VIOLATION;
  }
  const result = await captureRun({ argv: command, changeId: meta.changeId,
    step: meta.step, harness: meta.harness, cwd: executionCwd, evidenceCwd: cwd,
    repoName: repo || path.basename(executionCwd), agent, provider, model, container, raw });
  if (result.captureError) {
    io.err(`evidence capture failed: ${result.captureError.message}; child exit ${result.exitCode}; raw path: ${result.logPath}`);
    return EXIT.ENVIRONMENT;
  }
  if (!raw && parsed.flags.json) {
    io.out(JSON.stringify({ exitCode: result.exitCode, summary: result.summary, logPath: result.logPath,
      receiptPath: result.receiptPath, rawFiles: result.rawFiles }));
  } else if (!raw && result.exitCode === 0) io.out(result.summary.trimEnd());
  else if (!raw) io.err(result.summary.trimEnd());
  return result.exitCode;
}

export { runsDir };
