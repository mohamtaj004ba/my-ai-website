const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8');
const start=api.indexOf('async function saveIntegrations(');
const end=api.indexOf('\nfunction callViewedKey(',start);
assert.ok(start>=0&&end>start);
const source=api.slice(start,end);

function response(){let code=0,data=null;return{res:{status(n){code=n;return this},json(x){data=x;return x}},read:()=>({code,data})}}
function fixture(expectedUpdatedAt,{stored={webhookUrl:'https://old.test/hook',updatedAt:7}}={}){
  const r=response(),writes=[];
  const ctx=vm.createContext({
    req:{body:{webhookUrl:'https://new.test/hook',expectedUpdatedAt}},res:r.res,
    requireWritableSession:async()=>({workspaceId:'ws-1',email:'owner@example.test',role:'owner'}),
    requireOperationalWorkspace:async()=>true,
    kv:{get:async key=>key==='workspace:ws-1'?{id:'ws-1',plan:'Pro'}:key==='integrations:ws-1'?stored:null},
    entitlementsFor:()=>({features:{apiAccess:true}}),
    compareAndAudit:async(_kv,update,auditKey,audit)=>{writes.push({update,auditKey,audit});return true},
    crypto:{randomUUID:()=> 'audit-1'},safeError:()=>'',console:{error(){}},
    Date:{now:()=>10},Number,String,Object,Array,JSON
  });
  vm.runInContext(source,ctx);
  return {run:async()=>{await vm.runInContext('saveIntegrations(req,res)',ctx);return r.read()},writes};
}

test('webhook save rejects stale integration revision before audited write',async()=>{
  const f=fixture(6),out=await f.run();
  assert.equal(out.code,409);assert.match(out.data.error,/changed since this page loaded/i);assert.equal(f.writes.length,0);
});

test('webhook save accepts exact integration revision and advances it monotonically',async()=>{
  const f=fixture(7),out=await f.run();
  assert.equal(out.code,200);assert.equal(out.data.ok,true);assert.equal(f.writes.length,1);
  assert.equal(out.data.integrations.updatedAt,10);
  assert.equal(f.writes[0].audit.action,'integrations_save');
});

test('webhook save requires a revision even for an initially empty integration record',async()=>{
  const good=fixture(0,{stored:null}),a=await good.run();
  assert.equal(a.code,200);assert.equal(good.writes.length,1);
  const missing=fixture(undefined,{stored:null});delete missing;
  const r=response(),writes=[];
  const ctx=vm.createContext({
    req:{body:{webhookUrl:'https://new.test/hook'}},res:r.res,
    requireWritableSession:async()=>({workspaceId:'ws-1',email:'owner@example.test',role:'owner'}),requireOperationalWorkspace:async()=>true,
    kv:{get:async key=>key==='workspace:ws-1'?{id:'ws-1',plan:'Pro'}:null},
    entitlementsFor:()=>({features:{apiAccess:true}}),compareAndAudit:async()=>{writes.push(true);return true},
    crypto:{randomUUID:()=> 'audit'},safeError:()=>'',console:{error(){}},Date:{now:()=>10},Number,String,Object,Array,JSON
  });
  vm.runInContext(source,ctx);await vm.runInContext('saveIntegrations(req,res)',ctx);
  assert.equal(r.read().code,409);assert.equal(writes.length,0);
});

test('client bundle and integrations read expose the persisted integration revision',()=>{
  assert.match(api,/integrations:\{googleCalendar:[^\n]+updatedAt:Number\(savedIntegrations\.updatedAt\|\|0\)/);
  const getStart=api.indexOf('async function integrations('),getEnd=api.indexOf('\nasync function saveIntegrations(',getStart),block=api.slice(getStart,getEnd);
  assert.match(block,/updatedAt:Number\(saved\.updatedAt\|\|0\)/);
});
