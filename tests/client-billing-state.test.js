const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('dashboard.html','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

test('client billing status is driven by live subscription state',()=>{
  assert.match(html,/id="billingSubscriptionStatus"/);
  assert.match(dashboard,/subscription==='past_due'\?\{label:'Past due',tone:'red'\}/);
  assert.match(dashboard,/statusTag\.className='tag '\+statusMeta\.tone/);
  assert.match(dashboard,/Payment needs attention/);
});


test('real client billing never falls back to demo usage or an assumed active subscription',()=>{
  assert.match(dashboard,/function currentUsageMinutes\(\)[\s\S]*demoMode\?PLAN_DATA\[currentPlan\]\?\.used:sessionWorkspace\?\.usage\?\.minutes/);
  assert.match(dashboard,/!sessionWorkspace&&!demoMode\)return/);
  assert.match(dashboard,/subscription==='active'\?\{label:'Active',tone:'green'\}:\{label:'Status unavailable',tone:'amber'\}/);
  assert.match(dashboard,/used==null\?'Usage unavailable'/);
  assert.match(dashboard,/used!=null&&d\.minutes\?Math\.min\(100,\(used\/d\.minutes\)\*100\):0/);
});


test('overview account strip shares the verified live usage source instead of demo plan counters',()=>{
  assert.match(dashboard,/renderOverviewUnlocks\(\)[\s\S]*usage=currentUsageMinutes\(\)/);
  assert.match(dashboard,/usage==null\?'Usage unavailable'/);
  assert.match(dashboard,/const pct=usage==null\?0:/);
});
