'use strict';
// Actual broker/CAS fixtures only; no network, provider credential or inference.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function helpers(){const s=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-approval-control-qa.test.js'),'utf8');return new Function('require','__dirname',s.slice(0,s.indexOf("test('"))+'\nreturn {fixture,owner,approval};')(require,__dirname);}
const {fixture,owner,approval}=helpers();
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function setup(consumed=false){const h=fixture({paid:true}),c=h.context('chief-plan'),ap=approval(h,c),prepared=await h.broker.prepareApproval(owner,c,ap);await h.broker.activateApproval(owner,c,ap,prepared.record.revision);const admitted=consumed?await h.broker.admit(owner,'chief-plan',c,{mode:'pilot',approval:ap}):null;return{h,c,ap,admitted};}

test('fresh active and consumed approvals revalidate without redundant writes; engineering 50s remaining-lease renewal boundary is bounded',async()=>{
 for(const consumed of [false,true]){const {h,c,ap}=await setup(consumed);h.advance(9999);const before=h.raw(),count=h.compares(),compare=h.adapter.compare,calls=[];h.adapter.compare=async(b,n)=>{calls.push([b,n]);return compare(b,n);};const v=await h.broker.renewApproval(owner,c,ap);a.equal(h.raw(),before);a.equal(h.compares(),count+1);a.deepEqual(calls,[[before,before]]);a.equal(v.leaseUntil,h.now()+50001);h.advance(1);const renewed=await h.broker.renewApproval(owner,c,ap);a.equal(renewed.leaseUntil,h.now()+60000);a.equal(h.compares(),count+2);a.equal(renewed.executionAuthorized,false);}
});

test('fresh lease never bypasses current policy, owner, revocation or expiry checks',async()=>{
 for(const fault of ['policy','owner','revoked','expired']){const {h,c,ap}=await setup();if(fault==='policy')h.deny();if(fault==='revoked')await h.broker.revokeApproval(owner,c,ap);if(fault==='expired')h.advance(60001);const before=h.raw();await a.rejects(h.broker.renewApproval(fault==='owner'?{...owner,workspaceId:'other'}:owner,c,ap));a.equal(h.raw(),before);}
});

test('aborted renewal cannot mutate after overlapping delayed authority validation',async()=>{
 for(const preAborted of [false,true]){const {h,c,ap}=await setup(),started=deferred(),gate=deferred(),controller=new AbortController();let checks=0;const broker=h.organization.engineering(async()=>{checks++;started.resolve();await gate.promise;});const before=h.raw(),count=h.compares();if(preAborted)controller.abort();const pending=broker.renewApproval(owner,c,ap,{signal:controller.signal});if(!preAborted){await started.promise;controller.abort();}gate.resolve();await a.rejects(pending,/ENG_TRANSPORT_CANCELLED/);a.equal(h.raw(),before);a.equal(h.compares(),count);a.equal(checks,preAborted?0:1);}
});

test('aborted renewal during ledger read cannot enter the mutation callback',async()=>{
 const {h,c,ap}=await setup();h.advance(10000);const started=deferred(),gate=deferred(),read=h.adapter.read,controller=new AbortController();h.adapter.read=async()=>{started.resolve();await gate.promise;return read();};const before=h.raw(),count=h.compares(),pending=h.broker.renewApproval(owner,c,ap,{signal:controller.signal});await started.promise;controller.abort();gate.resolve();await a.rejects(pending,/ENG_TRANSPORT_CANCELLED/);a.equal(h.raw(),before);a.equal(h.compares(),count);
});

test('in-flight renewal CAS cannot resurrect concurrent revocation or retry after cancellation',async()=>{
 const {h,c,ap}=await setup();h.advance(10000);const started=deferred(),gate=deferred(),compare=h.adapter.compare,controller=new AbortController();let intercept=true;h.adapter.compare=async(before,after)=>{if(intercept){intercept=false;started.resolve();await gate.promise;}return compare(before,after);};const pending=h.broker.renewApproval(owner,c,ap,{signal:controller.signal});await started.promise;controller.abort();await h.broker.revokeApproval(owner,c,ap);const revoked=h.raw(),count=h.compares();gate.resolve();await a.rejects(pending,/ENG_TRANSPORT_CANCELLED/);a.equal(h.raw(),revoked);a.equal(h.compares(),count+1);const r=h.state().operations.approvals[0];a.equal(r.status,'revoked');a.equal(r.leaseUntil,0);
});

test('a transmitted renewal may commit after cancellation but cannot issue a confirmation; explicit revocation fences it',async()=>{
 const {h,c,ap}=await setup();h.advance(10000);const started=deferred(),gate=deferred(),compare=h.adapter.compare,controller=new AbortController();let intercept=true;h.adapter.compare=async(before,after)=>{if(intercept){intercept=false;started.resolve();await gate.promise;}return compare(before,after);};const pending=h.broker.renewApproval(owner,c,ap,{signal:controller.signal});await started.promise;controller.abort();gate.resolve();await a.rejects(pending,/ENG_TRANSPORT_CANCELLED/);a.equal(h.state().operations.approvals[0].leaseUntil,h.now()+60000);await h.broker.revokeApproval(owner,c,ap);a.equal(h.state().operations.approvals[0].status,'revoked');a.equal(h.state().operations.approvals[0].leaseUntil,0);
});

test('stage heartbeat honors cancellation after authority checks and remains fenced against revocation',async()=>{
 const {h,admitted}=await setup(true),started=deferred(),gate=deferred(),controller=new AbortController(),broker=h.organization.engineering(async()=>{started.resolve();await gate.promise;});const pending=broker.verify(admitted.ticket,admitted.context,{renew:true,signal:controller.signal});await started.promise;controller.abort();await h.broker.revoke(admitted.ticket);const before=h.raw(),count=h.compares();gate.resolve();await a.rejects(pending,/ENG_TRANSPORT_CANCELLED/);a.equal(h.raw(),before);a.equal(h.compares(),count);
});

test('overlapping stage and owner checks preserve count evidence and skip only a redundant approval write',async()=>{
 const {h,c,ap,admitted}=await setup(true);await h.broker.dispatchCount(admitted.ticket,admitted.context);h.advance(5000);await h.broker.verify(admitted.ticket,admitted.context,{renew:true});const before=h.raw(),count=h.compares(),compare=h.adapter.compare,calls=[];h.adapter.compare=async(b,n)=>{calls.push([b,n]);return compare(b,n);};await h.broker.renewApproval(owner,c,ap);a.equal(h.raw(),before);a.equal(h.compares(),count+1);a.deepEqual(calls,[[before,before]]);const w=h.state().operations.workflows[0];a.equal(w.countCalls,1);a.equal(w.calls,0);a.equal(w.attempts[0].countDispatched,true);a.equal(w.leaseUntil,h.now()+60000);await h.broker.revokeApproval(owner,c,ap);a.equal(h.state().operations.approvals[0].status,'revoked');
});
