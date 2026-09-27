const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function loadAdminInbox(');
const end=source.indexOf('async function refreshAdminInboxLive(',begin);
assert.ok(begin>=0&&end>begin,'cached Gmail inbox loader exists');

function fixture({cachedInbox='healthy',cachedAliases='healthy'}={}){
  const refresh={disabled:false,textContent:''},auto={textContent:''},renders=[],liveCalls=[];
  const initial={threads:[{id:'original'}],analytics:{unread:1}};
  const payload=(name,data)=>name==='network'?Promise.reject(Error('Unavailable')):Promise.resolve({ok:true,json:async()=>{if(name==='malformed')throw Error('Invalid JSON');return data}});
  const ctx=vm.createContext({
    adminInboxData:{loading:false,gmailStatus:{connected:true},gmail:initial,aliases:[{email:'original@example.test'}],lastSync:1700000000000},
    fetch:async url=>{
      if(url.includes('admin-gmail-status'))return {ok:true,json:async()=>({connected:true})};
      if(url.includes('admin-gmail-inbox'))return payload(cachedInbox,{threads:[{id:'cached'}],syncedAt:1800000000000});
      if(url.includes('admin-gmail-aliases'))return payload(cachedAliases,{aliases:[{email:'cached@example.test'}]});
      throw Error('Unexpected URL');
    },
    document:{getElementById:id=>id==='inboxRefreshButton'?refresh:id==='inboxAutoStatus'?auto:null},
    renderAdminInbox:()=>renders.push('render'),
    refreshAdminInboxLive:opts=>liveCalls.push(opts),
    console:{error:()=>renders.push('error')},Date,Number,Array,Promise
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,refresh,auto,renders,liveCalls,run:()=>vm.runInContext('loadAdminInbox()',ctx)};
}
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
