// Exit-code map (design §1.4). Kept in its own module so command handlers and
// the dispatcher can share it without an import cycle.
export const EXIT = {
  OK: 0, // healthy / passed
  VIOLATION: 1, // schema or state violation (CI-actionable)
  BLOCKED: 2, // a gate found blocking issues
  USAGE: 3, // usage error
  ENVIRONMENT: 4, // environment / precondition error
};
