const test=require('node:test'),assert=require('node:assert/strict');
const good={workspaces:2,checked:3,failed:0,pending:1,busy:false};
async function runner(){const module=await import('../scripts/voice-maintenance-runner.mjs');return {module,env:{CALLERCORE_VOICE_MAINTENANCE_URL:module.PREVIEW_ORIGIN+'/api/voice-maintenance',CALLERCORE_VOICE_WEBHOOK_SECRET:'fixture-'.repeat(8)}}}
test('maintenance runner rejects arbitrary targets, redirects and missing credentials before requests',async()=>{
  const {module,env}=await runner();let requests=0;const fetchImpl=async()=>{requests++};
  for(const url of ['https://www.callercore.com/api/voice-maintenance',module.PREVIEW_ORIGIN+'/api/voice-maintenance?workspaceId=victim',module.PREVIEW_ORIGIN+'/api/voice-maintenance/','http://localhost/api/voice-maintenance'])await assert.rejects(module.runMaintenance({env:{...env,CALLERCORE_VOICE_MAINTENANCE_URL:url},fetchImpl}));
  await assert.rejects(module.runMaintenance({env:{...env,CALLERCORE_VOICE_WEBHOOK_SECRET:''},fetchImpl}));assert.equal(requests,0);
});
test('runner issues one bounded empty POST and returns only validated counters',async()=>{
  const {module,env}=await runner();let requests=0;
  const result=await module.runMaintenance({env,fetchImpl:async(url,options)=>{requests++;assert.equal(url,env.CALLERCORE_VOICE_MAINTENANCE_URL);assert.equal(options.redirect,'error');assert.equal(options.body,'{}');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer '+env.CALLERCORE_VOICE_WEBHOOK_SECRET);assert.ok(options.signal);return {ok:true,json:async()=>({...good,private:'secret'})}}});
  assert.deepEqual(result,good);assert.equal(requests,1);
});
test('runner does not retry failed, rate-limited or malformed responses and never logs provider bodies',async()=>{
  const {module,env}=await runner();
  for(const response of [{ok:false,status:429},{ok:false,status:503},{ok:true,json:async()=>({...good,failed:1})},{ok:true,json:async()=>({...good,pending:null})},{ok:true,json:async()=>({...good,workspaces:3})},{ok:true,json:async()=>{throw Error('secret')}}]){let requests=0;await assert.rejects(module.runMaintenance({env,fetchImpl:async()=>{requests++;return response}}),e=>!e.message.includes('secret'));assert.equal(requests,1)}
});
test('runner strips even a maliciously prefixed transport exception',async()=>{
  const {module,env}=await runner();await assert.rejects(module.runMaintenance({env,fetchImpl:async()=>{throw Error('Maintenance secret '+env.CALLERCORE_VOICE_WEBHOOK_SECRET)}}),e=>!e.message.includes(env.CALLERCORE_VOICE_WEBHOOK_SECRET));
});
test('runner cannot call a missing resource assignment a successful maintenance run',async()=>{
  const {module,env}=await runner();await assert.rejects(module.runMaintenance({env,fetchImpl:async()=>({ok:true,json:async()=>({...good,workspaces:0})})}),/no verified isolated resources/);
});
test('runner aborts timed-out work and does not retry an uncertain mutation',async()=>{
  const {module,env}=await runner();let requests=0;await assert.rejects(module.runMaintenance({env,timeoutMs:10,fetchImpl:async(url,{signal})=>{requests++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('secret')),{once:true}))}}),/uncertain/);assert.equal(requests,1);
});
