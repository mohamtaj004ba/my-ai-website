'use strict';
// Provider-free regression from observed history and independently varied stage
// responses. These checks never represent live reasoning or execute model code.
const test=require('node:test'),a=require('node:assert/strict');
const handoff=require('../lib/agent-operations-engineering-handoff'),inf=require('../lib/agent-operations-engineering-inference'),provider=require('../lib/agent-operations-engineering-provider-v2'),phone=require('../lib/agent-operations-phone-search'),copy=require('../lib/agent-operations-proposal-copy'),report=require('../lib/agent-operations-engineering-report');
const observed=require('./fixtures/phone-chief-observed-050085d9.json');
function context(){
 const binding=structuredClone(observed.receipt.binding);
 binding.planId='offline_handoff_plan';binding.taskId='offline_handoff_task';binding.executionId='offline_handoff_execution';
 binding.runtime=handoff.runtime({...binding.runtime,release:require('../lib/agent-operations-contracts').release()});
 return{binding,assignment:phone.OBJECTIVE,evidence:phone.snapshot().evidence,priorReceipts:[]};
}
async function append(c,stage,response){
 inf.parseResponse(stage,response,c);
 const parsed={response,usage:{inputTokens:100,outputTokens:100,reasoningTokens:0,cachedInputTokens:0,cacheWriteTokens:0,calculatedCostMicros:1200},provider:{id:'resp_offline_handoff',status:'completed',model:'gpt-6.1-sol',serviceTier:'default'}};
 let artifact;
 if(stage==='specialist'){const impl=require('../lib/agent-operations-implementation'),workspace=await require('../scripts/agent-operations-draft-workspace.cjs').prepareImplementation({context:c,sourceSha:c.binding.runtime.sourceCommit,expectedSourceSha:c.binding.runtime.sourceCommit,proposal:impl.proposal(response.proposal,c),binding:impl.workspaceBinding(c),authorize:async()=>true,timeoutMs:8000});artifact=impl.artifactFor(c,response.proposal,workspace);}
 c.priorReceipts.push(provider.receipt(stage,c,parsed,'fixture','e'.repeat(64),artifact));
}
test('historical current-release Chief request and quality receipt remain byte-exact',()=>{
 const c={binding:observed.receipt.binding,assignment:phone.OBJECTIVE,evidence:phone.snapshot().evidence,priorReceipts:[]};
 a.equal(handoff.enabled(c),false);
 a.equal(provider.request('chief-plan',c).requestHash,'b3baf182105ccdede9a4df40b04a94ac63fb8462ec0cb2d82a71794eb6d46eba');
 a.deepEqual(inf.parseResponse('chief-plan',observed.receipt.response,c),observed.receipt.response);
 a.deepEqual(report.qualityRecord('chief-plan',observed.receipt.response,c),observed.receipt.reportQuality);
});
test('observed dangling comparison fails new contract before Specialist, without inventing rejected mapping',()=>{
 const c=context();a.throws(()=>inf.parseResponse('chief-plan',observed.receipt.response,c),e=>e.message==='ENG_AI_REPORT_QUALITY'&&e.validationIssue.location==='$.completionCriteria[0]'&&e.validationIssue.mismatch==='incomplete-criterion');
});
for(const count of [1,3,4])test('all handoffs derive from actual Chief criteria, independent of four task requirements: '+count,async()=>{
 const c=context(),chief=phone.fixture('chief-plan',c);
 chief.completionCriteria=['Compare phone formats across all five paths.','Preserve text search and filtering.','Verify paging and authorization.','Report test evidence and remaining uncertainty.'].slice(0,count);
 await append(c,'chief-plan',chief);
 const scope=handoff.data(c);a.equal(scope.taskRequirements.length,4);a.equal(scope.acceptanceCriteria.length,count);
 const s=copy.schema('specialist',inf.schema('specialist'),c);a.equal(s.properties.acceptanceMapping.minItems,count);a.equal(s.properties.acceptanceMapping.maxItems,count);
 const specialist=phone.fixture('specialist',c);a.equal(specialist.acceptanceMapping.length,count);
 // Two findings with disjoint evidence catch the old phone-only QA schema gap.
 specialist.findings[0].evidenceIds=['calls'];specialist.findings.push({...specialist.findings[0],id:'second-independent-finding',evidenceIds:['contacts']});
 for(const rows of [[],specialist.acceptanceMapping.concat(specialist.acceptanceMapping[0]),specialist.acceptanceMapping.map(x=>({...x,criterion:99}))])a.throws(()=>inf.parseResponse('specialist',{...specialist,acceptanceMapping:rows},c));
 await append(c,'specialist',specialist);
 const qa=phone.fixture('qa',c),qs=copy.schema('qa',inf.schema('qa'),c);
 a.equal(qs.properties.decisions.minItems,2);a.equal(qs.properties.decisions.items.anyOf.length,2);
 const wrong=structuredClone(qa);wrong.decisions[0].evidenceIds=['contacts'];a.throws(()=>inf.parseResponse('qa',wrong,c));
 await append(c,'qa',qa);await append(c,'auditor',phone.fixture('auditor',c));
 const final=phone.fixture('chief-final',c),fs=copy.schema('chief-final',inf.schema('chief-final'),c);
 a.deepEqual(fs.properties.auditDecision.enum,['fail']);a.deepEqual(fs.properties.acceptedWork.enum,[false]);
 a.throws(()=>inf.parseResponse('chief-final',{...final,auditDecision:'pass'},c));
 const changed=structuredClone(final);changed.findings[0].reason='The model concealed the criticism.';a.throws(()=>inf.parseResponse('chief-final',changed,c));
 await append(c,'chief-final',final);a.equal(c.priorReceipts.length,5);a.equal(final.acceptedWork,false);
});
test('style observations remain attributable but do not force an Auditor decision',async()=>{
 const c=context(),chief=phone.fixture('chief-plan',c);chief.problem='Format-sensitive lookup';await append(c,'chief-plan',chief);
 a(report.qualityReview(c).advisoryIssuesPresent);a.equal(report.qualityReview(c).unresolved,false);
 await append(c,'specialist',phone.fixture('specialist',c));await append(c,'qa',phone.fixture('qa',c));
 const s=copy.schema('auditor',inf.schema('auditor'),c);a.deepEqual(s.properties.decision.enum,['pass','fail','unresolved']);
 const value=phone.fixture('auditor',c);value.decision='pass';a.doesNotThrow(()=>inf.parseResponse('auditor',value,c));
 value.qualityReviewRefs=[];a.throws(()=>inf.parseResponse('auditor',value,c));
});
test('unknown contract and changing marker mid-chain cannot silently fall back or reuse prior evidence',async()=>{
 for(const value of [null,'',false,'engineering-handoff-v3']){const c=context();c.binding.runtime.engineeringContract=value;a.throws(()=>provider.request('chief-plan',c),/ENG_AI_CONTEXT/);}
 const c=context();await append(c,'chief-plan',phone.fixture('chief-plan',c));delete c.binding.runtime.engineeringContract;
 a.throws(()=>provider.request('specialist',c));
});
