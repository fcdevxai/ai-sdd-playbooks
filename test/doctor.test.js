import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, EXIT } from '../src/cli/dispatch.js';
import { workflowStaleness, specIndexAdvisory } from '../src/cli/doctor.js';
import { installSkills } from '../src/install/skills.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-doctor-')); }
function capture() {
  const out = []; const err = [];
  return { io: { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) }, out, err };
}

// Run `fn` with a stamped global methodology dir so doctor sees an install.
async function withGlobalVersion(version, fn) {
  const global = tmp();
  const empty = tmp();
  installSkills({ targets: { claude: global }, version });
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = global;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = empty;
  try { return await fn(); } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR;
    else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR;
    else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
}

async function withBrokenGlobalVersion(version, mutate, fn) {
  const global = tmp();
  const empty = tmp();
  installSkills({ targets: { agents: global }, version });
  mutate(global);
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = empty;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = global;
  try { return await fn(global); } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR;
    else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR;
    else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
}

function snapshot(dir) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(`${path.relative(dir, p)}:${fs.statSync(p).mtimeMs}:${fs.readFileSync(p, 'utf8').length}`);
    }
  };
  walk(dir);
  return files.sort();
}

async function initRepo() {
  const dir = tmp();
  await run(['init', '--cwd', dir], capture().io);
  return dir;
}

test('doctor is read-only by default — writes nothing (AC-05)', async () => {
  const dir = await initRepo();
  const before = snapshot(dir);
  await withGlobalVersion('0.1.0', () => run(['doctor', '--cwd', dir], capture().io));
  assert.deepEqual(snapshot(dir), before);
});

test('a freshly initialized repo with a compatible global install is healthy (exit 0)', async () => {
  const dir = await initRepo();
  const code = await withGlobalVersion('0.1.0', () => run(['doctor', '--cwd', dir], capture().io));
  assert.equal(code, EXIT.OK);
});

test('doctor reports "no global methodology installed" when none is present', async () => {
  const dir = await initRepo();
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  const emptyClaude = tmp(); // no .playbook-version here
  const emptyAgents = tmp();
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = emptyClaude;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = emptyAgents;
  try {
    const { io, err } = capture();
    const code = await run(['doctor', '--cwd', dir], io);
    assert.equal(code, EXIT.ENVIRONMENT);
    assert.match(err.join('\n'), /no global methodology installed/);
  } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR;
    else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR;
    else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
});

test('doctor reports a stamped but incomplete shared agents install', async () => {
  const dir = await initRepo();
  await withBrokenGlobalVersion('0.1.0', (global) => {
    fs.rmSync(path.join(global, 'sdd-plan'), { recursive: true, force: true });
  }, async () => {
    const { io, out } = capture();
    const code = await run(['doctor', '--json', '--cwd', dir], io);
    const json = JSON.parse(out.join('\n'));
    assert.equal(code, EXIT.ENVIRONMENT);
    assert.equal(json.healthy, false);
    assert.ok(json.problems.some((p) => /GitHub Copilot \+ Codex install is missing core skill sdd-plan/.test(p)));
    assert.ok(json.targets.some((t) => t.target === 'agents' && t.installed === '0.1.0'));
  });
});

test('doctor ignores unrelated broken symlinks in a stamped global skill dir', async () => {
  const dir = await initRepo();
  await withBrokenGlobalVersion('0.1.0', (global) => {
    fs.symlinkSync(path.join(global, 'missing-skill-target'), path.join(global, 'find-skills'), 'dir');
  }, async () => {
    const { io, out } = capture();
    const code = await run(['doctor', '--json', '--cwd', dir], io);
    const json = JSON.parse(out.join('\n'));
    assert.equal(code, EXIT.OK);
    assert.equal(json.healthy, true);
  });
});

test('doctor blocks when the installed version is outside the compatible range (C-08)', async () => {
  const dir = await initRepo(); // lock compatible ">=0.1.0 <1.0.0"
  await withGlobalVersion('1.0.0', async () => {
    const { io, err } = capture();
    const code = await run(['doctor', '--cwd', dir], io);
    assert.equal(code, EXIT.ENVIRONMENT);
    assert.match(err.join('\n'), /outside the project range/);
  });
});

test('doctor --fix is additive only: creates missing openspec/changes, edits nothing existing (AC-05)', async () => {
  const dir = await initRepo();
  fs.rmSync(path.join(dir, 'openspec', 'changes'), { recursive: true, force: true });
  const before = snapshot(dir);
  await withGlobalVersion('0.1.0', () => run(['doctor', '--fix', '--cwd', dir], capture().io));
  assert.ok(fs.existsSync(path.join(dir, 'openspec', 'changes')));
  const after = new Map(snapshot(dir).map((s) => [s.split(':')[0], s]));
  for (const b of before) assert.equal(after.get(b.split(':')[0]), b);
});

test('doctor warns (advisory, still exit 0) when the workflow doc predates the methodology', async () => {
  const dir = await initRepo();
  // simulate a project doc that predates any methodology: strip the marker `playbook init` scaffolded
  const wf = path.join(dir, 'docs', 'sdd-workflow.md');
  fs.writeFileSync(wf, fs.readFileSync(wf, 'utf8').replace(/<!--\s*sdd-methodology:[^>]*-->\n?/, ''));
  await withGlobalVersion('0.1.0', async () => {
    const { io, out } = capture();
    const code = await run(['doctor', '--json', '--cwd', dir], io);
    const json = JSON.parse(out.join('\n'));
    assert.equal(code, EXIT.OK);          // advisory: never fails the exit code
    assert.equal(json.healthy, true);
    assert.ok(Array.isArray(json.warnings));
    assert.ok(json.warnings.some((w) => /sdd-workflow\.md/.test(w) && /sdd-bootstrap-project/.test(w)));
  });
});

test('doctor does not warn when the workflow doc carries the current methodology marker', async () => {
  const dir = await initRepo(); // scaffolds `<!-- sdd-methodology: 0.1 -->`
  await withGlobalVersion('0.1.0', async () => {
    const { io, out } = capture();
    await run(['doctor', '--json', '--cwd', dir], io);
    const json = JSON.parse(out.join('\n'));
    assert.ok(Array.isArray(json.warnings));
    assert.equal(json.warnings.filter((w) => /sdd-workflow/.test(w)).length, 0);
  });
});

test('doctor warns (advisory, still exit 0) when the spec index is missing (AC-6, SEC-1)', async () => {
  const dir = await initRepo(); // has openspec/specs/system.md, no .specloom/index/ yet
  await withGlobalVersion('0.1.0', async () => {
    const { io, out } = capture();
    const code = await run(['doctor', '--json', '--cwd', dir], io);
    const json = JSON.parse(out.join('\n'));
    assert.equal(code, EXIT.OK);   // SEC-1: advisory never changes the exit code
    assert.equal(json.healthy, true); // SEC-1: advisory never changes healthy
    assert.ok(json.warnings.some((w) => /spec-index/.test(w) && /spec-index\.json/.test(w)));
  });
});

test('doctor does not warn about the spec index once it has been built', async () => {
  const dir = await initRepo();
  const { buildSpecIndex, writeSpecIndex, defaultSpecIndexPath } = await import('../src/tokens/spec-index.js');
  writeSpecIndex(buildSpecIndex(dir), defaultSpecIndexPath(dir));
  await withGlobalVersion('0.1.0', async () => {
    const { io, out } = capture();
    await run(['doctor', '--json', '--cwd', dir], io);
    const json = JSON.parse(out.join('\n'));
    assert.equal(json.warnings.filter((w) => /spec-index/.test(w)).length, 0);
  });
});

test('doctor reports runtime MCP readiness notes without blocking', async () => {
  const dir = await initRepo();
  const config = path.join(dir, 'playbook.config.yaml');
  fs.writeFileSync(config, fs.readFileSync(config, 'utf8')
    .replace('browser: false', 'browser: true')
    .replace('confluence: false', 'confluence: true'));
  await withGlobalVersion('0.1.0', async () => {
    const { io, out } = capture();
    const code = await run(['doctor', '--json', '--cwd', dir], io);
    const json = JSON.parse(out.join('\n'));
    assert.equal(code, EXIT.OK);
    assert.equal(json.healthy, true);
    assert.ok(json.notes.some((n) => /Playwright MCP/.test(n) && /active agent runtime/.test(n)));
    assert.ok(json.notes.some((n) => /Confluence add-on/.test(n) && /Atlassian MCP/.test(n)));
  });
});

test('workflowStaleness: null when no install, doc missing, current, or newer', () => {
  const dir = tmp();
  assert.equal(workflowStaleness({ cwd: dir, config: {}, installed: null }), null);      // no install
  assert.equal(workflowStaleness({ cwd: dir, config: {}, installed: '3.0.0' }), null);    // doc missing
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  const wf = path.join(dir, 'docs', 'sdd-workflow.md');
  fs.writeFileSync(wf, '<!-- sdd-methodology: 3.0 -->\n# wf\n');
  assert.equal(workflowStaleness({ cwd: dir, config: {}, installed: '3.0.0' }), null);    // current major
  fs.writeFileSync(wf, '<!-- sdd-methodology: 4.0 -->\n# wf\n');
  assert.equal(workflowStaleness({ cwd: dir, config: {}, installed: '3.0.0' }), null);    // newer, not stale
});

test('workflowStaleness: warns on an older major or a missing marker', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  const wf = path.join(dir, 'docs', 'sdd-workflow.md');
  fs.writeFileSync(wf, '<!-- sdd-methodology: 2.0 -->\n# wf\n');
  assert.match(workflowStaleness({ cwd: dir, config: {}, installed: '3.0.0' }), /predates the installed methodology/);
  fs.writeFileSync(wf, '# wf, no marker\n');
  assert.match(workflowStaleness({ cwd: dir, config: {}, installed: '3.0.0' }), /no methodology-version marker/);
});

test('specIndexAdvisory: null when there are no permanent specs to index', () => {
  const dir = tmp();
  assert.equal(specIndexAdvisory({ cwd: dir }), null);
});

test('specIndexAdvisory: warns when system.md exists and the index has not been built (AC-6)', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'openspec', 'specs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'openspec', 'specs', 'system.md'), '# system\n');
  assert.match(specIndexAdvisory({ cwd: dir }), /spec-index/);
});

test('specIndexAdvisory: null once the index file exists', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'openspec', 'specs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'openspec', 'specs', 'system.md'), '# system\n');
  const { buildSpecIndex, writeSpecIndex, defaultSpecIndexPath } = await import('../src/tokens/spec-index.js');
  writeSpecIndex(buildSpecIndex(dir), defaultSpecIndexPath(dir));
  assert.equal(specIndexAdvisory({ cwd: dir }), null);
});
