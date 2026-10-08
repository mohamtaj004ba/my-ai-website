const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const env={VERCEL_ENV:'preview',CALLERCORE_VOICE_PREVIEW_ENABLED:'true',CALLERCORE_VOICE_WEBHOOK_SECRET:'fixture-voice-credential-'.repeat(2)};
function endpoint(path,{environment=env,limited=false,fail=false,registrationFails=false}={}){
  let invoked=0,result,code;const background=[];
  const context=vm.createContext({module:{exports:{}},Buffer,process:{env:environment},console:{error(){}},require(name){
    if(name==='../lib/voice-provider')return {...require('../lib/voice-provider'),previewGate:()=>require('../lib/voice-provider').previewGate(environment)};
    if(name==='../lib/rate-limit')return {rateLimit:async()=>({limited})};
    if(name==='../lib/kv')return {kv:{}};
    if(name==='../lib/voice-recovery')return {maintenance:async()=>{invoked++;if(fail)throw Error('private provider response');return {checked:1,failed:0,pending:0}},recoverAfterEvent:async()=>{invoked++;if(fail)throw Error('private provider response');return {scheduled:true}}};
    if(name==='../lib/voice-service')return {processMessage:async()=>({ok:true})};
    if(name==='@vercel/functions')return {waitUntil:promise=>{background.push(promise);if(registrationFails)throw Error('registration unavailable')}};
    throw Error('Unexpected dependency '+name);
  }});
  vm.runInContext(fs.readFileSync(path,'utf8'),context);
  return {async invoke(overrides={}){await context.module.exports({method:'POST',headers:{authorization:'Bearer '+environment.CALLERCORE_VOICE_WEBHOOK_SECRET},query:{},body:{},...overrides},{setHeader(){},status(n){code=n;return this},json(v){result=v;return v}});await Promise.all(background);return {code,result,invoked,background:background.length}}};
}
test('maintenance rejects unauthenticated, production, selector and rate-limited requests before provider work',async()=>{
  for(const [options,request,status] of [[{}, {headers:{}},401],[{environment:{...env,VERCEL_ENV:'production'}},{},503],[{}, {query:{workspaceId:'victim'}},400],[{}, {body:{workspaceId:'victim'}},400],[{}, {body:[]},400],[{limited:true},{},429],[{}, {method:'GET'},405]]){const r=await endpoint('api/voice-maintenance.js',options).invoke(request);assert.equal(r.code,status);assert.equal(r.invoked,0)}
});
test('authorized maintenance returns counts and a safe failure without private responses',async()=>{assert.equal((await endpoint('api/voice-maintenance.js').invoke()).code,200);const failed=await endpoint('api/voice-maintenance.js',{fail:true}).invoke();assert.equal(failed.code,503);assert.ok(!JSON.stringify(failed.result).includes('private'))});
test('authenticated lifecycle schedules background recovery but tool responses do not',async()=>{for(const type of ['status-update','end-of-call-report','tool-calls']){const r=await endpoint('api/voice-webhook.js').invoke({body:{message:{type,call:{id:'call'}}}});assert.equal(r.code,200);assert.equal(r.background,type==='tool-calls'?0:1);assert.equal(r.invoked,type==='tool-calls'?0:1)}});
test('recovery failures cannot turn a saved webhook result into failure',async()=>{const r=await endpoint('api/voice-webhook.js',{fail:true}).invoke({body:{message:{type:'end-of-call-report',call:{id:'call'}}}});assert.equal(r.code,200);assert.equal(r.result.ok,true);assert.ok(!JSON.stringify(r.result).includes('private'))});
test('unauthenticated webhook never schedules recovery',async()=>{const r=await endpoint('api/voice-webhook.js').invoke({headers:{},body:{message:{type:'end-of-call-report',call:{id:'call'}}}});assert.equal(r.code,401);assert.equal(r.background,0)});

test('background registration failure preserves a successfully saved webhook response',async()=>{const r=await endpoint('api/voice-webhook.js',{registrationFails:true}).invoke({body:{message:{type:'end-of-call-report',call:{id:'call'}}}});assert.equal(r.code,200);assert.equal(r.result.ok,true)});
