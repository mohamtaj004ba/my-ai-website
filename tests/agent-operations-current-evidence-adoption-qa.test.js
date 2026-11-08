'use strict';
// Current canonical capture and exact historical readback; no source execution.
const {test}=require('node:test'),a=require('node:assert/strict'),rehearsal=require('../lib/agent-operations-engineering-rehearsal'),inference=require('../lib/agent-operations-engineering-inference'),tools=require('../lib/agent-operations-engineering-tools');
const prior=require('../lib/agent-operations-engineering-inference-evidence-v9.json'),current=require('../lib/agent-operations-engineering-inference-evidence-v10.json');
function persisted(evidence){const runtime={deploymentId:'dpl_history',origin:'https://my-ai-website-history-mohamtaj004bas-projects.vercel.app',sourceCommit:'c'.repeat(40),branch:'feature/callercore-dashboards',release:{version:'organization-contracts-v4',digest:'d'.repeat(64)}},ctx={binding:{planId:'plan',taskId:'task',executionId:'exec',fence:1,ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),runtime,authorizationRevision:1},assignment:'Inspect supplied source only.',evidence:structuredClone(evidence),priorReceipts:[]},template='engineering-ai-plan',body={context:ctx,receipt:inference.executeFixture('chief-plan',ctx),worker:{kind:'existing-restricted-organization-child',terminated:true,trustedDataOnly:true,sourceExecuted:false,paidTransport:false},artifact:null},binding={...ctx.binding,engineeringProfile:rehearsal.PROFILE};delete binding.authorizationRevision;const r={version:rehearsal.VERSION,stage:template,binding,body,receiptHash:tools.hash({template,body})};return[{id:'plan',objective:ctx.assignment,engineeringProfile:rehearsal.PROFILE,runtime},{id:'task',template,fence:1,revision:2,attempts:[{executionId:'exec'}],result:{body:{engineering:r}}},{ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64)}];}

test('new evidence derives only unique unchanged anchors from authenticated current capture',()=>{
 a.equal(tools.hash(prior),'9e8f8bfeb77b76a752b0b5aca43c41e09fbac962d88b90d09638ba4609f8f792');a.equal(tools.hash(current),'3210a4e5063889fef2b0281ea69af897d1c066d067885dde0ea77643bc6b52c5');
 const capture=tools.captureApproved();a.deepEqual(rehearsal.sourceEvidence(),current.evidence);a.equal(current.profile,prior.profile);a.equal(current.evidence.length,prior.evidence.length);
 current.evidence.forEach((e,i)=>{const p=prior.evidence[i],{line,sha256,...fixed}=e,{line:oldLine,sha256:oldSha,...previous}=p;a.deepEqual(fixed,previous);const text=capture.texts[e.path];a.equal(tools.hash(text),e.sha256);a.equal(capture.manifest.files.find(f=>f.path===e.path).sha256,e.sha256);a.equal(text.split('\n')[e.line-1],e.text);a.equal(text.split('\n').filter(x=>x===e.text).length,1);a.equal(tools.hash(e.text),e.excerptHash);});
});
test('v9 remains exact persisted history, v10 admits current; forged or mixed hashes fail closed',()=>{
 for(const e of [prior.evidence,current.evidence])a.equal(rehearsal.validatePersisted(...persisted(e)),true);
 const forged=structuredClone(prior.evidence);forged[0].sha256='f'.repeat(64);a.throws(()=>rehearsal.validatePersisted(...persisted(forged)),/ENG_AI_EVIDENCE_SUBSTITUTED/);
 const mixed=structuredClone(prior.evidence);const changed=current.evidence.findIndex((e,i)=>e.sha256!==prior.evidence[i].sha256);a(changed>=0);mixed[changed]={...structuredClone(current.evidence[changed]),line:prior.evidence[changed].line+1};a.throws(()=>rehearsal.validatePersisted(...persisted(mixed)),/ENG_AI_EVIDENCE_SUBSTITUTED/);
});
test('historical whole-file identity cannot be selected by current admission',()=>{
 const original=tools.captureApproved,capture=original(),old=prior.evidence.find(e=>current.evidence.find(v=>v.id===e.id)?.sha256!==e.sha256);a(old);capture.manifest.files.find(f=>f.path===old.path).sha256=old.sha256;tools.captureApproved=()=>capture;try{a.throws(()=>rehearsal.sourceEvidence(),/ENG_AI_SOURCE_STALE/);}finally{tools.captureApproved=original;}a.deepEqual(rehearsal.sourceEvidence(),current.evidence);
});

test('offline generator requires pinned predecessor and only emits separately reviewed unchanged-anchor candidate',()=>{
 const fs=require('node:fs'),generator=require('../scripts/prepare-engineering-evidence.cjs'),write=fs.writeFileSync,capture=tools.captureApproved,pin=tools.hash(prior);let emitted=null,writes=0;
 fs.writeFileSync=function(path,bytes,options){a.equal(path,'lib/agent-operations-engineering-inference-evidence-v10.json');a.deepEqual(options,{flag:'wx'});writes++;emitted=JSON.parse(bytes);};
 try{a.throws(()=>generator.prepare(9,10,'f'.repeat(64)),/Authenticated previous evidence/);a.equal(writes,0);a.throws(()=>generator.prepare(9,11,pin),/Adjacent evidence/);a.equal(writes,0);const r=generator.prepare(9,10,pin);a.deepEqual(emitted,current);a.equal(r.sha256,tools.hash(current));a.equal(r.executionAuthorized,false);a.equal(r.requiresReviewedSelection,true);a.equal(writes,1);
 const duplicate=capture(),e=prior.evidence[0];duplicate.texts[e.path]+='\n'+e.text;tools.captureApproved=()=>duplicate;a.throws(()=>generator.prepare(9,10,pin),/Unique unchanged evidence anchor/);a.equal(writes,1);
 const missing=capture();missing.texts[e.path]=missing.texts[e.path].replace(e.text,'missing anchor');tools.captureApproved=()=>missing;a.throws(()=>generator.prepare(9,10,pin),/Unique unchanged evidence anchor/);a.equal(writes,1);
 }finally{fs.writeFileSync=write;tools.captureApproved=capture;}
});
