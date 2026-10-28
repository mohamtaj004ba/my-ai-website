'use strict';
// Actual owner-controller and CAS integration with synthetic HTTP fixtures only.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const control=require('../lib/agent-operations-activation-controller'),transport=require('../lib/agent-operations-engineering-transport');
function helpers(){const s=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-owner-control-qa.test.js'),'utf8');return new Function('require','__dirname',s.slice(0,s.indexOf("test('"))+'\nreturn {setup,activated,native,owner};')(require,__dirname);}
test('actual owner controller alone manages all five stage capabilities and atomic interstage/terminal renewals',async()=>{
 const {setup,activated,native,owner}=helpers(),f=await setup(),active=await activated(f),calls=[],tokens=[],acks=[];
 const oldFetch=global.fetch,oldInterval=global.setInterval,oldExecute=transport.execute;let nestedPumps=0;
 global.fetch=native(f,calls);global.setInterval=(fn,ms,...rest)=>{if(ms===5000)nestedPumps++;return oldInterval(fn,ms,...rest);};
 transport.execute=async args=>{
  a.equal(control.managedStageMatches(args.managedLiveness,args),true);
  a.equal(control.managedStageMatches({...args.managedLiveness},args),false);
  for(const changed of [{broker:{...args.broker}},{actor:{...args.actor,id:'foreign'}},{actor:{...args.actor,workspaceId:'foreign'}},{stage:'foreign'},{context:{...args.context,assignment:'changed'}},{approval:{...args.approval,maxCalls:4}},{signal:new AbortController().signal}])a.equal(control.managedStageMatches(args.managedLiveness,{...args,...changed}),false);
  tokens.push({token:args.managedLiveness,args});
  const result=await oldExecute(args);if(tokens.length===5){const s=f.h.state(),w=s.operations.workflows[0],r=s.operations.approvals[0];console.log(JSON.stringify({terminalObservation:{approvalStatus:r.status,approvalLease:r.leaseUntil,workflowStatus:w.status,workflowLease:w.leaseUntil,open:w.attempts.filter(x=>!x.closed).length,results:w.results.length,grants:s.operations.grants.map(g=>({revoked:g.revoked,approvalId:g.approvalId}))}}));}const ack=await f.h.broker.renewApproval(owner,f.context,f.ap);acks.push(ack);
  if(acks.length<5){a(Number.isFinite(ack.leaseUntil));a(ack.leaseUntil>Date.now());a.equal(f.h.state().operations.workflows[0].leaseUntil,0);}else a.deepEqual(ack,{authorityEnded:true});
  return result;
 };
 try{const result=await f.control.run(owner,{...f.input,expectedApprovalRevision:active.revision});a.equal(result.result.receipts.length,5);a.equal(calls.length,10);a.equal(nestedPumps,0);a.equal(tokens.length,5);for(const {token,args}of tokens)a.equal(control.managedStageMatches(token,args),false);a.equal(result.shutdown.status,'revoked');a(f.h.state().operations.grants.every(g=>g.revoked));a.equal(f.h.state().operations.workflows[0].leaseUntil,0);}finally{global.fetch=oldFetch;global.setInterval=oldInterval;transport.execute=oldExecute;}
});
for(const deny of [false,true])test('one actual outer heartbeat '+(deny?'denial aborts the in-flight stage':'renews approval and stage beyond original sixty-second lease'),async()=>{
 const {setup,activated,native,owner}=helpers(),f=await setup(),active=await activated(f),calls=[];
 const oldFetch=global.fetch,oldTimeout=global.setTimeout,oldNow=Date.now;let offset=0,renewCallback,renewHandle,checked=false;
 Date.now=()=>oldNow()+offset;
 global.setTimeout=(fn,ms,...args)=>{const handle=oldTimeout(fn,ms,...args);if(ms===10000){renewCallback=fn;renewHandle=handle;}return handle;};
 const nativeFetch=native(f,calls);
 global.fetch=async(url,options)=>{
  if(url.endsWith('/responses')&&!checked){checked=true;const originalLease=f.h.state().operations.workflows[0].leaseUntil;
   for(let n=0;n<(deny?1:5);n++){
    const before=f.h.state().operations.workflows[0].leaseUntil;offset+=15000;a.equal(typeof renewCallback,'function');if(deny)f.h.deny();clearTimeout(renewHandle);renewCallback();
    for(let i=0;i<200;i++){await new Promise(setImmediate);if(deny?options.signal.aborted:f.h.state().operations.workflows[0].leaseUntil>before)break;}
    if(deny){a.equal(options.signal.aborted,true);throw Object.assign(Error('Synthetic cancelled fixture'),{name:'AbortError'});}
    const state=f.h.state();a(state.operations.workflows[0].leaseUntil>before);a(state.operations.approvals[0].leaseUntil>Date.now());a(state.operations.workflows[0].leaseUntil>Date.now());
   }
   a(Date.now()>originalLease);a(offset>=75000);
  }
  return nativeFetch(url,options);
 };
 try{if(deny){await a.rejects(f.control.run(owner,{...f.input,expectedApprovalRevision:active.revision}));a.equal(calls.filter(x=>x.endsWith('/responses')).length,0);}else{const result=await f.control.run(owner,{...f.input,expectedApprovalRevision:active.revision});a.equal(result.result.receipts.length,5);a.equal(calls.length,10);}a(checked);a.equal(f.h.state().operations.approvals[0].status,'revoked');a(f.h.state().operations.grants.every(g=>g.revoked));a.equal(f.h.state().operations.workflows[0].leaseUntil,0);}finally{global.fetch=oldFetch;global.setTimeout=oldTimeout;Date.now=oldNow;}
});
