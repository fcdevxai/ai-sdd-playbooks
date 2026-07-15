/**
 * GitHub context detection (design §9). Uses the `gh` CLI. When unavailable,
 * delivery must be reported `unknown` (never assumed).
 */
export function githubContext(runGh) {
  try {
    runGh(['auth', 'status']);
    return { available: true };
  } catch {
    return { available: false, reason: 'GITHUB_CONTEXT_UNAVAILABLE' };
  }
}
