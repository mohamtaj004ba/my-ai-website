const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function bootstrapAdmin()');
const end=source.indexOf('\nasync function loadAdminOps()',begin);
assert.ok(begin>=0&&end>begin,'admin bootstrap function exists');

function fixture({session='network',summaryStatus=200}={}){
  const calls=[],profile=[],identity={textContent:''},location={search:'',pathname:'/admin-dashboard',replace:url=>calls.push('redirect:'+url)};
  const context=vm.createContext({
    fetch:async url=>{
      calls.push(url);
      if(url.includes('admin-summary'))return {ok:summaryStatus===200,status:summaryStatus,json:async()=>({summary:{activeClients:1}})};
      if(url.includes('admin-clients'))return {ok:true,status:200,json:async()=>({clients:[{id:'client-1'}]})};
      if(url.includes('action=session')){
        if(session==='network')throw Error('Session endpoint offline');
        if(session==='invalid')return {ok:true,status:200,json:async()=>{throw Error('Invalid JSON')}};
        if(session==='null')return {ok:true,status:200,json:async()=>null};
        return {ok:true,status:200,json:async()=>({user:{email:'admin@example.test'},workspace:{}})};
      }
      throw Error('Unexpected endpoint');
    },
    document:{body:{innerHTML:''},getElementById:id=>id==='adminIdentity'?identity:null},
    location,URLSearchParams,adminDataSyncAt:{},console:{error:()=>calls.push('error')},
    applyUserProfile:(...args)=>profile.push(args),
    renderAdmin:()=>calls.push('render'),loadAdminOps:async()=>calls.push('ops'),
    initAdminLiveRefresh:()=>calls.push('live'),
    showView:()=>{},loadAdminInbox:async()=>{},history:{replaceState:()=>{}},
    Promise,Date,Array
  });
  vm.runInContext(source.slice(begin,end),context);
  return {context,calls,profile,identity,run:()=>vm.runInContext('bootstrapAdmin()',context)};
}
for(const session of ['network','invalid','null']){
  test('admin bootstrap survives optional '+session+' session lookup when authorized feeds succeeded',async()=>{
    const f=fixture({session});
    assert.equal(await f.run(),true);
    assert.equal(f.context.adminSummaryData.activeClients,1);
    assert.equal(f.context.adminClientsData[0].id,'client-1');
    assert.ok(f.calls.includes('render'));
    assert.ok(f.calls.includes('ops'));
    assert.ok(f.calls.includes('live'));
    assert.equal(f.profile.length,0);
    assert.equal(f.calls.includes('error'),false);
  });
}
test('successful optional identity lookup still populates admin profile',async()=>{
  const f=fixture({session:'healthy'});
  assert.equal(await f.run(),true);
  assert.equal(f.identity.textContent,'admin@example.test');
  assert.equal(f.profile.length,1);
});
test('summary authorization rejection still blocks admin bootstrap before rendering',async()=>{
  const f=fixture({summaryStatus:401});
  assert.equal(await f.run(),false);
  assert.ok(f.calls.some(x=>x.startsWith('redirect:/login?')));
  assert.equal(f.calls.includes('render'),false);
  assert.equal(f.calls.includes('ops'),false);
});

for(const broken of ['summary','clients']){
  test('incomplete '+broken+' authorization feed cannot render an apparently empty admin workspace',async()=>{
    const f=fixture({session:'healthy'}),original=f.context.fetch;
    f.context.fetch=async url=>{
      if(broken==='summary'&&url.includes('admin-summary'))return {ok:true,status:200,json:async()=>({})};
      if(broken==='clients'&&url.includes('admin-clients'))return {ok:true,status:200,json:async()=>({})};
      return original(url);
    };
    assert.equal(await f.run(),false);
    assert.equal(f.calls.includes('render'),false);
    assert.equal(f.calls.includes('ops'),false);
    assert.equal(f.calls.includes('live'),false);
    assert.ok(f.calls.includes('error'));
    assert.equal(f.context.adminDataSyncAt.summary,undefined);
    assert.equal(f.context.adminDataSyncAt.clients,undefined);
  });
}
