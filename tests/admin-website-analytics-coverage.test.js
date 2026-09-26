const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8');
const ui=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('admin-dashboard.html','utf8');
const start=api.indexOf('async function adminWebsiteAnalytics(');
const end=api.indexOf('async function adminWebsiteProspectUpdate(',start);
assert.ok(start>=0&&end>start);
function fixture({sessionIds=[],prospectIds=[],events=[],records={}}={}){
  const reads=[],now=Date.now();let code,body;
  const ctx=vm.createContext({
    kv:{
      lrange:async key=>key==='site:events'?events:key==='site:session:index'?sessionIds:prospectIds,
      get:async key=>{reads.push(key);return records[key]||null}
    },
    req:{query:{days:30}},res:{status(n){code=n;return this},json(x){body=x;return x}},
    requireAdmin:async()=>({email:'admin@example.test'}),
    clampInt:(v,min,max,fallback)=>Math.max(min,Math.min(max,Number(v)||fallback)),
    safeError:()=> 'redacted',console:{error(){}},Date,Number,Array,Object,String,Set,Math,Promise
  });
  vm.runInContext(api.slice(start,end),ctx);
  return {run:async()=>{await vm.runInContext('adminWebsiteAnalytics(req,res)',ctx);return {code,body,reads}},now};
}
test('website analytics retrieves the full 2000-entry retained prospect index',async()=>{
  const now=Date.now(),recent=now-86400000,older=now-80*86400000;
  const prospectIds=Array.from({length:1601},(_,i)=>'p'+i);
  prospectIds.push('checkout-current','checkout-old');
  const sessionIds=Array.from({length:1001},(_,i)=>'s'+i);
  sessionIds.push('stale-visit');
  const records={};
  for(let i=0;i<1601;i++)records['site:prospect:p'+i]={id:'p'+i,stage:'converted',convertedAt:recent,updatedAt:recent,monthlyValue:10,source:'website'};
  records['site:prospect:checkout-current']={id:'checkout-current',stage:'checkout_started',updatedAt:recent};
  records['site:prospect:checkout-old']={id:'checkout-old',stage:'checkout_started',updatedAt:older};
  for(let i=0;i<1001;i++)records['site:session:s'+i]={id:'s'+i,firstAt:recent,lastAt:recent,visitorId:'v'+i,pages:['/'],activeMs:1000};
  records['site:session:stale-visit']={id:'stale-visit',firstAt:older,lastAt:now,visitorId:'stale',pages:['/'],activeMs:200};
  const f=fixture({prospectIds,sessionIds,records});
  const r=await f.run();
  assert.equal(r.code,200);
  assert.equal(r.body.analytics.prospects.length,1603);
  assert.equal(r.body.analytics.conversions,1601);
  assert.equal(r.body.analytics.attributedMrr,16010);
  assert.equal(r.body.analytics.checkoutAbandoned,1);
  assert.equal(r.body.analytics.sessions,1001);
  assert.equal(r.body.analytics.recentSessions.length,20);
  assert.ok(!r.body.analytics.recentSessions.some(s=>s.id==='stale-visit'));
  assert.equal(r.body.analytics.coverage.retainedProspectIds,1603);
  assert.equal(r.body.analytics.coverage.retainedSessionIds,1002);
  assert.equal(r.body.analytics.coverage.isRetentionCapped,false);
  assert.ok(r.reads.includes('site:prospect:p1600'));
  assert.ok(r.reads.includes('site:session:s1000'));
});
test('retention-cap notice is reported at the supported 2000 prospect limit',async()=>{
  const now=Date.now();
  const prospectIds=Array.from({length:2000},(_,i)=>'p'+i);
  const records=Object.fromEntries(prospectIds.map(id=>['site:prospect:'+id,{id,stage:'new',updatedAt:now}]));
  const r=await fixture({prospectIds,records}).run();
  assert.equal(r.code,200);
  assert.equal(r.body.analytics.prospects.length,2000);
  assert.equal(r.body.analytics.coverage.isRetentionCapped,true);
});
test('malformed tracking indexes fail closed instead of returning partial metrics',async()=>{
  for(const index of ['events','sessionIds','prospectIds']){
    const args={events:[],sessionIds:[],prospectIds:[]};
    args[index]=null;
    const r=await fixture(args).run();
    assert.equal(r.code,503,index);
    assert.match(r.body.error,/No partial reporting/);
  }
});
test('dashboard labels retained-history coverage in analytics and prospect search',()=>{
  assert.match(html,/id="growthCoverageNote"/);
  assert.match(ui,/adminWebsiteData\.coverage\?\.isRetentionCapped/);
  assert.match(ui,/d\.coverage\?\.isRetentionCapped/);
  assert.match(ui,/Older history may be outside retained tracking|Older history outside retained tracking/);
});
