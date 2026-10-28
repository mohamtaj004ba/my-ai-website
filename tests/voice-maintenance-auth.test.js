const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const callback='callback-'.repeat(8),maintenance='maintenance-'.repeat(8);
async function endpoint(token,env={},request={}){
 let status,executed=0; const scope={VERCEL_ENV:'preview',CALLERCORE_VOICE_PREVIEW_ENABLED:'true',CALLERCORE_VOICE_WEBHOOK_SECRET:callback,...env};
 const ctx=vm.createContext({module:{exports:{}},process:{env:scope},console:{error(){}},require(p){
  if(p==='../lib/voice-provider')return {...require('../lib/voice-provider'),previewGate:()=>require('../lib/voice-provider').previewGate(scope)};
  if(p==='../lib/rate-limit')return {rateLimit:async()=>({limited:false})};
  if(p==='../lib/kv')return {kv:{}};
  if(p==='../lib/voice-recovery')return {maintenance:async()=>{executed++;return {workspaces:2,checked:0,failed:0,pending:0,busy:false}}};
  throw Error(p);
 }});
 vm.runInContext(fs.readFileSync('api/voice-maintenance.js','utf8'),ctx);
 await ctx.module.exports({method:'POST',headers:{authorization:'Bearer '+token},query:{},body:{},...request},{setHeader(){},status(n){status=n;return this},json(){}});
 return {status,executed};
}
test('recovery-only credential replaces callback access and stays Preview gated',async()=>{
 const env={CALLERCORE_VOICE_MAINTENANCE_SECRET:maintenance};
 assert.deepEqual(await endpoint(maintenance,env),{status:200,executed:1});
 for(const token of [callback,'invalid',''])assert.deepEqual(await endpoint(token,env),{status:401,executed:0});
 assert.deepEqual(await endpoint(maintenance,{...env,VERCEL_ENV:'production'}),{status:503,executed:0});
 assert.deepEqual(await endpoint(callback),{status:200,executed:1});
});
test('runner prefers recovery-only credential without leaking it',async()=>{
 const {runMaintenance,PREVIEW_ORIGIN}=await import('../scripts/voice-maintenance-runner.mjs');
 const result=await runMaintenance({env:{CALLERCORE_VOICE_MAINTENANCE_URL:PREVIEW_ORIGIN+'/api/voice-maintenance',CALLERCORE_VOICE_MAINTENANCE_SECRET:maintenance,CALLERCORE_VOICE_WEBHOOK_SECRET:callback},fetchImpl:async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer '+maintenance);return {ok:true,json:async()=>({workspaces:2,checked:0,failed:0,pending:0,busy:false})}}});
 assert.equal(result.workspaces,2);
});

test('maintenance rejects every nonempty or malformed body and selector before recovery',async()=>{
 const env={CALLERCORE_VOICE_MAINTENANCE_SECRET:maintenance};
 for(const body of [false,0,true,1,'false','0','{}',[],{workspaceId:'foreign'}])assert.deepEqual(await endpoint(maintenance,env,{body}),{status:400,executed:0});
 for(const body of [undefined,null,'',{}])assert.deepEqual(await endpoint(maintenance,env,{body}),{status:200,executed:1});
 assert.deepEqual(await endpoint(maintenance,env,{query:{workspaceId:'foreign'}}),{status:400,executed:0});
 assert.deepEqual(await endpoint(maintenance,env,{method:'GET'}),{status:405,executed:0});
});