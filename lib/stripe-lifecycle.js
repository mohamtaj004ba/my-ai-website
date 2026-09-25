// Pure Stripe lifecycle decision: keep webhook delivery order and subscription ownership explicit.
function lifecycleDecision(workspace={},event={},subscriptionId=''){
  const type=String(event.type||''),obj=event.data?.object||{};
  const knownSubscription=String(workspace.stripeSubscriptionId||''),incomingSubscription=String(subscriptionId||'');
  const eventCreatedAt=Number(event.created||0)*1000;
  const previousEventAt=Number(workspace.stripeBilling?.lastEventCreatedAt||0);
  const replacement=type==='customer.subscription.created'&&!!knownSubscription&&!!incomingSubscription&&incomingSubscription!==knownSubscription;
  if(eventCreatedAt&&previousEventAt&&eventCreatedAt<previousEventAt&&!replacement){
    return {apply:false,reason:'stale',eventCreatedAt,previousEventAt};
  }
  if(knownSubscription&&incomingSubscription&&knownSubscription!==incomingSubscription&&type!=='customer.subscription.created'){
    return {apply:false,reason:'subscription_mismatch',eventCreatedAt,previousEventAt};
  }
  let status=workspace.subscriptionStatus||'active';
  if(type==='customer.subscription.deleted')status='canceled';
  else if(type==='invoice.payment_failed'&&status!=='canceled')status='past_due';
  else if(type==='invoice.paid'&&status!=='canceled')status='active';
  else if(type.startsWith('customer.subscription.'))status=obj.status||status;
  return {apply:true,status,eventCreatedAt,previousEventAt,replacement};
}
module.exports={lifecycleDecision};
