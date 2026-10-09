import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { gatedFixture, DELIVERY, evidence, cli } from './helpers/evidence-fixture.js';
import { fixture, merged } from './helpers/closure-fixture.js';
import { retainEvidence, validateClosureIndex } from '../src/tokens/retention.js';
import { snapshotRepository } from '../src/tokens/evidence.js';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../package.json', import.meta.url));
const yaml=require('js-yaml');
const h=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const records=[];
function record(label,data){records.push({label,...data});console.log(JSON.stringify({label,...data}));}
function editReport(file,mutate){const raw=fs.readFileSync(file,'utf8');const end=raw.indexOf('\n---',4);const data=yaml.load(raw.slice(4,end));mutate(data);fs.writeFileSync(file,'---\n'+yaml.dump(data)+'---'+raw.slice(end+4));}
function archive(f){return path.join(f.cwd,'openspec/archive/example');}
function editIndex(f,mutate){const file=path.join(archive(f),'closure-index.json');const index=JSON.parse(fs.readFileSync(file));mutate(index);fs.writeFileSync(file,JSON.stringify(index,null,2)+'\n');}
function rehash(f,name){editIndex(f,index=>{index.files.find(e=>e.path===name).sha256=h(fs.readFileSync(path.join(archive(f),name)));});}

test('control: retained complete chain validates after removal of active folder',()=>{
 const f=fixture();retainEvidence('example',{cwd:f.cwd,rawDestination:f.rawDestination,delivery:merged});fs.rmSync(f.change,{recursive:true});
 assert.equal(validateClosureIndex('example',{cwd:f.cwd}).ok,true);
});

test('gate identity: a foreign change ID cannot remain an eligible review gate or advance next',async()=>{
 const f=await gatedFixture({tamper:({change})=>editReport(path.join(change,'code-review-report.md'),data=>{data.change_id='foreign';})});
 const eligible=evidence(f.cwd,f.change,DELIVERY.uncommitted);
 const next=await cli(['next','demo','--cwd',f.cwd,'--json']);
 const validation=await cli(['validate','demo','--cwd',f.cwd,'--json']);
 record('foreign-gate-identity',{cwd:f.cwd,gate:eligible.gates['code-review-report.md'],next,validation});
 assert.equal(eligible.gates['code-review-report.md'].ok,false);
});

test('gate schema: an invalid security schema and missing risk cannot remain eligible',async()=>{
 const f=await gatedFixture({tamper:({change})=>editReport(path.join(change,'security-report.md'),data=>{data.schema='code-review-report';delete data.risk;delete data.schema_version;})});
 const eligible=evidence(f.cwd,f.change,DELIVERY.uncommitted);
 record('invalid-gate-schema',{cwd:f.cwd,gate:eligible.gates['security-report.md'],next:await cli(['next','demo','--cwd',f.cwd,'--json'])});
 assert.equal(eligible.gates['security-report.md'].ok,false);
});

test('closure sealed identity: foreign governed hash in a retained gate must be rejected',()=>{
 const f=fixture();retainEvidence('example',{cwd:f.cwd,rawDestination:f.rawDestination,delivery:merged});fs.rmSync(f.change,{recursive:true});
 editReport(path.join(archive(f),'security-report.md'),data=>{data.source_binding.governed_manifest_hash='f'.repeat(64);data.source_binding.proposal_hash='e'.repeat(64);data.change_id='foreign';});rehash(f,'security-report.md');
 const checked=validateClosureIndex('example',{cwd:f.cwd});record('closure-gate-identity',{cwd:f.cwd,checked});assert.equal(checked.ok,false);
});

test('closure receipts: a retained execution failure cannot validate as a passed verification',()=>{
 const f=fixture();const retained=retainEvidence('example',{cwd:f.cwd,rawDestination:f.rawDestination,delivery:merged});fs.rmSync(f.change,{recursive:true});
 const entry=retained.index.restricted_raw.find(e=>e.original_reference.endsWith('/run-verify/execution-receipt.json'));
 const receipt=JSON.parse(fs.readFileSync(entry.reference));receipt.exit_code=7;receipt.capture_error='synthetic evidence capture failure';fs.writeFileSync(entry.reference,JSON.stringify(receipt,null,2)+'\n');
 const digest=h(fs.readFileSync(entry.reference));
 editIndex(f,index=>{index.restricted_raw.find(e=>e.original_reference===entry.original_reference).sha256=digest;});
 editReport(path.join(archive(f),'verification-report.md'),data=>{data.source_binding.receipts.find(e=>e.path===entry.original_reference).sha256=digest;});rehash(f,'verification-report.md');
 const checked=validateClosureIndex('example',{cwd:f.cwd});record('closure-failed-receipt',{cwd:f.cwd,checked});assert.equal(checked.ok,false);
});

test('closure receipts: a rehashed failed prerequisite gate remains ineligible', () => {
 const f=fixture();const retained=retainEvidence('example',{cwd:f.cwd,rawDestination:f.rawDestination,delivery:merged});fs.rmSync(f.change,{recursive:true});
 const entry=retained.index.restricted_raw.find(e=>e.original_reference.endsWith('/run-security/execution-receipt.json'));
 const receipt=JSON.parse(fs.readFileSync(entry.reference));receipt.exit_code=9;receipt.capture_error='synthetic failed capture';
 fs.writeFileSync(entry.reference,JSON.stringify(receipt,null,2)+'\n');
 const digest=h(fs.readFileSync(entry.reference));
 editIndex(f,index=>{index.restricted_raw.find(e=>e.original_reference===entry.original_reference).sha256=digest;});
 editReport(path.join(archive(f),'security-report.md'),data=>{data.source_binding.receipts.find(e=>e.path===entry.original_reference).sha256=digest;});
 rehash(f,'security-report.md');
 assert.equal(validateClosureIndex('example',{cwd:f.cwd}).ok,false);
});

test('closure losslessness: original receipts and raw for every required gate must be retained',()=>{
 const f=fixture();const retained=retainEvidence('example',{cwd:f.cwd,rawDestination:f.rawDestination,delivery:merged});
 const indexed=new Set(retained.index.restricted_raw.map(e=>e.original_reference));
 const missing=[];
 for(const report of ['code-review-report.md','security-report.md','runtime-gate-report.md']){
  const raw=fs.readFileSync(path.join(archive(f),report),'utf8');const source=yaml.load(raw.split('---\n')[1]).source_binding;
  for(const ref of source.receipts)if(!indexed.has(ref.path))missing.push({report,path:ref.path});
 }
 record('closure-lost-gate-receipts',{cwd:f.cwd,missing});assert.deepEqual(missing,[]);
});

test('source snapshot contained read: task audit list cannot be read through an escaping parent symlink',async()=>{
 const f=await gatedFixture();const external=fs.mkdtempSync(path.join(os.tmpdir(),'review8-external-change-'));
 fs.cpSync(f.change,external,{recursive:true});fs.rmSync(f.change,{recursive:true});fs.symlinkSync(external,f.change);
 const originalRead=fs.readFileSync;const reads=[];fs.readFileSync=function(file,...args){if(String(file).startsWith(f.change+'/'))reads.push(String(file));return originalRead.call(fs,file,...args);};
 let failure=null;
 try{snapshotRepository({root:f.cwd,changeId:'demo'});}catch(error){failure=error.message;}finally{fs.readFileSync=originalRead;}
 record('snapshot-escaping-read',{cwd:f.cwd,external,reads,failure});assert.deepEqual(reads,[],'snapshot read change files outside the root before checking containment');
});
