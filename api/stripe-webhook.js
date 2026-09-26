const crypto=require('crypto');
const {kv}=require('../lib/kv');
const {sendMail}=require('../lib/mail');
const {safeError}=require('../lib/safe-log');
const {lifecycleEmail,esc:escapeEmailHtml}=require('../lib/email-template');
const {normalizePlan,entitlementsFor}=require('../lib/plans');
const {recordSiteEvent,upsertWebsiteProspect}=require('../lib/site-analytics');
const {addBusinessHours}=require('../lib/business-hours');
const {lifecycleDecision}=require('../lib/stripe-lifecycle');
const {claimCheckoutSession,releaseCheckoutSession}=require('../lib/stripe-session-lock');
module.exports.config={api:{bodyParser:false}};
const STRIPE_WEBHOOK_SECRET=process.env.STRIPE_WEBHOOK_SECRET;
const SITE_URL=process.env.SITE_URL||'https://www.callercore.com';
const PLAN_BY_PAYMENT_LINK={
  'plink_1To9m8F0BXlPng7VihxbmKPJ':'Starter',
  'plink_1To9pBF0BXlPng7VdkdBhHcx':'Growth',
  'plink_1To9qJF0BXlPng7VXXwBIHHf':'Pro'
};
function getRawBody(req){return new Promise((resolve,reject)=>{let data='';req.on('data',c=>data+=c);req.on('end',()=>resolve(data));req.on('error',reject)})}
function verifyStripeSignature(rawBody,sigHeader,secret){
  if(!sigHeader||!secret)return false;
  const parts=sigHeader.split(',').map(p=>p.split('=').map(s=>s.trim()));
  const timestamp=parts.find(([k])=>k==='t')?.[1];
  const signatures=parts.filter(([k])=>k==='v1').map(([,v])=>v);
  if(!timestamp||!signatures.length)return false;
  const ts=Number(timestamp);if(!Number.isFinite(ts)||Math.abs(Math.floor(Date.now()/1000)-ts)>300)return false;
  const expected=crypto.createHmac('sha256',secret).update(timestamp+'.'+rawBody).digest('hex');
  const expectedBuf=Buffer.from(expected,'hex');
  return signatures.some(sig=>{try{const got=Buffer.from(sig,'hex');return got.length===expectedBuf.length&&crypto.timingSafeEqual(got,expectedBuf)}catch(_){return false}})
}

async function upsertWorkspace({lead,session,plan,email}){
  const userKey='user:email:'+email;
  const existingMember=await kv.get(userKey);
  if(existingMember?.role==='admin'||existingMember?.disabled)throw new Error('Checkout email is reserved or disabled and requires manual account reconciliation');
  let workspaceId=existingMember&&existingMember.workspaceId;
  if(!workspaceId)workspaceId=crypto.randomUUID();
  const key='workspace:'+workspaceId;
  const existing=await kv.get(key)||{};
  const ent=entitlementsFor(plan);
  const workspace={
    ...existing,
    id:workspaceId,
    name:lead.business||existing.name||'CallerCore Client',
    ownerName:lead.name||existing.ownerName||'',
    ownerEmail:email,
    contactPhone:lead.phone||existing.contactPhone||'',
    phone:existing.phone||'',
    industry:lead.industry||existing.industry||'',
    plan:ent.plan,
    status:existing.status||'onboarding',
    subscriptionStatus:'active',
    stripeCustomerId:session.customer||existing.stripeCustomerId||null,
    stripeSubscriptionId:session.subscription||existing.stripeSubscriptionId||null,
    stripeCheckoutSessionId:session.id,
    acquisition:existing.acquisition||{
      prospectId:lead.prospectId||'',
      source:lead.acquisition?.source||'website',
      utmSource:lead.acquisition?.utmSource||lead.utmSource||'',
      utmMedium:lead.acquisition?.utmMedium||lead.utmMedium||'',
      utmCampaign:lead.acquisition?.utmCampaign||lead.utmCampaign||'',
      visitorId:lead.visitorId||'',
      sessionId:lead.sessionId||'',
      firstTouchAt:lead.createdAt||Date.now()
    },
    conversion:{
      ...(existing.conversion||{}),
      firstPaidAt:existing.conversion?.firstPaidAt||Date.now(),
      lastCheckoutAt:Date.now(),
      checkoutSessionId:session.id||'',
      plan:ent.plan,
      monthlyValue:ent.price,
      setupValue:500
    },
    usage:existing.usage||{minutes:0},
    createdAt:existing.createdAt||Date.now(),
    updatedAt:Date.now()
  };
  await kv.set(key,workspace);
  // Preserve sessionVersion and profile/security metadata across repeat purchases.
  await kv.set(userKey,{...(existingMember||{}),workspaceId,role:existingMember?.role||'owner',email});
  if(session.customer)await kv.set('stripe:customer:'+session.customer,workspaceId);
  if(session.subscription)await kv.set('stripe:subscription:'+session.subscription,workspaceId);
  return workspace;
}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const rawBody=await getRawBody(req);
  if(!verifyStripeSignature(rawBody,req.headers['stripe-signature'],STRIPE_WEBHOOK_SECRET))return res.status(400).json({error:'Invalid signature'});
  let event;try{event=JSON.parse(rawBody)}catch(_){return res.status(400).json({error:'Invalid payload'})}
  const eventKey=event.id?'stripe:event:'+event.id:null;
  if(eventKey&&await kv.get(eventKey))return res.status(200).json({received:true,duplicate:true});
  const checkoutEvent=event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded';
  const lifecycleEvent=['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.payment_failed','invoice.paid'].includes(event.type);

  if(lifecycleEvent){
    const obj=event.data&&event.data.object||{};
    const subscriptionId=event.type.startsWith('customer.subscription.')?obj.id:obj.subscription;
    const customerId=obj.customer;
    let workspaceId=null;
    if(subscriptionId)workspaceId=await kv.get('stripe:subscription:'+subscriptionId);
    if(!workspaceId&&customerId)workspaceId=await kv.get('stripe:customer:'+customerId);
    if(!workspaceId){if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});return res.status(200).json({received:true,unmapped:true})}
    const key='workspace:'+workspaceId,ws=await kv.get(key);
    if(!ws){if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});return res.status(200).json({received:true,workspace_missing:true})}
    const decision=lifecycleDecision(ws,event,subscriptionId);
    if(!decision.apply){
      if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});
      return res.status(200).json({received:true,[decision.reason]:true});
    }
    const {eventCreatedAt,previousEventAt,status}=decision;

    const billing={...(ws.stripeBilling||{}),customerId:customerId||ws.stripeCustomerId||null,subscriptionId:subscriptionId||ws.stripeSubscriptionId||null,lastEvent:event.type,lastEventAt:Date.now(),lastEventCreatedAt:eventCreatedAt||previousEventAt||0};
    if(event.type.startsWith('customer.subscription.')){
      billing.currentPeriodEnd=obj.current_period_end?Number(obj.current_period_end)*1000:(billing.currentPeriodEnd||null);
      billing.cancelAtPeriodEnd=!!obj.cancel_at_period_end;
      billing.canceledAt=obj.canceled_at?Number(obj.canceled_at)*1000:(billing.canceledAt||null);
      const amount=Number(obj.items?.data?.[0]?.price?.unit_amount||0);
      const planByAmount={34900:'Starter',59900:'Growth',99900:'Pro'};
      if(planByAmount[amount])billing.detectedPlan=planByAmount[amount];
    }else{
      billing.lastInvoiceId=obj.id||billing.lastInvoiceId||null;
      billing.lastInvoiceAmount=Number(obj.amount_due||obj.amount_paid||0);
      billing.lastInvoiceUrl=obj.hosted_invoice_url||billing.lastInvoiceUrl||'';
    }
    const next={...ws,subscriptionStatus:status,stripeBilling:billing,updatedAt:Date.now()};
    if(subscriptionId&&(event.type==='customer.subscription.created'||!next.stripeSubscriptionId))next.stripeSubscriptionId=subscriptionId;
    if(billing.detectedPlan&&billing.detectedPlan!==ws.plan)next.plan=billing.detectedPlan;
    await kv.set(key,next);
    if(subscriptionId)await kv.set('stripe:subscription:'+subscriptionId,workspaceId);

    const recipient=String(next.ownerEmail||'').trim().toLowerCase(),firstName=String(next.ownerName||'').split(' ')[0]||'there';
    try{
      if(recipient&&event.type==='invoice.payment_failed'){
        const email=lifecycleEmail({
          preheader:'Your CallerCore payment needs attention.',
          eyebrow:'BILLING ACTION NEEDED',
          title:'We couldn’t process your CallerCore payment.',
          intro:'Hi '+firstName+', your subscription is still attached to your account, but the latest payment attempt was unsuccessful.',
          statusLabel:'Current status',
          statusText:'Past due — please update your billing method to avoid service interruption.',
          bodyHtml:'<p style="margin:0">Open Billing & Plan in CallerCore to review your billing status. If anything looks wrong or you need help, contact us and we’ll work through it with you.</p>',
          ctaLabel:'Open billing',
          ctaUrl:SITE_URL+'/dashboard',
          siteUrl:SITE_URL
        });
        await sendMail({to:recipient,subject:'CallerCore billing needs attention',...email});
      }else if(recipient&&event.type==='customer.subscription.deleted'){
        const email=lifecycleEmail({
          preheader:'Your CallerCore subscription has been canceled.',
          eyebrow:'SUBSCRIPTION UPDATE',
          title:'Your CallerCore subscription is canceled.',
          intro:'Hi '+firstName+', Stripe has confirmed the cancellation of your CallerCore subscription.',
          statusLabel:'Status',
          statusText:'Canceled',
          bodyHtml:'<p style="margin:0">Your account data is not automatically deleted by this billing event. If this cancellation was unexpected, or you’d like help restarting service, contact us and we’ll help.</p>',
          ctaLabel:'Contact support',
          ctaUrl:'mailto:support@callercore.com',
          siteUrl:SITE_URL
        });
        await sendMail({to:recipient,subject:'Your CallerCore subscription is canceled',...email});
      }else if(recipient&&event.type==='invoice.paid'&&ws.subscriptionStatus==='past_due'){
        const email=lifecycleEmail({
          preheader:'Your CallerCore billing is back in good standing.',
          eyebrow:'PAYMENT RECEIVED',
          title:'Your CallerCore billing is back on track.',
          intro:'Hi '+firstName+', we received your payment successfully.',
          statusLabel:'Status',
          statusText:'Active',
          bodyHtml:'<p style="margin:0">No further billing action is needed right now. Thanks for taking care of it.</p>',
          ctaLabel:'Open CallerCore',
          ctaUrl:SITE_URL+'/dashboard',
          siteUrl:SITE_URL
        });
        await sendMail({to:recipient,subject:'CallerCore payment received',...email});
      }
    }catch(err){console.error('Stripe lifecycle email failed:',safeError(err))}

    if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});
    return res.status(200).json({received:true,workspaceId,status});
  }
  if(!checkoutEvent){if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});return res.status(200).json({received:true,ignored:true})}
  const session=event.data.object;
  if(event.type==='checkout.session.completed'&&!['paid','no_payment_required'].includes(session.payment_status))return res.status(200).json({received:true,pending_payment:true});
  const metadataPlan=String(session.metadata?.plan||'');
  const mappedPlan=PLAN_BY_PAYMENT_LINK[session.payment_link]||(['Starter','Growth','Pro'].includes(metadataPlan)?metadataPlan:null);
  if(!mappedPlan)return res.status(400).json({error:'Unknown checkout plan'});
  const paidPlan=normalizePlan(mappedPlan);
  if(!session.id||typeof session.id!=='string'||session.id.length>200)return res.status(400).json({error:'Invalid checkout session ID'});
  const sessionKey='stripe:session:'+session.id;
  let sessionState=sessionKey?await kv.get(sessionKey):null;
  if(sessionState&&(sessionState.status==='complete'||(sessionState.status==='awaiting_review'&&sessionState.workspaceId&&sessionState.token))){
    if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});
    return res.status(200).json({received:true,duplicate:true,workspaceId:sessionState.workspaceId||null});
  }

  const claim=await claimCheckoutSession(kv,session.id);
  if(!claim){res.setHeader('Retry-After','15');return res.status(503).json({error:'Checkout provisioning is in progress. Stripe should retry.'})}
  try{
    // Recheck the durable receipt after taking the claim. A preceding worker
    // could have completed between the first read and claim acquisition.
    sessionState=await kv.get(sessionKey);
    if(sessionState&&(sessionState.status==='complete'||(sessionState.status==='awaiting_review'&&sessionState.workspaceId&&sessionState.token))){
      if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});
      return res.status(200).json({received:true,duplicate:true,workspaceId:sessionState.workspaceId||null});
    }

  const leadId=session.client_reference_id;
  const customerEmail=String(session.customer_details?.email||'').trim().toLowerCase();
  let lead=null,token=sessionState?.token||null;
  if(token)lead=await kv.get('onboarding:'+token);
  if(!lead&&leadId)lead=await kv.get('lead:'+leadId);
  if(!lead)lead={name:session.customer_details?.name||'',business:'',email:customerEmail,phone:session.customer_details?.phone||'',industry:'',plan:paidPlan};
  lead.plan=paidPlan;
  const recipient=String(lead.email||customerEmail||'').trim().toLowerCase();
  if(!recipient)return res.status(500).json({error:'Missing customer email'});

  // Two different checkout sessions can refer to one customer. Serialize by
  // normalized email and Stripe customer ID as well as by checkout session.
  // Hash email-derived key material so identifiers do not expose an address.
  const accountIdentities=['account-email:'+crypto.createHash('sha256').update(recipient).digest('hex')];
  if(session.customer)accountIdentities.push('account-customer:'+crypto.createHash('sha256').update(String(session.customer)).digest('hex'));
  const accountClaims=[];
  try{
    for(const identity of accountIdentities){
      const accountClaim=await claimCheckoutSession(kv,identity);
      if(!accountClaim){res.setHeader('Retry-After','15');return res.status(503).json({error:'Customer checkout provisioning is in progress. Stripe should retry.'})}
      accountClaims.push(accountClaim);
    }
    // A different event could have finished this session while we awaited
    // account identity claims. Never repeat payment setup on stale state.
    sessionState=await kv.get(sessionKey);
    if(sessionState&&(sessionState.status==='complete'||(sessionState.status==='awaiting_review'&&sessionState.workspaceId&&sessionState.token))){
      if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});
      return res.status(200).json({received:true,duplicate:true,workspaceId:sessionState.workspaceId||null});
    }

  const workspace=await upsertWorkspace({lead,session,plan:paidPlan,email:recipient});
  if(lead.prospectId){
    const paidEnt=entitlementsFor(paidPlan),convertedAt=Date.now();
    await upsertWebsiteProspect({
      id:lead.prospectId,name:lead.name,business:lead.business,email:recipient,phone:lead.phone,industry:lead.industry,plan:paidPlan,
      stage:'converted',visitorId:lead.visitorId||'',sessionId:lead.sessionId||'',utmSource:lead.utmSource||undefined,utmMedium:lead.utmMedium||undefined,utmCampaign:lead.utmCampaign||undefined,
      workspaceId:workspace.id,stripeCustomerId:session.customer||'',convertedAt,monthlyValue:paidEnt.price,setupValue:500
    });
  }
  try{await recordSiteEvent({type:'checkout_complete',visitorId:lead.visitorId||'',sessionId:lead.sessionId||'',path:'/get-started',label:paidPlan,value:workspace.id})}
  catch(analyticsError){console.error('Paid checkout analytics unavailable',safeError(analyticsError))}

  if(!token){
    const linkedToken=await kv.get('onboarding:workspace-token:'+workspace.id);
    if(linkedToken){
      const linkedOnboarding=await kv.get('onboarding:'+linkedToken);
      if(linkedOnboarding&&linkedOnboarding.workspaceId===workspace.id)token=linkedToken;
    }
  }
  if(!token){
    token=crypto.randomBytes(24).toString('hex');
    await kv.set('onboarding:'+token,{...lead,workspaceId:workspace.id,stripeSessionId:session.id,agreementSigned:false,agreementSignedAt:null,intake:{},status:'awaiting_agreement',createdAt:Date.now()},{ex:60*60*24*30});
  }else{
    const onboarding=await kv.get('onboarding:'+token);
    if(onboarding&&!onboarding.workspaceId)await kv.set('onboarding:'+token,{...onboarding,workspaceId:workspace.id},{ex:60*60*24*30});
  }
  await kv.set('onboarding:workspace-token:'+workspace.id,token,{ex:60*60*24*90});
  const existingOnboarding=await kv.get('onboarding:workspace:'+workspace.id)||{};
  const isRepeatPurchase=!!(existingOnboarding.workspaceId===workspace.id&&existingOnboarding.status);
  const paidAt=Date.now(),reviewEligibleAt=addBusinessHours(paidAt,2);
  const firstCheckoutChecklist={payment:true,accountReview:false,onboardingSent:false,agreement:false,intake:false,businessProfile:false,agentDraft:false,routingCaptured:false,phoneAssigned:!!String(workspace.phone||'').trim(),adminReview:false,testCall:false,clientApproval:false,live:false};
  await kv.set('onboarding:workspace:'+workspace.id,{
    ...existingOnboarding,
    workspaceId:workspace.id,
    status:isRepeatPurchase?existingOnboarding.status:'awaiting_review',
    paidAt:isRepeatPurchase?(existingOnboarding.paidAt||paidAt):paidAt,
    lastCheckoutAt:paidAt,
    reviewEligibleAt:isRepeatPurchase?(existingOnboarding.reviewEligibleAt||reviewEligibleAt):reviewEligibleAt,
    onboardingLinkSent:isRepeatPurchase?!!existingOnboarding.onboardingLinkSent:false,
    completionPercent:isRepeatPurchase?Number(existingOnboarding.completionPercent||0):0,
    checklist:isRepeatPurchase?{...existingOnboarding.checklist,payment:true}:firstCheckoutChecklist,
    updatedAt:Date.now()
  });
  if(sessionKey)await kv.set(sessionKey,{token,workspaceId:workspace.id,status:'awaiting_review'},{ex:60*60*24*90});

  const firstName=(lead.name||'').split(' ')[0]||'there';
  try{
    const email=lifecycleEmail({
      preheader:isRepeatPurchase?'Payment received. Your existing CallerCore setup is preserved.':'Payment received. Your CallerCore setup request is now in review.',
      eyebrow:'PAYMENT CONFIRMED',
      title:isRepeatPurchase?'Your CallerCore payment is confirmed.':'Welcome to CallerCore, '+firstName+'.',
      intro:isRepeatPurchase?'Thank you — your new payment for <strong>'+escapeEmailHtml(workspace.name)+'</strong> was received. Your existing CallerCore account remains in place.':'Thank you — we received your payment and created the CallerCore account for <strong>'+escapeEmailHtml(workspace.name)+'</strong>.',
      statusLabel:'Current status',
      statusText:isRepeatPurchase?'Your current setup progress remains in place.':'Account review in progress — no action needed from you right now.',
      bodyHtml:isRepeatPurchase?'<p style="margin:0">Your current onboarding progress and completed steps have not been reset by this purchase. Visit your CallerCore dashboard for the latest account and billing details.</p>':'<p style="margin:0 0 12px">Our team will review your order and business details during business hours. Once that review is complete, we’ll send your welcome email with a secure onboarding link and service agreement.</p><p style="margin:0">You’ll always be able to see setup progress from your CallerCore account as the implementation moves forward.</p>',
      siteUrl:SITE_URL
    });
    await sendMail({to:recipient,subject:isRepeatPurchase?'CallerCore payment received — your account remains in place':'Payment received — welcome to CallerCore',...email});
  }catch(err){console.error('Failed to send payment confirmation:',safeError(err))}

  if(sessionKey)await kv.set(sessionKey,{token,workspaceId:workspace.id,status:'awaiting_review'},{ex:60*60*24*90});
  if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});
  return res.status(200).json({received:true,workspaceId:workspace.id});
  }finally{
    for(const accountClaim of accountClaims.reverse()){
      try{await releaseCheckoutSession(kv,accountClaim)}
      catch(releaseError){console.error('Stripe customer claim cleanup failed',safeError(releaseError))}
    }
  }
  }finally{
    try{await releaseCheckoutSession(kv,claim)}
    catch(releaseError){console.error('Stripe checkout claim cleanup failed',safeError(releaseError))}
  }
};