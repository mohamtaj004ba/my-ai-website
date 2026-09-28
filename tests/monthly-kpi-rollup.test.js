const test=require('node:test');
const assert=require('node:assert/strict');
const {
  MONTHLY_KPI_INDEX_KEY,MAX_MONTHLY_KPI_MONTHS,COVERAGE_FIELDS,monthKey,sanitizeMonthlyKpiSnapshot,
  monthlyKpiStorageKey,recordMonthlyKpiSnapshot
}=require('../lib/monthly-kpi-rollup');

function storeFixture(initial={}){
  const records=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.parse(JSON.stringify(v))])),calls=[];
  const kv={
    async get(key){const v=records.get(key);return v===undefined?null:JSON.parse(JSON.stringify(v))},
    async eval(_script,keys,args){
      calls.push({keys:[...keys],args:[...args]});
      for(let i=0;i<keys.length;i++){
        const current=records.has(keys[i])?JSON.stringify(records.get(keys[i])):'';
        if(current!==args[i*2])return 0;
      }
      for(let i=0;i<keys.length;i++)records.set(keys[i],JSON.parse(args[i*2+1]));
      return 1;
    }
  };
  return {kv,records,calls};
}
function sample(overrides={}){
  return {month:'2026-09',recordedAt:1000,sessions:120,visitors:90,pageViews:400,leads:20,conversions:5,conversionRate:25,
    mrr:1995,arr:23940,setupRevenue:2500,churnedClients:1,calls:300,minutes:2500,appointments:44,transfers:22,paymentFailures:2,supportTickets:9,
    planMix:{Starter:2,Growth:3,Pro:1},callOutcomes:{resolvedByAi:100,requestCaptured:40,messageTaken:30,transferred:22,escalated:5,incomplete:2,nonCustomer:10},coverage:{websiteEvents:true,websiteSessions:true,websiteVisitors:true,leadPipeline:true,workspaces:true,churn:true,calls:true,callMinutes:true,callOutcomes:true,appointments:true,support:true,paymentFailures:false},...overrides};
}

test('monthly KPI snapshots accept only aggregate-safe schema and normalized values',()=>{
  const s=sanitizeMonthlyKpiSnapshot(sample({conversionRate:25.678,mrr:1995.126}));
  assert.equal(s.month,'2026-09');assert.equal(s.conversionRate,25.68);assert.equal(s.mrr,1995.13);
  assert.deepEqual(s.planMix,{Starter:2,Growth:3,Pro:1});assert.equal(s.callOutcomes.resolvedByAi,100);
  for(const forbidden of ['email','phone','workspaceId','visitorId','sessionId','name','notes','transcript','message']){
    assert.throws(()=>sanitizeMonthlyKpiSnapshot({...sample(),[forbidden]:'private'}),/Unexpected monthly KPI field/);
  }
});

test('monthly KPI snapshots preserve unknown metrics as null and normalize fixed coverage flags',()=>{
  const s=sanitizeMonthlyKpiSnapshot(sample({paymentFailures:null,churnedClients:null,conversionRate:null,planMix:null,callOutcomes:null,coverage:{workspaces:true,paymentFailures:false}}));
  assert.equal(s.paymentFailures,null);assert.equal(s.churnedClients,null);assert.equal(s.conversionRate,null);
  assert.equal(s.planMix,null);assert.equal(s.callOutcomes,null);
  assert.equal(s.coverage.workspaces,true);assert.equal(s.coverage.paymentFailures,false);
  for(const key of COVERAGE_FIELDS)assert.equal(typeof s.coverage[key],'boolean',key);
  assert.throws(()=>sanitizeMonthlyKpiSnapshot(sample({coverage:{workspaceEmails:true}})),/Unexpected monthly KPI coverage key/);
});

test('monthly KPI snapshot rejects free-form dimensions and invalid counts',()=>{
  assert.throws(()=>sanitizeMonthlyKpiSnapshot(sample({planMix:{Growth:2,'Acme Client':1}})),/Unexpected monthly KPI planMix key/);
  assert.throws(()=>sanitizeMonthlyKpiSnapshot(sample({callOutcomes:{transferred:2,callerName:1}})),/Unexpected monthly KPI callOutcomes key/);
  assert.throws(()=>sanitizeMonthlyKpiSnapshot(sample({sessions:-1})),/Invalid monthly KPI sessions/);
  assert.throws(()=>sanitizeMonthlyKpiSnapshot(sample({conversionRate:101})),/conversionRate/);
  assert.throws(()=>sanitizeMonthlyKpiSnapshot(sample({month:'2026-13'})),/month is invalid/);
});

test('month keys are UTC-stable and storage key is explicit',()=>{
  assert.equal(monthKey('2026-09-30T23:59:59Z'),'2026-09');
  assert.equal(monthKey('2026-10-01T00:00:00Z'),'2026-10');
  assert.equal(monthlyKpiStorageKey('2026-09'),'analytics:monthly:2026-09');
});

test('first monthly snapshot atomically publishes record and sorted month index',async()=>{
  const f=storeFixture(),r=await recordMonthlyKpiSnapshot(f.kv,sample());
  assert.equal(r.saved,true);assert.deepEqual(r.index,['2026-09']);assert.equal(f.calls.length,1);
  assert.equal(f.records.get('analytics:monthly:2026-09').sessions,120);
  assert.deepEqual(f.records.get(MONTHLY_KPI_INDEX_KEY),['2026-09']);
  assert.deepEqual(f.calls[0].keys,['analytics:monthly:2026-09',MONTHLY_KPI_INDEX_KEY]);
});

test('newer same-month snapshot replaces aggregate without duplicating index and older snapshot is ignored',async()=>{
  const initial=sample({recordedAt:1000,sessions:10}),f=storeFixture({
    'analytics:monthly:2026-09':initial,[MONTHLY_KPI_INDEX_KEY]:['2026-09']
  });
  let r=await recordMonthlyKpiSnapshot(f.kv,sample({recordedAt:2000,sessions:20}));
  assert.equal(r.saved,true);assert.equal(f.records.get('analytics:monthly:2026-09').sessions,20);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].keys,['analytics:monthly:2026-09']);
  r=await recordMonthlyKpiSnapshot(f.kv,sample({recordedAt:1500,sessions:15}));
  assert.equal(r.saved,false);assert.equal(f.calls.length,1);assert.equal(f.records.get('analytics:monthly:2026-09').sessions,20);
});

test('monthly history fails closed on malformed snapshots, malformed index and capacity',async()=>{
  await assert.rejects(()=>recordMonthlyKpiSnapshot(storeFixture({'analytics:monthly:2026-09':[]}).kv,sample()),/snapshot is malformed/);
  await assert.rejects(()=>recordMonthlyKpiSnapshot(storeFixture({[MONTHLY_KPI_INDEX_KEY]:['bad']}).kv,sample()),/index is malformed/);
  const months=[];for(let y=2000;months.length<MAX_MONTHLY_KPI_MONTHS;y++)for(let m=1;m<=12&&months.length<MAX_MONTHLY_KPI_MONTHS;m++)months.push(String(y)+'-'+String(m).padStart(2,'0'));
  await assert.rejects(()=>recordMonthlyKpiSnapshot(storeFixture({[MONTHLY_KPI_INDEX_KEY]:months}).kv,sample({month:'2099-12'})),/capacity reached/);
});

test('newer partial snapshot cannot downgrade a previously complete monthly source',async()=>{
  const complete=sample({recordedAt:1000,sessions:10,coverage:{websiteEvents:true,websiteSessions:true,websiteVisitors:true,leadPipeline:true,workspaces:true,churn:true,calls:true,callMinutes:true,callOutcomes:true,appointments:true,support:true,paymentFailures:false}});
  const f=storeFixture({'analytics:monthly:2026-09':sanitizeMonthlyKpiSnapshot(complete),[MONTHLY_KPI_INDEX_KEY]:['2026-09']});
  const partial=sample({recordedAt:2000,sessions:null,coverage:{websiteEvents:false,websiteSessions:false,websiteVisitors:false,leadPipeline:true,workspaces:true,churn:true,calls:true,callMinutes:true,callOutcomes:true,appointments:true,support:true,paymentFailures:false}});
  const r=await recordMonthlyKpiSnapshot(f.kv,partial);
  assert.equal(r.saved,false);assert.equal(r.degraded,true);assert.equal(f.calls.length,0);
  assert.equal(f.records.get('analytics:monthly:2026-09').sessions,10);
});

test('monthly snapshot retries compare conflicts without overwriting a concurrent newer snapshot',async()=>{
  const f=storeFixture(),realEval=f.kv.eval.bind(f.kv);let first=true;
  f.kv.eval=async(script,keys,args)=>{
    if(first){first=false;f.records.set('analytics:monthly:2026-09',sample({recordedAt:5000,sessions:500}));f.records.set(MONTHLY_KPI_INDEX_KEY,['2026-09']);return 0}
    return realEval(script,keys,args);
  };
  const r=await recordMonthlyKpiSnapshot(f.kv,sample({recordedAt:2000,sessions:20}));
  assert.equal(r.saved,false);assert.equal(r.snapshot.recordedAt,5000);assert.equal(f.records.get('analytics:monthly:2026-09').sessions,500);
});
