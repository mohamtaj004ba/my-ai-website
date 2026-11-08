'use strict';
const test=require('./helpers/historical-phone-fixture.cjs').historicalTest(require('node:test'));
// Offline actual-controller/CAS integration. Scripted Responses are not live AI.
const nativeTest=require('node:test'),a=require('node:assert/strict'),helper=require('./helpers/engineering-controller.cjs'),cfg=require('../lib/agent-operations-engineering-configuration'),phone=require('../lib/agent-operations-phone-search'),p=require('../lib/agent-operations-engineering-provider-v2'),budget=require('../lib/agent-operations-budget');
const setup=()=>helper.fixture({objective:phone.OBJECTIVE,reviewedConsent:true});
async function prepared(f){const m=await f.control.trialManifest(helper.owner,{planId:f.plan.id,expectedRevision:1,sequenceId:f.sequenceId}),input={planId:f.plan.id,expectedRevision:1,approval:m.approval},r=await f.control.prepare(helper.owner,input);return{input,prepared:r};}
test('reviewed record retains exact deployment, has no hosting ACKs or paid flags, and is idempotent',async()=>{
 const f=await setup(),state=f.state(),r=state.operations.engineeringConfigurationIntents.at(-1),before=JSON.stringify(state),again=cfg.consentClaim(state.operations,f.context,{id:r.id,sequenceIntentId:r.sequenceIntentId,review:r.review},Date.now());
 a.equal(again.created,false);a.equal(JSON.stringify(state),before);a.equal(r.version,cfg.CONSENT_VERSION);a.deepEqual(r.deployment,f.plan.runtime);a.equal(r.events.length,1);a.equal(r.providerMetadataHash,undefined);a.equal(r.values,undefined);a.deepEqual(Object.keys(r.policyPins),cfg.POLICY_KEYS);a(cfg.FLAGS.every(k=>f.env[k]==='false'));a.equal((await f.control.readiness(helper.owner,{})).configurationGatesSatisfied,true);a.equal((await f.organization.summary()).paidExecution,false);
});
test('forged invocation proof and wrong authenticated owner cannot activate a reviewed record',async()=>{
 const f=await setup(),factory=require('../lib/agent-operations-activation-controller');a.throws(()=>factory.createEngineeringOwnerControl({operations:f.operations,organization:f.organization,runtime:f.runtime,env:f.env,assertOwner:async()=>true,consentToken:{}}),/ENG_CONSENT_SCOPE/);
 const id=f.state().operations.engineeringConfigurationIntents.at(-1).id;await a.rejects(f.baseControl.forReviewedConsent({...helper.owner,workspaceId:'other'},{id}));a.equal(factory.consentAuthority({},f.state().operations,f.context,null,Date.now()),false);
});
test('expired, revoked, altered evidence and substituted deployment fail before any request',async()=>{
 for(const mode of ['expired','revoked','evidence','deployment']){const f=await setup(),s=f.state(),r=s.operations.engineeringConfigurationIntents.at(-1);if(mode==='revoked')cfg.consentRevoke(s.operations,f.context,r.id,Date.now());else if(mode==='expired'){r.createdAt-=86400001;r.expiresAt-=86400001;}else if(mode==='evidence')r.evidenceHash='f'.repeat(64);else r.deployment.deploymentId='dpl_wrong';f.set(s);await a.rejects(f.baseControl.forReviewedConsent(helper.owner,{id:r.id}));a.equal(s.operations.reservations.length,0);}
});
test('real five-stage controller runs with false legacy paid flags and preserves rejection and accounting',async()=>{
 const f=await setup(),previous=global.fetch,calls=[];global.fetch=async(url,options)=>{a.match(url,/^https:\/\/api\.openai\.com\/v1\/responses(?:\/input_tokens)?$/);calls.push(url);if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:1500});const w=f.state().operations.workflows.at(-1),i=w.results.length,stage=require('../lib/agent-operations-engineering-inference').STAGES[i],c={...f.context,binding:{...f.context.binding,taskId:f.plan.tasks[i].id,executionId:w.approval.id+'_'+stage},priorReceipts:w.results},value=require('./helpers/engineering-scripted-phone.cjs').reply(stage,c);return Response.json({id:'resp_consent_offline_'+i,status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1500,output_tokens:700,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});};
 try{const q=await prepared(f),active=await f.control.activate(helper.owner,{...q.input,expectedApprovalRevision:q.prepared.record.revision}),result=await f.control.run(helper.owner,{...q.input,expectedApprovalRevision:active.revision});a.equal(calls.length,10);a.equal(result.result.receipts.length,5);a.equal(result.result.receipts[4].response.auditDecision,'fail');a.equal(result.result.receipts[4].response.acceptedWork,false);a.equal(result.result.receipts[1].implementationArtifact.workspace.cleanup.destroyed,true);a.equal(result.shutdown.paidExecution,false);const before=budget.accountingFor(f.state(),budget.EXPANDED_AUTHORIZATION.id);await f.baseControl.stopReviewedConsent(helper.owner,{});const after=budget.accountingFor(f.state(),budget.EXPANDED_AUTHORIZATION.id);a.deepEqual(after,before);a(f.state().operations.grants.every(g=>g.revoked));a.equal(f.state().operations.engineeringConfigurationIntents.at(-1).status,'revoked');await a.rejects(f.control.trialManifest(helper.owner,{planId:f.plan.id,expectedRevision:1,sequenceId:f.sequenceId}).then(m=>f.control.prepare(helper.owner,{planId:f.plan.id,expectedRevision:1,approval:m.approval})));}finally{global.fetch=previous;}
});
test('revocation between counted input and Responses prevents paid dispatch and preserves uncertainty',async()=>{
 const f=await setup(),previous=global.fetch,calls=[];global.fetch=async url=>{calls.push(url);a(url.endsWith('/input_tokens'));const s=f.state(),r=s.operations.engineeringConfigurationIntents.at(-1);cfg.consentRevoke(s.operations,f.context,r.id,Date.now());f.set(s);return Response.json({object:'response.input_tokens',input_tokens:1500});};
 try{const q=await prepared(f),active=await f.control.activate(helper.owner,{...q.input,expectedApprovalRevision:q.prepared.record.revision});await a.rejects(f.control.run(helper.owner,{...q.input,expectedApprovalRevision:active.revision}));a.equal(calls.length,1);a(f.state().operations.grants.every(g=>g.revoked));a.equal(f.state().operations.approvals.at(-1).status,'revoked');a.doesNotThrow(()=>budget.accountingFor(f.state(),budget.EXPANDED_AUTHORIZATION.id));}finally{global.fetch=previous;}
});


test('same source and objective cannot reuse consent for a different assignment or foreign task',async()=>{
 const f=await setup(),state=f.state(),r=state.operations.engineeringConfigurationIntents.at(-1);
 for(const change of [{planId:'op_other',taskId:'op_other_task1'},{taskId:'op_foreign_task1'}]){
  const c={...f.context,binding:{...f.context.binding,...change}};
  a.throws(()=>cfg.assertConsent(state.operations,c,r.id,Date.now()),/ENG_CONSENT_REVOKED_OR_SCOPE/);
 }
 const old=f.operations.read;f.operations.read=async actor=>{const v=await old(actor),q=v.plans[0];q.id='op_other';q.tasks.forEach((t,i)=>t.id=q.id+'_task'+(i+1));return v;};
 await a.rejects(f.control.trialManifest(helper.owner,{planId:'op_other',expectedRevision:1,sequenceId:f.sequenceId}),/ENG_CONSENT_SCOPE/);
 a.equal(f.state().operations.reservations.length,0);
});

test('cached controller cannot report readiness, prepare or activate after durable revocation',async()=>{
 for(const phase of ['prepare','activate']){
  const f=await setup(),m=await f.control.trialManifest(helper.owner,{planId:f.plan.id,expectedRevision:1,sequenceId:f.sequenceId}),input={planId:f.plan.id,expectedRevision:1,approval:m.approval};
  const prepared=phase==='activate'?await f.control.prepare(helper.owner,input):null;
  await f.baseControl.stopReviewedConsent(helper.owner,{});
  await a.rejects(f.control.readiness(helper.owner,{}),/ENG_CONSENT_REVOKED_OR_SCOPE/);
  await a.rejects(phase==='prepare'?f.control.prepare(helper.owner,input):f.control.activate(helper.owner,{...input,expectedApprovalRevision:prepared.record.revision}));
  a.equal(f.state().operations.reservations.length,0);
 }
});
const api=require('../lib/agent-operations-api');
async function request(f,method,input,{owner=true,events=null}={}){
 const env={...f.env,VERCEL_GIT_COMMIT_SHA:f.runtime.commit,VERCEL_GIT_COMMIT_REF:f.runtime.branch,VERCEL_DEPLOYMENT_ID:f.runtime.deploymentId,VERCEL_URL:new URL(f.runtime.origin).host};
 const handler=api.createHandler({env,organization:f.organization,operations:f.operations,assertEngineeringOwner:async actor=>actor.id===helper.owner.id&&actor.workspaceId===helper.owner.workspaceId,getSession:async()=>({email:helper.owner.id,workspaceId:helper.owner.workspaceId}),getMember:async()=>({role:'admin',email:helper.owner.id,workspaceId:helper.owner.workspaceId}),getWorkspace:async()=>({ownerEmail:owner?helper.owner.id:'someone-else@example.test'}),rateLimit:async()=>({limited:false})});
 const res={code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 const req=Object.assign(events||{},{method:'POST',headers:{host:env.VERCEL_URL,origin:f.runtime.origin},body:{action:'operations-engineering-activation-'+method,input}});await handler(req,res);return res;
}
test('actual API binds consent only to allowed owner actions and supports credential-free shutdown',async()=>{
 const f=await setup(),id=f.state().operations.engineeringConfigurationIntents.at(-1).id;
 const ready=await request(f,'readiness',{releaseConsentId:id});a.equal(ready.code,200);a.equal(ready.body.engineeringActivation.configurationGatesSatisfied,true);
 for(const [method,input,options]of [['readiness',{releaseConsentId:id},{owner:false}],['stopReviewedConsent',{releaseConsentId:id}],['forReviewedConsent',{id}],['readiness',{releaseConsentId:'refresh_'+'9'.repeat(32)}],['readiness',{releaseConsentId:{id}}]]){const denied=await request(f,method,input,options);a.notEqual(denied.code,200);}
 const stopped=await request(f,'stopReviewedConsent',{});a.equal(stopped.code,200);a.equal(f.state().operations.engineeringConfigurationIntents.at(-1).status,'revoked');
 const denied=await request(f,'readiness',{releaseConsentId:id});a.notEqual(denied.code,200);a.equal(f.state().operations.reservations.length,0);
});

test('owner review API persists one idempotent consent without enabling generic pilots',async()=>{
 const f=await setup(),s=f.state(),prior=s.operations.engineeringConfigurationIntents.at(-1),input={planId:f.plan.id,expectedRevision:1,intent:{id:'refresh_'+'6'.repeat(32),sequenceIntentId:f.sequenceId,review:prior.review}};
 const first=await request(f,'configurationReview',input);a.equal(first.code,200);const after=JSON.stringify(f.state().operations);
 const second=await request(f,'configurationReview',input);a.equal(second.code,200);a.equal(JSON.stringify(f.state().operations),after);a.equal(first.body.engineeringActivation.completionHash,second.body.engineeringActivation.completionHash);
 await a.rejects(f.organization.initializePilot(),/Paid execution disabled/);a.equal(f.state().operations.reservations.length,0);
});

test('valid immutable consent expires without invalidating its historical receipt',async()=>{
 const f=await setup(),s=f.state(),r=s.operations.engineeringConfigurationIntents.at(-1);
 a.doesNotThrow(()=>cfg.validateCompletedRecord(r));a.throws(()=>cfg.assertConsent(s.operations,f.context,r.id,r.expiresAt),/ENG_CONSENT_REVOKED_OR_SCOPE/);a.doesNotThrow(()=>cfg.validateCompletedRecord(r));
});

test('existing operations emergency stop revokes reviewed consent and cannot be undone by cached control',async()=>{
 const f=await setup(),before=budget.accountingFor(f.state(),budget.EXPANDED_AUTHORIZATION.id),service=require('../lib/agent-operations-operating-system').createOperations({kv:require('./helpers/memory-agentops-kv.cjs').create(),ledgerAdapter:{read:async()=>JSON.stringify(f.state())},runtime:f.runtime,assertOwner:async actor=>actor.id===helper.owner.id&&actor.workspaceId===helper.owner.workspaceId,engineeringOrganization:f.organization});
 const read=await service.read(helper.owner);await service.emergencyStop(helper.owner,{expectedRevision:read.revision});
 a.equal(f.state().operations.engineeringConfigurationIntents.at(-1).status,'revoked');a.deepEqual(budget.accountingFor(f.state(),budget.EXPANDED_AUTHORIZATION.id),before);await a.rejects(prepared(f));await a.rejects(f.control.readiness(helper.owner,{}));
});


test('API disconnect while consent is being read prevents run dispatch and removes abort listener',async()=>{
 const f=await setup(),id=f.state().operations.engineeringConfigurationIntents.at(-1).id,events=new(require('node:events').EventEmitter)(),read=f.organization.read;const q=await prepared(f),active=await f.control.activate(helper.owner,{...q.input,expectedApprovalRevision:q.prepared.record.revision});let seen=false,calls=0,listenerPresent=false;
 // Consent authentication uses a real organization read; disconnect while awaited.
 f.organization.read=async()=>{const state=await read();seen=true;listenerPresent=events.listenerCount('aborted')===1;events.emit('aborted');return state;};
 const previous=global.fetch;global.fetch=async()=>{calls++;throw Error('Unexpected offline dispatch');};
 try{const result=await request(f,'run',{...q.input,expectedApprovalRevision:active.revision,releaseConsentId:id},{events});a.equal(seen,true);a.equal(listenerPresent,true);a.equal(calls,0);a.equal(f.state().operations.approvals.at(-1).status,'revoked');a.equal(f.state().operations.approvals.at(-1).leaseUntil,0);a.notEqual(result.code,200);a.equal(events.listenerCount('aborted'),0);a.equal(f.state().operations.reservations.length,0);}finally{global.fetch=previous;}
});
