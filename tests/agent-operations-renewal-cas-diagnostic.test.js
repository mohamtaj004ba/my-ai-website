'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-approval-control-qa.test.js'),'utf8');
const {fixture,owner,approval}=new Function('require','__dirname',source.slice(0,source.indexOf("test('"))+'\nreturn {fixture,owner,approval};')(require,__dirname);
const diagnostic=require('../lib/agent-operations-renewal-diagnostic'),{withActivation}=require('../lib/agent-operations-activation-controller'),failure=require('../lib/agent-operations-engineering-failure');
async function setup(){const h=fixture({paid:true}),c=h.context('chief-plan'),ap=approval(h,c),p=await h.broker.prepareApproval(owner,c,ap);await h.broker.activateApproval(owner,c,ap,p.record.revision);return{h,c,ap};}
for(const mutation of [false,true]){
 test('five CAS conflicts preserve state and classify exhaustion; mutating='+mutation,async()=>{
  const {h,c,ap}=await setup();if(mutation)h.advance(10000);let checks=0,compares=0;const broker=h.organization.engineering(async()=>{checks++;}),trace=diagnostic.trace(),before=h.raw();
  h.adapter.compare=async()=>{compares++;return false;};
  await a.rejects(broker.renewApproval(owner,c,ap,{onPhase:trace.report}),/Concurrent policy update/);
  a.equal(checks,5);a.equal(compares,5);a.equal(h.raw(),before);a.equal(trace.snapshot().phase,'ledger-cas-exhausted');
 });
 test('adapter rejection is distinct from CAS contention without retaining exception text; mutating='+mutation,async()=>{
  const {h,c,ap}=await setup();if(mutation)h.advance(10000);const before=h.raw(),trace=diagnostic.trace();let compares=0;
  h.adapter.compare=async()=>{compares++;throw Error('Bearer PRIVATE_STORAGE_CONTENT');};
  await a.rejects(h.broker.renewApproval(owner,c,ap,{onPhase:trace.report}),/PRIVATE_STORAGE_CONTENT/);
  a.equal(compares,1);a.equal(h.raw(),before);a.equal(trace.snapshot().phase,'ledger-cas-error');a(!JSON.stringify(trace.snapshot()).includes('PRIVATE'));
 });
}
test('deadline guard failure cannot reach CAS or be mislabeled as storage rejection',async()=>{
 const {h,c,ap}=await setup(),before=h.raw(),compares=h.compares(),trace=diagnostic.trace(),controller=new AbortController();
 await a.rejects(h.broker.renewApproval(owner,c,ap,{signal:controller.signal,onPhase:phase=>{trace.report(phase);if(phase==='ledger-cas')controller.abort();}}),/ENG_TRANSPORT_CANCELLED/);
 a.equal(trace.snapshot().phase,'ledger-cas-guard-denied');a.equal(h.compares(),compares);a.equal(h.raw(),before);
});
test('confirmed conflicts repeat fresh authorization and preserve concurrent data before eventual renewal',async()=>{
 const {h,c,ap}=await setup();h.advance(10000);const compare=h.adapter.compare;let calls=0,checks=0,conflicts=0;
 h.adapter.compare=async(before,after)=>{if(++calls<=2){const s=h.state();s.revision++;s.concurrentFixture=calls;h.set(s);return false;}return compare(before,after);};
 const broker=h.organization.engineering(async()=>{checks++;}),result=await broker.renewApproval(owner,c,ap,{onPhase:phase=>{if(phase==='ledger-cas-conflict')conflicts++;}});
 a.equal(checks,3);a.equal(conflicts,2);a.equal(h.state().concurrentFixture,2);a.equal(result.leaseUntil,h.now()+60000);a.equal(result.executionAuthorized,false);
});
test('outer controller preserves classified broker failure and revokes before publishing sanitized diagnostic',async()=>{
 const {h,c,ap}=await setup(),compare=h.adapter.compare;let reason,revoked=0;
 await a.rejects(withActivation({durationMs:1000,renewMs:1,prepare:async()=>({}),activate:async()=>{},renew:async(_,{onPhase})=>{
  h.adapter.compare=async()=>{throw Error('Bearer PRIVATE_PROVIDER_ERROR');};
  try{return await h.broker.renewApproval(owner,c,ap,{onPhase});}finally{h.adapter.compare=compare;}
 },run:async(_,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{reason=signal.reason;reject(Error('stopped'));},{once:true})),revoke:async()=>{await h.broker.revokeApproval(owner,c,ap);revoked++;},readback:async()=>({paidExecution:false,replacementPaidExecution:false})}));
 a.equal(revoked,1);a.equal(reason.renewal.phase,'ledger-cas-error');a.equal(reason.code,'ENG_ACTIVATION_RENEW_FAILED');
 const d=failure.failure(Error('private'),{stage:'chief-plan',phase:'authority',stopReason:'cancelled',authorityReason:reason,providerStarted:false,countStarted:true,mode:'pilot'});
 a.equal(d.renewal.phase,'ledger-cas-error');a.equal(d.requestAttempted,false);a.equal(d.billingExposurePossible,true);a(!JSON.stringify(d).includes('PRIVATE'));a.equal(h.state().operations.approvals[0].status,'revoked');
});
