/**
 * `sdd migrate` (design §8.3, C-13) — convert a 1.x consumer to 2.0.
 *
 * Detect the 1.x layout → compute the 2.0 target → render a full diff → apply
 * ONLY on explicit confirmation (`--yes`; the diff is still printed first).
 * Legacy files are left in place; a later, separate change removes them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from './exit.js';
import { projectActions, printProjectPlan } from './init.js';

/** Detect 1.x consumer signals. */
export function detectLegacy(cwd) {
  const signals = {
    submodule: fs.existsSync(path.join(cwd, '.ai-sdd-playbooks')),
    claudeCommands: fs.existsSync(path.join(cwd, '.claude', 'commands')),
    syncScript: ['sync-playbooks.sh', 'sync-consumer.sh'].some((f) => fs.existsSync(path.join(cwd, f))),
  };
  return { isLegacy: Object.values(signals).some(Boolean), signals };
}

export async function migrateCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const yes = parsed.rest.includes('--yes') || parsed.flags.yes;

  const legacy = detectLegacy(cwd);
  const plan = projectActions(cwd, { write: false }); // preview only

  if (parsed.flags.json) {
    io.out(JSON.stringify({ command: 'migrate', cwd, legacy, plan, applied: false, dryRun: !yes }, null, 2));
  } else {
    io.out('sdd migrate — proposed changes (diff)');
    if (legacy.isLegacy) {
      io.out(`  detected 1.x: ${Object.entries(legacy.signals).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
    } else {
      io.out('  no 1.x layout detected (will still scaffold the 2.0 structure)');
    }
    printProjectPlan(io, plan);
    io.out('  (legacy 1.x files are left untouched)');
  }

  if (!yes) {
    if (!parsed.flags.json) io.out('\nDry run. Re-run with --yes to apply.');
    return EXIT.OK;
  }

  // apply
  projectActions(cwd, { write: true });
  if (parsed.flags.json) io.out(JSON.stringify({ command: 'migrate', cwd, applied: true }, null, 2));
  else io.out('\nApplied. Legacy 1.x files were left in place (removal is a separate, later change).');
  return EXIT.OK;
}
