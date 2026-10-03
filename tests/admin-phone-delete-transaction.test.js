const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const handler=source.slice(source.indexOf('async function adminDeletePhoneNumber('),source.indexOf('async function adminFleet('));

async function run({expected=10,transaction=true,malformed=false}={}){
  const phone={id:'p',number:'5095550100',workspaceId:'tenant',updatedAt:10};
  const records={'phone:index':malformed?{broken:true}:[phone],'workspace:tenant':{id:'tenant',phone:phone.number,name:'Client'},'onboarding:workspace:tenant':{checklist:{phoneAssigned:true,knowledgeApproved:true}}};
  let status=200,result,updates,auditCommitted=null;
  const context=vm.createContext({requireAdmin:async()=>({email:'admin@example.com',workspaceId:'admin-home'}),crypto:{randomUUID:()=> 'audit-delete'},Date,kv:{get:async key=>records[key],set:()=>assert.fail('Deletion must use one atomic transaction')},compareAndAuditBatch:async(_,next,auditKey,event)=>{updates=next;if(transaction)auditCommitted={auditKey,event};return transaction},appendAudit:async()=>assert.fail('Phone deletion audit must be part of the atomic transaction'),safeError:()=>'',console:{error:()=>{}},req:{body:{id:'p',expectedUpdatedAt:expected}},res:{status(n){status=n;return this},json(x){result=x}}});
  vm.runInContext(handler,context);await vm.runInContext('adminDeletePhoneNumber(req,res)',context);return {status,result,updates,auditCommitted};
}

test('phone deletion stages inventory, workspace and onboarding changes atomically',async()=>{
  const r=await run();assert.equal(r.status,200);assert.deepEqual(Array.from(r.updates,x=>x.key),['phone:index','workspace:tenant','onboarding:workspace:tenant']);
  assert.equal(r.updates[0].after.length,0);assert.equal(r.updates[1].after.phone,'');assert.equal(r.updates[2].after.checklist.phoneAssigned,false);assert.equal(r.updates[2].after.checklist.knowledgeApproved,true);
  assert.equal(r.auditCommitted.auditKey,'audit:tenant');assert.equal(r.auditCommitted.event.action,'phone_routing_delete');
});

test('stale, missing-revision, concurrent and malformed phone deletions fail without writing an audit event',async()=>{
  for(const [options,want] of [[{expected:9},409],[{expected:undefined},409],[{transaction:false},409],[{malformed:true},503]]){const r=await run(options);assert.equal(r.status,want);assert.equal(r.auditCommitted,null)}
});

test('client sends the phone revision, serializes deletion and preserves confirmed success through refresh failure',()=>{
  const dashboard=fs.readFileSync('dashboard.js','utf8'),code=dashboard.slice(dashboard.indexOf('async function deletePhone('),dashboard.indexOf('function openPhoneModal('));
  assert.match(dashboard,/const adminPhoneDeletePending=new Set\(\)/);
  assert.match(code,/if\(adminPhoneDeletePending\.has\(key\)\)return false/);
  assert.match(code,/expectedUpdatedAt:Number\(item\.updatedAt\|\|0\)/);
  assert.match(code,/data\.ok!==true/);
  assert.match(code,/adminPhoneData=adminPhoneData\.filter/);
  assert.match(code,/Phone deletion was confirmed, but the inventory could not refresh/);
  assert.match(code,/finally\{adminPhoneDeletePending\.delete\(key\);renderPhones\(\)\}/);
});

test('phone deletion rejects malformed onboarding checklist before changing routing',()=>{
  assert.match(handler,/onboardingBefore\.checklist!=null/);
  assert.match(handler,/Array\.isArray\(onboardingBefore\.checklist\)/);
});


test('duplicate phone deletion is ignored while the first request is pending',async()=>{
  const dashboard=fs.readFileSync('dashboard.js','utf8'),start=dashboard.indexOf('async function deletePhone('),end=dashboard.indexOf('\nfunction openPhoneModal(',start),code=dashboard.slice(start,end);
  let release,requests=0;
  const ctx=vm.createContext({
    adminPhoneDeletePending:new Set(),adminPhoneData:[{id:'p',number:'5095550100',updatedAt:10}],
    confirm:()=>true,renderPhones(){},alert(){},setAdminSyncState(){},
    refreshAdminView:async()=>true,
    fetch:async()=>{requests++;await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({ok:true,deleted:{id:'p',updatedAt:10}})}},
    String,Number,Array,Object,JSON,Set,Promise,Error
  });
  vm.runInContext(code,ctx);
  const first=vm.runInContext("deletePhone('p')",ctx);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await vm.runInContext("deletePhone('p')",ctx),false);
  assert.equal(requests,1);
  release();assert.equal(await first,true);
  assert.equal(ctx.adminPhoneData.length,0);
  assert.equal(ctx.adminPhoneDeletePending.size,0);
});


test('failed phone deletion reports through admin sync status and preserves inventory',async()=>{
  const dashboard=fs.readFileSync('dashboard.js','utf8'),start=dashboard.indexOf('async function deletePhone('),end=dashboard.indexOf('\nfunction openPhoneModal(',start),code=dashboard.slice(start,end);
  const sync=[];
  const ctx=vm.createContext({
    adminPhoneDeletePending:new Set(),adminPhoneData:[{id:'p',number:'5095550100',updatedAt:10}],
    confirm:()=>true,renderPhones(){},setAdminSyncState:(...args)=>sync.push(args),
    refreshAdminView:async()=>true,
    fetch:async()=>({ok:false,json:async()=>({error:'Phone routing changed before deletion'})}),
    String,Number,Array,Object,JSON,Set,Promise,Error
  });
  vm.runInContext(code,ctx);
  assert.equal(await vm.runInContext("deletePhone('p')",ctx),false);
  assert.equal(ctx.adminPhoneData.length,1);
  assert.equal(ctx.adminPhoneDeletePending.size,0);
  assert.equal(sync.length,1);
  assert.equal(sync[0][0],'error');
  assert.match(sync[0][1],/Phone routing changed before deletion/);
});
