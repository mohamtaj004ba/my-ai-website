'use strict';
const fs=require('node:fs');
const {diagnostic}=require('../lib/agent-operations-diagnostics');
const {fork}=require('node:child_process'),path=require('node:path');
const {ORIGIN,oidcHeaders}=require('./agent-operations-preview-access.cjs');
const {approvalCheck}=require('../lib/agent-operations-pilot');
const {workerCredential,PROJECT}=require('../lib/agent-operations-project');
const fields={claim:['type','expectedRevision'],reserve:['type','fence','executionId'],evidence:['type','fence','executionId','diagnostic'],finish:['type','fence','executionId','diagnostic','result','actualMicros','model','inputTokens','outputTokens','projectId','organizationId'],heartbeat:['type','fence'],recover:['type'],fail:['type','fence','executionId','diagnostic']};
function childEnvironment(env,mode){
  const safe=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','HOME','NODE_PATH'].filter(k=>env[k]).map(k=>[k,env[k]]));
  safe.CALLERCORE_AGENTOPS_PAID_ENABLED=mode==='pilot'?'true':'false';
  if(mode==='pilot'){
    if(env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='true')throw new Error('Paid launcher disabled');
    safe.CALLERCORE_AGENTOPS_OPENAI_API_KEY=workerCredential(env);
    safe.CALLERCORE_AGENTOPS_OPENAI_PROJECT_ID=PROJECT.projectId;safe.CALLERCORE_AGENTOPS_OPENAI_ORGANIZATION_ID=PROJECT.organizationId;
  }
  return safe;
}
function scopedBridge({broker,taskIds,mode,capture,signal}){
  if(!Array.isArray(taskIds)||taskIds.length!==1||!['mock','pilot'].includes(mode))throw new Error('Invalid assignment');
  let calls=0;const activeCaptures=new Map();
  const read=async()=>{
    const state=await broker.read(),tasks=state.tasks.filter(t=>taskIds.includes(t.id));
    if(tasks.length!==taskIds.length||tasks.some(t=>t.mode!==mode||t.scope.origin!==ORIGIN||t.scope.commit!=='8133597ff2fc5b48e3de42336e9e06fa4191c2a8'||JSON.stringify(t.scope.paths)!==JSON.stringify(['/industries/legal','/#pricing'])))throw new Error('Task scope mismatch');
    for(const t of tasks)if(t.status!=='running'||t.leaseUntil<=Date.now()||t.deadline<=Date.now())activeCaptures.get(t.id)?.abort();
    return {mode,paidExecution:state.paidExecution===true,revision:state.revision,scope:state.scope,
      tasks:tasks.map(({principal,requestHash,payloadHash,...t})=>t),reservations:state.reservations.filter(r=>taskIds.includes(r.taskId)),
      ...(mode==='pilot'&&state.pilotApproval?.taskId===taskIds[0]?{pilotApproval:state.pilotApproval}:{})};
  };
  return async message=>{
    if(signal?.aborted||++calls>600||!message||typeof message!=='object'||Array.isArray(message)||Buffer.byteLength(JSON.stringify(message))>16000)throw new Error('Worker request denied');
    if(message.op==='read'&&Object.keys(message).length===1)return read();
    if(message.op==='command'&&Object.keys(message).length===3&&taskIds.includes(message.id)){
      const c=message.command,keys=fields[c?.type];
      if(!keys||Object.keys(c).some(k=>!keys.includes(k))||c.type==='claim'&&!Number.isSafeInteger(c.expectedRevision)||['reserve','finish','heartbeat','fail','evidence'].includes(c.type)&&!Number.isSafeInteger(c.fence)||['reserve','finish','evidence'].includes(c.type)&&!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(c.executionId||'')||c.type==='fail'&&c.executionId!==undefined&&!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(c.executionId)||mode==='mock'&&c.type==='finish'&&(c.actualMicros!==0||c.model!=='mock'))throw new Error('Worker command denied');
      await read();return broker.command(message.id,c);
    }
    if(message.op==='capture'&&mode==='pilot'&&Object.keys(message).length===3&&taskIds.includes(message.id)){
      const state=await read(),task=state.tasks[0];approvalCheck(state.pilotApproval,task);
      if(task.status!=='running'||task.leaseUntil<=Date.now()||task.deadline<=Date.now()||!['inspect','review'].includes(task.stage)||!state.reservations.some(r=>r.taskId===task.id&&r.executionId===message.executionId&&r.stage===task.stage&&r.fence===task.fence&&r.status==='pending')||activeCaptures.has(task.id))throw new Error('Capture not reserved');
      const controller=new AbortController();activeCaptures.set(task.id,controller);
      try{return await capture(task.scope,{executionId:message.executionId,signal:AbortSignal.any([...(signal?[signal]:[]),controller.signal,AbortSignal.timeout(90000)])});}finally{activeCaptures.delete(task.id);}
    }
    throw new Error('Worker operation denied');
  };
}
async function launch({broker,taskId,mode='mock',env=process.env,delayMs=0,capture,signal=AbortSignal.timeout(600000),onOutput=()=>{},onAttestation=()=>{}}){
  const bridge=scopedBridge({broker,taskIds:[taskId],mode,capture,signal});await bridge({op:'read'});
  const workerFile=path.join(__dirname,'agent-operations-worker.cjs');
  const child=fork(workerFile,[],{env:childEnvironment(env,mode),execArgv:['--permission','--allow-fs-read='+path.join(__dirname,'../lib'),'--allow-fs-read='+workerFile,'--allow-fs-read='+path.join(__dirname,'../package.json')],stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  const stop=()=>child.kill();signal.addEventListener('abort',stop,{once:true});
  child.stdout.on('data',b=>onOutput(b.toString()));child.stderr.resume();
  let lastNotice;
  const journal=notice=>{
    if(notice?.taskId!==taskId||!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(notice.executionId||''))throw new Error('Diagnostic correlation denied');
    const file=path.resolve(__dirname,'../artifacts/agent-operations/worker-diagnostics.jsonl');fs.mkdirSync(path.dirname(file),{recursive:true});
    if(fs.existsSync(file)&&fs.statSync(file).size>2000000)throw new Error('Diagnostic journal capacity reached');
    lastNotice=notice;
    fs.appendFileSync(file,JSON.stringify({at:Date.now(),taskId,executionId:notice.executionId,diagnostic:diagnostic(notice.diagnostic)})+'\n',{mode:0o600});
  };
  let windowStart=Date.now(),count=0;
  child.on('message',async message=>{
    if(message?.attestation){onAttestation(message.attestation);return;}
    if(Date.now()-windowStart>=60000){windowStart=Date.now();count=0;}
    if(message?.diagnosticNotice&&Object.keys(message).length===1&&++count<=120){try{journal(message.diagnosticNotice);}catch{stop();}return;}
    if(!message||!Number.isSafeInteger(message.id)||!message.request||Object.keys(message).length!==2||++count>120){stop();return;}
    try{if(message.request?.op==='command'&&['evidence','fail'].includes(message.request.command?.type))journal({taskId:message.request.id,executionId:message.request.command.executionId,diagnostic:message.request.command.diagnostic});const value=await bridge(message.request);if(child.connected)child.send({reply:message.id,ok:true,value});}catch{if(child.connected)child.send({reply:message.id,ok:false});}
  });
  child.send({type:'start',mode,taskIds:[taskId],delayMs});
  return new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>{signal.removeEventListener('abort',stop);if(code!==0&&lastNotice){try{journal({...lastNotice,diagnostic:{...lastNotice.diagnostic,phase:'worker',errorType:'WorkerInterrupted'}});}catch{}}code===0?resolve():reject(new Error('Worker outcome unconfirmed'));});});
}
function hostedBroker({runtime,workerSecret,oidcToken,fetchImpl=fetch}){
  if(!/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(runtime.origin)||!/^dpl_[A-Za-z0-9]+$/.test(runtime.deploymentId)||!/^[a-f0-9]{40}$/.test(runtime.commit)||typeof workerSecret!=='string'||workerSecret.length<32)throw new Error('Pinned broker configuration required');
  const request=async body=>{
    const response=await fetchImpl(runtime.origin+'/api/agent-operations',{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+workerSecret,'Content-Type':'application/json',...oidcHeaders(oidcToken)},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok)throw new Error('Broker request unconfirmed');const data=await response.json();
    if(!body&&(data.runtime?.origin!==runtime.origin||data.runtime?.commit!==runtime.commit||data.runtime?.environment!=='preview'))throw new Error('Broker runtime mismatch');return data;
  };
  return {read:()=>request(),command:async(id,command)=>(await request({action:'command',id,command})).task,initializePilot:async()=>(await request({action:'initialize-pilot'})).task};
}
module.exports={launch,scopedBridge,childEnvironment,hostedBroker};
