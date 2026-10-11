'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore}=require('../lib/agent-operations-store');
const {createHandler}=require('../lib/agent-operations-api');
const {launch,scopedBridge,childEnvironment}=require('../scripts/agent-operations-launcher.cjs');
const {ORIGIN}=require('../scripts/agent-operations-preview-access.cjs');
const scope={origin:ORIGIN,commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8'};
test('launch entrypoint requires deliberate matching gates and never defaults to pilot',()=>{
  const {requestedMode}=require('../scripts/agent-operations-run.cjs'),local={CALLERCORE_AGENTOPS_WORKER_MODE:'mock',CALLERCORE_AGENTOPS_PAID_ENABLED:'false'};
  for(const args of [[],['--pilot'],['--pilot','extra'],['--mock'],['--mock','arbitrary']])assert.throws(()=>requestedMode(args,local));
  assert.equal(requestedMode(['--mock','a'.repeat(36)],local),'mock');
  assert.equal(requestedMode(['--pilot'],{CALLERCORE_AGENTOPS_WORKER_MODE:'pilot',CALLERCORE_AGENTOPS_PAID_ENABLED:'true'}),'pilot');
});
function store(){let raw=null;return createStore({read:async()=>raw,compare:async(before,after)=>{if(raw!==before)return false;raw=after;return true;}},{scope});}
const env=()=>({VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'false',CALLERCORE_AGENTOPS_WORKER_SECRET:'w'.repeat(40),CALLERCORE_AGENTOPS_VERIFICATION_SECRET:'v'.repeat(40),CALLERCORE_AGENTOPS_VERIFICATION_ID:'a'.repeat(24),CALLERCORE_AGENTOPS_VERIFICATION_START:String(Date.now()-1000),CALLERCORE_AGENTOPS_VERIFICATION_END:String(Date.now()+600000)});
async function request(h,secret,body){const r={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await h({method:body?'POST':'GET',query:{},headers:{authorization:'Bearer '+secret},body},r);return r;}
test('temporary verifier creates exactly two fixed mock fixtures and cannot reach admin, paid, worker or unrelated tasks',async()=>{
  const s=store(),e=env(),h=createHandler({env:e,store:s,getSession:async()=>null,getMember:async()=>null,rateLimit:async()=>({limited:false})});
  const unrelated=await s.create({principal:'owner',idempotencyKey:'unrelated_123',objective:'unrelated'}),key=e.CALLERCORE_AGENTOPS_VERIFICATION_SECRET;
  const a=await request(h,key,{action:'create-fixture',fixture:'happy'}),b=await request(h,key,{action:'create-fixture',fixture:'cancel'});assert.equal(a.code,201);assert.equal(b.code,201);assert.equal(a.body.task.mode,'mock');assert.equal('principal' in a.body.task,false);
  assert.equal((await request(h,key,{action:'create-fixture',fixture:'happy'})).body.task.id,a.body.task.id);
  for(const body of [{action:'create-fixture',fixture:'third'},{action:'create-fixture',fixture:'happy',objective:'changed'},{action:'create-fixture',fixture:'happy',mode:'pilot'},{action:'initialize-pilot'},{action:'command',id:a.body.task.id,command:{type:'claim'}},{action:'cancel-fixture',id:unrelated.id,expectedRevision:unrelated.revision}])assert.equal((await request(h,key,body)).code,403);
  assert.equal((await request(h,key)).body.tasks.length,2);assert.equal((await request(h,'wrong')).code,401);
  assert.equal((await request(h,key,{action:'cancel-fixture',id:b.body.task.id,expectedRevision:999})).code,409);
  assert.equal((await request(h,key,{action:'cancel-fixture',id:b.body.task.id,expectedRevision:b.body.task.revision})).body.task.status,'cancelled');
  assert.equal((await request(h,key,{action:'close-verification'})).code,200);assert.equal((await request(h,key)).code,403);
  await assert.rejects(s.create({principal:'mock-verifier:'+e.CALLERCORE_AGENTOPS_VERIFICATION_ID,idempotencyKey:'closed_fixture',objective:'cannot race closure'}));
});
test('verification denies absent/malformed/expired/unbounded configuration, Production, paid and shared credentials',async()=>{
  for(const change of [{CALLERCORE_AGENTOPS_VERIFICATION_ID:undefined},{CALLERCORE_AGENTOPS_VERIFICATION_START:'invalid'},{CALLERCORE_AGENTOPS_VERIFICATION_END:'0'},{CALLERCORE_AGENTOPS_VERIFICATION_END:String(Date.now()+10000000)},{VERCEL_ENV:'production'},{CALLERCORE_AGENTOPS_PAID_ENABLED:'true'},{CALLERCORE_AGENTOPS_PAID_ENABLED:undefined},{CALLERCORE_AGENTOPS_VERIFICATION_SECRET:'w'.repeat(40)}]){
    const e={...env(),...change},h=createHandler({env:e,store:store(),getSession:async()=>null,getMember:async()=>null,rateLimit:async()=>({limited:false})});assert.ok([403,503].includes((await request(h,e.CALLERCORE_AGENTOPS_VERIFICATION_SECRET)).code));
  }
});
test('trusted bridge strips credentials and denies foreign IDs, arbitrary messages, extra fields, capture and paid receipts',async()=>{
  const e=childEnvironment({...process.env,VERCEL_TOKEN:'account',VERCEL_OIDC_TOKEN:'identity',CALLERCORE_AGENTOPS_WORKER_SECRET:'worker',OPENAI_API_KEY:'existing-preview',CALLERCORE_AGENTOPS_VERIFICATION_SECRET:'verifier',PREVIEW_KV_KV_REST_API_TOKEN:'database',NODE_OPTIONS:'--inspect'},'mock');
  for(const key of ['VERCEL_TOKEN','VERCEL_OIDC_TOKEN','CALLERCORE_AGENTOPS_WORKER_SECRET','OPENAI_API_KEY','CALLERCORE_AGENTOPS_VERIFICATION_SECRET','PREVIEW_KV_KV_REST_API_TOKEN','NODE_OPTIONS'])assert.equal(e[key],undefined);
  assert.throws(()=>childEnvironment({...process.env,CALLERCORE_AGENTOPS_PAID_ENABLED:'false'},'pilot'));
  const s=store(),a=await s.create({principal:'owner',idempotencyKey:'bridge_task',objective:'mock'}),other=await s.create({principal:'owner',idempotencyKey:'bridge_other',objective:'other'}),bridge=scopedBridge({broker:s,taskIds:[a.id],mode:'mock'});
  assert.deepEqual((await bridge({op:'read'})).tasks.map(t=>t.id),[a.id]);
  const filtered=scopedBridge({broker:{read:async()=>({...await s.read(),pilotApproval:{taskId:other.id,authorized:true},unrelatedSecret:'must-not-forward'})},taskIds:[a.id],mode:'mock'});
  const safe=await filtered({op:'read'});assert.equal(safe.pilotApproval,undefined);assert.equal(safe.unrelatedSecret,undefined);assert.equal(safe.tasks[0].principal,undefined);
  for(const m of [{op:'read',url:'https://example.com'},{op:'fetch',url:ORIGIN},{op:'command',id:other.id,command:{type:'claim',expectedRevision:1}},{op:'command',id:a.id,command:{type:'cancel'}},{op:'command',id:a.id,command:{type:'claim',expectedRevision:1,url:'elsewhere'}},{op:'command',id:a.id,command:{type:'finish',fence:1,executionId:'exec_fake',actualMicros:1,model:'gpt-4.1'}},{op:'capture',id:a.id,executionId:'exec_fake'},null,[]])await assert.rejects(bridge(m));
});
test('capture cannot start after lease or task deadline expiry even with valid approval and pending reservation',async()=>{
  const {PROJECT}=require('../lib/agent-operations-project'),{hash}=require('../lib/agent-operations-store'),{MODEL,PRICING}=require('../lib/agent-operations-pilot');
  for(const expired of ['leaseUntil','deadline']){
    const task={...PROJECT,id:'bounded-task',mode:'pilot',approvalId:'pilot_12345678',scope:{...scope,paths:['/industries/legal','/#pricing']},status:'running',stage:'inspect',fence:1,leaseUntil:Date.now()+30000,deadline:Date.now()+60000};task[expired]=Date.now()-1;
    const pilotApproval={...PROJECT,id:task.approvalId,taskId:task.id,authorized:true,scopeHash:hash(task.scope),expiresAt:Date.now()+60000,maxMicros:2000000,model:MODEL,pricingVersion:PRICING.version};let captures=0;
    const bridge=scopedBridge({broker:{read:async()=>({tasks:[task],pilotApproval,reservations:[{taskId:task.id,executionId:'exec_pending',stage:'inspect',fence:1,status:'pending'}]})},taskIds:[task.id],mode:'pilot',capture:async()=>{captures++;}});
    await assert.rejects(bridge({op:'capture',id:task.id,executionId:'exec_pending'}));assert.equal(captures,0);
  }
});
test('real restricted child completes delegation over parent IPC with zero Vercel credentials and denied private-file read',async()=>{
  const s=store(),task=await s.create({principal:'owner',idempotencyKey:'child_fixture',objective:'mock'});let attestation;
  await launch({broker:s,taskId:task.id,env:{...process.env,VERCEL_TOKEN:'account-fixture',VERCEL_OIDC_TOKEN:'oidc-fixture',CALLERCORE_AGENTOPS_WORKER_SECRET:'broker-fixture'},onAttestation:a=>{attestation=a;}});
  const t=(await s.read()).tasks[0];assert.equal(t.status,'verified');assert.equal(t.calls,4);assert.equal(t.usage.reduce((n,u)=>n+u.actualMicros,0),0);assert.equal(attestation.vercelCredentialVariables,0);assert.equal(attestation.privateFileReadDenied,true);assert.equal(attestation.childProcessAllowed,false);assert.notEqual(t.results.inspect.executionId,t.results.review.executionId);
});

test('real restricted preflight failure writes sanitized parent fallback journal without provider access',async()=>{
  const {PROJECT}=require('../lib/agent-operations-project'),{hash}=require('../lib/agent-operations-store'),{MODEL,PRICING}=require('../lib/agent-operations-pilot'),fs=require('node:fs'),path=require('node:path');
  const s=store(),approval={...PROJECT,authorized:true,id:'pilot_offline_journal',scopeHash:hash(s.scope),expiresAt:Date.now()+60000,maxMicros:2000000,model:MODEL,pricingVersion:PRICING.version};
  const task=await s.create({principal:'offline',idempotencyKey:'offline_journal',objective:'Offline preflight denial',mode:'pilot',approval});
  const broker={read:async()=>({...await s.read(),paidExecution:true}),command:s.command};
  // No task-bound approval returned: fixed adapter must reject before fetch.
  await launch({broker,taskId:task.id,mode:'pilot',env:{...process.env,CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_OPENAI_API_KEY:'synthetic-offline-key',CALLERCORE_AGENTOPS_OPENAI_PROJECT_ID:PROJECT.projectId,CALLERCORE_AGENTOPS_OPENAI_ORGANIZATION_ID:PROJECT.organizationId}});
  const journal=fs.readFileSync(path.resolve('artifacts/agent-operations/worker-diagnostics.jsonl'),'utf8').trim().split('\n').map(JSON.parse).filter(x=>x.taskId===task.id);
  assert.ok(journal.length>=1);assert.ok(journal.every(x=>x.diagnostic.requestAttempted===false&&x.diagnostic.errorType==='ApprovalError'));assert.equal(JSON.stringify(journal).includes('synthetic-offline-key'),false);assert.equal((await s.read()).reservations[0].status,'pending');
});
