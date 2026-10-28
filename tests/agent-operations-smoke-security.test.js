'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,hash}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const {SMOKE}=require('../lib/agent-operations-smoke');
const {approvalCheck,pilotAdapter,MODEL,PRICING}=require('../lib/agent-operations-pilot');
const {createHandler,trustedApproval}=require('../lib/agent-operations-api');
const {scopedBridge}=require('../scripts/agent-operations-launcher.cjs');
const {ORIGIN}=require('../scripts/agent-operations-preview-access.cjs');
function fixture(){let raw=null,now=Date.now();const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(raw!==a)return false;raw=b;return true;}},{clock:()=>now,scope:{origin:'https://smoke-security.vercel.app',commit:'a'.repeat(40)}});return {store,clock:()=>now,advance:ms=>now+=ms};}
function approval(f,id='security_smoke_123'){return {...PROJECT,id:'pilot_'+id,authorized:true,profile:SMOKE.profile,maxCalls:1,maxMicros:300000,scopeHash:hash(f.store.scope),expiresAt:f.clock()+300000,model:MODEL,pricingVersion:PRICING.version};}
async function create(f,a=approval(f)){const task=await f.store.create({principal:'offline-review',idempotencyKey:a.id,objective:SMOKE.objective,mode:'pilot',approval:a});return {task,a:{...a,taskId:task.id}};}
test('smoke approval binds immutable profile and exact limits; customer and Production cannot initialize',async()=>{
 const f=fixture(),{task,a}=await create(f);assert.doesNotThrow(()=>approvalCheck(a,task,f.clock()));
 for(const patch of [{profile:undefined},{profile:'unknown'},{maxCalls:2},{maxMicros:5000000}])assert.throws(()=>approvalCheck({...a,...patch},task,f.clock()));
 const env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify(a)};assert(trustedApproval(env,f.store.scope));assert.equal(trustedApproval({...env,VERCEL_ENV:'production'},f.store.scope),null);
 const call=async(environment,member)=>{let status;const h=createHandler({env:environment,store:f.store,getSession:async()=>({email:'customer@example.test',workspaceId:'w'}),getMember:async()=>member,rateLimit:async()=>({limited:false})});await h({method:'POST',headers:{host:'fixture.test',origin:'https://fixture.test'},body:{action:'initialize-smoke'}},{setHeader(){},status(n){status=n;return this;},json(){}});return status;};
 assert.equal(await call(env,{role:'customer',workspaceId:'w'}),403);assert.equal(await call({...env,VERCEL_ENV:'production'},{role:'admin',workspaceId:'w'}),503);
});
test('smoke server reserves once, rejects delegation and completes terminal Chief without advancing',async()=>{
 const f=fixture(),{task}=await create(f),c=await f.store.command(task.id,{type:'claim'});await f.store.command(task.id,{type:'reserve',fence:c.fence,executionId:'exec_smoke_security'});
 await assert.rejects(f.store.command(task.id,{type:'reserve',fence:c.fence,executionId:'exec_smoke_second'}),/Call limit/);
 const receipt={type:'finish',fence:c.fence,executionId:'exec_smoke_security',...PROJECT,model:MODEL,inputTokens:20,outputTokens:10,actualMicros:120};
 await assert.rejects(f.store.command(task.id,{...receipt,result:{stage:'chief',note:'SMOKE_OK',delegate:'website-visual-qa'}}),/smoke result/);
 const done=await f.store.command(task.id,{...receipt,result:{stage:'chief',note:'SMOKE_OK'}});assert.equal(done.status,'verified');assert.equal(done.stage,'chief');assert.equal(done.results.inspect,undefined);await assert.rejects(f.store.command(task.id,{type:'claim'}),/terminal/);
});
test('smoke adapter denies specialist stage before capture or provider and sends no task payload',async()=>{
 const f=fixture(),{task,a}=await create(f);let calls=0,captures=0;
 const adapter=pilotAdapter({enabled:true,apiKey:'synthetic-only',getApproval:async()=>a,capture:async()=>{captures++;return [];},fetchImpl:async(url,options)=>{calls++;const b=JSON.parse(options.body);assert.equal(b.max_output_tokens,128);assert(!options.body.includes('PRIVATE_PAYLOAD'));assert(!options.body.includes(f.store.scope.origin));return new Response(JSON.stringify({model:MODEL,status:'completed',usage:{input_tokens:20,output_tokens:10},output:[{content:[{type:'output_text',text:'{"stage":"chief","note":"SMOKE_OK"}'}]}]}),{status:200});}});
 await assert.rejects(adapter.execute({stage:'inspect',task,executionId:'exec_no_specialist',signal:new AbortController().signal}));assert.equal(calls,0);assert.equal(captures,0);
 const out=await adapter.execute({stage:'chief',task:{...task,objective:'PRIVATE_PAYLOAD',results:{inspect:'PRIVATE_PAYLOAD'}},executionId:'exec_fixed_smoke',signal:new AbortController().signal});assert.equal(out.result.note,'SMOKE_OK');assert.equal(calls,1);assert.equal(captures,0);
});
test('parent bridge explicitly denies smoke capture even with a matching paid approval',async()=>{
 const f=fixture(),{task,a}=await create(f);task.scope={origin:ORIGIN,commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',paths:['/industries/legal','/#pricing']};a.scopeHash=hash(task.scope);task.status='running';task.leaseUntil=Date.now()+30000;let captures=0;
 const bridge=scopedBridge({broker:{read:async()=>({tasks:[task],reservations:[],pilotApproval:a,paidExecution:true})},taskIds:[task.id],mode:'pilot',capture:async()=>{captures++;}});
 await assert.rejects(bridge({op:'capture',id:task.id,executionId:'exec_smoke_capture'}),/Capture not reserved/);assert.equal(captures,0);
});
test('two historical uncertain holds plus smoke remain $.90; cancel and interruption never replay or refund',async()=>{
 const f=fixture();for(const id of ['historical_one','historical_two']){const a={...approval(f,id),profile:undefined,maxMicros:5000000};const t=await f.store.create({principal:'offline-review',idempotencyKey:a.id,objective:'Historical synthetic fixture',mode:'pilot',approval:a}),c=await f.store.command(t.id,{type:'claim'});await f.store.command(t.id,{type:'reserve',fence:c.fence,executionId:'exec_'+id});await f.store.command(t.id,{type:'fail',fence:c.fence});}
 const before=structuredClone((await f.store.read()).reservations),{task}=await create(f),c=await f.store.command(task.id,{type:'claim'});await f.store.command(task.id,{type:'reserve',fence:c.fence,executionId:'exec_cancel_smoke'});await f.store.command(task.id,{type:'cancel'});await assert.rejects(f.store.command(task.id,{type:'claim'}),/terminal/);let state=await f.store.read();assert.deepEqual(state.reservations.slice(0,2),before);assert.equal(state.reservations.reduce((n,r)=>n+r.ceilingMicros,0),900000);assert(state.reservations.every(r=>r.status==='pending'));
 const interrupted=await create(f,approval(f,'interrupt_smoke')),ci=await f.store.command(interrupted.task.id,{type:'claim'});await f.store.command(interrupted.task.id,{type:'reserve',fence:ci.fence,executionId:'exec_interrupt_smoke'});f.advance(30001);assert.equal((await f.store.command(interrupted.task.id,{type:'recover'})).status,'blocked');await assert.rejects(f.store.command(interrupted.task.id,{type:'claim'}),/terminal/);state=await f.store.read();assert(state.reservations.every(r=>r.status==='pending'));assert(state.tasks.every(t=>t.usage.length===0));
});
test('persistence independently strips smoke wording from ordinary evidence, finish and fail but retains smoke detail',async()=>{
 const detail={phase:'provider_http',httpStatus:400,providerErrorMessage:'unsupported parameter input',providerErrorMessageTruncated:false,providerCode:'invalid_request_error',providerType:'invalid_request_error'};
 const keys=['providerErrorMessage','providerErrorMessageTruncated','providerCode','providerType'];
 for(const smoke of [false,true])for(const action of ['finish','fail']){
  const f=fixture(),a=approval(f,'persist_'+smoke+'_'+action);if(!smoke){delete a.profile;delete a.maxCalls;a.maxMicros=5000000;}
  const task=await f.store.create({principal:'offline-review',idempotencyKey:a.id,objective:smoke?SMOKE.objective:'Ordinary synthetic inspection',mode:'pilot',approval:a}),c=await f.store.command(task.id,{type:'claim'}),executionId='exec_persist_'+smoke+'_'+action;
  await f.store.command(task.id,{type:'reserve',fence:c.fence,executionId});await f.store.command(task.id,{type:'evidence',fence:c.fence,executionId,diagnostic:detail});
  await f.store.command(task.id,{type:action,fence:c.fence,executionId,diagnostic:detail,...(action==='finish'?{...PROJECT,model:MODEL,inputTokens:20,outputTokens:10,actualMicros:120,result:smoke?{stage:'chief',note:'SMOKE_OK'}:{stage:'chief',note:'Synthetic delegation',delegate:'website-visual-qa'}}:{})});
  const s=await f.store.read(),r=s.reservations[0],saved=action==='finish'?r.diagnostic:s.tasks[0].events.at(-1).diagnostic;
  for(const d of [r.evidence[0],saved]){assert.equal(d.httpStatus,400);for(const key of keys)assert.equal(Object.hasOwn(d,key),smoke,key+' profile='+smoke);}
 }
});
