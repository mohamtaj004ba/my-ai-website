'use strict';
// Actual controller, ledger, parser and disposable-copy path; model and isolated
// provider responses are explicit offline fixtures. No external API is called.
const test=require('node:test'),a=require('node:assert/strict');
const transport=require('../lib/agent-operations-engineering-transport'),timing=require('../lib/agent-operations-engineering-timing');
function helpers(){return require('./helpers/engineering-provider-fixtures.cjs');}
test('phase budgets share the original operation deadline and preserve existing resource maxima',()=>{
 a.equal(timing.OPERATION_MS,600000);a.equal(timing.SHUTDOWN_MS,15000);a.equal(timing.LIVE_MODEL_MS,135000);a.equal(timing.MODEL_MS,150000);a.equal(timing.SOURCE_TEST_MS,300000);a.equal(timing.SOURCE_COMMAND_MS,150000);
 a.equal(timing.phaseDeadline(1000,timing.SOURCE_TEST_MS,1800),1800);a.equal(timing.phaseDeadline(2000,timing.SOURCE_TEST_MS,1800),1800);
});
for(const mode of ['separate-phase','operation-deadline','cancel','model-deadline'])test('actual workflow timing '+mode+' preserves cleanup and never retries a provider request',async()=>{
 const {setup,authorize,installProvider,sandboxFixture,owner}=helpers(),controller=new AbortController();let started=false,insideSpecialist=false,operationEnd;
 const timers=[],oldSet=global.setTimeout,oldClear=global.clearTimeout,original=transport.execute;
 // Observe and fire only the transport's own scheduled callbacks. This avoids
 // a wall-clock race with the restricted child on loaded CI machines.
 const model=()=>timers.findLast(t=>t.ms>1000&&t.ms<=5000),phase=()=>timers.findLast(t=>!t.cleared&&t.ms>5000);
 const sandbox=sandboxFixture({duringRun:async()=>{
  started=true;a.equal(model()?.cleared,true,'model timer must be retired before isolated testing');a(phase(),'test phase must remain bounded');
  if(mode==='cancel')controller.abort();
  if(mode==='operation-deadline'){a(phase().ms<=60000);a(phase().ms<=operationEnd-phase().at+5);phase().fn();}
 }}),f=await setup(sandbox),input=await authorize(f);
 const provider=installProvider(f,{afterResponse:async stage=>{if(mode==='model-deadline'&&stage==='specialist'){a.equal(model()?.cleared,false);model().fn();}}});
 global.setTimeout=(fn,ms,...args)=>{const handle=oldSet(fn,ms,...args);if(insideSpecialist)timers.push({fn,ms,at:Date.now(),handle,cleared:false});return handle;};
 global.clearTimeout=handle=>{const t=timers.find(t=>t.handle===handle);if(t)t.cleared=true;return oldClear(handle);};
 transport.execute=async args=>{if(args.stage!=='specialist')return original(args);insideSpecialist=true;operationEnd=Date.now()+60000;try{return await original({...args,timeoutMs:5000,...(mode==='operation-deadline'?{operationDeadlineAt:operationEnd}:{})});}finally{insideSpecialist=false;}};
 try{
  if(mode==='separate-phase'){
   const result=await f.control.run(owner,input,{signal:controller.signal});a.equal(result.result.receipts.length,5);a.equal(result.result.receipts[1].sourceTestEvidence.receipt.status,'completed');a.equal(result.result.receipts[4].response.auditDecision,'fail');a.equal(provider.calls.length,10);
  }else{await a.rejects(f.control.run(owner,input,{signal:controller.signal}));a.equal(provider.calls.length,4);a.equal(f.state().operations.workflows[0].results.length,1);}
  a.equal(started,mode!=='model-deadline');a.deepEqual(sandbox.counts(),mode==='model-deadline'?{starts:0,stops:0}:{starts:1,stops:1});
  const state=f.state();a.equal(state.operations.approvals[0].status,'revoked');a(state.operations.grants.every(g=>g.revoked));a(state.operations.workflows[0].attempts.every(r=>r.closed));a.equal(state.operations.workflows[0].leaseUntil,0);
 }finally{transport.execute=original;global.setTimeout=oldSet;global.clearTimeout=oldClear;provider.restore();}
});
