'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,hash}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const {pilotAdapter,MODEL,PRICING}=require('../lib/agent-operations-pilot');
const {runStage}=require('../lib/agent-operations-worker');
function fixture(clock=Date.now){let raw=null;const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(raw!==a)return false;raw=b;return true;}},{clock,scope:{origin:'https://offline-interruption.vercel.app',commit:'a'.repeat(40)}});return store;}
async function job(store,clock=Date.now){const approval={...PROJECT,authorized:true,id:'pilot_interruption',scopeHash:hash(store.scope),expiresAt:clock()+600000,maxMicros:5000000,model:MODEL,pricingVersion:PRICING.version};const task=await store.create({principal:'offline',idempotencyKey:'interruption_fixture',objective:'Offline only',mode:'pilot',approval});approval.taskId=task.id;return {task,approval};}
const response=()=>({status:'completed',id:'resp_offline_complete',model:MODEL,usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify({stage:'chief',delegate:'website-visual-qa',note:'Offline only'})}]}]});
function adapter(approval,fetchImpl){return pilotAdapter({enabled:true,apiKey:'synthetic-only',getApproval:async()=>approval,capture:async()=>[],fetchImpl});}
test('cancellation abort race retains HTTP correlation in fallback without resurrecting terminal task',async()=>{
  const store=fixture(),{task,approval}=await job(store),controller=new AbortController(),notices=[];
  const execution=adapter(approval,async()=>({ok:true,status:200,headers:{get:()=> 'req_abort_race'},json:async()=>{await store.command(task.id,{type:'cancel'});controller.abort();return new Promise(()=>{});}}));
  const result=await runStage(store,execution,{taskId:task.id,signal:controller.signal,onDiagnostic:async n=>notices.push(n)});
  assert.equal(result.status,'cancelled');assert.equal(notices.length,1);assert.equal(notices[0].diagnostic.requestAttempted,true);assert.equal(notices[0].diagnostic.httpStatus,200);assert.equal(notices[0].diagnostic.requestId,'req_abort_race');assert.equal(notices[0].diagnostic.errorType,'CancelledError');
  const state=await store.read();assert.equal(state.reservations[0].status,'pending');assert.equal(state.tasks[0].usage.length,0);assert.ok(state.reservations[0].evidence.some(e=>e.phase==='provider_http'&&e.httpStatus===200));
});
test('completed response followed by uncertain finish retains validated usage without settling or refunding',async()=>{
  const store=fixture(),{task,approval}=await job(store),notices=[];
  const broker={read:store.read,command:async(id,c)=>{if(c.type==='finish')throw Error('Synthetic uncertain persistence');return store.command(id,c);}};
  const execution=adapter(approval,async()=>({ok:true,status:200,headers:{get:()=> 'req_finish_uncertain'},json:async()=>response()}));
  const result=await runStage(broker,execution,{taskId:task.id,onDiagnostic:async n=>notices.push(n)});
  assert.equal(result.status,'blocked');assert.equal(result.usage.length,0);const d=notices[0].diagnostic;assert.equal(d.phase,'finish');assert.equal(d.usageValidated,true);assert.equal(d.inputTokens,100);assert.equal(d.outputTokens,50);assert.equal(d.responseId,'resp_offline_complete');assert.equal(d.requestAttempted,true);
  const reservation=(await store.read()).reservations[0];assert.equal(reservation.status,'pending');assert.equal(reservation.ceilingMicros,300000);assert.ok(reservation.evidence.some(e=>e.usageValidated===true));
});
test('broker read outage preserves latest response facts through onDiagnostic fallback',async()=>{
  const store=fixture(),{task}=await job(store),notices=[];let unavailable=false;
  const broker={read:async()=>{if(unavailable)throw Error('Synthetic offline outage');return store.read();},command:store.command};
  const execution={mode:'pilot',execute:async({onEvidence})=>{const diagnostic={phase:'provider_output',requestAttempted:true,httpStatus:200,requestId:'req_outage',responseId:'resp_outage',inputTokens:100,outputTokens:50,usageValidated:true,startedAt:Date.now()};await onEvidence(diagnostic);unavailable=true;return {diagnostic,...PROJECT,actualMicros:600,model:MODEL,inputTokens:100,outputTokens:50,result:{stage:'chief',delegate:'website-visual-qa',note:'Offline'}};}};
  await assert.rejects(runStage(broker,execution,{taskId:task.id,onDiagnostic:async n=>notices.push(n)}));
  assert.equal(notices.length,1);assert.equal(notices[0].diagnostic.phase,'finish_read');assert.equal(notices[0].diagnostic.requestId,'req_outage');assert.equal(notices[0].diagnostic.usageValidated,true);assert.equal(notices[0].diagnostic.errorType,'StorageError');
  const state=await store.read();assert.equal(state.reservations[0].status,'pending');assert.equal(state.tasks[0].usage.length,0);
});
test('expired lease recovery retains provider evidence and blocks replay of pending paid attempt',async()=>{
  let now=1000;const clock=()=>now,store=fixture(clock),{task}=await job(store,clock),claimed=await store.command(task.id,{type:'claim'}),executionId='exec_interrupted';
  await store.command(task.id,{type:'reserve',fence:claimed.fence,executionId});await store.command(task.id,{type:'evidence',fence:claimed.fence,executionId,diagnostic:{phase:'provider_http',requestAttempted:true,httpStatus:200,requestId:'req_interrupted'}});
  now=32000;const recovered=await store.command(task.id,{type:'recover'});assert.equal(recovered.status,'blocked');await assert.rejects(store.command(task.id,{type:'claim'}));
  const reservation=(await store.read()).reservations[0];assert.equal(reservation.status,'pending');assert.equal(reservation.ceilingMicros,300000);assert.equal(reservation.evidence[0].requestId,'req_interrupted');assert.equal(recovered.usage.length,0);
});
