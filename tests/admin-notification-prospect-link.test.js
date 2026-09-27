const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function navigateNotification(');
const end=source.indexOf('\nasync function openNotification(',begin);
assert.ok(begin>=0&&end>begin);
function fixture({loaded=false,remote=true,error=false,pending=false}={}){
  const events=[];
  const ctx=vm.createContext({
    document:{body:{dataset:{dashboard:'admin'}},querySelector:()=>null,getElementById:id=>id==='view-growth'?{}:null},
    adminWebsiteData:{prospects:loaded?[{id:'lead-1'}]:[{id:'last-good'}]},
    adminWebsiteDays:30,prospectModalPending:pending,prospectStagePending:new Set(),
    loadWebsiteAnalytics:async days=>{
      events.push('refresh:'+days);
      if(error)return false;
      if(remote)ctx.adminWebsiteData={prospects:[{id:'lead-1'}]};return true;
    },
    showView:view=>events.push('view:'+view),openProspectModal:id=>events.push('open:'+id),
    setTimeout:done=>done(),CSS:{escape:x=>x},
    Promise,String,Set
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,events,run:()=>vm.runInContext('navigateNotification({view:"growth",meta:{prospectId:"lead-1"}})',ctx)};
}
test('loaded lead notification opens exact prospect without extra analytics fetch',async()=>{
  const f=fixture({loaded:true});
  assert.equal(await f.run(),true);
  assert.deepEqual(f.events,['view:growth','open:lead-1']);
});
test('missing lead reloads authorized analytics and opens matching prospect',async()=>{
  const f=fixture();
  assert.equal(await f.run(),true);
  assert.deepEqual(f.events,['view:growth','refresh:30','open:lead-1']);
});
test('deleted or unretained lead remains unread even after successful analytics refresh',async()=>{
  const f=fixture({remote:false});
  assert.equal(await f.run(),false);
  assert.deepEqual(f.events,['view:growth','refresh:30']);
  assert.equal(f.ctx.adminWebsiteData.prospects[0].id,'last-good');
});
test('failed lead refresh cannot mark a missing notification as opened',async()=>{
  const f=fixture({error:true});
  assert.equal(await f.run(),false);
  assert.equal(f.events.includes('open:lead-1'),false);
  assert.equal(f.ctx.adminWebsiteData.prospects[0].id,'last-good');
});
test('lead notification does not claim success while prospect modal is locked by another save',async()=>{
  const f=fixture({loaded:true,pending:true});
  assert.equal(await f.run(),false);
  assert.equal(f.events.includes('open:lead-1'),false);
});
