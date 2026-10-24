const test=require('node:test');
const assert=require('node:assert/strict');
const {COVERAGE_FIELDS,monthlyKpiStorageKey}=require('../lib/monthly-kpi-rollup');
const {MONTH_END_FRESHNESS_MS,previousMonthWindow,monthlyFinalizationKey,finalizePreviousMonthlyKpi}=require('../lib/monthly-kpi-finalization');

function coverage(overrides={}){return Object.fromEntries(COVERAGE_FIELDS.map(k=>[k,overrides[k]===undefined?true:overrides[k]]))}
function fixture(records={}){
  const values=new Map(Object.entries(records).map(([k,v])=>[k,JSON.parse(JSON.stringify(v))]));
  return {values,kv:{
    async get(key){const value=values.get(key);return value===undefined?null:JSON.parse(JSON.stringify(value))},
    async eval(script,keys,args){
      for(let i=0;i<keys.length;i++){
        const current=values.has(keys[i])?JSON.stringify(values.get(keys[i])):'';
        if(current!==args[i*2])return 0;
      }
      for(let i=0;i<keys.length;i++)values.set(keys[i],JSON.parse(args[i*2+1]));
      return 1;
    }
  }};
}

test('previous month window uses UTC boundaries',()=>{
  const w=previousMonthWindow(Date.UTC(2026,9,1,5));
  assert.equal(w.month,'2026-09');
  assert.equal(w.start,Date.UTC(2026,8,1));
  assert.equal(w.end,Date.UTC(2026,9,1));
});

test('complete near-month-end snapshot finalizes once with aggregate-only marker',async()=>{
  const now=Date.UTC(2026,9,1,5),recordedAt=Date.UTC(2026,8,30,5,30),month='2026-09';
  const f=fixture({[monthlyKpiStorageKey(month)]:{month,recordedAt,coverage:coverage(),mrr:999,pageViews:12}});
  const first=await finalizePreviousMonthlyKpi(f.kv,{now}),second=await finalizePreviousMonthlyKpi(f.kv,{now:now+1000});
  assert.equal(first.finalized,true);assert.equal(first.marker.coverageComplete,true);
  assert.equal(second.alreadyFinalized,true);
  const marker=f.values.get(monthlyFinalizationKey(month));
  assert.deepEqual(Object.keys(marker).sort(),['coverageComplete','finalizedAt','month','snapshotRecordedAt'].sort());
  assert.equal(JSON.stringify(marker).includes('999'),false);
});

test('incomplete coverage never finalizes',async()=>{
  const now=Date.UTC(2026,9,1,5),month='2026-09',recordedAt=Date.UTC(2026,8,30,12);
  const f=fixture({[monthlyKpiStorageKey(month)]:{month,recordedAt,coverage:coverage({paymentFailures:false})}});
  const result=await finalizePreviousMonthlyKpi(f.kv,{now});
  assert.equal(result.finalized,false);assert.equal(result.reason,'coverage_incomplete');
  assert.deepEqual(result.incompleteSources,['paymentFailures']);
  assert.equal(f.values.has(monthlyFinalizationKey(month)),false);
});

test('stale prior-month snapshot remains unfinalized instead of pretending month-end coverage',async()=>{
  const now=Date.UTC(2026,9,1,5),month='2026-09',recordedAt=Date.UTC(2026,8,20);
  const f=fixture({[monthlyKpiStorageKey(month)]:{month,recordedAt,coverage:coverage()}});
  const result=await finalizePreviousMonthlyKpi(f.kv,{now});
  assert.equal(result.finalized,false);assert.equal(result.reason,'snapshot_not_near_month_end');
  assert.equal(f.values.has(monthlyFinalizationKey(month)),false);
  assert.equal(MONTH_END_FRESHNESS_MS,24*60*60*1000);
});

test('missing snapshot remains explicit and performs no write',async()=>{
  const now=Date.UTC(2026,9,1,5),f=fixture();
  const result=await finalizePreviousMonthlyKpi(f.kv,{now});
  assert.equal(result.reason,'snapshot_missing');assert.equal(result.finalized,false);
  assert.equal(f.values.size,0);
});
