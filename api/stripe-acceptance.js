// Preview-only acceptance controls. Never exposes credentials or accepts arbitrary Stripe IDs.
const crypto=require('crypto');
const {RUN,EXPIRES,allowed,testEmail}=require('../lib/preview-billing-acceptance');
const {createProvider,canonicalBilling,BillingError}=require('../lib/billing-provider');
const {kv,storageEnvironment}=require('../lib/kv');
const {prepareChange,applyChange,setupPayment,confirmPayment}=require('../lib/billing-actions');
const {deliverBillingEmail,keyFor}=require('../lib/billing-email-outbox');
const {createSession}=require('../lib/auth');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!allowed(req)||req.method!=='POST')return res.status(404).json({error:'Not found'});
  try{
    const provider=createProvider();
    if(provider.config.mode!=='test'||storageEnvironment()!=='preview-isolated')throw Error('Acceptance isolation failed');
    const account=await provider.request('/account');
    if(account.id!=='acct_1To8TZFMvbBcKVZe')throw Error('Unexpected sandbox account');
    const body=req.body||{},action=body.action;
    if(action==='inspect'){
      const expected={Starter:'price_1UNL1EFMvbBcKVZeOtASOhbm',Growth:'price_1UNL1HFMvbBcKVZeAx4IrRLF',Pro:'price_1UNL1JFMvbBcKVZenJJq8Pvh'};
      if(Object.keys(expected).some(p=>provider.config.prices[p]!==expected[p])||(process.env.STRIPE_SETUP_PRICE_ID||process.env.STRIPE_PRICE_SETUP)!=='price_1UNL1LFMvbBcKVZewa9WFE43'||!/^pk_test_/.test(provider.config.publishableKey))throw Error('Sandbox prices or publishable key mismatch');
      const prices=await Promise.all([...Object.values(expected),'price_1UNL1LFMvbBcKVZewa9WFE43'].map(p=>provider.request('/prices/'+p)));
      if(prices.some(p=>p.livemode!==false||!p.active))throw Error('Catalog isolation failed');
      const token=String(req.headers['x-billing-acceptance']);
      if(/^[a-f0-9]{64}$/.test(token))res.setHeader('Set-Cookie','cc_billing_acceptance='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+Math.max(0,Math.floor((EXPIRES-Date.now())/1000)));
      return res.status(200).json({ok:true,run:RUN,expires:EXPIRES,account:account.id,mode:'test',storage:storageEnvironment(),publicCheckoutEnabled:process.env.CALLERCORE_CHECKOUT_ENABLED==='true',billingEmails:'captured',prices:prices.map(p=>({id:p.id,amount:p.unit_amount,recurring:p.recurring?.interval||null,livemode:p.livemode}))});
    }
    const receipt=String(body.receipt||'');if(!/^[a-f0-9]{48}$/.test(receipt))throw new BillingError('Acceptance receipt required',400);
    const attempt=await kv.get('checkout:attempt:'+hash(receipt));
    if(!attempt?.sessionId||!testEmail(attempt.email))throw new BillingError('Disposable checkout required',403);
    const session=await provider.request('/checkout/sessions/'+attempt.sessionId);
    if(session.livemode!==false||session.metadata?.attempt_hash!==hash(receipt)||session.client_reference_id!==attempt.leadId)throw new BillingError('Acceptance ownership mismatch',403);
    const fulfillment=await kv.get('stripe:session:'+session.id),workspaceId=fulfillment?.workspaceId;
    if(action==='evidence'){
      const lines=await provider.request('/checkout/sessions/'+session.id+'/line_items',{params:{limit:10}});
      const email=await kv.get(keyFor('purchase:'+session.id));
      return res.status(200).json({session:{id:session.id,status:session.status,paymentStatus:session.payment_status,amount:session.amount_total,customer:session.customer,subscription:session.subscription,livemode:session.livemode,tax:session.automatic_tax?.enabled},lines:lines.data?.map(l=>({price:l.price.id,amount:l.amount_total,quantity:l.quantity})),fulfillment,email:email?{status:email.status,type:email.type,subject:email.subject,text:email.text,html:email.html}:null,workspace:workspaceId?await kv.get('workspace:'+workspaceId):null});
    }
    if(!workspaceId||session.payment_status!=='paid')throw new BillingError('Paid disposable workspace required',409);
    const workspace=await kv.get('workspace:'+workspaceId);
    if(workspace?.ownerEmail!==attempt.email)throw new BillingError('Disposable workspace ownership mismatch',403);
    if(action==='records'){const keys=await kv.keys('billing:email:*'),records=await Promise.all(keys.map(k=>kv.get(k)));return res.status(200).json({emails:records.filter(e=>e?.workspaceId===workspaceId).map(e=>({type:e.type,status:e.status,subject:e.subject,operationId:e.operationId,createdAt:e.createdAt,text:e.text,html:e.html})),audit:await kv.get('audit:'+workspaceId)});}
    if(action==='login'){
      const member=await kv.get('user:email:'+attempt.email);
      if(member?.workspaceId!==workspaceId||member.role==='admin')throw new BillingError('Disposable member ownership mismatch',403);
      await createSession(res,{email:attempt.email,workspaceId,role:'owner',authVersion:Number(member.sessionVersion||0)});
      return res.status(200).json({ok:true});
    }
    const input=body.input||{};
    if(Object.keys(input).some(k=>['customer','customerId','subscription','subscriptionId','paymentMethodId','card','cvc','number'].includes(k)))throw new BillingError('Unsafe acceptance input',400);
    let result;
    if(action==='state')result={billing:(await canonicalBilling(kv,workspaceId,provider)).view};
    else if(action==='proposal')result=await prepareChange(kv,workspaceId,provider,input);
    else if(action==='confirm')result=await applyChange(kv,workspaceId,attempt.email,provider,input);
    else if(action==='payment-setup')result=await setupPayment(kv,workspaceId,provider,input);
    else if(action==='payment-confirm')result=await confirmPayment(kv,workspaceId,attempt.email,provider,input);
    else throw new BillingError('Unsupported acceptance action',400);
    if(result.emailKey&&await kv.get(result.emailKey)){const email=await deliverBillingEmail(kv,result.emailKey,()=>{throw Error('Acceptance must never send email')});result.emailStatus=email.status;}
    return res.status(200).json(result);
  }catch(error){return res.status(error instanceof BillingError?error.status:503).json({error:error instanceof BillingError?error.message:'Sandbox acceptance configuration or provider check failed'});}
};

