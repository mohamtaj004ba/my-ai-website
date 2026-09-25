const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function fixture(){
  const requests=new Map(),renders=[];
  const fetch=async url=>{const days=new URL('https://example.test'+url).searchParams.get('days'),pending=deferred();requests.set(days,pending);return pending.promise};
  const context=vm.createContext({adminWebsiteDays:30,adminWebsiteAnalyticsRequest:0,adminWebsiteData:{periodDays:30},fetch,renderWebsiteAnalytics(){renders.push(context.adminWebsiteData.periodDays)},renderGrowth(){}});
  const start=source.indexOf('async function loadWebsiteAnalytics('),end=source.indexOf('\nfunction renderWebsiteAnalytics(',start);vm.runInContext(source.slice(start,end),context);
  return {context,requests,renders};
}

test('a slower website analytics range cannot replace the latest range',async()=>{
  const {context,requests,renders}=fixture(),first=vm.runInContext('loadWebsiteAnalytics(90)',context),second=vm.runInContext('loadWebsiteAnalytics(7)',context);
  requests.get('7').resolve({ok:true,json:async()=>({analytics:{periodDays:7,sessions:7}})});await second;
  requests.get('90').resolve({ok:true,json:async()=>({analytics:{periodDays:90,sessions:90}})});await first;
  assert.equal(context.adminWebsiteDays,7);assert.equal(context.adminWebsiteData.periodDays,7);assert.equal(context.adminWebsiteData.sessions,7);assert.deepEqual(renders,[7]);
});
