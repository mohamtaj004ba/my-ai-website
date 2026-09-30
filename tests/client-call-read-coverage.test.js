const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');

function fixture(raw){
  const start=api.indexOf('async function callsViewed('),end=api.indexOf('\nasync function callViewedMark(',start);
  assert.ok(start>=0&&end>start,'calls-viewed handler exists');
  let status=0,payload;
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'client',email:'owner@example.test'}),callViewedKey:()=> 'viewed',kv:{get:async()=>raw},
    req:{},res:{status(n){status=n;return this},json(x){payload=x;return x}},Array,String,Math
  });
  vm.runInContext(api.slice(start,end),ctx);
  return async()=>{await vm.runInContext('callsViewed(req,res)',ctx);return {status,payload}};
}
test('call opened-state read fails closed on malformed storage instead of returning no opened calls',async()=>{
  const r=await fixture({bad:true})();assert.equal(r.status,503);assert.match(r.payload.error,/preserved/);
});
test('2,000 retained opened-call ids disclose bounded read coverage',async()=>{
  const ids=Array.from({length:2000},(_,i)=>'call-'+i),r=await fixture(ids)();
  assert.equal(r.status,200);assert.equal(r.payload.ids.length,2000);assert.equal(r.payload.coverage.limited,true);assert.equal(r.payload.coverage.limit,2000);
});
test('Calls UI explains unverified or bounded opened-state history',()=>{
  assert.match(html,/id="callsReadCoverage"[^>]*role="status"/);
  assert.match(dashboard,/Opened\/not-opened tracking could not be refreshed/);
  assert.match(dashboard,/most recently opened calls/);
});
test('fallback loading preserves prior opened-call state when read-state refresh fails',()=>{
  assert.doesNotMatch(dashboard,/catch\(_\)\{callViewedIds=new Set\(\)\}/);
  assert.match(dashboard,/catch\(_\)\{callViewedCoverage=\{\.\.\.callViewedCoverage,verified:false\}\}/);
});
