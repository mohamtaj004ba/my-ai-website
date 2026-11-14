'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),r=require('../lib/agent-operations-final-report'),c=require('../lib/agent-operations-contracts'),model=require('../lib/agent-operations-organization-model'),{fixture}=require('./helpers/agent-operations-final-report-fixture.cjs');
const response=result=>({model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:10}},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
test('valid/rejected/uncertain/mixed detailed reports retain every QA explanation and global authority',()=>{
 for(const scenario of ['valid','rejected','uncertain','mixed','assessor-rejected']){const dto=fixture({scenario}),before=JSON.stringify(dto),built=model.request(dto),data=JSON.parse(built.body.input[0].content[0].text),out=r.build(dto).report;
  assert.deepEqual(data.report,out);assert(c.valid('chief_review',out));assert(r.valid(model.receipt(dto,response(out)).result,dto));assert.equal(out.overallStatus,scenario==='valid'?'accepted':'not-accepted');assert.equal(JSON.stringify(dto),before);
  assert(out.findings.every(f=>f.originalFinding&&f.atoms.every(a=>a.claim&&a.reason&&a.observations.length&&a.evidence.length)));assert(built.body.instructions.includes(r.VERSION));assert(built.reservationMicros===300000);
 }
 const mixed=r.build(fixture({scenario:'mixed'})).report;assert.deepEqual(mixed.findings.map(f=>f.qaDisposition),['rejected','accepted','unresolved']);assert.equal(mixed.findings[2].qaDecision,'reject');assert(mixed.findings[2].atoms[0].uncertainty);assert.equal(mixed.independentAcceptance.accepted,false);
});
test('invented/omitted/altered findings, references, explanations and overall success fail receipt unchanged',()=>{
 const dto=fixture({scenario:'mixed'}),original=r.build(dto).report;
 for(const mutate of [v=>v.findings.pop(),v=>v.findings[0].qaDecision='accept',v=>v.findings[0].atoms[0].observations=['O99'],v=>v.findings[2].qaDisposition='accepted',v=>v.summary='All findings accepted.',v=>v.overallStatus='accepted',v=>v.findings.push(v.findings[0]),v=>v.contractVersion='chief-report-v1']){const v=structuredClone(original);mutate(v);const raw=JSON.stringify(v);assert.throws(()=>model.receipt(dto,response(v)));assert.equal(JSON.stringify(v),raw);}
});
test('missing or mismatched evidence and stale assessment snapshots prevent request construction',()=>{
 for(const mutate of [w=>delete w.results.qa,w=>w.evidence.images.pop(),w=>delete w.results.acceptance,w=>w.results.acceptance.evidenceHash='0'.repeat(64),w=>w.results.observation.result.facts.pop(),w=>w.scope.commit='0'.repeat(40)]){const dto=fixture();mutate(dto);assert.throws(()=>model.request(dto));}
 const dto=fixture(),old=r.build(dto).report;dto.results.acceptance.expectedRevision++;assert.throws(()=>model.receipt(dto,response(old)));dto.results.acceptance.expectedRevision--;dto.results.acceptance.accepted=false;assert.throws(()=>model.request(dto));
});
test('JSON object key order is not a semantic failure and no authority identifiers are generated',()=>{
 const dto=fixture(),out=r.build(dto).report,reordered=Object.fromEntries(Object.entries(out).reverse());assert(r.valid(reordered,dto));assert(c.valid('chief_review',reordered));assert(!Object.hasOwn(out,'expectedRevision'));assert.equal(out.snapshotHash,r.build(dto).report.snapshotHash);
});
test('historical incapable final-report contract is frozen and fails semantic capability before transport',()=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),f=require('./fixtures/agent-operations-report/report-blocker-v1.json'),manifest=require('./fixtures/agent-operations-report/manifest.json');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'fixtures/agent-operations-report/report-blocker-v1.json'))).digest('hex'),manifest['report-blocker-v1.json']);
 assert.deepEqual(f.actualOutputProperties,['stage','note']);assert.deepEqual(f.actualRequestKeys,['workflowId','outcomes','acceptance','specialistHash','qaHash']);let calls=0;const body={input:[{role:'user',content:[{type:'input_text',text:JSON.stringify({workflowId:'wf_old',outcomes:{acceptedWork:false},acceptance:{accepted:false},specialistHash:'a'.repeat(64),qaHash:'b'.repeat(64)})}]}]};
 assert.throws(()=>{require('../lib/agent-operations-stage-capabilities').assertCapability('chief_review',body);calls++;},/capability/);assert.equal(calls,0);assert.equal(f.modelRequests,0);
});
test('oversized certified reporting fails before transport within existing text and cost ceilings',()=>{
 const dto=fixture({scenario:'mixed'});dto.results.acceptance.reason='語'.repeat(1000);const out=model.request(dto);assert(Buffer.byteLength(JSON.stringify(out.body))<=32000);assert.equal(out.body.max_output_tokens,20000);assert.equal(out.estimate.estimatedCostMicros,264000);assert.equal(out.reservationMicros,300000);
});
module.exports={response};
test('atomic final completion rejects stale, cancelled, replayed, concurrent and changed-authority reports',async()=>{
 const {createOrganization}=require('../lib/agent-operations-organization');
 for(const scenario of ['stale','cancel','replay','concurrent','changed-assessment','changed-evidence']){
  let raw=null;const adapter={read:async()=>raw,compare:async(old,next)=>{if(raw!==old)return false;raw=next;return true;}},seed=fixture(),owner={kind:'owner',id:'report-regression-owner',verifiedOwner:true},org=createOrganization(adapter,{scope:seed.scope});
  const grant=await org.issueGrant(owner,{idempotencyKey:'final-atomic-grant',level:'inspect-and-test',expiresAt:Date.now()+600000,budgetMicros:3600000,maxWorkflows:1,maxConcurrent:1,roles:['chief-of-staff','website-visual-qa','independent-qa']}),created=await org.create(owner,{grantId:grant.id,idempotencyKey:'final-atomic-task'}),state=JSON.parse(raw),w=state.operations.workflows[0];
  // Explicit hostile backend fixture; not a provider double or proof of live execution.
  w.stage='chief_review';w.results=seed.results;w.outcomes=seed.outcomes;w.evidence=seed.evidence;w.evidence.workflowId=w.id;w.geometry=seed.geometry;raw=JSON.stringify(state);
  const actor={workflowId:w.id,token:created.capability};let dto=await org.command(actor,w.id,{type:'claim',expectedRevision:0});dto=await org.command(actor,w.id,{type:'reserve',expectedRevision:dto.revision,fence:dto.fence,executionId:'exec_final_atomic'});
  const result=r.build(dto).report,command={type:'finish',expectedRevision:dto.revision,fence:dto.fence,executionId:'exec_final_atomic',receipt:{model:'gpt-6.1-sol',inputTokens:0,outputTokens:0,reasoningTokens:0,cacheReadTokens:0,cacheWriteTokens:0,actualMicros:0,providerStatus:'completed'},result};
  if(scenario==='concurrent'){const both=await Promise.allSettled([org.command(actor,w.id,command),org.command(actor,w.id,command)]);assert.equal(both.filter(x=>x.status==='fulfilled').length,1);}
  else if(scenario==='replay'){await org.command(actor,w.id,command);await assert.rejects(org.command(actor,w.id,command));}
  else{
   if(scenario==='stale')await org.command(actor,w.id,{type:'heartbeat',expectedRevision:dto.revision,fence:dto.fence});
   if(scenario==='cancel')await org.cancel(owner,{workflowId:w.id,expectedRevision:dto.revision});
   if(scenario.startsWith('changed-')){const current=JSON.parse(raw),task=current.operations.workflows[0];if(scenario==='changed-assessment')task.results.acceptance.reason+=' Revised independently.';else task.evidence.images[0].sha256='0'.repeat(64);task.revision++;command.expectedRevision=task.revision;raw=JSON.stringify(current);}
   await assert.rejects(org.command(actor,w.id,command));assert.equal((await org.summary()).reservations[0].status,'pending');
  }
  const final=await org.summary();assert.equal(final.reservations.length,1);assert.equal(final.audit.filter(e=>e.type==='stage_completed').length,['replay','concurrent'].includes(scenario)?1:0);
 }
});
