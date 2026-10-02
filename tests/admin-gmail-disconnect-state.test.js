const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('let gmailConnectionMutationPending=false;');
const end=source.indexOf("\ndocument.getElementById('inboxRefreshButton')",begin);
assert.ok(begin>=0&&end>begin,'admin Gmail disconnect action exists');
function fixture({confirmDisconnect=true,response={ok:true,json:async()=>({ok:true})}}={}){
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
for(const response of [{ok:false,json:async()=>({error:'Could not disconnect Gmail'})},{ok:true,json:async()=>({})},new Error('Provider unavailable')]){
  test('failed Gmail disconnect does not clear last verified inbox or search',async()=>{
    const f=fixture({response});await f.run();
    assert.equal(f.ctx.adminInboxData.gmailStatus.connected,true);
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'gmail-1');
    assert.equal(f.ctx.currentInboxItem.id,'gmail-1');
    assert.deepEqual(f.calls,['disconnect']);
    assert.equal(f.alerts.length,1);
  });
}
test('declined Gmail disconnect leaves provider and local data alone',async()=>{
  const f=fixture({confirmDisconnect:false});await f.run();
  assert.equal(f.calls.length,0);
  assert.equal(f.alerts.length,0);
  assert.equal(f.ctx.adminInboxData.gmailStatus.connected,true);
});


test('Gmail connect redirects only to canonical Google OAuth and blocks overlapping mutation',async()=>{
  const connect={disabled:false,textContent:'Connect Gmail',dataset:{},isConnected:true},
    disconnect={disabled:false,textContent:'Disconnect',dataset:{},isConnected:true},location={href:''},alerts=[],calls=[];
  const oauth='https://accounts.google.com/o/oauth2/v2/auth?client_id=client-1&state=state-1&redirect_uri=https%3A%2F%2Fpreview.example.test%2Fapi%2Fgoogle-oauth-callback';
  const ctx=vm.createContext({
    adminInboxData:{gmailStatus:{configured:true}},adminSearchInboxRequest:0,adminSearchInboxCacheLoaded:false,adminSearchInboxLoading:false,adminSearchInboxCacheError:false,
    fetch:async()=>{calls.push('connect');return {ok:true,json:async()=>({url:oauth})}},
    confirm:()=>true,alert:s=>alerts.push(String(s)),location,URL,String,Error,
    document:{getElementById:id=>id==='gmailConnectButton'?connect:id==='gmailDisconnectButton'?disconnect:null},
    renderInboxThread(){},renderAdminInbox(){},renderAdminGlobalSearch(){},loadAdminInbox:async()=>{}
  });
  vm.runInContext(source.slice(begin,end),ctx);
  assert.equal(await vm.runInContext('connectGmail()',ctx),true);
  assert.equal(location.href,oauth);
  assert.equal(connect.disabled,true);
  assert.equal(disconnect.disabled,true);
  assert.equal(await vm.runInContext('connectGmail()',ctx),false);
  assert.equal(calls.length,1);
  assert.deepEqual(alerts,[]);
});

for(const scenario of [
  {name:'malformed successful URL',fetch:async()=>({ok:true,json:async()=>({url:'https://example.test/fake'})})},
  {name:'incomplete successful receipt',fetch:async()=>({ok:true,json:async()=>({})})},
  {name:'network failure',fetch:async()=>{throw Error('offline')}}
]){
  test('Gmail connect preserves controls on '+scenario.name,async()=>{
    const connect={disabled:false,textContent:'Connect Gmail',dataset:{},isConnected:true},
      disconnect={disabled:false,textContent:'Disconnect',dataset:{},isConnected:true},location={href:''},alerts=[];
    const ctx=vm.createContext({
      adminInboxData:{gmailStatus:{configured:true}},adminSearchInboxRequest:0,adminSearchInboxCacheLoaded:false,adminSearchInboxLoading:false,adminSearchInboxCacheError:false,
      fetch:scenario.fetch,confirm:()=>true,alert:s=>alerts.push(String(s)),location,URL,String,Error,
      document:{getElementById:id=>id==='gmailConnectButton'?connect:id==='gmailDisconnectButton'?disconnect:null},
      renderInboxThread(){},renderAdminInbox(){},renderAdminGlobalSearch(){},loadAdminInbox:async()=>{}
    });
    vm.runInContext(source.slice(begin,end),ctx);
    assert.equal(await vm.runInContext('connectGmail()',ctx),false);
    assert.equal(location.href,'');
    assert.equal(connect.disabled,false);
    assert.equal(disconnect.disabled,false);
    assert.equal(connect.textContent,'Connect Gmail');
    assert.equal(alerts.length,1);
  });
}
