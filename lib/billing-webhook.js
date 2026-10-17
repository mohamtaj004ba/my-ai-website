const {createProvider,id,BillingError}=require('./billing-provider');
const {claimCheckoutSession,releaseCheckoutSession}=require('./stripe-session-lock');
const {compareAndAuditBatch}=require('./config-transaction');
const {billingEmailRecord,keyFor}=require('./billing-email-outbox');
const {entitlementsFor}=require('./plans');
async function synchronizeBillingEvent(kv,workspaceId,event,provider=createProvider()){
  const claim=await claimCheckoutSession(kv,'billing_'+workspaceId);if(!claim)throw new BillingError('Billing synchronization is already processing.',503);
  try{
    const key='workspace:'+workspaceId,workspace=await kv.get(key),obj=event.data?.object;
    if(!workspace||workspace.id!==workspaceId||!obj)throw new BillingError('Billing workspace identity is unavailable.',503);
    if(workspace.stripeBilling!=null&&(!workspace.stripeBilling||typeof workspace.stripeBilling!=='object'||Array.isArray(workspace.stripeBilling)))throw new BillingError('Workspace billing state could not be verified.',503);
    const incoming=event.type.startsWith('customer.subscription.')?obj.id:id(obj.subscription)||id(obj.parent?.subscription_details?.subscription);
    if(!incoming)return {ignored:true};
    const subscription=await provider.request('/subscriptions/'+incoming),customerId=id(subscription.customer);
    if(customerId!==workspace.stripeCustomerId||id(obj.customer)!==customerId||await kv.get('stripe:customer:'+customerId)!==workspaceId)throw new BillingError('Billing event customer ownership mismatch.',503);
    if(incoming!==workspace.stripeSubscriptionId){
      if(event.type!=='customer.subscription.created')return {subscription_mismatch:true};
      const previous=await provider.request('/subscriptions/'+workspace.stripeSubscriptionId);
      if(id(previous.customer)!==customerId||!['canceled','incomplete_expired'].includes(previous.status)||Number(subscription.created)<=Number(previous.created))return {subscription_mismatch:true};
    }
    const items=subscription.items?.data;if(!Array.isArray(items))throw new BillingError('Subscription details are unavailable.',503);
    const planItem=items.find(i=>Object.values(provider.config.prices).includes(id(i.price))),plan=Object.keys(provider.config.prices).find(p=>provider.config.prices[p]===id(planItem?.price));
    if(!plan||items.length!==1||planItem.quantity!==1||planItem.price.unit_amount!==require('./plans').PLANS[plan].price*100)throw new BillingError('Subscription pricing requires review.',503);
    const prior=workspace.stripeBilling||{},periodEnd=planItem.current_period_end||subscription.current_period_end||null;
    const after={...workspace,plan,entitlements:entitlementsFor(plan),subscriptionStatus:subscription.status,stripeSubscriptionId:subscription.id,nativeBilling:true,stripeBilling:{...prior,lastEvent:event.type,lastEventCreatedAt:Math.max(Number(prior.lastEventCreatedAt||0),Number(event.created||0)*1000),lastEventAt:Date.now(),canonicalCheckedAt:Date.now(),currentPeriodEnd:periodEnd?periodEnd*1000:null,cancelAtPeriodEnd:!!subscription.cancel_at_period_end,canceledAt:subscription.canceled_at?subscription.canceled_at*1000:null,pendingChange:!!subscription.pending_update},updatedAt:Date.now()};
    // Current provider state is read for every event. A late event can trigger a refresh,
    // but its historical status is never copied over today's canonical state.
    const eventKey='stripe:event:'+event.id,receipt=await kv.get(eventKey);if(receipt)return {duplicate:true};
    const updates=[{key,before:workspace,after},{key:eventKey,before:null,after:true}];
    if(incoming!==workspace.stripeSubscriptionId){const mapping=await kv.get('stripe:subscription:'+incoming);if(mapping&&mapping!==workspaceId)throw new BillingError('Subscription mapping conflict.',503);updates.push({key:'stripe:subscription:'+incoming,before:mapping,after:workspaceId})}
    const failedPayment=event.type==='invoice.payment_failed'&&(['past_due','unpaid'].includes(subscription.status)||subscription.pending_update&&id(subscription.latest_invoice)===obj.id);
    if(failedPayment)after.stripeBilling.paymentAttentionInvoiceId=obj.id;
    const recoveredPayment=event.type==='invoice.paid'&&subscription.status==='active'&&(workspace.subscriptionStatus==='past_due'||prior.paymentAttentionInvoiceId===obj.id);
    if(event.type==='invoice.paid'&&prior.paymentAttentionInvoiceId===obj.id)after.stripeBilling.paymentAttentionInvoiceId=null;
    let type=failedPayment?'failed':event.type==='invoice.paid'?(recoveredPayment?'recovered':'invoice'):subscription.status==='canceled'&&workspace.subscriptionStatus!=='canceled'?'ended':plan!==workspace.plan&&!subscription.pending_update?'plan':!!subscription.cancel_at_period_end!==!!prior.cancelAtPeriodEnd?(subscription.cancel_at_period_end?'cancel':'reactivate'):event.type==='customer.subscription.created'&&subscription.status==='active'?'active':null;
    // Immediate action confirmations own plan/cancel/reactivation mail. Their webhook
    // refresh sees the already-updated workspace and does not create a second message.
    // Initial purchase owns the welcome/payment receipt; a second initial-invoice
    // email would duplicate it. Renewal invoices use the invoice identity, so two
    // event IDs describing the same paid invoice cannot send two confirmations.
    if(event.type==='invoice.paid'&&obj.billing_reason==='subscription_create')type=null;
    const operationId=event.type.startsWith('invoice.')?'invoice:'+obj.id+':'+type:'event:'+event.id;
    if(type){const emailKey=keyFor(operationId),existing=await kv.get(emailKey);if(!existing)updates.push({key:emailKey,before:null,after:billingEmailRecord({operationId,workspaceId,to:workspace.ownerEmail,type,plan,previousPlan:type==='plan'?workspace.plan:null,amount:event.type.startsWith('invoice.')?obj.amount_paid||obj.amount_due:null,effectiveAt:periodEnd})});updates.push({key:'billing:event-email:'+event.id,before:await kv.get('billing:event-email:'+event.id),after:emailKey})}
    if(!await compareAndAuditBatch(kv,updates,'audit:'+workspaceId,{id:event.id,action:'billing_webhook_sync',workspaceId,actorRole:'provider',at:Date.now(),detail:{event:event.type,status:subscription.status,plan}}))throw new BillingError('Billing synchronization changed concurrently. Retry webhook.',503);
    return {workspaceId,status:subscription.status,emailKey:type?keyFor(operationId):null};
  }finally{await releaseCheckoutSession(kv,claim)}
}
module.exports={synchronizeBillingEvent};
