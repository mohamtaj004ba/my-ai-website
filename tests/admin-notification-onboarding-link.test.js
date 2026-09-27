const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function navigateNotification(');
const end=source.indexOf('\nasync function openNotification(',begin);
assert.ok(begin>=0&&end>begin);
function fixture({loaded=true,hidden=false,remote=true,error=false,hasDrawer=true}={}){
  const events=[],row={id:'client-1'},drawer={opened:false,classList:{contains:key=>key==='open'&&drawer.opened}};
  const ctx=vm.createContext({
    document:{
      body:{dataset:{dashboard:'admin'}},
      querySelector:sel=>sel.includes('onboarding-row')&&sel.includes('client-1')&&ctx.adminProvisioningData.some(x=>x.id==='client-1')&&ctx.onboardingFilter==='all'&&!ctx.onboardingSearch?row:null,
      getElementById:id=>id==='onboardingDetailDrawer'&&hasDrawer?drawer:id==='view-onboarding'?{}:null
    },
    adminProvisioningData:loaded?[{id:'client-1'}]:[{id:'older-client'}],
    onboardingFilter:hidden?'needs_action':'all',onboardingSearch:hidden?'different client':'',
    showView:view=>events.push('view:'+view),
    renderProvisioning:()=>events.push('render'),
    openOnboardingDrawer:(id,target)=>{assert.equal(target,row);events.push('drawer:'+id);drawer.opened=true},
    fetchJsonRetry:async(url,opts)=>{
      events.push('fetch:'+url);assert.equal(opts.attempts,1);
      if(error)throw Error('Unavailable');
      return {provisioning:remote?[{id:'client-1'}]:[{id:'other-client'}]};
    },
    CSS:{escape:x=>x},setTimeout:done=>done(),
    console:{warn:()=>events.push('warn')},Promise,String,Array
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,events,drawer,run:()=>vm.runInContext('navigateNotification({view:"onboarding",meta:{workspaceId:"client-1"}})',ctx)};
}
test('onboarding notification opens the exact already visible account drawer',async()=>{
  const f=fixture();
  assert.equal(await f.run(),true);
  assert.equal(f.drawer.opened,true);
  assert.deepEqual(f.events,['view:onboarding','drawer:client-1']);
});
test('onboarding notification clears search/filter and opens hidden existing account',async()=>{
  const f=fixture({hidden:true});
  assert.equal(await f.run(),true);
  assert.equal(f.ctx.onboardingFilter,'all');
  assert.equal(f.ctx.onboardingSearch,'');
  assert.deepEqual(f.events,['view:onboarding','render','drawer:client-1']);
});
test('onboarding alert refreshes authoritative provisioning when account is not cached',async()=>{
  const f=fixture({loaded:false});
  assert.equal(await f.run(),true);
  assert.deepEqual(f.events,['view:onboarding','fetch:/api/account?action=admin-provisioning','render','drawer:client-1']);
});
test('deleted or unavailable onboarding account remains unread',async()=>{
  for(const opts of [{loaded:false,remote:false},{loaded:false,error:true}]){
    const f=fixture(opts);
    assert.equal(await f.run(),false);
    assert.equal(f.drawer.opened,false);
    assert.equal(f.events.includes('drawer:client-1'),false);
  }
});
test('notification cannot mark onboarding alert read if the detail drawer is missing',async()=>{
  const f=fixture({hasDrawer:false});
  assert.equal(await f.run(),false);
  assert.equal(f.events.includes('drawer:client-1'),false);
});
