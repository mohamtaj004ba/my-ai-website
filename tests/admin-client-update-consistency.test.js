const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const apiSource=fs.readFileSync('api/account.js','utf8');
const dashboardSource=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}

async function runBackend({expectedUpdatedAt=10,transaction=true}={}){
  const workspace={id:'client-1',name:'Client',plan:'Starter',status:'active',subscriptionStatus:'active',createdAt:1,updatedAt:10};
  let updates,audits=0,status=0,result;
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.com'}),
    kv:{get:async()=>workspace,set:()=>assert.fail('Workspace updates must use the atomic transaction')},
    compareAndSetConfig:async(_,next)=>{updates=next;if(transaction==='error')throw Error('network');return transaction},
    appendAudit:async()=>audits++,safeError:()=>'',console:{error(){}},Date,
    req:{body:{id:'client-1',plan:'Growth',status:'suspended',expectedUpdatedAt}},
    res:{status(value){status=value;return this},json(value){result=value}}
  });
  const start=apiSource.indexOf('async function adminUpdateClient('),end=apiSource.indexOf('\nasync function adminDeleteClient(',start);
  vm.runInContext(apiSource.slice(start,end),context);
  await vm.runInContext('adminUpdateClient(req,res)',context);
  return {updates,audits,status,result};
}

test('admin workspace save compares its revision and commits one atomic record',async()=>{
  const saved=await runBackend();
  assert.equal(saved.status,200);assert.equal(saved.audits,1);assert.equal(saved.updates.length,1);
  assert.equal(saved.updates[0].before.updatedAt,10);assert.equal(saved.updates[0].after.plan,'Growth');assert.equal(saved.updates[0].after.status,'suspended');
  assert.ok(saved.result.client.updatedAt>10);
});

test('stale, concurrent and ambiguous admin workspace saves fail closed',async()=>{
  const stale=await runBackend({expectedUpdatedAt:9});assert.equal(stale.status,409);assert.equal(stale.updates,undefined);assert.equal(stale.audits,0);
  const conflict=await runBackend({transaction:false});assert.equal(conflict.status,409);assert.equal(conflict.audits,0);
  const ambiguous=await runBackend({transaction:'error'});assert.equal(ambiguous.status,503);assert.equal(ambiguous.audits,0);
});

function frontendFixture(){
  const nodes=new Map(),node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,setAttribute(name,value){this[name]=value}});
    return nodes.get(id);
  };
  node('adminClientPlan').value='Growth';node('adminClientStatus').value='suspended';
  const pending=deferred(),alerts=[],reopened=[];
  const context=vm.createContext({
    adminClientSaving:false,adminTechSaving:false,currentAdminClient:{id:'client-1',plan:'Starter',status:'active',updatedAt:10,stripe:{}},
    document:{getElementById:node,querySelectorAll:()=>[]},String,Number,JSON,
    fetch:()=>pending.promise,alert:value=>alerts.push(value),refreshAdminCore:async()=>{},loadAdminOps:async()=>{},
    openAdminClient:async(id,options)=>reopened.push({id,options})
  });
  const stateStart=dashboardSource.indexOf('function setAdminClientMutationState('),stateEnd=dashboardSource.indexOf('\nasync function loadAdminTechSupport(',stateStart);
  vm.runInContext(dashboardSource.slice(stateStart,stateEnd),context);
  const saveStart=dashboardSource.indexOf('async function saveAdminClient('),saveEnd=dashboardSource.indexOf('\nasync function deleteAdminClient(',saveStart);
  vm.runInContext(dashboardSource.slice(saveStart,saveEnd),context);
  return {context,node,pending,alerts,reopened};
}

test('admin workspace save locks the drawer, ignores duplicates and refreshes the same client',async()=>{
  const f=frontendFixture(),first=vm.runInContext('saveAdminClient()',f.context),ignored=vm.runInContext('saveAdminClient()',f.context);
  assert.equal(f.context.adminClientSaving,true);assert.equal(f.node('adminSaveClientButton').disabled,true);assert.equal(f.node('closeAdminClient').disabled,true);
  f.pending.resolve({ok:true,json:async()=>({client:{id:'client-1',plan:'Growth',status:'suspended',updatedAt:20}})});await Promise.all([first,ignored]);
  assert.equal(f.context.adminClientSaving,false);assert.equal(f.context.currentAdminClient.updatedAt,20);assert.equal(f.reopened.length,1);assert.equal(f.reopened[0].id,'client-1');assert.equal(f.reopened[0].options.allowLocked,true);
});

test('failed admin workspace save unlocks controls and preserves the selected draft',async()=>{
  const f=frontendFixture(),saving=vm.runInContext('saveAdminClient()',f.context);
  f.pending.resolve({ok:false,json:async()=>({error:'Workspace changed'})});await saving;
  assert.equal(f.context.adminClientSaving,false);assert.equal(f.node('adminClientPlan').value,'Growth');assert.equal(f.node('adminClientStatus').value,'suspended');assert.deepEqual(f.alerts,['Workspace changed']);assert.equal(f.reopened.length,0);
});
