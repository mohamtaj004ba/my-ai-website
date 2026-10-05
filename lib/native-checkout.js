const crypto=require('crypto');
const {createProvider,BillingError,id}=require('./billing-provider');
const {compareAndSetConfig}=require('./config-transaction');
const {claimCheckoutSession,releaseCheckoutSession}=require('./stripe-session-lock');
const {PLANS}=require('./plans');
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
async function save(kv,key,before,after){if(!await compareAndSetConfig(kv,[{key,before,after}]))throw new BillingError('Another checkout request is processing. Retry the same checkout.',409)}
async function beginCheckout({kv,req,res,upsertWebsiteProspect,origin,env=process.env,provider}){
  // This entry point does not bypass the public launch gate, even with test credentials.
  if(env.CALLERCORE_CHECKOUT_ENABLED!=='true')throw new BillingError('CallerCore signup is not open yet. Contact us to discuss your setup.',503);
  provider=provider||createProvider(env);
  const raw=req.body||{},attempt=String(raw.attemptId||'');
  if(raw.billingTermsAccepted!==true)throw new BillingError('Review and accept the billing terms before continuing.',400);
  if(!/^[a-f0-9]{48}$/.test(attempt))throw new BillingError('Refresh the page to start a secure checkout.',400);
  const clean=(v,max)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x1f]/.test(v))throw new BillingError('Check your business information.',400);return v.trim()};
  const plan=clean(raw.plan,20),name=clean(raw.name,120),business=clean(raw.business,160),email=clean(raw.email,200).toLowerCase(),phone=clean(raw.phone,32),industry=clean(raw.industry,160);
  if(!PLANS[plan]||![name,business,phone,industry].every(Boolean)||!/^\S+@\S+\.\S+$/.test(email)||! /^[+\d() .-]+$/.test(phone))throw new BillingError('Complete your business information before continuing.',400);
  const setupPrice=env.STRIPE_SETUP_PRICE_ID||env.STRIPE_PRICE_SETUP;
  if(!/^price_[A-Za-z0-9]+$/.test(setupPrice||''))throw new BillingError('Signup payment configuration needs review.',503);
  const fingerprint=hash(JSON.stringify({plan,name,business,email,phone,industry})),key='checkout:attempt:'+hash(attempt);
  const claim=await claimCheckoutSession(kv,'signup_'+hash(email));if(!claim)throw new BillingError('Your checkout is already being prepared. Please retry shortly.',409);
  try{
    let record=await kv.get(key);
    if(record&&(record.fingerprint!==fingerprint||record.email!==email))throw new BillingError('Your checkout details changed. Start a new checkout.',409);
    if(record?.expiresAt<Date.now())throw new BillingError('This checkout expired. Contact support if you completed payment.',409);
    if(!record){
      const member=await kv.get('user:email:'+email);
      if(member)throw new BillingError('An account already uses this email. Sign in to manage your plan or contact support.',409);
      const existingAttempt=await kv.get('checkout:email:'+hash(email));
      if(existingAttempt&&existingAttempt!==key){const existing=await kv.get(existingAttempt);if(existing&&existing.expiresAt>Date.now())throw new BillingError('A checkout is already open for this email. Return to your original checkout or contact support.',409)}
      const [price,setup]=await Promise.all([provider.request('/prices/'+provider.config.prices[plan]),provider.request('/prices/'+setupPrice)]);
      if(price.unit_amount!==PLANS[plan].price*100||price.currency!=='usd'||price.recurring?.interval!=='month'||price.recurring?.usage_type==='metered'||(price.recurring?.interval_count!=null&&price.recurring.interval_count!==1)||!price.active||setup.unit_amount!==50000||setup.currency!=='usd'||setup.recurring||!setup.active)throw new BillingError('Your order pricing could not be verified.',503);
      const prospect=await upsertWebsiteProspect({...raw,name,business,email,phone,industry,plan,source:'get_started',stage:'checkout_started',marketingEmailConsent:{granted:raw.marketingEmailConsent===true,source:'get_started'}});
      if(!prospect?.id||prospect.email?.toLowerCase()!==email)throw new BillingError('Your signup details could not be saved.',503);
      const leadId=crypto.randomUUID(),lead={name,business,email,phone,industry,plan,prospectId:prospect.id,createdAt:Date.now(),attemptHash:hash(attempt),termsVersion:'billing-summary-2026-10',termsAcceptedAt:Date.now(),setupAmount:50000,monthlyAmount:PLANS[plan].price*100,overageAccepted:false,taxEnabled:false};
      record={fingerprint,email,leadId,prospectId:prospect.id,plan,status:'prepared',expiresAt:Date.now()+23*60*60*1000,createdAt:Date.now()};
      if(!await compareAndSetConfig(kv,[{key:'lead:'+leadId,before:null,after:lead},{key,before:null,after:record},{key:'checkout:email:'+hash(email),before:existingAttempt,after:key}]))throw new BillingError('Your signup could not be saved. Retry this same checkout.',503);
    }
    const suffix=hash(attempt).slice(0,8).replace(/[0-9]/g,n=>String.fromCharCode(97+Number(n)));
    const params={mode:'subscription',ui_mode:'elements',customer_email:email,client_reference_id:record.leadId,'line_items[0][price]':provider.config.prices[plan],'line_items[0][quantity]':1,'line_items[1][price]':setupPrice,'line_items[1][quantity]':1,'automatic_tax[enabled]':false,'metadata[plan]':plan,'metadata[prospect_id]':record.prospectId,'metadata[attempt_hash]':hash(attempt),'subscription_data[metadata][plan]':plan,return_url:origin+'/checkout-complete?receipt='+attempt,integration_identifier:'callercore_native_'+suffix};
    // Stable provider key remains the same across refreshes, timeouts and persistence failures.
    const session=record.sessionId?await provider.request('/checkout/sessions/'+record.sessionId):await provider.request('/checkout/sessions',{method:'POST',params,idempotencyKey:'callercore-signup-'+hash(attempt)});
    if(!/^cs_/.test(session.id||'')||session.client_reference_id!==record.leadId||session.metadata?.attempt_hash!==hash(attempt)||!session.client_secret)throw new BillingError('Secure checkout could not be verified.',502);
    const after={...record,sessionId:session.id,status:session.status||'open'};await save(kv,key,record,after);
    res.setHeader('Set-Cookie','cc_checkout_receipt='+attempt+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400');
    return {clientSecret:session.client_secret,publishableKey:provider.config.publishableKey,receipt:attempt,summary:{plan,monthlyAmount:PLANS[plan].price*100,setupAmount:50000,dueToday:PLANS[plan].price*100+50000,taxEnabled:false,overageEnabled:false}};
  }finally{await releaseCheckoutSession(kv,claim)}
}
async function checkoutStatus({kv,req,provider}){
  const receipt=String(req.query?.receipt||''),cookie=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('cc_checkout_receipt='))?.slice('cc_checkout_receipt='.length);
  if(!/^[a-f0-9]{48}$/.test(receipt)||receipt!==cookie)throw new BillingError('Open checkout confirmation in the browser where you started payment.',403);
  const attempt=await kv.get('checkout:attempt:'+hash(receipt));
  if(!attempt?.sessionId)throw new BillingError('Payment is still being prepared. Do not submit a second purchase.',409);
  const session=await provider.request('/checkout/sessions/'+attempt.sessionId);
  if(session.id!==attempt.sessionId||session.metadata?.attempt_hash!==hash(receipt)||session.client_reference_id!==attempt.leadId)throw new BillingError('Payment confirmation could not be verified.',403);
  const fulfillment=await kv.get('stripe:session:'+session.id);
  const paid=session.status==='complete'&&session.payment_status==='paid',onboarding=paid&&!!fulfillment?.workspaceId&&['awaiting_review','complete'].includes(fulfillment.status);
  return {status:session.status,paymentStatus:session.payment_status,paid,onboarding,plan:attempt.plan,customerEmail:attempt.email,reconciliationPending:paid&&!onboarding};
}
module.exports={beginCheckout,checkoutStatus};
