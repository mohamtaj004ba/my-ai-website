'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,hash}=require('../lib/agent-operations-store');
const {pilotAdapter,MODEL,PRICING}=require('../lib/agent-operations-pilot');
const {PROJECT}=require('../lib/agent-operations-project');
const {runStage}=require('../lib/agent-operations-worker');
const {diagnostic}=require('../lib/agent-operations-diagnostics');
async function fixture(fetchImpl){
  let raw=null;const scope={origin:'https://fixture.vercel.app',commit:'a'.repeat(40)};
  const store=createStore({read:async()=>raw,compare:async(before,after)=>{if(raw!==before)return false;raw=after;return true;}},{scope});
  const approval={...PROJECT,authorized:true,id:'offline_diagnostic',scopeHash:hash(store.scope),expiresAt:Date.now()+600000,maxMicros:5000000,model:MODEL,pricingVersion:PRICING.version};
  const task=await store.create({principal:'offline',idempotencyKey:'offline_diagnostic',objective:'Offline only',mode:'pilot',approval});approval.taskId=task.id;
  return {store,task,adapter:pilotAdapter({enabled:true,apiKey:'synthetic-only',getApproval:async()=>approval,capture:async()=>[],fetchImpl})};
}
test('provider HTTP denial is classified and persisted without body, message or credential; no retry or refund',async()=>{
  let calls=0;const f=await fixture(async()=>{calls++;return {ok:false,status:403,headers:{get:()=> 'req_offline'},json:async()=>({error:{code:'insufficient_permissions',message:'Bearer secret-provider-content'}})};});
  const out=await runStage(f.store,f.adapter,{taskId:f.task.id});
  assert.equal(out.status,'blocked');assert.equal(calls,1);
  const d=out.events.at(-1).diagnostic;
  assert.equal(d.phase,'provider_http');assert.equal(d.requestAttempted,true);assert.equal(d.httpStatus,403);assert.equal(d.requestId,'req_offline');assert.equal(d.code,'insufficient_permissions');assert.equal(d.errorType,'PermissionError');assert.ok(d.elapsedMs>=0);assert.ok(d.providerElapsedMs>=0);assert.ok(d.startedAt>0);assert.match(d.clientRequestId,/^exec_/);
  const state=await f.store.read();assert.equal(state.reservations[0].status,'pending');assert.equal(state.reservations[0].ceilingMicros,300000);assert.equal(out.usage.length,0);
  assert.equal(JSON.stringify(state).includes('secret-provider-content'),false);
  await runStage(f.store,f.adapter,{taskId:f.task.id});assert.equal(calls,1);
});
test('network rejection and completed malformed output remain distinct and retain uncertain accounting',async()=>{
  for(const completed of [false,true]){
    const f=await fixture(async()=>{
      if(!completed)throw Object.assign(new Error('sensitive host'),{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});
      return {ok:true,status:200,headers:{get:()=> 'req_completed'},json:async()=>({status:'completed',model:MODEL,usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:'not JSON'}]}]})};
    });
    const out=await runStage(f.store,f.adapter,{taskId:f.task.id}),d=out.events.at(-1).diagnostic;
    assert.equal(d.phase,completed?'provider_output':'provider_fetch');assert.equal(d.requestAttempted,true);
    if(completed){assert.equal(d.providerStatus,'completed');assert.equal(d.inputTokens,100);assert.equal(d.outputTokens,50);}else assert.equal(d.code,'UND_ERR_CONNECT_TIMEOUT');
    assert.equal((await f.store.read()).reservations[0].status,'pending');assert.equal(out.usage.length,0);
  }
});
test('diagnostics discard arbitrary fields and unknown request state never asserts no request',()=>{
  assert.deepEqual(diagnostic({phase:'secret',message:'secret',requestId:'sk-proj-secret',code:'secret',inputTokens:Infinity,outputTokens:0}),{phase:'orchestrator',requestAttempted:null});
});

test('offline provider errors distinguish auth, model/project access, bad format, rate/quota and server failures',async()=>{
  for(const [status,code,type] of [[401,'invalid_api_key','AuthenticationError'],[403,'insufficient_permissions','PermissionError'],[404,'model_not_found','ModelAccessError'],[400,'invalid_request_error','RequestFormatError'],[422,'invalid_request_error','RequestFormatError'],[429,'rate_limit_exceeded','RateLimitError'],[429,'insufficient_quota','QuotaError'],[500,'server_error','ProviderError'],[503,'server_error','ProviderError']]){
    let calls=0;const f=await fixture(async(_url,opts)=>{calls++;assert.match(opts.headers['X-Client-Request-Id'],/^exec_/);return new Response(JSON.stringify({error:{code,message:'sensitive payload',type:'ignored'}}),{status,headers:{'x-request-id':'req_synthetic'}});});
    const out=await runStage(f.store,f.adapter,{taskId:f.task.id}),d=out.events.at(-1).diagnostic;
    assert.equal(d.errorType,type);assert.equal(d.httpStatus,status);assert.equal(calls,1);assert.equal(out.status,'blocked');assert.equal(out.usage.length,0);assert.equal((await f.store.read()).reservations[0].status,'pending');assert.equal(JSON.stringify(await f.store.read()).includes('sensitive payload'),false);
  }
});
test('unexpected-model usage remains unverified; checkpoints survive output failure without settling a charge',async()=>{
  for(const wrongModel of [false,true]){
    const f=await fixture(async()=>new Response(JSON.stringify({id:'resp_synthetic',status:'completed',model:wrongModel?'wrong-model':MODEL,usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:'invalid JSON'}]}]}),{headers:{'x-request-id':'req_usage'}}));
    const out=await runStage(f.store,f.adapter,{taskId:f.task.id}),r=(await f.store.read()).reservations[0],d=out.events.at(-1).diagnostic;
    assert.equal(d.usageValidated,!wrongModel);assert.equal(d.inputTokens,100);assert.equal(d.responseId,'resp_synthetic');assert.equal(r.status,'pending');assert.equal(r.actualMicros,undefined);assert.equal(out.usage.length,0);assert.ok(r.evidence.some(e=>e.responseId==='resp_synthetic'));
  }
});
test('failed durable dispatch checkpoint prevents provider invocation and evidence cannot change execution authority',async()=>{
  let calls=0;const f=await fixture(async()=>{calls++;throw Error('must not run');});
  const broker={read:f.store.read,command:(id,c)=>c.type==='evidence'?Promise.reject(Error('storage unavailable')):f.store.command(id,c)};
  const out=await runStage(broker,f.adapter,{taskId:f.task.id});assert.equal(calls,0);assert.equal(out.status,'blocked');assert.equal(out.events.at(-1).diagnostic.requestAttempted,false);assert.equal(out.events.at(-1).diagnostic.errorType,'StorageError');assert.equal((await f.store.read()).reservations[0].status,'pending');
  await assert.rejects(f.store.command(f.task.id,{type:'evidence',fence:1,executionId:'exec_fake',diagnostic:{}}),/terminal/);
});

test('revoked task remains blocked without provider invocation despite historical financial estimates',async()=>{
  const {createHandler}=require('../lib/agent-operations-api'),{hostedBroker}=require('../scripts/agent-operations-launcher.cjs');let raw=null;
  const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(raw!==a)return false;raw=b;return true;}},{scope:{origin:'https://fixture.vercel.app',commit:'a'.repeat(40)}});
  for(let n=0;n<16;n++){const t=await store.create({principal:'offline',idempotencyKey:'budget_fixture_'+n,objective:'Offline budget'}),c=await store.command(t.id,{type:'claim'});await store.command(t.id,{type:'reserve',fence:c.fence,executionId:'exec_budget_'+n});await store.command(t.id,{type:'fail',fence:c.fence});}
  const task=await store.create({principal:'offline',idempotencyKey:'budget_denial_task',objective:'Offline budget denial'}),runtime={origin:'https://my-ai-website-offline-mohamtaj004bas-projects.vercel.app',deploymentId:'dpl_offline',commit:'a'.repeat(40)},secret='w'.repeat(40);
  const handler=createHandler({env:{VERCEL_ENV:'preview',VERCEL_URL:runtime.origin.slice(8),VERCEL_GIT_COMMIT_SHA:runtime.commit,CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'false',CALLERCORE_AGENTOPS_WORKER_SECRET:secret},store,getSession:async()=>null,getMember:async()=>null,rateLimit:async()=>({limited:false})});
  const broker=hostedBroker({runtime,workerSecret:secret,oidcToken:'fixture.'+Buffer.from(JSON.stringify({project_id:'prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX',owner_id:'team_6Rg3DdCrvOml6oEGwx6Ndf1I',environment:'development',nbf:0,exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.synthetic-signature',fetchImpl:async(_url,options)=>{const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({method:options.method,headers:{authorization:'Bearer '+secret},query:{},body:options.body?JSON.parse(options.body):undefined},res);return new Response(JSON.stringify(res.body),{status:res.code});}});
  await store.command(task.id,{type:'cancel'});let calls=0;const result=await runStage(broker,{mode:'mock',execute:async()=>{calls++;throw Error('must not run');}},{taskId:task.id});
  assert.equal(calls,0);assert.equal(result.status,'cancelled');assert.equal((await store.read()).reservations.length,16);
  await assert.rejects(broker.command(task.id,{type:'claim'}),e=>e.code==='BROKER_STATE_DENIED'&&e.brokerStatus===409);
});
