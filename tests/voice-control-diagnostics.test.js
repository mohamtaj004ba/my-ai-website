const test=require('node:test'),assert=require('node:assert/strict');
const {shape,inspectControl}=require('../lib/voice-control-diagnostics');
test('diagnostic handler requires current admin role, Preview and fail-closed rate admission',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 for(const kind of ['client','admin-view','limited','production','admin']){
  let inspected=0,rateCalls=0,code,result;
  const context=vm.createContext({module:{exports:{}},URL,Buffer,process:{env:{}},require(path){
   if(path==='../lib/auth')return {requireSession:async()=>({role:'admin',email:'owner@example.test',workspaceId:'home',adminView:kind==='admin-view'})};
   if(path==='../lib/kv')return {kv:{get:async()=>({role:kind==='client'?'client':'admin'})}};
   if(path==='../lib/voice-provider')return {...require('../lib/voice-provider'),previewGate:()=>{if(kind==='production')throw new (require('../lib/voice-provider').VoiceError)('VOICE_LAUNCH_GATED')},createProvider:()=>({})};
   if(path==='../lib/rate-limit')return {rateLimit:async()=>{rateCalls++;return {limited:kind==='limited'}}};
   if(path==='../lib/voice-control-diagnostics')return {inspectControl:async()=>{inspected++;return {issue:'none'}}};
   if(path.startsWith('../lib/'))return require(path);
   return require(path);
  }});
  vm.runInContext(fs.readFileSync('api/voice.js','utf8'),context);
  await context.module.exports({method:'GET',query:{action:'call-control-diagnostics',workspaceId:'tenant',callId:'voice_one'},headers:{}},{setHeader(){},status(n){code=n;return this},json(v){result=v;return v}});
  if(['client','admin-view'].includes(kind)){assert.equal(code,403);assert.equal(rateCalls,0)}
  else if(kind==='limited')assert.equal(code,429);
  else if(kind==='production')assert.notEqual(code,200);
  else {assert.equal(code,200);assert.equal(result.diagnostics.issue,'none')}
  assert.equal(inspected,kind==='admin'?1:0);
 }
});
test('control diagnostics return only safe shapes, never private URL components',()=>{
 const call={id:'call_one',monitor:{controlUrl:'https://aws-us-west-2-production1-phone-call-websocket.vapi.ai/call_one/control'}};
 assert.equal(shape(call).issue,'none');
 for(const [url,issue] of [['https://evil.test/call_one/control','host'],['https://api.vapi.ai/private-token/control','path'],['https://user:private-token@api.vapi.ai/call_one/control','userinfo'],['https://api.vapi.ai/call_one/control?secret=private-token','query']]){
  const result=shape({...call,monitor:{controlUrl:url}});assert.equal(result.issue,issue);assert.ok(!JSON.stringify(result).includes('private-token'));assert.ok(!JSON.stringify(result).includes('evil.test'));
 }
 assert.equal(shape({id:'call_one'}).issue,'missing_or_malformed');
});
test('diagnosis verifies canonical workspace and provider ownership before returning shapes',async()=>{
 const values={'workspace:tenant':{voiceTestWorkspace:true},'voice:call:voice_one':{workspaceId:'tenant',assistantId:'assistant_one',numberId:'number_one',providerCallId:'call_one'},'voice:config:tenant':{assistantId:'assistant_one',numberId:'number_one'}};
 const kv={get:async k=>structuredClone(values[k])};let reads=0;
 const provider={retrieveCall:async()=>{reads++;return {id:'call_one',assistantId:'assistant_one',phoneNumberId:'number_one',monitor:{controlUrl:'https://api.vapi.ai/call_one/control'}}}};
 assert.equal((await inspectControl(kv,'tenant','voice_one',provider)).issue,'none');assert.equal(reads,1);
 values['voice:call:voice_one'].workspaceId='other';await assert.rejects(inspectControl(kv,'tenant','voice_one',provider),{code:'VOICE_ASSOCIATION_INVALID'});assert.equal(reads,1);
 values['voice:call:voice_one'].workspaceId='tenant';values['workspace:tenant'].stripeCustomerId='live';await assert.rejects(inspectControl(kv,'tenant','voice_one',provider),{code:'VOICE_WORKSPACE_INVALID'});assert.equal(reads,1);
 delete values['workspace:tenant'].stripeCustomerId;
 await assert.rejects(inspectControl(kv,'tenant','voice_one',{retrieveCall:async()=>({id:'call_one',assistantId:'other',phoneNumberId:'number_one'})}),{code:'VOICE_ASSOCIATION_INVALID'});
});
