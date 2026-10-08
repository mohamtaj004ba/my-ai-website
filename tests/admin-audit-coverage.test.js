const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('admin-dashboard.html','utf8');

function fixture(auditRaw){
  const start=api.indexOf('async function adminTechSupport('),end=api.indexOf('\nasync function adminSendClientLogin(',start);
  let status=0,payload;
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),cleanEmail:x=>x,
    kv:{get:async key=>key==='workspace:client'?{id:'client',ownerEmail:'owner@example.test',status:'active'}:key==='user:email:owner@example.test'?{workspaceId:'client',role:'owner'}:key==='audit:client'?auditRaw:null},
    getWorkspaceConfigSnapshot:async()=>({phone:null,agent:null,settings:{},locations:[]}),entitlementsFor:()=>({}),
    req:{query:{id:'client'}},res:{status(n){status=n;return this},json(x){payload=x;return x}},Array,Number,Promise
  });
  vm.runInContext(api.slice(start,end),ctx);
  return async()=>{await vm.runInContext('adminTechSupport(req,res)',ctx);return {status,payload}};
}
test('admin tech support labels the 100-entry response window and 200-event retention boundary',async()=>{
  const events=Array.from({length:200},(_,i)=>({id:'event-'+i,at:i})),r=await fixture(events)();
  assert.equal(r.status,200);assert.equal(r.payload.audit.length,100);
  assert.deepEqual(JSON.parse(JSON.stringify(r.payload.auditCoverage)),{verified:true,returned:100,retained:200,returnLimited:true,retentionLimited:true,retentionLimit:200});
});
test('malformed audit storage does not masquerade as a verified empty audit trail',async()=>{
  const r=await fixture({corrupt:true})();assert.equal(r.status,200);assert.equal(r.payload.audit.length,0);assert.equal(r.payload.auditCoverage.verified,false);
});
test('admin drawer exposes audit coverage and suppresses false empty state when audit verification fails',()=>{
  assert.match(html,/id="adminAuditCoverage"[^>]*role="status"/);
  assert.match(dashboard,/Audit history could not be verified/);
  assert.match(dashboard,/Audit storage retains the 200 most recent events/);
  assert.match(dashboard,/empty\.hidden=audit\.length!==0\|\|coverage\.verified===false/);
});
