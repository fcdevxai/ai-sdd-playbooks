// Runtime-gate adapter descriptor: http (design §7). SUPPORTED.
export default {
  name: 'http',
  capability: 'http',
  support: 'supported',
  dependency: null,
  validates: [
    'REST routes reachable',
    'authentication',
    'authorization',
    'request/response contracts',
    'persistence (writes are durable)',
    'failure paths (4xx/5xx handled)',
  ],
};
