// Runtime-gate adapter descriptor: browser (design §7). SUPPORTED.
export default {
  name: 'browser',
  capability: 'browser',
  support: 'supported',
  dependency: 'playwright-mcp', // absent → blocked: DEPENDENCY_UNAVAILABLE (no fabricated evidence)
  validates: [
    'ux flow (happy path end-to-end)',
    'accessibility basics (keyboard, labels, contrast)',
    'responsive states (mobile/tablet/desktop)',
    'ui-backend integration (real responses, not mocks)',
    'network requests (status, payload)',
    'auth on protected routes',
    'console errors during the successful flow',
  ],
};
