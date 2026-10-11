/**
 * Pull request lookup (design §9). Reads the PR for a branch via `gh`.
 * Returns { state: 'OPEN'|'MERGED'|'CLOSED', number, headRefOid, mergeCommitOid } or null
 * when there is none. `mergeCommitOid` is the commit GitHub recorded when it merged the pull
 * request (merge commit, squash commit or last rebased commit), or null.
 */
export function prForBranch(branch, runGh) {
  try {
    const out = runGh(['pr', 'view', branch, '--json', 'state,number,headRefOid,mergeCommit']);
    const data = JSON.parse(out);
    return {
      state: data.state,
      number: data.number,
      headRefOid: data.headRefOid || null,
      mergeCommitOid: data.mergeCommit?.oid || null,
    };
  } catch {
    return null; // no PR for this branch
  }
}
