/**
 * Sibling-repo detection heuristics (multi-repo bootstrap).
 *
 * Best-effort, read-only inspection of the PARENT directory to PROPOSE
 * candidate sibling repos for `playbook.config.yaml`'s `repos:` block — the
 * same "detect concrete signals, human confirms" contract as
 * `detect-capabilities.js`. This is the canonical, tested implementation the
 * `sdd-bootstrap-project` skill applies; it never writes and never silently
 * includes or excludes a candidate.
 *
 * Design note (validated empirically against a real, messy home directory
 * with a dozen unrelated git repos): naming heuristics alone cannot decide
 * relevance — a hub named `playbook-ai` shares no token with siblings named
 * `frontend`/`backend`, and an unrelated repo can sit right next to a real
 * one. So this module does NOT filter candidates down to "probably related" —
 * it returns every sibling that is a git repo, with whatever signal is
 * available (stack, shared naming tokens), and leaves the actual relevance
 * call to the human. Naming affinity is used only to ANNOTATE/SORT
 * (`sharedTokensWithOwn`, `cluster`), never to decide inclusion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { detectCapabilities } from './detect-capabilities.js';

// Generic words that appear in many unrelated repo names and carry no
// project-identifying signal on their own (e.g. "frontend" tells you nothing
// about WHICH product it belongs to).
const GENERIC_REPO_TOKENS = new Set([
  'frontend', 'backend', 'api', 'web', 'app', 'service', 'services', 'server',
  'client', 'ui', 'core', 'worker', 'infra', 'svc', 'admin', 'db', 'gateway',
  'mobile', 'site', 'portal', 'platform',
]);

function tokenize(name) {
  return name
    .toLowerCase()
    .split(/[-_.\s]+/)
    .filter(Boolean);
}

/** Tokens that carry real naming signal — generic infra/layer words stripped. */
function meaningfulTokens(name) {
  return tokenize(name).filter((t) => !GENERIC_REPO_TOKENS.has(t));
}

function isGitRepo(dirPath) {
  try {
    return fs.statSync(path.join(dirPath, '.git')).isDirectory();
  } catch {
    return false;
  }
}

/** Lightweight stack guess, reusing the same signals sdd-bootstrap-project already presents for capabilities. */
function stackSummary(repoPath) {
  const caps = detectCapabilities(repoPath);
  const parts = [];
  if (caps.browser) parts.push('browser');
  if (caps.http) parts.push('http');
  if (caps.cli) parts.push('cli');
  if (caps.worker) parts.push('worker');
  return { capabilities: caps, signals: caps.signals, summary: parts.join('+') || 'unknown' };
}

/**
 * Detects candidate sibling repos in `parentDir` (default: the parent of
 * `cwd`). Returns every git-repo sibling — never filtered by relevance —
 * annotated with a stack guess and naming-affinity hints.
 *
 * `sharedTokensWithOwn`: meaningful name tokens this sibling shares with the
 * repo running the detection (e.g. hub `athly-loom` + sibling `athly-web` →
 * `['athly']`). Empty is common and NOT a sign of irrelevance — see the
 * design note above.
 *
 * `cluster`: the group of OTHER candidates (by name) this one shares a
 * meaningful token with, regardless of the own repo — surfaces naming
 * families like `myproduct-search`/`myproduct-worker` even when neither
 * matches the hub's own name.
 */
export function detectSiblingRepos({ cwd = process.cwd(), parentDir = path.dirname(cwd) } = {}) {
  const ownName = path.basename(cwd);
  const ownTokens = meaningfulTokens(ownName);

  if (!fs.existsSync(parentDir)) return { ownName, parentDir, candidates: [] };

  const entries = fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== path.basename(cwd))
    .map((e) => ({ name: e.name, path: path.join(parentDir, e.name) }))
    .filter((e) => isGitRepo(e.path));

  const withTokens = entries.map((e) => ({ ...e, tokens: meaningfulTokens(e.name) }));

  const candidates = withTokens.map((entry) => {
    const sharedTokensWithOwn = entry.tokens.filter((t) => ownTokens.includes(t));
    const cluster = withTokens
      .filter((other) => other.name !== entry.name && other.tokens.some((t) => entry.tokens.includes(t)))
      .map((other) => other.name)
      .sort();
    return {
      name: entry.name,
      path: entry.path,
      ...stackSummary(entry.path),
      sharedTokensWithOwn,
      cluster,
    };
  });

  // Sort likeliest-related first: shares a token with the hub, then belongs
  // to a naming cluster with another candidate, then alphabetical — a sort
  // order, never a filter.
  candidates.sort((a, b) => {
    const score = (c) => (c.sharedTokensWithOwn.length > 0 ? 2 : c.cluster.length > 0 ? 1 : 0);
    return score(b) - score(a) || a.name.localeCompare(b.name);
  });

  return { ownName, parentDir, candidates };
}
