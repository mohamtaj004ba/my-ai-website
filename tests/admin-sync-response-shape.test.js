const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('function adminSyncCacheKey(');
const end=source.indexOf('\nasync function refreshAdminView(',begin);
assert.ok(begin>=0&&end>begin);

function fixture(payload){
  const ctx=vm.createContext({
    adminDataSyncAt:{},adminDataSyncInFlight:{},
    fetch:async()=>({ok:true,status:200,json:async()=>payload}),
    Date,Number,Error,Promise
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,run:(key,action=key)=>vm.runInContext(
    'adminSyncFetch('+JSON.stringify(key)+','+
    JSON.stringify('/api/account?action=admin-'+action)+',{force:true})',ctx)};
}
test('background phone inventory with missing numbers rejects without marking stale data fresh',async()=>{
  const f=fixture({});
  await assert.rejects(f.run('phones','phone-numbers'),/Incomplete phones response/);
  assert.equal(f.ctx.adminDataSyncAt.phones,undefined);
  assert.equal(Object.keys(f.ctx.adminDataSyncInFlight).length,0);
});
test('background campaigns and documents require the same fields as bootstrap',async()=>{
  const campaigns=fixture({campaigns:null});
  await assert.rejects(campaigns.run('campaigns','marketing-campaigns'),/Incomplete campaigns response/);
  assert.equal(campaigns.ctx.adminDataSyncAt.campaigns,undefined);
  const documents=fixture({documents:{agreements:[]}});
  await assert.rejects(documents.run('documents','documents'),/Incomplete documents response/);
  assert.equal(documents.ctx.adminDataSyncAt.documents,undefined);
});
test('background website and Finance reads require actual payload objects',async()=>{
  const web=fixture({analytics:[]}),finance=fixture({finance:null});
  await assert.rejects(web.run('website','website-analytics'),/Incomplete website response/);
  await assert.rejects(finance.run('finance','finance'),/Incomplete finance response/);
  assert.equal(Object.keys(web.ctx.adminDataSyncAt).length,0);
  assert.equal(Object.keys(finance.ctx.adminDataSyncAt).length,0);
});
test('well-formed background operational reads cache only confirmed payloads',async()=>{
  const phone=fixture({numbers:[{id:'number-1'}]});
  assert.equal((await phone.run('phones','phone-numbers')).numbers[0].id,'number-1');
  assert.ok(Number(phone.ctx.adminDataSyncAt.phones)>0);
  const documents=fixture({documents:{agreements:[],company:[],standard:[]}});
  assert.equal((await documents.run('documents','documents')).documents.company.length,0);
  assert.ok(Number(documents.ctx.adminDataSyncAt.documents)>0);
});


test('admin bootstrap starts neutral and exposes busy/error state instead of fake zero metrics',()=>{
  const html=fs.readFileSync('admin-dashboard.html','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
  assert.match(html,/class="dashboard-main" aria-busy="true"/);
  assert.match(html,/id="adminLiveLabel">Connecting/);
  assert.match(html,/id="adminMrr">—/);
  assert.match(html,/id="adminActiveClients">—/);
  assert.match(html,/id="adminPastDue">—/);
  assert.match(ui,/bootstrapAdmin\(\)[\s\S]*setAdminSyncState\('syncing','Loading admin data…'\)/);
  assert.match(ui,/Admin bootstrap failed[\s\S]*setAdminSyncState\('error','Admin data could not load · retry or refresh'\)/);
  assert.match(ui,/setAttribute\('aria-busy',String\(state==='syncing'\)\)/);
});


test('admin bootstrap sync announcements remain optional in isolated resilience contexts',()=>{
  assert.match(source,/if\(typeof setAdminSyncState==='function'\)setAdminSyncState\('syncing','Loading admin data…'\)/);
  assert.match(source,/if\(typeof setAdminSyncState==='function'\)setAdminSyncState\('error','Admin data could not load · retry or refresh'\)/);
});


test('Command Center portfolio rings stay neutral until account data is verified',()=>{
  const html=fs.readFileSync('admin-dashboard.html','utf8');
  assert.match(html,/id="adminActivePct">—/);
  assert.match(html,/id="adminActiveCount">Checking accounts…/);
  assert.match(html,/id="adminBillingPct">—/);
  assert.match(html,/id="adminBillingCount">Checking billing…/);
  assert.match(html,/id="adminLivePct">—/);
  assert.match(html,/id="adminLiveCount">Checking onboarding…/);
});
