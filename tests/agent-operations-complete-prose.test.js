'use strict';
require('./helpers/historical-starter-fixture.cjs'); // Explicit pre-fix offline task replay.
const {test}=require('node:test'),a=require('node:assert/strict');
const impl=require('../lib/agent-operations-implementation'),v1=require('../lib/agent-operations-engineering-inference'),v2=require('../lib/agent-operations-engineering-provider-v2'),old=require('./fixtures/engineering-implementation-guidance-v1-requests.json');
const context=assignment=>({...structuredClone(old.context),assignment,priorReceipts:[]});
test('all five historical guidance v1/v2 requests and policy descriptors remain exact',async()=>{
 a.equal(impl.GUIDANCE_OBJECTIVE,old.assignment);a.deepEqual(v2.GUIDANCE_STARTER_TRIAL,old.starter);a.deepEqual(v2.GUIDANCE_DEVELOPMENT_TRIAL,old.development);
 const c=context(old.assignment),native=context(old.assignment);
 for(const row of old.requests){a.deepEqual(v1.buildRequest(row.stage,c),row.v1);a.deepEqual(v2.request(row.stage,native),row.v2);c.priorReceipts.push(v1.executeFixture(row.stage,c));const response=impl.fixture(row.stage,native);let artifact;
  if(row.stage==='specialist'){const binding=impl.workspaceBinding(native),workspace=await require('../scripts/agent-operations-draft-workspace.cjs').prepareProposal({sourceSha:binding.runtime.sourceCommit,expectedSourceSha:binding.runtime.sourceCommit,binding,proposal:impl.proposal(response.proposal,native),authorize:async()=>true});a.equal(workspace.cleanup.destroyed,true);artifact=impl.artifactFor(native,response.proposal,workspace);}
  const body={version:v2.VERSION,stage:row.stage,binding:structuredClone(native.binding),response,acceptedWork:false,...(artifact?{implementationArtifact:artifact}:{})};native.priorReceipts.push({...body,hash:v2.hash(body)});
 }
});
const fragments={scope:'Preserve the existing assignment of d.automations or an empty array to automationsData during handler execution for entitled users that receive feed data as a n',exclusions:'Do not change pricing, plan entitlements, the Automations interface, or unrelated feeds or handlers as part of this proposal for a gate in the feed layer for n',deliverables:'Request separately permitted backend tests in a disposable copy and require sourceTests receipts before reporting any execution results as verified evidence for'};
for(const[key,fragment]of Object.entries(fragments))test('observed Chief '+key+' fragment stays historical but is denied for new assignments',()=>{
 const prior=context(impl.GUIDANCE_OBJECTIVE),now=context(impl.OBJECTIVE),value=impl.fixture('chief-plan',prior);value[key]=[fragment];a(v1.parseResponse('chief-plan',value,prior));a.throws(()=>v1.parseResponse('chief-plan',value,now),/ENG_AI_RESPONSE_SCHEMA/);
 const issue=require('../lib/agent-operations-engineering-failure').artifactIssue('chief-plan',JSON.stringify(value),now);a.equal(issue.location,'$.'+key+'[0]');a.equal(issue.mismatch,'pattern');
});
test('new Chief rejects punctuation appended to obvious dangling clauses and does not repair model text',()=>{
 const c=context(impl.OBJECTIVE),value=impl.fixture('chief-plan',c);value.deliverables=['Require evidence for.'];const before=JSON.stringify(value);
 a.throws(()=>v1.parseResponse('chief-plan',value,c),e=>e.message==='ENG_AI_REPORT_QUALITY'&&e.validationIssue.location==='$.deliverables[0]'&&e.validationIssue.mismatch==='incomplete-statement');a.equal(JSON.stringify(value),before);
});
test('brief complete Chief assignment passes; labels/source identifiers and old contracts are not sentence-classified',()=>{
 const c=context(impl.OBJECTIVE),value=impl.fixture('chief-plan',c);value.scope=['Preserve the existing Automations handler.'];value.exclusions=['Leave plans, pricing and unrelated feeds unchanged.'];value.deliverables=['Return the scoped patch and separately verified test receipts.'];a(v1.parseResponse('chief-plan',value,c));
 a.match(v2.request('chief-plan',c).body.instructions,/short self-contained sentence/);a(!v2.request('chief-plan',context(impl.GUIDANCE_OBJECTIVE)).body.instructions.includes('short self-contained sentence'));
 a.equal(impl.proseQuality({assignment:impl.OBJECTIVE+' extra'}),false);
});
test('historical guidance grants remain readable but cannot admit the new prose task',()=>{
 a.equal(v2.hash(v2.GUIDANCE_DEVELOPMENT_TRIAL),'ba2ccc06d89722b5b3a66bcbfb82d9b476885345887147d91912e0176f71cce1');
 for(const t of [v2.GUIDANCE_STARTER_TRIAL,v2.GUIDANCE_DEVELOPMENT_TRIAL]){const approval={countPricing:{kind:t.kind,authorizationId:t.authorizationId,evidenceHash:v2.hash(t),uncertaintyAccepted:true,providerHardCap:false}};a.equal(v2.trialFor(approval),t);a.equal(v2.countPolicyPinned(approval,{CALLERCORE_AGENTOPS_ENGINEERING_TRIAL_AUTHORIZATION_ID:t.authorizationId,CALLERCORE_AGENTOPS_ENGINEERING_COUNT_UNCERTAINTY_SHA256:v2.hash(t)}),false);}
});
