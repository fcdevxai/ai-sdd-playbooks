// Runtime-gate adapter descriptor: worker (design §7).
export default {
  name: 'worker',
  capability: 'worker',
  support: 'supported',
  dependency: null,
  validates: [
    'real job trigger',
    'real consumer processing',
    'observable side effect',
    'retry/dead-letter path',
    'idempotency (when relevant)',
  ],
};
