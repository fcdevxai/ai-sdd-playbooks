/**
 * `playbook run` telemetry + compaction — ported from specloom's
 * `persistRun`/`formatRunSummary`/`resolveRunMetadata`/`countPriorRuns`
 * (specloom, ADR-007/ADR-008/ADR-009). Adapted to the cwd-only path model
 * (no `repoRoot` parameter); runs live under `.specloom/runs/`.
 *
 * Every verification command a skill runs goes through here instead of raw
 * shell output: on success it prints a one-line summary; on failure it prints
 * the exit code plus the last `MAX_FAILURE_SUMMARY_LINES` lines. The full
 * output always lands on disk at `.specloom/runs/<run-id>/full.log` — nothing
 * is lost, only what reaches the agent's context is compacted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

function isSafeSlug(slug) {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    slug !== '.' &&
    slug !== '..' &&
    !slug.includes('/') &&
    !slug.includes('\\')
  );
}

export function defaultChangesDir(cwd = process.cwd()) {
  return path.join(cwd, 'openspec', 'changes');
}

export function runsDir(cwd = process.cwd()) {
  return path.join(cwd, '.specloom', 'runs');
}

/**
 * Resolves the metadata stamped into usage.json. Explicit flags win; when a
 * flag is omitted, changeId falls back to the current git branch (or
 * "unknown" if git can't answer or is detached), step to "manual", harness to
 * "unknown". The git call is fail-soft — never throws.
 */
export function resolveRunMetadata({ change, step, harness, cwd = process.cwd() } = {}) {
  let changeId = change;
  if (!changeId) {
    let branch = '';
    try {
      // symbolic-ref (not rev-parse --abbrev-ref) so a fresh repo with no
      // commits yet still yields its branch name; detached HEAD throws → unknown.
      branch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
        cwd,
        encoding: 'utf8',
      }).trim();
    } catch {
      branch = '';
    }
    changeId = !branch || branch === 'HEAD' ? 'unknown' : branch;
  }
  return {
    changeId,
    step: step || 'manual',
    harness: harness || 'unknown',
  };
}

/**
 * How many prior runs already recorded the exact same {changeId, step, command}
 * triple. The caller stamps this as the new run's retryCount, so the first run
 * of a command is 0, the next 1, and so on. Stateless across processes: the
 * answer lives entirely in .specloom/runs/ on disk. A corrupt/partial
 * usage.json is skipped, never crashing the count.
 */
export function countPriorRuns(dir, { changeId, step, command }) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir)) {
    const usagePath = path.join(dir, entry, 'usage.json');
    if (!fs.existsSync(usagePath)) continue;
    let usage;
    try {
      usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    } catch {
      continue;
    }
    if (usage.changeId === changeId && usage.step === step && usage.command === command) {
      count += 1;
    }
  }
  return count;
}

/**
 * The top-level files belonging to a change folder
 * (openspec/changes/<changeId>/), or [] when changeId doesn't map to a real
 * folder (e.g. it fell back to "unknown" or a git branch with no ticket).
 * Guarded by isSafeSlug so a changeId carrying path separators can never make
 * readdir escape changesDir.
 */
export function filesInChange(changeId, changesDir = defaultChangesDir()) {
  if (!isSafeSlug(changeId)) return [];
  const dir = path.join(changesDir, changeId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile());
}

export const MAX_FAILURE_SUMMARY_LINES = 40;

/**
 * Writes a command's telemetry to .specloom/runs/<run-id>/. Optional metadata
 * is appended to usage.json for callers such as gate-check without changing
 * the stable base fields.
 */
export function persistRun({
  command,
  changeId,
  step,
  harness,
  exitCode,
  output,
  cwd = process.cwd(),
  metadata = {},
}) {
  const dir = runsDir(cwd);
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runDir = path.join(dir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const retryCount = countPriorRuns(dir, { changeId, step, command });
  const rawOutputLines = output === '' ? 0 : output.replace(/\n$/, '').split('\n').length;
  const logPath = path.join(runDir, 'full.log');

  fs.writeFileSync(logPath, output);
  fs.writeFileSync(
    path.join(runDir, 'usage.json'),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        command,
        changeId,
        step,
        harness,
        exitCode,
        rawOutputLines,
        retryCount,
        filesInChange: filesInChange(changeId, defaultChangesDir(cwd)),
        ...metadata,
      },
      null,
      2,
    ) + '\n',
  );

  return { logPath, rawOutputLines };
}

/**
 * Returns the compacted summary text for a persisted run. CLI callers decide
 * whether to write it to stdout or stderr.
 */
export function formatRunSummary({ exitCode, output, logPath, rawOutputLines }) {
  if (exitCode === 0) {
    return `✓ passed (${rawOutputLines} lines) — log: ${logPath}\n`;
  }
  const lines = output === '' ? [] : output.replace(/\n$/, '').split('\n');
  const tail = lines.slice(-MAX_FAILURE_SUMMARY_LINES);
  const body = tail.length > 0 ? `${tail.join('\n')}\n` : '';
  return `${body}✗ exit ${exitCode} — log: ${logPath}\n`;
}
