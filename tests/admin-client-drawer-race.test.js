const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function response(client){return {ok:true,json:async()=>({client})}}
function fixture(){
  const nodes=new Map(),node=id=>{
    if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',value:'',disabled:false,classList:{values:new Set(),add(value){this.values.add(value)},remove(value){this.values.delete(value)},contains(value){return this.values.has(value)}},setAttribute(name,value){this[name]=value}});
    return nodes.get(id);
  };
  const requests=new Map(),sync=[],fetch=async url=>{const id=new URL('https://example.test'+url).searchParams.get('id'),pending=deferred();requests.set(id,pending);return pending.promise};
  const context=vm.createContext({
    adminTechSaving:false,adminClientSaving:false,adminClientOpenRequest:0,currentAdminClient:null,
    fetch,encodeURIComponent,PLAN_DATA:{Growth:{price:399}},financeMoney:value=>'$'+value,
    adminClientLifecycle:()=> 'active',adminWorkspaceLabel:String,adminBillingLabel:String,esc:String,
    loadAdminTechSupport:async()=>{},setAdminSyncState:(state,message)=>sync.push({state,message:String(message||'')}),
    document:{getElementById:node}
  });
  const openStart=source.indexOf('async function openAdminClient('),openEnd=source.indexOf('\nfunction adminTechMessage(',openStart);vm.runInContext(source.slice(openStart,openEnd),context);
  const closeStart=source.indexOf('function closeAdminClient('),closeEnd=source.indexOf('\nlet adminSearchActiveIndex',closeStart);vm.runInContext(source.slice(closeStart,closeEnd),context);
  return {context,node,requests,sync};
}

test('a slower client response cannot replace a newer admin drawer selection',async()=>{
  const {context,node,requests,sync}=fixture(),first=vm.runInContext("openAdminClient('one')",context),second=vm.runInContext("openAdminClient('two')",context);
  requests.get('two').resolve(response({id:'two',name:'Second client',plan:'Growth',status:'active',subscriptionStatus:'active',usage:{minutes:0},counts:{}}));await second;
  requests.get('one').resolve(response({id:'one',name:'First client',plan:'Growth',status:'active',subscriptionStatus:'active',usage:{minutes:0},counts:{}}));await first;
  assert.equal(context.currentAdminClient.id,'two');assert.equal(node('adminClientName').textContent,'Second client');assert.equal(node('adminClientDrawer')['aria-hidden'],'false');
  assert.equal(sync.length,0);
});

test('closing the admin drawer invalidates pending opens and restores accessibility state',async()=>{
  const {context,node,requests}=fixture(),pending=vm.runInContext("openAdminClient('one')",context);vm.runInContext('closeAdminClient()',context);
  requests.get('one').resolve(response({id:'one',name:'First client',plan:'Growth',status:'active',subscriptionStatus:'active',usage:{minutes:0},counts:{}}));await pending;
  assert.equal(context.currentAdminClient,null);assert.equal(node('adminClientDrawer')['aria-hidden'],'true');assert.equal(node('adminClientDrawer').classList.contains('open'),false);
});

test('admin client drawer surfaces HTTP and network failures without opening stale details',async()=>{
  {
    const {context,node,requests,sync}=fixture(),pending=vm.runInContext("openAdminClient('one')",context);
    requests.get('one').resolve({ok:false,json:async()=>({error:'Client details unavailable'})});
    assert.equal(await pending,false);
    assert.equal(context.currentAdminClient,null);
    assert.equal(node('adminClientDrawer').classList.contains('open'),false);
    assert.ok(sync.some(item=>item.state==='error'&&/Client details unavailable/.test(item.message)));
  }
  {
    const f=fixture();f.context.fetch=async()=>{throw Error('Directory offline')};
    assert.equal(await vm.runInContext("openAdminClient('one')",f.context),false);
    assert.equal(f.context.currentAdminClient,null);
    assert.ok(f.sync.some(item=>item.state==='error'&&/Directory offline/.test(item.message)));
  }
});

test('malformed client detail response is disclosed and stale superseded failures stay silent',async()=>{
  const f=fixture(),pending=vm.runInContext("openAdminClient('one')",f.context);
  f.requests.get('one').resolve({ok:true,json:async()=>({client:{id:'other'}})});
  assert.equal(await pending,false);
  assert.ok(f.sync.some(item=>item.state==='error'&&/response was incomplete/.test(item.message)));

  const g=fixture(),first=vm.runInContext("openAdminClient('one')",g.context),second=vm.runInContext("openAdminClient('two')",g.context);
  g.requests.get('two').resolve(response({id:'two',name:'Second client',plan:'Growth',status:'active',subscriptionStatus:'active',usage:{minutes:0},counts:{}}));await second;
  const before=g.sync.length;
  g.requests.get('one').resolve({ok:false,json:async()=>({error:'Old request failed'})});await first;
  assert.equal(g.sync.length,before);
});
