/** Explicit evidence lineage and safe closure retention operations. */
import { EXIT } from './exit.js';
import { bindEvidence } from '../tokens/binding.js';
import { retainEvidence } from '../tokens/retention.js';
import { sealReport } from '../tokens/seal.js';

export async function evidenceCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const [action, changeId, report] = parsed.rest;
  if (!changeId || !['seal', 'bind', 'retain'].includes(action)) {
    io.err('error: usage: playbook evidence seal <change-id> <report-name> --receipt <path> | bind <change-id> <report-name> | retain <change-id> --raw-destination <absolute-path>');
    return EXIT.USAGE;
  }
  try {
    if (['seal', 'bind'].includes(action) && !report) {
      io.err(`error: playbook evidence ${action} requires a report name`);
      return EXIT.USAGE;
    }
    const rawIndex = parsed.rest.indexOf('--raw-destination');
    const rawDestination = rawIndex >= 0 ? parsed.rest[rawIndex + 1] : null;
    if (action === 'retain' && !rawDestination) {
      io.err('error: playbook evidence retain requires --raw-destination <absolute-path>');
      return EXIT.USAGE;
    }
    const receipts = parsed.rest.flatMap((part, index) => part === '--receipt' ? [parsed.rest[index + 1]] : []);
    const result = action === 'seal'
      ? sealReport(changeId, report, { cwd, receipts })
      : action === 'bind' ? bindEvidence(changeId, report, { cwd })
        : retainEvidence(changeId, { cwd, rawDestination });
    if (parsed.flags.json) io.out(JSON.stringify(result, null, 2));
    else if (action === 'bind') {
      for (const binding of result.bindings) io.out(`Bound ${binding.repository}: ${binding.previous_commit_sha} -> ${binding.current_commit_sha}`);
      for (const file of result.existing) io.out(`Already bound: covered by ${file}`);
    }
    else if (action === 'seal') io.out(`Sealed ${result.report} with ${result.source_binding.receipts.length} receipt(s)`);
    else io.out(`Retained closure: ${result.archive}`);
    return EXIT.OK;
  } catch (error) {
    io.err(`error: ${error.message}`);
    return EXIT.VIOLATION;
  }
}
