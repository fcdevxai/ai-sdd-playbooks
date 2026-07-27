/**
 * playbook CLI dispatcher.
 *
 * Responsibilities:
 *   - parse global flags,
 *   - route the first positional to a command handler,
 *   - print help / usage,
 *   - return an exit code (never call process.exit — that is bin/playbook.js's
 *     job, which keeps run()/parseArgs() unit-testable).
 *
 * Command-specific flags (e.g. `validate --ci`) are NOT parsed here; they are
 * forwarded to the command in `rest`.
 */

import { EXIT } from './exit.js';
import { validateCommand } from './validate.js';
import { installCommand } from './install.js';
import { statusCommand, nextCommand } from './status.js';
import { syncCommand } from './sync.js';
import { initCommand } from './init.js';
import { doctorCommand } from './doctor.js';
import { adrCommand } from './adr.js';
import { packetCommand } from './packet.js';
import { specReadCommand, specIndexCommand } from './spec.js';
import { runCommand } from './run.js';
import { usageReportCommand } from './usage.js';
import {
  repoPlanCommand, commitPlanCommand, prepareReposCommand, gateCheckCommand, changedFilesCommand, contractDriftCommand, detectSiblingsCommand,
} from './repos.js';
import { readPackageVersion } from '../install/skills.js';
import { anyTargetInstalled } from '../install/targets.js';

// Exit-code map lives in ./exit.js to avoid a dispatch↔command cycle.
export { EXIT };

// The full command surface. Order defines help output.
export const COMMAND_NAMES = [
  'install',
  'init',
  'doctor',
  'status',
  'next',
  'validate',
  'sync',
  'adr',
  'packet',
  'spec-read',
  'spec-index',
  'run',
  'usage-report',
  'repo-plan',
  'commit-plan',
  'prepare-repos',
  'gate-check',
  'changed-files',
  'detect-siblings',
  'contract-drift',
];

const COMMAND_SUMMARIES = {
  install: 'Install/refresh core skills into the global agent dirs.',
  init: 'Scaffold/connect project-local structure (never overwrites).',
  doctor: 'Read-only diagnostics (optionally --fix for safe additive fixes).',
  status: 'Print both dimensions: lifecycle + GitHub delivery.',
  next: 'Print the single next valid action (combines both dimensions).',
  validate: 'Validate artifacts/config against schemas (--ci for pipelines).',
  sync: 'Reconcile installed global skills with the compatible range.',
  adr: 'adr promote <change-id> — promote accepted/rejected ADR drafts.',
  packet: '(Re)generate context-packet.md from proposal.md + tasks.md.',
  'spec-read': 'Read one section of a permanent spec: <file.md#anchor>.',
  'spec-index': 'Rebuild the local structural index of permanent specs.',
  run: 'Run a verification command with compacted output + telemetry.',
  'usage-report': 'Offline token accounting from local Claude Code transcripts.',
  'repo-plan': 'Read-only multi-repo plan for a change (requires repos: in config).',
  'commit-plan': 'Read-only PR-payload plan per impacted repo.',
  'prepare-repos': 'Create/switch the change branch per impacted repo (branches only).',
  'gate-check': "Run each impacted repo's verification commands locally.",
  'changed-files': 'Diff-first changed-file list for a change (optionally --repo).',
  'detect-siblings': 'Read-only list of candidate sibling repos in the parent dir.',
  'contract-drift': 'Structural OpenAPI diff vs the canonical contract.',
};

// Global flags. Value flags consume the following token.
const BOOLEAN_FLAGS = new Set(['--json', '--quiet', '--yes']);
const VALUE_FLAGS = new Set(['--cwd', '--config']);

/**
 * Parse argv into { command, rest, flags, help } or { error }.
 * Only GLOBAL flags are interpreted; anything else is forwarded to the command.
 */
export function parseArgs(argv) {
  const flags = { json: false, quiet: false, yes: false, cwd: null, config: null };
  const remaining = [];
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--version' || arg === '-v') {
      version = true;
    } else if (BOOLEAN_FLAGS.has(arg)) {
      flags[arg.slice(2)] = true;
    } else if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        return { error: `flag ${arg} requires a value` };
      }
      flags[arg.slice(2)] = value;
      i++;
    } else {
      // command, its positionals, and command-specific flags (forwarded)
      remaining.push(arg);
    }
  }

  const command = remaining.length ? remaining[0] : null;
  const rest = remaining.slice(1);

  if (command !== null && command.startsWith('-')) {
    return { error: `expected a command, got '${command}'` };
  }

  return { command, rest, flags, help, version };
}

export function helpText() {
  return [
    'playbook — Spec-Driven Development CLI',
    '',
    'Usage: playbook <command> [options]',
    '',
    'Commands:',
    ...COMMAND_NAMES.map((name) => `  ${name.padEnd(9)} ${COMMAND_SUMMARIES[name]}`),
    '',
    'Global options:',
    '  --json           Machine-readable output',
    '  --cwd <path>     Run as if in <path>',
    '  --config <path>  Use an explicit playbook.config.yaml',
    '  --quiet          Reduce output',
    '  --yes            Assume confirmation (diffs are still shown)',
    '  -h, --help       Show this help',
    '  -v, --version    Print the methodology version',
  ].join('\n');
}

const HANDLERS = {
  validate: validateCommand,
  install: installCommand,
  status: statusCommand,
  next: nextCommand,
  sync: syncCommand,
  init: initCommand,
  doctor: doctorCommand,
  adr: adrCommand,
  packet: packetCommand,
  'spec-read': specReadCommand,
  'spec-index': specIndexCommand,
  run: runCommand,
  'usage-report': usageReportCommand,
  'repo-plan': repoPlanCommand,
  'commit-plan': commitPlanCommand,
  'prepare-repos': prepareReposCommand,
  'gate-check': gateCheckCommand,
  'changed-files': changedFilesCommand,
  'detect-siblings': detectSiblingsCommand,
  'contract-drift': contractDriftCommand,
};

/**
 * Run the CLI. `io` is injectable so tests can capture output.
 * Returns an exit code; does not touch process.
 */
export async function run(argv, io = { out: console.log, err: console.error }) {
  const parsed = parseArgs(argv);

  if (parsed.error) {
    io.err(`error: ${parsed.error}`);
    io.err('');
    io.err(helpText());
    return EXIT.USAGE;
  }

  if (parsed.version) {
    io.out(readPackageVersion());
    return EXIT.OK;
  }

  if (parsed.help || parsed.command === null) {
    io.out(helpText());
    return EXIT.OK;
  }

  const handler = HANDLERS[parsed.command];
  if (!handler) {
    io.err(`error: unknown command '${parsed.command}'`);
    io.err('');
    io.err(helpText());
    return EXIT.USAGE;
  }

  if (parsed.command !== 'install' && !parsed.flags.json && !anyTargetInstalled()) {
    io.out(`playbook-ai ${readPackageVersion()} — skills not installed for any target, run \`playbook install\`.`);
  }

  return handler(parsed, io);
}
