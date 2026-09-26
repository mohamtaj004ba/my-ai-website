const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('async function refreshAdminView(');
const end=source.indexOf('\nfunction adminAgentGroup(',start);
assert.ok(start>=0&&end>start,'admin view refresh handler must exist');

function fixture(view,{fail=[],responses={}}={}){
  const calls=[],rendered=[],health=[],sync=[];
  const context=vm.createContext({
    document:{body:{dataset:{dashboard:'admin'}}},
    currentAdminView:()=>view,
    setAdminSyncState:(...args)=>sync.push(args),
    setDataHealth:(...args)=>health.push(args),
    adminSyncFetch:async(key,url)=>{calls.push({key,url});if(fail.includes(key))throw Error('Provider '+key+' unavailable');return responses[key]||null},
    adminFinanceData:{reconciliation:[{sessionId:'existing'}]},adminFinanceLoadError:'',
    adminWebsiteData:{prospects:[{id:'existing'}]},adminWebsiteLoadError:'',
    adminPlatformDirty:false,adminWebsiteDays:30,
    renderAdminFinance:()=>rendered.push('finance'),
    renderAdmin:()=>rendered.push('admin'),
    renderGrowth:()=>rendered.push('growth'),
    renderWebsiteAnalytics:()=>rendered.push('website'),
    renderProvisioning:()=>rendered.push('provisioning'),
    renderAdminFleet:()=>rendered.push('fleet'),
    renderPhones:()=>rendered.push('phones'),
    renderDocuments:()=>rendered.push('documents'),
    renderAdminSupport:()=>rendered.push('support'),
    renderAdminFeedback:()=>rendered.push('feedback'),
    renderClientCareTabs:()=>rendered.push('care'),
    renderHealth:()=>rendered.push('health'),
    renderPlatformSettings:()=>rendered.push('platform'),
    updateAdminRefreshStamp:()=>rendered.push('stamp'),
    Promise,Date,Number,String,Error
  });
  vm.runInContext(source.slice(start,end),context);
  return {context,calls,rendered,health,sync,run:()=>vm.runInContext('refreshAdminView('+JSON.stringify(view)+',{force:true})',context)};
}
test('failed Finance refresh renders a stale warning beside last verified reconciliation records',async()=>{
  const f=fixture('finance',{fail:['finance']});
  await assert.rejects(f.run(),/Provider finance unavailable/);
  assert.equal(f.context.adminFinanceData.reconciliation[0].sessionId,'existing');
  assert.match(f.context.adminFinanceLoadError,/outdated/);
  assert.deepEqual(f.rendered,['finance','admin']);
  assert.deepEqual(f.health,[['adminDataHealth',true]]);
  assert.equal(f.sync.at(-1)[0],'error');
});
test('overview still renders verified data and Finance stale warning when one feed fails',async()=>{
  const f=fixture('overview',{fail:['finance'],responses:{summary:{summary:{activeClients:2}}}});
  await assert.rejects(f.run(),/Provider finance unavailable/);
  assert.equal(f.context.adminSummaryData.activeClients,2);
  assert.match(f.context.adminFinanceLoadError,/outdated/);
  assert.deepEqual(f.rendered,['finance','admin']);
});
test('Growth keeps its last prospect snapshot and shows stale coverage on failed analytics fetch',async()=>{
  const f=fixture('growth',{fail:['website'],responses:{campaigns:{campaigns:[{id:'campaign-new'}]}}});
  await assert.rejects(f.run(),/Provider website unavailable/);
  assert.match(f.context.adminWebsiteLoadError,/outdated/);
  assert.equal(f.context.adminWebsiteData.prospects[0].id,'existing');
  assert.equal(f.context.adminCampaignData[0].id,'campaign-new');
  assert.deepEqual(f.rendered,['website','growth','admin']);
});
test('successful Finance refresh clears an earlier stale warning and updates snapshot',async()=>{
  const f=fixture('finance',{responses:{finance:{finance:{reconciliation:[{sessionId:'fresh'}]}}}});
  f.context.adminFinanceLoadError='Old warning';
  await f.run();
  assert.equal(f.context.adminFinanceLoadError,'');
  assert.equal(f.context.adminFinanceData.reconciliation[0].sessionId,'fresh');
  assert.deepEqual(f.rendered,['finance','admin','stamp']);
  assert.deepEqual(f.health,[]);
});
