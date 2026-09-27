const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function disconnectGmailAdmin()');
const end=source.indexOf("\ndocument.getElementById('inboxRefreshButton')",begin);
assert.ok(begin>=0&&end>begin,'admin Gmail disconnect action exists');
function fixture({confirmDisconnect=true,response={ok:true}}={}){
  const calls=[],alerts=[],search={value:'prospect'};
  const ctx=vm.createContext({
    confirm:()=>confirmDisconnect,alert:s=>alerts.push(s),
    fetch:async()=>{calls.push('disconnect');if(response instanceof Error)throw response;return response},
    adminInboxData:{gmailStatus:{connected:true,gmailEmail:'admin@example.test'},gmail:{threads:[{id:'gmail-1'}]},aliases:[{email:'alias@example.test'}],lastSync:1700000000000,liveError:'Earlier issue'},
    currentInboxItem:{kind:'gmail',id:'gmail-1'},
    adminSearchInboxRequest:0,adminSearchInboxCacheLoaded:false,adminSearchInboxLoading:false,adminSearchInboxCacheError:false,
    renderInboxThread:()=>calls.push('thread'),renderAdminInbox:()=>calls.push('inbox'),
    renderAdminGlobalSearch:()=>calls.push('search'),
    loadAdminInbox:async()=>calls.push('refresh'),
    document:{getElementById:id=>id==='adminSearch'?search:null},String,Error
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,calls,alerts,run:()=>vm.runInContext('disconnectGmailAdmin()',ctx)};
}
test('successful explicit Gmail disconnect clears cached inbox before refreshing provider status',async()=>{
  const f=fixture();await f.run();
  assert.equal(f.ctx.adminInboxData.gmailStatus.connected,false);
  assert.equal(f.ctx.adminInboxData.gmailStatus.gmailEmail,'');
  assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.equal(f.ctx.adminInboxData.aliases.length,0);
  assert.equal(f.ctx.adminInboxData.lastSync,0);
  assert.equal(f.ctx.adminInboxData.liveError,'');
  assert.equal(f.ctx.currentInboxItem,null);
  assert.deepEqual(f.calls,['disconnect','thread','inbox','search','refresh']);
  assert.deepEqual(f.alerts,[]);
});
for(const response of [{ok:false},new Error('Provider unavailable')]){
  test('failed Gmail disconnect does not clear last verified inbox or search',async()=>{
    const f=fixture({response});await f.run();
    assert.equal(f.ctx.adminInboxData.gmailStatus.connected,true);
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'gmail-1');
    assert.equal(f.ctx.currentInboxItem.id,'gmail-1');
    assert.deepEqual(f.calls,['disconnect']);
    assert.deepEqual(f.alerts,['Could not disconnect Gmail.']);
  });
}
test('declined Gmail disconnect leaves provider and local data alone',async()=>{
  const f=fixture({confirmDisconnect:false});await f.run();
  assert.equal(f.calls.length,0);
  assert.equal(f.alerts.length,0);
  assert.equal(f.ctx.adminInboxData.gmailStatus.connected,true);
});
