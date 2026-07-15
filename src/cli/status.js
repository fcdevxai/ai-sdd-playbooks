/**
 * `sdd status` and `sdd next` (design §3.3/§3.4/§3.7).
 *
 * Both resolve the change (explicit id → git branch → single change), read the
 * artifacts + config + lock, and ask the PURE engine. Delivery state comes from
 * src/github in a later phase; until then it is `unknown` (Phase 10 wires the
 * reader). The language model never decides state here — the CLI does.
 */
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { EXIT } from './exit.js';
import { loadChange, findChangeDirs } from '../config/artifacts.js';
import { loadConfig } from '../config/config.js';
import { readLock, lockPathFor } from '../config/lock.js';
import { computeState } from '../lifecycle/engine.js';
import { SECURITY_DISCLAIMER } from '../security/classify.js';

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch {
    return null;
  }
}

function resolveChangeDir(cwd, changeId) {
  const dirs = findChangeDirs(cwd);
  if (!dirs.length) return { error: 'no change folders under openspec/changes/' };
  if (changeId) {
    const match = dirs.find((d) => path.basename(d) === changeId);
    return match ? { dir: match } : { error: `change '${changeId}' not found` };
  }
  if (dirs.length === 1) return { dir: dirs[0] };
  const branch = currentBranch(cwd);
  const byBranch = branch && dirs.find((d) => path.basename(d) === branch);
  if (byBranch) return { dir: byBranch };
  return { error: `multiple changes found; pass a change-id (${dirs.map((d) => path.basename(d)).join(', ')})` };
}

// Delivery is supplied by src/github in a later phase; unknown for now (§3.2).
function readDelivery() {
  return { state: 'unknown', blocked_reason: 'GITHUB_CONTEXT_UNAVAILABLE' };
}

function prepare(cwd, changeId) {
  const resolved = resolveChangeDir(cwd, changeId);
  if (resolved.error) return resolved;
  const { config } = loadConfig({ cwd });
  const lock = readLock(lockPathFor(cwd, null));
  const change = loadChange(resolved.dir);
  const result = computeState(config, lock, change.artifacts, readDelivery());
  return { change, result };
}

export async function statusCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const prep = prepare(cwd, parsed.rest[0] || null);
  if (prep.error) { io.err(`error: ${prep.error}`); return EXIT.USAGE; }

  const { change, result } = prep;
  if (parsed.flags.json) {
    io.out(JSON.stringify({ change: change.changeId, ...result }, null, 2));
    return EXIT.OK;
  }
  io.out(`Change: ${change.changeId}`);
  io.out(`Lifecycle: ${result.lifecycle.state} (design_required: ${result.lifecycle.design_required})`);
  io.out(`GitHub delivery: ${result.delivery.state}`);
  if (result.exception) io.out(`Exception: ${result.exception.artifact} is ${result.exception.status}`);
  return EXIT.OK;
}

function formatNext(next) {
  switch (next.action) {
    case 'run_skill': return `Next skill: ${next.skill}${next.reason ? ` (${next.reason})` : ''}`;
    case 'await_human': return `Next: await human — ${next.reason}`;
    case 'wait_for_github_ci': return 'Next: wait_for_github_ci';
    case 'merge': return `Next: merge (${next.reason})`;
    case 'remediate': return `Next: remediate ${next.reason}${next.skill ? ` — run ${next.skill}` : ''}`;
    case 'blocked': return `Next: blocked — ${next.reason}`;
    case 'done': return 'Next: done';
    default: return `Next: ${next.action}`;
  }
}

export async function nextCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const prep = prepare(cwd, parsed.rest[0] || null);
  if (prep.error) { io.err(`error: ${prep.error}`); return EXIT.USAGE; }

  const { change, result } = prep;
  const securityNext = result.next.skill === 'sdd-security-gate';
  const payload = { change: change.changeId, next: result.next, lifecycle: result.lifecycle, delivery: result.delivery };
  if (securityNext) payload.security_disclaimer = SECURITY_DISCLAIMER;

  if (parsed.flags.json) {
    io.out(JSON.stringify(payload, null, 2));
  } else {
    io.out(formatNext(result.next));
    if (securityNext) io.out(`Note: ${SECURITY_DISCLAIMER}`);
  }
  return result.next.action === 'blocked' ? EXIT.BLOCKED : EXIT.OK;
}
