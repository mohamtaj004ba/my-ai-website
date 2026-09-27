const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function refreshAdminInboxLive(');
const end=source.indexOf('\nfunction websiteInboxItems()',begin);
assert.ok(begin>=0&&end>begin,'live inbox refresh exists');
function fixture(reply){
  const auto={textContent:''},refresh={disabled:false,textContent:''},rendered=[],errors=[];
  const ctx=vm.createContext({
    adminInboxData:{liveLoading:false,liveError:'',gmail:{threads:[{id:'last-good'}]},aliases:[{email:'alias@example.test'}],lastSync:1700000000000},
    fetch:async()=>{if(reply instanceof Error)throw reply;return reply},
    document:{getElementById:id=>id==='inboxAutoStatus'?auto:id==='inboxRefreshButton'?refresh:null},
    renderAdminInbox:()=>rendered.push('inbox'),currentInboxItem:null,
    console:{error:(...args)=>errors.push(args)},Date,Number,Array
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,auto,refresh,rendered,errors,run:()=>vm.runInContext('refreshAdminInboxLive({silent:false,force:true})',ctx)};
}
for(const [name,response] of [
  ['network failure',new Error('Offline')],
  ['HTTP failure',{ok:false,status:503,json:async()=>({})}],
  ['malformed HTTP 200',{ok:true,json:async()=>({status:'ok'})}]
]){
  test('live Gmail '+name+' preserves last good threads and discloses stale refresh',async()=>{
    const f=fixture(response);await f.run();
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'last-good');
    assert.equal(f.ctx.adminInboxData.lastSync,1700000000000);
    assert.equal(f.ctx.adminInboxData.liveError,'Gmail refresh failed');
    assert.match(f.auto.textContent,/Gmail refresh failed.*showing last synced data/);
    assert.equal(f.ctx.adminInboxData.liveLoading,false);
    assert.equal(f.refresh.disabled,false);
    assert.equal(f.refresh.textContent,'Refresh inbox');
    assert.ok(f.rendered.includes('inbox'));
  });
}
test('successful retry clears stale warning and updates thread snapshot',async()=>{
  const f=fixture({ok:true,json:async()=>({threads:[{id:'new-good'}],analytics:{},syncedAt:1800000000000})});
  f.ctx.adminInboxData.liveError='Gmail refresh failed';
  await f.run();
  assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'new-good');
  assert.equal(f.ctx.adminInboxData.lastSync,1800000000000);
  assert.equal(f.ctx.adminInboxData.liveError,'');
  assert.match(f.auto.textContent,/Auto-sync · 3 min/);
  assert.doesNotMatch(f.auto.textContent,/failed/);
  assert.equal(f.refresh.disabled,false);
});
