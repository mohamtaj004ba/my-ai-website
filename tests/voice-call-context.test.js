const test=require('node:test'),assert=require('node:assert/strict');
const {businessContext,deliverContext}=require('../lib/voice-call-context');
const {createProvider}=require('../lib/voice-provider');
const policy={timezone:'America/Los_Angeles',schedule:[{day:1,open:540,close:1020}],holidays:[],afterHours:'capture',maxDurationSeconds:600};
test('observed Vapi regional host permits context without broadening URL or call guards',async()=>{
 const env={VERCEL_ENV:'preview',CALLERCORE_VOICE_PREVIEW_ENABLED:'true',VAPI_PRIVATE_KEY:'fixture'};let requests=0;
 const provider=createProvider({env,fetchImpl:async()=>{requests++;return {ok:true,json:async()=>({status:'ok'})}}});
 const host='phone-call-websocket.aws-us-west-2-backend-production1.vapi.ai';
 assert.deepEqual(await provider.appendContext({id:'call_one',monitor:{controlUrl:'https://'+host+'/call_one/control'}},'Verified closed hours'),{submitted:true});
 for(const url of ['https://'+host+'.evil.test/call_one/control','https://other.aws-us-west-2-backend-production1.vapi.ai/call_one/control','https://'+host+'/call_two/control','https://'+host+'/call_one/control?secret=x','https://user:password@'+host+'/call_one/control'])await assert.rejects(provider.appendContext({id:'call_one',monitor:{controlUrl:url}},'Hours'),{code:'VOICE_CONTROL_INVALID'});
 assert.equal(requests,1);
});
test('context failures retain safe diagnostic codes without secrets or retries',async()=>{
 for(const code of ['VOICE_CONTROL_INVALID','VOICE_CONTEXT_TIMEOUT','VOICE_ACCESS_REQUIRED','private-provider-url']){
  let attempts=0,claimed=false;
  const ctx={canonical:{id:'voice_one',status:'active'},config:{state:'ready',agentRevision:0},agent:{},call:{},policy};
  const kv={set:async()=>{if(claimed)return null;claimed=true;return 'OK'}};
  const provider={appendContext:async()=>{attempts++;throw Object.assign(Error('Bearer private-secret'),{code})}};
  const result=await deliverContext(kv,ctx,provider);
  assert.equal(result.state,'unconfirmed');assert.equal(result.failureCode,code==='private-provider-url'?'VOICE_CONTEXT_UNCONFIRMED':code);
  assert.ok(!JSON.stringify(result).includes('private'));assert.equal(await deliverContext(kv,ctx,provider),undefined);assert.equal(attempts,1);
 }
});
test('provider access denial remains distinguishable from uncertain context delivery',async()=>{
 const env={VERCEL_ENV:'preview',CALLERCORE_VOICE_PREVIEW_ENABLED:'true',VAPI_PRIVATE_KEY:'fixture'};let attempts=0;
 const provider=createProvider({env,fetchImpl:async()=>{attempts++;return {ok:false,status:403}}});
 await assert.rejects(provider.appendContext({id:'call_one',monitor:{controlUrl:'https://api.vapi.ai/call_one/control'}},'Verified hours'),{code:'VOICE_ACCESS_REQUIRED'});
 assert.equal(attempts,1);
});
test('call-start hours are verified but never used across an opening boundary',()=>{
 assert.equal(businessContext(policy,Date.parse('2026-10-05T16:30:00Z')).validAcrossCall,true);
 const closing=businessContext(policy,Date.parse('2026-10-05T23:59:00Z'));assert.equal(closing.open,true);assert.equal(closing.validAcrossCall,false);
 const opening=businessContext(policy,Date.parse('2026-10-05T15:59:00Z'));assert.equal(opening.open,false);assert.equal(opening.validAcrossCall,false);
 assert.equal(businessContext({...policy,holidays:['2026-10-05']},Date.parse('2026-10-05T16:30:00Z')).open,false);
});
test('speaker context is submitted once; uncertain control outcomes are not replayed',async()=>{
 const locks=new Set(),kv={set:async k=>{if(locks.has(k))return null;locks.add(k);return 'OK'}},ctx={canonical:{id:'voice_one',status:'active'},config:{state:'ready',agentRevision:0},agent:{},call:{id:'provider_one'},policy};let attempts=0;
 const provider={appendContext:async()=>{attempts++;throw Error('uncertain')}};
 assert.equal((await deliverContext(kv,ctx,provider)).state,'unconfirmed');assert.equal(await deliverContext(kv,ctx,provider),undefined);assert.equal(attempts,1);
});
test('ended, paused and stale configurations cannot inject context',async()=>{
 const ctx={canonical:{id:'voice_one',status:'active'},config:{state:'ready',agentRevision:0},agent:{},call:{},policy};let touched=false;
 for(const patch of [{canonical:{status:'ended'}},{config:{state:'paused',agentRevision:0}},{agent:{updatedAt:5}}])assert.equal(await deliverContext({set:async()=>{touched=true}}, {...ctx,...patch},{appendContext:async()=>{touched=true}}),undefined);
 assert.equal(touched,false);
});
test('provider context controls validate destination and send non-speaking context only',async()=>{
 const env={VERCEL_ENV:'preview',CALLERCORE_VOICE_PREVIEW_ENABLED:'true',VAPI_PRIVATE_KEY:'fixture'};let payload,count=0;
 const provider=createProvider({env,fetchImpl:async(url,options)=>{count++;payload=JSON.parse(options.body);return {ok:true,json:async()=>({status:'ok'})}}});
 for(const url of ['https://evil.test/call_one/control','https://api.vapi.ai/call_two/control','https://api.vapi.ai/call_one/control?secret=x'])await assert.rejects(provider.appendContext({id:'call_one',monitor:{controlUrl:url}},'Hours'));
 assert.equal(count,0);assert.deepEqual(await provider.appendContext({id:'call_one',monitor:{controlUrl:'https://api.vapi.ai/call_one/control'}},'Verified hours'),{submitted:true});assert.deepEqual(payload,{type:'append-context',kind:'thinking',content:'Verified hours'});
});
