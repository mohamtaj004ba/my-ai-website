const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('dashboard.html','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

test('canonical billing refresh synchronizes plan entitlements and Intelligence without undefined callbacks',()=>{
  const vm=require('node:vm'),calls=[];
  const context={document:{body:{dataset:{dashboard:'client'}}},knownPlan:plan=>plan==='Pro',sessionWorkspace:{plan:'Starter',entitlements:{plan:'Starter'}},setPlan:plan=>calls.push(plan),renderBillingConnection:()=>calls.push('connection'),initClientIntelligence:()=>calls.push('intelligence')};
  context.window={addEventListener:(_,handler)=>context.handler=handler};
  const handler=dashboard.match(/window\.addEventListener\('callercore:canonical-billing',[\s\S]*?\n\}\);/)[0];
  vm.runInNewContext(handler,context);
  context.handler({detail:{plan:'Pro',status:'active',entitlements:{plan:'Pro',features:{apiAccess:true}}}});
  assert.equal(context.sessionWorkspace.plan,'Pro');assert.equal(context.sessionWorkspace.entitlements.features.apiAccess,true);assert.deepEqual(calls,['Pro','connection','intelligence']);
});

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
