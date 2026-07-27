import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveTargets, anyTargetInstalled } from '../src/install/targets.js';
import { installSkills, listSkills } from '../src/install/skills.js';
import { buildManifest, readManifest, verifyManifest, manifestPathFor } from '../src/install/manifest.js';
import { run, EXIT } from '../src/cli/dispatch.js';

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Build a fake package source tree with core + add-on skills.
function makeSource() {
  const root = tmp('playbook-src-');
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

// ---------------------------------------------------------------------------
// manifest.js (Task 1.1 — AC-5, AC-6)
// ---------------------------------------------------------------------------

test('buildManifest computes a sha256 digest per file in copy mode', () => {
  const dir = tmp('playbook-manifest-');
  const skillMd = path.join(dir, 'SKILL.md');
  fs.writeFileSync(skillMd, '# sdd-apply');
  const manifest = buildManifest({
    version: '0.1.0',
    mode: 'copy',
    skills: [{ name: 'sdd-apply', files: [{ name: 'SKILL.md', sourcePath: skillMd }] }],
  });
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.mode, 'copy');
  assert.equal(manifest.skills['sdd-apply']['SKILL.md'].sha256.length, 64);
});

test('readManifest: absent → null; invalid JSON → null, never throws', () => {
  const dir = tmp('playbook-manifest-');
  assert.equal(readManifest(dir), null);
  fs.writeFileSync(manifestPathFor(dir), '{not json');
  assert.doesNotThrow(() => readManifest(dir));
  assert.equal(readManifest(dir), null);
});

test('readManifest: unknown schema_version → null', () => {
  const dir = tmp('playbook-manifest-');
  fs.writeFileSync(manifestPathFor(dir), JSON.stringify({ schema_version: 99 }));
  assert.equal(readManifest(dir), null);
});

test('verifyManifest: matching sha256 → no findings; altered content → a finding naming the skill and file', () => {
  const dir = tmp('playbook-manifest-');
  fs.mkdirSync(path.join(dir, 'sdd-apply'), { recursive: true });
  const installedFile = path.join(dir, 'sdd-apply', 'SKILL.md');
  fs.writeFileSync(installedFile, '# sdd-apply');
  const manifest = buildManifest({
    version: '0.1.0',
    mode: 'copy',
    skills: [{ name: 'sdd-apply', files: [{ name: 'SKILL.md', sourcePath: installedFile }] }],
  });
  assert.deepEqual(verifyManifest(dir, manifest), []);

  fs.writeFileSync(installedFile, '# tampered');
  const findings = verifyManifest(dir, manifest);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /sdd-apply/);
  assert.match(findings[0], /SKILL\.md/);
});

test('none of buildManifest/readManifest/verifyManifest touch process.exit or write to disk', () => {
  const dir = tmp('playbook-manifest-');
  const before = fs.readdirSync(dir);
  const skillMd = path.join(dir, 'SKILL.md');
  fs.writeFileSync(skillMd, '# x');
  const manifest = buildManifest({ version: '0.1.0', skills: [{ name: 's', files: [{ name: 'SKILL.md', sourcePath: skillMd }] }] });
  readManifest(dir);
  verifyManifest(dir, manifest);
  assert.deepEqual(fs.readdirSync(dir).sort(), [...before, 'SKILL.md'].sort());
});

test('resolveTargets honors env overrides', () => {
  const t = resolveTargets({ PLAYBOOK_CLAUDE_SKILLS_DIR: '/c', PLAYBOOK_AGENTS_SKILLS_DIR: '/a' });
  assert.equal(t.claude, '/c');
  assert.equal(t.agents, '/a');
});

test('resolveTargets defaults to ~/.claude and ~/.agents', () => {
  const t = resolveTargets({}, '/home/u');
  assert.equal(t.claude, '/home/u/.claude/skills');
  assert.equal(t.agents, '/home/u/.agents/skills');
});

test('anyTargetInstalled: false when no target has a .playbook-version stamp', () => {
  const env = { PLAYBOOK_CLAUDE_SKILLS_DIR: tmp('playbook-c-'), PLAYBOOK_AGENTS_SKILLS_DIR: tmp('playbook-a-') };
  assert.equal(anyTargetInstalled(env), false);
});

test('anyTargetInstalled: true when at least one target has a .playbook-version stamp', () => {
  const claude = tmp('playbook-c-');
  fs.writeFileSync(path.join(claude, '.playbook-version'), '0.1.0\n');
  const env = { PLAYBOOK_CLAUDE_SKILLS_DIR: claude, PLAYBOOK_AGENTS_SKILLS_DIR: tmp('playbook-a-') };
  assert.equal(anyTargetInstalled(env), true);
});

test('listSkills ignores directories without a SKILL.md', () => {
  const src = makeSource();
  const names = listSkills(path.join(src, 'skills')).map((s) => s.name).sort();
  assert.deepEqual(names, ['sdd-apply', 'sdd-plan']);
});

test('listSkills ignores broken symlinks in real global skill dirs', () => {
  const src = makeSource();
  fs.symlinkSync(path.join(src, 'missing-skill-target'), path.join(src, 'skills', 'find-skills'), 'dir');
  const names = listSkills(path.join(src, 'skills')).map((s) => s.name).sort();
  assert.deepEqual(names, ['sdd-apply', 'sdd-plan']);
});

test('installSkills writes a manifest with a sha256 entry per installed skill file, mode "copy" (AC-5)', () => {
  const src = makeSource();
  const target = tmp('playbook-claude-');
  installSkills({ targets: { claude: target }, version: '0.1.0', sourceRoot: src });
  const manifest = readManifest(target);
  assert.equal(manifest.mode, 'copy');
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.skills['sdd-plan']['SKILL.md'].sha256.length, 64);
  assert.equal(manifest.skills['sdd-apply']['SKILL.md'].sha256.length, 64);
  // .playbook-version keeps its exact one-line format
  assert.equal(fs.readFileSync(path.join(target, '.playbook-version'), 'utf8'), '0.1.0\n');
});

test('installSkills mode "link": each installable file is a real symlink to sourceRoot, canonical.md never appears, manifest records mode+source+link (AC-7)', () => {
  const src = makeSource();
  const target = tmp('playbook-claude-');
  installSkills({ targets: { claude: target }, version: '0.1.0', sourceRoot: src, mode: 'link' });

  const skillDir = path.join(target, 'sdd-apply');
  assert.ok(fs.statSync(skillDir).isDirectory()); // directory itself is real
  const skillMd = path.join(skillDir, 'SKILL.md');
  assert.ok(fs.lstatSync(skillMd).isSymbolicLink());
  assert.equal(fs.realpathSync(skillMd), fs.realpathSync(path.join(src, 'skills', 'sdd-apply', 'SKILL.md')));
  assert.equal(fs.existsSync(path.join(skillDir, 'canonical.md')), false);

  const manifest = readManifest(target);
  assert.equal(manifest.mode, 'link');
  assert.equal(path.resolve(manifest.source), path.resolve(src));
  assert.equal(manifest.skills['sdd-apply']['SKILL.md'].link, path.join(src, 'skills', 'sdd-apply', 'SKILL.md'));
});

test('installSkills without mode is byte-identical to the pre-link behavior (AC-7)', () => {
  const src = makeSource();
  const target = tmp('playbook-claude-');
  installSkills({ targets: { claude: target }, version: '0.1.0', sourceRoot: src });
  const skillMd = path.join(target, 'sdd-apply', 'SKILL.md');
  assert.equal(fs.lstatSync(skillMd).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(skillMd, 'utf8'), '# sdd-apply');
});

test('installSkills mode "link" writes nothing outside the target dir and links point only at sourceRoot (SEC-004)', () => {
  const src = makeSource();
  const target = tmp('playbook-claude-');
  const outsideRoot = tmp('playbook-outside-');
  const beforeOutside = fs.readdirSync(outsideRoot);
  installSkills({ targets: { claude: target }, version: '0.1.0', sourceRoot: src, mode: 'link' });
  assert.deepEqual(fs.readdirSync(outsideRoot), beforeOutside); // untouched

  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  for (const file of walk(target)) {
    if (fs.lstatSync(file).isSymbolicLink()) {
      const resolved = fs.realpathSync(file);
      assert.ok(path.resolve(resolved).startsWith(path.resolve(src) + path.sep), `${file} → ${resolved} escapes sourceRoot`);
    }
  }
});

test('installSkills installs core into BOTH runtime dirs and stamps the version (AC-02)', () => {
  const src = makeSource();
  const targets = { claude: tmp('playbook-claude-'), agents: tmp('playbook-agents-') };
  const result = installSkills({ targets, version: '0.1.0', sourceRoot: src });

  assert.deepEqual(result.core.sort(), ['sdd-apply', 'sdd-plan']);
  for (const dir of Object.values(targets)) {
    assert.ok(fs.existsSync(path.join(dir, 'sdd-plan', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(dir, 'sdd-apply', 'SKILL.md')));
    assert.equal(fs.readFileSync(path.join(dir, '.playbook-version'), 'utf8').trim(), '0.1.0');
  }
});

test('installSkills installs NO add-ons by default (AC-14)', () => {
  const src = makeSource();
  const targets = { claude: tmp('playbook-claude-'), agents: tmp('playbook-agents-') };
  const result = installSkills({ targets, version: '0.1.0', sourceRoot: src });
  assert.deepEqual(result.addons, []);
  for (const dir of Object.values(targets)) {
    assert.equal(fs.existsSync(path.join(dir, 'document-code')), false);
  }
});

test('installSkills installs an add-on only on explicit opt-in (AC-14)', () => {
  const src = makeSource();
  const targets = { claude: tmp('playbook-claude-'), agents: tmp('playbook-agents-') };
  const result = installSkills({ targets, version: '0.1.0', addons: ['confluence'], sourceRoot: src });
  assert.deepEqual(result.addons, ['confluence/document-code']);
  for (const dir of Object.values(targets)) {
    assert.ok(fs.existsSync(path.join(dir, 'document-code', 'SKILL.md')));
  }
});

test('installSkills writes nothing into a consumer repo (AC-02)', () => {
  const src = makeSource();
  const repo = tmp('playbook-repo-'); // stand-in for a consumer project
  const targets = { claude: tmp('playbook-claude-'), agents: tmp('playbook-agents-') };
  installSkills({ targets, version: '0.1.0', sourceRoot: src });
  assert.deepEqual(fs.readdirSync(repo), []); // untouched
});

test('playbook install (real package): core excludes Confluence add-ons (AC-14)', async () => {
  const claude = tmp('playbook-claude-'); const agents = tmp('playbook-agents-'); const cwd = tmp('playbook-cwd-');
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = claude;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    await run(['install', '--json', '--cwd', cwd], { out: (m) => out.push(String(m)), err: () => {} });
    const res = JSON.parse(out.join('\n'));
    assert.deepEqual(res.addons, []);
    assert.equal(fs.existsSync(path.join(claude, 'document-code')), false);
    assert.equal(fs.existsSync(path.join(claude, 'operational-guide')), false);
    assert.ok(res.core.includes('sdd-plan')); // core still installed
  } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR; else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR; else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
});

test('playbook install --addon confluence installs the add-on (AC-14)', async () => {
  const claude = tmp('playbook-claude-'); const agents = tmp('playbook-agents-'); const cwd = tmp('playbook-cwd-');
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = claude;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    await run(['install', '--addon', 'confluence', '--json', '--cwd', cwd], { out: (m) => out.push(String(m)), err: () => {} });
    const res = JSON.parse(out.join('\n'));
    assert.ok(res.addons.includes('confluence/document-code'));
    assert.ok(res.addons.includes('confluence/operational-guide'));
    assert.ok(fs.existsSync(path.join(claude, 'document-code', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(agents, 'operational-guide', 'SKILL.md')));
  } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR; else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR; else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
});

test('playbook install installs an add-on when addons.confluence:true in playbook.config.yaml (AC-14)', async () => {
  const claude = tmp('playbook-claude-'); const agents = tmp('playbook-agents-'); const cwd = tmp('playbook-cwd-');
  fs.writeFileSync(path.join(cwd, 'playbook.config.yaml'),
    'version: 2\nmethodology:\n  compatible: ">=0.1.0 <1.0.0"\ncapabilities:\n  http: true\ngithub:\n  base_branch: main\n  require_pull_request: true\n  require_ci: true\naddons:\n  confluence: true\n');
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = claude;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    await run(['install', '--json', '--cwd', cwd], { out: (m) => out.push(String(m)), err: () => {} });
    const res = JSON.parse(out.join('\n'));
    assert.ok(res.addons.includes('confluence/document-code'));
  } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR; else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR; else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
});

async function runInstall(args, claude, agents) {
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = claude;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    const err = [];
    const code = await run(args, { out: (m) => out.push(String(m)), err: (m) => err.push(String(m)) });
    return { code, out, err };
  } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR; else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR; else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
}
const stamped = (dir) => fs.existsSync(path.join(dir, '.playbook-version'));

test('playbook install --runtime claude installs only into the Claude dir', async () => {
  const claude = tmp('playbook-c-'); const agents = tmp('playbook-a-'); const cwd = tmp('playbook-w-');
  const { code } = await runInstall(['install', '--runtime', 'claude', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
  assert.ok(stamped(claude));
  assert.equal(stamped(agents), false);
});

test('playbook install --runtime copilot installs only into the Copilot (agents) dir', async () => {
  const claude = tmp('playbook-c-'); const agents = tmp('playbook-a-'); const cwd = tmp('playbook-w-');
  const { code } = await runInstall(['install', '--runtime', 'copilot', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
  assert.ok(stamped(agents));
  assert.equal(stamped(claude), false);
});

test('playbook install --runtime codex installs only into the shared agents dir', async () => {
  const claude = tmp('playbook-c-'); const agents = tmp('playbook-a-'); const cwd = tmp('playbook-w-');
  const { code, out } = await runInstall(['install', '--runtime', 'codex', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
  assert.ok(stamped(agents));
  assert.equal(stamped(claude), false);
  assert.match(out.join('\n'), /GitHub Copilot \+ Codex/);
});

test('playbook install (default), --runtime all, and --runtime both install into both dirs', async () => {
  const claude = tmp('playbook-c-'); const agents = tmp('playbook-a-'); const cwd = tmp('playbook-w-');
  await runInstall(['install', '--cwd', cwd], claude, agents);
  assert.ok(stamped(claude) && stamped(agents));
  const claude2 = tmp('playbook-c-'); const agents2 = tmp('playbook-a-');
  await runInstall(['install', '--runtime', 'all', '--cwd', cwd], claude2, agents2);
  assert.ok(stamped(claude2) && stamped(agents2));
  const claude3 = tmp('playbook-c-'); const agents3 = tmp('playbook-a-');
  await runInstall(['install', '--runtime', 'both', '--cwd', cwd], claude3, agents3);
  assert.ok(stamped(claude3) && stamped(agents3));
});

test('playbook install --link installs in link mode and names it in the summary (AC-7)', async () => {
  const claude = tmp('playbook-c-'); const agents = tmp('playbook-a-'); const cwd = tmp('playbook-w-');
  const { code, out } = await runInstall(['install', '--link', '--json', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
  const res = JSON.parse(out.join('\n'));
  assert.equal(res.mode, 'link');
  const manifest = readManifest(claude);
  assert.equal(manifest.mode, 'link');

  const textClaude = tmp('playbook-c-'); const textAgents = tmp('playbook-a-');
  const { out: textOut } = await runInstall(['install', '--link', '--cwd', cwd], textClaude, textAgents);
  assert.match(textOut.join('\n'), /link/);
});

test('playbook install without --link stays mode "copy" and the summary text is unchanged', async () => {
  const claude = tmp('playbook-c-'); const agents = tmp('playbook-a-'); const cwd = tmp('playbook-w-');
  const { code, out } = await runInstall(['install', '--json', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
  const res = JSON.parse(out.join('\n'));
  assert.equal(res.mode, 'copy');
});

test('playbook install with an unknown flag behaves as it does today', async () => {
  const claude = tmp('playbook-c-'); const agents = tmp('playbook-a-'); const cwd = tmp('playbook-w-');
  const { code } = await runInstall(['install', '--bogus-flag', '--cwd', cwd], claude, agents);
  assert.equal(code, EXIT.OK);
});

test('playbook install --runtime <invalid> is a usage error', async () => {
  const { code, err } = await runInstall(['install', '--runtime', 'vscode', '--cwd', tmp('playbook-w-')], tmp('playbook-c-'), tmp('playbook-a-'));
  assert.equal(code, EXIT.USAGE);
  assert.match(err.join('\n'), /--runtime must be one of/);
  assert.match(err.join('\n'), /codex/);
});

test('playbook install (CLI) targets the env dirs and creates no cwd files', async () => {
  const claude = tmp('playbook-claude-');
  const agents = tmp('playbook-agents-');
  const repo = tmp('playbook-repo-');
  const saved = { c: process.env.PLAYBOOK_CLAUDE_SKILLS_DIR, a: process.env.PLAYBOOK_AGENTS_SKILLS_DIR };
  process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = claude;
  process.env.PLAYBOOK_AGENTS_SKILLS_DIR = agents;
  try {
    const out = [];
    const code = await run(['install', '--json'], { out: (m) => out.push(String(m)), err: () => {} });
    assert.equal(code, EXIT.OK);
    const result = JSON.parse(out.join('\n'));
    assert.equal(result.version, JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version);
    assert.ok(fs.existsSync(path.join(claude, '.playbook-version')));
    assert.ok(fs.existsSync(path.join(agents, '.playbook-version')));
    assert.deepEqual(fs.readdirSync(repo), []); // no consumer writes
  } finally {
    if (saved.c === undefined) delete process.env.PLAYBOOK_CLAUDE_SKILLS_DIR; else process.env.PLAYBOOK_CLAUDE_SKILLS_DIR = saved.c;
    if (saved.a === undefined) delete process.env.PLAYBOOK_AGENTS_SKILLS_DIR; else process.env.PLAYBOOK_AGENTS_SKILLS_DIR = saved.a;
  }
});
