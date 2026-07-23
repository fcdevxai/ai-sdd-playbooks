/**
 * `playbook usage-report [--json]` — offline token accounting from local Claude
 * Code transcripts (delegates to src/tokens/usage-report.js). Read-only: it
 * summarizes `~/.claude/projects/<slug>/*.jsonl`, never writes or uploads.
 */
import os from 'node:os';
import path from 'node:path';
import { EXIT } from './exit.js';
import { findTranscripts, parseClaudeTranscript, formatTable } from '../tokens/usage-report.js';

export async function usageReportCommand(parsed, io) {
  const cwd = parsed.flags.cwd || process.cwd();
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  const files = findTranscripts(projectsDir, cwd);
  if (files.length === 0) {
    io.out(`No Claude Code transcripts found under ${projectsDir}.`);
    return EXIT.OK;
  }
  const summaries = files
    .map(parseClaudeTranscript)
    .sort((a, b) => (b.inputTokens + b.cacheReadTokens) - (a.inputTokens + a.cacheReadTokens));
  if (parsed.flags.json) {
    io.out(JSON.stringify(summaries, null, 2));
    return EXIT.OK;
  }
  io.out(formatTable(summaries).trimEnd());
  return EXIT.OK;
}
