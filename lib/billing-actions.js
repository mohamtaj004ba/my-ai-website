const crypto=require('crypto');
const {BillingError,canonicalBilling,validateContact,id}=require('./billing-provider');
const {compareAndSetConfig,compareAndAuditBatch}=require('./config-transaction');
const {claimCheckoutSession,releaseCheckoutSession}=require('./stripe-session-lock');
const {entitlementsFor}=require('./plans');
const {billingEmailRecord,keyFor}=require('./billing-email-outbox');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function persist(kv,key,before,after){if(!await compareAndSetConfig(kv,[{key,before,after}]))throw new BillingError('Billing changed in another window. Refresh to continue.',409)}
async function prepareChange(kv,workspaceId,provider,input,now=Date.now()){
  const state=await canonicalBilling(kv,workspaceId,provider),{subscription,item,customer,view}=state;
  if(!provider.config.mutationsAllowed)throw new BillingError('Billing changes are not enabled in this environment.',403);
  if(input.revision!==view.revision)throw new BillingError('Your billing details changed. Refresh before continuing.',409);
  if(subscription.pending_update||subscription.schedule)throw new BillingError('A billing change is already pending. Contact support.',409);
  const action=input.action,params={},detail={action};
  if(action==='plan'){
    if(!provider.config.prices[input.plan]||input.plan===view.plan)throw new BillingError('Select a different available plan.',400);
    if(!['active','trialing'].includes(view.status)||view.cancelAtPeriodEnd)throw new BillingError('Resolve your current subscription status before changing plans.',409);
    const date=Math.floor(now/1000);
    Object.assign(params,{'items[0][id]':item.id,'items[0][price]':provider.config.prices[input.plan],'items[0][quantity]':1,proration_behavior:'always_invoice',payment_behavior:'pending_if_incomplete',proration_date:date});
    const invoice=await provider.request('/invoices/create_preview',{method:'POST',params:{customer:customer.id,subscription:subscription.id,'subscription_details[items][0][id]':item.id,'subscription_details[items][0][price]':provider.config.prices[input.plan],'subscription_details[items][0][quantity]':1,'subscription_details[proration_date]':date,'subscription_details[proration_behavior]':'always_invoice'}});
    if(id(invoice.customer)!==customer.id||invoice.currency!=='usd'||!Number.isSafeInteger(invoice.amount_due))throw new BillingError('The billing estimate could not be verified.',502);
    Object.assign(detail,{previousPlan:view.plan,plan:input.plan,amountDue:invoice.amount_due,currency:invoice.currency,effectiveAt:date,monthlyAmount:require('./plans').PLANS[input.plan].price*100,policy:'Changes take effect immediately after any required payment succeeds. Unused time is prorated; credits remain on your billing account.'});
  }else if(action==='cancel'||action==='reactivate'){
    if(!['active','trialing','past_due'].includes(view.status))throw new BillingError('Contact support to manage this subscription.',409);
    if((action==='cancel')===view.cancelAtPeriodEnd)throw new BillingError('This change has already been applied.',409);
    params.cancel_at_period_end=action==='cancel';Object.assign(detail,{effectiveAt:view.renewalAt,policy:action==='cancel'?'Access continues until the end of your current billing period. Your workspace data is retained separately.':'Your subscription will renew on its next billing date.'});
  }else if(action==='contact')Object.assign(params,validateContact(input.contact));
  else throw new BillingError('Choose a supported billing action.',400);
  const token=crypto.randomBytes(24).toString('hex'),key='billing:proposal:'+hash(token),record={workspaceId,action,params,detail,revision:view.revision,customerId:customer.id,subscriptionId:subscription.id,expiresAt:now+10*60*1000,status:'prepared',createdAt:now};
  await persist(kv,key,null,record);
  return {token,detail,expiresAt:record.expiresAt};
}
async function applyChange(kv,workspaceId,actor,provider,input,now=Date.now()){
  if(input.confirmed!==true||!/^([a-f0-9]{48})$/.test(input.token||''))throw new BillingError('Review and confirm this billing change.',400);
  if(!provider.config.mutationsAllowed)throw new BillingError('Billing changes are not enabled in this environment.',403);
  const key='billing:proposal:'+hash(input.token),claim=await claimCheckoutSession(kv,'billing_'+workspaceId);
  if(!claim)throw new BillingError('Another billing change is processing. Please wait and refresh.',409);
  try{
    let record=await kv.get(key);
    if(!record||record.workspaceId!==workspaceId)throw new BillingError('Billing confirmation was not found.',404);
    if(record.status==='complete')return {ok:true,duplicate:true,emailKey:keyFor('action:'+hash(input.token)),billing:(await canonicalBilling(kv,workspaceId,provider)).view};
    if(!['prepared','processing','provider_confirmed'].includes(record.status))throw new BillingError('This confirmation cannot be reused.',409);
    if(record.status==='prepared'&&record.expiresAt<now)throw new BillingError('This estimate expired. Review the change again.',409);
    let state=await canonicalBilling(kv,workspaceId,provider);
    if(state.customer.id!==record.customerId||state.subscription.id!==record.subscriptionId)throw new BillingError('Your subscription changed. Contact support.',409);
    if(record.status==='prepared'){
      if(state.view.revision!==record.revision)throw new BillingError('Your billing details changed. Review the change again.',409);
      const next={...record,status:'processing',startedAt:now};await persist(kv,key,record,next);record=next;
    }
    if(record.status==='processing'){
      if(now-Number(record.startedAt||0)>23*60*60*1000)throw new BillingError('This payment operation needs reconciliation before retrying. Contact support; no new charge was attempted.',409);
      if(state.view.revision!==record.revision){
        const alreadyApplied=record.action==='plan'?state.view.plan===record.detail.plan||state.subscription.pending_update?.subscription_items?.some(i=>id(i.price)===record.params['items[0][price]']):record.action==='cancel'?state.view.cancelAtPeriodEnd:record.action==='reactivate'?!state.view.cancelAtPeriodEnd:record.action==='payment'?id(state.subscription.default_payment_method)===record.params.default_payment_method:record.action==='contact'?Object.entries(record.params).every(([k,v])=>k.startsWith('address[')?String(state.customer.address?.[k.slice(8,-1)]||'')===String(v):String(state.customer[k]||'')===String(v)):false;
        if(!alreadyApplied)throw new BillingError('Billing changed while this request was processing. Contact support before retrying.',409);
      }
      // Retry the identical provider operation after ambiguous timeouts; never create a second charge.
      await provider.request(record.action==='contact'?'/customers/'+record.customerId:'/subscriptions/'+record.subscriptionId,{method:'POST',params:record.params,idempotencyKey:'callercore-billing-'+hash(input.token)});
      const next={...record,status:'provider_confirmed'};await persist(kv,key,record,next);record=next;
    }
    state=await canonicalBilling(kv,workspaceId,provider);
    const after={...state.workspace,plan:state.view.plan,entitlements:entitlementsFor(state.view.plan),subscriptionStatus:state.view.status,stripeBilling:{...state.workspace.stripeBilling,currentPeriodEnd:state.view.renewalAt?state.view.renewalAt*1000:null,cancelAtPeriodEnd:state.view.cancelAtPeriodEnd,canonicalCheckedAt:Date.now()},updatedAt:Date.now()};
    const complete={...record,status:'complete',completedAt:Date.now()};
    const audit={id:hash(input.token),action:'billing_'+record.action,workspaceId,actorEmail:actor,actorRole:'client',at:Date.now(),detail:record.detail,pending:state.view.pendingChange};
    const emailKey=keyFor('action:'+hash(input.token)),existingEmail=await kv.get(emailKey);
    const email=existingEmail||billingEmailRecord({operationId:'action:'+hash(input.token),workspaceId,to:state.customer.email||state.workspace.ownerEmail,type:record.action,plan:state.view.plan,previousPlan:record.detail.previousPlan,amount:record.detail.amountDue,effectiveAt:state.view.renewalAt,payment:record.detail.summary});
    const updates=[{key:'workspace:'+workspaceId,before:state.workspace,after},{key,before:record,after:complete}];
    if(!state.view.pendingChange)updates.push({key:emailKey,before:existingEmail,after:email});
    if(!await compareAndAuditBatch(kv,updates,'audit:'+workspaceId,audit))throw new BillingError('Payment provider confirmed the change; account synchronization is pending. Retry this same confirmation.',503);
    return {ok:true,billing:state.view,pending:state.view.pendingChange,emailKey:state.view.pendingChange?null:emailKey};
  }finally{await releaseCheckoutSession(kv,claim)}
}
async function setupPayment(kv,workspaceId,provider,input){
  const state=await canonicalBilling(kv,workspaceId,provider);
  if(input.revision!==state.view.revision)throw new BillingError('Billing details changed. Refresh before updating payment.',409);
  if(!provider.config.mutationsAllowed)throw new BillingError('Payment updates are not enabled in this environment.',403);
  if(!/^pk_test_/.test(provider.config.publishableKey))throw new BillingError('Secure payment collection is unavailable.',503);
  const nonce=crypto.randomBytes(24).toString('hex'),key='billing:setup:'+hash(nonce);
  const record={workspaceId,customerId:state.customer.id,subscriptionId:state.subscription.id,revision:state.view.revision,status:'created',createdAt:Date.now()};await persist(kv,key,null,record);
  const intent=await provider.request('/setup_intents',{method:'POST',params:{customer:state.customer.id,usage:'off_session','automatic_payment_methods[enabled]':true,'metadata[callercore_operation]':hash(nonce)},idempotencyKey:'callercore-setup-'+hash(nonce)});
  if(!/^seti_/.test(intent.id||'')||id(intent.customer)!==state.customer.id||!intent.client_secret)throw new BillingError('Secure payment collection could not be verified.',502);
  await persist(kv,key,record,{...record,setupIntentId:intent.id});
  return {token:nonce,clientSecret:intent.client_secret,publishableKey:provider.config.publishableKey};
}
async function confirmPayment(kv,workspaceId,actor,provider,input){
  if(input.confirmed!==true||! /^[a-f0-9]{48}$/.test(input.token||''))throw new BillingError('Confirm saving this payment method as your default.',400);
  const key='billing:setup:'+hash(input.token),record=await kv.get(key);
  if(!record||record.workspaceId!==workspaceId||!record.setupIntentId)throw new BillingError('Payment update was not found.',404);
  const state=await canonicalBilling(kv,workspaceId,provider);
  if(record.status==='complete')return {ok:true,duplicate:true,emailKey:keyFor('action:'+hash(input.token)),billing:state.view};
  if(state.customer.id!==record.customerId||state.subscription.id!==record.subscriptionId)throw new BillingError('Billing ownership changed.',409);
  const intent=await provider.request('/setup_intents/'+record.setupIntentId);
  if(intent.status!=='succeeded'||id(intent.customer)!==state.customer.id||intent.metadata?.callercore_operation!==hash(input.token))throw new BillingError('Finish secure payment authentication before saving.',409);
  const method=await provider.request('/payment_methods/'+id(intent.payment_method));
  if(id(method.customer)!==state.customer.id)throw new BillingError('Payment method ownership could not be verified.',403);
  const proposalKey='billing:proposal:'+hash(input.token),existing=await kv.get(proposalKey);
  if(!existing){
    if(state.view.revision!==record.revision)throw new BillingError('Billing changed during payment collection. Refresh and try again.',409);
    await persist(kv,proposalKey,null,{workspaceId,customerId:record.customerId,subscriptionId:record.subscriptionId,action:'payment',params:{default_payment_method:method.id},detail:{action:'payment',summary:require('./billing-provider').paymentSummary(method)},revision:record.revision,status:'prepared',expiresAt:Date.now()+600000});
  }
  const result=await applyChange(kv,workspaceId,actor,provider,input);
  await persist(kv,key,record,{...record,status:'complete'});return result;
}
module.exports={prepareChange,applyChange,setupPayment,confirmPayment};
