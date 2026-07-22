/**
 * `playbook adr promote <change-id>` — promote accepted/rejected ADR drafts
 * from a change folder into numbered records under openspec/specs/adr/.
 *
 * Thin CLI wrapper around src/adr/promote.js: `promoteAdrPlan` (pure planner)
 * + `applyPromotePlan` (the only mutator — git-staged, transactional).
 * `--dry-run` prints the plan without touching the filesystem.
 */
import { EXIT } from './exit.js';
import { promoteAdrPlan, applyPromotePlan, defaultChangesDir, defaultAdrDir } from '../adr/promote.js';

function parseAdrArgs(rest) {
  const sub = rest[0] || null;
  const dryRun = rest.includes('--dry-run');
  const positionals = rest.slice(1).filter((a) => !a.startsWith('-'));
  return { sub, dryRun, changeId: positionals[0] || null };
}

export async function adrCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const { sub, dryRun, changeId } = parseAdrArgs(parsed.rest);

  if (sub !== 'promote') {
    io.err('error: usage: playbook adr promote <change-id> [--dry-run]');
    return EXIT.USAGE;
  }
  if (!changeId) {
    io.err('error: playbook adr promote requires a <change-id>');
    return EXIT.USAGE;
  }

  let plan;
  try {
    plan = promoteAdrPlan(changeId, { changesDir: defaultChangesDir(cwd), adrDir: defaultAdrDir(cwd) });
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }

  if (plan.promotions.length === 0) {
    if (parsed.flags.json) io.out(JSON.stringify({ command: 'adr', sub: 'promote', change: changeId, promotions: [] }, null, 2));
    else io.out(`No ADR drafts to promote for ${changeId}.`);
    return EXIT.OK;
  }

  if (dryRun) {
    if (parsed.flags.json) {
      io.out(JSON.stringify({ command: 'adr', sub: 'promote', change: changeId, dryRun: true, plan }, null, 2));
    } else {
      io.out(`Would promote ${plan.promotions.length} ADR(s) for ${changeId}:`);
      for (const p of plan.promotions) io.out(`  ${p.draftFile} → ${p.id}-${p.targetPath.split('/').pop().replace(/^ADR-\d{3}-/, '')}`);
    }
    return EXIT.OK;
  }

  try {
    const result = applyPromotePlan(plan, { gitCwd: cwd });
    if (parsed.flags.json) {
      io.out(JSON.stringify({ command: 'adr', sub: 'promote', change: changeId, promotions: plan.promotions.map((p) => p.id), staged: result.stagedPaths }, null, 2));
    } else {
      for (const p of plan.promotions) io.out(`  promoted ${p.draftFile} → ${p.id}`);
      io.out(`Promoted ${plan.promotions.length} ADR(s) for ${changeId}.`);
    }
    return EXIT.OK;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.ENVIRONMENT;
  }
}
