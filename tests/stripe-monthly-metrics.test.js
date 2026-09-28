const test=require('node:test');
const assert=require('node:assert/strict');
const {
  STRIPE_MONTHLY_METRICS_COVERAGE_KEY,STRIPE_METRIC_RECEIPT_SECONDS,
  monthlyStripeMetricKey,stripeMetricReceiptKey,ensureStripeMonthlyMetricsCoverage,
  recordStripePaymentFailure,readStripeMonthlyPaymentFailures
}=require('../lib/stripe-monthly-metrics');

function fixture(initial={}){
  const records=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.parse(JSON.stringify(v))])),evals=[];
  const kv={
    async get(key){const v=records.get(key);return v===undefined?null:JSON.parse(JSON.stringify(v))},
    async eval(script,keys,args){
      evals.push({script,keys:[...keys],args:[...args]});
      if(script.includes("local metricType=redis.call('TYPE',KEYS[1]).ok")){
        if(records.has(keys[1])&&typeof records.get(keys[1])!=='object')return -1;
        if(records.has(keys[2]))return 0;
        let metric=records.get(keys[1])||{month:args[0],paymentFailures:0,updatedAt:0};
        if(!metric||typeof metric!=='object'||Array.isArray(metric)||metric.month!==args[0]||!Number.isInteger(Number(metric.paymentFailures))||Number(metric.paymentFailures)<0)return -3;
        metric={...metric,paymentFailures:Number(metric.paymentFailures)+1,updatedAt:Number(args[1])};
        records.set(keys[1],metric);records.set(keys[2],1);return 1;
      }
      for(let i=0;i<keys.length;i++){
        const current=records.has(keys[i])?JSON.stringify(records.get(keys[i])):'';
        if(current!==args[i*2])return 0;
      }
      for(let i=0;i<keys.length;i++)records.set(keys[i],JSON.parse(args[i*2+1]));
      return 1;
    }
  };
  return {kv,records,evals};
}

test('coverage marker initializes once and never moves forward on later refreshes',async()=>{
  const f=fixture(),first=await ensureStripeMonthlyMetricsCoverage(f.kv,1000),later=await ensureStripeMonthlyMetricsCoverage(f.kv,5000);
  assert.equal(first.startedAt,1000);assert.equal(later.startedAt,1000);
  assert.deepEqual(f.records.get(STRIPE_MONTHLY_METRICS_COVERAGE_KEY),{startedAt:1000});
});

test('payment failure event is counted once in its event month with a hashed receipt key',async()=>{
  const now=Date.UTC(2026,8,20),event={id:'evt_sensitive_provider_id',created:Math.floor(Date.UTC(2026,7,31,23,59)/1000)};
  const f=fixture(),first=await recordStripePaymentFailure(f.kv,event,{now}),second=await recordStripePaymentFailure(f.kv,event,{now:now+1000});
  assert.equal(first.month,'2026-08');assert.equal(first.counted,true);assert.equal(second.duplicate,true);
  assert.equal(f.records.get(monthlyStripeMetricKey('2026-08')).paymentFailures,1);
  const receipt=stripeMetricReceiptKey(event.id);
  assert.ok(receipt.startsWith('stripe:metric-event:'));assert.equal(receipt.includes(event.id),false);
  assert.equal(f.records.has(receipt),true);
  const metricEval=f.evals.find(x=>x.script.includes('metricType'));
  assert.equal(metricEval.args[2],String(STRIPE_METRIC_RECEIPT_SECONDS));
});

test('mid-month observation keeps that month unknown even if failures were recorded',async()=>{
  const start=Date.UTC(2026,8,1),mid=Date.UTC(2026,8,15),f=fixture();
  await ensureStripeMonthlyMetricsCoverage(f.kv,mid);
  await recordStripePaymentFailure(f.kv,{id:'evt_1',created:Math.floor((mid+1000)/1000)},{now:mid+2000});
  const r=await readStripeMonthlyPaymentFailures(f.kv,'2026-09',start);
  assert.equal(r.complete,false);assert.equal(r.count,null);assert.equal(r.reason,'partial_month');assert.equal(r.coverageStartedAt,mid);
});

test('a fully observed later month truthfully reports zero when no failure metric exists',async()=>{
  const coverage=Date.UTC(2026,8,15),october=Date.UTC(2026,9,1),f=fixture({[STRIPE_MONTHLY_METRICS_COVERAGE_KEY]:{startedAt:coverage}});
  const r=await readStripeMonthlyPaymentFailures(f.kv,'2026-10',october);
  assert.equal(r.complete,true);assert.equal(r.count,0);assert.equal(r.reason,'');
});

test('a fully observed later month returns its durable failure count',async()=>{
  const coverage=Date.UTC(2026,8,15),october=Date.UTC(2026,9,1),f=fixture({
    [STRIPE_MONTHLY_METRICS_COVERAGE_KEY]:{startedAt:coverage},
    [monthlyStripeMetricKey('2026-10')]:{month:'2026-10',paymentFailures:3,updatedAt:october+1000}
  });
  const r=await readStripeMonthlyPaymentFailures(f.kv,'2026-10',october);
  assert.equal(r.complete,true);assert.equal(r.count,3);
});

test('missing coverage remains unknown rather than silently becoming zero',async()=>{
  const f=fixture(),r=await readStripeMonthlyPaymentFailures(f.kv,'2026-10',Date.UTC(2026,9,1));
  assert.equal(r.complete,false);assert.equal(r.count,null);assert.equal(r.reason,'coverage_not_started');
});

test('malformed coverage or monthly metric fails closed',async()=>{
  await assert.rejects(()=>ensureStripeMonthlyMetricsCoverage(fixture({[STRIPE_MONTHLY_METRICS_COVERAGE_KEY]:{startedAt:'bad'}}).kv,1000),/coverage marker is malformed/);
  const monthStart=Date.UTC(2026,9,1),coverage=Date.UTC(2026,8,1);
  const f=fixture({[STRIPE_MONTHLY_METRICS_COVERAGE_KEY]:{startedAt:coverage},[monthlyStripeMetricKey('2026-10')]:{month:'2026-10',paymentFailures:-1,updatedAt:monthStart}});
  await assert.rejects(()=>readStripeMonthlyPaymentFailures(f.kv,'2026-10',monthStart),/record is malformed/);
});

test('invalid or missing Stripe event identity cannot create an un-deduplicated metric',async()=>{
  const f=fixture();
  await assert.rejects(()=>recordStripePaymentFailure(f.kv,{created:1},{now:1000}),/event is invalid/);
  await assert.rejects(()=>recordStripePaymentFailure(f.kv,{id:'evt_1',created:0},{now:1000}),/event is invalid/);
  assert.equal(f.records.size,0);
});
