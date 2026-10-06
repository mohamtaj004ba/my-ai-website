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
function memory(){
  const values=new Map([['workspace:tenant',{id:'tenant',name:'Test service business',voiceTestWorkspace:true,usage:{minutes:0}}],['voice:binding:assistant_test',structuredClone(binding)],['voice:number:number_test',structuredClone(binding)],['voice:config:tenant',{policy,purpose:'internal',assistantId:'assistant_test',numberId:'number_test',state:'ready',revision:1,agentRevision:0}],['agent:tenant',{}]]);
  let conflict=0;
  return {values,setConflict(n){conflict=n},async get(k){return structuredClone(values.get(k)??null)},async set(k,v,opts){if(opts?.nx&&values.has(k))return null;values.set(k,structuredClone(v));return 'OK'},async eval(script,keys,args){
    assert.equal(script,CONFIG_COMPARE_AND_AUDIT_BATCH);if(conflict-->0)return 0;
    const count=Number(args[0]);for(let i=0;i<count;i++)if((values.has(keys[i])?JSON.stringify(values.get(keys[i])):'')!==args[i*2+1])return 0;
    const history=values.get(keys[count])||[];if(!Array.isArray(history))throw new Error('Corrupt audit');
    const event=JSON.parse(args[count*2+1]);for(let i=0;i<count;i++)values.set(keys[i],JSON.parse(args[i*2+2]));values.set(keys[count],[event,...history].slice(0,200));return 1;
  }};
}
function provider(current={...call}){return {retrieveCall:async()=>current,transfer:async()=>({state:'requested',connected:false})}}
function message(name,args,id='tool_test'){return {type:'tool-calls',call:{id:'call_test'},toolCallList:[{id,function:{name,arguments:args}}]}}
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
  assert.match(p.speaker,/Cedar Office/);assert.match(p.speaker,/Interruption policy/);assert.match(p.speaker,/silently prefix \+1/);assert.match(p.reasoner,/normalize a confirmed US or Canadian ten-digit/);assert.match(p.speaker,/caller interrupts before it is delivered/);assert.match(p.reasoner,/untrusted data/);assert.match(p.reasoner,/never confirmed bookings/);assert.match(p.reasoner,/demo\/test/);
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
  const context=vm.createContext({module:{exports:{}},URL,Buffer,process:{env},require(path){if(path==='crypto')return require('crypto');if(path==='../lib/auth')return {requireSession:async()=>session};if(path==='../lib/kv')return {kv};if(path==='../lib/rate-limit')return {rateLimit:async()=>({limited:false})};if(path==='../lib/voice-provider')return {...require('../lib/voice-provider'),previewGate:()=>{}};return require(path.replace('../lib/','../lib/'))}});
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
