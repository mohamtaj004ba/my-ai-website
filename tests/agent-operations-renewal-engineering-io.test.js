'use strict';
const test=require('node:test'),a=require('node:assert/strict');
const {withActivation}=require('../lib/agent-operations-activation-controller');
// Virtual wall time reproduces the observed26313ms without provider/network I/O.
async function replay({leaseMs=60000,elapsed=26313,seedRemaining=60000,expiresIn=120000,explicit,abort=false}={}){
 const original=Date.now;let now=original(),runStarted=false,revokes=0,reads=0,renewals=0,deadline,finish;
 const base=now,done=new Promise(r=>finish=r),controller=new AbortController();Date.now=()=>now;
 try{
  const result=await withActivation({leaseMs,leaseUntil:base+seedRemaining,authorityExpiresAt:base+expiresIn,durationMs:120000,renewMs:1,...(explicit===undefined?{}:{renewTimeoutMs:explicit}),signal:controller.signal,
   prepare:async()=>({}),activate:async()=>({leaseUntil:base+seedRemaining}),
   renew:async(_,{deadlineAt})=>{renewals++;deadline=deadlineAt;now+=elapsed;if(abort)controller.abort();finish();return{leaseUntil:Math.min(now+leaseMs,base+expiresIn)};},
   run:async()=>{runStarted=true;await done;await new Promise(r=>setImmediate(r));return true;},
   revoke:async()=>{revokes++;},readback:async()=>{reads++;return{paidExecution:false,replacementPaidExecution:false};}
  });return{ok:true,result,renewals,revokes,reads,deadline,base,runStarted};
 }catch(error){return{ok:false,error,renewals,revokes,reads,deadline,base,runStarted};}
 finally{Date.now=original;finish?.();}
}
test('60s engineering lease accepts observed26.313s renewal under45s I/O window',async()=>{
 const r=await replay();a.equal(r.ok,true);a.equal(r.renewals,1);a.equal(r.revokes,1);a.equal(r.reads,1);a(r.deadline>=r.base+45000);a(r.deadline<=r.base+59000);
});
test('legacy30s policy still rejects observed26.313s renewal without late authority',async()=>{
 const r=await replay({leaseMs:30000,seedRemaining:30000});a.equal(r.ok,false);a.equal(r.revokes,1);a.equal(r.reads,1);a(r.deadline<=r.base+25001);
});
test('engineering allowance cannot outlive last acknowledged lease or immutable expiry',async()=>{
 for(const options of [{seedRemaining:2000,elapsed:26313},{expiresIn:2000,seedRemaining:2000,elapsed:26313},{elapsed:46000}]){const r=await replay(options);a.equal(r.ok,false);a.equal(r.revokes,1);a.equal(r.reads,1);if(options.seedRemaining===2000){a.equal(r.runStarted,false);a(r.deadline<=r.base+1000);}}
});
test('cancellation during longer engineering renewal cannot accept its acknowledgment',async()=>{const r=await replay({seedRemaining:2000,elapsed:100,abort:true});a.equal(r.ok,false);a.equal(r.runStarted,false);a.equal(r.revokes,1);a.equal(r.reads,1);});
test('larger budgets are denied for both legacy and engineering lease policies',async()=>{
 for(const options of [{leaseMs:30000,explicit:25001},{leaseMs:60000,explicit:45001}]){const r=await replay(options);a.equal(r.ok,false);a.match(r.error.message,/Renewal deadline required/);a.equal(r.renewals,0);a.equal(r.runStarted,false);}
});
test('explicit malformed renewal budgets never default or reach preparation',async()=>{
 for(const leaseMs of [30000,60000])for(const explicit of [null,NaN,1.5,'45000',false]){const r=await replay({leaseMs,explicit});a.equal(r.ok,false);a.match(r.error.message,/Renewal deadline required/);a.equal(r.renewals,0);a.equal(r.runStarted,false);a.equal(r.revokes,0);}
});
test('actual26.5second renewal completes inside unchanged60second acknowledged lease',async()=>{
 const started=Date.now(),seed=started+60000;let finish,calls=0,revokes=0,deadline;
 const done=new Promise(r=>finish=r);
 await withActivation({leaseMs:60000,leaseUntil:seed,authorityExpiresAt:started+120000,durationMs:35000,renewMs:1,
  prepare:async()=>({}),activate:async()=>({leaseUntil:seed}),
  renew:async(_,{deadlineAt})=>{calls++;deadline=deadlineAt;await new Promise(r=>setTimeout(r,26500));finish();return{leaseUntil:Date.now()+60000};},
  run:async()=>{await done;await new Promise(r=>setImmediate(r));return true;},revoke:async()=>{revokes++;},readback:async()=>({paidExecution:false,replacementPaidExecution:false})
 });a.equal(calls,1);a.equal(revokes,1);a(deadline<=seed-1000);a(deadline>started+26500);a(Date.now()-started>=26500);
});
