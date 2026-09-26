const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('async function loadAdminOps(){'),end=source.indexOf('\nfunction currentAdminView(){',start);
assert.ok(start>=0&&end>start);

function fixture({finance={ok:true,payload:{finance:{reconciliation:[{id:'fresh'}]}}},website={ok:true,payload:{analytics:{prospects:[{id:'fresh'}]}}},preferredDays=30,failNetwork=[]}={}){
  const health=[],rendered=[],calls=[];
  const response=(config)=>({ok:config.ok,json:async()=>config.payload||{}});
  const context=vm.createContext({
    adminWebsiteDays:30,adminWebsiteAnalyticsRequest:0,adminWebsiteData:{prospects:[{id:'older'}]},adminWebsiteLoadError:'',
    adminFinanceData:{reconciliation:[{id:'older'}]},adminFinanceLoadError:'',
    adminDataSyncAt:{},adminPlatformDirty:false,
    adminPlatformData:{analyticsWindowDays:preferredDays},adminProvisioningData:[],adminDocumentsData:{agreements:[],company:[],standard:[]},
    fetch:async url=>{calls.push(url);if(failNetwork.some(action=>url.includes(action)))throw Error('Network connection failed');if(url.includes('admin-finance'))return response(finance);if(url.includes('admin-website-analytics'))return response(website);if(url.includes('admin-platform-settings'))return response({ok:true,payload:{settings:{analyticsWindowDays:preferredDays}}});return response({ok:true,payload:{}})},
    setDataHealth:(...args)=>health.push(args),
    console:{error:()=>{}},
    renderProvisioning:()=>rendered.push('provisioning'),renderPhones:()=>rendered.push('phones'),
    renderHealth:()=>rendered.push('health'),renderWebsiteAnalytics:()=>rendered.push('website'),
    renderGrowth:()=>rendered.push('growth'),renderDocuments:()=>rendered.push('documents'),
    renderAdminFleet:()=>rendered.push('fleet'),renderAdminSupport:()=>rendered.push('support'),
    renderAdminFeedback:()=>rendered.push('feedback'),renderAdminFinance:()=>rendered.push('finance'),
    renderPlatformSettings:()=>rendered.push('platform'),renderAdmin:()=>rendered.push('admin'),
    Promise,Date,Number,Array,String
  });
  vm.runInContext(source.slice(start,end),context);
  return {context,health,rendered,calls,run:()=>vm.runInContext('loadAdminOps()',context)};
}
test('admin bootstrap preserves Finance snapshot and flags malformed 200 response',async()=>{
  const f=fixture({finance:{ok:true,payload:{ok:true}}});
  await f.run();
  assert.equal(f.context.adminFinanceData.reconciliation[0].id,'older');
  assert.match(f.context.adminFinanceLoadError,/incomplete/);
  assert.equal(f.context.adminDataSyncAt.finance,undefined);
  assert.deepEqual(f.health.at(-1),['adminDataHealth',true]);
  assert.ok(f.rendered.includes('finance'));
});
test('admin bootstrap keeps older Growth snapshot on unavailable website feed',async()=>{
  const f=fixture({website:{ok:false}});
  await f.run();
  assert.equal(f.context.adminWebsiteData.prospects[0].id,'older');
  assert.match(f.context.adminWebsiteLoadError,/outdated/);
  assert.equal(f.context.adminDataSyncAt.website,undefined);
  assert.deepEqual(f.health.at(-1),['adminDataHealth',true]);
  assert.ok(f.rendered.includes('growth'));
});
test('admin bootstrap marks only successfully loaded Finance and website data as fresh',async()=>{
  const f=fixture();await f.run();
  assert.equal(f.context.adminFinanceLoadError,'');
  assert.equal(f.context.adminWebsiteLoadError,'');
  assert.equal(f.context.adminFinanceData.reconciliation[0].id,'fresh');
  assert.equal(f.context.adminWebsiteData.prospects[0].id,'fresh');
  assert.ok(Number(f.context.adminDataSyncAt.finance)>0);
  assert.ok(Number(f.context.adminDataSyncAt.website)>0);
  assert.deepEqual(f.health.at(-1),['adminDataHealth',false]);
});
test('preferred website analytics window failure is disclosed, not recorded as a valid sync',async()=>{
  const f=fixture({preferredDays:7,website:{ok:false}});await f.run();
  assert.equal(f.context.adminWebsiteDays,7);
  assert.match(f.context.adminWebsiteLoadError,/outdated/);
  assert.equal(f.context.adminDataSyncAt.website,undefined);
});

test('network failure in one admin endpoint does not hide healthy Finance and website records',async()=>{
  const f=fixture({failNetwork:['admin-phone-numbers']});await f.run();
  assert.equal(f.context.adminFinanceData.reconciliation[0].id,'fresh');
  assert.equal(f.context.adminWebsiteData.prospects[0].id,'fresh');
  assert.ok(Number(f.context.adminDataSyncAt.finance)>0);
  assert.ok(Number(f.context.adminDataSyncAt.website)>0);
  assert.equal(f.context.adminDataSyncAt.phones,undefined);
  assert.deepEqual(f.health[0],['adminDataHealth',true]);
  assert.ok(f.rendered.includes('finance'));
  assert.ok(f.rendered.includes('website'));
});
test('network failure in Finance keeps existing reconciliation and permits healthy website sync',async()=>{
  const f=fixture({failNetwork:['admin-finance']});await f.run();
  assert.equal(f.context.adminFinanceData.reconciliation[0].id,'older');
  assert.match(f.context.adminFinanceLoadError,/outdated/);
  assert.equal(f.context.adminWebsiteData.prospects[0].id,'fresh');
  assert.equal(f.context.adminDataSyncAt.finance,undefined);
  assert.ok(Number(f.context.adminDataSyncAt.website)>0);
  assert.ok(f.rendered.includes('finance'));
});
test('failed preferred analytics window request preserves existing result with disclosure',async()=>{
  const f=fixture({preferredDays:7,failNetwork:['admin-website-analytics']});await f.run();
  assert.equal(f.context.adminWebsiteDays,7);
  assert.equal(f.context.adminWebsiteData.prospects[0].id,'older');
  assert.match(f.context.adminWebsiteLoadError,/outdated/);
  assert.equal(f.context.adminDataSyncAt.website,undefined);
  assert.equal(f.calls.filter(url=>url.includes('admin-website-analytics')).length,2);
});

test('later operational reload respects manually selected range rather than platform default',async()=>{
  const f=fixture({preferredDays:90});
  f.context.adminWebsiteDays=7;f.context.adminWebsiteAnalyticsRequest=1;
  await f.run();
  assert.equal(f.context.adminWebsiteDays,7);
  assert.equal(f.calls.filter(url=>url.includes('admin-website-analytics')).length,1);
  assert.ok(f.calls.some(url=>url.includes('admin-website-analytics&days=7')));
});
test('in-flight bootstrap cannot replace newer manual analytics selection',async()=>{
  const f=fixture({preferredDays:90});
  const original=f.context.fetch;
  let resolveWebsite;
  f.context.fetch=async url=>url.includes('admin-website-analytics')?new Promise(ok=>resolveWebsite=ok):original(url);
  const loading=f.run();
  await new Promise(resolve=>setImmediate(resolve));
  f.context.adminWebsiteDays=7;f.context.adminWebsiteAnalyticsRequest=1;
  f.context.adminWebsiteData={prospects:[{id:'manually-selected'}],periodDays:7};
  resolveWebsite({ok:true,json:async()=>({analytics:{prospects:[{id:'obsolete'}],periodDays:30}})});
  await loading;
  assert.equal(f.context.adminWebsiteDays,7);
  assert.equal(f.context.adminWebsiteData.prospects[0].id,'manually-selected');
  assert.equal(f.context.adminWebsiteLoadError,'');
});
