import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gatedFixture, DELIVERY, evidence, cli, commitEverything, bindAll, cloneOf } from './helpers/evidence-fixture.js';
import { writeHandoffManifest } from '../src/tokens/handoff.js';
import { loadConfig } from '../src/config/config.js';
import { loadChange } from '../src/config/artifacts.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
const require=createRequire(new URL('../package.json', import.meta.url)),yaml=require('js-yaml');
const observations=[];
function record(label,data){observations.push({label,...data});console.log(JSON.stringify({label,...data}));}
function edit(file,mutate){const raw=fs.readFileSync(file,'utf8'),end=raw.indexOf('\n---',4),data=yaml.load(raw.slice(4,end));mutate(data);fs.writeFileSync(file,'---\n'+yaml.dump(data)+'---'+raw.slice(end+4));}
function boundedCli({ report, manifest, ref }) {
 report.adapters.cli = { status: 'not_applicable', reason_code: 'NOT_RELEVANT_TO_CHANGE',
  exclusion: { reason: 'Approved bounded substitute in synthetic test', authority: manifest.requirement,
   covered_criteria: ['AC-1'], substitute_receipts: [ref] } };
 report.coverage.push({ criterion: 'AC-1', repository: 'hub', adapter: 'cli', receipt: ref });
}
function currentEvidence(f){return inspectEvidence('demo',{cwd:f.cwd,config:loadConfig({cwd:f.cwd}).config,artifacts:loadChange(f.change).artifacts,delivery:DELIVERY.uncommitted});}
test('runtime experimental CLI: a structurally correlated receipt cannot clear an unsupported adapter as passed',async()=>{
 const f=await gatedFixture({prepareRuntime: boundedCli, prepare:({cwd,change})=>{
   const config=path.join(cwd,'playbook.config.yaml');fs.writeFileSync(config,fs.readFileSync(config,'utf8').replaceAll('cli: false','cli: true'));
   edit(path.join(change,'tasks.md'),data=>{data.handoff.runtime_coverage[0].capabilities.push('cli');});
 }});
 edit(path.join(f.change,'runtime-gate-report.md'),data=>{const ref=data.adapters.http.receipts[0];data.adapters.cli={status:'passed',receipts:[ref]};data.coverage.push({criterion:'AC-1',repository:'hub',adapter:'cli',receipt:ref});});
 const result=currentEvidence(f);const validation=await cli(['validate','demo','--ci','--cwd',f.cwd]);
 record('experimental-cli-passed',{cwd:f.cwd,runtime:result.gates['runtime-gate-report.md'],validation});
 assert.equal(result.gates['runtime-gate-report.md'].ok,false);
});
test('runtime sibling configuration: unreadable authoritative capabilities cannot silently fall back to Hub declarations',async()=>{
 const service=fs.mkdtempSync(path.join(os.tmpdir(),'review8-capabilities-'));
 const g=(...args)=>execFileSync('git',args,{cwd:service,stdio:['ignore','pipe','pipe']});g('init','-q','-b','demo');g('config','user.name','Fixture');g('config','user.email','f@example.invalid');
 fs.writeFileSync(path.join(service,'playbook.config.yaml'),'version: 2\ncapabilities: {browser: false, http: false, cli: false, worker: false}\n');g('add','-A');g('commit','-qm','malformed authoritative config');
 const f=await gatedFixture({prepare:({cwd,change})=>{
   const config=path.join(cwd,'playbook.config.yaml'),data=yaml.load(fs.readFileSync(config,'utf8'));data.repos.service={path:service,capabilities:{browser:false,http:false,cli:false,worker:false}};fs.writeFileSync(config,yaml.dump(data));
   const proposal=path.join(change,'proposal.md');fs.writeFileSync(proposal,fs.readFileSync(proposal,'utf8').replace('## Impacted repos\n- hub','## Impacted repos\n- hub\n- service'));
 }});
 fs.writeFileSync(path.join(service,'playbook.config.yaml'),'version: 2\ncapabilities: [\n  browser: true\n');
 writeHandoffManifest('demo', { cwd: f.cwd, stage: 'sdd-apply', agent: 'Fixture' });
 const result=currentEvidence(f);const validation=await cli(['validate','demo','--ci','--cwd',f.cwd]);
 record('unreadable-own-capabilities',{cwd:f.cwd,service,runtime:result.gates['runtime-gate-report.md'],validation});
 assert.equal(result.gates['runtime-gate-report.md'].ok,false);
 assert.match(result.gates['runtime-gate-report.md'].issues.join(' '), /invalid own capability configuration/);
});

test('experimental CLI passed coverage fails portable CI in an exact-head clone', async () => {
 const f=await gatedFixture({prepareRuntime: boundedCli, prepare:({cwd,change})=>{
   const config=path.join(cwd,'playbook.config.yaml');fs.writeFileSync(config,fs.readFileSync(config,'utf8').replaceAll('cli: false','cli: true'));
   edit(path.join(change,'tasks.md'),data=>{data.handoff.runtime_coverage[0].capabilities.push('cli');});
 }});
 commitEverything(f);bindAll(f.cwd);f.git('add','-A');f.git('commit','-qm','synthetic bindings');
 const clone=cloneOf(f.cwd);
 edit(path.join(clone,'openspec/changes/demo/runtime-gate-report.md'), data => {
   const ref = data.adapters.http.receipts[0]; data.adapters.cli = { status: 'passed', receipts: [ref] };
 });
 const checked=await cli(['validate','demo','--ci','--cwd',clone,'--json']);
 assert.notEqual(checked.code,0);
 assert.match(checked.out,/adapter cli cannot pass with experimental support/);
});
