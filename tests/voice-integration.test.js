const test=require('node:test'),assert=require('node:assert/strict');
const {validatePolicy,hoursAt,prompts}=require('../lib/voice-policy');
const {authenticated,previewGate,normalizedCall,createProvider}=require('../lib/voice-provider');
const {argumentsFor,INTENTS}=require('../lib/voice-tools');
const {ingest,mutateCall}=require('../lib/voice-store');
const {processMessage,configure,control,safeStatus}=require('../lib/voice-service');
const {CONFIG_COMPARE_AND_AUDIT_BATCH}=require('../lib/config-transaction');
const env={VERCEL_ENV:'preview',CALLERCORE_VOICE_PREVIEW_ENABLED:'true',VAPI_PRIVATE_KEY:'fixture',VAPI_INTERNAL_NUMBER_ID:'number_test',VAPI_INTERNAL_ASSISTANT_ID:'assistant_test',VAPI_DEMO_NUMBER_ID:'number_demo',VAPI_DEMO_ASSISTANT_ID:'assistant_demo',VAPI_SERVER_CREDENTIAL_ID:'credential',CALLERCORE_VOICE_WEBHOOK_SECRET:'x'.repeat(32),CALLERCORE_VOICE_CALLBACK_URL:'https://example.vercel.app/api/voice-webhook'};
const policy=validatePolicy({timezone:'America/Los_Angeles',schedule:[{day:1,open:540,close:1020}],services:['Repair'],faqs:['Office hours are 9–5 on Monday.'],afterHours:'capture',transferNumber:'+15095550100'});
const call={id:'call_test',assistantId:'assistant_test',phoneNumberId:'number_test',status:'in-progress',startedAt:'2026-10-05T16:00:00Z',customer:{number:'+15095550101'},artifact:{messages:[]}};
const binding={workspaceId:'tenant',purpose:'internal',numberId:'number_test',provider:'vapi',agentName:'Maya'};
test('read-back verification recovers an uncertain sync only when settings and routing match',async()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  for(const fault of ['none','routing','settings','revision']){
    const kv=memory();kv.values.set('user:email:owner@example.test',{role:'admin'});
    Object.assign(kv.values.get('voice:config:tenant'),{state:'error',errorCode:'VOICE_PROVIDER_TIMEOUT'});
    if(fault==='revision')kv.values.set('agent:tenant',{updatedAt:1});
    const desired=createProvider({env}).assistantConfig(kv.values.get('workspace:tenant'),{},policy);
    const live=structuredClone(desired);if(fault==='settings')live.model.speaker.instructions='outdated';
    const context=vm.createContext({module:{exports:{}},URL,Buffer,process:{env},require(path){
      if(path==='crypto')return require('crypto');
      if(path==='../lib/auth')return {requireSession:async()=>({role:'admin',workspaceId:'tenant',email:'owner@example.test'})};
      if(path==='../lib/kv')return {kv};
      if(path==='../lib/rate-limit')return {rateLimit:async()=>({limited:false})};
      if(path==='../lib/voice-provider')return {...require('../lib/voice-provider'),previewGate:()=>{},createProvider:()=>({assistantConfig:()=>desired,retrieveAgent:async()=>live,retrieveNumber:async()=>({assistantId:fault==='routing'?'other':'assistant_test'})})};
      if(path==='../lib/voice-service')return {...require('../lib/voice-service'),safeStatus:r=>safeStatus(r,env)};
      return require(path);
    }});
    vm.runInContext(fs.readFileSync('api/voice.js','utf8'),context);let code,result;
    await context.module.exports({method:'POST',headers:{host:'preview.vercel.app',origin:'https://preview.vercel.app'},query:{action:'verify'},body:{}},{setHeader(){},status(n){code=n;return this},json(v){result=v;return v}});
    const record=kv.values.get('voice:config:tenant');
    if(fault==='none'){assert.equal(code,200);assert.equal(result.voice.state,'ready');assert.equal(record.errorCode,undefined);assert.equal(record.revision,1)}
    else {assert.equal(code,503);assert.equal(record.state,'error');assert.equal(record.verifiedAt,null)}
  }
});
function memory(){
  const values=new Map([['workspace:tenant',{id:'tenant',name:'Test service business',voiceTestWorkspace:true,usage:{minutes:0}}],['voice:binding:assistant_test',structuredClone(binding)],['voice:number:number_test',structuredClone(binding)],['voice:config:tenant',{policy,purpose:'internal',assistantId:'assistant_test',numberId:'number_test',state:'ready',revision:1,agentRevision:0}],['agent:tenant',{}]]);
  let conflict=0;
  return {values,setConflict(n){conflict=n},async get(k){return structuredClone(values.get(k)??null)},async set(k,v,opts){if(opts?.nx&&values.has(k))return null;values.set(k,structuredClone(v));return 'OK'},async eval(script,keys,args){
    if(script===require('../lib/voice-reconcile').RELEASE){if(values.get(keys[0])===args[0]){values.delete(keys[0]);return 1}return 0}
    assert.equal(script,CONFIG_COMPARE_AND_AUDIT_BATCH);if(conflict-->0)return 0;
    const count=Number(args[0]);for(let i=0;i<count;i++)if((values.has(keys[i])?JSON.stringify(values.get(keys[i])):'')!==args[i*2+1])return 0;
    const history=values.get(keys[count])||[];if(!Array.isArray(history))throw new Error('Corrupt audit');
    const event=JSON.parse(args[count*2+1]);for(let i=0;i<count;i++)values.set(keys[i],JSON.parse(args[i*2+2]));values.set(keys[count],[event,...history].slice(0,200));return 1;
  }};
}
function provider(current={...call}){return {retrieveCall:async()=>current,transfer:async()=>({state:'requested',connected:false})}}
function message(name,args,id='tool_test'){return {type:'tool-calls',call:{id:'call_test'},toolCallList:[{id,function:{name,arguments:args}}]}}

test('classic internal comparison preserves authenticated tools and rejects provider drift',()=>{
  const p=createProvider({env}),w={id:'tenant',name:'Test service business'};
  const live=p.assistantConfig(w,{},policy),classic=p.assistantConfig(w,{},policy,{pipeline:'classic-comparison'});
  assert.equal(live.model.model,'gpt-live-1');assert.equal(classic.model.model,'gpt-4.1-mini');
  assert.deepEqual(classic.model.tools,live.model.tools);assert.deepEqual(classic.server,live.server);
  assert.equal(classic.artifactPlan.recordingEnabled,false);assert.equal(classic.model.speaker,undefined);
  assert.equal(classic.voice.voiceId,'Elliot');assert.equal(classic.stopSpeakingPlan.voiceSeconds,0.2);
  assert.throws(()=>p.assistantConfig(w,{},policy,{demo:true,pipeline:'classic-comparison'}),{code:'VOICE_PIPELINE_INVALID'});
  const matches=require('../lib/voice-provider').agentMatches;
  assert.equal(matches(classic,classic),true);
  const normalized=structuredClone(classic);normalized.voice.version='2';assert.equal(matches(normalized,classic),true);
  for(const version of ['02','2.0',null,undefined,1,'1']){const drift=structuredClone(classic);drift.voice.version=version;assert.equal(matches(drift,classic),false)}
  for(const mutate of [c=>c.transcriber.model='other',c=>c.voice.version=1,c=>c.stopSpeakingPlan.voiceSeconds=1,c=>c.startSpeakingPlan.smartEndpointingPlan={provider:'livekit'},c=>c.model.messages[0].content='stale',c=>c.model.reasoner=live.model.reasoner,c=>c.model.tools.pop(),c=>c.server.credentialId='other']){
    const drift=structuredClone(classic);mutate(drift);assert.equal(matches(drift,classic),false);
  }
});
test('classic configuration persists through resume, skips GPT-Live context and retains replay protections',async()=>{
  const kv=memory(),real=createProvider({env});let desired,options,submissions=0;
  const p={...provider(),assistantConfig(w,a,b,o){options=o;return real.assistantConfig(w,a,b,o)},retrieveNumber:async()=>({assistantId:'assistant_test'}),configureAgent:async(id,c)=>{desired=c},retrieveAgent:async()=>desired,connectNumber:async()=>{},resumeNumber:async()=>{},appendContext:async()=>{submissions++;return {submitted:true}}};
  const actor={email:'owner@example.test',role:'admin'};
  const status=await configure(kv,'tenant',{policy,expectedRevision:1,pipeline:'classic-comparison'},actor,{env,provider:p});
  assert.equal(status.pipeline,'classic-comparison');assert.equal(options.pipeline,'classic-comparison');
  await assert.rejects(configure(kv,'tenant',{policy,expectedRevision:2,purpose:'demo',pipeline:'classic-comparison'},actor,{env,provider:p}),{code:'VOICE_PIPELINE_INVALID'});
  await processMessage(kv,{type:'status-update',call:{id:'call_test'}},{provider:p});assert.equal(submissions,0);
  const item=message('save_call_request',{confirmed:true,reason:'Repair request',intent:'new_service',name:'Test Caller'});
  const first=await processMessage(kv,item,{provider:p}),again=await processMessage(kv,item,{provider:p});assert.deepEqual(first,again);
  kv.values.set('voice:config:tenant',{...kv.values.get('voice:config:tenant'),state:'paused',fallbackNumber:'+15095550100'});
  p.retrieveNumber=async()=>({assistantId:null,fallbackDestination:{number:'+15095550100'}});
  p.resumeNumber=async()=>{p.retrieveNumber=async()=>({assistantId:'assistant_test'})};
  const resumed=await control(kv,'tenant',{paused:false,expectedRevision:2},actor,{env,provider:p});
  assert.equal(resumed.pipeline,'classic-comparison');assert.equal(options.pipeline,'classic-comparison');
});

test('authenticated active lifecycle submits call context once and records its truthful state',async()=>{
  const kv=memory();let submissions=0;
  const p={...provider(),appendContext:async()=>{submissions++;return {submitted:true}}};
  const event={type:'status-update',call:{id:'call_test'}};
  await processMessage(kv,event,{provider:p});await processMessage(kv,event,{provider:p});
  assert.equal(submissions,1);const record=[...kv.values].find(([key])=>key.startsWith('voice:call:'))[1];
  assert.equal(record.workspaceId,'tenant');assert.equal(record.speakerContextState,'submitted');assert.equal(record.status,'active');
});
test('authenticated active callback tolerates lagged REST state but never revives ended calls',async()=>{
 for(const status of ['queued','ringing','ended']){
  const kv=memory();let submissions=0;
  const current={...call,status,...(status==='ended'?{endedAt:'2026-10-05T16:01:00Z'}:{})};
  const p={...provider(current),appendContext:async()=>{submissions++;return {submitted:true}}};
  await processMessage(kv,{type:'status-update',status:'in-progress',call:{id:'call_test'}},{provider:p});
  assert.equal(submissions,status==='ended'?0:1);
 }
});
test('hours lookup returns verified call-wide state without waiting for live context or creating leads',async()=>{
 const kv=memory();let submissions=0;
 const p={...provider(),appendContext:async()=>{submissions++;return {submitted:true}}};
 const event=message('check_after_hours_policy',{});
 const result=await processMessage(kv,event,{provider:p});await processMessage(kv,event,{provider:p});
 assert.equal(submissions,0);assert.equal((await kv.get('voice:call:'+normalizedCall(call).id)).speakerContextState,undefined);
 const hours=JSON.parse(result.results[0].result);assert.equal(typeof hours.open,'boolean');assert.equal(typeof hours.validAcrossCall,'boolean');assert.equal(hours.appointmentAvailability,'unknown; no calendar access');
 assert.equal((await kv.get('leads:tenant'))?.length||0,0);
});
test('ending a call never waits for an unrelated missed hours-context submission',async()=>{
 const kv=memory();let submissions=0;
 const p={...provider(),appendContext:async()=>{submissions++;return {submitted:true}}};
 const result=await processMessage(kv,message('complete_call',{disposition:'resolved_by_ai',summary:'Answered service area; explicit goodbye'}),{provider:p});
 assert.equal(submissions,0);assert.equal(JSON.parse(result.results[0].result).status,'recorded');
});

test('delayed recovery runs the actual canonical processor without duplicate CRM or usage',async()=>{
  const kv=memory(),ended={...call,status:'ended',endedAt:'2026-10-05T16:01:30Z',artifact:{messages:[]}};
  await processMessage(kv,{type:'end-of-call-report',call:{id:call.id}},{provider:provider(ended)});
  const id=require('../lib/voice-policy').revision(call.id),canonicalId='voice_'+id.slice(0,24);
  const later={...ended,artifact:{messages:[{role:'user',message:'Just checking the office hours.'},{role:'assistant',message:'We open at nine.'}]}};
  const process=(store,event)=>processMessage(store,event,{provider:provider(later)});
  await require('../lib/voice-reconcile').reconcile(kv,'tenant',{process});
  await require('../lib/voice-reconcile').reconcile(kv,'tenant',{process});
  assert.equal(kv.values.get('calls:tenant').length,1);assert.equal(kv.values.get('workspace:tenant').usage.voiceMinutes,1.5);
  assert.equal(kv.values.get('voice:call:'+canonicalId).transcriptState,'available');assert.deepEqual(kv.values.get('voice:pending:tenant'),{});assert.equal(kv.values.get('voice:recovery:tenant').state,'idle');
});
test('interactive provider reads retry transient failures but never access denial or rate limits',async()=>{
  for(const failure of ['timeout',503,401,429,'malformed']){
    let reads=0;const p=createProvider({env,fetchImpl:async()=>{reads++;if(reads===1){if(failure==='timeout')throw Object.assign(new Error('timeout'),{name:'AbortError'});if(failure==='malformed')return {ok:true,status:200,json:async()=>{throw new SyntaxError('bad provider JSON')}};return {ok:false,status:failure}}return {ok:true,status:200,json:async()=>call}}});
    if(failure==='timeout'||failure===503){assert.equal((await p.retrieveCall('call_test',{interactive:true})).id,'call_test');assert.equal(reads,2)}
    else {await assert.rejects(p.retrieveCall('call_test',{interactive:true}));assert.equal(reads,1)}
  }
});
test('verified assistant requires lifecycle callbacks and the intended reasoner effort',()=>{
  const {agentMatches}=require('../lib/voice-provider'),desired=createProvider({env}).assistantConfig({id:'tenant',name:'Cedar'},{},policy);
  const missing=structuredClone(desired);missing.serverMessages=['status-update','tool-calls'];assert.equal(agentMatches(missing,desired),false);
  const changed=structuredClone(desired);changed.model.reasoner.reasoningEffort='high';assert.equal(agentMatches(changed,desired),false);
  const extra=structuredClone(desired);extra.serverMessages.reverse();extra.serverMessages.push('speech-update');assert.equal(agentMatches(extra,desired),true);
});
test('interactive call verification has a bounded deadline and uncertain provider writes are never retried',async()=>{
  let reads=0;const p=createProvider({env,fetchImpl:async(_url,options)=>{reads++;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('timeout'),{name:'AbortError'})),{once:true}))}});
  const started=Date.now();await assert.rejects(p.retrieveCall('call_test',{interactive:true}),e=>e.code==='VOICE_PROVIDER_TIMEOUT');assert.equal(reads,2);assert.ok(Date.now()-started<4500);
  let writes=0;const writer=createProvider({env,fetchImpl:async()=>{writes++;throw Object.assign(new Error('timeout'),{name:'AbortError'})}});
  await assert.rejects(writer.configureAgent('assistant_test',{}),e=>e.code==='VOICE_PROVIDER_TIMEOUT');assert.equal(writes,1);
});
test('failed live call verification returns actionable tool errors without any CRM mutation',async()=>{
  const kv=memory(),before=JSON.stringify([...kv.values]);
  const p={retrieveCall:async(_id,options)=>{assert.equal(options.interactive,true);throw new (require('../lib/voice-provider').VoiceError)('VOICE_PROVIDER_TIMEOUT')}};
  const result=await processMessage(kv,message('save_call_request',{intent:'estimate',reason:'Repair',confirmed:true}),{provider:p});
  assert.equal(JSON.parse(result.results[0].error).code,'VOICE_CALL_CHECK_UNAVAILABLE');assert.equal(JSON.stringify([...kv.values]),before);
  const denied={retrieveCall:async()=>{throw new (require('../lib/voice-provider').VoiceError)('VOICE_ASSOCIATION_INVALID')}};
  await assert.rejects(processMessage(kv,message('save_call_request',{confirmed:true}),{provider:denied}),e=>e.code==='VOICE_ASSOCIATION_INVALID');
});
test('production and disabled Preview reject every provider operation',async()=>{
  for(const e of [{VERCEL_ENV:'production',CALLERCORE_VOICE_PREVIEW_ENABLED:'true'},{VERCEL_ENV:'preview'}]){
    assert.throws(()=>previewGate(e));let called=false;const p=createProvider({env:e,fetchImpl:async()=>{called=true}});await assert.rejects(p.retrieveCall('a'));assert.equal(called,false);
  }
});
test('webhook authentication is constant-time, secret required and bearer exact',()=>{
  const secret='a'.repeat(32);assert.equal(authenticated({authorization:'Bearer '+secret},secret),true);
  for(const h of [{},{authorization:secret},{authorization:'Bearer '+secret+'x'},{authorization:'Bearer '+'a'.repeat(31)}])assert.equal(authenticated(h,secret),false);
  assert.equal(authenticated({authorization:'Bearer x'},'x'),false);
});
test('structured hours respect timezone, DST, weekend and holiday',()=>{
  assert.equal(hoursAt(policy,Date.parse('2026-10-05T16:00:00Z')).open,true);
  assert.equal(hoursAt(policy,Date.parse('2026-10-05T15:59:00Z')).open,false);
  assert.equal(hoursAt(policy,Date.parse('2026-10-06T00:00:00Z')).open,false);
  assert.equal(hoursAt({...policy,holidays:['2026-10-05']},Date.parse('2026-10-05T16:00:00Z')).open,false);
  assert.equal(hoursAt(policy,Date.parse('2026-11-02T17:00:00Z')).open,true);
});
test('invalid hours, destinations, recording, policies fail closed',()=>{
  for(const patch of [{timezone:'bad'},{schedule:[{day:1,open:100,close:0}]},{transferNumber:'911'},{recordingEnabled:true},{unknown:true},{afterHours:'guess'},{maxDurationSeconds:99999}])assert.throws(()=>validatePolicy({...policy,...patch}));
});
test('prompts are workspace-specific and enforce truthful tools, correction and privacy',()=>{
  const p=prompts({name:'Cedar Office'},{name:'Ava',openingMessage:'Welcome to Cedar'},policy,{demo:true});
  assert.match(p.speaker,/Cedar Office/);assert.match(p.speaker,/Interruption policy/);assert.match(p.speaker,/offer a useful action you actually can take/);assert.match(p.reasoner,/normalize a confirmed US or Canadian ten-digit/);assert.match(p.speaker,/caller interrupts before it is delivered/);assert.match(p.reasoner,/untrusted data/);assert.match(p.reasoner,/never confirmed bookings/);assert.match(p.reasoner,/demo\/test/);
});
test('strict tool schemas reject cross-tenant IDs and private-history requests',()=>{
  for(const args of [{workspaceId:'victim'},{contactId:'victim'},{__proto__:null,unknown:'x'}])assert.throws(()=>argumentsFor('get_business_profile',args));
  assert.throws(()=>argumentsFor('get_customer_history',{}));assert.throws(()=>argumentsFor('save_call_request',{intent:'service',reason:'Repair',confirmed:'true'}));
});
test('untrusted webhook workspace/assistant cannot change provider association',async()=>{
  const kv=memory();const m={type:'status-update',workspaceId:'victim',call:{...call,assistantId:'victim'}};
  await processMessage(kv,m,{provider:provider()});assert.equal(kv.values.get('calls:tenant').length,1);assert.equal(kv.values.has('calls:victim'),false);
  await assert.rejects(processMessage(kv,m,{provider:provider({...call,phoneNumberId:'another'})}));
});
for(const intent of INTENTS)test('canonical '+intent+' request, replay and CRM behavior',async()=>{
  const kv=memory(),m=message('save_call_request',{intent,reason:'Caller request',name:'Sam',callbackNumber:'+15095550101',confirmed:true});
  const first=await processMessage(kv,m,{provider:provider()}),again=await processMessage(kv,m,{provider:provider()});assert.deepEqual(first,again);
  assert.equal(kv.values.get('calls:tenant').length,1);assert.equal(kv.values.get('leads:tenant').length,['service','estimate'].includes(intent)?1:0);
  const end={...call,status:'ended',endedAt:'2026-10-05T16:02:30Z'};
  await processMessage(kv,{type:'end-of-call-report',call:{id:call.id}},{provider:provider(end)});
  const usage=kv.values.get('voice:usage:tenant');assert.equal(Object.keys(usage.calls).length,1);assert.equal(usage.calls[normalizedCall(call).id].seconds,150);assert.equal(usage.overageEnabled,false);
  await processMessage(kv,{type:'end-of-call-report',call:{id:call.id}},{provider:provider(end)});assert.deepEqual(kv.values.get('voice:usage:tenant'),usage);
});
test('caller correction updates one lead and contact without duplicate mutation',async()=>{
  const kv=memory();for(const [id,reason] of [['one','Boiler'],['two','Water heater']])await processMessage(kv,message('save_call_request',{intent:'service',reason,name:'Sam',confirmed:true},id),{provider:provider()});
  assert.equal(kv.values.get('leads:tenant').length,1);assert.equal(kv.values.get('leads:tenant')[0].service,'Water heater');assert.equal(kv.values.get('voice:contacts:tenant').length,1);
});
test('same caller across different calls matches one canonical contact',async()=>{
  const kv=memory();await ingest(kv,binding,normalizedCall(call));await ingest(kv,binding,normalizedCall({...call,id:'another_call'}));
  assert.equal(kv.values.get('voice:contacts:tenant').length,1);assert.equal(kv.values.get('calls:tenant').length,2);
});
test('delayed start cannot undo ended call or erase transcript/summary',async()=>{
  const kv=memory(),end=normalizedCall({...call,status:'ended',endedAt:'2026-10-05T16:01:00Z',artifact:{messages:[{role:'user',message:'Help'}]},analysis:{summary:'Request'}});
  await ingest(kv,binding,end);await ingest(kv,binding,normalizedCall(call));const saved=kv.values.get('voice:call:'+end.id);
  assert.equal(saved.status,'ended');assert.equal(saved.durationSeconds,60);assert.equal(saved.transcript[0].text,'Help');assert.equal(saved.summary,'Request');
  assert.deepEqual(kv.values.get('calls:tenant')[0].transcript,[['Caller','Help']]);
});
test('missing transcript remains pending, delayed artifact fills it without extra usage',async()=>{
  const kv=memory(),end={...call,status:'ended',endedAt:'2026-10-05T16:01:00Z'};await ingest(kv,binding,normalizedCall(end));assert.equal(kv.values.get('calls:tenant')[0].transcriptState,'pending');
  await ingest(kv,binding,normalizedCall({...end,artifact:{messages:[{role:'assistant',message:'Hello'}]}}));assert.equal(kv.values.get('calls:tenant')[0].transcriptState,'available');assert.equal(kv.values.get('workspace:tenant').usage.voiceMinutes,1);
});
test('failed call without connected start is preserved, not billed as guessed minutes',async()=>{
  const kv=memory(),n=normalizedCall({...call,startedAt:null,status:'ended',endedAt:'2026-10-05T16:01:00Z',endedReason:'pipeline-error'});await ingest(kv,binding,n);
  assert.equal(kv.values.get('calls:tenant').length,1);assert.equal(kv.values.get('workspace:tenant').usage.voiceMinutes,0);assert.equal(kv.values.get('calls:tenant')[0].durationSeconds,null);
});
test('atomic conflicts retry; repeated failure leaves all CRM and usage unchanged',async()=>{
  const kv=memory();kv.setConflict(2);await ingest(kv,binding,normalizedCall(call));assert.equal(kv.values.get('calls:tenant').length,1);
  const before=structuredClone([...kv.values]);kv.setConflict(5);await assert.rejects(mutateCall(kv,binding,normalizedCall(call),'new',r=>{r.summary='New';return {ok:true}}));assert.deepEqual([...kv.values],before);
});
test('paused agent, stale config, caller hangup and missing confirmation block mutations',async()=>{
  for(const variant of ['paused','stale','ended','unconfirmed']){
    const kv=memory();if(variant==='paused')kv.values.get('voice:config:tenant').state='paused';if(variant==='stale')kv.values.set('agent:tenant',{updatedAt:5});
    const c=variant==='ended'?{...call,status:'ended',endedAt:'2026-10-05T16:01:00Z'}:call;
    const r=await processMessage(kv,message('save_call_request',{intent:'service',reason:'Repair',confirmed:variant!=='unconfirmed'}),{provider:provider(c)});assert.ok(r.results[0].error);assert.equal(kv.values.get('leads:tenant').length,0);
  }
});
test('answered FAQ disposition remains truthful without creating a follow-up or lead',async()=>{
  const kv=memory();await processMessage(kv,message('complete_call',{disposition:'resolved_by_ai',summary:'Office hours answered.'}),{provider:provider()});await ingest(kv,binding,normalizedCall({...call,status:'ended',endedAt:'2026-10-05T16:01:00Z'}));assert.equal(kv.values.get('calls:tenant')[0].outcome,'Resolved');assert.equal(kv.values.get('leads:tenant').length,0);
});
test('transfer failure is recorded and never reported as connected',async()=>{
  const kv=memory();kv.values.get('voice:config:tenant').policy={...policy,afterHours:'transfer'};
  const p={...provider(),transfer:async()=>{throw new Error('failed')}};
  const r=await processMessage(kv,message('transfer_call',{confirmed:true}),{provider:p});assert.equal(JSON.parse(r.results[0].result).state,'failed');assert.equal(JSON.parse(r.results[0].result).connected,false);
  const again=await processMessage(kv,message('transfer_call',{confirmed:true},'different'),{provider:p});assert.equal(JSON.parse(again.results[0].result).state,'already_requested');
});
test('demo cannot transfer and cannot bind a paying/private workspace',async()=>{
  const kv=memory();kv.values.get('voice:binding:assistant_test').purpose='demo';kv.values.get('voice:config:tenant').purpose='demo';
  const r=await processMessage(kv,message('transfer_call',{confirmed:true}),{provider:provider()});assert.ok(r.results[0].error);
  kv.values.get('workspace:tenant').stripeCustomerId='customer';await assert.rejects(configure(kv,'tenant',{policy,purpose:'demo',expectedRevision:1,numberId:'number_test',assistantId:'assistant_test'},{email:'admin',role:'admin'},{env,provider:provider()}));
});
test('configuration read-back mismatch leaves error, never ready',async()=>{
  const kv=memory(),p={retrieveNumber:async()=>({assistantId:'assistant_test'}),assistantConfig:()=>({model:{speaker:{instructions:'speaker'},reasoner:{instructions:'reasoner'}},server:{url:'url',credentialId:'cred'}}),configureAgent:async()=>({}),retrieveAgent:async()=>({model:{model:'wrong'}})};
  await assert.rejects(configure(kv,'tenant',{policy,purpose:'internal',expectedRevision:1,numberId:'number_test',assistantId:'assistant_test'},{email:'admin',role:'admin'},{env,provider:p}));assert.equal(kv.values.get('voice:config:tenant').state,'error');
});
test('pause is provider-backed and a failed read-back never claims paused',async()=>{
  const kv=memory(),p={retrieveNumber:async()=>({assistantId:'assistant_test'}),pauseNumber:async()=>({})};
  await assert.rejects(control(kv,'tenant',{paused:true,expectedRevision:1,fallbackNumber:'+15095550100'},{email:'owner',role:'owner'},{env,provider:p}));assert.equal(kv.values.get('voice:config:tenant').state,'error');
});
test('resume verifies the full assistant before reconnecting and after read-back',async()=>{
  const kv=memory(),record=kv.values.get('voice:config:tenant');Object.assign(record,{state:'paused',fallbackNumber:'+15095550100'});
  const adapter=createProvider({env}),desired=adapter.assistantConfig(kv.values.get('workspace:tenant'),{},policy);let resumes=0,reads=0;
  const p={assistantConfig:adapter.assistantConfig,retrieveNumber:async()=>resumes?{assistantId:'assistant_test'}:{assistantId:null,fallbackDestination:{number:record.fallbackNumber}},retrieveAgent:async()=>{reads++;return desired},resumeNumber:async()=>{resumes++}};
  const result=await control(kv,'tenant',{paused:false,expectedRevision:1},{email:'owner',role:'owner'},{env,provider:p});
  assert.equal(resumes,1);assert.equal(reads,2);assert.equal(result.state,'ready');assert.equal(kv.values.get('voice:config:tenant').state,'ready');
});
test('resume refuses stale assistant or workspace revision before touching phone routing',async()=>{
  for(const fault of ['assistant','revision']){
    const kv=memory(),record=kv.values.get('voice:config:tenant');Object.assign(record,{state:'paused',fallbackNumber:'+15095550100'});
    const adapter=createProvider({env}),desired=adapter.assistantConfig(kv.values.get('workspace:tenant'),{},policy);let resumes=0;
    if(fault==='assistant')desired.model.speaker.instructions='unverified change';else kv.values.set('agent:tenant',{updatedAt:1});
    const p={assistantConfig:adapter.assistantConfig,retrieveNumber:async()=>({assistantId:null,fallbackDestination:{number:record.fallbackNumber}}),retrieveAgent:async()=>desired,resumeNumber:async()=>{resumes++}};
    await assert.rejects(control(kv,'tenant',{paused:false,expectedRevision:1},{email:'owner',role:'owner'},{env,provider:p}),e=>['VOICE_STALE_PROVIDER_STATE','VOICE_CONFIG_OUT_OF_SYNC'].includes(e.code));
    assert.equal(resumes,0);assert.equal(kv.values.get('voice:config:tenant').state,'paused');
  }
});
test('assistant drift during resume cannot be reported as verified readiness',async()=>{
  const kv=memory(),record=kv.values.get('voice:config:tenant');Object.assign(record,{state:'paused',fallbackNumber:'+15095550100'});
  const adapter=createProvider({env}),desired=adapter.assistantConfig(kv.values.get('workspace:tenant'),{},policy);let resumed=false;
  const p={assistantConfig:adapter.assistantConfig,retrieveNumber:async()=>resumed?{assistantId:'assistant_test'}:{assistantId:null,fallbackDestination:{number:record.fallbackNumber}},retrieveAgent:async()=>resumed?{...desired,backgroundSound:'office'}:desired,resumeNumber:async()=>{resumed=true}};
  await assert.rejects(control(kv,'tenant',{paused:false,expectedRevision:1},{email:'owner',role:'owner'},{env,provider:p}),e=>e.code==='VOICE_SYNC_UNVERIFIED');
  assert.equal(kv.values.get('voice:config:tenant').state,'error');assert.equal(safeStatus(kv.values.get('voice:config:tenant'),env).operational,false);
});
test('status cannot infer live from saved config; stale evidence needs recheck',()=>{
  assert.equal(safeStatus({state:'ready',verifiedAt:Date.now()-600000},env).operational,false);assert.equal(safeStatus({state:'ready',verifiedAt:Date.now()},env).operational,true);assert.equal(safeStatus({state:'ready',verifiedAt:Date.now()},{VERCEL_ENV:'production'}).operational,false);
});
test('Vapi GPT-Live config uses speaker/reasoner, saved credentials and recording off',()=>{
  const p=createProvider({env}),config=p.assistantConfig({id:'tenant',name:'Business'},{},policy);assert.equal(config.model.model,'gpt-live-1');assert.equal(config.model.reasoner.model,'gpt-5.6-terra');assert.equal(config.artifactPlan.recordingEnabled,false);assert.ok(config.firstMessage.startsWith(policy.disclosure));assert.ok(!config.transcriber);assert.equal(config.server.credentialId,'credential');assert.ok(!JSON.stringify(config).includes(env.CALLERCORE_VOICE_WEBHOOK_SECRET));
  const {agentMatches}=require('../lib/voice-provider');assert.equal(agentMatches(structuredClone(config),config),true);for(const change of [c=>c.model.tools=[],c=>c.maxDurationSeconds=999,c=>c.voice.voiceId='different',c=>c.firstMessage='Different greeting',c=>c.backgroundSound='office']){const changed=structuredClone(config);change(changed);assert.equal(agentMatches(changed,config),false)}
});
test('provider errors never include a raw response or secret',async()=>{
  const p=createProvider({env,fetchImpl:async()=>({ok:false,status:403,json:async()=>({secret:'do-not-leak'})})});await assert.rejects(p.retrieveCall('call'),e=>e.code==='VOICE_ACCESS_REQUIRED'&&!e.message.includes('do-not-leak'));
});
test('provider configuration fits the assistant name limit with real workspace IDs',()=>{
  const config=createProvider({env}).assistantConfig({id:'voice_test_c62327723c4e4495a120c6aba96a2a28',name:'Business'},{},policy);
  assert.ok(config.name.length<=40);
  assert.ok(config.name.startsWith('CallerCore internal '));
});
test('provider read-back accepts reordered tool object keys but rejects changed credentials',()=>{
  const config=createProvider({env}).assistantConfig({id:'tenant',name:'Business'},{},policy);
  assert.equal(config.voice.voiceId,'marin');
  const saved=structuredClone(config),reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;
  saved.model.tools=reorder(saved.model.tools);
  const {agentMatches}=require('../lib/voice-provider');
  assert.equal(agentMatches(saved,config),true);
  saved.model.tools[0].server.credentialId='wrong';
  assert.equal(agentMatches(saved,config),false);
});
test('secret patterns are removed from transcript and summary before canonical storage',()=>{
  const n=normalizedCall({...call,artifact:{messages:[{role:'user',message:'sk-test_abcdefghijklmnopqrstuvwxyz0123456789'}]},analysis:{summary:'Bearer abcdefghijklmnopqrstuvwxyz0123456789'}});
  assert.equal(n.transcript[0].text,'[redacted]');assert.equal(n.summary,'[redacted]');
});
test('repeated calls about the same unresolved request do not create another open lead',async()=>{
  const kv=memory();for(const c of [call,{...call,id:'second'}])await processMessage(kv,{...message('save_call_request',{intent:'service',reason:'Repair',confirmed:true}),call:{id:c.id}},{provider:provider(c)});
  assert.equal(kv.values.get('leads:tenant').length,1);assert.equal(kv.values.get('leads:tenant')[0].callIds.length,2);
  const anonymous=memory();for(const c of [{...call,id:'anonymous1',customer:{}},{...call,id:'anonymous2',customer:{}}])await processMessage(anonymous,{...message('save_call_request',{intent:'service',reason:'Repair',confirmed:true}),call:{id:c.id}},{provider:provider(c)});
  assert.equal(anonymous.values.get('leads:tenant').length,2,'Unknown callers must not be merged merely because their request matches');
});
test('missing artifacts stay in durable reconciliation queue and complete artifacts remove it',async()=>{
  const kv=memory(),end={...call,status:'ended',endedAt:'2026-10-05T16:01:00Z'};
  await ingest(kv,binding,normalizedCall(end));assert.equal(Object.keys(kv.values.get('voice:pending:tenant')).length,1);
  await ingest(kv,binding,normalizedCall({...end,artifact:{messages:[{role:'user',message:'Hello'}]}}));assert.equal(Object.keys(kv.values.get('voice:pending:tenant')).length,0);
});

test('old bindings cannot activate calls on a paying/customer workspace',async()=>{const kv=memory();kv.values.get('workspace:tenant').stripeCustomerId='customer';await assert.rejects(processMessage(kv,{type:'status-update',call:{id:call.id}},{provider:provider()}));assert.equal(kv.values.has('calls:tenant'),false)});
test('voice endpoint uses current membership and ignores cross-workspace IDs from clients',async()=>{
  const vm=require('node:vm'),fs=require('node:fs'),reads=[];let code,result;
  const kv={get:async k=>{reads.push(k);return k.startsWith('user:')?{role:'client'}:null}};
  const session={role:'admin',workspaceId:'tenant',email:'owner@example.test'};
  const context=vm.createContext({module:{exports:{}},URL,Buffer,process:{env},require(path){if(path==='crypto')return require('crypto');if(path==='../lib/auth')return {requireSession:async()=>session};if(path==='../lib/kv')return {kv};if(path==='../lib/rate-limit')return {rateLimit:async()=>({limited:false})};if(path==='../lib/voice-provider')return {...require('../lib/voice-provider'),previewGate:()=>{}};return require(path)}});
  vm.runInContext(fs.readFileSync('api/voice.js','utf8'),context);
  const res={setHeader(){},status(n){code=n;return this},json(v){result=v;return v}};
  await context.module.exports({method:'POST',headers:{host:'preview.vercel.app',origin:'https://preview.vercel.app'},query:{action:'configure',workspaceId:'victim'},body:{}},res);assert.equal(code,403);assert.equal(reads.includes('voice:config:victim'),false);
  reads.length=0;await context.module.exports({method:'GET',headers:{},query:{workspaceId:'victim'}},res);assert.equal(code,200);assert.equal(reads.includes('voice:config:tenant'),true);assert.equal(reads.includes('voice:config:victim'),false);assert.equal(result.operations,undefined);
  reads.length=0;await context.module.exports({method:'POST',headers:{host:'preview.vercel.app',origin:'https://preview.vercel.app'},query:{action:'verify',workspaceId:'victim'},body:{}},res);assert.equal(code,403);assert.equal(reads.some(k=>k.startsWith('voice:config:')),false);
});
test('voice endpoint rejects cross-origin changes before reading or mutating voice data',async()=>{
  const vm=require('node:vm'),fs=require('node:fs');let code;const context=vm.createContext({module:{exports:{}},URL,Buffer,process:{env},require(path){if(path==='crypto')return require('crypto');if(path==='../lib/auth')return {requireSession:async()=>({role:'admin',workspaceId:'tenant',email:'owner@example.test'})};if(path==='../lib/kv')return {kv:{get:async()=>assert.fail('Cross-origin request must stop before storage access')}};return require(path)}});
  vm.runInContext(fs.readFileSync('api/voice.js','utf8'),context);await context.module.exports({method:'POST',headers:{host:'preview.vercel.app',origin:'https://evil.example'},query:{action:'configure'},body:{}},{setHeader(){},status(n){code=n;return this},json(v){return v}});assert.equal(code,403);
});
test('public demo cannot expose a number from stored config without real-call acceptance evidence',async()=>{
  const {demoReadiness}=require('../lib/voice-demo'),kv=memory(),e={...env,CALLERCORE_DEMO_WORKSPACE_ID:'tenant',DEMO_PHONE_NUMBER:'+15095550100',VAPI_DEMO_NUMBER_ID:'number_test',VAPI_DEMO_ASSISTANT_ID:'assistant_test'};
  Object.assign(kv.values.get('workspace:tenant'),{demoVoiceWorkspace:true});Object.assign(kv.values.get('voice:config:tenant'),{purpose:'demo',verifiedAt:Date.now()});
  assert.equal((await demoReadiness(kv,e)).available,false);
  kv.values.set('voice:acceptance:tenant',{source:'seed',internalAcceptancePassed:true,demoAcceptancePassed:true,numberAbuseControlsVerified:true,disclosureReviewed:true,configRevision:1,callIds:['fake1','fake2','fake3']});assert.equal((await demoReadiness(kv,e)).available,false);
});

test('actual phone callback format failure is actionable and retry saves exactly once',async()=>{
 const kv=memory(),bad=await processMessage(kv,message('save_call_request',{intent:'estimate',reason:'Bathroom plumbing estimate',callbackNumber:'5095550142',confirmed:true}),{provider:provider()});
 const failure=JSON.parse(bad.results[0].error);assert.equal(failure.code,'VOICE_CALLBACK_FORMAT_INVALID');assert.match(failure.message,/international E.164/);assert.equal(kv.values.get('leads:tenant').length,0);
 const retry=message('save_call_request',{intent:'estimate',reason:'Bathroom plumbing estimate',callbackNumber:'+15095550142',confirmed:true},'corrected');
 const saved=await processMessage(kv,retry,{provider:provider()});assert.equal(JSON.parse(saved.results[0].result).status,'captured');await processMessage(kv,retry,{provider:provider()});assert.equal(kv.values.get('leads:tenant').length,1);
});
test('Vapi bot transcript turns survive normalization without exposing tool internals',()=>{
 const n=normalizedCall({...call,artifact:{messages:[{role:'bot',message:'Thanks for calling.'},{role:'user',message:'Office hours?'},{role:'tool_call_result',message:'internal'}]}});assert.deepEqual(n.transcript,[{speaker:'CallerCore',text:'Thanks for calling.'},{speaker:'Caller',text:'Office hours?'}]);
});
test('configured opening message always contains required disclosure',()=>{
 const c=createProvider({env}).assistantConfig({id:'test',name:'Cedar Office'},{openingMessage:'Welcome to Cedar.'},policy);assert.match(c.firstMessage,/Welcome to Cedar/);assert.ok(c.firstMessage.includes(policy.disclosure));
});

test('speaker has approved routine knowledge without a needless lookup handoff',()=>{const p=prompts({name:'Cedar Office'},{},policy);assert.match(p.speaker,/Office hours are 9–5 on Monday/);assert.match(p.speaker,/Answer routine questions.*directly/);assert.match(p.speaker,/whether the office is open right now/);assert.doesNotMatch(p.speaker,/Delegate business questions to/)});

 test('a confirmed correction preserves previously captured contact and address details',async()=>{
 const kv=memory();await processMessage(kv,message('save_call_request',{intent:'estimate',reason:'Kitchen sink leak',name:'Sam',callbackNumber:'+15095550142',address:'123 Example Lane',preferredTime:'Tomorrow afternoon',confirmed:true},'initial'),{provider:provider()});
 await processMessage(kv,message('save_call_request',{intent:'estimate',reason:'Bathroom sink leak',confirmed:true},'correction'),{provider:provider()});
 const saved=kv.values.get('leads:tenant');assert.equal(saved.length,1);assert.equal(saved[0].name,'Sam');assert.equal(saved[0].phone,'+15095550142');assert.equal(saved[0].address,'123 Example Lane');assert.equal(saved[0].service,'Bathroom sink leak');
 const record=kv.values.get('voice:call:'+normalizedCall(call).id);assert.equal(record.request.preferredTime,'Tomorrow afternoon');assert.equal(record.request.name,'Sam');
 });

 test('correcting a repeat call amends its associated open lead without creating a duplicate',async()=>{
 const kv=memory();for(const c of [call,{...call,id:'repeat'}])await processMessage(kv,{...message('save_call_request',{intent:'estimate',reason:'Kitchen sink leak',name:'Sam',confirmed:true},c.id),call:{id:c.id}},{provider:provider(c)});
 assert.equal(kv.values.get('leads:tenant').length,1);
 await processMessage(kv,{...message('save_call_request',{intent:'estimate',reason:'Bathroom sink leak',confirmed:true},'correct-repeat'),call:{id:'repeat'}},{provider:provider({...call,id:'repeat'})});
 const leads=kv.values.get('leads:tenant');assert.equal(leads.length,1);assert.equal(leads[0].service,'Bathroom sink leak');assert.equal(leads[0].callIds.length,2);
 });

 test('non-customer completion needs no intake and creates no lead or follow-up',async()=>{
  const kv=memory();await processMessage(kv,message('complete_call',{disposition:'non_customer',summary:'Wrong number; caller said goodbye.'}),{provider:provider()});
  await processMessage(kv,{type:'end-of-call-report',call:{id:call.id}},{provider:provider({...call,status:'ended',endedAt:'2026-10-05T16:00:25Z'})});
  const view=kv.values.get('calls:tenant')[0];assert.equal(view.disposition,'non_customer');assert.equal(view.category,'Non-customer');assert.equal(view.outcome,'Resolved');assert.equal(kv.values.get('leads:tenant').length,0);
 });



