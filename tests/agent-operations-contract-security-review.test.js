'use strict';
// Independent security review: synthetic boundary examples, never provider requests.
const {test}=require('node:test'),assert=require('node:assert/strict');
const contracts=require('../lib/agent-operations-contracts'),qa=require('../lib/agent-operations-organization-qa'),model=require('../lib/agent-operations-organization-model');
const reply=require('./helpers/agent-operations-request-mock.cjs');
const request=(stage,data={})=>({model:'gpt-6.1-sol',reasoning:{effort:'medium'},max_output_tokens:20000,service_tier:'default',prompt_cache_options:{mode:'explicit'},truncation:'disabled',store:false,instructions:contracts.instructions(stage),tools:[],text:{format:contracts.format(stage)},input:[{role:'user',content:[{type:'input_text',text:JSON.stringify(data)}]}]});
const facts=()=>['I1','I2','I3','I4'].map((imageId,i)=>({id:'O'+(i+1),imageId,region:[.1,.1,.8,.8],observed:'A visible shape.',readability:'clear',uncertainty:''}));
const observation=()=>({stage:'observe',facts:facts(),note:'Direct observations only.'});
const evidence={images:['I1','I2','I3','I4'].map(id=>({id})),hash:'evidence'};
test('independent drift gate rejects the permissive historical observation schema and missing instructions before transport',()=>{
 let dispatched=0;const dispatch=b=>{contracts.assertRequest('observe',b);dispatched++;};
 const original=request('observe',{evidence});dispatch(original);assert.equal(dispatched,1);
 for(const mutate of [b=>delete b.text.format.schema.properties.facts.maxItems,b=>delete b.text.format.schema.properties.facts.items.properties.id.pattern,b=>delete b.text.format.schema.properties.facts.items.properties.region.items.maximum,b=>delete b.text.format.schema.properties.facts.items.properties.observed.pattern,b=>b.instructions='Independently observe images.',b=>b.model='gpt-4.1-2025-04-14',b=>b.reasoning.effort='high',b=>b.max_output_tokens=20001,b=>b.store=true,b=>b.service_tier='priority',b=>b.prompt_cache_options.mode='implicit',b=>b.truncation='auto']){
  const b=structuredClone(original);mutate(b);assert.throws(()=>dispatch(b),/drift/);assert.equal(dispatched,1);
 }
});
test('independent observation boundaries reject pixel coordinates, excess facts, hidden fields and incomplete coverage without repair',()=>{
 assert(qa.observation(observation(),evidence));
 for(const mutate of [v=>v.facts[0].region=[100,100,800,800],v=>v.facts.push(...Array.from({length:9},(_,i)=>({...v.facts[0],id:'O'+(i+5)}))),v=>v.facts[0].id='I1-F1',v=>v.facts[0].id='O0',v=>v.facts[0].id='O01',v=>v.facts[0].id='O100',v=>v.facts[0].observed='x'.repeat(251),v=>v.facts[0].expectedRevision=212,v=>v.facts[3].imageId='I3',v=>v.facts[0].region=[.8,.1,.1,.8],v=>v.facts[0].readability='unreadable',v=>v.facts[1].id='O1']){
  const v=observation();mutate(v);const prior=JSON.stringify(v);assert.equal(qa.observation(v,evidence),false);assert.equal(JSON.stringify(v),prior);
 }
});
test('independent adjudication adversaries reject wrong atom, borrowed image, unsupported suitability and promoted decisions',()=>{
 const observed=observation(),claims=qa.claims([{code:'VISIBLE',imageId:'I3',note:'A visible shape.'}]),w={evidence,claims,results:{observation:{result:observed,hash:qa.hash(observed),evidenceHash:evidence.hash}}};
 const base={stage:'adjudicate',findings:[{code:'VISIBLE',decision:'accept',atoms:[{id:'C1A1',support:'supported',probability:.99,reason:'The same image shows the shape.',observations:['O3'],evidence:[{imageId:'I3',region:[.2,.2,.7,.7]}],uncertainty:''}]}],note:'Evidence-linked verdict.'};
 assert(qa.adjudication(base,w));
 for(const mutate of [v=>v.findings[0].atoms[0].id='C2A1',v=>v.findings[0].atoms[0].observations=['O1'],v=>v.findings[0].atoms[0].observations=['O3','O1'],v=>v.findings[0].atoms[0].evidence[0].imageId='I1',v=>v.findings[0].atoms[0].support='contradicted',v=>v.findings[0].atoms[0].probability=.89,v=>v.findings[0].atoms[0].evidence[0].region=[.9,.9,1,1]]){
  const v=structuredClone(base);mutate(v);assert.equal(qa.adjudication(v,w),false);
 }
 const unsupported=structuredClone(w);unsupported.claims[0].atoms[0].text='The illustration is contextually appropriate for Legal.';assert.equal(qa.adjudication(base,unsupported),false);
});
test('independent final report cannot falsely report acceptance or add authority fields',()=>{
 const response=note=>({model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:10}},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({stage:'chief_review',note})}]}]});
 const dto={stage:'chief_review',outcomes:{acceptedWork:false}};
 assert.equal(model.receipt(dto,response(contracts.REPORT.rejected)).result.note,contracts.REPORT.rejected);
 assert.throws(()=>model.receipt(dto,response(contracts.REPORT.accepted)),/contradicts/);
 assert.throws(()=>model.receipt(dto,response('Everything succeeded.')),/contract mismatch/);
 assert.equal(contracts.valid('chief_review',{stage:'chief_review',note:contracts.REPORT.rejected,acceptedWork:true}),false);
});
test('independent release gate detects helper drift and rejects legacy or foreign approval identities',()=>{
 const release=contracts.assertRelease();assert(contracts.approved({contractVersion:release.version,contractHash:release.digest}));
 assert.equal(contracts.approved({chiefContractVersion:'chief-intent-v2'}),false);
 assert.equal(contracts.approved({contractVersion:release.version,contractHash:'a'.repeat(64)}),false);
 const original=qa.box;try{qa.box=()=>true;assert.throws(()=>contracts.assertRelease(),/drift/);assert.equal(contracts.approved({contractVersion:release.version,contractHash:release.digest}),false);}finally{qa.box=original;}
 assert.deepEqual(contracts.assertRelease(),release);
});
test('independent transport-only mock follows exposed claim and observation IDs and rejects blind leakage',()=>{
 const observed=observation();observed.facts[2].id='O77';const claims=qa.claims([{code:'PUBLIC_ONLY',imageId:'I3',note:'A visible shape.'}]);
 const body=request('adjudicate',{claims,observation:{result:observed}}),out=JSON.parse(reply(body).output[0].content[0].text);
 assert.equal(out.findings[0].code,'PUBLIC_ONLY');assert.deepEqual(out.findings[0].atoms[0].observations,['O77']);
 assert.throws(()=>reply(request('observe',{evidence,claims})),/Blind input leak/);
 const final=JSON.parse(reply(request('chief_review',{outcomes:{acceptedWork:false}})).output[0].content[0].text);assert.equal(final.note,contracts.REPORT.rejected);
});
test('independent atomic final-stage boundary refuses a forged success after rejected QA without settling its reservation',async()=>{
 // Explicit synthetic backend-state seed tests a hostile direct command, not provider behavior.
 const {createOrganization}=require('../lib/agent-operations-organization');let raw=null;
 const adapter={read:async()=>raw,compare:async(old,next)=>{if(raw!==old)return false;raw=next;return true;}},scope={origin:'https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app',commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',paths:['/industries/legal','/#pricing']},owner={kind:'owner',id:'review-owner',verifiedOwner:true},org=createOrganization(adapter,{scope});
 const g=await org.issueGrant(owner,{idempotencyKey:'independent-review-grant',level:'inspect-and-test',expiresAt:Date.now()+600000,budgetMicros:3600000,maxWorkflows:1,maxConcurrent:1,roles:['chief-of-staff','website-visual-qa','independent-qa']}),c=await org.create(owner,{grantId:g.id,idempotencyKey:'independent-review-final'}),s=JSON.parse(raw),w=s.operations.workflows[0];
 w.stage='chief_review';w.outcomes={acceptedWork:false,substantive:'failed',finalAcceptance:'rejected'};await adapter.compare(raw,JSON.stringify(s));
 const actor={workflowId:c.workflow.id,token:c.capability};let dto=await org.command(actor,c.workflow.id,{type:'claim',expectedRevision:0});dto=await org.command(actor,dto.id,{type:'reserve',expectedRevision:dto.revision,fence:dto.fence,executionId:'exec_review_final'});
 const command={type:'finish',expectedRevision:dto.revision,fence:dto.fence,executionId:'exec_review_final',receipt:{model:'gpt-6.1-sol',inputTokens:0,outputTokens:0,reasoningTokens:0,cacheReadTokens:0,cacheWriteTokens:0,actualMicros:0,providerStatus:'completed'},result:{stage:'chief_review',note:contracts.REPORT.accepted}};
 await assert.rejects(org.command(actor,dto.id,command),/cannot override QA/);let summary=await org.summary();assert.equal(summary.reservations[0].status,'pending');assert.equal(summary.workflows[0].outcomes.acceptedWork,false);
 command.result.note=contracts.REPORT.rejected;const result=await org.command(actor,dto.id,command);assert.equal(result.status,'rejected');assert.equal(result.outcomes.acceptedWork,false);
});

