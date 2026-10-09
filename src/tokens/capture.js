import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import { runsDir, persistRun } from './run.js';
import { manifestContext, observeSource, writeExecutionReceipt } from './receipt.js';

const MAX_LINE_BYTES = 1200;
const MAX_TAIL_LINES = 40;
const MAX_DISPLAY_BYTES = 40000;

function createLineCollector() {
  const tail = [];
  const decoder = new StringDecoder('utf8');
  let pending = '';
  let pendingTruncated = false;
  let lines = 0;
  let tests = null;
  let assertions = null;
  let warnings = 0;
  let skips = 0;
  let incomplete = 0;

  function acceptLine(line) {
    lines++;
    const normalized = line.replace(/\r$/, '');
    const phpTotals = normalized.match(/^\s*Tests?:\s*([\d,]+)\b/i);
    const tapTotals = normalized.match(/^#\s*tests\s+([\d,]+)\s*$/i);
    const assertionsTotal = normalized.match(/(?:^\s*|,\s*)Assertions?:\s*([\d,]+)\b/i);
    const skippedTotal = normalized.match(/(?:^\s*|,\s*)Skipped:\s*([\d,]+)\b|^#\s*skipped?\s+([\d,]+)\s*$/i);
    const incompleteTotal = normalized.match(/(?:^\s*|,\s*)Incomplete:\s*([\d,]+)\b/i);
    if (phpTotals || tapTotals) tests = Number((phpTotals || tapTotals)[1].replaceAll(',', ''));
    if (assertionsTotal) assertions = Number(assertionsTotal[1].replaceAll(',', ''));
    if (/^\s*(?:PHP\s+)?WARN(?:ING)?S?[:!]/i.test(normalized)) warnings++;
    if (skippedTotal) skips = Number((skippedTotal[1] || skippedTotal[2]).replaceAll(',', ''));
    else if (/^\s*(?:ok|not ok)\s+\d+.*#\s*SKIP\b/i.test(normalized)) skips++;
    if (incompleteTotal) incomplete = Number(incompleteTotal[1].replaceAll(',', ''));
    tail.push(normalized.slice(0, MAX_LINE_BYTES) + (pendingTruncated || normalized.length > MAX_LINE_BYTES ? '…[display truncated]' : ''));
    if (tail.length > MAX_TAIL_LINES) tail.shift();
    pendingTruncated = false;
  }

  function addText(text) {
    for (const character of text) {
      if (character === '\n') {
        acceptLine(pending);
        pending = '';
      } else if (pending.length < MAX_LINE_BYTES) {
        pending += character;
      } else {
        pendingTruncated = true;
      }
    }
  }

  return {
    accept(chunk) { addText(decoder.write(chunk)); },
    finish() {
      addText(decoder.end());
      if (pending || pendingTruncated) acceptLine(pending);
      return { lines, tests, assertions, warnings, skips, incomplete, tail };
    },
  };
}

/** Aggregate per-stream counters; totals come from whichever stream reported them (stdout first). */
function mergeStreams(stdout, stderr, combined) {
  return {
    lines: combined.lines,
    tests: stdout.tests ?? stderr.tests,
    assertions: stdout.assertions ?? stderr.assertions,
    warnings: stdout.warnings + stderr.warnings,
    skips: stdout.skips + stderr.skips,
    incomplete: stdout.incomplete + stderr.incomplete,
    tail: combined.tail,
  };
}

function allocateRunDir(cwd) {
  const root = runsDir(cwd);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const dir = fs.mkdtempSync(path.join(root, `${Date.now()}-${randomUUID().slice(0, 8)}-`));
  fs.chmodSync(dir, 0o700);
  return dir;
}

function allocateFiles(cwd) {
  const dir = allocateRunDir(cwd);
  const paths = {
    stdout: path.join(dir, 'stdout.raw'),
    stderr: path.join(dir, 'stderr.raw'),
    combined: path.join(dir, 'full.log'),
  };
  const fds = {};
  try {
    for (const [key, file] of Object.entries(paths)) fds[key] = fs.openSync(file, 'wx', 0o600);
  } catch (error) {
    for (const fd of Object.values(fds)) fs.closeSync(fd);
    throw error;
  }
  return { dir, paths, fds };
}

function writeAll(fd, chunk) {
  let written = 0;
  while (written < chunk.length) {
    const count = fs.writeSync(fd, chunk, written, chunk.length - written);
    if (count <= 0) throw new Error('raw evidence write made no progress');
    written += count;
  }
}

/**
 * Synchronous capture for gate-check. Each stream goes straight to its own file (no pipe, so
 * nothing is lost when the child exits early) and is parsed on its own; `full.log` is stdout
 * followed by stderr, because a synchronous capture does not record cross-stream order (an
 * accepted limit). Every error after the child ran keeps the child's own exit code, signal and
 * spawn error, reported separately from the capture error (design F06; Issues 18 and 19).
 */
export function captureRunSync({ argv, cwd, evidenceCwd = cwd, changeId, step, harness, metadata = {}, repoName = path.basename(cwd), agent = 'unknown', provider = 'unknown', model = 'unknown', container = 'unknown' }) {
  const before = observeSource({ repoRoot: cwd, hubCwd: evidenceCwd, changeId, repoName });
  const manifestBefore = manifestContext(evidenceCwd, changeId);
  const files = allocateFiles(evidenceCwd);
  const startedAt = new Date().toISOString();
  let captureError = null;
  let child = null;
  try {
    // A spawn error is recorded in the summary and telemetry, never written into the child's raw streams.
    child = spawnSync(argv[0], argv.slice(1), { cwd, shell: false, stdio: ['ignore', files.fds.stdout, files.fds.stderr] });
  } catch (error) {
    captureError = error;
  }
  for (const key of ['stdout', 'stderr']) {
    try { fs.fsyncSync(files.fds[key]); } catch (error) { captureError ||= error; }
    try { fs.closeSync(files.fds[key]); } catch (error) { captureError ||= error; }
  }
  const exitCode = child ? childExitCode({ status: child.status, error: child.error, signal: child.signal }) : 1;
  const signal = child?.signal || null;
  const spawnError = child?.error?.message || null;

  const collectors = { stdout: createLineCollector(), stderr: createLineCollector(), combined: createLineCollector() };
  const hash = { stdout: createHash('sha256'), stderr: createHash('sha256'), combined: createHash('sha256') };
  const bytes = { stdout: 0, stderr: 0, combined: 0 };
  try {
    for (const key of ['stdout', 'stderr']) {
      const readFd = fs.openSync(files.paths[key], 'r');
      try {
        const buffer = Buffer.allocUnsafe(65536);
        let count;
        while ((count = fs.readSync(readFd, buffer, 0, buffer.length, null)) > 0) {
          const chunk = Buffer.from(buffer.subarray(0, count));
          writeAll(files.fds.combined, chunk);
          collectors[key].accept(chunk);
          collectors.combined.accept(chunk);
          hash[key].update(chunk);
          hash.combined.update(chunk);
          bytes[key] += count;
          bytes.combined += count;
        }
      } finally { fs.closeSync(readFd); }
    }
    fs.fsyncSync(files.fds.combined);
  } catch (error) {
    captureError ||= error;
  } finally {
    try { fs.closeSync(files.fds.combined); } catch (error) { captureError ||= error; }
  }
  const result = mergeStreams(collectors.stdout.finish(), collectors.stderr.finish(), collectors.combined.finish());
  const rawFiles = Object.fromEntries(Object.entries(files.paths).map(([key, file]) => [key, { path: file, bytes: bytes[key], sha256: hash[key].digest('hex') }]));
  const logPath = files.paths.combined;
  const summary = displaySummary({ exitCode, result, logPath, childError: spawnError });
  const outcome = { status: child?.status ?? null, signal, spawnError };
  if (captureError) return { exitCode, childOutcome: outcome, logPath, captureError, rawFiles, result, summary };
  try {
    const finishedAt = new Date().toISOString();
    const after = observeSource({ repoRoot: cwd, hubCwd: evidenceCwd, changeId, repoName });
    const receipt = writeExecutionReceipt({ runDir: files.dir, argv, cwd, hubCwd: evidenceCwd, repoName,
      changeId, stage: step, agent, provider, model, container, before, after, rawFiles,
      startedAt, endedAt: finishedAt, exitCode, signal, captureError: null, summary, manifestBefore });
    const telemetry = persistRun({
      command: argv.join(' '), changeId, step, harness, exitCode,
      cwd: evidenceCwd, runDir: files.dir, rawOutputLines: result.lines,
      metadata: { ...metadata, rawFiles, receipt: receipt.path, startedAt, finishedAt, signal, spawnError, summary },
    });
    return { ...telemetry, exitCode, childOutcome: outcome, summary, rawFiles, result, receiptPath: receipt.path, captureError: null };
  } catch (error) {
    return { exitCode, childOutcome: outcome, logPath, captureError: error, rawFiles, result, summary };
  }
}

async function writeRaw(writer, chunk) {
  if (!writer.write(chunk)) await once(writer, 'drain');
}

function displaySummary({ exitCode, result, logPath, childError }) {
  const detail = [];
  if (result.tests !== null) detail.push(`${result.tests} tests`);
  if (result.assertions !== null) detail.push(`${result.assertions} assertions`);
  if (result.warnings) detail.push(`${result.warnings} warning line(s)`);
  if (result.skips) detail.push(`${result.skips} skipped line(s)`);
  if (result.incomplete) detail.push(`${result.incomplete} incomplete line(s)`);
  if (detail.length === 0) detail.push('test totals unclassified');
  const status = exitCode === 0 ? '✓ passed' : `✗ exit ${exitCode}`;
  const diagnostics = exitCode !== 0 ? result.tail.join('\n').slice(-MAX_DISPLAY_BYTES) : '';
  return `${diagnostics ? `${diagnostics}\n` : ''}${status} (${detail.join(', ')}) — log: ${logPath}${childError ? ` — ${childError}` : ''}\n`;
}

/** Capture first; compact only after the raw streams and receipt are durable. */
export async function captureRun({ argv, cwd, evidenceCwd = cwd, changeId, step, harness, raw = false, metadata = {}, repoName = path.basename(cwd), agent = 'unknown', provider = 'unknown', model = 'unknown', container = 'unknown' }) {
  const before = observeSource({ repoRoot: cwd, hubCwd: evidenceCwd, changeId, repoName });
  const manifestBefore = manifestContext(evidenceCwd, changeId);
  const files = allocateFiles(evidenceCwd);
  // Semantic counters come from each stream on its own; the combined collector only feeds the display tail.
  const collectors = { stdout: createLineCollector(), stderr: createLineCollector(), combined: createLineCollector() };
  const hash = { stdout: createHash('sha256'), stderr: createHash('sha256'), combined: createHash('sha256') };
  const bytes = { stdout: 0, stderr: 0, combined: 0 };
  let captureError = null;
  let spawnError = null;
  let status = null;
  let signal = null;
  const startedAt = new Date().toISOString();

  try {
    const child = spawn(argv[0], argv.slice(1), { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('error', (error) => { spawnError = error; });
    const consume = async (stream, key, writer) => {
      try {
        for await (const chunk of stream) {
          writeAll(files.fds[key], chunk);
          writeAll(files.fds.combined, chunk);
          hash[key].update(chunk);
          hash.combined.update(chunk);
          bytes[key] += chunk.length;
          bytes.combined += chunk.length;
          collectors[key].accept(chunk);
          collectors.combined.accept(chunk);
          if (raw) await writeRaw(writer, chunk);
        }
      } catch (error) {
        captureError ||= error;
        child.kill('SIGTERM');
      }
    };
    const close = once(child, 'close').then(([code, killedBy]) => { status = code; signal = killedBy; }).catch((error) => {
      spawnError ||= error;
    });
    await Promise.all([consume(child.stdout, 'stdout', process.stdout), consume(child.stderr, 'stderr', process.stderr), close]);
  } catch (error) {
    captureError ||= error;
  } finally {
    for (const fd of Object.values(files.fds)) {
      try { fs.fsyncSync(fd); } catch (error) { captureError ||= error; }
      try { fs.closeSync(fd); } catch (error) { captureError ||= error; }
    }
  }

  const result = mergeStreams(collectors.stdout.finish(), collectors.stderr.finish(), collectors.combined.finish());
  const exitCode = childExitCode({ status, error: spawnError, signal });
  const rawFiles = Object.fromEntries(Object.entries(files.paths).map(([key, file]) => [key, {
    path: file,
    bytes: bytes[key],
    sha256: hash[key].digest('hex'),
  }]));
  const childError = spawnError?.message || null;
  const summary = displaySummary({ exitCode, result, logPath: files.paths.combined, childError });
  const finishedAt = new Date().toISOString();

  try {
    const after = observeSource({ repoRoot: cwd, hubCwd: evidenceCwd, changeId, repoName });
    const receipt = writeExecutionReceipt({ runDir: files.dir, argv, cwd, hubCwd: evidenceCwd, repoName,
      changeId, stage: step, agent, provider, model, container, before, after, rawFiles,
      startedAt, endedAt: finishedAt, exitCode, signal,
      captureError: captureError?.message || null, summary, manifestBefore });
    const telemetry = persistRun({
      command: argv.join(' '), changeId, step, harness, exitCode,
      cwd: evidenceCwd, runDir: files.dir, rawOutputLines: result.lines,
      metadata: { ...metadata, rawFiles, receipt: receipt.path, startedAt, finishedAt, signal, spawnError: childError, captureError: captureError?.message || null, summary },
    });
    return { ...telemetry, exitCode, summary, receiptPath: receipt.path, captureError, rawFiles, result };
  } catch (error) {
    return { exitCode, summary, captureError: captureError || error, rawFiles, result, logPath: files.paths.combined };
  }
}

/**
 * Wrapper exit status: the child's own status, 127 for executable-not-found,
 * 126 for a command that cannot be executed, `128 + signal number` for signal
 * termination, otherwise 1.
 */
export function childExitCode({ status, error, signal }) {
  if (typeof status === 'number') return status;
  if (error?.code === 'ENOENT') return 127;
  if (error?.code === 'EACCES' || error?.code === 'EPERM' || error?.code === 'ENOEXEC') return 126;
  if (signal) return 128 + (os.constants.signals[signal] || 0);
  return 1;
}
