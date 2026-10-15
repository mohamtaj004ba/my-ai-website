'use strict';
// Trusted owner controller orchestration, not a worker tool or retry executor.
// Callbacks must use authenticated, exact-release Preview endpoints. No default transport.
async function withActivation({prepare,activate,run,revoke,readback,renew,signal,durationMs=600000,renewMs=10000,renewTimeoutMs=10000}={}){
 if(![prepare,activate,run,revoke,readback,renew].every(f=>typeof f==='function')||!Number.isSafeInteger(durationMs)||durationMs<1||durationMs>600000||!Number.isSafeInteger(renewMs)||renewMs<1||renewMs>10000)throw Error('Activation control dependencies required');
 if(!Number.isSafeInteger(renewTimeoutMs)||renewTimeoutMs<1||renewTimeoutMs>10000)throw Error('Renewal deadline required');
 let prepared,result,error,shutdown,heartbeat,renewing=false,closed=false,stop;
 const controller=new AbortController(),cancelled=new Promise((_,reject)=>stop=reject),abort=reason=>{controller.abort();stop(Object.assign(Error('Activation cancelled or timed out'),reason instanceof Error?{cause:reason}:{name:'AbortError'}));};
 cancelled.catch(()=>{});signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>abort(Object.assign(Error('Activation cancelled or timed out'),{name:'TimeoutError'})),durationMs);
 const bounded=callback=>Promise.race([Promise.resolve().then(()=>{if(controller.signal.aborted)throw Error('Activation cancelled or timed out');return callback(prepared,{signal:controller.signal});}),cancelled]);
 try{if(signal?.aborted)abort();prepared=await bounded(prepare);await bounded(activate);heartbeat=setInterval(()=>{
  if(closed||renewing||controller.signal.aborted)return;
  renewing=true;const leaseSignal=AbortSignal.any([controller.signal,AbortSignal.timeout(renewTimeoutMs)]);
  Promise.race([Promise.resolve().then(()=>{if(closed||leaseSignal.aborted)throw Error('Renewal stopped');return renew(prepared,{signal:leaseSignal});}),new Promise((_,reject)=>leaseSignal.addEventListener('abort',()=>reject(Object.assign(Error('Renewal deadline'),{name:'TimeoutError'})),{once:true}))]).catch(abort).finally(()=>renewing=false);
 },renewMs);result=await bounded(run);}
 catch(e){error=e;}
 finally{
  // prepare must assign an owner-selected ID before any request; revoke uses that ID
  // even when the prepare response is lost and no scoped token was received.
  closed=true;clearInterval(heartbeat);clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();
  const cleanupSignal=AbortSignal.timeout(15000);
  const cleanup=callback=>Promise.race([Promise.resolve().then(()=>callback(prepared,{signal:cleanupSignal})),new Promise((_,reject)=>cleanupSignal.addEventListener('abort',()=>reject(Error('Shutdown timeout')),{once:true}))]);
  try{await cleanup(revoke);shutdown=await cleanup(readback);if(shutdown?.paidExecution!==false||shutdown?.replacementPaidExecution!==false)throw Error('Authoritative shutdown unconfirmed');}
  catch(e){throw Object.assign(Error('Activation shutdown failed; owner intervention required'),{cause:e,executionError:error});}
 }
 if(error)throw error;return {result,shutdown};
}
// Owner control plane over the existing organization approval lifecycle. This
// does not reinterpret historical fixture journals or expose a paid run action.
function createEngineeringOwnerControl({operations,organization,runtime,env={},assertOwner,clock=Date.now}={}){
 const {isDeepStrictEqual:equal}=require('node:util'),p=require('./agent-operations-engineering-provider-v2'),inference=require('./agent-operations-engineering-inference'),helper=require('./agent-operations-engineering-rehearsal');
 const check=(v,c)=>{if(!v)throw Error(c);},exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&equal(Object.keys(v).sort(),k.slice().sort());
 check(operations&&organization&&typeof assertOwner==='function','ENG_CONTROL_CONFIGURATION');
 async function owner(actor){check(actor?.kind==='owner'&&actor.verifiedOwner===true&&await assertOwner(actor)===true,'ENG_CONTROL_OWNER');check(runtime?.environment==='preview'&&runtime.branch==='feature/callercore-dashboards'&&/^dpl_[A-Za-z0-9]+$/.test(runtime.deploymentId||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(runtime.origin||'')&&/^[a-f0-9]{40}$/.test(runtime.commit||''),'ENG_CONTROL_PREVIEW');}
 function release(){return require('./agent-operations-contracts').assertRelease();}
 async function subject(actor,input,{stale=false}={}){
  await owner(actor);check(typeof input?.planId==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(input.planId),'ENG_CONTROL_SCOPE');
  const view=await operations.read(actor),plan=view.plans.find(x=>x.id===input.planId);
  check(plan&&plan.engineeringProfile===helper.PROFILE&&plan.tasks.length===5&&plan.tasks.every((t,i)=>t.id===plan.id+'_task'+(i+1)&&t.template===helper.templates[i]),'ENG_CONTROL_SCOPE');
  if(!stale)check(plan.revision===input.expectedRevision&&plan.status==='queued'&&plan.deadline>clock()&&plan.tasks.every(t=>t.attempts.length===0)&&equal(plan.runtime,{origin:runtime.origin,sourceCommit:runtime.commit,branch:runtime.branch,deploymentId:runtime.deploymentId,release:release()}),'ENG_CONTROL_STALE');
  const task=plan.tasks[0],context=helper.context(task.template,{engineeringProfile:helper.PROFILE,assignment:plan.objective,planId:plan.id,taskId:task.id,executionId:'approval_'+plan.id,fence:task.fence,authorizationRevision:task.revision,ownerHash:view.scopeIdentity.ownerHash,workspaceHash:view.scopeIdentity.workspaceHash,runtime:plan.runtime,dependencies:[]});
  const configuredAtAdmission=configured(),broker=organization.engineering(async(b,phase)=>{
   check(['approval-prepare','approval-activate','approval-renew','model-access','admit','dispatch','count','finish'].includes(phase),'ENG_CONTROL_PHASE');
   if(phase!=='model-access')check(blockers().length===0&&equal(configured(),configuredAtAdmission),'ENG_CONTROL_ACTIVATION_BLOCKED');
   const fresh=await subject(actor,{planId:plan.id,expectedRevision:plan.revision}),ap=configured(),index=plan.tasks.findIndex(t=>t.id===b.taskId);
   const expected=index<0?null:{...fresh.context.binding,taskId:plan.tasks[index].id,executionId:ap?.id+'_'+inference.STAGES[index],fence:plan.tasks[index].fence,authorizationRevision:plan.tasks[index].revision};
   if(phase!=='model-access')check(blockers().length===0&&equal(configured(),configuredAtAdmission),'ENG_CONTROL_ACTIVATION_BLOCKED');
   check(equal(b,fresh.context.binding)||index>=0&&equal(b,expected),'ENG_CONTROL_STALE');return true;
  });
  return{plan,context,broker};
 }
 function configured(){try{const value=JSON.parse(env.CALLERCORE_AGENTOPS_ENGINEERING_APPROVAL||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}}
 function blockers(){const a=configured(),reasons=[];
  if(env.CALLERCORE_AGENTOPS_ENGINEERING_MODEL_ACCESS_VERIFIED!=='true')reasons.push('current-project-model-access-unverified');
  if(!/^[a-f0-9]{64}$/.test(env.CALLERCORE_AGENTOPS_ENGINEERING_COUNT_PRICING_SHA256||''))reasons.push('account-specific-count-pricing-unverified');
  if(!a)reasons.push('fresh-exact-owner-authorization-not-configured');
  if(!/^[a-f0-9]{64}$/.test(env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256||'')||a?.providerReadinessHash!==env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256)reasons.push('reviewed-provider-access-pricing-and-exposure-not-pinned');
  if(env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='true'||env.CALLERCORE_AGENTOPS_ENGINEERING_PAID_ENABLED!=='true'||env.CALLERCORE_AGENTOPS_ENGINEERING_COUNT_ENABLED!=='true')reasons.push('paid-execution-disabled');
  return reasons;
 }
 async function readiness(actor,input){await owner(actor);check(exact(input,[]),'ENG_CONTROL_INPUT');return{version:'engineering-owner-control-v1',runtime:{...runtime,release:release()},model:inference.CONFIG.model,reasoning:'medium',limits:{calls:5,countRequests:5,inputTokens:60000,outputTokens:20000,perCallInputTokens:12000,perCallOutputTokens:4000,reservationMicros:1000000,stageMs:150000,durationMs:600000},blockers:blockers(),readyForOwnerActivation:blockers().length===0,liveTransportVerified:false,paidExecution:false,acceptance:false,publication:false,generatedCodeExecution:false,qualification:'Native proposal-only controller prepared; live provider execution remains unverified and disabled pending all gates. Historical task execution remains fixture-only; model metadata is not Responses access, price proof or independent acceptance.'};}
 async function headroom(){const state=await organization.read();check(require('./agent-operations-budget').accounting(state).remainingMicros>=1000000,'ENG_CONTROL_BUDGET');}
 async function prepare(actor,input){check(exact(input,['planId','expectedRevision','approval']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input);check(blockers().length===0&&equal(input.approval,configured()),'ENG_CONTROL_ACTIVATION_BLOCKED');await headroom();return broker.prepareApproval(actor,context,input.approval);}
 async function activate(actor,input){check(exact(input,['planId','expectedRevision','approval','expectedApprovalRevision']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input);check(blockers().length===0&&equal(input.approval,configured())&&Number.isSafeInteger(input.expectedApprovalRevision),'ENG_CONTROL_ACTIVATION_BLOCKED');return broker.activateApproval(actor,context,input.approval,input.expectedApprovalRevision);}
 async function status(actor,input){await owner(actor);check(exact(input,['planId','approvalId','approvalHash']),'ENG_CONTROL_INPUT');return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).approvalStatusById(actor,input);}
 async function revoke(actor,input){await owner(actor);check(exact(input,['planId','approvalId','approvalHash']),'ENG_CONTROL_INPUT');return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).revokeApprovalById(actor,input);}
 async function verifyModel(actor,input,{signal}={}){
  check(exact(input,['planId','expectedRevision']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input),{PROJECT,workerCredential}=require('./agent-operations-project'),key=workerCredential(env),controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  let listener;const timer=setTimeout(()=>controller.abort(),10000),cancelled=new Promise((_,reject)=>{listener=()=>reject(Error('ENG_CONTROL_METADATA_UNCONFIRMED'));if(combined.aborted)listener();else combined.addEventListener('abort',listener,{once:true});});
  try{return await Promise.race([(async()=>{
   check(!combined.aborted,'ENG_CONTROL_METADATA_UNCONFIRMED');await subject(actor,input);check(!combined.aborted,'ENG_CONTROL_METADATA_UNCONFIRMED');
   const response=await fetch('https://api.openai.com/v1/models/gpt-6.1-sol',{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+key,'OpenAI-Project':PROJECT.projectId,'OpenAI-Organization':PROJECT.organizationId,Accept:'application/json'},signal:combined});
   check(!combined.aborted&&response.ok&&response.status===200&&!response.redirected,'ENG_CONTROL_METADATA_UNCONFIRMED');
   const raw=await require('./agent-operations-engineering-transport').boundedJson(response,key);check(!combined.aborted&&raw.object==='model'&&raw.id==='gpt-6.1-sol','ENG_CONTROL_METADATA_UNCONFIRMED');await subject(actor,input);check(!combined.aborted,'ENG_CONTROL_METADATA_UNCONFIRMED');
   const facts={model:raw.id,projectId:PROJECT.projectId,httpStatus:200,observedAt:clock()};await broker.recordModelAccess(actor,context,facts);check(!combined.aborted,'ENG_CONTROL_METADATA_UNCONFIRMED');return{model:raw.id,projectId:PROJECT.projectId,observedAt:facts.observedAt,sourceCommit:runtime.commit,releaseFingerprint:release().digest,metadataAccessVerified:true,responsesAccessVerified:false,pricingVerified:false,countAccessVerified:false,paidExecution:false};
  })(),cancelled]);}catch{throw Error('ENG_CONTROL_METADATA_UNCONFIRMED');}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);controller.abort();}
 }
 async function run(actor,input,{signal}={}){
  check(exact(input,['planId','expectedRevision','approval','expectedApprovalRevision']),'ENG_CONTROL_INPUT');
  const captured=structuredClone(input),frame=await subject(actor,captured),ap=structuredClone(configured());
  check(blockers().length===0&&equal(captured.approval,ap),'ENG_CONTROL_ACTIVATION_BLOCKED');
  const recovery={planId:captured.planId,approvalId:ap.id,approvalHash:p.hash(ap)};
  try{
  await headroom();
  const active=await frame.broker.approvalStatusById(actor,recovery);check(active.status==='active'&&active.revision===captured.expectedApprovalRevision&&active.leaseUntil>clock(),'ENG_CONTROL_APPROVAL_NOT_ACTIVE');
  const result=await withActivation({signal,durationMs:Math.max(1,Math.min(600000,ap.expiresAt-clock(),frame.plan.deadline-clock())),
   prepare:async()=>frame,
   activate:async()=>{await subject(actor,captured);},
   renew:async()=>frame.broker.renewApproval(actor,frame.context,ap),
   run:async(_,{signal:runSignal})=>{
    const receipts=[];
    for(const [i,stage]of inference.STAGES.entries()){
     check(!runSignal.aborted,'ENG_CONTROL_CANCELLED');await subject(actor,captured);check(blockers().length===0&&equal(configured(),ap),'ENG_CONTROL_ACTIVATION_BLOCKED');
     const task=frame.plan.tasks[i],context={...structuredClone(frame.context),binding:{...structuredClone(frame.context.binding),taskId:task.id,executionId:ap.id+'_'+stage,fence:task.fence,authorizationRevision:task.revision},priorReceipts:structuredClone(receipts)};
     const executed=await require('./agent-operations-engineering-transport').execute({broker:frame.broker,actor,stage,context,mode:'pilot',approval:ap,env,signal:runSignal,timeoutMs:150000});receipts.push(executed.receipt);
    }
    return{mode:'live-proposal-only',workflowId:ap.workflowId,planId:captured.planId,receipts,artifact:{kind:'inert-copy-proposal',proposal:receipts[1].response.proposal,sourceCommit:runtime.commit,proposalHash:p.hash(receipts[1].response.proposal),sourceExecuted:false,publicationAuthorized:false},acceptedWork:false,independentlyAuthenticatedAcceptance:false,automatedTechnicalReviewsOnly:true,qualification:'Existing operations plan is the frozen admission manifest; actual model roles, usage and results are in the linked organization workflow. Its historical fixture task records are not relabelled as live execution.'};
   },
   revoke:async()=>frame.broker.revokeApprovalById(actor,recovery),
   readback:async()=>{
    await owner(actor);const status=await frame.broker.approvalStatusById(actor,recovery),state=await organization.read(),o=state.operations,w=o?.workflows.find(w=>w.id===ap.workflowId&&w.profile===p.PROFILE),grants=o?.grants.filter(g=>g.approvalId===ap.id)||[];
    check(status.status==='revoked'&&status.leaseUntil===0&&grants.every(g=>g.revoked)&&(!w||w.leaseUntil===0&&w.attempts.every(a=>a.closed)),'ENG_CONTROL_SHUTDOWN_UNCONFIRMED');
    check((configured()===null||equal(configured(),ap))&&!(o?.approvals||[]).some(a=>a.id!==ap.id&&a.engineeringScope?.binding.ownerHash===frame.context.binding.ownerHash&&a.engineeringScope?.binding.workspaceHash===frame.context.binding.workspaceHash&&['active','consumed'].includes(a.status)&&a.leaseUntil>clock()),'ENG_CONTROL_REPLACEMENT_AUTHORITY_UNCONFIRMED');
    return{paidExecution:false,replacementPaidExecution:false,approvalId:ap.id,status:'revoked',leaseUntil:0,activeGrants:0,activeAttempts:0,credential:'existing-server-credential-not-issued-to-model-or-child',acceptedWork:false};
   }
  });return result;
  }finally{const closed=await require('./agent-operations-engineering-transport').boundedCleanup(async()=>{const r=await frame.broker.revokeApprovalById(actor,recovery);return r.status==='revoked'&&r.leaseUntil===0;});check(closed,'ENG_CONTROL_SHUTDOWN_UNCONFIRMED');}
 }
 return Object.freeze({readiness,prepare,activate,status,revoke,verifyModel,run});
}
module.exports={withActivation,createEngineeringOwnerControl};
