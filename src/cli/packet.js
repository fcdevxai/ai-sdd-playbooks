/**
 * `playbook packet <change-id>` — (re)generate context-packet.md from a
 * change's proposal.md + tasks.md. Deterministic: unchanged sources yield a
 * byte-identical file, so it's safe to re-run any time.
 */
import { EXIT } from './exit.js';
import { writePacket, defaultChangesDir, contractPortionFromConfig } from '../tokens/packet.js';
import { buildHandoffManifest, writeHandoffManifest } from '../tokens/handoff.js';
import { loadConfig } from '../config/config.js';
import fs from 'node:fs';
import path from 'node:path';
import matter from '../util/frontmatter.js';
import { readEvidenceFile } from '../util/fs-safe.js';

function valueAfter(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

export async function packetCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const changeId = parsed.rest[0];
  if (!changeId) {
    io.err('error: playbook packet requires a <change-id>');
    return EXIT.USAGE;
  }

  let result;
  try {
    const { config } = loadConfig({ cwd });
    const tasksPath = path.join(defaultChangesDir(cwd), changeId, 'tasks.md');
    const hasHandoff = !!fs.lstatSync(tasksPath, { throwIfNoEntry: false })
      && !!matter(readEvidenceFile(cwd, path.relative(cwd, tasksPath), 'utf8')).data.handoff;
    const stage = valueAfter(parsed.rest, '--stage');
    const agent = valueAfter(parsed.rest, '--agent');
    const producer = { cwd, stage, agent, provider: valueAfter(parsed.rest, '--provider') || 'unknown', model: valueAfter(parsed.rest, '--model') || 'unknown' };
    if (hasHandoff) buildHandoffManifest(changeId, producer);
    result = writePacket(changeId, defaultChangesDir(cwd), contractPortionFromConfig(config));
    if (hasHandoff) result.handoff = writeHandoffManifest(changeId, producer).path;
  } catch (err) {
    io.err(`error: ${err.message}`);
    return EXIT.VIOLATION;
  }

  if (parsed.flags.json) {
    io.out(JSON.stringify({ command: 'packet', change: changeId, path: result.path, handoff: result.handoff || null, warnings: result.warnings }, null, 2));
  } else {
    io.out(`Wrote ${result.path}`);
    if (result.handoff) io.out(`Wrote ${result.handoff}`);
    for (const w of result.warnings) io.out(`  ⚠ ${w}`);
  }
  return EXIT.OK;
}
