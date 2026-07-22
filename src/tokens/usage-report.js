#!/usr/bin/env node

/**
 * usage-report — offline token accounting from Claude Code transcripts.
 *
 * Reads ~/.claude/projects/<slug>/*.jsonl (the harness's own per-session
 * transcripts), sums input/output/cache-read tokens per session, and attaches
 * the sdd-* skill(s) invoked in that session — detected from the
 * "Launching skill: <slug>" tool_result the Skill tool emits. Prints a compact
 * table to stdout. Read-only: never writes, never uploads. The transcripts
 * already live on this machine; this only summarizes them.
 *
 * This is the Phase-1 measurement adapter for Claude Code. The Codex adapter
 * is a documented stub (parseCodexSession) until Codex's session format is
 * verified.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_MARKER = /^Launching skill: (sdd-[a-z-]+)/m;

/** All text carried by a transcript message, whether content is a string or an array of parts. */
export function messageText(entry) {
  const content = entry?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (typeof part?.content === 'string') return part.content;
      if (typeof part?.text === 'string') return part.text;
      return '';
    })
    .join('\n');
}

/**
 * Parses one Claude Code transcript file into a per-session summary:
 * { sessionId, commands: string[], inputTokens, outputTokens, cacheReadTokens }.
 * Token totals come from assistant messages' `usage`; commands from the
 * "Launching skill:" markers. A truncated/partial trailing line is skipped, not
 * fatal.
 */
export function parseClaudeTranscript(filePath) {
  const summary = {
    sessionId: path.basename(filePath, '.jsonl'),
    commands: new Set(),
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
  };
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.sessionId) summary.sessionId = entry.sessionId;

    const usage = entry?.message?.usage;
    if (entry.type === 'assistant' && usage) {
      summary.inputTokens += usage.input_tokens || 0;
      summary.outputTokens += usage.output_tokens || 0;
      summary.cacheReadTokens += usage.cache_read_input_tokens || 0;
    }

    const match = messageText(entry).match(SKILL_MARKER);
    if (match) summary.commands.add(match[1]);
  }
  return { ...summary, commands: [...summary.commands].sort() };
}

/**
 * Codex adapter — not yet implemented. Codex's session transcript format has
 * not been verified, so this stub throws rather than guessing. It is a
 * documented extension point, never called by the main flow.
 */
export function parseCodexSession() {
  throw new Error('Codex session format not yet verified — Codex usage telemetry is a future extension.');
}

/** Encodes an absolute project path the way Claude Code names its transcript directory. */
export function projectSlug(cwd = process.cwd()) {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * The transcript files to summarize: the current project's directory when it
 * exists, otherwise every project (so a rename or unusual path still yields a
 * report instead of silence).
 */
export function findTranscripts(projectsDir, cwd = process.cwd()) {
  if (!fs.existsSync(projectsDir)) return [];
  const currentDir = path.join(projectsDir, projectSlug(cwd));
  const dirs =
    fs.existsSync(currentDir) && fs.statSync(currentDir).isDirectory()
      ? [currentDir]
      : fs
          .readdirSync(projectsDir)
          .map((d) => path.join(projectsDir, d))
          .filter((d) => fs.statSync(d).isDirectory());

  const files = [];
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.jsonl')) files.push(path.join(dir, f));
    }
  }
  return files;
}

export function formatTable(summaries) {
  const header = ['SESSION', 'COMMAND(S)', 'INPUT', 'OUTPUT', 'CACHE-READ'];
  const rows = summaries.map((s) => [
    s.sessionId.slice(0, 8),
    s.commands.length ? s.commands.join(',') : '(none)',
    String(s.inputTokens),
    String(s.outputTokens),
    String(s.cacheReadTokens),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [line(header), ...rows.map(line)].join('\n') + '\n';
}

function main() {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  const files = findTranscripts(projectsDir);
  if (files.length === 0) {
    console.log(`No Claude Code transcripts found under ${projectsDir}.`);
    return;
  }
  const summaries = files
    .map(parseClaudeTranscript)
    .sort((a, b) => b.inputTokens + b.cacheReadTokens - (a.inputTokens + a.cacheReadTokens));
  process.stdout.write(formatTable(summaries));
}

// Run only when invoked directly, so tests can import the parsers without side effects.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
