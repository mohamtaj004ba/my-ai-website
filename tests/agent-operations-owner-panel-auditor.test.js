'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../agent-operations-owner-verification.js'),'utf8');
function ui(fetchImpl){const nodes=new Map(),calls=[];const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:true,disabled:false});return nodes.get(id);};const window={};vm.runInNewContext(source,{document:{getElementById:get},window,crypto,Date,JSON,Number,Object,Promise,Error,AbortController,AbortSignal,setTimeout,fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);assert.equal(url,'/api/agent-operations');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');return{ok:true,status:200,json:async()=>fetchImpl(body)};}});get('ownerVerifyScenario').value='success';return{get,calls,update:window.CallerCoreOwnerVerification.update};}
const release={version:'auditor-release-v1',digest:'a'.repeat(64)},runtime={origin:'https://auditor-preview.vercel.app',commit:'b'.repeat(40)};
const eligibility=()=>({paidExecution:false,ownerVerification:{version:'nonbillable-lifecycle-verification-v1',release,runtime,maxCalls:0,maxMicros:0,expiresAt:Date.now()+60000}});
test('Auditor panel: loading and forged or expired visibility data never create records',async()=>{
 const f=ui(()=>assert.fail('unexpected request'));assert.equal(f.calls.length,0);
 for(const data of [null,{paidExecution:true,ownerVerification:eligibility().ownerVerification},{paidExecution:false,ownerVerification:{...eligibility().ownerVerification,maxCalls:1}},{paidExecution:false,ownerVerification:{...eligibility().ownerVerification,expiresAt:Date.now()-1}}]){f.update(data);await f.get('ownerVerifyRun').onclick();assert.equal(f.calls.length,0);assert.equal(f.get('agentOpsOwnerVerification').hidden,true);}
});
test('Auditor panel: foreign or nonzero-authority readbacks cannot confirm cleanup',async()=>{
 for(const mutation of ['foreign','calls','cost','release','runtime']){
  const f=ui(body=>{const id='pilot_probe_'+body.input.nonce+'_'+body.input.slot,v={id,version:'nonbillable-lifecycle-verification-v1',release,runtime,paidExecution:false,controlAuthority:false,maxCalls:0,maxMicros:0,record:{id,status:'revoked',leaseUntil:0}};
   if(mutation==='foreign')v.id=v.record.id='pilot_probe_'+'f'.repeat(32)+'_7';if(mutation==='calls')v.maxCalls=1;if(mutation==='cost')v.maxMicros=1;if(mutation==='release')v.release={...release,digest:'c'.repeat(64)};if(mutation==='runtime')v.runtime={...runtime,commit:'c'.repeat(40)};return{verification:v};});
  f.update(eligibility());await f.get('ownerVerifyCheck').onclick();assert.match(f.get('ownerVerifyCleanup').textContent,/unconfirmed/i,mutation);
 }
});
test('Auditor panel: revocation uses frozen original reference when controls are edited mid-request',async()=>{
 let original;const f=ui(body=>{const id='pilot_probe_'+body.input.nonce+'_'+body.input.slot;if(body.action==='organization-node-controller-verification'){original={nonce:body.input.nonce,slot:body.input.slot};f.get('ownerVerifyNonce').value='f'.repeat(32);f.get('ownerVerifySlot').value='7';throw Error('Interrupted original request');}assert.deepEqual(body.input.nonce,original.nonce);assert.equal(body.input.slot,original.slot);return{verification:{id,version:'nonbillable-lifecycle-verification-v1',release,runtime,paidExecution:false,controlAuthority:false,maxCalls:0,maxMicros:0,record:{id,status:'revoked',leaseUntil:0}}};});
 f.update(eligibility());await f.get('ownerVerifyRun').onclick();assert.equal(f.calls.length,3);assert.equal(f.calls[1].input.operation,'revoke');assert.equal(f.calls[2].input.operation,'check');assert.match(f.get('ownerVerifyCleanup').textContent,/^Central revocation confirmed/);
});
