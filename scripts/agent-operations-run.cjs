'use strict';
const fs=require('node:fs'),path=require('node:path');
const {launch,hostedBroker}=require('./agent-operations-launcher.cjs');
const {approvalCheck}=require('../lib/agent-operations-pilot');
function requestedMode(args,local){
  if(args.length===1&&args[0]==='--pilot'&&local.CALLERCORE_AGENTOPS_WORKER_MODE==='pilot'&&local.CALLERCORE_AGENTOPS_PAID_ENABLED==='true')return 'pilot';
  if(args.length===2&&args[0]==='--mock'&&/^[a-f0-9-]{36}$/.test(args[1])&&local.CALLERCORE_AGENTOPS_WORKER_MODE==='mock'&&local.CALLERCORE_AGENTOPS_PAID_ENABLED==='false')return 'mock';
  throw new Error('Explicit worker mode and matching local gates required');
}
async function main(){
  const privateDir=path.resolve(__dirname,'../../../private-agent-operations');
  const local=Object.fromEntries(fs.readFileSync(path.join(privateDir,'.env.agent-operations.local'),'utf8').split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const n=s.indexOf('=');return [s.slice(0,n),s.slice(n+1)];}));
  const mode=requestedMode(process.argv.slice(2),local),env={...process.env,...local},runtime=JSON.parse(fs.readFileSync(path.join(privateDir,'broker-runtime.json'),'utf8'));
  // Validate dedicated project identity before any initialization or model action.
  if(mode==='pilot')require('../lib/agent-operations-project').workerCredential(env);
  const broker=hostedBroker({runtime,workerSecret:local.CALLERCORE_AGENTOPS_WORKER_SECRET,oidcToken:process.env.VERCEL_OIDC_TOKEN});
  const signal=AbortSignal.timeout(600000),state=await broker.read();
  let taskId=process.argv[3];
  if(mode==='pilot'){
    if(state.paidExecution!==true)throw new Error('Server paid gate disabled');
    const task=await broker.initializePilot();taskId=task.id;
    const approved=await broker.read();approvalCheck(approved.pilotApproval,task);
  }else if(state.paidExecution!==false)throw new Error('Mock run requires disabled paid execution');
  await launch({broker,taskId,mode,env,signal,capture:(scope,options)=>require('./agent-operations-capture.cjs').capture(scope,{...options,oidcToken:process.env.VERCEL_OIDC_TOKEN}),onOutput:text=>process.stdout.write(text)});
}
if(require.main===module)main().catch(()=>{process.stderr.write('Agent Operations launch stopped; verify approved persisted state.\n');process.exitCode=1;});
module.exports={requestedMode,main};
