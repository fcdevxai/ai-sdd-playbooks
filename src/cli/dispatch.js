/**
 * sdd CLI dispatcher — Phase 0 skeleton.
 *
 * Responsibilities in this phase:
 *   - parse global flags,
 *   - route the first positional to a command handler,
 *   - print help / usage,
 *   - return an exit code (never call process.exit — that is bin/sdd.js's job,
 *     which keeps run()/parseArgs() unit-testable).
 *
 * Command handlers are stubs until later phases implement them. Command-specific
 * flags (e.g. `validate --ci`) are NOT parsed here; they are forwarded to the
 * command in `rest` for a future phase to handle.
 */

import { EXIT } from './exit.js';
import { validateCommand } from './validate.js';
import { installCommand } from './install.js';
import { statusCommand, nextCommand } from './status.js';
import { syncCommand } from './sync.js';
import { initCommand } from './init.js';
import { doctorCommand } from './doctor.js';
import { migrateCommand } from './migrate.js';

// Exit-code map (design §1.4) lives in ./exit.js to avoid a dispatch↔command cycle.
export { EXIT };

// The full command surface (AC-01). Order defines help output.
export const COMMAND_NAMES = [
  'install',
  'init',
  'doctor',
  'status',
  'next',
  'validate',
  'sync',
  'migrate',
];

const COMMAND_SUMMARIES = {
  install: 'Install/refresh core skills into the global agent dirs.',
  init: 'Scaffold/connect project-local structure (never overwrites).',
  doctor: 'Read-only diagnostics (optionally --fix for safe additive fixes).',
  status: 'Print both dimensions: lifecycle + GitHub delivery.',
  next: 'Print the single next valid action (combines both dimensions).',
  validate: 'Validate artifacts/config against schemas (--ci for pipelines).',
  sync: 'Reconcile installed global skills with the compatible range.',
  migrate: 'Convert a 1.x consumer to 2.0 (diff-then-confirm).',
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

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
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

  return { command, rest, flags, help };
}

export function helpText() {
  return [
    'sdd — Spec-Driven Development CLI',
    '',
    'Usage: sdd <command> [options]',
    '',
    'Commands:',
    ...COMMAND_NAMES.map((name) => `  ${name.padEnd(9)} ${COMMAND_SUMMARIES[name]}`),
    '',
    'Global options:',
    '  --json           Machine-readable output',
    '  --cwd <path>     Run as if in <path>',
    '  --config <path>  Use an explicit sdd.config.yaml',
    '  --quiet          Reduce output',
    '  --yes            Assume confirmation (diffs are still shown)',
    '  -h, --help       Show this help',
  ].join('\n');
}

function stubHandler(name) {
  return async (_parsed, io) => {
    io.out(`sdd ${name}: not implemented yet (Phase 0 skeleton)`);
    return EXIT.OK;
  };
}

const HANDLERS = Object.fromEntries(
  COMMAND_NAMES.map((name) => [name, stubHandler(name)]),
);
// Real handlers replace stubs as phases implement them.
HANDLERS.validate = validateCommand;
HANDLERS.install = installCommand;
HANDLERS.status = statusCommand;
HANDLERS.next = nextCommand;
HANDLERS.sync = syncCommand;
HANDLERS.init = initCommand;
HANDLERS.doctor = doctorCommand;
HANDLERS.migrate = migrateCommand;

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

  return handler(parsed, io);
}
