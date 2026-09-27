const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
function slice(begin,end){
  const a=source.indexOf(begin),b=source.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,begin+' missing');return source.slice(a,b);
}
const opener=slice('async function openAdminClient(','\nfunction adminTechMessage(');
const navigation=slice('async function navigateNotification(','\nasync function openNotification(');
const workspace=id=>({id,name:'Workspace '+id,plan:'Starter',status:'active',subscriptionStatus:'active',
  ownerEmail:'client@example.test',usage:{minutes:0},stripe:{customerLinked:false,subscriptionLinked:false},counts:{locations:1}});
function fixture({status=200,client=workspace('client-1'),locked=false,remoteError=false}={}){
  const elements=new Map(),events=[];
  const element=id=>{
    if(!elements.has(id))elements.set(id,{classList:{add:cls=>events.push(id+':'+cls)},setAttribute:(key,value)=>events.push(id+':'+key+'='+value)});
    return elements.get(id);
  };
  const ctx=vm.createContext({
    adminTechSaving:locked,adminClientSaving:false,adminClientOpenRequest:0,currentAdminClient:null,
    fetch:async url=>{events.push('fetch:'+url);if(remoteError)throw Error('offline');return {ok:status===200,json:async()=>({client})}},
    document:{getElementById:element,body:{dataset:{dashboard:'admin'}}},
    loadAdminTechSupport:async id=>events.push('diagnostics:'+id),
    adminWorkspaceLabel:x=>x,adminBillingLabel:x=>x,adminClientLifecycle:()=> 'active',
    financeMoney:x=>String(x),PLAN_DATA:{Starter:{price:349}},esc:x=>String(x),Number,String,
    adminStatusLabel:x=>x
  });
  vm.runInContext(opener,ctx);
  return {ctx,elements,events,run:id=>vm.runInContext('openAdminClient('+JSON.stringify(id)+')',ctx)};
}
test('account drawer reports success only when exact requested workspace opens',async()=>{
  const f=fixture();
  assert.equal(await f.run('client-1'),true);
  assert.equal(f.ctx.currentAdminClient.id,'client-1');
  assert.ok(f.events.includes('adminClientDrawer:open'));
  assert.ok(f.events.includes('diagnostics:client-1'));
});
test('account drawer fails closed on missing or mismatched workspace',async()=>{
  for(const options of [{status:404},{client:null},{client:workspace('different-id')}]) {
    const f=fixture(options);
    assert.equal(await f.run('client-1'),false);
    assert.equal(f.ctx.currentAdminClient,null);
    assert.equal(f.events.includes('adminClientDrawer:open'),false);
  }
});
test('locked account drawer cannot claim a notification navigation succeeded',async()=>{
  const f=fixture({locked:true});
  assert.equal(await f.run('client-1'),false);
  assert.equal(f.events.length,0);
});
test('old account lookup cannot open after a newer drawer request takes ownership',async()=>{
  const f=fixture();
  let resolve;
  f.ctx.fetch=async()=>new Promise(ok=>resolve=ok);
  const task=f.run('client-1');
  f.ctx.adminClientOpenRequest++;
  resolve({ok:true,json:async()=>({client:workspace('client-1')})});
  assert.equal(await task,false);
  assert.equal(f.events.includes('adminClientDrawer:open'),false);
});
function notificationFixture({opened=true,throws=false,view='finance'}={}){
  const calls=[];
  const ctx=vm.createContext({
    document:{body:{dataset:{dashboard:'admin'}}},showView:x=>calls.push('view:'+x),
    openAdminClient:async id=>{calls.push('open:'+id);if(throws)throw Error('unavailable');return opened},
    console:{warn:()=>calls.push('warn')},String
  });
  vm.runInContext(navigation,ctx);
  return {calls,run:()=>vm.runInContext('navigateNotification({view:'+JSON.stringify(view)+',meta:{workspaceId:"client-1"}})',ctx)};
}
test('billing alert opens its specific client account before reporting navigation success',async()=>{
  const f=notificationFixture({opened:true});
  assert.equal(await f.run(),true);
  assert.deepEqual(f.calls,['view:clients','open:client-1']);
});
test('billing alert remains unread when its workspace cannot be opened',async()=>{
  for(const options of [{opened:false},{throws:true}]){
    const f=notificationFixture(options);
    assert.equal(await f.run(),false);
    assert.equal(f.calls[0],'view:clients');
    assert.equal(f.calls[1],'open:client-1');
  }
});
test('client management alert uses the same exact-workspace completion check',async()=>{
  const f=notificationFixture({opened:false,view:'clients'});
  assert.equal(await f.run(),false);
  assert.deepEqual(f.calls,['view:clients','open:client-1']);
});

test('switching client drawers removes previous workspace diagnostics, audit and override text immediately',async()=>{
  const f=fixture(),get=id=>f.ctx.document.getElementById(id);
  f.ctx.currentAdminClient=workspace('prior-client');
  f.ctx.currentAdminTech={diagnostics:{workspaceId:'prior-client'},audit:[{id:'private-audit'}]};
  get('adminDiagnostics').innerHTML='Previous client diagnostics';
  get('adminAuditList').innerHTML='Previous client audit';
  get('adminConfigEditor').value='Previous client configuration';
  get('adminRepairEmail').value='previous@example.test';
  assert.equal(await f.run('client-1'),true);
  assert.equal(f.ctx.currentAdminTech,null);
  assert.equal(get('adminDiagnostics').innerHTML,'');
  assert.equal(get('adminAuditList').innerHTML,'');
  assert.equal(get('adminConfigEditor').value,'');
  assert.equal(get('adminRepairEmail').value,'');
  assert.equal(get('adminAuditEmpty').hidden,true);
  assert.equal(f.ctx.currentAdminClient.id,'client-1');
});
test('failed next client request does not falsely replace the previous selected client',async()=>{
  const f=fixture({status:404});
  f.ctx.currentAdminClient=workspace('prior-client');
  f.ctx.currentAdminTech={diagnostics:{workspaceId:'prior-client'}};
  assert.equal(await f.run('client-1'),false);
  assert.equal(f.ctx.currentAdminClient.id,'prior-client');
  assert.equal(f.ctx.currentAdminTech.diagnostics.workspaceId,'prior-client');
});
