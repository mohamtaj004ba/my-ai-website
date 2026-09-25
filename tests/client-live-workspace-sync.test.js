const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

test('live client dashboard bundle includes current workspace billing and entitlement state',()=>{
  assert.match(api,/workspace:\{[\s\S]*?subscriptionStatus:ws\.subscriptionStatus\|\|'active'[\s\S]*?entitlements:ent/);
  assert.match(api,/stripe:\{customerLinked:!!ws\.stripeCustomerId,subscriptionLinked:!!ws\.stripeSubscriptionId\}/);
});

test('client live refresh reapplies plan usage billing and entitlements without a reload',()=>{
  assert.match(dashboard,/if\(data\.workspace&&typeof data\.workspace==='object'\)/);
  assert.match(dashboard,/sessionWorkspace=\{\.\.\.\(sessionWorkspace\|\|\{\}\),\.\.\.data\.workspace\}/);
  assert.match(dashboard,/if\(currentPlan!==previousPlan\)\{renderBilling\(\);renderStages\(\);renderOverviewUnlocks\(\);renderEntitledApps\(\)\}/);
});
