'use strict';
require('./helpers/historical-starter-fixture.cjs'); // Explicit pre-fix offline task replay.
const {test}=require('node:test'),a=require('node:assert/strict'),impl=require('../lib/agent-operations-implementation'),inf=require('../lib/agent-operations-engineering-inference'),copy=require('../lib/agent-operations-proposal-copy'),contracts=require('../lib/agent-operations-contracts'),failure=require('../lib/agent-operations-engineering-failure'),old=require('./fixtures/engineering-implementation-compact-v1-chief-request.json');
function context(){const c={...structuredClone(old.context),assignment:impl.OBJECTIVE,priorReceipts:[]};for(const stage of ['chief-plan','specialist'])c.priorReceipts.push({stage,response:inf.parseResponse(stage,impl.fixture(stage,c),c)});return c;}
test('current QA schema requires exactly the preserved Specialist findings, without a required positive decision',()=>{
 const c=context(),schema=copy.schema('qa',inf.schema('qa'),c,{provider:true}),d=schema.properties.decisions;
 a.equal(d.minItems,1);a.equal(d.maxItems,1);a.deepEqual(d.items.properties.findingId.enum,c.priorReceipts[1].response.findings.map(f=>f.id));
 for(const decision of ['accepted','rejected','unresolved']){const value=impl.fixture('qa',c);value.decisions[0].decision=decision;value.decisions[0].reason='Source supports only a proposal; missing execution evidence prevents acceptance.';a.equal(inf.parseResponse('qa',value,c).decisions[0].decision,decision);}
 const value=impl.fixture('qa',c);value.decisions.push(structuredClone(value.decisions[0]));a.equal(contracts.validateSchema(schema,value),false);a.throws(()=>inf.parseResponse('qa',value,c),/ENG_AI_RESPONSE_SCHEMA/);
 value.decisions.pop();value.decisions[0].findingId='invented-finding';a.equal(contracts.validateSchema(schema,value),false);
});
test('missing or unsupported prior findings fail before a provider request schema can be prepared',()=>{
 const c=context();c.priorReceipts.pop();a.throws(()=>copy.schema('qa',inf.schema('qa'),c),/ENG_AI_QA_COMPLETENESS/);
 const two=context();two.priorReceipts[1].response.findings.push({...two.priorReceipts[1].response.findings[0],id:'unscoped'});a.throws(()=>copy.schema('qa',inf.schema('qa'),two),/ENG_AI_QA_COMPLETENESS/);
});
test('current instructions explain one decision per finding and retain criticism and rejection',()=>{const text=impl.instructionsFor(context());a.match(text,/exactly one decision per supplied Specialist finding/);a.match(text,/Do not add decision rows for criteria or patch edits/);a.match(text,/QA and Auditor may reject/);a.match(text,/preserves Auditor rejection/);});
test('QA-specific guidance does not inflate non-QA requests; realistic bindings fit the unchanged fixture ceiling',()=>{
 const c={...structuredClone(old.context),assignment:impl.OBJECTIVE,priorReceipts:[]};
 c.binding.planId='op_'+ 'a'.repeat(32);c.binding.taskId=c.binding.planId+'_task1';c.binding.executionId='pilot_'+ 'b'.repeat(32)+'_chief-plan';
 c.binding.runtime.origin='https://my-ai-website-52qb14k0h-mohamtaj004bas-projects.vercel.app';c.binding.runtime.deploymentId='dpl_DCPyCeJ5SNooD1cV6kW7kvNYR8A7';
 for(const stage of inf.STAGES){
  const instructions=impl.instructionsFor(c);a.equal(instructions.includes('QA: exactly one decision'),stage==='qa');
  a.equal(instructions.includes('target at most 1,600 visible JSON tokens'),stage==='specialist');
  if(stage==='specialist'){a.match(instructions,/retain every material risk and every criterion mapping/);a.match(instructions,/Never truncate or omit required fields/);a.match(instructions,/never full source/);}
  const receipt=inf.executeFixture(stage,c);a(receipt.inputTokenPlanningBound<=12000);c.priorReceipts.push(receipt);
 }
 a.equal(c.priorReceipts.length,5);a(c.priorReceipts.every(r=>r.simulated&&r.paidCalls===0));
});
test('historical compact request schema and instructions remain unchanged',()=>{
 const c=structuredClone(old.context);a.equal(copy.schema('qa',inf.schema('qa'),c).properties.decisions.maxItems,3);a.equal(impl.instructionsFor(c),old.instructions);
});

test('current QA evidence schema matches the finding subset while permitting rejection and coverage criticism',()=>{
 const c=context(),finding=c.priorReceipts[1].response.findings[0];finding.evidenceIds=[c.evidence[0].id];
 const schema=copy.schema('qa',inf.schema('qa'),c,{provider:true});
 a.deepEqual(schema.properties.decisions.items.properties.evidenceIds.items.enum,finding.evidenceIds);
 const value=impl.fixture('qa',c);value.decisions[0].decision='rejected';value.decisions[0].reason='The verification sentence is clipped and the required coverage remains unverified.';
 a.equal(inf.parseResponse('qa',value,c).decisions[0].decision,'rejected');
 value.decisions[0].evidenceIds=[c.evidence[1].id];
 a.equal(contracts.validateSchema(schema,value),false);a.throws(()=>inf.parseResponse('qa',value,c),/ENG_AI_RESPONSE_SCHEMA/);
 a.match(impl.instructionsFor(c),/only that finding's evidenceIds/);a.match(impl.instructionsFor(c),/including clipped prose and missing coverage/);
});

for(const mode of ['missing','empty','unknown','duplicate'])test('current QA request refuses unsupported prior finding evidence: '+mode,()=>{
 const c=context(),f=c.priorReceipts[1].response.findings[0];
 if(mode==='missing')delete f.evidenceIds;if(mode==='empty')f.evidenceIds=[];if(mode==='unknown')f.evidenceIds=['unknown-source'];if(mode==='duplicate')f.evidenceIds=[c.evidence[0].id,c.evidence[0].id];
 a.throws(()=>copy.schema('qa',inf.schema('qa'),c,{provider:true}),/ENG_AI_QA_COMPLETENESS/);
});

test('generic authoritative unrelated evidence denial preserves only a safe decision path',()=>{
 const c=context();c.assignment='Bounded source inspection without implementation authority.';const f=c.priorReceipts[1].response.findings[0];f.evidenceIds=[c.evidence[0].id];
 const value={stage:'qa',decisions:[{findingId:f.id,decision:'rejected',reason:'Representative test, not recovered model content.',evidenceIds:[c.evidence[1].id]}],uncertainty:'No acceptance.'};
 a.equal(contracts.validateSchema(inf.schema('qa'),value),true);
 let error;try{inf.parseResponse('qa',value,c)}catch(e){error=e}a.equal(error?.message,'ENG_AI_UNRELATED_EVIDENCE');
 const d=failure.failure(error,{stage:'qa',phase:'response-validate',providerStarted:true,countStarted:true,mode:'pilot'});
 a.equal(d.location,'$.decisions[0].evidenceIds');a.equal(d.mismatch,'evidence-unrelated');a.equal(d.billingExposurePossible,true);
 a(!JSON.stringify(d).includes(c.evidence[1].id));a(!JSON.stringify(d).includes(value.decisions[0].reason));
});
test('authoritative completeness checks retain count and duplicate denials with closed sanitized diagnostics',()=>{
 for(const mismatch of ['finding-count','finding-duplicate']){
  const c=context();c.assignment='Bounded source inspection without implementation authority.';const findings=c.priorReceipts[1].response.findings;
  const value={stage:'qa',decisions:[{findingId:findings[0].id,decision:'unresolved',reason:'Representative fixture only; not the lost live response.',evidenceIds:findings[0].evidenceIds}],uncertainty:'No acceptance or execution.'};
  if(mismatch==='finding-count')value.decisions.push(structuredClone(value.decisions[0]));else{findings.push({...findings[0],id:'second-source-finding'});value.decisions.push(structuredClone(value.decisions[0]));}
  let error;try{inf.parseResponse('qa',value,c)}catch(e){error=e}a.equal(error?.message,'ENG_AI_QA_COMPLETENESS');
  const d=failure.failure(error,{stage:'qa',phase:'response-validate',providerStarted:true,countStarted:true,mode:'pilot'});a.equal(d.location,'$.decisions');a.equal(d.mismatch,mismatch);a.equal(d.billingExposurePossible,true);a(!JSON.stringify(d).includes(findings[0].id));
 }
 a(!Object.hasOwn(failure.sanitize({mismatch:'PRIVATE_CONTENT',location:'$.secret',raw:'SECRET'}),'raw'));
});
