'use strict';
// Trusted fixed worker code; Vercel and broker credentials remain in the parent.
const {runStage,mockAdapter}=require('../lib/agent-operations-worker');
async function main(){
  if(!process.send)throw new Error('Restricted launcher required');
  for(const key of Object.keys(process.env))if(/VERCEL|WORKER_SECRET|VERIFICATION_SECRET|BROKER|KV_|REDIS|AUTH_TOKEN/.test(key))throw new Error('Unexpected worker authority');
  let next=0;const pending=new Map();
  const rpc=request=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});process.send({id,request});});
  process.on('message',message=>{if(message.reply){const p=pending.get(message.reply);if(p){pending.delete(message.reply);message.ok?p.resolve(message.value):p.reject(new Error('Parent request denied'));}}});
  const config=await new Promise(resolve=>process.once('message',resolve));
  if(config.type!=='start'||!['mock','pilot'].includes(config.mode)||!Array.isArray(config.taskIds)||config.taskIds.length!==1)throw new Error('Invalid worker assignment');
  const privateFile=require('node:path').resolve(__dirname,'../../../private-agent-operations/.env.agent-operations.local');
  let privateFileReadDenied=false;try{require('node:fs').readFileSync(privateFile);}catch(e){privateFileReadDenied=e.code==='ERR_ACCESS_DENIED';}
  process.send({attestation:{mode:config.mode,vercelCredentialVariables:0,brokerCredentialVariables:0,privateFileReadDenied,permissionModel:!!process.permission,childProcessAllowed:process.permission?.has('child')===true}});
  const broker={read:()=>rpc({op:'read'}),command:(id,command)=>rpc({op:'command',id,command})};
  const signal=AbortSignal.timeout(600000),mode=config.mode;
  let adapter=mockAdapter({delayMs:Math.min(30000,Math.max(0,config.delayMs||0))});
  if(mode==='pilot'){
    if(process.env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='true')throw new Error('Paid worker disabled');
    const {workerCredential}=require('../lib/agent-operations-project');
    adapter=require('../lib/agent-operations-pilot').pilotAdapter({enabled:true,apiKey:workerCredential(process.env),getApproval:async()=>(await broker.read()).pilotApproval,capture:(_scope,{executionId})=>rpc({op:'capture',id:config.taskIds[0],executionId})});
  }
  let cycles=0;
  while(!signal.aborted&&cycles++<8){
    const state=await broker.read(),task=state.tasks.find(t=>config.taskIds.includes(t.id)&&t.mode===mode&&(t.status==='assigned'||t.status==='running'&&t.leaseUntil<=Date.now()));
    if(!task)break;
    const result=await runStage(broker,adapter,{taskId:task.id,signal});
    process.stdout.write(JSON.stringify({taskId:task.id,status:result.status,stage:result.stage,mode})+'\n');
  }
  process.disconnect();
}
if(require.main===module)main().catch(()=>{process.stderr.write('Agent Operations worker stopped; inspect persisted task state.\n');process.exitCode=1;if(process.connected)process.disconnect();});
module.exports={main};
