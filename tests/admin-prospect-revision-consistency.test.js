const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
const start=api.indexOf('async function adminWebsiteProspectUpdate('),end=api.indexOf('async function adminProspectSave(',start);
assert.ok(start>=0&&end>start);

function backend(body,{stored={id:'lead-1',name:'Old',stage:'new',email:'old@example.test',updatedAt:10},commit=true,now=10,emailOwners={}}={}){
  let code,result,calls=0,payload,plainWrites=0,deleted=[];
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),req:{body},res:{status(n){code=n;return this},json(x){result=x;return x}},
    kv:{get:async key=>key==='site:prospect:lead-1'?stored:emailOwners[key]??null,set:async()=>{plainWrites++}},
    compareAndSetConfig:async(_kv,updates)=>{calls++;payload=updates;if(commit==='error')throw Error('Connection lost');return commit},
    compareAndSetWithDelete:async(_kv,updates,{deleteKeys=[]}={})=>{calls++;payload=updates;deleted=deleteKeys;if(commit==='error')throw Error('Connection lost');return commit},
    emailKey:x=>x,Promise,
    cleanEmail:x=>String(x||'').toLowerCase(),crypto:{randomUUID:()=> 'uuid'},safeError:()=> 'redacted',
    console:{error(){}},Date:{now:()=>now},Math,Number,String,Array
  });
  vm.runInContext(api.slice(start,end),context);
  return {run:async()=>{await vm.runInContext('adminWebsiteProspectUpdate(req,res)',context);return {code,result,calls,payload,plainWrites,deleted}}};
}
test('prospect edit requires displayed revision and compares full snapshot before write',async()=>{
  const bad=await backend({id:'lead-1',name:'Changed'}).run();
  assert.equal(bad.code,409);assert.equal(bad.calls,0);
  const stale=await backend({id:'lead-1',expectedUpdatedAt:9,name:'Changed'}).run();
  assert.equal(stale.code,409);assert.equal(stale.calls,0);
  const good=await backend({id:'lead-1',expectedUpdatedAt:10,name:'Changed'}).run();
  assert.equal(good.code,200);assert.equal(good.calls,1);assert.equal(good.plainWrites,0);
  assert.equal(good.payload[0].before.name,'Old');
  assert.equal(good.payload[0].after.name,'Changed');
  assert.equal(good.payload[0].after.updatedAt,11);
});
test('concurrent prospect change and uncertain write reject without claiming success',async()=>{
  const conflict=await backend({id:'lead-1',expectedUpdatedAt:10,stage:'qualified'},{commit:false}).run();
  assert.equal(conflict.code,409);assert.equal(conflict.plainWrites,0);
  const uncertain=await backend({id:'lead-1',expectedUpdatedAt:10,stage:'qualified'},{commit:'error'}).run();
  assert.equal(uncertain.code,503);assert.equal(uncertain.plainWrites,0);
});
test('all admin prospect edit paths submit displayed revisions and guard pending modal',()=>{
  const pipeline=ui.slice(ui.indexOf('async function moveGrowthProspectStage('),ui.indexOf('function toLocalDateTimeInput('));
  const editor=ui.slice(ui.indexOf('let prospectModalPending=false;'),ui.indexOf('let adminCampaignMutationPending=false;'));
  const quick=ui.slice(ui.indexOf('async function updateWebsiteProspect('),ui.indexOf('async function loadAdminInbox(',ui.indexOf('async function updateWebsiteProspect(')));
  assert.match(pipeline,/JSON\.stringify\(\{id,stage,expectedUpdatedAt\}\)/);
  assert.match(pipeline,/prospectStagePending\.has\(String\(id\)\)/);
  assert.match(editor,/m\.dataset\.expectedUpdatedAt/);
  assert.match(editor,/payload\.expectedUpdatedAt=Number\(/);
  assert.match(editor,/if\(prospectModalPending\)return/);
  assert.match(editor,/adminWebsiteData\.prospects=\[data\.prospect/);
  assert.match(quick,/expectedUpdatedAt:Number\(before\.updatedAt/);
});

test('changing a prospect email rekeys lookup with the record in one compare transaction',async()=>{
  const owners={'site:prospect:email:old@example.test':'lead-1'};
  const good=await backend({id:'lead-1',expectedUpdatedAt:10,email:'new@example.test'},{emailOwners:owners}).run();
  assert.equal(good.code,200);assert.equal(good.calls,1);assert.equal(good.plainWrites,0);
  assert.equal(good.payload.length,3);
  assert.equal(good.payload[1].key,'site:prospect:email:new@example.test');
  assert.equal(good.payload[1].after,'lead-1');
  assert.equal(good.payload[2].key,'site:prospect:email:old@example.test');
  assert.deepEqual(Array.from(good.deleted),['site:prospect:email:old@example.test']);
  const collision=await backend({id:'lead-1',expectedUpdatedAt:10,email:'new@example.test'},{emailOwners:{'site:prospect:email:new@example.test':'another-lead'}}).run();
  assert.equal(collision.code,409);assert.equal(collision.calls,0);
  const raced=await backend({id:'lead-1',expectedUpdatedAt:10,email:'new@example.test'},{emailOwners:owners,commit:false}).run();
  assert.equal(raced.code,409);assert.equal(raced.calls,1);
});
