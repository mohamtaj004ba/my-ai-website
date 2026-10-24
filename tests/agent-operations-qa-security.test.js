'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,hash}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const {QA,sourceFor,validSource,validVerdict}=require('../lib/agent-operations-qa');
const {MODEL,PRICING}=require('../lib/agent-operations-pilot');
const {scopedBridge}=require('../scripts/agent-operations-launcher.cjs');
const {createHandler,trustedApproval}=require('../lib/agent-operations-api');
const original=require('./fixtures/agent-operations-qa-source.json');
function fixture(){let raw=JSON.stringify({version:1,revision:0,tasks:[structuredClone(original)],reservations:[]}),now=Date.now();const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(raw!==a)return false;raw=b;return true;}},{scope:original.scope,clock:()=>now});return {store,clock:()=>now,advance:ms=>now+=ms};}
function approval(f,id='qa_security_123'){return {...PROJECT,id:'pilot_'+id,authorized:true,profile:QA.profile,maxCalls:1,maxMicros:300000,sourceTaskId:QA.sourceTaskId,findingsHash:QA.findingsHash,evidenceHash:QA.evidenceHash,scopeHash:hash(f.store.scope),expiresAt:f.clock()+300000,model:MODEL,pricingVersion:PRICING.version};}
async function create(f){return f.store.create({principal:'offline-review',idempotencyKey:'qa_security_request',objective:QA.objective,mode:'pilot',approval:approval(f)});}
function verdict(source){return {stage:'review',decision:'reject',note:'Synthetic offline rejection',findings:source.inspect.findings.map(f=>({code:f.code,decision:'reject',evidenceSufficient:false,reason:'Synthetic insufficient evidence',observed:'Offline fixture only',unsupportedClaims:['Synthetic unsupported claim'],evidence:[{path:source.inspect.artifacts[0].path,sha256:source.inspect.artifacts[0].sha256,region:'Synthetic region'}]}))};}
test('QA binding rejects altered original findings, identity, hash or source state',async()=>{
 const source=sourceFor(original);assert(validSource(source));for(const mutate of [s=>s.inspect.note+=' changed',s=>s.taskId='foreign',s=>s.inspect.artifacts[0].sha256='a'.repeat(64),s=>s.findingsHash='0'.repeat(64)]){const s=structuredClone(source);mutate(s);assert.equal(validSource(s),false);}
 for(const patch of [{status:'blocked'},{profile:'evidence-qa'},{stage:'review'},{projectId:'foreign'}])assert.equal(sourceFor({...original,...patch}),null);
 const f=fixture();for(const patch of [{maxCalls:2},{maxMicros:600000},{sourceTaskId:'foreign'},{findingsHash:'0'.repeat(64)}])await assert.rejects(f.store.create({principal:'offline',idempotencyKey:'invalid_binding',objective:QA.objective,mode:'pilot',approval:{...approval(f),...patch}}),/QA approval/);
});
test('QA verdict rejects omitted/duplicate findings, foreign evidence, tool authority and unsupported acceptance',()=>{
 const source=sourceFor(original),v=verdict(source);assert(validVerdict(v,source));
 for(const mutate of [x=>x.findings.pop(),x=>x.findings[1].code=x.findings[0].code,x=>x.findings[0].evidence[0].path='foreign.png',x=>x.findings[0].evidence[0].sha256='0'.repeat(64),x=>x.tools=[],x=>x.findings[0].decision='accept',x=>x.decision='accept',x=>x.findings[0].evidence=[]]){const copy=structuredClone(v);mutate(copy);assert.equal(validVerdict(copy,source),false);}
});
test('valid reject settles NEW terminal QA task only and one-call gate prevents expansion',async()=>{
 const f=fixture(),t=await create(f),before=structuredClone((await f.store.read()).tasks[0]),c=await f.store.command(t.id,{type:'claim'}),executionId='exec_qa_security';await f.store.command(t.id,{type:'reserve',fence:c.fence,executionId});await assert.rejects(f.store.command(t.id,{type:'reserve',fence:c.fence,executionId:'exec_qa_extra'}));
 const done=await f.store.command(t.id,{type:'finish',fence:c.fence,executionId,...PROJECT,model:MODEL,inputTokens:100,outputTokens:50,actualMicros:600,result:verdict(t.source)});assert.equal(done.status,'verified');assert.equal(done.stage,'review');assert.equal(done.results.qaVerdict.decision,'reject');assert.equal(done.results.review,undefined);assert.equal(done.results.chief,undefined);await assert.rejects(f.store.command(t.id,{type:'claim'}),/terminal/);assert.deepEqual((await f.store.read()).tasks[0],before);
});
test('QA parent denies reserve before original image validation, capture and foreign evidence requests',async()=>{
 const f=fixture(),t=await create(f),a={...approval(f),taskId:t.id};await f.store.command(t.id,{type:'claim'});let commands=0,captures=0,loads=0;
 const bridge=scopedBridge({broker:{read:async()=>({...await f.store.read(),paidExecution:true,pilotApproval:a}),command:async(...args)=>{commands++;return f.store.command(...args);}},taskIds:[t.id],mode:'pilot',capture:async()=>{captures++;},loadEvidence:async()=>{loads++;return [];}});
 await assert.rejects(bridge({op:'command',id:t.id,command:{type:'reserve',fence:1,executionId:'exec_unvalidated'}}),/QA command/);await assert.rejects(bridge({op:'capture',id:t.id,executionId:'exec_forbidden'}),/Capture not reserved/);await assert.rejects(bridge({op:'qa-evidence',id:QA.sourceTaskId}));await assert.rejects(bridge({op:'qa-evidence',id:t.id}),/evidence mismatch/);assert.equal(commands,0);assert.equal(captures,0);assert.equal(loads,1);assert.equal((await f.store.read()).reservations.length,0);
});
test('QA cancellation and expired lease preserve held allowance and forbid paid replay',async()=>{
 for(const cancel of [true,false]){const f=fixture(),t=await create(f),c=await f.store.command(t.id,{type:'claim'});await f.store.command(t.id,{type:'reserve',fence:c.fence,executionId:'exec_qa_uncertain'});if(cancel)await f.store.command(t.id,{type:'cancel'});else{f.advance(30001);assert.equal((await f.store.command(t.id,{type:'recover'})).status,'blocked');}await assert.rejects(f.store.command(t.id,{type:'claim'}),/terminal/);const state=await f.store.read();assert.equal(state.reservations[0].status,'pending');assert.equal(state.reservations[0].ceilingMicros,300000);assert.deepEqual(state.tasks[0],original);}
});
test('QA API denies Production, non-worker initialization, expired approval and wrong pinned scope',async()=>{
 const f=fixture(),a=approval(f),env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_WORKER_SECRET:'x'.repeat(40),CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify(a)};
 assert(trustedApproval(env,f.store.scope));assert.equal(trustedApproval({...env,VERCEL_ENV:'production'},f.store.scope),null);assert.equal(trustedApproval({...env,CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify({...a,expiresAt:Date.now()-1})},f.store.scope),null);assert.equal(trustedApproval(env,{...f.store.scope,commit:'b'.repeat(40)}),null);
 async function call(e,worker){let status;const h=createHandler({env:e,store:f.store,getSession:async()=>({email:'admin@example.test',workspaceId:'offline'}),getMember:async()=>({email:'admin@example.test',role:'admin',workspaceId:'offline'}),rateLimit:async()=>({limited:false})});await h({method:'POST',headers:{host:'fixture.test',origin:'https://fixture.test',...(worker?{authorization:'Bearer '+env.CALLERCORE_AGENTOPS_WORKER_SECRET}:{})},body:{action:'initialize-qa'}},{setHeader(){},status(n){status=n;return this;},json(){}});return status;}
 assert.equal(await call(env,false),403);assert.equal(await call({...env,VERCEL_ENV:'production'},true),503);assert.equal(await call({...env,CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify({...a,expiresAt:Date.now()-1})},true),403);assert.equal((await f.store.read()).tasks.length,1);assert.equal((await f.store.read()).reservations.length,0);
});
