import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gatedFixture, DELIVERY, refreshHandoff, cli } from './helpers/evidence-fixture.js';
import { fixture, merged } from './helpers/closure-fixture.js';
import { snapshotRepository, normativeTasksHash, sha256 } from '../src/tokens/evidence.js';
import { governedManifestHash, validateHandoffManifest } from '../src/tokens/handoff.js';
import { inspectEvidence } from '../src/lifecycle/eligibility.js';
import { loadConfig } from '../src/config/config.js';
import { loadChange } from '../src/config/artifacts.js';
import { retainEvidence, validateClosureIndex } from '../src/tokens/retention.js';
const require=createRequire(import.meta.url), yaml=require('js-yaml');
const records=[];
const record=(label,data)=>{records.push({label,...data});console.log(JSON.stringify({label,...data}));};
const git=(cwd,...args)=>execFileSync('git',args,{cwd,stdio:['ignore','pipe','pipe']}).toString().trim();
const actual=f=>inspectEvidence('demo',{cwd:f.cwd,config:loadConfig({cwd:f.cwd}).config,artifacts:loadChange(f.change).artifacts,delivery:DELIVERY.uncommitted});
function edit(file,fn){const raw=fs.readFileSync(file,'utf8'), end=raw.indexOf('\n---',4), data=yaml.load(raw.slice(4,end));fn(data);fs.writeFileSync(file,'---\n'+yaml.dump(data)+'---'+raw.slice(end+4));}
function body(change,value){const file=path.join(change,'tasks.md'),raw=fs.readFileSync(file,'utf8');fs.writeFileSync(file,raw.slice(0,raw.indexOf('# Tasks'))+value);}
function child(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'independent-child-'));git(root,'init','-q','-b','main');git(root,'config','user.name','Fixture');git(root,'config','user.email','fixture@example.invalid');fs.writeFileSync(path.join(root,'a.js'),'export const reviewed = 1;\n');git(root,'add','-A');git(root,'commit','-qm','source');return root;}

test('control: real fixture config yields eligible gates',async()=>{const f=await gatedFixture();const checked=actual(f);assert.deepEqual(checked.issues,[]);record('eligible-control',{cwd:f.cwd,gates:checked.gates});});

for(const flag of ['--assume-unchanged','--skip-worktree'])test('dirty submodule cannot hide behind '+flag,async()=>{
 const source=child();let before,after;
 const f=await gatedFixture({prepare:({cwd,git:g})=>{g('-c','protocol.file.allow=always','submodule','add','-q',source,'vendor/lib');before=snapshotRepository({root:cwd,changeId:'demo',untrackedPaths:['src/feature.js','src/link']});},tamper:({cwd})=>{
  const sub=path.join(cwd,'vendor/lib');git(sub,'update-index',flag,'a.js');fs.writeFileSync(path.join(sub,'a.js'),'export const unreviewed = 666;\n');try { after=snapshotRepository({root:cwd,changeId:'demo',untrackedPaths:['src/feature.js','src/link']}); } catch(error) { after={error:error.message}; }
 }});
 const checked=actual(f),handoff=validateHandoffManifest('demo',{cwd:f.cwd});record('submodule-'+flag,{cwd:f.cwd,status:git(path.join(f.cwd,'vendor/lib'),'status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none'),before,after,handoff,gates:checked.gates});
 assert.notDeepEqual(checked.issues,[],'unreviewed child bytes remained eligible');
});

test('literal fenced command starting directly in a list is normative',async()=>{
 const a="# Tasks\n## Phase 1\n- ```sh\n  cat <<'TEXT'\n  - **Done**: [x]\n  TEXT\n  ```\n",b=a.replace('[x]','[ ]');
 const f=await gatedFixture({prepare:({change})=>body(change,a),tamper:({cwd,change})=>{body(change,b);refreshHandoff(cwd);}});
 const checked=actual(f);record('list-fenced-literal',{cwd:f.cwd,hashes:[normativeTasksHash(a),normativeTasksHash(b)],gates:checked.gates});assert.notDeepEqual(checked.issues,[],'changed literal command stayed covered');
});

test('non-UTF8 change name through an escaping parent must never be read',async()=>{
 let file;
 const f={cwd:child()}; f.change=path.join(f.cwd,'openspec/changes/demo');fs.mkdirSync(path.join(f.change,'nested'),{recursive:true});fs.writeFileSync(path.join(f.change,'tasks.md'),'# Tasks\n');file=Buffer.concat([Buffer.from(f.change+'/nested/a'),Buffer.from([255]),Buffer.from('.md')]);fs.writeFileSync(file,'reviewed');git(f.cwd,'add','-A');git(f.cwd,'commit','-qm','raw name');
 const nested=path.join(f.change,'nested'),external=fs.mkdtempSync(path.join(os.tmpdir(),'outside-byte-change-'));fs.writeFileSync(Buffer.concat([Buffer.from(external+'/a'),Buffer.from([255]),Buffer.from('.md')]),'external benign sentinel');fs.rmSync(nested,{recursive:true});fs.symlinkSync(external,nested);
 const original=fs.readFileSync,reads=[];fs.readFileSync=function(name,...args){if(Buffer.isBuffer(name)&&name.equals(file))reads.push({path_hex:name.toString('hex'),outside_parent:external});return original.call(fs,name,...args);};
 let failure=null;try{snapshotRepository({root:f.cwd,changeId:'demo'});}catch(e){failure=e.message;}finally{fs.readFileSync=original;}
 record('raw-name-parent-symlink',{cwd:f.cwd,external,reads,failure});assert.deepEqual(reads,[],'outside bytes read before a later rejection');
});

test('non-UTF8 change name that is a final symlink must be rejected',async()=>{
 let file;
 const f={cwd:child()};f.change=path.join(f.cwd,'openspec/changes/demo');fs.mkdirSync(f.change,{recursive:true});fs.writeFileSync(path.join(f.change,'tasks.md'),'# Tasks\n');fs.writeFileSync(path.join(f.change,'proposal.md'),'# Proposal\n');file=Buffer.concat([Buffer.from(f.change+'/a'),Buffer.from([255]),Buffer.from('.md')]);fs.writeFileSync(file,'reviewed');git(f.cwd,'add','-A');git(f.cwd,'commit','-qm','raw name');
 fs.unlinkSync(file);fs.symlinkSync('proposal.md',file);let failure=null,result=null;try{result=snapshotRepository({root:f.cwd,changeId:'demo'});}catch(e){failure=e.message;}
 record('raw-name-final-symlink',{cwd:f.cwd,failure,result});assert.ok(failure,'change symlink accepted as source evidence');
});

test('archived prerequisite proposal must agree with the retained verified proposal',()=>{
 const f=fixture(),retained=retainEvidence('example',{cwd:f.cwd,rawDestination:f.rawDestination,delivery:merged});fs.rmSync(f.change,{recursive:true});fs.rmSync(path.join(f.cwd,'.specloom/runs'),{recursive:true});const archive=retained.archive;
 assert.equal(validateClosureIndex('example',{cwd:f.cwd}).ok,true);
 const indexFile=path.join(archive,'closure-index.json'),index=JSON.parse(fs.readFileSync(indexFile));const reportFile=path.join(archive,'code-review-report.md');
 edit(reportFile,data=>{
  const oldName=path.basename(data.source_binding.manifest_path),manifest=JSON.parse(fs.readFileSync(path.join(archive,oldName)));manifest.requirement.hash='f'.repeat(64);
  const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n'),digest=sha256(bytes),newName='handoff-manifest-sdd-code-review-'+digest+'.json';fs.writeFileSync(path.join(archive,newName),bytes);
  const indexed=index.files.find(e=>e.path===oldName);indexed.path=newName;indexed.sha256=digest;
  data.source_binding.manifest_path='openspec/changes/example/'+newName;data.source_binding.manifest_hash=digest;data.source_binding.governed_manifest_hash=governedManifestHash(manifest);data.source_binding.proposal_hash=manifest.requirement.hash;
  const ref=data.source_binding.receipts[0],entry=index.restricted_raw.find(e=>e.original_reference===ref.path),receipt=JSON.parse(fs.readFileSync(entry.reference));receipt.manifest_hash=digest;receipt.artifacts.proposal_hash=manifest.requirement.hash;fs.writeFileSync(entry.reference,JSON.stringify(receipt,null,2)+'\n');ref.sha256=entry.sha256=sha256(fs.readFileSync(entry.reference));
 });
 index.files.find(e=>e.path==='code-review-report.md').sha256=sha256(fs.readFileSync(reportFile));fs.writeFileSync(indexFile,JSON.stringify(index,null,2)+'\n');const checked=validateClosureIndex('example',{cwd:f.cwd});record('archive-foreign-proposal-chain',{cwd:f.cwd,verified_proposal:sha256(fs.readFileSync(path.join(archive,'proposal.md'))),reviewed_proposal:'f'.repeat(64),checked});assert.equal(checked.ok,false);
});

test('experimental CLI cannot be recorded as passed even as an extra adapter',async()=>{
 const f=await gatedFixture();edit(path.join(f.change,'runtime-gate-report.md'),data=>{data.adapters.cli={status:'passed',receipts:data.adapters.http.receipts};});const checked=actual(f),validation=await cli(['validate','demo','--ci','--cwd',f.cwd]);record('extra-experimental-cli',{cwd:f.cwd,runtime:checked.gates['runtime-gate-report.md'],validation});assert.equal(checked.gates['runtime-gate-report.md'].ok,false);
});
