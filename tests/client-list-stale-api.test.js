const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8');
const locStart=api.indexOf('async function saveLocations(');
const locEnd=api.indexOf('\n\nasync function workspace(',locStart);
const autoStart=api.indexOf('async function saveAutomations(');
const autoEnd=api.indexOf('\n\nasync function conversations(',autoStart);
assert.ok(locStart>=0&&locEnd>locStart&&autoStart>=0&&autoEnd>autoStart);
const locationSource=api.slice(locStart,locEnd);
const automationSource=api.slice(autoStart,autoEnd);

function response(){
  let code=0,data=null;
  return {res:{status(n){code=n;return this},json(x){data=x;return x}},read:()=>({code,data})};
}
function clone(x){return x==null?x:JSON.parse(JSON.stringify(x))}

function locationFixture(expectedLocations,{stored=[{id:'loc-1',name:'Main',phone:'',address:'',timezone:'America/Los_Angeles',active:true,updatedAt:10}]}={}){
  const r=response(),writes=[];
  const body={locations:[{id:'loc-1',name:'Main edited',phone:'',address:'',timezone:'America/Los_Angeles',active:true}],expectedLocations};
  const ctx=vm.createContext({
    req:{body},res:r.res,
    requireWritableSession:async()=>({workspaceId:'ws-1',email:'owner@example.test',role:'owner'}),
    requireOperationalWorkspace:async()=>true,
    kv:{get:async key=>key==='workspace:ws-1'?{id:'ws-1',plan:'Growth'}:key==='locations:ws-1'?clone(stored):null},
    entitlementsFor:()=>({plan:'Growth',locations:5}),
    compareAndAudit:async(_kv,update,auditKey,audit)=>{writes.push({update:clone(update),auditKey,audit:clone(audit)});return true},
    crypto:{randomUUID:()=> 'new-location'},safeError:()=>'',console:{error(){}},
    Date:{now:()=>20},JSON,Object,Array,String,Number,Set
  });
  vm.runInContext(locationSource,ctx);
  return {run:async()=>{await vm.runInContext('saveLocations(req,res)',ctx);return r.read()},writes};
}

test('location full-list save rejects a stale displayed snapshot before audited write',async()=>{
  const f=locationFixture([{id:'loc-1',name:'Older',updatedAt:9}]),out=await f.run();
  assert.equal(out.code,409);assert.match(out.data.error,/changed after this page loaded/i);assert.equal(f.writes.length,0);
});

test('location full-list save accepts the exact displayed snapshot',async()=>{
  const stored=[{id:'loc-1',name:'Main',phone:'',address:'',timezone:'America/Los_Angeles',active:true,updatedAt:10}];
  const f=locationFixture(clone(stored),{stored}),out=await f.run();
  assert.equal(out.code,200);assert.equal(out.data.ok,true);assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].audit.action,'locations_save');
});

function automationFixture(expectedAutomations,{stored=[{id:'auto-1',name:'Lead alert',trigger:'new_lead',action:'notify_team',enabled:true,updatedAt:10}]}={}){
  const r=response(),writes=[];
  const body={automations:[{id:'auto-1',name:'Lead alert edited',trigger:'new_lead',action:'notify_team',enabled:true}],expectedAutomations};
  const ctx=vm.createContext({
    req:{body},res:r.res,
    requireWritableSession:async()=>({workspaceId:'ws-1',email:'owner@example.test',role:'owner'}),
    requireOperationalWorkspace:async()=>true,
    kv:{get:async key=>key==='workspace:ws-1'?{id:'ws-1',plan:'Growth'}:key==='automations:ws-1'?clone(stored):null},
    entitlementsFor:()=>({features:{automations:true}}),
    compareAndAudit:async(_kv,update,auditKey,audit)=>{writes.push({update:clone(update),auditKey,audit:clone(audit)});return true},
    crypto:{randomUUID:()=> 'audit-auto'},safeError:()=>'',console:{error(){}},
    process:{env:{}},Date:{now:()=>20},JSON,Object,Array,String,Number,Set
  });
  vm.runInContext(automationSource,ctx);
  return {run:async()=>{await vm.runInContext('saveAutomations(req,res)',ctx);return r.read()},writes};
}

test('automation full-list save rejects a stale displayed snapshot before audited write',async()=>{
  const f=automationFixture([{id:'auto-1',name:'Older',trigger:'new_lead',action:'notify_team',enabled:true,updatedAt:9}]),out=await f.run();
  assert.equal(out.code,409);assert.match(out.data.error,/changed after this page loaded/i);assert.equal(f.writes.length,0);
});

test('automation full-list save accepts the exact displayed snapshot',async()=>{
  const stored=[{id:'auto-1',name:'Lead alert',trigger:'new_lead',action:'notify_team',enabled:true,updatedAt:10}];
  const f=automationFixture(clone(stored),{stored}),out=await f.run();
  assert.equal(out.code,200);assert.equal(out.data.ok,true);assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].audit.action,'automations_save');
});
