/**
 * Capability detection heuristics (Option A).
 *
 * Best-effort, read-only inspection of a repository to PROPOSE project
 * capabilities (browser / http / cli / worker). This is the canonical, tested
 * implementation of the heuristics that `sdd-bootstrap-project` applies; the
 * skill presents the proposal and a human approves it (never auto-written).
 *
 * Returns { browser, http, cli, worker, signals[] } — signals explain each
 * true value so the proposal is reviewable.
 */
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = ['react', 'react-dom', 'vue', '@angular/core', 'svelte', '@sveltejs/kit', 'next', 'nuxt', 'solid-js', 'preact', 'astro'];
const HTTP_NODE = ['express', 'fastify', 'koa', '@nestjs/core', 'hapi', '@hapi/hapi', 'next'];
const WORKER = ['bullmq', 'bull', 'agenda', 'kafkajs', 'amqplib', '@google-cloud/pubsub', '@aws-sdk/client-sqs', 'bee-queue', 'nats'];

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function pyText(cwd) {
  let text = '';
  for (const f of ['requirements.txt', 'pyproject.toml', 'Pipfile']) {
    const p = path.join(cwd, f);
    if (fs.existsSync(p)) { try { text += `\n${fs.readFileSync(p, 'utf8')}`; } catch { /* ignore */ } }
  }
  return text;
}

export function detectCapabilities(cwd) {
  const caps = { browser: false, http: false, cli: false, worker: false };
  const signals = [];
  const enable = (cap, why) => { caps[cap] = true; signals.push(`${cap}: ${why}`); };

  const pkg = fs.existsSync(path.join(cwd, 'package.json')) ? readJson(path.join(cwd, 'package.json')) : null;
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};
  const present = (list) => list.filter((n) => n in deps);

  // browser
  const fe = present(FRONTEND);
  if (fe.length) enable('browser', `frontend dependency (${fe.join(', ')})`);
  if (fs.existsSync(path.join(cwd, 'index.html')) || fs.existsSync(path.join(cwd, 'public', 'index.html'))) {
    enable('browser', 'index.html present');
  }
  if ('@playwright/test' in deps || 'playwright' in deps) enable('browser', 'playwright present');

  // http
  const httpNode = present(HTTP_NODE);
  if (httpNode.length) enable('http', `server framework (${httpNode.join(', ')})`);
  if (fs.existsSync(path.join(cwd, 'composer.json'))) enable('http', 'composer.json (PHP web app)');
  const py = pyText(cwd);
  if (/fastapi|flask|django/i.test(py)) enable('http', 'python web framework');

  // cli
  if (pkg && pkg.bin) enable('cli', 'package.json "bin" field');

  // worker
  const wk = present(WORKER);
  if (wk.length) enable('worker', `queue/broker dependency (${wk.join(', ')})`);
  if (/celery/i.test(py)) enable('worker', 'celery');

  return { ...caps, signals };
}
