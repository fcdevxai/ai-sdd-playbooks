import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveTargets } from '../src/install/targets.js';
import { installSkills, listSkills } from '../src/install/skills.js';
import { run, EXIT } from '../src/cli/dispatch.js';

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Build a fake package source tree with core + add-on skills.
function makeSource() {
  const root = tmp('sdd-src-');
  const mk = (rel, content) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  };
  mk('skills/sdd-plan/SKILL.md', '# sdd-plan');
  mk('skills/sdd-apply/SKILL.md', '# sdd-apply');
  mk('addons/confluence/document-code/SKILL.md', '# document-code');
  // a stray dir without SKILL.md must be ignored
  fs.mkdirSync(path.join(root, 'skills', 'not-a-skill'), { recursive: true });
  return root;
}

test('resolveTargets honors env overrides', () => {
  const t = resolveTargets({ SDD_CLAUDE_SKILLS_DIR: '/c', SDD_AGENTS_SKILLS_DIR: '/a' });
  assert.equal(t.claude, '/c');
  assert.equal(t.agents, '/a');
});

test('resolveTargets defaults to ~/.claude and ~/.agents', () => {
  const t = resolveTargets({}, '/home/u');
  assert.equal(t.claude, '/home/u/.claude/skills');
  assert.equal(t.agents, '/home/u/.agents/skills');
});

test('listSkills ignores directories without a SKILL.md', () => {
  const src = makeSource();
  const names = listSkills(path.join(src, 'skills')).map((s) => s.name).sort();
  assert.deepEqual(names, ['sdd-apply', 'sdd-plan']);
});

test('installSkills installs core into BOTH runtime dirs and stamps the version (AC-02)', () => {
  const src = makeSource();
  const targets = { claude: tmp('sdd-claude-'), agents: tmp('sdd-agents-') };
  const result = installSkills({ targets, version: '2.0.0', sourceRoot: src });

  assert.deepEqual(result.core.sort(), ['sdd-apply', 'sdd-plan']);
  for (const dir of Object.values(targets)) {
    assert.ok(fs.existsSync(path.join(dir, 'sdd-plan', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(dir, 'sdd-apply', 'SKILL.md')));
    assert.equal(fs.readFileSync(path.join(dir, '.sdd-version'), 'utf8').trim(), '2.0.0');
  }
});

test('installSkills installs NO add-ons by default (AC-14)', () => {
  const src = makeSource();
  const targets = { claude: tmp('sdd-claude-'), agents: tmp('sdd-agents-') };
  const result = installSkills({ targets, version: '2.0.0', sourceRoot: src });
  assert.deepEqual(result.addons, []);
  for (const dir of Object.values(targets)) {
    assert.equal(fs.existsSync(path.join(dir, 'document-code')), false);
  }
});

test('installSkills installs an add-on only on explicit opt-in (AC-14)', () => {
  const src = makeSource();
  const targets = { claude: tmp('sdd-claude-'), agents: tmp('sdd-agents-') };
  const result = installSkills({ targets, version: '2.0.0', addons: ['confluence'], sourceRoot: src });
  assert.deepEqual(result.addons, ['confluence/document-code']);
  for (const dir of Object.values(targets)) {
    assert.ok(fs.existsSync(path.join(dir, 'document-code', 'SKILL.md')));
  }
});

test('installSkills writes nothing into a consumer repo (AC-02)', () => {
  const src = makeSource();
  const repo = tmp('sdd-repo-'); // stand-in for a consumer project
  const targets = { claude: tmp('sdd-claude-'), agents: tmp('sdd-agents-') };
  installSkills({ targets, version: '2.0.0', sourceRoot: src });
  assert.deepEqual(fs.readdirSync(repo), []); // untouched
});

test('sdd install (real package): core excludes Confluence add-ons (AC-14)', async () => {
  const claude = tmp('sdd-claude-'); const agents = tmp('sdd-agents-'); const cwd = tmp('sdd-cwd-');
  const saved = { c: process.env.SDD_CLAUDE_SKILLS_DIR, a: process.env.SDD_AGENTS_SKILLS_DIR };
  process.env.SDD_CLAUDE_SKILLS_DIR = claude;
  process.env.SDD_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    await run(['install', '--json', '--cwd', cwd], { out: (m) => out.push(String(m)), err: () => {} });
    const res = JSON.parse(out.join('\n'));
    assert.deepEqual(res.addons, []);
    assert.equal(fs.existsSync(path.join(claude, 'document-code')), false);
    assert.equal(fs.existsSync(path.join(claude, 'operational-guide')), false);
    assert.ok(res.core.includes('sdd-plan')); // core still installed
  } finally {
    if (saved.c === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR; else process.env.SDD_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.SDD_AGENTS_SKILLS_DIR; else process.env.SDD_AGENTS_SKILLS_DIR = saved.a;
  }
});

test('sdd install --addon confluence installs the add-on (AC-14)', async () => {
  const claude = tmp('sdd-claude-'); const agents = tmp('sdd-agents-'); const cwd = tmp('sdd-cwd-');
  const saved = { c: process.env.SDD_CLAUDE_SKILLS_DIR, a: process.env.SDD_AGENTS_SKILLS_DIR };
  process.env.SDD_CLAUDE_SKILLS_DIR = claude;
  process.env.SDD_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    await run(['install', '--addon', 'confluence', '--json', '--cwd', cwd], { out: (m) => out.push(String(m)), err: () => {} });
    const res = JSON.parse(out.join('\n'));
    assert.ok(res.addons.includes('confluence/document-code'));
    assert.ok(res.addons.includes('confluence/operational-guide'));
    assert.ok(fs.existsSync(path.join(claude, 'document-code', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(agents, 'operational-guide', 'SKILL.md')));
  } finally {
    if (saved.c === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR; else process.env.SDD_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.SDD_AGENTS_SKILLS_DIR; else process.env.SDD_AGENTS_SKILLS_DIR = saved.a;
  }
});

test('sdd install installs an add-on when addons.confluence:true in sdd.config.yaml (AC-14)', async () => {
  const claude = tmp('sdd-claude-'); const agents = tmp('sdd-agents-'); const cwd = tmp('sdd-cwd-');
  fs.writeFileSync(path.join(cwd, 'sdd.config.yaml'),
    'version: 2\nmethodology:\n  compatible: ">=2.0.0 <3.0.0"\ncapabilities:\n  http: true\ngithub:\n  base_branch: main\n  require_pull_request: true\n  require_ci: true\naddons:\n  confluence: true\n');
  const saved = { c: process.env.SDD_CLAUDE_SKILLS_DIR, a: process.env.SDD_AGENTS_SKILLS_DIR };
  process.env.SDD_CLAUDE_SKILLS_DIR = claude;
  process.env.SDD_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    await run(['install', '--json', '--cwd', cwd], { out: (m) => out.push(String(m)), err: () => {} });
    const res = JSON.parse(out.join('\n'));
    assert.ok(res.addons.includes('confluence/document-code'));
  } finally {
    if (saved.c === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR; else process.env.SDD_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.SDD_AGENTS_SKILLS_DIR; else process.env.SDD_AGENTS_SKILLS_DIR = saved.a;
  }
});

async function runInstall(args, claude, agents) {
  const saved = { c: process.env.SDD_CLAUDE_SKILLS_DIR, a: process.env.SDD_AGENTS_SKILLS_DIR };
  process.env.SDD_CLAUDE_SKILLS_DIR = claude;
  process.env.SDD_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    const err = [];
    const code = await run(args, { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) });
    return { code, out, err };
  } finally {
    if (saved.c === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR; else process.env.SDD_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.SDD_AGENTS_SKILLS_DIR; else process.env.SDD_AGENTS_SKILLS_DIR = saved.a;
  }
}
const stamped = (dir) => fs.existsSync(path.join(dir, '.sdd-version'));

test('sdd install --runtime claude installs only into the Claude dir', async () => {
  const claude = tmp('sdd-c-'); const agents = tmp('sdd-a-'); const cwd = tmp('sdd-w-');
  const { code } = await runInstall(['install', '--runtime', 'claude', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
  assert.ok(stamped(claude));
  assert.equal(stamped(agents), false);
});

test('sdd install --runtime copilot installs only into the Copilot (agents) dir', async () => {
  const claude = tmp('sdd-c-'); const agents = tmp('sdd-a-'); const cwd = tmp('sdd-w-');
  const { code } = await runInstall(['install', '--runtime', 'copilot', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
  assert.ok(stamped(agents));
  assert.equal(stamped(claude), false);
});

test('sdd install --runtime codex installs only into the shared agents dir', async () => {
  const claude = tmp('sdd-c-'); const agents = tmp('sdd-a-'); const cwd = tmp('sdd-w-');
  const { code, out } = await runInstall(['install', '--runtime', 'codex', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
  assert.ok(stamped(agents));
  assert.equal(stamped(claude), false);
  assert.match(out.join('\n'), /GitHub Copilot \+ Codex/);
});

test('sdd install (default), --runtime all, and --runtime both install into both dirs', async () => {
  const claude = tmp('sdd-c-'); const agents = tmp('sdd-a-'); const cwd = tmp('sdd-w-');
  await runInstall(['install', '--cwd', cwd], claude, agents);
  assert.ok(stamped(claude) && stamped(agents));
  const claude2 = tmp('sdd-c-'); const agents2 = tmp('sdd-a-');
  await runInstall(['install', '--runtime', 'all', '--cwd', cwd], claude2, agents2);
  assert.ok(stamped(claude2) && stamped(agents2));
  const claude3 = tmp('sdd-c-'); const agents3 = tmp('sdd-a-');
  await runInstall(['install', '--runtime', 'both', '--cwd', cwd], claude3, agents3);
  assert.ok(stamped(claude3) && stamped(agents3));
});

test('sdd install --runtime <invalid> is a usage error', async () => {
  const { code, err } = await runInstall(['install', '--runtime', 'vscode', '--cwd', tmp('sdd-w-')], tmp('sdd-c-'), tmp('sdd-a-'));
  assert.equal(code, EXIT.USAGE);
  assert.match(err.join('\n'), /--runtime must be one of/);
  assert.match(err.join('\n'), /codex/);
});

test('sdd install (CLI) targets the env dirs and creates no cwd files', async () => {
  const claude = tmp('sdd-claude-');
  const agents = tmp('sdd-agents-');
  const repo = tmp('sdd-repo-');
  const saved = { c: process.env.SDD_CLAUDE_SKILLS_DIR, a: process.env.SDD_AGENTS_SKILLS_DIR };
  process.env.SDD_CLAUDE_SKILLS_DIR = claude;
  process.env.SDD_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    const code = await run(['install', '--json'], { out: (m) => out.push(String(m)), err: () => {} });
    assert.equal(code, EXIT.OK);
    const result = JSON.parse(out.join('\n'));
    // Real package skills/ may be empty until Phase 5/6 — the stamp must still be written.
    assert.equal(result.version, JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version);
    assert.ok(fs.existsSync(path.join(claude, '.sdd-version')));
    assert.ok(fs.existsSync(path.join(agents, '.sdd-version')));
    assert.deepEqual(fs.readdirSync(repo), []); // no consumer writes
  } finally {
    if (saved.c === undefined) delete process.env.SDD_CLAUDE_SKILLS_DIR; else process.env.SDD_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.SDD_AGENTS_SKILLS_DIR; else process.env.SDD_AGENTS_SKILLS_DIR = saved.a;
  }
});
