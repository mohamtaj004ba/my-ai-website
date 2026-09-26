const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function fixture(){
  const requests=new Map(),renders=[];
  const fetch=async url=>{const days=new URL('https://example.test'+url).searchParams.get('days'),pending=deferred();requests.set(days,pending);return pending.promise};
  const context=vm.createContext({adminWebsiteDays:30,adminWebsiteAnalyticsRequest:0,adminWebsiteLoadError:'',adminWebsiteData:{periodDays:30},fetch,renderWebsiteAnalytics(){renders.push(context.adminWebsiteData.periodDays)},renderGrowth(){}});
  const start=source.indexOf('async function loadWebsiteAnalytics('),end=source.indexOf('\nfunction renderWebsiteAnalytics(',start);vm.runInContext(source.slice(start,end),context);
  return {context,requests,renders};
}

test('a slower website analytics range cannot replace the latest range',async()=>{
  const {context,requests,renders}=fixture(),first=vm.runInContext('loadWebsiteAnalytics(90)',context),second=vm.runInContext('loadWebsiteAnalytics(7)',context);
  requests.get('7').resolve({ok:true,json:async()=>({analytics:{periodDays:7,sessions:7}})});await second;
  requests.get('90').resolve({ok:true,json:async()=>({analytics:{periodDays:90,sessions:90}})});await first;
  assert.equal(context.adminWebsiteDays,7);assert.equal(context.adminWebsiteData.periodDays,7);assert.equal(context.adminWebsiteData.sessions,7);assert.deepEqual(renders,[7]);
});

test('failed analytics refresh retains previous results and identifies their stale status',async()=>{
  const {context,requests,renders}=fixture();
  const task=vm.runInContext('loadWebsiteAnalytics(7)',context);
  requests.get('7').resolve({ok:false,json:async()=>({error:'Website analytics indexes are unavailable.'})});
  assert.equal(await task,false);
  assert.equal(context.adminWebsiteData.periodDays,30);
  assert.match(context.adminWebsiteLoadError,/indexes are unavailable/);
  assert.deepEqual(renders,[30]);
  const next=vm.runInContext('loadWebsiteAnalytics(30)',context);
  requests.get('30').resolve({ok:true,json:async()=>({analytics:{periodDays:30,sessions:55}})});
  assert.equal(await next,true);
  assert.equal(context.adminWebsiteLoadError,'');
  assert.equal(context.adminWebsiteData.sessions,55);
});
test('late failed request does not override a newer successful analytics range',async()=>{
  const {context,requests}=fixture();
  const old=vm.runInContext('loadWebsiteAnalytics(90)',context);
  const latest=vm.runInContext('loadWebsiteAnalytics(7)',context);
  requests.get('7').resolve({ok:true,json:async()=>({analytics:{periodDays:7,sessions:7}})});
  assert.equal(await latest,true);
  requests.get('90').resolve({ok:false,json:async()=>({error:'Late network error'})});
  assert.equal(await old,false);
  assert.equal(context.adminWebsiteData.periodDays,7);
  assert.equal(context.adminWebsiteLoadError,'');
});
test('analytics refresh errors remain visible on both Growth and website views',()=>{
  assert.match(source,/Refresh issue: /);
  assert.match(source,/showing previously loaded data/);
  assert.match(source,/Growth refresh failed:/);
  assert.match(source,/websiteUpdated===false/);
  assert.match(source,/Growth could not refresh\. Try again before opening the existing prospect/);
});

test('periodic admin analytics refresh clears stale warnings after a successful sync',()=>{
  const success="d=>{if(d.analytics){adminWebsiteData=d.analytics;adminWebsiteLoadError=''}}";
  assert.equal(source.split(success).length-1,3);
  assert.match(source,/if\(wr\.ok\)\{const latest=\(await wr\.json\(\)\)\.analytics;if\(latest\)\{adminWebsiteData=latest;adminWebsiteLoadError=''\}\}/);
  assert.match(source,/if\(rr\.ok\)\{const latest=\(await rr\.json\(\)\)\.analytics;if\(latest\)\{adminWebsiteData=latest;adminWebsiteLoadError=''\}\}/);
});
