import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectCapabilities } from '../src/config/detect-capabilities.js';

function repo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-detect-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

test('detects browser + http from frontend and server deps', () => {
  const dir = repo({ 'package.json': { dependencies: { react: '^18', express: '^4' } } });
  const c = detectCapabilities(dir);
  assert.equal(c.browser, true);
  assert.equal(c.http, true);
  assert.equal(c.cli, false);
  assert.equal(c.worker, false);
  assert.ok(c.signals.some((s) => s.includes('react')));
  assert.ok(c.signals.some((s) => s.includes('express')));
});

test('detects cli from a package.json bin field', () => {
  const dir = repo({ 'package.json': { bin: { mytool: 'bin/x.js' } } });
  assert.equal(detectCapabilities(dir).cli, true);
});

test('detects worker from a queue/broker dependency', () => {
  const dir = repo({ 'package.json': { dependencies: { bullmq: '^5' } } });
  assert.equal(detectCapabilities(dir).worker, true);
});

test('detects http from composer.json (PHP web app)', () => {
  const dir = repo({ 'composer.json': '{}' });
  assert.equal(detectCapabilities(dir).http, true);
});

test('detects browser from playwright even without a frontend framework', () => {
  const dir = repo({ 'package.json': { devDependencies: { '@playwright/test': '^1' } } });
  assert.equal(detectCapabilities(dir).browser, true);
});

test('an empty repo yields all-false with no signals', () => {
  const dir = repo({});
  const c = detectCapabilities(dir);
  assert.deepEqual({ browser: c.browser, http: c.http, cli: c.cli, worker: c.worker }, {
    browser: false, http: false, cli: false, worker: false,
  });
  assert.deepEqual(c.signals, []);
});

test('detects http + worker from a python project', () => {
  const dir = repo({ 'requirements.txt': 'fastapi==0.110\ncelery==5.3\n' });
  const c = detectCapabilities(dir);
  assert.equal(c.http, true);
  assert.equal(c.worker, true);
});
