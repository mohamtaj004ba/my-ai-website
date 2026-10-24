'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,hash,LIMITS}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const {MODEL,PRICING,approvalCheck}=require('../lib/agent-operations-pilot');
const {trustedApproval}=require('../lib/agent-operations-api');
function fixture(prior=0){let raw=prior?JSON.stringify({version:1,revision:0,tasks:[],reservations:[{mode:'pilot',taskId:'historical',ceilingMicros:prior,status:'pending'}]}):null,now=Date.UTC(2026,9,11,12);const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(raw!==a)return false;raw=b;return true;}},{clock:()=>now,scope:{origin:'https://offline-expanded.vercel.app',commit:'a'.repeat(40)}});return {store,clock:()=>now,advance:ms=>{now+=ms;}};}
function approval(store,now,id){return {...PROJECT,authorized:true,id:'pilot_expanded_'+id,scopeHash:hash(store.scope),expiresAt:now+600000,maxMicros:5000000,model:MODEL,pricingVersion:PRICING.version};}
async function create(f,id){const a=approval(f.store,f.clock(),id);return f.store.create({principal:'offline-expanded',idempotencyKey:'expanded_'+id,objective:'Synthetic offline limits verification',mode:'pilot',approval:a});}
async function reserveAndBlock(f,id){const task=await create(f,id),claimed=await f.store.command(task.id,{type:'claim'});await f.store.command(task.id,{type:'reserve',fence:claimed.fence,executionId:'exec_expanded_'+id});await f.store.command(task.id,{type:'fail',fence:claimed.fence});return task;}
test('historical $15 estimate remains recorded without blocking authorized reservations',async()=>{
  const f=fixture(14700000);await reserveAndBlock(f,'retained');const retained=structuredClone((await f.store.read()).reservations[0]);
  // Preserve original estimates and pending uncertainty without enforcing a dollar cap.
  let state=await f.store.read();assert.equal(state.reservations.length,2);assert.equal(state.reservations.reduce((n,r)=>n+r.ceilingMicros,0),15000000);assert.deepEqual(state.reservations[0],retained);
  const extra=await create(f,'denied_day'),claimed=await f.store.command(extra.id,{type:'claim'});await f.store.command(extra.id,{type:'reserve',fence:claimed.fence,executionId:'exec_over_day'});
  f.advance(86400000);const next=await create(f,'denied_month'),c=await f.store.command(next.id,{type:'claim'});await f.store.command(next.id,{type:'reserve',fence:c.fence,executionId:'exec_over_month'});
  state=await f.store.read();assert.equal(state.reservations.length,4);assert.equal(state.reservations.reduce((n,r)=>n+r.ceilingMicros,0),15600000);assert.deepEqual(state.reservations[0],retained);assert.ok(state.reservations.every(r=>r.status==='pending'));
});
test('ten-call hard gate rejects an eleventh reservation and ten-minute deadline is unchanged',async()=>{
  assert.equal(LIMITS.calls,10);assert.equal(LIMITS.durationMs,600000);assert.equal(LIMITS.taskMicros,5000000);assert.equal(LIMITS.dayMicros,15000000);assert.equal(LIMITS.monthMicros,15000000);assert.equal(LIMITS.callMicros,300000);assert.equal(LIMITS.attempts,2);
  const f=fixture(),task=await create(f,'call_gate'),claimed=await f.store.command(task.id,{type:'claim'});assert.equal(task.deadline-task.createdAt,600000);
  for(let n=0;n<10;n++)await f.store.command(task.id,{type:'reserve',fence:claimed.fence,executionId:'exec_call_gate_'+n});
  await assert.rejects(f.store.command(task.id,{type:'reserve',fence:claimed.fence,executionId:'exec_call_gate_11'}),/Call limit reached/);assert.equal((await f.store.read()).tasks[0].calls,10);
  const queued=await create(f,'deadline');f.advance(600000);await assert.rejects(f.store.command(queued.id,{type:'claim'}),/deadline/);
});
test('trusted approval accepts exact $5 manifest and rejects previous $2 manifest without network',()=>{
  const f=fixture(),a=approval(f.store,Date.now(),'approval_gate'),env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify(a)};
  assert.deepEqual(trustedApproval(env,f.store.scope),a);assert.equal(trustedApproval({...env,CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify({...a,maxMicros:2000000})},f.store.scope),null);
  const task={...PROJECT,id:'offline-task',approvalId:a.id,scope:f.store.scope};assert.doesNotThrow(()=>approvalCheck({...a,taskId:task.id},task));assert.throws(()=>approvalCheck({...a,taskId:task.id,maxMicros:2000000},task));assert.equal(trustedApproval({...env,CALLERCORE_AGENTOPS_PAID_ENABLED:'false'},f.store.scope),null);
});
test('cancellation and uncertain paid recovery retain reservations and prohibit replay under expanded ceilings',async()=>{
  const f=fixture(),task=await create(f,'cancel'),claimed=await f.store.command(task.id,{type:'claim'});await f.store.command(task.id,{type:'reserve',fence:claimed.fence,executionId:'exec_cancel_expanded'});await f.store.command(task.id,{type:'cancel'});await assert.rejects(f.store.command(task.id,{type:'claim'}),/terminal/);
  const interrupted=await create(f,'interrupted'),c=await f.store.command(interrupted.id,{type:'claim'});await f.store.command(interrupted.id,{type:'reserve',fence:c.fence,executionId:'exec_interrupted_expanded'});f.advance(30001);assert.equal((await f.store.command(interrupted.id,{type:'recover'})).status,'blocked');await assert.rejects(f.store.command(interrupted.id,{type:'claim'}),/terminal/);
  const state=await f.store.read();assert.equal(state.reservations.length,2);assert.ok(state.reservations.every(r=>r.status==='pending'&&r.ceilingMicros===300000));assert.ok(state.tasks.every(t=>t.usage.length===0));
});
