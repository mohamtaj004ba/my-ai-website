const crypto=require('crypto');
const {PLANS}=require('./plans');
// Read-only comparison against CallerCore LLC on 2026-10-05 confirmed these prices.
const LIVE_PRICES={Starter:'price_1To98LF0BXlPng7V4YXh69Yc',Growth:'price_1To9D3F0BXlPng7VH3Ye2OzZ',Pro:'price_1To9G4F0BXlPng7VkvMGPE2Y'};
class BillingError extends Error{constructor(message,status=409){super(message);this.status=status}}
function providerConfig(env=process.env){
  const key=String(env.STRIPE_SECRET_KEY||'');
  const mode=/^[sr]k_test_/.test(key)?'test':/^[sr]k_live_/.test(key)?'live':null;
  if(!mode)throw new BillingError('Billing is temporarily unavailable. Please contact support.',503);
  if(env.VERCEL_ENV==='preview'&&mode!=='test')throw new BillingError('Preview billing requires an isolated test account.',503);
  if(env.VERCEL_ENV==='production'&&mode!=='live')throw new BillingError('Billing configuration needs review.',503);
  const prices=Object.fromEntries(Object.keys(PLANS).map(plan=>[plan,env['STRIPE_'+plan.toUpperCase()+'_PRICE_ID']||env['STRIPE_PRICE_'+plan.toUpperCase()]||(mode==='live'?LIVE_PRICES[plan]:null)]));
  if(Object.values(prices).some(x=>!/^price_[A-Za-z0-9]+$/.test(x||''))||new Set(Object.values(prices)).size!==3)throw new BillingError('Billing plan configuration needs review.',503);
  return {key,mode,prices,publishableKey:String(env.STRIPE_PUBLISHABLE_KEY||''),mutationsAllowed:mode==='test'&&env.VERCEL_ENV==='preview'};
}
function createProvider(env=process.env,transport=fetch){
  const config=providerConfig(env);
  async function request(path,{method='GET',params={},idempotencyKey}={}){
    if(!/^\/[a-z_]+(?:\/[A-Za-z0-9_]+)*$/.test(path))throw new BillingError('Invalid billing request',400);
    if(method!=='GET'&&!config.mutationsAllowed)throw new BillingError('Billing changes are not enabled for this environment.',403);
    const body=new URLSearchParams();for(const [k,v] of Object.entries(params))if(v!=null)body.append(k,String(v));
    const headers={Authorization:'Bearer '+config.key,'Stripe-Version':'2026-08-26.dahlia'};
    if(method!=='GET'){headers['Content-Type']='application/x-www-form-urlencoded';if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey}
    let response,data;try{response=await transport('https://api.stripe.com/v1'+path+(method==='GET'&&body.size?'?'+body.toString():''),{method,headers,...(method==='GET'?{}:{body:body.toString()}),signal:AbortSignal.timeout(15000)});data=await response.json()}catch(_){throw new BillingError('Billing could not be confirmed. Retry this same request.',503)}
    if(!response.ok||!data||typeof data!=='object'||Array.isArray(data)||data.error)throw new BillingError('Billing could not be confirmed. Please refresh and try again.',response.status===429?429:502);
    if(data.livemode!=null&&data.livemode!==(config.mode==='live'))throw new BillingError('Billing account environment mismatch.',503);
    return data;
  }
  return {config,request};
}
const id=x=>typeof x==='string'?x:x?.id;
function subscriptionRevision(subscription,customer){
  return crypto.createHash('sha256').update(JSON.stringify({id:subscription.id,customer:id(subscription.customer),status:subscription.status,cancel:subscription.cancel_at_period_end,cancelAt:subscription.cancel_at,period:subscription.items?.data?.map(i=>[i.id,id(i.price),i.quantity,i.current_period_end]),pending:subscription.pending_update,default:id(subscription.default_payment_method),contact:[customer.name,customer.email,customer.phone,customer.address,id(customer.invoice_settings?.default_payment_method)]})).digest('hex');
}
function safeDocument(value){try{const url=new URL(value);return url.protocol==='https:'&&['invoice.stripe.com','pay.stripe.com','billing.stripe.com'].includes(url.hostname)?url.href:null}catch(_){return null}}
function paymentSummary(method){
  if(!method||typeof method!=='object')return null;
  if(method.type==='card'&&/^\d{4}$/.test(method.card?.last4||''))return {type:'card',brand:String(method.card.brand||'Card'),last4:method.card.last4,expMonth:method.card.exp_month,expYear:method.card.exp_year};
  const bank=method.us_bank_account;if(method.type==='us_bank_account'&&/^\d{4}$/.test(bank?.last4||''))return {type:'bank',brand:String(bank.bank_name||'Bank account'),last4:bank.last4};
  return {type:String(method.type||'other'),brand:'Saved payment method'};
}
async function canonicalBilling(kv,workspaceId,provider){
  const workspace=await kv.get('workspace:'+workspaceId);
  if(!workspace||workspace.id!==workspaceId)throw new BillingError('Workspace billing record is unavailable.',404);
  const customerId=workspace.stripeCustomerId,subscriptionId=workspace.stripeSubscriptionId;
  if(!/^cus_[A-Za-z0-9]+$/.test(customerId||'')||!/^sub_[A-Za-z0-9]+$/.test(subscriptionId||''))throw new BillingError('Your subscription is not linked yet. Contact support for help.',409);
  const [customerOwner,subscriptionOwner]=await Promise.all([kv.get('stripe:customer:'+customerId),kv.get('stripe:subscription:'+subscriptionId)]);
  if(customerOwner!==workspaceId||subscriptionOwner!==workspaceId)throw new BillingError('Billing ownership could not be verified. Contact support.',403);
  const [customer,subscription,invoices]=await Promise.all([provider.request('/customers/'+customerId),provider.request('/subscriptions/'+subscriptionId,{params:{'expand[]':'default_payment_method'}}),provider.request('/invoices',{params:{customer:customerId,subscription:subscriptionId,limit:24}})]);
  if(customer.id!==customerId||customer.deleted||subscription.id!==subscriptionId||id(subscription.customer)!==customerId)throw new BillingError('Billing ownership could not be verified.',403);
  const items=subscription.items?.data;if(!Array.isArray(items))throw new BillingError('Subscription details are unavailable.',502);
  const item=items.find(i=>Object.values(provider.config.prices).includes(id(i.price)));
  if(!item||items.length!==1||item.quantity!==1)throw new BillingError('This subscription requires support review before changes.',409);
  const plan=Object.keys(provider.config.prices).find(p=>provider.config.prices[p]===id(item.price));
  if(item.price?.currency!=='usd'||item.price?.unit_amount!==PLANS[plan].price*100||item.price?.recurring?.interval!=='month'||item.price?.recurring?.usage_type==='metered'||(item.price?.recurring?.interval_count!=null&&item.price.recurring.interval_count!==1))throw new BillingError('Subscription price needs review.',409);
  let method=subscription.default_payment_method||customer.invoice_settings?.default_payment_method;
  if(typeof method==='string')method=await provider.request('/payment_methods/'+method);
  if(method&&id(method.customer)!==customerId)throw new BillingError('Saved payment ownership could not be verified.',403);
  if(!Array.isArray(invoices.data)||invoices.data.some(i=>id(i.customer)!==customerId))throw new BillingError('Invoice ownership could not be verified.',403);
  const used=Number(workspace.usage?.minutes),minutes=workspace.usage?.minutes!=null&&Number.isFinite(used)&&used>=0?used:null,allowance=PLANS[plan].minutes;
  const periodEnd=item.current_period_end||subscription.current_period_end||null;
  const view={plan,entitlements:require('./plans').entitlementsFor(plan),monthlyAmount:PLANS[plan].price*100,currency:'usd',status:subscription.status,renewalAt:periodEnd,cancelAtPeriodEnd:!!subscription.cancel_at_period_end,cancelAt:subscription.cancel_at||periodEnd,pendingChange:!!subscription.pending_update,revision:subscriptionRevision(subscription,customer),usage:{minutes,allowance,remaining:minutes!=null&&allowance!=null?Math.max(0,allowance-minutes):null,warning:minutes!=null&&allowance!=null&&minutes>=allowance*.8,overageEnabled:false},paymentMethod:paymentSummary(method),contact:{name:customer.name||'',email:customer.email||'',phone:customer.phone||'',address:customer.address||{}},invoices:invoices.data.map(i=>({number:i.number||null,date:i.created,amount:i.amount_paid||i.amount_due||0,currency:i.currency,status:i.status,periodStart:i.period_start,periodEnd:i.period_end,document:safeDocument(i.hosted_invoice_url),pdf:safeDocument(i.invoice_pdf)})),mutationsAllowed:provider.config.mutationsAllowed};
  if(provider.config.mutationsAllowed&&(subscription.pending_update||['past_due','unpaid','incomplete'].includes(subscription.status))&&id(subscription.latest_invoice)){
    const invoice=await provider.request('/invoices/'+id(subscription.latest_invoice),{params:{'expand[]':'confirmation_secret'}});
    const invoiceSubscription=id(invoice.subscription)||id(invoice.parent?.subscription_details?.subscription);
    if(id(invoice.customer)!==customerId||invoiceSubscription!==subscriptionId)throw new BillingError('Payment invoice ownership could not be verified.',403);
    if(invoice.status==='open'&&invoice.amount_remaining>0&&invoice.confirmation_secret?.client_secret&&/^pk_test_/.test(provider.config.publishableKey))view.paymentAction={clientSecret:invoice.confirmation_secret.client_secret,publishableKey:provider.config.publishableKey,amount:invoice.amount_remaining,currency:invoice.currency};
  }
  return {workspace,customer,subscription,item,view};
}
function validateContact(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BillingError('Enter your billing contact details.',400);
  const clean=(v,max)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x1f]/.test(v))throw new BillingError('Check your billing contact details.',400);return v.trim()};
  const name=clean(input.name,160),email=clean(input.email,200).toLowerCase(),phone=clean(input.phone||'',32);
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||phone&&!/^[+\d() .-]+$/.test(phone))throw new BillingError('Enter a valid name, email and phone number.',400);
  const address=input.address||{},out={name,email,phone};
  for(const field of ['line1','line2','city','state','postal_code','country'])out['address['+field+']']=clean(address[field]||'',field==='country'?2:160);
  if(out['address[country]']&&!/^[A-Z]{2}$/.test(out['address[country]']))throw new BillingError('Use a two-letter country code, such as US.',400);
  return out;
}
module.exports={BillingError,LIVE_PRICES,providerConfig,createProvider,canonicalBilling,subscriptionRevision,safeDocument,paymentSummary,validateContact,id};
