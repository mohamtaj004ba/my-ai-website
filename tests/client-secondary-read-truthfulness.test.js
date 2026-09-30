const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

function handler(name,next,{value=null,feature=true,workspace={id:'client',plan:'Growth'}}={}){
  const start=source.indexOf('async function '+name+'('),end=source.indexOf('\nasync function '+next+'(',start);
  assert.ok(start>=0&&end>start,name+' handler found');
  let status=0,payload;
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'client'}),
    requireFeature:async()=>feature?{session:{workspaceId:'client'},workspace}:null,
    kv:{get:async key=>key==='workspace:client'?workspace:value},
    entitlementsFor:()=>({locations:2}),req:{},res:{status(n){status=n;return this},json(x){payload=x;return x}},
    Array,Promise
  });
  vm.runInContext(source.slice(start,end),ctx);
  return async()=>{await vm.runInContext(name+'(req,res)',ctx);return {status,payload}};
}
for(const [name,next,key] of [
  ['calls','leads','calls'],['leads','updateLead','leads'],['appointments','updateAppointment','appointments'],
  ['locations','saveLocations','locations'],['automations','saveAutomations','automations']
]){
  test(name+' read refuses malformed storage instead of returning a fake empty array',async()=>{
    const r=await handler(name,next,{value:{corrupt:true}})();
    assert.equal(r.status,503);assert.match(r.payload.error,/No empty|unavailable/i);
  });
}
test('valid absent secondary records still return authorized empty arrays',async()=>{
  for(const [name,next,key] of [['calls','leads','calls'],['leads','updateLead','leads'],['appointments','updateAppointment','appointments'],['locations','saveLocations','locations'],['automations','saveAutomations','automations']]){
    const r=await handler(name,next,{value:null})();
    assert.equal(r.status,200);assert.ok(Array.isArray(r.payload[key]));assert.equal(r.payload[key].length,0);
  }
});
test('automation save refuses more than 20 records rather than silently dropping extras',()=>{
  const start=source.indexOf('async function saveAutomations('),end=source.indexOf('\nasync function conversations(',start),block=source.slice(start,end);
  assert.match(block,/incoming\.length>20/);
  assert.doesNotMatch(block,/incoming\.slice\(0,20\)/);
  assert.match(dashboard,/20-automation limit/);
});
test('advanced analytics refuses malformed source arrays instead of reporting zero activity',()=>{
  const start=source.indexOf('async function analytics('),end=source.indexOf('\nasync function settings(',start),block=source.slice(start,end);
  assert.match(block,/Analytics source records are unavailable/);
  assert.doesNotMatch(block,/Array\.isArray\(calls\)\?calls:\[\]/);
});
