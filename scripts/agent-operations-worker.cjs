'use strict';
// Bounded external process; no recurring scheduler. Paid mode requires both gates.
const {runStage,mockAdapter}=require('../lib/agent-operations-worker');
async function main(){
  const origin=process.env.CALLERCORE_AGENTOPS_BROKER_ORIGIN,secret=process.env.CALLERCORE_AGENTOPS_WORKER_SECRET;
  if(!/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)||!secret||secret.length<32)throw new Error('Worker configuration missing');
  const request=async(body)=>{
    const r=await fetch(origin+'/api/agent-operations',{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json',...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!r.ok)throw new Error('Broker request unconfirmed');return r.json();
  };
  const broker={read:()=>request(),command:async(id,command)=>(await request({action:'command',id,command})).task};
  const signal=AbortSignal.timeout(600000),mode=process.env.CALLERCORE_AGENTOPS_WORKER_MODE||'mock';
  let adapter=mockAdapter();
  if(mode==='pilot'){
    if(process.env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='true')throw new Error('Paid worker disabled');
    const {workerCredential}=require('../lib/agent-operations-project');
    const apiKey=workerCredential(process.env);
    await request({action:'initialize-pilot'});
    const {pilotAdapter}=require('../lib/agent-operations-pilot');
    const {capture}=require('./agent-operations-capture.cjs');
    adapter=pilotAdapter({enabled:true,apiKey,getApproval:async()=>(await broker.read()).pilotApproval,
      capture:(scope,options)=>capture(scope,{...options,bypassSecret:process.env.VERCEL_AUTOMATION_BYPASS_SECRET})});
  }else if(mode!=='mock')throw new Error('Unknown worker mode');
  let cycles=0;
  while(!signal.aborted&&cycles++<8){
    const state=await broker.read(),task=state.tasks.find(t=>t.mode===mode&&(t.status==='assigned'||t.status==='running'&&t.leaseUntil<=Date.now()));
    if(!task)break;
    const result=await runStage(broker,adapter,{taskId:task.id,signal});
    process.stdout.write(JSON.stringify({taskId:task.id,status:result.status,stage:result.stage,mode})+'\n');
  }
}
if(require.main===module)main().catch(()=>{process.stderr.write('Agent Operations worker stopped; inspect persisted task state.\n');process.exitCode=1;});
module.exports={main};
