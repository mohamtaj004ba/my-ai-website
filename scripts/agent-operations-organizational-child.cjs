'use strict';
// Restricted orchestration process: no credentials, direct network, filesystem writes or subprocesses.
const deny=()=>{throw Error('Direct worker network denied');};
globalThis.fetch=async()=>deny();for(const name of ['node:http','node:https']){const api=require(name);api.request=deny;api.get=deny;}const net=require('node:net');net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;require('node:tls').connect=deny;
// Windows may synthesize harmless OS environment entries for an empty spawn environment.
for(const key of Object.keys(process.env))delete process.env[key];
const pending=new Map();let next=0,started=false;
function rpc(op,input){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});process.send({id,op,input});});}
process.on('disconnect',()=>process.exit(1));
process.on('message',async m=>{
 if(m.reply){const p=pending.get(m.reply);if(p){pending.delete(m.reply);if(m.error){const safe=require('../lib/agent-operations-diagnostics').diagnostic({phase:'orchestrator',errorType:m.error.type,code:m.error.code}),error=Error('Restricted parent boundary denied');error.name=safe.errorType==='CancelledError'?'AbortError':safe.errorType||'Error';if(safe.code)error.cause={code:safe.code};p.reject(error);}else p.resolve(m.value);}return;}
 if(started||m.type!=='start')return;started=true;
 try{
 const attestation={environmentEmpty:Object.keys(process.env).length===0,networkDenied:false,writesDenied:false,subprocessDenied:false};try{require('node:net').connect(443,'api.openai.com');}catch{attestation.networkDenied=true;}try{require('node:fs').writeFileSync('__organizational_worker_forbidden__','x');}catch{attestation.writesDenied=true;}try{require('node:child_process').spawnSync(process.execPath,['-e','0']);}catch{attestation.subprocessDenied=true;}if(!Object.values(attestation).every(Boolean))throw Error('Restricted worker attestation failed');process.send({attestation});if(m.approval.scenario==='startup-failure')throw Error('Injected worker startup failure');
 const brokerFetch=async(url,options)=>{const r=await rpc('broker',{url,body:options.body?JSON.parse(options.body):null});return{ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.body};};
 const providerFetch=async(url,options)=>{const r=await rpc('provider',{url,body:JSON.parse(options.body),executionId:options.headers['X-Client-Request-Id']});return{ok:r.status>=200&&r.status<300,status:r.status,headers:new Map(Object.entries(r.headers)),json:async()=>r.body};};
 const result=await require('../lib/agent-operations-remote-worker').runWorker({runtime:m.runtime,approval:m.approval,env:m.env,leaseManaged:true,headers:{Authorization:'Bearer organizational-ipc-no-secret'},brokerFetch,providerFetch,capture:(scope,options)=>rpc('capture',{scope,executionId:options.executionId,workflowId:options.workflowId}),independentAssessment:()=>rpc('assessment',{})});
 process.send({done:true,result});
 }catch(error){process.send({done:true,error:true,errorType:error.name,errorCode:typeof error.code==='string'?error.code:undefined});}
});
