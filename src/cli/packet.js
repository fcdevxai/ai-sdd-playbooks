/**
 * `playbook packet <change-id>` — (re)generate context-packet.md from a
 * change's proposal.md + tasks.md. Deterministic: unchanged sources yield a
 * byte-identical file, so it's safe to re-run any time.
 */
import { EXIT } from './exit.js';
import { writePacket, defaultChangesDir, contractPortionFromConfig } from '../tokens/packet.js';
import { loadConfig } from '../config/config.js';

export async function packetCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const changeId = parsed.rest.find((a) => !a.startsWith('-'));
  if (!changeId) {
    io.err('error: playbook packet requires a <change-id>');
    return EXIT.USAGE;
  }

  let result;
  try {
    const { config } = loadConfig({ cwd });
    result = writePacket(changeId, defaultChangesDir(cwd), contractPortionFromConfig(config));
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }

  if (parsed.flags.json) {
    io.out(JSON.stringify({ command: 'packet', change: changeId, path: result.path, warnings: result.warnings }, null, 2));
  } else {
    io.out(`Wrote ${result.path}`);
    for (const w of result.warnings) io.out(`  ⚠ ${w}`);
  }
  return EXIT.OK;
}
