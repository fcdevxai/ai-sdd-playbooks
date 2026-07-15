// Runtime-gate adapter descriptor: worker (design §7). EXPERIMENTAL — blocks when applicable.
export default {
  name: 'worker',
  capability: 'worker',
  support: 'experimental',
  dependency: null,
  validates: [
    'message handling',
    'retries',
    'observable side effects',
  ],
};
