const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('async function openNotification('),end=source.indexOf('\nasync function markAllNotifications(',start);
assert.ok(start>=0&&end>start);
const block=source.slice(start,end);

function fixture({opened=true}={}){
  const events=[],item={focus(){events.push('focus:item')}},panel={hidden:false,querySelector:()=>item},bell={setAttribute:(k,v)=>events.push('bell:'+k+'='+v),focus(){events.push('focus:bell')}};
  const ctx=vm.createContext({
    notificationData:[{id:'n-1',read:true}],
    document:{getElementById:id=>id==='notificationPanel'?panel:id==='notificationBell'?bell:null},
    navigateNotification:async()=>{events.push('navigate:panel-hidden='+panel.hidden);return opened},
    markNotifications:async()=>{events.push('mark')},
    CSS:{escape:x=>x},String
  });
  vm.runInContext(block,ctx);
  return {ctx,panel,events,run:()=>vm.runInContext("openNotification('n-1')",ctx)};
}

test('notification navigation hides its popover and focuses the stable bell before opening another surface',async()=>{
  const f=fixture({opened:true});
  assert.equal(await f.run(),true);
  assert.equal(f.panel.hidden,true);
  assert.ok(f.events.indexOf('focus:bell')<f.events.indexOf('navigate:panel-hidden=true'));
  assert.equal(f.events.includes('focus:item'),false);
});

test('failed notification navigation reopens the panel and restores focus to the same notification',async()=>{
  const f=fixture({opened:false});
  assert.equal(await f.run(),false);
  assert.equal(f.panel.hidden,false);
  assert.ok(f.events.includes('bell:aria-expanded=true'));
  assert.equal(f.events.at(-1),'focus:item');
});
