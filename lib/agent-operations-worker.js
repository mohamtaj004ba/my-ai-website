'use strict';
const {randomUUID}=require('node:crypto');
const {LIMITS,hash}=require('./agent-operations-store');
const {diagnostic}=require('./agent-operations-diagnostics');
const {SMOKE,isSmoke}=require('./agent-operations-smoke');
const {SPECIALIST,isSpecialist}=require('./agent-operations-specialist');
const ROLE=Object.freeze({chief:'chief-of-staff',inspect:'website-visual-qa',review:'independent-qa',report:'chief-of-staff'});
// The model never controls transitions, targets, tools, budgets or credentials.
async function runStage(broker,adapter,{taskId,signal,clock=Date.now,intervalMs=1000,onDiagnostic=async()=>{}}={}){
  let state=await broker.read(),t=state.tasks.find(t=>t.id===taskId);
  if(!t)return {status:'missing'};
  if(t.status==='running'&&t.leaseUntil<=clock())return broker.command(t.id,{type:'recover'});
  if(t.status!=='assigned')return t;
  if(isSpecialist(t)&&(!['chief','inspect'].includes(t.stage)||t.calls>=SPECIALIST.calls))throw new Error('Specialist stage denied');
  t=await broker.command(t.id,{type:'claim',expectedRevision:t.revision});
  const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)cancel();
  let timer,busy=false,progress={phase:'reserve',requestAttempted:false,startedAt:clock()},abortType='CancelledError';
  const executionId='exec_'+randomUUID().replaceAll('-','');
  try{
    if(controller.signal.aborted)throw new Error('Cancelled');
    if(t.mode!==adapter.mode)throw new Error('Execution mode mismatch');
    // Reservation is committed before any adapter/tool/provider execution.
    await broker.command(t.id,{type:'reserve',fence:t.fence,executionId});
    timer=setInterval(async()=>{
      if(busy)return;busy=true;
      try{
        const snapshot=await broker.read(),latest=snapshot.tasks.find(x=>x.id===t.id);
        if(t.mode==='pilot'&&snapshot.paidExecution===false){abortType='CancelledError';cancel();return;}
        if(!latest||latest.status!=='running'||latest.fence!==t.fence||latest.deadline<=clock()){cancel();return;}
        if(latest.leaseUntil-clock()<LIMITS.leaseMs/2)await broker.command(t.id,{type:'heartbeat',fence:t.fence});
      }catch{abortType='StorageError';cancel();}finally{busy=false;}
    },intervalMs);
    const timeout=setTimeout(()=>{abortType='TimeoutError';cancel();},Math.min(isSmoke(t)?SMOKE.requestTimeoutMs:90000,t.deadline-clock()));
    let result;
    try{
      // Abort is raced even if a faulty adapter ignores the signal.
      result=await Promise.race([adapter.execute({role:ROLE[t.stage],stage:t.stage,task:t,executionId,signal:controller.signal,onEvidence:async facts=>{progress=diagnostic(facts);await broker.command(t.id,{type:'evidence',fence:t.fence,executionId,diagnostic:progress});}}),new Promise((_,reject)=>{
        if(controller.signal.aborted)reject(new Error('Execution aborted'));
        else controller.signal.addEventListener('abort',()=>reject(new Error('Execution aborted')),{once:true});
      })]);
    }finally{clearTimeout(timeout);}
    progress={...progress,...result.diagnostic,phase:'finish_read'};
    const latest=(await broker.read()).tasks.find(x=>x.id===t.id);
    if(latest.status!=='running'||latest.fence!==t.fence||controller.signal.aborted)throw new Error('Execution revoked');
    progress={...progress,phase:'finish'};
    return await broker.command(t.id,{type:'finish',fence:t.fence,executionId,...result});
  }catch(error){
    const failure=diagnostic({...progress,...error?.diagnostic,code:error?.diagnostic?.code||error?.code||progress.code,brokerStatus:error?.brokerStatus,errorType:error?.diagnostic?.errorType||(controller.signal.aborted?abortType:error?.code==='BROKER_BUDGET_EXHAUSTED'?'BudgetError':error?.code==='BROKER_STATE_DENIED'?'StateError':'StorageError'),elapsedMs:Math.max(0,clock()-progress.startedAt)});
    await onDiagnostic({executionId,diagnostic:failure});
    const latest=(await broker.read()).tasks.find(x=>x.id===t.id);
    if(latest?.status==='running')return broker.command(t.id,{type:'fail',fence:t.fence,executionId,diagnostic:failure});
    return latest;
  }finally{clearInterval(timer);signal?.removeEventListener('abort',cancel);}
}
function mockAdapter({reject=false,delayMs=0}={}){return {mode:'mock',async execute({stage,task,signal}){
  if(delayMs)await new Promise((resolve,reject)=>{
    const timer=setTimeout(resolve,delayMs);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Cancelled'));},{once:true});
  });
  let result;
  if(stage==='chief')result={stage,delegate:'website-visual-qa',note:'MOCK: bounded website inspection delegated'};
  if(stage==='inspect')result={stage,evidenceHash:hash({fixture:'mock-visual-evidence',scope:task.scope}),findings:[{code:'MOCK_IMAGERY',note:'Synthetic imagery mismatch fixture; not a real website finding'}]};
  if(stage==='review')result={stage,evidenceHash:task.results.inspect.evidenceHash,accepted:!reject,note:'MOCK independent reviewer decision'};
  if(stage==='report')result={stage,note:'MOCK workflow completed. No real rendered website or model acceptance.'};
  return {result,actualMicros:0,model:'mock',inputTokens:0,outputTokens:0};
}};}
module.exports={runStage,mockAdapter,ROLE};
