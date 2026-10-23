'use strict';
// Independent finite-budget lifecycle tests; no provider/model/network.
const {test}=require('node:test'),a=require('node:assert/strict');
const {withActivation}=require('../lib/agent-operations-activation-controller');
function callbacks(extra={}){const counts={run:0,revoke:0,readback:0};return{counts,args:{prepare:async()=>({}),activate:async()=>undefined,renew:async()=>({leaseUntil:Date.now()+3000}),run:async()=>{counts.run++;return{};},revoke:async()=>{counts.revoke++;},readback:async()=>{counts.readback++;return{paidExecution:false,replacementPaidExecution:false};},...extra}};}

test('expired dynamic lease seed cannot bypass owner revocation and shutdown readback',async()=>{
 const now=Date.now(),f=callbacks();await a.rejects(withActivation({...f.args,leaseUntil:now-1,authorityExpiresAt:now+5000,durationMs:100}));
 a.equal(f.counts.run,0);a.equal(f.counts.revoke,1);a.equal(f.counts.readback,1);
});

test('returned initial renewal cannot extend beyond immutable authority expiry',async()=>{
 const now=Date.now(),f=callbacks({activate:async()=>({leaseUntil:now+3000}),renew:async()=>({leaseUntil:Date.now()+10000})});
 await a.rejects(withActivation({...f.args,leaseUntil:now+3000,authorityExpiresAt:now+5000,durationMs:100}));
 a.equal(f.counts.run,0);a.equal(f.counts.revoke,1);a.equal(f.counts.readback,1);
});

test('late initial renewal acknowledgment cannot start run after the operation deadline',async()=>{
 const now=Date.now(),f=callbacks({activate:async()=>({leaseUntil:now+5000}),renew:async()=>{await new Promise(r=>setTimeout(r,60));return{leaseUntil:Date.now()+5000};}});
 await a.rejects(withActivation({...f.args,leaseUntil:now+5000,authorityExpiresAt:now+10000,durationMs:20}));
 await new Promise(r=>setTimeout(r,65));a.equal(f.counts.run,0);a.equal(f.counts.revoke,1);a.equal(f.counts.readback,1);
});

function brokerHelpers(){const fs=require('node:fs'),path=require('node:path'),s=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-approval-control-qa.test.js'),'utf8');return new Function('require','__dirname',s.slice(0,s.indexOf("test('"))+'\nreturn {fixture,owner,approval};')(require,__dirname);}
async function activeBroker(){const {fixture,owner,approval}=brokerHelpers(),h=fixture({paid:true}),c=h.context('chief-plan'),ap=approval(h,c),p=await h.broker.prepareApproval(owner,c,ap);await h.broker.activateApproval(owner,c,ap,p.record.revision);return{h,c,ap,owner};}

for(const noOp of [true,false])test('absolute expiry at '+(noOp?'no-op':'renewing')+' CAS marker denies compare without signal delivery',async()=>{
 const {h,c,ap,owner}=await activeBroker();if(!noOp)h.advance(10000);const original=Date.now;let wall=original();const end=wall+1000,controller=new AbortController(),before=h.raw(),count=h.compares();
 Date.now=()=>wall;
 try{await a.rejects(h.broker.renewApproval(owner,c,ap,{signal:controller.signal,deadlineAt:end,onPhase:phase=>{if(phase==='ledger-cas')wall=end;}}),/ENG_TRANSPORT_CANCELLED/);a.equal(controller.signal.aborted,false);a.equal(h.compares(),count);a.equal(h.raw(),before);}finally{Date.now=original;}
});

test('absolute deadline elapsed inside fresh owner work denies mutation without timer delivery',async()=>{
 const {h,c,ap,owner}=await activeBroker();h.advance(10000);const original=Date.now;let wall=original();const end=wall+1000,controller=new AbortController(),broker=h.organization.engineering(async()=>{wall=end+1;}),before=h.raw(),count=h.compares();
 Date.now=()=>wall;
 try{await a.rejects(broker.renewApproval(owner,c,ap,{signal:controller.signal,deadlineAt:end}),/ENG_TRANSPORT_CANCELLED/);a.equal(controller.signal.aborted,false);a.equal(h.compares(),count);a.equal(h.raw(),before);}finally{Date.now=original;}
});
