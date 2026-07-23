/**
 * `playbook run [--change <id>] [--step <step>] [--harness <name>] -- <cmd...>`
 *
 * Runs a verification command through the telemetry/compaction layer
 * (src/tokens/run.js) instead of raw shell output: full output always lands
 * at `.specloom/runs/<run-id>/full.log`; only a compacted summary reaches
 * stdout/stderr (one line on success, exit code + last 40 lines on failure).
 */
import { spawnSync } from 'node:child_process';
import { EXIT } from './exit.js';
import { resolveRunMetadata, persistRun, formatRunSummary, runsDir } from '../tokens/run.js';

function parseRunArgs(rest) {
  let change = null;
  let step = null;
  let harness = null;
  let i = 0;
  for (; i < rest.length; i++) {
    if (rest[i] === '--') { i++; break; }
    if (rest[i] === '--change') { change = rest[++i]; }
    else if (rest[i] === '--step') { step = rest[++i]; }
    else if (rest[i] === '--harness') { harness = rest[++i]; }
    else break;
  }
  return { change, step, harness, command: rest.slice(i) };
}

export async function runCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const { change, step, harness, command } = parseRunArgs(parsed.rest);

  if (command.length === 0) {
    io.err('error: usage: playbook run [--change <id>] [--step <step>] [--harness <name>] -- <cmd...>');
    return EXIT.USAGE;
  }

  const meta = resolveRunMetadata({ change, step, harness, cwd });
  const commandStr = command.join(' ');
  const result = spawnSync(command[0], command.slice(1), { cwd, encoding: 'utf8', shell: false });
  const output = (result.stdout || '') + (result.stderr || '');
  const exitCode = result.status === null ? 1 : result.status;

  const { logPath, rawOutputLines } = persistRun({
    command: commandStr,
    changeId: meta.changeId,
    step: meta.step,
    harness: meta.harness,
    exitCode,
    output,
    cwd,
  });

  const summary = formatRunSummary({ exitCode, output, logPath, rawOutputLines });
  if (exitCode === 0) io.out(summary.trimEnd());
  else io.err(summary.trimEnd());

  return exitCode === 0 ? EXIT.OK : EXIT.VIOLATION;
}

export { runsDir };
