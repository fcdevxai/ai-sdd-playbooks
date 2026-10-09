/**
 * Adversarial probes (capture subsystem): NORMAL summary accuracy under design F06.
 * Each test asserts the SAFE behaviour; a failure is a confirmed finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureRun, captureRunSync } from '../src/tokens/capture.js';

const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'audit-capture-summary-'));
const node = (source) => [process.execPath, '-e', source];
const opts = (cwd, source) => ({ argv: node(source), cwd, changeId: 'demo', step: 'apply', harness: 'codex', repoName: 'repo', agent: 'Codex' });

test('AUD-S1: Laravel `php artisan test` totals never become an invented test count, and skips stay visible', { todo: 'Non-blocking follow-up under design Amendment R6 (round 7 audit N1-N5): summary accuracy only; raw evidence, exit code and receipt are intact.' }, async () => {
  const cwd = root();
  const out = '  PASS  Tests\\\\Unit\\\\ExampleTest\\n  WARN  Tests\\\\Feature\\\\SkippedTest\\n\\n  Tests:    2 skipped, 40 passed (120 assertions)\\n  Duration: 1.20s\\n';
  const result = await captureRun(opts(cwd, `process.stdout.write("${out}")`));
  assert.equal(result.exitCode, 0);
  assert.ok(result.result.tests === null || result.result.tests === 42, `invented test count: ${result.result.tests}; summary: ${result.summary}`);
  assert.match(result.summary, /skip/i, `skipped tests hidden: ${result.summary}`);
});

test('AUD-S1b: same Laravel totals through the synchronous gate-check capture', { todo: 'Non-blocking follow-up under design Amendment R6 (round 7 audit N1-N5): summary accuracy only; raw evidence, exit code and receipt are intact.' }, () => {
  const cwd = root();
  const out = '  Tests:    3 skipped, 7 passed (20 assertions)\\n';
  const result = captureRunSync({ ...opts(cwd, `process.stdout.write("${out}")`), step: 'gate-check' });
  assert.ok(result.result.tests === null || result.result.tests === 10, `invented test count: ${result.result.tests}; summary: ${result.summary}`);
  assert.match(result.summary, /skip/i, `skipped tests hidden: ${result.summary}`);
});

test('AUD-S2: PHPUnit 10+ totals line keeps warning presence visible', { todo: 'Non-blocking follow-up under design Amendment R6 (round 7 audit N1-N5): summary accuracy only; raw evidence, exit code and receipt are intact.' }, async () => {
  const cwd = root();
  const out = 'OK, but there were issues!\\nTests: 10, Assertions: 20, Warnings: 1, Deprecations: 2.\\n';
  const result = await captureRun(opts(cwd, `process.stdout.write("${out}")`));
  assert.equal(result.exitCode, 0);
  assert.match(result.summary, /warn/i, `warning presence lost: ${result.summary}`);
});

test('AUD-S3: a failure tail that drops earlier lines discloses the display truncation', { todo: 'Non-blocking follow-up under design Amendment R6 (round 7 audit N1-N5): summary accuracy only; raw evidence, exit code and receipt are intact.' }, async () => {
  const cwd = root();
  const result = await captureRun(opts(cwd, 'for (let i = 0; i < 100; i++) console.error("diagnostic line " + i); process.exit(1)'));
  assert.equal(result.exitCode, 1);
  assert.doesNotMatch(result.summary, /diagnostic line 0\n/);
  assert.match(result.summary, /omitted|truncat|earlier|more line/i, `silent line truncation: ${result.summary.slice(0, 200)}`);
});

test('AUD-S4: the failure display is bounded in bytes, not only in UTF-16 units', { todo: 'Non-blocking follow-up under design Amendment R6 (round 7 audit N1-N5): summary accuracy only; raw evidence, exit code and receipt are intact.' }, async () => {
  const cwd = root();
  const result = await captureRun(opts(cwd, 'for (let i = 0; i < 60; i++) console.error("\\u{1F600}".repeat(700)); process.exit(1)'));
  assert.equal(result.exitCode, 1);
  const bytes = Buffer.byteLength(result.summary);
  assert.ok(bytes <= 41000, `display is ${bytes} bytes, above the 40000 display bound`);
});

test('AUD-S5: child terminal control sequences cannot disguise a failure in the NORMAL summary', { todo: 'Non-blocking follow-up under design Amendment R6 (round 7 audit N1-N5): summary accuracy only; raw evidence, exit code and receipt are intact.' }, async () => {
  const cwd = root();
  // Fake success line followed by "conceal" so the real status line is invisible on a terminal.
  const result = await captureRun(opts(cwd, 'process.stderr.write("\\u2713 passed (12 tests, 40 assertions)\\n\\u001b[8m"); process.exit(1)'));
  assert.equal(result.exitCode, 1);
  assert.doesNotMatch(result.summary, /\u001b/, `raw ESC reaches the summary: ${JSON.stringify(result.summary)}`);
});
