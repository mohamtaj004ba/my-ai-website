const test=require('node:test');
const assert=require('node:assert/strict');
const {buildMonthlyKpiSnapshot,refreshMonthlyKpiSnapshot,parseDurationSeconds,dispositionKey}=require('../lib/monthly-kpi-producer');
const {sanitizeMonthlyKpiSnapshot,MONTHLY_KPI_INDEX_KEY}=require('../lib/monthly-kpi-rollup');
const {STRIPE_MONTHLY_METRICS_COVERAGE_KEY,monthlyStripeMetricKey}=require('../lib/stripe-monthly-metrics');

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function fixture({records={},lists={}}={}){
  const store=new Map(Object.entries(records).map(([k,v])=>[k,clone(v)])),listStore=new Map(Object.entries(lists).map(([k,v])=>[k,clone(v)]));
  const calls={get:0,lrange:0,eval:0};
  const kv={
    async get(key){calls.get++;return store.has(key)?clone(store.get(key)):null},
    async lrange(key,start,end){calls.lrange++;const list=listStore.get(key)||[];return clone(list.slice(start,end+1))},
    async eval(_script,keys,args){
      calls.eval++;
      for(let i=0;i<keys.length;i++){
        const current=store.has(keys[i])?JSON.stringify(store.get(keys[i])):'';
        if(current!==args[i*2])return 0;
      }
      for(let i=0;i<keys.length;i++)store.set(keys[i],JSON.parse(args[i*2+1]));
      return 1;
    }
  };
  return {kv,store,listStore,calls};
}

const monthNow=Date.UTC(2026,8,20,12),monthStart=Date.UTC(2026,8,1),prev=Date.UTC(2026,7,31,23,59);

function completeFixture(){
  return fixture({
    records:{
      'workspace:index':['w1','w2','w3'],
      'workspace:w1':{id:'w1',name:'Private One',ownerEmail:'one@example.test',plan:'Growth',status:'active',subscriptionStatus:'active',conversion:{firstPaidAt:monthStart+1000,setupValue:500}},
      'workspace:w2':{id:'w2',name:'Private Two',ownerEmail:'two@example.test',plan:'Starter',status:'active',subscriptionStatus:'canceled',stripeBilling:{canceledAt:monthStart+2000},conversion:{firstPaidAt:Date.UTC(2026,6,1),setupValue:500}},
      'workspace:w3':{id:'w3',name:'Private Three',ownerEmail:'three@example.test',plan:'Pro',status:'active',subscriptionStatus:'active'},
      'calls:index:w1':[
        {id:'c2',createdAt:monthStart+5000,duration:'0:30',disposition:'transferred',caller:'Secret Caller',phone:'5095550101'},
        {id:'c1',createdAt:monthStart+4000,duration:'1:30',disposition:'resolved_by_ai',caller:'Another Caller'}
      ],
      'calls:index:w2':[{id:'old',createdAt:prev,duration:'2:00',disposition:'message_taken'}],
      'calls:index:w3':[],
      'appointments:w1':[{id:'a1',createdAt:monthStart+7000,name:'Private Appointment'}],
      'appointments:w2':[{id:'a-old',createdAt:prev}],
      'appointments:w3':[],
      'site:session:s2':{id:'s2',firstAt:monthStart+3000,visitorId:'visitor-2'},
      'site:session:s1':{id:'s1',firstAt:monthStart+2000,visitorId:'visitor-1'},
      'site:session:sold':{id:'sold',firstAt:prev,visitorId:'old'},
      'site:prospect:p2':{id:'p2',createdAt:monthStart+3000,email:'private2@example.test'},
      'site:prospect:p1':{id:'p1',createdAt:monthStart+2000,email:'private1@example.test'},
      'site:prospect:pold':{id:'pold',createdAt:prev,email:'old@example.test'},
      'support:index':['t1','t-old'],
      'support:t1':{id:'t1',createdAt:monthStart+8000,email:'support-private@example.test',subject:'Private issue'},
      'support:t-old':{id:'t-old',createdAt:prev}
    },
    lists:{
      'site:events':[
        {id:'e2',type:'page_view',at:monthStart+5000,path:'/pricing',sessionId:'s2'},
        {id:'e1',type:'page_view',at:monthStart+4000,path:'/',sessionId:'s1'},
        {id:'old-event',type:'page_view',at:prev,path:'/'}
      ],
      'site:session:index':['s2','s1','sold'],
      'site:prospect:index':['p2','p1','pold']
    }
  });
}

test('duration and disposition normalization cover current call shapes',()=>{
  assert.equal(parseDurationSeconds('1:30'),90);
  assert.equal(parseDurationSeconds('1:02:03'),3723);
  assert.equal(parseDurationSeconds(42),42);
  assert.equal(parseDurationSeconds('bad'),null);
  assert.equal(dispositionKey('Resolved by AI'),'resolvedByAi');
  assert.equal(dispositionKey('request-captured'),'requestCaptured');
  assert.equal(dispositionKey('unknown'),'');
});

test('producer builds a truthful aggregate-only current-month snapshot',async()=>{
  const f=completeFixture(),{snapshot,issues}=await buildMonthlyKpiSnapshot(f.kv,{now:monthNow});
  assert.equal(snapshot.month,'2026-09');
  assert.equal(snapshot.sessions,2);assert.equal(snapshot.visitors,2);assert.equal(snapshot.pageViews,2);assert.equal(snapshot.leads,2);
  assert.equal(snapshot.conversions,1);assert.equal(snapshot.setupRevenue,500);assert.equal(snapshot.conversionRate,50);
  assert.equal(snapshot.churnedClients,1);assert.equal(snapshot.calls,2);assert.equal(snapshot.minutes,2);assert.equal(snapshot.transfers,1);
  assert.equal(snapshot.appointments,1);assert.equal(snapshot.supportTickets,1);assert.equal(snapshot.paymentFailures,null);
  assert.equal(snapshot.mrr,1598);assert.equal(snapshot.arr,19176);
  assert.deepEqual(snapshot.planMix,{Starter:0,Growth:1,Pro:1});
  assert.deepEqual(snapshot.callOutcomes,{resolvedByAi:1,requestCaptured:0,messageTaken:0,transferred:1,escalated:0,incomplete:0,nonCustomer:0});
  for(const [key,value] of Object.entries(snapshot.coverage)){
    if(key==='paymentFailures')assert.equal(value,false,key);else assert.equal(value,true,key);
  }
  assert.ok(issues.some(x=>x.domain==='paymentFailures'));
  const serialized=JSON.stringify(snapshot);
  for(const secret of ['Private One','one@example.test','Secret Caller','5095550101','private1@example.test','Private Appointment','Private issue'])
    assert.equal(serialized.includes(secret),false,secret);
});

test('producer preserves known domains while marking incomplete domains unknown',async()=>{
  const f=completeFixture();
  f.store.set('calls:index:w1',{bad:true});
  f.store.set('workspace:w2',{...f.store.get('workspace:w2'),stripeBilling:{}});
  f.store.set('site:session:s2',{id:'s2',firstAt:monthStart+3000,visitorId:''});
  const {snapshot,issues}=await buildMonthlyKpiSnapshot(f.kv,{now:monthNow});
  assert.equal(snapshot.mrr,1598);assert.equal(snapshot.pageViews,2);assert.equal(snapshot.sessions,2);
  assert.equal(snapshot.visitors,null);assert.equal(snapshot.churnedClients,null);
  assert.equal(snapshot.calls,null);assert.equal(snapshot.minutes,null);assert.equal(snapshot.callOutcomes,null);assert.equal(snapshot.transfers,null);
  assert.equal(snapshot.coverage.workspaces,true);assert.equal(snapshot.coverage.websiteEvents,true);assert.equal(snapshot.coverage.websiteSessions,true);
  assert.equal(snapshot.coverage.websiteVisitors,false);assert.equal(snapshot.coverage.churn,false);assert.equal(snapshot.coverage.calls,false);
  assert.ok(issues.some(x=>x.domain==='websiteVisitors'));
  assert.ok(issues.some(x=>x.domain==='churn'));
  assert.ok(issues.some(x=>x.domain==='calls'));
});

test('fully observed Stripe month contributes durable payment-failure count',async()=>{
  const f=completeFixture();
  f.store.set(STRIPE_MONTHLY_METRICS_COVERAGE_KEY,{startedAt:Date.UTC(2026,7,15)});
  f.store.set(monthlyStripeMetricKey('2026-09'),{month:'2026-09',paymentFailures:3,updatedAt:monthStart+9000});
  const {snapshot,issues}=await buildMonthlyKpiSnapshot(f.kv,{now:monthNow});
  assert.equal(snapshot.coverage.paymentFailures,true);
  assert.equal(snapshot.paymentFailures,3);
  assert.equal(issues.some(x=>x.domain==='paymentFailures'),false);
});

test('Stripe coverage beginning after month start keeps failure count unknown',async()=>{
  const f=completeFixture();
  f.store.set(STRIPE_MONTHLY_METRICS_COVERAGE_KEY,{startedAt:monthStart+5000});
  f.store.set(monthlyStripeMetricKey('2026-09'),{month:'2026-09',paymentFailures:2,updatedAt:monthStart+9000});
  const {snapshot,issues}=await buildMonthlyKpiSnapshot(f.kv,{now:monthNow});
  assert.equal(snapshot.coverage.paymentFailures,false);
  assert.equal(snapshot.paymentFailures,null);
  assert.ok(issues.some(x=>x.domain==='paymentFailures'&&x.reason==='partial_month'));
});

test('retention-cap inside the current month makes website event totals unknown',async()=>{
  const f=completeFixture();
  f.listStore.set('site:events',Array.from({length:5000},(_,i)=>({id:'e'+i,type:'page_view',at:monthStart+5000-i})));
  const {snapshot,issues}=await buildMonthlyKpiSnapshot(f.kv,{now:monthNow});
  assert.equal(snapshot.pageViews,null);assert.equal(snapshot.coverage.websiteEvents,false);
  assert.ok(issues.some(x=>x.domain==='websiteEvents'&&x.reason==='retention_cap'));
});

test('older boundary behind a full retained list still permits current-month event totals',async()=>{
  const f=completeFixture();
  const current=Array.from({length:4999},(_,i)=>({id:'e'+i,type:i%2===0?'page_view':'cta_click',at:monthStart+100000-i}));
  f.listStore.set('site:events',[...current,{id:'boundary',type:'page_view',at:prev}]);
  const {snapshot}=await buildMonthlyKpiSnapshot(f.kv,{now:monthNow});
  assert.equal(snapshot.coverage.websiteEvents,true);
  assert.equal(snapshot.pageViews,current.filter(x=>x.type==='page_view').length);
});

test('refresh throttles heavy reads when a recent same-month rollup already exists',async()=>{
  const cached=sanitizeMonthlyKpiSnapshot({month:'2026-09',recordedAt:monthNow-60_000,sessions:1,visitors:1,pageViews:1,leads:1,conversions:0,churnedClients:null,calls:1,minutes:1,appointments:0,transfers:0,paymentFailures:null,supportTickets:0,mrr:599,arr:7188,setupRevenue:0,conversionRate:0,planMix:{Starter:0,Growth:1,Pro:0},callOutcomes:{resolvedByAi:1,requestCaptured:0,messageTaken:0,transferred:0,escalated:0,incomplete:0,nonCustomer:0},coverage:{websiteEvents:true,websiteSessions:true,websiteVisitors:true,leadPipeline:true,workspaces:true,conversions:true,churn:false,calls:true,callMinutes:true,callOutcomes:true,appointments:true,support:true,paymentFailures:false}});
  const f=fixture({records:{'analytics:monthly:2026-09':cached,[MONTHLY_KPI_INDEX_KEY]:['2026-09']}});
  const r=await refreshMonthlyKpiSnapshot(f.kv,{now:monthNow,minIntervalMs:15*60*1000});
  assert.equal(r.cached,true);assert.equal(r.saved,false);assert.equal(f.calls.lrange,0);assert.equal(f.calls.eval,0);
});

test('refresh records a complete snapshot and monthly index when cache is stale',async()=>{
  const f=completeFixture();
  const r=await refreshMonthlyKpiSnapshot(f.kv,{now:monthNow,minIntervalMs:0});
  assert.equal(r.cached,false);assert.equal(r.saved,true);assert.equal(r.degraded,false);
  assert.equal(f.store.get('analytics:monthly:2026-09').mrr,1598);
  assert.equal(f.store.get('analytics:monthly:2026-09').paymentFailures,null);
  assert.equal(f.store.get('analytics:monthly:2026-09').coverage.paymentFailures,false);
  assert.equal(f.store.get(STRIPE_MONTHLY_METRICS_COVERAGE_KEY).startedAt,monthNow);
  assert.deepEqual(f.store.get(MONTHLY_KPI_INDEX_KEY),['2026-09']);
  assert.ok(f.calls.eval>=2);
});
