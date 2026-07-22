import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDelivery } from '../src/github/index.js';

// Fake git runner: reports a repo with the given local state + branch.
function fakeGit({ repo = true, dirty = false, branch = 'feature/x' } = {}) {
  return (args) => {
    const cmd = args.join(' ');
    if (cmd.includes('--is-inside-work-tree')) {
      if (!repo) throw new Error('not a git repo');
      return 'true\n';
    }
    if (cmd.includes('status --porcelain')) return dirty ? ' M file.txt\n' : '';
    if (cmd.includes('rev-parse --abbrev-ref HEAD')) return `${branch}\n`;
    throw new Error(`unexpected git: ${cmd}`);
  };
}

const CHECKS = {
  passed: '✓ build\tsuccess\n',
  failed: '✗ build\tfail\n',
  pending: '• build\tpending\n',
  none: '',
};

function fakeGh({ authed = true, pr = null, checks = 'none' } = {}) {
  return (args) => {
    const cmd = args.join(' ');
    if (cmd.startsWith('auth status')) {
      if (!authed) throw new Error('not authenticated');
      return 'Logged in\n';
    }
    if (cmd.startsWith('pr view')) {
      if (!pr) throw new Error('no pull request');
      return JSON.stringify(pr);
    }
    if (cmd.startsWith('pr checks')) return CHECKS[checks];
    throw new Error(`unexpected gh: ${cmd}`);
  };
}

function delivery(gitOpts, ghOpts) {
  return resolveDelivery({ runGit: fakeGit(gitOpts), runGh: fakeGh(ghOpts) });
}

test('dirty working tree → uncommitted (GitHub not consulted)', () => {
  assert.equal(delivery({ dirty: true }, {}).state, 'uncommitted');
});

test('not a git repo → unknown (GIT_UNAVAILABLE)', () => {
  const d = delivery({ repo: false }, {});
  assert.equal(d.state, 'unknown');
  assert.equal(d.blocked_reason, 'GIT_UNAVAILABLE');
});

test('committed + GitHub unavailable → unknown, never assumed (C-10)', () => {
  const d = delivery({ dirty: false }, { authed: false });
  assert.equal(d.state, 'unknown');
  assert.equal(d.blocked_reason, 'GITHUB_CONTEXT_UNAVAILABLE');
});

test('committed + no PR → committed', () => {
  assert.equal(delivery({ dirty: false }, { authed: true, pr: null }).state, 'committed');
});

test('PR merged → merged', () => {
  assert.equal(delivery({ dirty: false }, { pr: { state: 'MERGED', number: 1 } }).state, 'merged');
});

test('PR open maps checks → ci_passed / ci_failed / ci_pending / pr_open', () => {
  assert.equal(delivery({ dirty: false }, { pr: { state: 'OPEN', number: 2 }, checks: 'passed' }).state, 'ci_passed');
  assert.equal(delivery({ dirty: false }, { pr: { state: 'OPEN', number: 2 }, checks: 'failed' }).state, 'ci_failed');
  assert.equal(delivery({ dirty: false }, { pr: { state: 'OPEN', number: 2 }, checks: 'pending' }).state, 'ci_pending');
  assert.equal(delivery({ dirty: false }, { pr: { state: 'OPEN', number: 2 }, checks: 'none' }).state, 'pr_open');
});
