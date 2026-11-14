'use strict';
// Actual owner API/controller/CAS/count/receipt/cleanup, scripted provider only.
// No paid inference, network, generated-code execution or Sandbox VM.
const {test}=require('node:test'),a=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const org=require('../lib/agent-operations-organization'),ops=require('../lib/agent-operations-operating-system'),api=require('../lib/agent-operations-api'),rehearsal=require('../lib/agent-operations-engineering-rehearsal'),cfg=require('../lib/agent-operations-engineering-configuration'),discovery=require('../lib/agent-operations-repository-discovery'),reader=require('../lib/agent-operations-repository-source'),provider=require('../lib/agent-operations-engineering-provider-v2');
async function setup(query=reader.initial(),objective=discovery.OBJECTIVE){
 const owner={kind:'owner',verifiedOwner:true,id:'repository-chief@example.test',workspaceId:'repository-chief-fixture'},runtime={environment:'preview',origin:'https://my-ai-website-repository-mohamtaj004bas-projects.vercel.app',commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),branch:'feature/callercore-dashboards',deploymentId:'dpl_repository'},release=require('../lib/agent-operations-contracts').assertRelease(),project=require('../lib/agent-operations-project').PROJECT;
 let raw=null;const adapter={read:async()=>raw,compare:async(before,after)=>{if(raw!==before)return false;raw=after;return true;}},rows=new Map(),kv={get:async key=>rows.get(key)??null,eval:async(_,[key],[before,after])=>{if((rows.get(key)||'')!==before)return 0;rows.set(key,after);return 1;}},env={VERCEL_ENV:'preview',VERCEL_URL:new URL(runtime.origin).host,VERCEL_GIT_COMMIT_SHA:runtime.commit,VERCEL_GIT_COMMIT_REF:runtime.branch,VERCEL_DEPLOYMENT_ID:runtime.deploymentId,CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_ENGINEERING_MODEL_ACCESS_VERIFIED:'true',CALLERCORE_AGENTOPS_OPENAI_API_KEY:'SYNTHETIC_OFFLINE_ONLY',CALLERCORE_AGENTOPS_OPENAI_PROJECT_ID:project.projectId,CALLERCORE_AGENTOPS_OPENAI_ORGANIZATION_ID:project.organizationId,...Object.fromEntries(cfg.FLAGS.map(k=>[k,'false']))};
 const authenticate=async actor=>actor.id===owner.id&&actor.workspaceId===owner.workspaceId,organization=org.createOrganization(adapter,{scope:{commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',origin:'https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app'},runtime,paidEnabled:()=>false});
 raw=JSON.stringify(await organization.read());
 const operations=ops.createOperations({kv,ledgerAdapter:adapter,runtime,assertOwner:authenticate,engineeringOrganization:organization}),handler=api.createHandler({env,organization,operations,assertEngineeringOwner:authenticate,getSession:async()=>({email:owner.id,workspaceId:owner.workspaceId}),getMember:async()=>({role:'admin',email:owner.id,workspaceId:owner.workspaceId}),getWorkspace:async()=>({ownerEmail:owner.id}),rateLimit:async()=>({limited:false})});
 const call=async(action,input,status=200)=>{const res={statusCode:0,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.value=value;return this;}};await handler({method:'POST',headers:{origin:runtime.origin,host:new URL(runtime.origin).host},body:{action,input}},res);a.equal(res.statusCode,status,action+': '+JSON.stringify(res.value));return res.value;};
 const assignment={engineeringProfile:'engineering-implementation-v1',idempotencyKey:'repository-chief-'+crypto.randomBytes(6).toString('hex'),objective,priority:'normal',durationMs:1800000,repositoryQuery:query,subtasks:rehearsal.templates.map((template,i)=>({key:'task'+(i+1),template,dependsOn:i?['task'+i]:[]}))};
 const plan=(await call('operations-create',assignment)).operatingSystem;a.equal((await call('operations-create',assignment)).operatingSystem.id,plan.id);
 const base={planId:plan.id,expectedRevision:plan.revision},intent={id:'refresh_'+crypto.randomBytes(16).toString('hex'),sequenceIntentId:'sequence_'+crypto.randomBytes(16).toString('hex'),review:{workQaHash:'1'.repeat(64),workAuditorHash:'2'.repeat(64),sourceCommit:runtime.commit,releaseHash:release.digest}};
 await call('operations-engineering-activation-configurationReview',{...base,intent});const scoped={...base,releaseConsentId:intent.id};
 await call('operations-engineering-activation-sequenceRegister',{...scoped,sequenceId:intent.sequenceIntentId,configurationIntentId:intent.id,expiresAt:Date.now()+3600000});
 const manifest=(await call('operations-engineering-activation-trial-manifest',{...scoped,sequenceId:intent.sequenceIntentId})).engineeringActivation,input={...scoped,approval:manifest.approval};
 const prepared=(await call('operations-engineering-activation-prepare',input)).engineeringActivation,active=(await call('operations-engineering-activation-activate',{...input,expectedApprovalRevision:prepared.record.revision})).engineeringActivation;
 return {call,plan,manifest,input,active,owner,runtime,intent,state:()=>JSON.parse(raw),organization};
}
for(const decision of ['hold','inspect','investigate'])test('existing owner controller completes one read-only Chief '+decision+' and revokes authority',async()=>{
 const q=decision==='inspect'?reader.initial():decision==='investigate'?{...reader.initial(),kind:'read-file',path:'api/create-checkout-session.js'}:{...reader.initial(),kind:'read',path:'admin-dashboard.html',lineCount:20},f=await setup(q),previous=global.fetch,calls=[];
 a.equal(f.manifest.approval.maxCalls,1);a.equal(f.manifest.approval.maxTokenCountRequests,1);a.equal(f.manifest.approval.maxInputTokens,12000);a.equal(f.manifest.approval.maxOutputTokens,4000);
 if(decision==='hold'){
  const before=f.state();
  const generic=await f.call('operations-run',{planId:f.plan.id,expectedRevision:f.plan.revision},409);a.equal(generic.code,'ENG_DISCOVERY_CONTROL_REQUIRED');a.deepEqual(f.state(),before);
  const bad=await f.call('operations-engineering-activation-prepare',{...f.input,approval:{...f.input.approval,maxCalls:5}},409);a.equal(bad.code,'ENG_TRANSPORT_APPROVAL');
  const input={assignment:discovery.OBJECTIVE,evidence:[{id:'repository-discovery-packet',packet:f.plan.repositoryPacket}],binding:{planId:f.plan.id,taskId:f.plan.id+'_task2',runtime:f.plan.runtime,ownerHash:crypto.createHash('sha256').update(f.owner.id).digest('hex'),workspaceHash:crypto.createHash('sha256').update(f.owner.workspaceId).digest('hex')}};
  a.throws(()=>cfg.assertConsent(f.state().operations,input,f.intent.id,Date.now()),/ENG_CONSENT_REVOKED_OR_SCOPE/);
 }
 global.fetch=async(url,options)=>{calls.push(url);if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:1500});const w=f.state().operations.workflows.at(-1),binding={planId:f.plan.id,taskId:f.plan.tasks[0].id,executionId:w.approval.id+'_chief-plan',fence:0,authorizationRevision:1,ownerHash:crypto.createHash('sha256').update(f.owner.id).digest('hex'),workspaceHash:crypto.createHash('sha256').update(f.owner.workspaceId).digest('hex'),runtime:f.plan.runtime},packet=f.plan.repositoryPacket;
 const value={contextHash:JSON.parse(options.body).text.format.schema.properties.contextHash.enum[0],decision,problem:'Explicit scripted source inspection fixture.',userImpact:'Not a verified product defect or customer impact.',evidenceIds:decision==='investigate'?[packet.body.evidence[0].id]:[],files:decision==='investigate'?[q.path]:[],acceptanceCriteria:decision==='investigate'?['Reproduce the proposed issue before implementation.']:[],exclusions:['No execution, mutation, publication or acceptance.'],uncertainty:'Scripted provider fixture only; no genuine model reasoning.',reason:'Verify the existing one-stage lifecycle and honest result.',inspection:decision==='inspect'?{...reader.initial(),kind:'read',path:'dashboard.js'}:discovery.noInspection()};
 const request=JSON.parse(options.body);
 a.match(request.input[0].content[0].text,/backendBinding/);
 if(decision==='investigate'){
  a.equal(packet.body.repositoryView.nextRead,null);
  a.match(packet.body.evidence[0].text,/Stripe checkout creation response could not be verified/);
  a.equal(Buffer.byteLength(options.body)<=32768,true);
 }
 if(decision==='inspect'){
  const properties=request.text.format.schema.properties;
  a.deepEqual(properties.decision.enum,['inspect','hold']);
  for(const key of ['evidenceIds','files','acceptanceCriteria'])a.equal(properties[key].maxItems,0);
  a.match(request.instructions,/set evidenceIds, files, and acceptanceCriteria to \[\]/);
 }
 return Response.json({id:'resp_repository_offline_1',status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1500,output_tokens:400,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});};
 try{const run=(await f.call('operations-engineering-activation-run',{...f.input,expectedApprovalRevision:f.active.revision})).engineeringActivation;a.equal(calls.length,2);a.equal(run.result.mode,'live-read-only-discovery');a.equal(run.result.receipts.length,1);a.equal(run.result.artifact.decision.decision,decision);if(decision==='inspect'){a.equal(run.result.followUp.status,'read');a.equal(run.result.followUp.packet.body.evidence[0].path,'dashboard.js');a.equal(discovery.current(run.result.followUp.packet,f.plan.runtime),true);
  const receipt=run.result.receipts[0];
  const context={binding:receipt.binding,assignment:discovery.OBJECTIVE,evidence:[{id:'repository-discovery-packet',packet:f.plan.repositoryPacket}],priorReceipts:[]};
  const {hash,...reference}=run.result.followUp.reference;
  a.equal(hash,reader.hash(reference));
  a.equal(reference.priorReceiptHash,receipt.hash);
  a.equal(reference.packetHash,run.result.followUp.packet.hash);
  const next=discovery.prepareContinuation(context,receipt,receipt.binding.executionId+'_next');
  a.equal(next.status,'prepared');
  a.equal(next.context.binding.taskId,receipt.binding.taskId);
  a.equal(next.paidDispatch,false);
  a.equal(next.context.evidence[0].packet.hash,reference.packetHash);
  const value={...receipt.response,
   contextHash:discovery.contextHash(next.context.evidence[0].packet,next.context.binding),
   decision:'investigate',evidenceIds:[next.context.evidence[0].packet.body.evidence[0].id],
   files:['dashboard.js'],acceptanceCriteria:['Inspect the supplied dashboard source.'],
   inspection:discovery.noInspection()};
  const raw={id:'resp_continuation_fixture',status:'completed',model:'gpt-6.1-sol',service_tier:'default',
   usage:{input_tokens:1500,output_tokens:400,output_tokens_details:{reasoning_tokens:50}},
   output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]};
  a.equal(provider.parse('chief-plan',raw,next.context).response.decision,'investigate');
  a.throws(()=>provider.parse('chief-plan',raw,context),/ENG_AI_RESPONSE_SCHEMA/);
  a.throws(()=>discovery.prepareContinuation(context,receipt,receipt.binding.executionId),/ENG_DISCOVERY_CONTINUATION_ID/);
  const foreign=structuredClone(context);
  foreign.binding.workspaceHash='0'.repeat(64);
  a.throws(()=>discovery.followUpForReceipt(foreign,receipt),/ENG_DISCOVERY_FOLLOW_UP_RECEIPT/);
  const forged=structuredClone(receipt);
  forged.response.inspection.path='lib/billing-provider.js';
  a.throws(()=>discovery.followUpForReceipt(context,forged),/ENG_DISCOVERY_FOLLOW_UP_RECEIPT/);
 }else a.equal(run.result.followUp,undefined);a.equal(run.result.artifact.acceptedWork,false);a.equal(run.shutdown.paidExecution,false);const state=f.state(),w=state.operations.workflows.at(-1);a.equal(w.status,'verified');a.deepEqual(w.executionStages,['chief-plan']);a.deepEqual(state.operations.grants.at(-1).roles,['chief-of-staff']);a(state.operations.grants.every(g=>g.revoked));a.equal(w.calls,1);a.equal(w.countCalls,1);a.equal(w.attempts.length,1);a(w.attempts.every(x=>x.closed));a.equal(state.operations.approvals.at(-1).status,'revoked');a.equal(state.operations.reservations.at(-1).responsesActualMicros,7000);a.equal(w.discoveryPacket.hash,f.plan.repositoryPacket.hash);
 discovery.historical(w);
 const broker=f.organization.engineering(async()=>true);
 const terminalContext={binding:w.results[0].binding,assignment:discovery.OBJECTIVE,
  evidence:[{id:'repository-discovery-packet',packet:f.plan.repositoryPacket}],priorReceipts:[]};
 a.deepEqual(await broker.renewApproval(f.owner,terminalContext,w.approval),{authorityEnded:true});
 a.deepEqual(f.state(),state);

 for(const mutate of [v=>{v.attempts=[];},v=>{v.countCalls=0;},v=>{v.discoveryPacket.body.repositoryView.coverage='forged';},v=>{const r=v.results[0];r.binding.executionId='forged_execution';const {hash,...body}=r;r.hash=reader.hash(body);}]){const invalid=structuredClone(w);mutate(invalid);a.throws(()=>discovery.historical(invalid));}
 await f.call('operations-engineering-activation-stopReviewedConsent',{});a.equal(f.state().operations.engineeringConfigurationIntents.at(-1).status,'revoked');await f.call('operations-engineering-activation-sequenceStop',{sequenceId:f.intent.sequenceIntentId});a.equal(f.state().operations.engineeringSequences.at(-1).status,'stopped');}finally{global.fetch=previous;}
});
test('read-only catalog cannot enable implementation or source testing, and legacy stage plans stay five',()=>{const tasks=require('../lib/agent-operations-implementation-tasks'),impl=require('../lib/agent-operations-implementation'),c={assignment:discovery.OBJECTIVE};a.equal(impl.enabled(c),false);a.equal(tasks.registration(c).kind,'read-only-discovery');a.equal(tasks.testProfileFor(c),null);a.deepEqual(provider.executionStages(c),['chief-plan']);a.equal(provider.executionStages({assignment:'legacy'}).length,5);});
test('malformed discovery after provider usage fails closed, retains usage and revokes without retry',async()=>{
 const f=await setup(),previous=global.fetch,calls=[];
 global.fetch=async(url)=>{calls.push(url);return url.endsWith('/input_tokens')?Response.json({object:'response.input_tokens',input_tokens:1500}):Response.json({id:'resp_repository_malformed_offline',status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1500,output_tokens:400,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({acceptedWork:true,secret:'SYNTHETIC_INVALID_UNTRUSTED_TEXT'})}]}]});};
 try{await f.call('operations-engineering-activation-run',{...f.input,expectedApprovalRevision:f.active.revision},409);const s=f.state(),w=s.operations.workflows.at(-1);a.equal(calls.length,2);a.equal(w.results.length,0);a.equal(w.calls,1);a.equal(w.countCalls,1);a.equal(w.leaseUntil,0);a(w.attempts.every(x=>x.closed));a(s.operations.grants.every(g=>g.revoked));a.equal(s.operations.approvals.at(-1).status,'revoked');a.equal(w.attempts[0].diagnostic.inputTokens,1500);a.equal(w.attempts[0].diagnostic.outputTokens,400);a.equal(s.operations.reservations.at(-1).status,'pending');a.doesNotMatch(JSON.stringify(w.attempts),/SYNTHETIC_INVALID_UNTRUSTED_TEXT/);await f.call('operations-engineering-activation-stopReviewedConsent',{});await f.call('operations-engineering-activation-sequenceStop',{sequenceId:f.intent.sequenceIntentId});}finally{global.fetch=previous;}
});

test('one approved Chief task carries evidence from multiple source reads',async()=>{
 const query=[{...reader.initial(),kind:'read',path:'api/create-checkout-session.js',lineCount:8},{...reader.initial(),kind:'read',path:'lib/billing-provider.js',lineCount:8}];
 const f=await setup(query);
 const packet=f.plan.repositoryPacket;
 a.deepEqual(packet.body.evidence.map(item=>item.path),query.map(item=>item.path));
 a.equal(packet.body.repositoryView.additionalViews.length,1);
 a.equal(discovery.current(packet,f.plan.runtime),true);
 const forged=structuredClone(packet);
 forged.body.evidence.pop();
 forged.hash=reader.hash(forged.body);
 a.throws(()=>discovery.current(forged,f.plan.runtime),/ENG_DISCOVERY_SOURCE_STALE/);
 a.throws(()=>discovery.packet(packet.body.identity,[query[0],query[0]]),/ENG_DISCOVERY_EVIDENCE/);
 a.throws(()=>discovery.packet(packet.body.identity,[query[0],{...query[1],path:'.env'}]),/ENG_REPOSITORY_DENIED/);
 const previous=global.fetch;
 global.fetch=async(url,options)=>{
  if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:1500});
  const request=JSON.parse(options.body),input=JSON.parse(request.input[0].content[0].text);
  a.deepEqual(input.context.body.evidence.map(item=>item.path),query.map(item=>item.path));
  const value={contextHash:input.responseContextHash,decision:'investigate',problem:'Compare the configuration rules across the handler and its billing adapter.',userImpact:'Possible checkout configuration drift.',evidenceIds:packet.body.evidence.map(item=>item.id),files:query.map(item=>item.path),acceptanceCriteria:['Compare both supported configuration forms.'],exclusions:['No provider transaction.'],uncertainty:'Source evidence only.',reason:'Both source excerpts are available for comparison.',inspection:discovery.noInspection()};
  return Response.json({id:'resp_repository_combined_fixture',status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1500,output_tokens:400,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 };
 try{
  const run=(await f.call('operations-engineering-activation-run',{...f.input,expectedApprovalRevision:f.active.revision})).engineeringActivation;
  a.equal(run.result.artifact.decision.decision,'investigate');
  a.equal(run.result.artifact.evidence.length,2);
  a.equal(run.shutdown.paidExecution,false);
  const workflow=f.state().operations.workflows.at(-1);
  a.equal(workflow.calls,1);
  a.equal(workflow.countCalls,1);
  a.equal(discovery.historical(workflow),true);
 }finally{global.fetch=previous;}
});

test('verified follow-up binds combined source to the task release and rejects private paths',()=>{
 const release=require('../lib/agent-operations-contracts').assertRelease();
 const sourceCommit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
 const runtime={sourceCommit,release};
 const first={...reader.initial(),kind:'read',path:'api/create-checkout-session.js',lineCount:8};
 const next={...reader.initial(),kind:'read',path:'lib/billing-provider.js',lineCount:8};
 const context={binding:{runtime},evidence:discovery.contextEvidence(runtime,first)};
 a.deepEqual(discovery.followUp(context,first),{status:'already-read'});
 const read=discovery.followUp(context,next);
 a.deepEqual(read.query,[first,next]);
 a.deepEqual(read.packet.body.evidence.map(entry=>entry.path),[first.path,next.path]);
 a.equal(discovery.current(read.packet,runtime),true);
 a.throws(()=>discovery.followUp(context,{...next,path:'.env'}),/ENG_REPOSITORY_DENIED/);
 const stale=structuredClone(context);
 stale.binding.runtime.sourceCommit='0'.repeat(40);
 a.throws(()=>discovery.followUp(stale,next),/ENG_DISCOVERY_CONTEXT/);
});

for(const fails of [false,true])test('offline Chief follow-up preserves authority and receipts: '+fails,async()=>{
 const f=await setup();
 const broker=f.organization.engineering(async()=>true);
 const transport=require('../lib/agent-operations-engineering-transport');
 const binding={...f.plan.runtime};
 const planId=f.plan.id+'_fixture';
 const context={assignment:discovery.OBJECTIVE,priorReceipts:[],evidence:discovery.contextEvidence(binding),
  binding:{planId,taskId:planId+'_task1',executionId:'exec_fixture_initial',runtime:binding,fence:0,authorizationRevision:1,
   ownerHash:reader.hash(f.owner.id),workspaceHash:reader.hash(f.owner.workspaceId)}};
 const calls=[];
 const result=transport.rehearseDiscovery({broker,actor:f.owner,context,fetchImpl:async(url,options)=>{
  a.equal(options.headers.Authorization,undefined);
  calls.push(url);
  const body=JSON.parse(JSON.parse(options.body).input[0].content[0].text);
  const first=calls.length===1;
  if(fails&&!first)return Response.json({}, {status:503});
  const value={contextHash:body.responseContextHash,decision:first?'inspect':'investigate',problem:'Review checkout source.',userImpact:'Potential checkout impact.',
   evidenceIds:first?[]:body.context.body.evidence.map(e=>e.id),files:first?[]:['api/create-checkout-session.js'],
   acceptanceCriteria:first?[]:['Verify the checkout source.'],exclusions:['No writes.'],uncertainty:'Fixture only.',reason:'Check the linked source.',
   inspection:first?{...reader.initial(),kind:'read',path:'api/create-checkout-session.js'}:discovery.noInspection()};
  return Response.json({id:'resp_fixture_'+calls.length,status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1500,output_tokens:400,output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 }});
 if(fails){
  await a.rejects(result,error=>error.message==='ENG_TRANSPORT_FAILED'&&error.cleanupConfirmed===true);
  const state=f.state(),workflow=state.operations.workflows.find(w=>w.planId===planId);
  a.equal(workflow.status,'blocked');
  a.equal(workflow.results.length,1);
  a.equal(workflow.leaseUntil,0);
  a(workflow.attempts.every(attempt=>attempt.closed));
  a.equal(state.operations.grants.find(grant=>grant.id===workflow.grantId).revoked,true);
  a.equal(discovery.historical(workflow),true);
  a.equal(calls.length,2);
  return;
 }
 const receipts=await result;
 a.equal(receipts.length,2);
 a.notEqual(receipts[0].binding.executionId,receipts[1].binding.executionId);
 const state=f.state(),workflow=state.operations.workflows.find(w=>w.planId===planId);
 a.equal(workflow.status,'verified');
 a.equal(workflow.calls,2);
 a.equal(discovery.historical(workflow),true);
 const forged=structuredClone(workflow);
 forged.discoveryContinuation.reference.priorReceiptHash='0'.repeat(64);
 a.throws(()=>discovery.historical(forged),/ENG_DISCOVERY_HISTORY/);

 a.equal(workflow.results[0].binding.taskId,workflow.results[1].binding.taskId);
 a.equal(workflow.discoveryContinuation.reference.priorReceiptHash,workflow.results[0].hash);
 a.equal(workflow.results[1].response.decision,'investigate');
 a.equal(workflow.leaseUntil,0);
 a.equal(state.operations.grants.find(g=>g.id===workflow.grantId).revoked,true);
 await a.rejects(broker.admit(f.owner,'chief-plan',context,{rehearseDiscoveryContinuation:true}),/REPLAY/);
 a.equal(calls.length,2);
});

for(const interrupted of [false,true])test('owner controller verifies counted Chief continuation and cleanup: '+interrupted,async()=>{
 const f=await setup(reader.initial(),discovery.CONTINUATION_OBJECTIVE);
 a.equal(f.input.approval.maxCalls,2);
 a.equal(f.input.approval.maxTokenCountRequests,2);
 a.equal(f.input.approval.maxInputTokens,24000);
 const original=global.fetch;
 let count=0,responses=0;
 global.fetch=async(url,options)=>{
  if(url.endsWith('/input_tokens')){count++;return Response.json({object:'response.input_tokens',input_tokens:1500});}
  const input=JSON.parse(JSON.parse(options.body).input[0].content[0].text),first=++responses===1;
  if(interrupted&&!first)return Response.json({}, {status:503});
  const value={contextHash:input.responseContextHash,decision:first?'inspect':'investigate',
   problem:'Compare checkout source.',userImpact:'Potential checkout impact.',evidenceIds:first?[]:input.context.body.evidence.map(e=>e.id),
   files:first?[]:['api/create-checkout-session.js'],acceptanceCriteria:first?[]:['Compare source.'],exclusions:['No writes.'],
   uncertainty:'Scripted fixture.',reason:'Read checkout source.',inspection:first?{...reader.initial(),kind:'read',path:'api/create-checkout-session.js'}:discovery.noInspection()};
  return Response.json({id:'resp_counted_continuation_'+responses,status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1500,output_tokens:400,output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 };
 try{
  if(interrupted){
   await f.call('operations-engineering-activation-run',{...f.input,expectedApprovalRevision:f.active.revision},409);
   const state=f.state(),w=state.operations.workflows.at(-1);
   a.equal(w.results.length,1);
   a.equal(w.leaseUntil,0);
   a(w.attempts.every(attempt=>attempt.closed));
   a(state.operations.grants.every(grant=>grant.revoked));
   a.equal(state.operations.approvals.at(-1).status,'revoked');
   a.equal(discovery.historical(w),true);
   a.equal(count,2);a.equal(responses,2);
   return;
  }
  const run=(await f.call('operations-engineering-activation-run',{...f.input,expectedApprovalRevision:f.active.revision})).engineeringActivation;
  a.equal(run.result.receipts.length,2);
  a.equal(run.result.artifact.decision.decision,'investigate');
  a.equal(run.shutdown.paidExecution,false);
  a.equal(count,2);a.equal(responses,2);
  const w=f.state().operations.workflows.at(-1);
  a.equal(discovery.historical(w),true);
  a.equal(w.leaseUntil,0);
  a.equal(f.state().operations.approvals.at(-1).status,'revoked');
 }finally{global.fetch=original;}
});
