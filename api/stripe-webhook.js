const crypto=require('crypto');
const {kv}=require('@vercel/kv');
const {sendMail}=require('../lib/mail');
const {lifecycleEmail}=require('../lib/email-template');
const {normalizePlan,entitlementsFor}=require('../lib/plans');
const {recordSiteEvent,upsertWebsiteProspect}=require('../lib/site-analytics');
const {addBusinessHours}=require('../lib/business-hours');
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
    usage:existing.usage||{minutes:0},
    createdAt:existing.createdAt||Date.now(),
    updatedAt:Date.now()
  };
  await kv.set(key,workspace);
  await kv.set(userKey,{workspaceId,role:'owner',email});
  if(session.customer)await kv.set('stripe:customer:'+session.customer,workspaceId);
  if(session.subscription)await kv.set('stripe:subscription:'+session.subscription,workspaceId);
  return workspace;
}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const rawBody=await getRawBody(req);
  if(!verifyStripeSignature(rawBody,req.headers['stripe-signature'],STRIPE_WEBHOOK_SECRET))return res.status(400).json({error:'Invalid signature'});
  let event;try{event=JSON.parse(rawBody)}catch(_){return res.status(400).json({error:'Invalid payload'})}
  const checkoutEvent=event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded';
  const lifecycleEvent=['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.payment_failed','invoice.paid'].includes(event.type);

  if(lifecycleEvent){
    const obj=event.data&&event.data.object||{};
    const subscriptionId=event.type.startsWith('customer.subscription.')?obj.id:obj.subscription;
    const customerId=obj.customer;
    let workspaceId=null;
    if(subscriptionId)workspaceId=await kv.get('stripe:subscription:'+subscriptionId);
    if(!workspaceId&&customerId)workspaceId=await kv.get('stripe:customer:'+customerId);
    if(!workspaceId)return res.status(200).json({received:true,unmapped:true});
    const key='workspace:'+workspaceId;
    const ws=await kv.get(key);
    if(!ws)return res.status(200).json({received:true,workspace_missing:true});

    let status=ws.subscriptionStatus||'active';
    if(event.type==='customer.subscription.deleted')status='canceled';
    else if(event.type==='invoice.payment_failed')status='past_due';
    else if(event.type==='invoice.paid')status='active';
    else if(event.type.startsWith('customer.subscription.'))status=obj.status||status;

    await kv.set(key,{...ws,subscriptionStatus:status,updatedAt:Date.now()});
    if(subscriptionId&&!ws.stripeSubscriptionId){
      const updated=await kv.get(key);
      await kv.set(key,{...updated,stripeSubscriptionId:subscriptionId,updatedAt:Date.now()});
      await kv.set('stripe:subscription:'+subscriptionId,workspaceId);
    }
    return res.status(200).json({received:true,workspaceId,status});
  }

  if(!checkoutEvent)return res.status(200).json({received:true,ignored:true});
  const eventKey=event.id?'stripe:event:'+event.id:null;
  if(eventKey&&await kv.get(eventKey))return res.status(200).json({received:true,duplicate:true});
  const session=event.data.object;
  if(event.type==='checkout.session.completed'&&!['paid','no_payment_required'].includes(session.payment_status))return res.status(200).json({received:true,pending_payment:true});
  const mappedPlan=PLAN_BY_PAYMENT_LINK[session.payment_link];
  if(!mappedPlan)return res.status(400).json({error:'Unknown payment link'});
  const paidPlan=normalizePlan(mappedPlan);
  const sessionKey=session.id?'stripe:session:'+session.id:null;
  let sessionState=sessionKey?await kv.get(sessionKey):null;
  if(sessionState&&sessionState.status==='complete'){if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});return res.status(200).json({received:true,duplicate:true})}

  const leadId=session.client_reference_id;
  const customerEmail=String(session.customer_details?.email||'').trim().toLowerCase();
  let lead=null,token=sessionState?.token||null;
  if(token)lead=await kv.get('onboarding:'+token);
  if(!lead&&leadId)lead=await kv.get('lead:'+leadId);
  if(!lead)lead={name:session.customer_details?.name||'',business:'',email:customerEmail,phone:session.customer_details?.phone||'',industry:'',plan:paidPlan};
  lead.plan=paidPlan;
  const recipient=String(lead.email||customerEmail||'').trim().toLowerCase();
  if(!recipient)return res.status(500).json({error:'Missing customer email'});

  const workspace=await upsertWorkspace({lead,session,plan:paidPlan,email:recipient});
  if(lead.prospectId){
    await upsertWebsiteProspect({id:lead.prospectId,name:lead.name,business:lead.business,email:recipient,phone:lead.phone,industry:lead.industry,plan:paidPlan,source:'get_started',stage:'converted',visitorId:lead.visitorId||'',sessionId:lead.sessionId||''});
  }
  await recordSiteEvent({type:'checkout_complete',visitorId:lead.visitorId||'',sessionId:lead.sessionId||'',path:'/get-started',label:paidPlan,value:workspace.id});

  if(!token){
    token=crypto.randomBytes(24).toString('hex');
    await kv.set('onboarding:'+token,{...lead,workspaceId:workspace.id,stripeSessionId:session.id,agreementSigned:false,agreementSignedAt:null,intake:{},status:'awaiting_agreement',createdAt:Date.now()},{ex:60*60*24*30});
  }else{
    const onboarding=await kv.get('onboarding:'+token);
    if(onboarding&&!onboarding.workspaceId)await kv.set('onboarding:'+token,{...onboarding,workspaceId:workspace.id},{ex:60*60*24*30});
  }
  await kv.set('onboarding:workspace-token:'+workspace.id,token,{ex:60*60*24*90});
  const existingOnboarding=await kv.get('onboarding:workspace:'+workspace.id)||{};
  const paidAt=Date.now(),reviewEligibleAt=addBusinessHours(paidAt,2);
  await kv.set('onboarding:workspace:'+workspace.id,{
    ...existingOnboarding,
    workspaceId:workspace.id,
    status:'awaiting_review',
    paidAt,
    reviewEligibleAt,
    onboardingLinkSent:false,
    completionPercent:0,
    checklist:{...(existingOnboarding.checklist||{}),payment:true,accountReview:false,onboardingSent:false,agreement:false,intake:false,businessProfile:false,agentDraft:false,routingCaptured:false,phoneAssigned:!!String(workspace.phone||'').trim(),adminReview:false,testCall:false,clientApproval:false,live:false},
    updatedAt:Date.now()
  });
  if(sessionKey)await kv.set(sessionKey,{token,workspaceId:workspace.id,status:'awaiting_review'},{ex:60*60*24*90});

  const firstName=(lead.name||'').split(' ')[0]||'there';
  try{
    const email=lifecycleEmail({
      preheader:'Payment received. Your CallerCore setup request is now in review.',
      eyebrow:'PAYMENT CONFIRMED',
      title:'Welcome to CallerCore, '+firstName+'.',
      intro:'Thank you — we received your payment and created the CallerCore account for <strong>'+workspace.name+'</strong>.',
      statusLabel:'Current status',
      statusText:'Account review in progress — no action needed from you right now.',
      bodyHtml:'<p style="margin:0 0 12px">Our team will review your order and business details during business hours. Once that review is complete, we’ll send your welcome email with a secure onboarding link and service agreement.</p><p style="margin:0">You’ll always be able to see setup progress from your CallerCore account as the implementation moves forward.</p>',
      siteUrl:SITE_URL
    });
    await sendMail({to:recipient,subject:'Payment received — welcome to CallerCore',...email});
  }catch(err){console.error('Failed to send payment confirmation:',err)}

  if(sessionKey)await kv.set(sessionKey,{token,workspaceId:workspace.id,status:'awaiting_review'},{ex:60*60*24*90});
  if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});
  return res.status(200).json({received:true,workspaceId:workspace.id});
};