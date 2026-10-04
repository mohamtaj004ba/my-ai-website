const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function loadAdminInbox(');
const end=source.indexOf('async function refreshAdminInboxLive(',begin);
assert.ok(begin>=0&&end>begin,'cached Gmail inbox loader exists');

function fixture({cachedInbox='healthy',cachedAliases='healthy',status='healthy'}={}){
  const refresh={disabled:false,textContent:''},auto={textContent:''},renders=[],liveCalls=[];
  const initial={threads:[{id:'original'}],analytics:{unread:1}};
  const payload=(name,data)=>name==='network'?Promise.reject(Error('Unavailable')):Promise.resolve({ok:true,json:async()=>{if(name==='malformed')throw Error('Invalid JSON');return data}});
  const ctx=vm.createContext({
    adminInboxData:{loading:false,gmailStatus:{connected:true},gmail:initial,aliases:[{email:'original@example.test'}],lastSync:1700000000000},
    currentInboxItem:null,
    adminSearchInboxRequest:0,adminSearchInboxCacheLoaded:false,adminSearchInboxLoading:false,adminSearchInboxCacheError:false,
    fetch:async url=>{
      if(url.includes('admin-gmail-status'))return payload(status,{connected:true});
      if(url.includes('admin-gmail-inbox'))return payload(cachedInbox,{threads:[{id:'cached'}],syncedAt:1800000000000});
      if(url.includes('admin-gmail-aliases'))return payload(cachedAliases,{aliases:[{email:'cached@example.test'}]});
      throw Error('Unexpected URL');
    },
    document:{getElementById:id=>id==='inboxRefreshButton'?refresh:id==='inboxAutoStatus'?auto:null},
    renderAdminInbox:()=>renders.push('render'),
    renderInboxThread:()=>renders.push('thread'),
    renderAdminGlobalSearch:()=>renders.push('search'),
    refreshAdminInboxLive:opts=>liveCalls.push(opts),
    console:{error:()=>renders.push('error')},Date,Number,Array,Promise
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,refresh,auto,renders,liveCalls,run:()=>vm.runInContext('loadAdminInbox()',ctx)};
}

test('status response from before confirmed disconnect cannot reconnect or restore old inbox data',async()=>{
  for(const duringJson of [false,true]){
    const f=fixture();let resolve;const held=new Promise(ok=>{resolve=ok});
    f.ctx.fetch=async()=>duringJson?{ok:true,json:()=>held}:held;
    const pending=f.run();await Promise.resolve();
    f.ctx.adminInboxData.connectionRevision=1;f.ctx.adminInboxData.gmailStatus={connected:false,gmailEmail:''};f.ctx.adminInboxData.gmail={threads:[]};
    resolve(duringJson?{connected:true,gmailEmail:'old@example.test'}:{ok:true,json:async()=>({connected:true})});
    assert.equal(await pending,false);assert.equal(f.ctx.adminInboxData.gmailStatus.connected,false);
    assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);assert.equal(f.liveCalls.length,0);
    assert.equal(f.ctx.adminInboxData.loading,false);assert.equal(f.refresh.disabled,false);
  }
});

test('verified Gmail account change discards previous account inbox, detail and aliases before cache refill',async()=>{
  const f=fixture();f.ctx.adminInboxData.gmailStatus={connected:true,gmailEmail:'old@example.test'};f.ctx.currentInboxItem={kind:'gmail',id:'original'};
  f.ctx.fetch=async url=>({ok:true,json:async()=>url.includes('admin-gmail-status')?{connected:true,gmailEmail:'new@example.test'}:url.includes('admin-gmail-inbox')?{emptyCache:true,threads:[]}:{aliases:[]}});
  await f.run();assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);assert.equal(f.ctx.adminInboxData.aliases.length,0);
  assert.equal(f.ctx.currentInboxItem,null);assert.equal(f.ctx.adminInboxData.lastSync,0);assert.equal(f.ctx.adminInboxData.connectionRevision,1);
  assert.ok(f.renders.includes('thread'));assert.equal(f.liveCalls.length,1);
});

test('cached inbox JSON completing after disconnect cannot repopulate the retained account',async()=>{
  const f=fixture();let resolve,startedResolve;const held=new Promise(ok=>{resolve=ok}),started=new Promise(ok=>{startedResolve=ok});
  f.ctx.fetch=async url=>({ok:true,json:async()=>{if(url.includes('admin-gmail-status'))return {connected:true};if(url.includes('admin-gmail-inbox')){startedResolve();return held}return {aliases:[]}}});
  const pending=f.run();await started;f.ctx.adminInboxData.connectionRevision=1;f.ctx.adminInboxData.gmailStatus={connected:false};f.ctx.adminInboxData.gmail={threads:[]};
  resolve({threads:[{id:'old-account'}]});assert.equal(await pending,false);assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.equal(f.liveCalls.length,0);assert.equal(f.ctx.adminInboxData.loading,false);assert.equal(f.refresh.disabled,false);
});
for(const failure of ['network','malformed']){
  test('cached alias '+failure+' does not prevent cached Gmail threads or live refresh',async()=>{
    const f=fixture({cachedAliases:failure});await f.run();
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'cached');
    assert.equal(f.ctx.adminInboxData.aliases[0].email,'original@example.test');
    assert.equal(f.liveCalls.length,1);
    assert.equal(f.ctx.adminInboxData.loading,false);
    assert.equal(f.renders.includes('error'),false);
  });
  test('cached inbox '+failure+' retains last-good threads and still attempts live refresh',async()=>{
    const f=fixture({cachedInbox:failure});await f.run();
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'original');
    assert.equal(f.ctx.adminInboxData.aliases[0].email,'cached@example.test');
    assert.equal(f.liveCalls.length,1);
    assert.equal(f.ctx.adminInboxData.loading,false);
    assert.equal(f.renders.includes('error'),false);
  });
}

for(const failure of ['network','malformed']){
  test('Gmail status '+failure+' does not hide previously connected inbox or prevent live retry',async()=>{
    const f=fixture({status:failure});await f.run();
    assert.equal(f.ctx.adminInboxData.gmailStatus.connected,true);
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'cached');
    assert.equal(f.ctx.adminInboxData.aliases[0].email,'cached@example.test');
    assert.equal(f.liveCalls.length,1);
    assert.equal(f.renders.includes('error'),false);
  });
}
test('invalid Gmail status object preserves last known connection until the provider confirms a change',async()=>{
  const f=fixture({status:'healthy'}),original=f.ctx.fetch;
  f.ctx.fetch=async url=>url.includes('admin-gmail-status')?{ok:true,json:async()=>({})}:original(url);
  await f.run();
  assert.equal(f.ctx.adminInboxData.gmailStatus.connected,true);
  assert.equal(f.liveCalls.length,1);
});

test('failed initial Gmail status does not turn an unverified connection into a confirmed disconnect',async()=>{
  for(const failure of ['network','malformed']){
    const f=fixture({status:failure});f.ctx.adminInboxData.gmailStatus={connected:false};
    f.ctx.currentInboxItem={kind:'gmail',id:'original'};
    assert.equal(await f.run(),false);
    assert.equal(f.ctx.adminInboxData.gmail.threads[0].id,'original');assert.equal(f.ctx.currentInboxItem.id,'original');
    assert.match(f.ctx.adminInboxData.connectionStatusError,/could not be verified/);assert.match(f.auto.textContent,/unavailable/);
    assert.equal(f.refresh.disabled,false);assert.equal(f.liveCalls.length,0);
  }
});

test('verified Gmail status clears a previous connection warning while retaining live retry behavior',async()=>{
  const f=fixture();f.ctx.adminInboxData.connectionStatusError='Unverified';await f.run();
  assert.equal(f.ctx.adminInboxData.connectionStatusError,'');assert.equal(f.liveCalls.length,1);
});

test('confirmed disconnect clears inbox cache, Gmail detail and old sync timestamp',async()=>{
  const f=fixture();
  f.ctx.currentInboxItem={kind:'gmail',id:'original'};
  const original=f.ctx.fetch;
  f.ctx.fetch=async url=>url.includes('admin-gmail-status')?{ok:true,json:async()=>({connected:false})}:original(url);
  await f.run();
  assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.equal(f.ctx.adminInboxData.aliases.length,0);
  assert.equal(f.ctx.adminInboxData.lastSync,0);
  assert.equal(f.ctx.currentInboxItem,null);
  assert.equal(f.ctx.adminInboxData.loading,false);
  assert.equal(f.auto.textContent,'Gmail disconnected');
  assert.deepEqual(f.renders,['thread','render']);
  assert.equal(f.liveCalls.length,0);
});
test('confirmed disconnect does not close unrelated website conversation',async()=>{
  const f=fixture();f.ctx.currentInboxItem={kind:'website',id:'prospect-1'};
  const original=f.ctx.fetch;
  f.ctx.fetch=async url=>url.includes('admin-gmail-status')?{ok:true,json:async()=>({connected:false})}:original(url);
  await f.run();
  assert.equal(f.ctx.currentInboxItem.kind,'website');
  assert.deepEqual(f.renders,['render']);
});

test('confirmed disconnect immediately updates open global search results',async()=>{
  const f=fixture(),original=f.ctx.fetch,get=f.ctx.document.getElementById;
  f.ctx.fetch=async url=>url.includes('admin-gmail-status')?{ok:true,json:async()=>({connected:false})}:original(url);
  f.ctx.document.getElementById=id=>id==='adminSearch'?{value:'customer'}:get(id);
  await f.run();
  assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.deepEqual(f.renders,['render','search']);
});

test('cached Gmail fetch completing after disconnect cannot restore old messages',async()=>{
  const f=fixture(),original=f.ctx.fetch;
  let resolveInbox;
  f.ctx.fetch=async url=>url.includes('admin-gmail-inbox')?new Promise(resolve=>resolveInbox=resolve):original(url);
  const pending=f.run();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof resolveInbox,'function');
  f.ctx.adminInboxData.gmailStatus={connected:false};
  f.ctx.adminInboxData.gmail={threads:[],analytics:{}};
  f.ctx.adminInboxData.aliases=[];
  f.ctx.adminInboxData.lastSync=0;
  resolveInbox({ok:true,json:async()=>({threads:[{id:'obsolete'}],syncedAt:1800000000000})});
  await pending;
  assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.equal(f.ctx.adminInboxData.aliases.length,0);
  assert.equal(f.ctx.adminInboxData.lastSync,0);
  assert.equal(f.ctx.adminInboxData.loading,false);
  assert.equal(f.liveCalls.length,0);
});
