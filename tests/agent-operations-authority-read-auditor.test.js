'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),ops=require('../lib/agent-operations-operating-system');
function fixture(){
 const actor={kind:'owner',verifiedOwner:true,id:'authority-review-owner',workspaceId:'authority-review-workspace'},runtime={environment:'preview',origin:'https://authority-review.vercel.app',commit:'a'.repeat(40),branch:'feature/callercore-dashboards',deploymentId:'dpl_review'};
 let raw=null,allowed=true,reads=0,ledgerReads=0,writes=0;
 const api=ops.createOperations({runtime,assertOwner:async()=>allowed,kv:{get:async()=>{reads++;return raw;},eval:async()=>{writes++;throw Error('No write allowed');}},ledgerAdapter:{read:async()=>{ledgerReads++;throw Error('Monitoring must not run');}}});
 return{actor,runtime,api,setRaw:v=>raw=JSON.stringify(v),deny:()=>allowed=false,stats:()=>({reads,ledgerReads,writes}),state:()=>ops.validate(raw,actor)};
}
test('internal authority read authenticates freshly and avoids monitoring ledger reads or writes',async()=>{
 const f=fixture(),first=await f.api.readAuthority(f.actor);a.deepEqual(Object.keys(first).sort(),['capacity','plans','scopeIdentity']);a.equal(first.plans.length,0);a.deepEqual(f.stats(),{reads:1,ledgerReads:0,writes:0});f.deny();await a.rejects(f.api.readAuthority(f.actor),/OPS_OWNER_REQUIRED/);a.equal(f.stats().reads,1);
});
for(const fault of ['foreign-owner','foreign-workspace','audit'])test('internal authority read retains complete scoped state validation: '+fault,async()=>{
 const f=fixture(),s=f.state();if(fault==='foreign-owner')s.ownerHash='b'.repeat(64);if(fault==='foreign-workspace')s.workspaceHash='b'.repeat(64);if(fault==='audit')s.audit.push({sequence:1,previousHash:null,hash:'b'.repeat(64)});f.setRaw(s);await a.rejects(f.api.readAuthority(f.actor),/OPS_STATE_INVALID|OPS_AUDIT_INVALID/);a.equal(f.stats().ledgerReads,0);a.equal(f.stats().writes,0);
});
test('internal authority read rejects changed non-Preview runtime without accessing storage',async()=>{const f=fixture();f.runtime.environment='production';await a.rejects(f.api.readAuthority(f.actor),/OPS_PREVIEW_REQUIRED/);a.deepEqual(f.stats(),{reads:0,ledgerReads:0,writes:0});});
test('returned authority plans are isolated copies and rich read remains monitoring-dependent',async()=>{const f=fixture(),s=f.state();f.setRaw(s);const v=await f.api.readAuthority(f.actor);v.plans.push({id:'forged'});a.equal((await f.api.readAuthority(f.actor)).plans.length,0);await a.rejects(f.api.read(f.actor),/OPS_STORAGE_UNCONFIRMED/);a.equal(f.stats().ledgerReads,1);a.equal(f.stats().writes,0);});
