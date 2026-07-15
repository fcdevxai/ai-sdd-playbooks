/**
 * Pull request lookup (design §9). Reads the PR for a branch via `gh`.
 * Returns { state: 'OPEN'|'MERGED'|'CLOSED', number } or null when there is none.
 */
export function prForBranch(branch, runGh) {
  try {
    const out = runGh(['pr', 'view', branch, '--json', 'state,number']);
    const data = JSON.parse(out);
    return { state: data.state, number: data.number };
  } catch {
    return null; // no PR for this branch
  }
}
