const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('function adminSyncCacheKey(');
const end=source.indexOf('\nasync function refreshAdminView(',start);
assert.ok(start>=0&&end>start,'URL-scoped admin sync helper exists');
function fixture(){
  const requests=[],waiting=new Map(),ctx=vm.createContext({
    adminDataSyncAt:{},adminDataSyncInFlight:{},
    fetch:async(url)=>{requests.push(url);return new Promise(resolve=>waiting.set(url,resolve))},
    Date,Number,Error,Promise
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,requests,complete:(url,analytics)=>waiting.get(url)({ok:true,json:async()=>({analytics})}),
    get:(url,force=false)=>vm.runInContext('adminSyncFetch("website",'+JSON.stringify(url)+',{ttl:60000,force:'+force+'})',ctx)};
}
const url7='/api/account?action=admin-website-analytics&days=7';
const url30='/api/account?action=admin-website-analytics&days=30';
test('different website windows never share in-flight fetch or TTL',async()=>{
  const f=fixture(),a=f.get(url7),b=f.get(url30);
  assert.equal(f.requests.length,2);
  f.complete(url30,{periodDays:30});f.complete(url7,{periodDays:7});
  assert.equal((await a).analytics.periodDays,7);
  assert.equal((await b).analytics.periodDays,30);
  assert.ok(f.ctx.adminDataSyncAt[url7]>0);
  assert.ok(f.ctx.adminDataSyncAt[url30]>0);
  assert.equal(await f.get(url7),null);
  assert.equal(await f.get(url30),null);
  assert.equal(f.requests.length,2);
});
test('same website window deduplicates an in-flight fetch and force bypasses TTL',async()=>{
  const f=fixture(),a=f.get(url7),b=f.get(url7);
  assert.equal(f.requests.length,1);
  f.complete(url7,{periodDays:7});
  assert.equal((await a).analytics.periodDays,7);
  assert.equal((await b).analytics.periodDays,7);
  const fresh=f.get(url7,true);
  assert.equal(f.requests.length,2);
  f.complete(url7,{periodDays:7,visitors:25});
  assert.equal((await fresh).analytics.visitors,25);
});
test('view refresh ignores an old website window arriving after a new selection',async()=>{
  const begin=source.indexOf('async function refreshAdminView(');
  const finish=source.indexOf('\nfunction adminAgentGroup(',begin);
  let resolveOld;
  const oldFetch=new Promise(resolve=>resolveOld=resolve),rendered=[];
  const ctx=vm.createContext({
    document:{body:{dataset:{dashboard:'admin'}}},
    currentAdminView:()=> 'website',adminWebsiteDays:30,adminWebsiteAnalyticsRequest:0,adminWebsiteData:{periodDays:30},
    adminWebsiteLoadError:'',adminDataSyncAt:{},adminSyncCacheKey:(k,u)=>k==='website'?u:k,
    adminSyncFetch:async()=>oldFetch,setDataHealth:()=>{},setAdminSyncState:()=>{},
    renderWebsiteAnalytics:()=>rendered.push('website'),renderAdmin:()=>rendered.push('admin'),
    updateAdminRefreshStamp:()=>{},Promise,Date,Number,String,Error
  });
  vm.runInContext(source.slice(begin,finish),ctx);
  const loading=vm.runInContext("refreshAdminView('website',{force:true,announce:false})",ctx);
  ctx.adminWebsiteDays=7;
  resolveOld({analytics:{periodDays:30,sessions:30}});
  await loading;
  assert.equal(ctx.adminWebsiteData.periodDays,30);
  assert.equal(ctx.adminWebsiteData.sessions,undefined);
  assert.deepEqual(rendered,['website','admin']);
});

test('background same-window response cannot overwrite newer manually requested analytics',async()=>{
  const begin=source.indexOf('async function refreshAdminView(');
  const finish=source.indexOf('\nfunction adminAgentGroup(',begin);
  let settle;
  const background=new Promise(resolve=>settle=resolve),rendered=[];
  const ctx=vm.createContext({
    document:{body:{dataset:{dashboard:'admin'}}},
    currentAdminView:()=> 'website',adminWebsiteDays:30,adminWebsiteAnalyticsRequest:0,
    adminWebsiteData:{periodDays:30,sessions:4},adminWebsiteLoadError:'',
    adminDataSyncAt:{},adminSyncCacheKey:(k,u)=>k==='website'?u:k,
    adminSyncFetch:async()=>background,setDataHealth:()=>{},setAdminSyncState:()=>{},
    renderWebsiteAnalytics:()=>rendered.push('website'),renderAdmin:()=>rendered.push('admin'),
    updateAdminRefreshStamp:()=>{},Promise,Date,Number,String,Error
  });
  vm.runInContext(source.slice(begin,finish),ctx);
  const refreshing=vm.runInContext("refreshAdminView('website',{force:true,announce:false})",ctx);
  ctx.adminWebsiteAnalyticsRequest=1;
  ctx.adminWebsiteData={periodDays:30,sessions:18};
  settle({analytics:{periodDays:30,sessions:5}});
  await refreshing;
  assert.equal(ctx.adminWebsiteData.sessions,18);
  assert.equal(ctx.adminWebsiteLoadError,'');
  assert.deepEqual(rendered,['website','admin']);
});
test('obsolete failed background request does not set stale warning after user selects a new range',async()=>{
  const begin=source.indexOf('async function refreshAdminView(');
  const finish=source.indexOf('\nfunction adminAgentGroup(',begin);
  let rejectOld;
  const background=new Promise((_resolve,reject)=>rejectOld=reject);
  const ctx=vm.createContext({
    document:{body:{dataset:{dashboard:'admin'}}},
    currentAdminView:()=> 'website',adminWebsiteDays:30,adminWebsiteAnalyticsRequest:0,
    adminWebsiteData:{periodDays:30},adminWebsiteLoadError:'',
    adminDataSyncAt:{},adminSyncCacheKey:(k,u)=>k==='website'?u:k,
    adminSyncFetch:async()=>background,setDataHealth:()=>{},setAdminSyncState:()=>{},
    renderWebsiteAnalytics:()=>{},renderAdmin:()=>{},
    updateAdminRefreshStamp:()=>{},Promise,Date,Number,String,Error
  });
  vm.runInContext(source.slice(begin,finish),ctx);
  const refreshing=vm.runInContext("refreshAdminView('website',{force:true,announce:false})",ctx);
  ctx.adminWebsiteAnalyticsRequest=1;ctx.adminWebsiteDays=7;ctx.adminWebsiteData={periodDays:7};
  rejectOld(new Error('obsolete request failed'));
  await refreshing;
  assert.equal(ctx.adminWebsiteLoadError,'');
  assert.equal(ctx.adminWebsiteData.periodDays,7);
});
