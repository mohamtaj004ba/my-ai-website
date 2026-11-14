'use strict';
// Independent read-only authority tests. No provider, credential or network.
const {test}=require('node:test'),a=require('node:assert/strict'),ops=require('../lib/agent-operations-operating-system');
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
function fixture({ownerCheck=async()=>true,read=async()=>null}={}){
 const actor={kind:'owner',verifiedOwner:true,id:'owner-overlap-auditor',workspaceId:'workspace-overlap-auditor'},runtime={environment:'preview',origin:'https://owner-overlap.vercel.app',commit:'a'.repeat(40),branch:'feature/callercore-dashboards',deploymentId:'dpl_ownerOverlap'};let reads=0,checks=0,writes=0;
 const service=ops.createOperations({runtime,assertOwner:async who=>{checks++;return ownerCheck(who);},kv:{get:async key=>{reads++;return read(key);},eval:async()=>{writes++;throw Error('No write permitted');}},ledgerAdapter:{read:async()=>{throw Error('Monitoring forbidden');}}});
 return{actor,runtime,service,counts:()=>({reads,checks,writes})};
}

test('private scoped read overlaps fresh owner check but returns no view or proof before success',async()=>{
 const ownerGate=deferred(),ownerStarted=deferred(),readStarted=deferred(),f=fixture({ownerCheck:async()=>{ownerStarted.resolve();return ownerGate.promise;},read:async()=>{readStarted.resolve();return null;}}),request={};let settled=false;
 const pending=f.service.readAuthority(f.actor,{proofRequest:request}).finally(()=>{settled=true;});await Promise.all([ownerStarted.promise,readStarted.promise]);await new Promise(r=>setImmediate(r));a.equal(settled,false);a.equal(ops.consumeAuthorityReadProof(undefined,f.actor,f.runtime,f.service,request),false);
 ownerGate.resolve(true);const view=await pending;a.equal(view.plans.length,0);a.equal(ops.consumeAuthorityReadProof(view,f.actor,f.runtime,f.service,request),true);a.deepEqual(f.counts(),{reads:1,checks:1,writes:0});
});

test('successful private read never supplies authority after fresh owner denial',async()=>{
 const gate=deferred(),started=deferred(),f=fixture({ownerCheck:()=>gate.promise,read:async()=>{started.resolve();return null;}}),request={};const pending=f.service.readAuthority(f.actor,{proofRequest:request});await started.promise;gate.resolve(false);await a.rejects(pending,/OPS_OWNER_REQUIRED/);a.equal(f.counts().writes,0);a.equal(ops.consumeAuthorityReadProof({},f.actor,f.runtime,f.service,request),false);
});

test('private read failure cannot be hidden by later owner success or trigger writes',async()=>{
 const gate=deferred(),f=fixture({ownerCheck:()=>gate.promise,read:async()=>{throw Error('AUDITOR_READ_FAILED');}});const pending=f.service.readAuthority(f.actor);await a.rejects(pending,/AUDITOR_READ_FAILED/);gate.resolve(true);await new Promise(r=>setImmediate(r));a.equal(f.counts().writes,0);
});

test('actor workspace mutation while owner pending cannot mint a proof for another scope',async()=>{
 const gate=deferred(),started=deferred(),f=fixture({ownerCheck:()=>gate.promise,read:async()=>{started.resolve();return null;}}),request={};const pending=f.service.readAuthority(f.actor,{proofRequest:request});await started.promise;f.actor.workspaceId='different-workspace';gate.resolve(true);await a.rejects(pending,/OPS_OWNER_REQUIRED/);a.equal(f.counts().writes,0);
});

test('prefetched foreign workspace state remains rejected after genuine owner success',async()=>{
 let raw;const f=fixture({read:async()=>raw}),s=ops.validate(null,f.actor);s.workspaceHash='b'.repeat(64);raw=JSON.stringify(s);await a.rejects(f.service.readAuthority(f.actor),/OPS_STATE_INVALID/);a.equal(f.counts().writes,0);
});

test('each separate read reauthenticates freshly and minted proof consumes once',async()=>{
 const f=fixture();for(let n=0;n<2;n++){const request={},v=await f.service.readAuthority(f.actor,{proofRequest:request});a.equal(ops.consumeAuthorityReadProof(v,f.actor,f.runtime,f.service,request),true);a.equal(ops.consumeAuthorityReadProof(v,f.actor,f.runtime,f.service,request),false);}a.deepEqual(f.counts(),{reads:2,checks:2,writes:0});
});
