'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,hash}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const {SPECIALIST,validArtifacts,evidenceHash}=require('../lib/agent-operations-specialist');
const {MODEL,PRICING,approvalCheck}=require('../lib/agent-operations-pilot');
const {createHandler,trustedApproval}=require('../lib/agent-operations-api');
const pinned={origin:'https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app',commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8'};
function fixture(scope=pinned){let raw=null,now=Date.now();const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(raw!==a)return false;raw=b;return true;}},{scope,clock:()=>now});return {store,clock:()=>now,advance:ms=>now+=ms};}
function approval(f,id='specialist_security'){return {...PROJECT,id:'pilot_'+id,authorized:true,profile:SPECIALIST.profile,maxCalls:2,maxMicros:600000,scopeHash:hash(f.store.scope),expiresAt:f.clock()+300000,model:MODEL,pricingVersion:PRICING.version};}
async function task(f,a=approval(f)){return f.store.create({principal:'offline',idempotencyKey:a.id,objective:SPECIALIST.objective,mode:'pilot',approval:a});}
function artifacts(id,at){return ['legal','pricing'].flatMap((name,n)=>[1440,390].map((viewport,i)=>({path:id+'-'+name+'-'+viewport+'.png',viewport,sha256:String(n*2+i+1).repeat(64),capturedAt:at})));}
async function chief(f,t){const c=await f.store.command(t.id,{type:'claim'});await f.store.command(t.id,{type:'reserve',fence:c.fence,executionId:'exec_security_chief'});return f.store.command(t.id,{type:'finish',fence:c.fence,executionId:'exec_security_chief',...PROJECT,model:MODEL,inputTokens:20,outputTokens:10,actualMicros:120,result:{stage:'chief',delegate:'website-visual-qa',note:'Synthetic delegation'}});}
test('specialist profile binds exact approval scope/objective/calls/cost and rejects Production admission',async()=>{
 const f=fixture(),a=approval(f),t=await task(f);assert.doesNotThrow(()=>approvalCheck({...a,taskId:t.id},t,f.clock()));
 for(const patch of [{profile:undefined},{maxCalls:3},{maxMicros:5000000}])assert.throws(()=>approvalCheck({...a,taskId:t.id,...patch},t,f.clock()));
 await assert.rejects(f.store.create({principal:'offline',idempotencyKey:'changed_objective',objective:'Changed scope',mode:'pilot',approval:approval(f,'changed')}),/specialist approval/);
 const other=fixture({...pinned,commit:'b'.repeat(40)});await assert.rejects(task(other),/specialist approval/);
 const env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify(a)};assert(trustedApproval(env,f.store.scope));assert.equal(trustedApproval({...env,VERCEL_ENV:'production'},f.store.scope),null);
});
test('four artifacts require exact execution paths, viewport combinations, bounded freshness and hashes',()=>{
 const id='exec_fresh_artifacts',a=artifacts(id,100);assert(validArtifacts(a,id,100,200));
 for(const mutate of [x=>x.pop(),x=>x[1]=x[0],x=>x[0].capturedAt=99,x=>x[0].capturedAt=201,x=>x[0].sha256='wrong',x=>x[0].path='../legal-1440.png',x=>x[0].viewport=768,x=>x[0].extra='unsafe']){const copy=structuredClone(a);mutate(copy);assert.equal(validArtifacts(copy,id,100,200),false);}
 assert.equal(validArtifacts(a,'exec_other',100,200),false);
});
test('specialist requires sequential independent execution and fresh evidence then consumes terminal paid gate',async()=>{
 const f=fixture(),a=approval(f),t=await task(f,a);await chief(f,t);const c=await f.store.command(t.id,{type:'claim'}),id='exec_security_inspect';await f.store.command(t.id,{type:'reserve',fence:c.fence,executionId:id});await assert.rejects(f.store.command(t.id,{type:'reserve',fence:c.fence,executionId:'exec_third'}),/Call limit/);
 const images=artifacts(id,f.clock()),receipt={type:'finish',fence:c.fence,executionId:id,...PROJECT,model:MODEL,inputTokens:20,outputTokens:10,actualMicros:120,result:{stage:'inspect',note:'Synthetic findings',findings:[],artifacts:images,evidenceHash:evidenceHash(images)}};
 await assert.rejects(f.store.command(t.id,{...receipt,result:{...receipt.result,evidenceHash:'0'.repeat(64)}}),/fresh specialist evidence/);
 const done=await f.store.command(t.id,receipt);assert.equal(done.status,'verified');assert.equal(done.stage,'inspect');assert.equal(done.calls,2);assert.equal(done.results.review,undefined);assert.equal(done.results.report,undefined);await assert.rejects(f.store.command(t.id,{type:'claim'}),/terminal/);
 const env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_WORKER_SECRET:'x'.repeat(40),CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify(a)},h=createHandler({env,store:f.store,getSession:async()=>null,getMember:async()=>null,rateLimit:async()=>({limited:false})});let body;
 await h({method:'GET',headers:{authorization:'Bearer '+env.CALLERCORE_AGENTOPS_WORKER_SECRET}},{setHeader(){},status(){return this;},json(v){body=v;}});assert.equal(body.paidExecution,false);assert.equal(body.chiefSpecialist.enabled,false);assert.equal(body.pilotApproval,undefined);
});
test('specialist cancellation and interrupted inspection retain uncertain reservations and prohibit replay',async()=>{
 for(const cancel of [true,false]){const f=fixture(),t=await task(f);await chief(f,t);const c=await f.store.command(t.id,{type:'claim'});await f.store.command(t.id,{type:'reserve',fence:c.fence,executionId:'exec_uncertain_inspect'});if(cancel)await f.store.command(t.id,{type:'cancel'});else{f.advance(30001);assert.equal((await f.store.command(t.id,{type:'recover'})).status,'blocked');}await assert.rejects(f.store.command(t.id,{type:'claim'}),/terminal/);const s=await f.store.read();assert.equal(s.reservations.length,2);assert.equal(s.reservations[1].status,'pending');assert.equal(s.reservations.reduce((n,r)=>n+r.ceilingMicros,0),600000);assert.equal(s.tasks[0].usage.length,1);}
});
