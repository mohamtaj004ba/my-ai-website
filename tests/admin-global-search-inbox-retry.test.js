const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function loadAdminSearchInboxCache()');
const end=source.indexOf('\nfunction setAdminSearchActive(',begin);
assert.ok(begin>=0&&end>begin,'global inbox search cache loader exists');
function fixture(){
  const calls=[],warnings=[],renders=[],state={status:'fail',inbox:'healthy'};
  const ctx=vm.createContext({
    adminSearchInboxCacheLoaded:false,adminSearchInboxLoading:false,adminSearchInboxCacheError:false,
    adminSearchInboxRequest:0,adminSearchInboxCacheLoaded:false,adminSearchInboxLoading:false,adminSearchInboxCacheError:false,
    adminInboxData:{gmailStatus:{connected:true},gmail:{threads:[{id:'last-good'}]},aliases:[{email:'old@example.test'}],lastSync:1700000000000},currentInboxItem:null,
    fetch:async url=>{
      calls.push(url);
      const stage=url.includes('admin-gmail-status')?state.status:state.inbox;
      if(stage==='fail')throw Error('Temporary provider outage');
      if(stage==='http')return {ok:false,status:503};
      return {ok:true,json:async()=>stage==='malformed'?{}:url.includes('admin-gmail-status')?{connected:stage!=='disconnected'}:{threads:[{id:'fresh'}],syncedAt:1800000000000}};
    },
    document:{getElementById:()=>({value:'customer'})},
    renderAdminGlobalSearch:()=>renders.push('render'),renderAdminInbox:()=>renders.push('inbox'),renderInboxThread:()=>renders.push('thread'),
    console:{warn:(...args)=>warnings.push(args)},
    String,Number,Array,Date,Error
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,calls,warnings,renders,state,run:()=>vm.runInContext('loadAdminSearchInboxCache()',ctx)};
}
for(const failing of ['fail','http','malformed']){
  test('global Gmail search retries after '+failing+' connection-status response',async()=>{
    const f=fixture();f.state.status=failing;await f.run();
    assert.equal(f.ctx.adminSearchInboxCacheLoaded,false);
    assert.equal(f.ctx.adminSearchInboxCacheError,true);
    assert.equal(f.ctx.adminSearchInboxLoading,false);
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'last-good');
    f.state.status='healthy';await f.run();
    assert.equal(f.ctx.adminSearchInboxCacheLoaded,true);
    assert.equal(f.ctx.adminSearchInboxCacheError,false);
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'fresh');
    assert.equal(f.calls.filter(url=>url.includes('admin-gmail-status')).length,2);
  });
  test('global Gmail search retries after '+failing+' cached inbox response',async()=>{
    const f=fixture();f.state.status='healthy';f.state.inbox=failing;await f.run();
    assert.equal(f.ctx.adminSearchInboxCacheLoaded,false);
    assert.equal(f.ctx.adminSearchInboxCacheError,true);
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'last-good');
    f.state.inbox='healthy';await f.run();
    assert.equal(f.ctx.adminSearchInboxCacheLoaded,true);
    assert.equal(f.ctx.adminSearchInboxCacheError,false);
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'fresh');
    await f.run();
    assert.equal(f.calls.filter(url=>url.includes('admin-gmail-inbox')).length,2);
  });
}
test('confirmed Gmail disconnection completes cache lookup without requesting private threads',async()=>{
  const f=fixture();f.state.status='disconnected';await f.run();
  assert.equal(f.ctx.adminSearchInboxCacheLoaded,true);
    assert.equal(f.ctx.adminSearchInboxCacheError,false);
  assert.equal(f.ctx.adminInboxData.gmailStatus.connected,false);
  assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.equal(f.ctx.adminInboxData.aliases.length,0);
  assert.equal(f.ctx.adminInboxData.lastSync,0);
  assert.ok(f.renders.includes('inbox'));
  assert.equal(f.calls.filter(url=>url.includes('admin-gmail-inbox')).length,0);
});

test('global search explains that missing Gmail results may be caused by a provider error',()=>{
  assert.match(source,/Gmail search temporarily unavailable; retry search/);
  assert.match(source,/adminSearchInboxCacheError\?' · Gmail search temporarily unavailable/);
});

test('confirmed remote Gmail disconnect closes already-selected cached Gmail detail',async()=>{
  const f=fixture();f.state.status='disconnected';
  f.ctx.currentInboxItem={kind:'gmail',id:'last-good'};
  await f.run();
  assert.equal(f.ctx.currentInboxItem,null);
  assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.ok(f.renders.includes('thread'));
  assert.ok(f.renders.includes('inbox'));
});
