// Runtime-gate adapter descriptor: cli (design §7). EXPERIMENTAL — blocks when applicable.
export default {
  name: 'cli',
  capability: 'cli',
  support: 'experimental',
  dependency: null,
  validates: [
    'command invocations',
    'exit codes',
    'stdout/stderr contracts',
  ],
};
