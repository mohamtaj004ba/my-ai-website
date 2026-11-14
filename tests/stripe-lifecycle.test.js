const test=require('node:test');
const assert=require('node:assert/strict');
const {lifecycleDecision}=require('../lib/stripe-lifecycle');

const workspace={stripeSubscriptionId:'sub_current',subscriptionStatus:'active',stripeBilling:{lastEventCreatedAt:2000000}};
const event=(type,created,extra={})=>({type,created,data:{object:extra}});

test('delayed Stripe events cannot overwrite newer subscription state',()=>{
  const d=lifecycleDecision(workspace,event('invoice.payment_failed',1000),'sub_current');
  assert.equal(d.apply,false);assert.equal(d.reason,'stale');
});
test('a payment from an old subscription cannot affect its replacement',()=>{
  const d=lifecycleDecision(workspace,event('invoice.paid',3000),'sub_previous');
  assert.equal(d.apply,false);assert.equal(d.reason,'subscription_mismatch');
});
test('a canceled subscription is not silently reactivated by invoice.paid',()=>{
  const ws={...workspace,subscriptionStatus:'canceled'};
  assert.equal(lifecycleDecision(ws,event('invoice.paid',3000),'sub_current').status,'canceled');
  assert.equal(lifecycleDecision(ws,event('invoice.payment_failed',3000),'sub_current').status,'canceled');
});
test('new subscription creation can legitimately replace an older subscription',()=>{
  const ws={...workspace,subscriptionStatus:'canceled'};
  const d=lifecycleDecision(ws,event('customer.subscription.created',1000,{status:'active'}),'sub_replacement');
  assert.equal(d.apply,true);
  assert.equal(d.replacement,true);
  assert.equal(d.status,'active');
});
test('invoice.paid recovers an existing past-due subscription',()=>{
  const ws={...workspace,subscriptionStatus:'past_due'};
  assert.equal(lifecycleDecision(ws,event('invoice.paid',3000),'sub_current').status,'active');
});
test('subscription.deleted retains terminal status for its own subscription',()=>{
  assert.equal(lifecycleDecision(workspace,event('customer.subscription.deleted',3000),'sub_current').status,'canceled');
});
