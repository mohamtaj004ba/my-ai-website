'use strict';
require('./helpers/historical-starter-fixture.cjs'); // Explicit pre-fix offline task replay.
// Independent Work QA of the native transport/controller path. Every provider
// response below is a named offline fixture; no API credential or network is used.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const org=require('../lib/agent-operations-organization'),controlFactory=require('../lib/agent-operations-activation-controller').createEngineeringOwnerControl,v1=require('../lib/agent-operations-engineering-inference'),v2=require('../lib/agent-operations-engineering-provider-v2'),impl=require('../lib/agent-operations-implementation'),helper=require('../lib/agent-operations-engineering-rehearsal'),budget=require('../lib/agent-operations-budget');
const CURRENT_PRODUCT_SOURCE=fs.readFileSync(path.join(__dirname,'../dashboard.js'),'utf8');
const identity=x=>crypto.createHash('sha256').update(x).digest('hex'),owner={kind:'owner',verifiedOwner:true,id:'live-patch-qa@example.test',workspaceId:'live-patch-qa-workspace'},PROJECT=require('../lib/agent-operations-project').PROJECT;
const {setup,authorize,installProvider,sandboxFixture}=require('./helpers/engineering-provider-fixtures.cjs');

test('existing five-stage controller automatically dispatches permitted source tests before QA and supplies verified outcomes',async()=>{
 const sandbox=sandboxFixture(),f=await setup(sandbox),input=await authorize(f),provider=installProvider(f,{afterResponse(stage,c,value){if(stage==='chief-plan'){value.completionCriteria=['Exclude the Automations feed for Starter and retain it for eligible plans.','Preserve the existing Automations data handler and unrelated feeds.','Report the fixed Starter test receipts and remaining full-app verification limits.'];value.scope=['Gate only the existing optional Automations feed entry.','Preserve feed handling and entitlement definitions.'];value.exclusions=['No repository publication, customer changes or acceptance.','No arbitrary commands, new dependencies or unrestricted execution.'];value.deliverables=['Return one source-bound patch and evidence for each criterion.','Return test outcomes and separate QA and Auditor criticism.'];}}});
 try{const result=await f.control.run(owner,input),r=result.result,e=r.receipts[1].sourceTestEvidence;
  a.equal(r.receipts.length,5);a(e);a.equal(e.receipt.status,'completed');a.equal(e.receipt.stopConfirmed,true);a.equal(e.receipt.result.tests.length,7);a.deepEqual(sandbox.counts(),{starts:1,stops:1});
  a.equal(r.receipts[1].implementationArtifact.sourceExecuted,false);a.equal(r.receipts[3].response.decision,'fail');a.equal(r.receipts[4].response.auditDecision,'fail');a.equal(r.acceptedWork,false);a.equal(result.shutdown.status,'revoked');
  a.equal(r.receipts[1].implementationArtifact.workspace.cleanup.destroyed,true);a.equal(r.receipts[1].response.acceptanceMapping.length,3);a.deepEqual(r.receipts[4].response.findings,r.receipts[2].response.decisions.map(d=>({findingId:d.findingId,qaDecision:d.decision,reason:d.reason,evidenceIds:d.evidenceIds})));a.match(r.receipts[3].response.reason,/full-app behavior/);for(const receipt of r.receipts){const {hash,...body}=receipt;a.equal(v2.hash(body),hash);}
  for(const index of [2,3,4]){const request=provider.requests.filter(x=>x.url.endsWith('/responses'))[index].request;a(JSON.stringify(request).includes(e.receipt.hash));a(JSON.stringify(request).includes('sourceTests'));}
  const state=f.state(),w=state.operations.workflows[0],run=w.attempts[1].sourceTestRun;a.equal(run.status,'completed');a.equal(state.operations.approvals[0].sourceTestAuthority.status,'consumed');a.equal(run.receipt.hash,e.receipt.hash);a.equal(require('../lib/agent-operations-engineering-configuration').physicalWorkflowClean(w),true);
  a(state.operations.grants.every(g=>g.revoked));a.equal(provider.calls.length,10);a.equal(provider.calls.filter(u=>u.endsWith('/responses')).length,5);a.equal(provider.calls.filter(u=>u.endsWith('/input_tokens')).length,5);a.deepEqual(r.receipts.map(x=>x.stage),v1.STAGES);for(const receipt of r.receipts){a.equal(receipt.binding.runtime.sourceCommit,f.runtime.commit);a.equal(receipt.binding.runtime.release.digest,f.release.digest);a.equal(receipt.acceptedWork,false);a.equal(receipt.publicationAuthorized,false);}a.equal(fs.readFileSync(path.join(__dirname,'../dashboard.js'),'utf8'),CURRENT_PRODUCT_SOURCE);
 }finally{provider.restore();}
});
test('new Chief fragments stop the real controller before Specialist count, workspace or isolated tests',async()=>{
 const sandbox=sandboxFixture(),f=await setup(sandbox),input=await authorize(f),provider=installProvider(f,{afterResponse(stage,c,value){if(stage==='chief-plan')value.deliverables=['Require evidence for.'];}});
 try{await a.rejects(f.control.run(owner,input));const s=f.state(),w=s.operations.workflows[0],failure=w.attempts[0].failure.diagnostic;a.equal(w.results.length,0);a.equal(w.attempts.length,1);a.equal(failure.code,'ENG_AI_REPORT_QUALITY');a.equal(failure.location,'$.deliverables[0]');a.equal(failure.mismatch,'incomplete-statement');a.equal(provider.calls.length,2);a.equal(w.attempts[0].diagnostic.inputTokens,1000);a.equal(w.attempts[0].diagnostic.outputTokens,500);a.deepEqual(sandbox.counts(),{starts:0,stops:0});a(w.attempts.every(x=>x.closed));a(s.operations.grants.every(g=>g.revoked));a.equal(s.operations.approvals[0].status,'revoked');}finally{provider.restore();}
});
test('failed source tests stop before QA, retain model usage, close the sandbox and revoke prior authority',async()=>{
 const sandbox=sandboxFixture({fail:true}),f=await setup(sandbox),input=await authorize(f),provider=installProvider(f);
 try{await a.rejects(f.control.run(owner,input));const s=f.state(),w=s.operations.workflows[0];a.equal(w.results.length,1);a.equal(provider.calls.length,4);a.equal(w.attempts[1].sourceTestRun.status,'failed');a.equal(w.attempts[1].sourceTestRun.receipt.stopConfirmed,true);a.equal(w.attempts[1].diagnostic.inputTokens,1000);a(s.operations.grants.every(g=>g.revoked));a.deepEqual(sandbox.counts(),{starts:1,stops:1});a(!JSON.stringify(w.attempts[1].sourceTestRun.receipt).includes('SYNTHETIC_SECRET'));
 }finally{provider.restore();}
});
test('concurrent owner companion authorization consumes only one exact prepared approval revision',async()=>{
 const f=await setup(sandboxFixture()),m=await f.control.trialManifest(owner,{planId:f.plan.id,expectedRevision:1,sequenceId:f.sequenceId}),input={planId:f.plan.id,expectedRevision:1,approval:m.approval},p=await f.control.prepare(owner,input);
 const results=await Promise.allSettled([1,2].map(()=>f.control.authorizeSourceTests(owner,{...input,expectedApprovalRevision:p.record.revision})));a.equal(results.filter(r=>r.status==='fulfilled').length,1);a.equal(f.state().operations.audit.filter(x=>x.type==='engineering_source_tests_authorized').length,1);
});
for(const kind of ['grant-revoked','permit-expired'])test('actual CAS '+kind+' during source tests prevents acceptance and preserves shutdown',async()=>{
 let f;const sandbox=sandboxFixture({duringRun:()=>{const s=f.state();if(kind==='grant-revoked')s.operations.grants.forEach(g=>g.revoked=true);else s.operations.workflows[0].attempts[1].sourceTestRun.permit.expiresAt=0;f.set(s);}});f=await setup(sandbox);const input=await authorize(f),provider=installProvider(f);
 try{await a.rejects(f.control.run(owner,input));const s=f.state(),w=s.operations.workflows[0];a.equal(w.results.length,1);a.equal(provider.calls.length,4);a.equal(w.attempts[1].sourceTestRun.receipt.stopConfirmed,true);a.equal(w.attempts[1].sourceTestRun.status,'failed');a(s.operations.grants.every(g=>g.revoked));a.deepEqual(sandbox.counts(),{starts:1,stops:1});}finally{provider.restore();}
});
test('unconfirmed source VM shutdown cannot be masked by destroyed data workspace or historical reconciliation',async()=>{
 const sandbox=sandboxFixture({cleanupFailure:true}),f=await setup(sandbox),input=await authorize(f),provider=installProvider(f);
 try{await a.rejects(f.control.run(owner,input));const s=f.state(),w=s.operations.workflows[0],r=w.attempts[1];a.equal(r.workspacePreparation.status,'destroyed');a.equal(r.sourceTestRun.status,'cleanup-unconfirmed');a.equal(r.sourceTestRun.receipt.stopConfirmed,false);a.equal(require('../lib/agent-operations-engineering-configuration').physicalWorkflowClean(w),false);a.equal(provider.calls.length,4);a(s.operations.grants.every(g=>g.revoked));a.equal(w.results.length,1);}finally{provider.restore();}
});


test('safe assertion failure reaches genuine controller review and final reporting without accepting the patch',async()=>{
 const sandbox=sandboxFixture({assertionFailure:true}),f=await setup(sandbox),input=await authorize(f),provider=installProvider(f,{afterResponse(stage,c,value){if(stage==='qa')for(const d of value.decisions){d.decision='unresolved';d.reason='The preserved isolated assertion failed; the patch must remain unaccepted.';}if(stage==='auditor')value.reason='Reject the proposal because its preserved isolated assertion failed.';}});
 try{const result=await f.control.run(owner,input),receipts=result.result.receipts,e=receipts[1].sourceTestEvidence;
  a.equal(receipts.length,5);a.equal(e.receipt.status,'completed');a.equal(e.receipt.stopConfirmed,true);a.equal(e.receipt.result.testsPassed,false);a.equal(e.receipt.result.reviewDisposition,'behavioral-failure');a.equal(e.receipt.result.tests[0].passed,false);a.equal(result.result.acceptedWork,false);a.equal(receipts[3].response.decision,'fail');a.equal(receipts[4].response.auditDecision,'fail');
  for(const index of [2,3,4]){const request=provider.requests.filter(x=>x.url.endsWith('/responses'))[index].request;a(JSON.stringify(request).includes('behavioral-failure'));a(JSON.stringify(request).includes(e.receipt.hash));}
  a.equal(provider.calls.length,10);a.deepEqual(sandbox.counts(),{starts:1,stops:1});a(f.state().operations.grants.every(g=>g.revoked));a.equal(result.shutdown.status,'revoked');a.equal(fs.readFileSync(path.join(__dirname,'../dashboard.js'),'utf8'),CURRENT_PRODUCT_SOURCE);
 }finally{provider.restore();}
});
