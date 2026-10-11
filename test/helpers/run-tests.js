#!/usr/bin/env node
/**
 * `npm test` entry point: runs `node --test` with one temporary root per run.
 *
 * Many tests create fixture directories with `fs.mkdtempSync(os.tmpdir())` and leave them
 * behind (about 1,080 directories, 300 MB per full run). The runner owns that space instead
 * of every test file: it creates a root under the inherited temporary directory, passes it to
 * the test processes as `TMPDIR`, and removes it on success, failure and SIGINT/SIGTERM.
 * The parent temporary directory is whatever `os.tmpdir()` resolves (it honors `TMPDIR`).
 *
 *   node test/helpers/run-tests.js                     # every test/*.test.js
 *   node test/helpers/run-tests.js test/x.test.js ...  # only the named files
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RUN_ROOT_PREFIX = 'playbook-test-run-';

/** Creates this run's temporary root directly under `parent`. */
export function createRunRoot(parent = os.tmpdir()) {
  return fs.mkdtempSync(path.join(parent, RUN_ROOT_PREFIX));
}

/**
 * Removes a run root, and only that: a real directory (not a symbolic link) that is a direct
 * child of `parent` and carries the runner prefix. Anything else is refused.
 */
export function removeRunRoot(root, parent) {
  const resolvedParent = path.resolve(parent);
  const resolvedRoot = path.resolve(root);
  const stat = fs.lstatSync(resolvedRoot, { throwIfNoEntry: false });
  if (path.dirname(resolvedRoot) !== resolvedParent
    || !path.basename(resolvedRoot).startsWith(RUN_ROOT_PREFIX)
    || (stat && !stat.isDirectory())) {
    throw new Error(`refusing to remove ${root}: not a test run root under ${parent}`);
  }
  if (stat) fs.rmSync(resolvedRoot, { recursive: true, force: true });
}

/** The files the previous `node --test test/*.test.js` script expanded, relative to `cwd`. */
export function defaultTestFiles(cwd) {
  return fs.readdirSync(path.join(cwd, 'test'))
    .filter((name) => name.endsWith('.test.js'))
    .sort()
    .map((name) => `test/${name}`);
}

const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM'];

/** Runs the suite and resolves with `{ code, signal }` once the root is removed. */
export function runTests({ files, cwd = process.cwd(), parent = os.tmpdir(), env = process.env } = {}) {
  let root;
  try {
    root = createRunRoot(parent);
  } catch (error) {
    return Promise.reject(new Error(`cannot create the test temporary root under ${parent}: ${error.message}`));
  }
  const targets = files && files.length ? files : defaultTestFiles(cwd);
  // Its own process group, so a forwarded signal also reaches the per-file test processes.
  const groupLeader = process.platform !== 'win32';
  const child = spawn(process.execPath, ['--test', ...targets],
    { cwd, env: { ...env, TMPDIR: root }, stdio: 'inherit', detached: groupLeader });
  let received = null;
  const forward = (signal) => {
    received = received || signal;
    try { process.kill(groupLeader ? -child.pid : child.pid, signal); } catch { /* already gone */ }
  };
  for (const signal of FORWARDED_SIGNALS) process.on(signal, forward);
  return new Promise((resolve) => {
    const finish = (code, signal) => {
      for (const name of FORWARDED_SIGNALS) process.off(name, forward);
      removeRunRoot(root, parent);
      resolve({ code, signal: received || signal });
    };
    child.on('error', () => finish(1, null));
    child.on('exit', finish);
  });
}

async function main() {
  let outcome;
  try {
    outcome = await runTests({ files: process.argv.slice(2) });
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exit(2);
  }
  if (outcome.signal) {
    // Conventional signal status: end this process with the same signal.
    process.kill(process.pid, outcome.signal);
    return;
  }
  process.exit(outcome.code ?? 1);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(fileURLToPath(import.meta.url)).href) {
  main();
}
