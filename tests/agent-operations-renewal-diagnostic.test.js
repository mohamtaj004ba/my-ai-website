'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const diagnostic=require('../lib/agent-operations-renewal-diagnostic'),{withActivation}=require('../lib/agent-operations-activation-controller'),failure=require('../lib/agent-operations-engineering-failure');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
test('renewal trace accepts only closed phases and bounded integer timing without source or content',()=>{
 let now=100;const t=diagnostic.trace(()=>now);now=105;t.report('owner-revalidation');now=117;t.report('Bearer private-content');a.deepEqual(t.snapshot(),{phase:'owner-revalidation',elapsedMs:17,phaseElapsedMs:12});
 for(const value of [{phase:'secret',elapsedMs:1,phaseElapsedMs:1},{phase:'complete',elapsedMs:1,phaseElapsedMs:2},{phase:'complete',elapsedMs:-1,phaseElapsedMs:0},{phase:'complete',elapsedMs:Infinity,phaseElapsedMs:0},{phase:'complete',elapsedMs:1,phaseElapsedMs:0,raw:'secret'}])a.equal(diagnostic.sanitize(value),null);
});
for(const phase of ['owner-revalidation','ledger-transaction'])test('actual outer timeout preserves '+phase+' and still revokes before reporting',async()=>{
 let reason,revoked=0,readback=0;
 await a.rejects(withActivation({durationMs:1000,renewMs:1,renewTimeoutMs:15,prepare:async()=>({}),activate:async()=>{},renew:async(_,{onPhase})=>{onPhase(phase);return new Promise(()=>{});},run:async(_,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{reason=signal.reason;reject(Error('private exception'));},{once:true})),revoke:async()=>{revoked++;},readback:async()=>{readback++;return{paidExecution:false,replacementPaidExecution:false};}}));
 a.equal(revoked,1);a.equal(readback,1);a.equal(reason.origin,'renewal-timeout');a.equal(reason.renewal.phase,phase);a(reason.renewal.elapsedMs>=reason.renewal.phaseElapsedMs);
 const saved=failure.failure(Error('private exception'),{stage:'qa',phase:'admission',stopReason:'cancelled',authorityReason:reason,providerStarted:false,countStarted:false,mode:'pilot'});a.equal(saved.authorityCode,'ENG_ACTIVATION_RENEW_TIMEOUT');a.deepEqual(saved.renewal,reason.renewal);a.equal(saved.billingExposurePossible,false);a(!JSON.stringify(saved).includes('private'));
});
test('historical closed cancellation reasons retain readback and forged timing cannot add content',()=>{
 const reason={version:'engineering-activation-stop-v1',origin:'renewal-timeout',code:'ENG_ACTIVATION_RENEW_TIMEOUT'},args={stage:'qa',phase:'admission',stopReason:'cancelled',authorityReason:reason};a.equal(failure.failure(Error(),args).authorityCode,reason.code);a.equal(failure.failure(Error(),args).renewal,undefined);
 const forged=failure.failure(Error(),{...args,authorityReason:{...reason,renewal:{phase:'ledger-transaction',elapsedMs:1,phaseElapsedMs:0,raw:'secret'}}});a.equal(forged.authorityCode,reason.code);a.equal(forged.renewal,undefined);a(!JSON.stringify(forged).includes('secret'));
});
test('actual broker delayed owner check reports phase and cannot renew after cancellation',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-approval-control-qa.test.js'),'utf8'),{fixture,owner,approval}=new Function('require','__dirname',source.slice(0,source.indexOf("test('"))+'\nreturn {fixture,owner,approval};')(require,__dirname);
 const h=fixture({paid:true}),c=h.context('chief-plan'),ap=approval(h,c),prepared=await h.broker.prepareApproval(owner,c,ap);await h.broker.activateApproval(owner,c,ap,prepared.record.revision);
 const gate=deferred(),started=deferred(),phases=[],controller=new AbortController(),broker=h.organization.engineering(async()=>{started.resolve();await gate.promise;});const before=h.raw(),pending=broker.renewApproval(owner,c,ap,{signal:controller.signal,onPhase:p=>phases.push(p)});await started.promise;a.deepEqual(phases,['scope-validation','owner-revalidation']);controller.abort();gate.resolve();await a.rejects(pending,/ENG_TRANSPORT_CANCELLED/);a.equal(h.raw(),before);a(!phases.includes('complete'));
});
