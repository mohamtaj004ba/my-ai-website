'use strict';
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
test('historical compact request schema and instructions remain unchanged',()=>{
 const c=structuredClone(old.context);a.equal(copy.schema('qa',inf.schema('qa'),c).properties.decisions.maxItems,3);a.equal(impl.instructionsFor(c),old.instructions);
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
