import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { gatedFixture, DELIVERY, evidence, refreshHandoff } from './helpers/evidence-fixture.js';
import { snapshotRepository, normativeTasksHash } from '../src/tokens/evidence.js';
import { validateHandoffManifest } from '../src/tokens/handoff.js';
import { observeSource, receiptIneligibility } from '../src/tokens/receipt.js';

const observations = [];
function assess(label, fixture) {
  const handoff = validateHandoffManifest('demo', { cwd: fixture.cwd });
  const gates = evidence(fixture.cwd, fixture.change, DELIVERY.uncommitted);
  const result = { label, cwd: fixture.cwd, handoff, gateIssues: gates.issues, gates: gates.gates };
  observations.push(result);
  
  console.log(JSON.stringify({label, cwd:fixture.cwd, handoffFresh:handoff.ok, gateIssues:gates.issues}));
  return result;
}
function setBody(change, body) {
  const file = path.join(change, 'tasks.md');
  const raw = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, raw.slice(0, raw.indexOf('# Tasks')) + body);
}

test('control: freshly sealed complete fixture is eligible', async () => {
  const f = await gatedFixture();
  const r = assess('baseline', f);
  assert.equal(r.handoff.ok, true);
  assert.deepEqual(r.gateIssues, []);
});

test('submodule: modifying tracked child content without moving HEAD must stale gates', async () => {
  const sub = fs.mkdtempSync(path.join(os.tmpdir(), 'review8-submodule-'));
  const gitSub = (...args) => execFileSync('git', args, {cwd:sub,stdio:['ignore','pipe','pipe']});
  gitSub('init','-q','-b','main');gitSub('config','user.name','Fixture');gitSub('config','user.email','fixture@example.invalid');
  fs.writeFileSync(path.join(sub,'a.js'),'export const reviewed = 1;\n');
  gitSub('add','-A');gitSub('commit','-qm','baseline');
  let before,after;
  const f = await gatedFixture({
    prepare: ({cwd,git}) => {
      git('-c','protocol.file.allow=always','submodule','add','-q',sub,'vendor/lib');
      before=snapshotRepository({root:cwd,changeId:'demo',untrackedPaths:['src/feature.js','src/link']});
    },
    tamper: ({cwd}) => {
      fs.writeFileSync(path.join(cwd,'vendor/lib/a.js'),'export const unreviewed = 666;\n');
      try { after=snapshotRepository({root:cwd,changeId:'demo',untrackedPaths:['src/feature.js','src/link']}); }
      catch (error) { after={error:error.message}; }
    }
  });
  const r=assess('dirty-submodule', f);
  console.log(JSON.stringify({label:'dirty-submodule-digests',before,after}));
  assert.notDeepEqual(r.gateIssues, [], 'dirty submodule content was accepted as reviewed');
});

test('audit exclusion: distinct invalid-UTF8 filename must not inherit another audit path exclusion', async () => {
  let invalidPath,before,after;
  const f=await gatedFixture({
    prepare: ({cwd,change,git}) => {
      const tasks=path.join(change,'tasks.md');
      fs.writeFileSync(tasks, fs.readFileSync(tasks,'utf8').replace('handoff:\n','handoff:\n  audit_evidence: ["log\uFFFD.md"]\n'));
      fs.writeFileSync(path.join(change,'log\uFFFD.md'),'declared audit log\n');
      invalidPath=Buffer.concat([Buffer.from(change+'/log'),Buffer.from([0xff]),Buffer.from('.md')]);
      fs.writeFileSync(invalidPath,'reviewed normative content\n');
      git('add','-A');
      before=snapshotRepository({root:cwd,changeId:'demo',untrackedPaths:['src/feature.js','src/link']});
    },
    tamper: ({cwd}) => {
      fs.writeFileSync(invalidPath,'unreviewed normative content\n');
      after=snapshotRepository({root:cwd,changeId:'demo',untrackedPaths:['src/feature.js','src/link']});
    }
  });
  const r=assess('lossy-exclusion', f);
  console.log(JSON.stringify({label:'lossy-exclusion-digests',before,after}));
  assert.notDeepEqual(r.gateIssues, [], 'distinct undeclared audit filename was omitted from governed content');
});

test('normative literal: removing a blank line inside a fenced command must stale gates', async () => {
  const a='# Tasks\n## Phase 1\n```sh\nnode - <<\'NODE\'\nconsole.log(`alpha\n\n\nbeta`);\nNODE\n```\n';
  const b=a.replace('alpha\n\n\nbeta','alpha\n\nbeta');
  console.log(JSON.stringify({label:'fenced-blank-lines',before:normativeTasksHash(a),after:normativeTasksHash(b)}));
  const f=await gatedFixture({prepare:({change})=>setBody(change,a),tamper:({cwd,change})=>{setBody(change,b);refreshHandoff(cwd);}});
  const r=assess('fenced-blank-lines', f);
  assert.notDeepEqual(r.gateIssues, [], 'semantically different fenced command was accepted by the old seals');
});

test('normative literal: checkbox-shaped text inside a fenced command remains normative', async () => {
  const a='# Tasks\n## Phase 1\n```sh\ncat <<\'TEXT\'\n- **Done**: [x]\nTEXT\n```\n';
  const b=a.replace('[x]','[ ]');
  console.log(JSON.stringify({label:'fenced-checkbox',before:normativeTasksHash(a),after:normativeTasksHash(b)}));
  const f=await gatedFixture({prepare:({change})=>setBody(change,a),tamper:({cwd,change})=>{setBody(change,b);refreshHandoff(cwd);}});
  const r=assess('fenced-checkbox', f);
  assert.notDeepEqual(r.gateIssues, [], 'literal command text was discarded as task bookkeeping');
});

test('submodule local edits, additions and deletions are not Git-comparable snapshots', () => {
  const child = fs.mkdtempSync(path.join(os.tmpdir(), 'remediation-child-'));
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'remediation-parent-'));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const cwd of [child, parent]) {
    git(cwd, 'init', '-q', '-b', 'main');
    git(cwd, 'config', 'user.name', 'Fixture');
    git(cwd, 'config', 'user.email', 'fixture@example.invalid');
  }
  fs.writeFileSync(path.join(child, 'tracked.js'), 'reviewed\n');
  git(child, 'add', '-A'); git(child, 'commit', '-qm', 'reviewed');
  git(parent, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', child, 'vendor/lib');
  git(parent, 'add', '-A'); git(parent, 'commit', '-qm', 'parent');
  const local = path.join(parent, 'vendor/lib');
  const snapshot = () => snapshotRepository({ root: parent, changeId: 'demo' });
  assert.ok(snapshot().tree_hash);
  fs.writeFileSync(path.join(local, 'tracked.js'), 'changed\n');
  assert.throws(snapshot, /submodule.*unreviewed/);
  fs.writeFileSync(path.join(local, 'tracked.js'), 'reviewed\n');
  fs.writeFileSync(path.join(local, 'added.js'), 'added\n');
  assert.throws(snapshot, /submodule.*unreviewed/);
  fs.unlinkSync(path.join(local, 'added.js'));
  fs.unlinkSync(path.join(local, 'tracked.js'));
  assert.throws(snapshot, /submodule.*unreviewed/);
  fs.writeFileSync(path.join(local, 'tracked.js'), 'reviewed\n');
  fs.unlinkSync(path.join(local, '.git'));
  assert.throws(snapshot, /uninitialized submodule.*unreviewed/);
  const observed = observeSource({ repoRoot: parent, hubCwd: parent, changeId: 'demo', repoName: 'hub' });
  assert.match(observed.issue, /SOURCE_UNAVAILABLE/);
  assert.match(receiptIneligibility({ identity_issues: [observed.issue], exit_code: 0, signal: null,
    capture_error: null, source_changed_during_run: false, actor: { agent: 'Codex' } }), /no comparable source snapshot/);
});

test('indented commands preserve literal blank lines and checkbox-shaped output', () => {
  const before = '# Tasks\n## Phase\n    - **Done**: [x]\n\n    alpha\n\n\n    beta\n';
  assert.notEqual(normativeTasksHash(before), normativeTasksHash(before.replace('[x]', '[ ]')));
  assert.notEqual(normativeTasksHash(before), normativeTasksHash(before.replace('alpha\n\n\n    beta', 'alpha\n\n    beta')));
});

test('task completion markers remain administrative while their text is governed', () => {
  const pending = '# Tasks\n## Phase\n- [ ] Check every source byte.\n';
  assert.equal(normativeTasksHash(pending), normativeTasksHash(pending.replace('[ ]', '[x]')));
  assert.notEqual(normativeTasksHash(pending), normativeTasksHash(pending.replace('source byte', 'receipt byte')));
});
