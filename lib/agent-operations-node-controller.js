'use strict';
// Actual trusted Node controller. Ports are server-owned, never model/client input.
const crypto=require('node:crypto'),{withActivation}=require('./agent-operations-activation-controller');
const VERSION='node-owner-controller-v1',digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const check=(v,m)=>{if(!v)throw Error(m);};
async function execute({binding,port,run,signal,onEvent=()=>{},durationMs=600000,renewMs=10000,renewTimeoutMs=10000}={}){
 check(binding&&port&&typeof run==='function','Node controller dependencies required');
 const b=structuredClone(binding),a=b.approval,events=[];
 check(require('./agent-operations-approval-lifecycle').shape(a)&&a.contractVersion===b.release?.version&&a.contractHash===b.release?.digest&&a.sourceCommit===b.runtime?.commit&&/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(b.runtime?.origin||'')&&/^[a-f0-9]{64}$/.test(a.ownerHash||'')&&/^[a-f0-9]{64}$/.test(a.scopeHash||'')&&Number.isSafeInteger(a.expiresAt),'Node controller binding denied');
 const inert=a.authorized===false&&(a.purpose==='nonbillable-lifecycle-verification-v1'||require('./agent-operations-transport-verification').isApproval(a))&&a.maxCalls===0&&a.maxMicros===0;
 check(inert||a.authorized===true&&a.maxCalls===5&&a.maxMicros===3600000,'Controller execution limits denied');
 check(['prepare','activate','renew','initialize','revoke','snapshot'].every(k=>typeof port[k]==='function'),'Controller ports required');
 const emit=(phase,receipt)=>{const event={phase,at:Date.now(),runtime:b.runtime,release:b.release,id:a.id,workflowId:a.workflowId,status:receipt?.record?.status,revision:receipt?.record?.revision,leaseUntil:receipt?.record?.leaseUntil,paidExecution:receipt?.paidExecution,controlAuthority:receipt?.controlAuthority};events.push(event);onEvent(structuredClone(event));};
 function validate(r,status,{authority=false,tombstone=false}={}){
  const rec=r?.record;
  check(r&&r.runtime?.origin===b.runtime.origin&&r.runtime?.commit===b.runtime.commit&&r.release?.version===b.release.version&&r.release?.digest===b.release.digest&&rec?.id===a.id&&status.includes(rec.status),'Controller receipt identity denied');
  if(!(tombstone&&!rec.approvalHash))check(rec.workflowId===a.workflowId&&rec.approvalHash===digest(a)&&rec.contractHash===a.contractHash&&rec.contractVersion===a.contractVersion&&rec.expiresAt===a.expiresAt,'Controller approval binding denied');
  if(['active','consumed'].includes(rec.status))check(rec.deploymentOrigin===b.runtime.origin&&rec.sourceCommit===b.runtime.commit,'Controller deployment binding denied');
  if(inert)check(r.paidExecution===false&&r.maxCalls===0&&r.maxMicros===0,'Inert controller paid authority denied');
  if(authority)check(r.controlAuthority===true&&rec.leaseUntil>Date.now()&&rec.expiresAt>Date.now(),'Controller authority unavailable');
  if(rec.status==='revoked')check(r.controlAuthority===false&&r.paidExecution===false&&rec.leaseUntil===0,'Revocation unconfirmed');
  return r;
 }
 function terminal(r,result){validate(r,['revoked']);const w=r.workflow;check(!inert&&w?.id===a.workflowId&&w.approvalId===a.id&&w.approvalHash===digest(a)&&w.contractHash===a.contractHash&&w.contractVersion===a.contractVersion&&w.calls===5&&w.stage==='outcome'&&['verified','rejected'].includes(w.status)&&w.outcomes?.execution==='completed'&&w.outcomes?.structural==='passed'&&w.outcomes?.integrity==='passed','Authoritative terminal workflow required');if(result!==undefined)check(result?.id===w.id&&result.revision===w.revision&&result.status===w.status&&result.stage===w.stage&&digest(result.outcomes)===digest(w.outcomes)&&digest(result.results)===digest(w.results),'Terminal result mismatch');return r;}
 let shutdown;
 try{
  const out=await withActivation({signal,durationMs,renewMs,renewTimeoutMs,
   prepare:async(_,{signal})=>{emit('prepare-start');const r=validate(await port.prepare({signal}),['prepared']);emit('prepared',r);return r;},
   activate:async(p,{signal})=>{const r=validate(await port.activate({expectedRevision:p.record.revision,signal}),['active'],{authority:true});emit('activated',r);},
   renew:async(_,{signal})=>{try{const r=validate(await port.renew({signal}),['active','consumed'],{authority:true});emit('renewed',r);}catch(error){if(signal.aborted||inert)throw error;const r=terminal(await port.snapshot({signal}));emit('terminal-observed-during-renewal',r);}},
   run:async(_,{signal})=>{
    const before=await port.snapshot({signal});if(port.supervised&&before.record?.status==='revoked')terminal(before);else{validate(before,port.supervised?['active','consumed']:['active'],{authority:true});if(before.record?.status==='consumed')check(before.workflow?.id===a.workflowId&&before.workflow.approvalId===a.id&&before.workflow.approvalHash===digest(a),'Supervised initialized task binding denied');}emit('initialization-admitted',before);
    const initialized=await port.initialize({signal});if(!inert&&initialized.receipt?.record?.status==='revoked'){terminal(initialized.receipt,initialized.terminalResult);check(initialized.terminalResult!==undefined,'Completed worker projection required');emit('terminal-before-observation',initialized.receipt);return initialized.terminalResult;}validate(initialized.receipt,['consumed'],{authority:true});emit('initialized',initialized.receipt);
    const boundary=async()=>{if(signal.aborted)throw Error('Controller cancelled');return validate(await port.snapshot({signal}),['consumed'],{authority:true});};
    await boundary();const result=await run(initialized.created,{signal,boundary}),after=await port.snapshot({signal});
    if(inert){validate(after,['consumed'],{authority:true});if(a.purpose===require('./agent-operations-transport-verification').PURPOSE)require('./agent-operations-transport-verification').terminal(after,result,a);}
    else{terminal(after,result);emit('terminal-workflow-verified',after);}
    return result;
   },
   revoke:async(_,{signal})=>{const r=validate(await port.revoke({signal}),['revoked'],{tombstone:true});emit('revoked',r);},
   readback:async(_,{signal})=>{const r=validate(await port.snapshot({signal}),['revoked'],{tombstone:true});emit('shutdown-readback',r);shutdown=r;return{paidExecution:false,replacementPaidExecution:false,scope:'central-record-and-current-runtime-only',receipt:r};}
  });
  return{version:VERSION,completed:true,inert,events,result:out.result,shutdown,requiresIndependentReplacementReadback:true};
 }catch(e){emit('failed');throw Object.assign(Error(e.message==='Activation shutdown failed; owner intervention required'?'Node controller shutdown unconfirmed':'Node controller stopped'),{controllerEvidence:{version:VERSION,completed:false,inert,events,shutdown,requiresIndependentReplacementReadback:true},cause:e});}
}
function organizationPort({organization,owner,approval,runtime,release,authorize=async()=>true}){
 check(owner?.kind==='owner'&&owner.verifiedOwner===true&&crypto.createHash('sha256').update(owner.id).digest('hex')===approval?.ownerHash,'Verified controller owner required');
 const a=structuredClone(approval),rt=structuredClone(runtime),rel=structuredClone(release);
 const guard=async signal=>{if(signal?.aborted)throw Error('Controller request aborted');check(await authorize(),'Controller owner permission revoked');};
 const snapshot=async({signal}={})=>{if(signal?.aborted)throw Error('Controller request aborted');const s=await organization.summary();return{runtime:rt,release:rel,record:s.approvals.find(r=>r.id===a.id),workflow:s.workflows.find(w=>w.id===a.workflowId),paidExecution:s.paidExecution,...(require('./agent-operations-transport-verification').isApproval(a)?{maxCalls:s.maxCalls,maxMicros:s.maxMicros}:{}),controlAuthority:s.paidExecution===true||require('./agent-operations-transport-verification').isApproval(a)&&s.controlAuthority===true};};
 return{prepare:async({signal})=>{await guard(signal);await organization.prepareApproval(owner);return snapshot({signal});},activate:async({expectedRevision,signal})=>{await guard(signal);await organization.activateApproval(owner,{id:a.id,expectedRevision});return snapshot({signal});},renew:async({signal})=>{await guard(signal);await organization.controlApproval(owner,{id:a.id,type:'renew'});return snapshot({signal});},initialize:async({signal})=>{await guard(signal);const created=await organization.initializePilot();check(created.workflow?.id===a.workflowId,'Controller task binding denied');return{created,receipt:await snapshot({signal})};},revoke:async({signal})=>{if(signal?.aborted)throw Error('Cleanup deadline');await organization.controlApproval(owner,{id:a.id,type:'revoke'});return snapshot({signal});},snapshot:async options=>{await guard(options?.signal);return snapshot(options);}};
}
async function runPilot({organization,owner,approval,runtime,release,env,capture,independentAssessment,fetchImpl,authorize,signal,onEvent}={}){
 check(typeof authorize==='function','Authenticated owner transport required');
 const current=require('./agent-operations-contracts').assertRelease(),configured=require('./agent-operations-organization-approval').approval(env,organization.scope);
 check(digest(current)===digest(release)&&configured&&digest(configured)===digest(approval),'Configured release-bound pilot required');
 const port=organizationPort({organization,owner,approval,runtime,release,authorize});
 return execute({binding:{approval,runtime,release},port,signal,onEvent,run:(created,{signal})=>require('./agent-operations-organization-runner').runApproved(organization,created,{env,capture,independentAssessment,fetchImpl,signal})});
}
async function supervisePilot({organization,owner,approval,runtime,release,env,authorize,signal,onEvent,pollMs=1000}={}){
 check(typeof authorize==='function'&&Number.isSafeInteger(pollMs)&&pollMs>=1&&pollMs<=1000,'Authenticated supervision required');
 const configured=require('./agent-operations-organization-approval').approval(env,organization.scope);
 const verification=require('./agent-operations-transport-verification'),inert=verification.isApproval(approval),verificationConfig=inert?verification.supervisorConfig(organization,approval,runtime,release):null;
 check((inert||configured&&digest(configured)===digest(approval))&&digest(require('./agent-operations-contracts').assertRelease())===digest(release),'Configured supervision denied');
 const port=organizationPort({organization,owner,approval,runtime,release,authorize}),wait=signal=>new Promise((resolve,reject)=>{if(signal.aborted)return reject(Error('Supervision stopped'));const abort=()=>{clearTimeout(timer);reject(Error('Supervision stopped'));},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},pollMs);signal.addEventListener('abort',abort,{once:true});});
 port.supervised=true;
 // The existing restricted worker performs the ONE atomic initialization and receives
 // its task capabilities. No worker/assessor/capture capability enters the owner page.
 port.initialize=async({signal})=>{const until=Math.min(Date.now()+30000,approval.expiresAt);for(;;){check(Date.now()<until,'Worker initialization deadline');const receipt=await port.snapshot({signal});if(receipt.workflow?.id===approval.workflowId&&receipt.record?.status==='revoked')return{created:{workflowId:approval.workflowId},receipt,terminalResult:await organization.readWorkflow(owner,approval.workflowId)};if(receipt.record?.status==='consumed'&&receipt.workflow?.id===approval.workflowId)return{created:{workflowId:approval.workflowId},receipt};check(receipt.record?.status==='active'&&receipt.controlAuthority===true,'Worker initialization unavailable');await wait(signal);}};
 return execute({binding:{approval,runtime,release},port,signal,onEvent,...(verificationConfig||{}),run:async(_,{signal})=>{let revision,lastProgress=Date.now();for(;;){const r=await port.snapshot({signal}),w=r.workflow;check(w?.id===approval.workflowId&&w.approvalId===approval.id,'Supervised task binding denied');if(w.stage==='outcome'&&['verified','rejected'].includes(w.status))return organization.readWorkflow(owner,w.id);if(w.revision!==revision){revision=w.revision;lastProgress=Date.now();}check(!(w.status==='running'&&w.leaseUntil<=Date.now())&&Date.now()-lastProgress<(w.stage==='acceptance'?60000:30000),'Supervised worker stalled');check(['assigned','running'].includes(w.status)&&r.controlAuthority===true,'Supervised task stopped');await wait(signal);}}});
}
module.exports={VERSION,execute,organizationPort,runPilot,supervisePilot};
