const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
const start=api.indexOf('async function adminMonthlyKpiRefresh('),end=api.indexOf('\nasync function adminSummary(',start);
assert.ok(start>=0&&end>start);

function backend({admin=true,result,error}={}){
  let code=200,body;
  const ctx=vm.createContext({
    req:{},res:{status(n){code=n;return this},json(x){body=x;return x}},
    requireAdmin:async()=>admin?({email:'admin@example.test'}):null,
    refreshMonthlyKpiSnapshot:async()=>{
      if(error)throw new Error('storage detail that must not leak');
      return result||{saved:true,cached:false,degraded:false,snapshot:{month:'2026-09',recordedAt:123,coverage:{workspaces:true,paymentFailures:false},mrr:999,planMix:{Pro:1},private:'do-not-return'},issues:[{domain:'paymentFailures',reason:'event_history_unavailable'}]};
    },
    kv:{},safeError:()=> 'redacted',console:{error(){}},String,Number,Array,Object
  });
  vm.runInContext(api.slice(start,end),ctx);
  return {run:async()=>{await vm.runInContext('adminMonthlyKpiRefresh(req,res)',ctx);return {code,body}}};
}

test('admin monthly KPI refresh returns only aggregate refresh status and coverage metadata',async()=>{
  const r=await backend().run();
  assert.equal(r.code,200);
  assert.equal(r.body.monthlyKpi.month,'2026-09');
  assert.equal(r.body.monthlyKpi.recordedAt,123);
  assert.equal(r.body.monthlyKpi.saved,true);
  assert.equal(r.body.monthlyKpi.cached,false);
  assert.equal(r.body.monthlyKpi.degraded,false);
  assert.deepEqual(JSON.parse(JSON.stringify(r.body.monthlyKpi.coverage)),{workspaces:true,paymentFailures:false});
  assert.deepEqual(JSON.parse(JSON.stringify(r.body.monthlyKpi.issues)),[{domain:'paymentFailures',reason:'event_history_unavailable'}]);
  const serialized=JSON.stringify(r.body);
  for(const forbidden of ['mrr','planMix','private','do-not-return','admin@example.test'])assert.equal(serialized.includes(forbidden),false,forbidden);
});

test('monthly KPI refresh failure preserves retained history and exposes no storage detail',async()=>{
  const r=await backend({error:true}).run();
  assert.equal(r.code,503);
  assert.match(r.body.error,/retained history was left unchanged/);
  assert.equal(JSON.stringify(r.body).includes('storage detail'),false);
});

test('monthly KPI refresh remains admin-gated',async()=>{
  const r=await backend({admin:false}).run();
  assert.equal(r.body,undefined);
});

test('account dispatcher exposes monthly KPI refresh as a POST-only admin mutation',()=>{
  assert.match(api,/action==='admin-monthly-kpi-refresh'&&req\.method==='POST'\)return adminMonthlyKpiRefresh/);
  assert.doesNotMatch(api,/action==='admin-monthly-kpi-refresh'&&req\.method==='GET'/);
  assert.match(api,/if\(req\.method==='POST'&&!mutationOriginAllowed\(req\)\)/);
});

test('admin dashboard refreshes KPI rollup in the background after normal operations load',()=>{
  const helper=ui.slice(ui.indexOf('async function refreshAdminMonthlyKpi('),ui.indexOf('async function bootstrapAdmin('));
  const bootstrap=ui.slice(ui.indexOf('async function bootstrapAdmin('),ui.indexOf('async function loadAdminOps('));
  assert.match(helper,/admin-monthly-kpi-refresh/);
  assert.match(helper,/method:'POST'/);
  assert.match(helper,/adminMonthlyKpiStatus=\{ok:false/);
  assert.match(helper,/adminDataSyncAt\.monthlyKpi=Date\.now\(\)/);
  assert.match(bootstrap,/await loadAdminOps\(\);void refreshAdminMonthlyKpi\(\);initAdminLiveRefresh\(\)/);
  assert.doesNotMatch(bootstrap,/await refreshAdminMonthlyKpi\(\)/);
});
