'use strict';
// Owner-only control-plane verification. No provider, task, grant or spending APIs.
const crypto=require('node:crypto'),lifecycle=require('./agent-operations-approval-lifecycle'),{CAS}=require('./agent-operations-store');
const VERSION='nonbillable-lifecycle-verification-v1';
const digest=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const check=(v,m)=>{if(!v)throw Error(m);};
function lifecycleHashScope(){return digest(JSON.stringify({origin:'https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app',commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',paths:['/industries/legal','/#pricing']}));}
function createVerification({kv,env,runtime,clock=Date.now}){
 function gate(actor){const until=Number(env.CALLERCORE_AGENTOPS_LIFECYCLE_VERIFY_UNTIL);check(env.VERCEL_ENV==='preview'&&env.CALLERCORE_AGENTOPS_PAID_ENABLED==='false'&&Number.isSafeInteger(until)&&until>clock()&&until<=clock()+7200000,'Lifecycle verification unavailable');check(actor?.kind==='owner'&&actor.verifiedOwner===true&&typeof actor.id==='string','Verified workspace owner required');}
 function definition(actor,input,release){return {id:'pilot_probe_'+input.nonce+'_'+input.slot,workflowId:'wf_'+digest('pilot_probe_'+input.nonce+'_'+input.slot).slice(0,32),sourceCommit:runtime.commit,lifecycleVersion:lifecycle.VERSION,ownerHash:digest(actor.id),contractVersion:release.version,contractHash:release.digest,purpose:VERSION,scopeHash:lifecycleHashScope(),projectId:require('./agent-operations-project').PROJECT.projectId,authorized:false,maxCalls:0,maxMicros:0,expiresAt:Math.min(clock()+600000,Number(env.CALLERCORE_AGENTOPS_LIFECYCLE_VERIFY_UNTIL))};}
 async function execute(actor,input,planned){
  gate(actor);check(input&&Object.keys(input).every(k=>['nonce','operation','slot','expectedRevision','variant','fault'].includes(k))&&/^[a-f0-9]{32}$/.test(input.nonce||'')&&Number.isSafeInteger(input.slot)&&input.slot>=0&&input.slot<8,'Verification fields denied');
  check(['prepare','activate','renew','consume','check','revoke'].includes(input.operation)&&(!input.fault||['read','compare','lost-commit'].includes(input.fault))&&(!input.variant||['task','release','source'].includes(input.variant)),'Verification operation denied');
  check(!input.variant||input.operation==='check','Binding variant is read-only');check(!input.fault||input.fault==='read'||input.operation!=='check','Mutation fault requires mutation');
  const release=require('./agent-operations-contracts').assertRelease(),key='agentops:{preview}:lifecycle-probe:v1:'+digest(actor.id)+':'+input.nonce,id='pilot_probe_'+input.nonce+'_'+input.slot;
  for(let attempt=0;attempt<5;attempt++){
   if(input.fault==='read')throw Error('Injected isolated probe read failure');
   const value=await kv.get(key),raw=value==null?null:typeof value==='string'?value:JSON.stringify(value),s=raw===null?{version:VERSION,revision:0,approvals:[],workflows:[],grants:[],definitions:{}}:JSON.parse(raw);
   check(s.version===VERSION&&Array.isArray(s.approvals)&&s.approvals.length<=8&&Number.isSafeInteger(s.revision),'Verification ledger unverified');
   const now=clock();let a=s.definitions[id],result;
   if(input.operation==='prepare'){
    a=planned||definition(actor,input,release);
    check(a.id===id&&a.ownerHash===digest(actor.id)&&a.purpose===VERSION&&a.authorized===false&&a.maxCalls===0&&a.maxMicros===0,'Inert binding denied');
    lifecycle.prepare(s,a,actor,now);s.definitions[id]=a;
   }else if(input.operation==='revoke')lifecycle.control(s,id,actor,now,{type:'revoke'});
   else{
    check(a?.purpose===VERSION&&a.maxCalls===0&&a.maxMicros===0&&a.authorized===false,'Verification approval missing');
    if(input.operation==='activate')lifecycle.activate(s,a,actor,runtime,now,input.expectedRevision);
    if(input.operation==='renew')lifecycle.control(s,id,actor,now,{type:'renew'});
    if(input.operation==='consume')lifecycle.consume(s,a,runtime,now);
   }
   const candidate=a&&structuredClone(a);if(candidate&&input.variant==='task')candidate.workflowId='wf_'+'0'.repeat(32);if(candidate&&input.variant==='release')candidate.contractHash='0'.repeat(64);if(candidate&&input.variant==='source')candidate.sourceCommit='0'.repeat(40);
   const record=s.approvals.find(r=>r.id===id);result={version:VERSION,id,operation:input.operation,runtime,release,paidExecution:false,maxCalls:0,maxMicros:0,controlAuthority:!!candidate&&(lifecycle.verified(s,candidate,runtime,now,{initializing:true})||lifecycle.verified(s,candidate,runtime,now)),record:record?lifecycle.publicRecord(record):null,ledgerRevision:s.revision};
   if(input.operation==='check')return result;
   s.revision++;const next=JSON.stringify(s);check(Buffer.byteLength(next)<=40000,'Verification capacity reached');if(input.fault==='compare')throw Error('Injected isolated probe CAS failure');
   // Identical shared compare-and-set primitive; TTL affects only this disposable namespace.
   const committed=Number(await kv.eval(CAS.replace('return 1','redis.call(\'EXPIRE\',KEYS[1],86400); return 1'),[key],[raw||'',next]));check(committed===0||committed===1,'Verification storage unconfirmed');
   if(committed===1){if(input.fault==='lost-commit')throw Error('Injected response lost after isolated probe commit');return {...result,ledgerRevision:s.revision};}
  }
  throw Error('Concurrent verification update');
 }
 async function controller(actor,input,{authorize=async()=>true,signal,onEvent}={}){
  gate(actor);check(input&&Object.keys(input).every(k=>['nonce','slot','scenario'].includes(k))&&/^[a-f0-9]{32}$/.test(input.nonce||'')&&Number.isSafeInteger(input.slot)&&input.slot>=0&&input.slot<8,'Controller verification fields denied');
  const scenario=input.scenario||'success';check(['success','prepare-lost','activate-lost','initialize-lost','cancel','revoked','renew-failure','expired','redis-unavailable','timeout','cleanup-failure'].includes(scenario),'Controller scenario denied');
  const release=require('./agent-operations-contracts').assertRelease(),a=definition(actor,input,release);if(scenario==='expired')a.expiresAt=Math.min(a.expiresAt,clock()+1000);const binding={approval:a,runtime,release},abort=new AbortController(),combined=signal?AbortSignal.any([signal,abort.signal]):abort.signal;
  const call=async(operation,options={})=>{if(options.signal?.aborted)throw Error('Controller boundary aborted');if(operation!=='revoke')check(await authorize(),'Controller owner permission revoked');return execute(actor,{nonce:input.nonce,slot:input.slot,operation,...(options.expectedRevision?{expectedRevision:options.expectedRevision}:{})},a);};
  let cleanupFailed=false;
  const port={prepare:async options=>{const r=await call('prepare',options);if(scenario==='prepare-lost')throw Error('Isolated lost prepare response');return r;},activate:async options=>{const r=await call('activate',options);if(scenario==='activate-lost')throw Error('Isolated lost activation response');return r;},renew:async options=>{if(scenario==='renew-failure')throw Error('Isolated renewal outage');return call('renew',options);},initialize:async options=>{if(scenario==='redis-unavailable')return execute(actor,{nonce:input.nonce,slot:input.slot,operation:'consume',fault:'read'},a);const receipt=await call('consume',options);if(scenario==='initialize-lost')throw Error('Isolated lost initialization response');return{receipt,created:{id:a.workflowId,inert:true}};},revoke:async options=>{if(scenario==='cleanup-failure'&&!cleanupFailed){cleanupFailed=true;throw Error('Isolated cleanup outage');}return call('revoke',options);},snapshot:options=>call('check',options)};
  let timer;
  const run=async(_,{signal,boundary})=>{await boundary();if(scenario==='revoked'){await call('revoke');await boundary();}if(scenario==='cancel')timer=setTimeout(()=>abort.abort(),250);await new Promise((resolve,reject)=>{const t=setTimeout(resolve,scenario==='success'||scenario==='renew-failure'?12000:scenario==='expired'?1250:1000);signal.addEventListener('abort',()=>{clearTimeout(t);reject(Error('Inert controller stopped'));},{once:true});});await boundary();return{inert:true,modelRequests:0,taskInitialized:false};};
  let result;try{result=await require('./agent-operations-node-controller').execute({binding,port,run,signal:combined,onEvent,durationMs:scenario==='timeout'?250:20000});}catch(e){result=e.controllerEvidence||{completed:false,events:[],shutdownUnconfirmed:true};}finally{clearTimeout(timer);abort.abort();}
  // Separate recovery is explicit evidence, not a retry or a successful original cleanup.
  if(cleanupFailed){try{await call('revoke');result.recovery=await call('check');}catch{result.recoveryUnconfirmed=true;}}
  return {...result,scenario,runtime,release,nonce:input.nonce,slot:input.slot,paidExecution:false,maxCalls:0,maxMicros:0,nodeRuntime:process.release.name,nodeVersion:process.versions.node,operationalTaskCreated:false,requiresIndependentReplacementReadback:true};
 }
 function availability(actor){try{gate(actor);return {version:VERSION,expiresAt:Number(env.CALLERCORE_AGENTOPS_LIFECYCLE_VERIFY_UNTIL),maxCalls:0,maxMicros:0,runtime,release:require('./agent-operations-contracts').assertRelease()};}catch{return null;}}
 return {execute,controller,availability};
}
module.exports={VERSION,createVerification};
