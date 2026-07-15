/**
 * CI check status for a branch's PR (design §9). Returns
 * 'failed' | 'pending' | 'passed' | 'none'. Never assumes success.
 */
export function checksState(branch, runGh) {
  let out;
  try {
    out = runGh(['pr', 'checks', branch]);
  } catch {
    return 'none';
  }
  const low = String(out).toLowerCase();
  if (/fail|error/.test(low)) return 'failed';
  if (/pending|in_progress|queued/.test(low)) return 'pending';
  if (/pass|success/.test(low)) return 'passed';
  return 'none';
}
