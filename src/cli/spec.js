/**
 * `playbook spec-read <file#anchor>` and `playbook spec-index` — section-first
 * reads over permanent specs, backed by a structural index cache. The index
 * stores navigation only (headings + line ranges); a section's real body is
 * always read live from disk by spec-read.
 */
import { EXIT } from './exit.js';
import { readSpecSection, buildSpecIndex, writeSpecIndex, defaultSpecIndexPath } from '../tokens/spec-index.js';

export async function specReadCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const reference = parsed.rest.find((a) => !a.startsWith('-'));
  if (!reference) {
    io.err('error: usage: playbook spec-read <openspec/specs/file.md#anchor>');
    return EXIT.USAGE;
  }
  try {
    const body = readSpecSection(reference, { cwd });
    io.out(body);
    return EXIT.OK;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}

export async function specIndexCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  try {
    const index = buildSpecIndex(cwd);
    const indexPath = writeSpecIndex(index, defaultSpecIndexPath(cwd));
    if (parsed.flags.json) {
      io.out(JSON.stringify({ command: 'spec-index', path: indexPath, files: index.files.length }, null, 2));
    } else {
      io.out(`Wrote ${indexPath} (${index.files.length} file(s)).`);
    }
    return EXIT.OK;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }
}
