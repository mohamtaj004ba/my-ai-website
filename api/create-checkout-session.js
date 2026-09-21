const crypto=require('crypto');
const {kv}=require('@vercel/kv');
const {rateLimit,requestIp}=require('../lib/rate-limit');
const {recordSiteEvent,upsertWebsiteProspect}=require('../lib/site-analytics');

const SITE_URL=process.env.SITE_URL||'https://www.callercore.com';
const STRIPE_SECRET_KEY=process.env.STRIPE_SECRET_KEY||'';
const STRIPE_PUBLISHABLE_KEY=process.env.STRIPE_PUBLISHABLE_KEY||'';

const PLAN_PRICE={
  Starter:process.env.STRIPE_STARTER_PRICE_ID||'price_1To98LF0BXlPng7V4YXh69Yc',
  Growth:process.env.STRIPE_GROWTH_PRICE_ID||'price_1To9D3F0BXlPng7VH3Ye2OzZ',
  Pro:process.env.STRIPE_PRO_PRICE_ID||'price_1To9G4F0BXlPng7VkvMGPE2Y'
};
const SETUP_PRICE=process.env.STRIPE_SETUP_PRICE_ID||'price_1To9HhF0BXlPng7V0OBFPmQR';
const ALLOWED_HOSTS=new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);

function allowedOrigin(req){
  const candidate=req.headers.origin||req.headers.referer||'';
  if(!candidate)return false;
  try{const host=new URL(candidate).host.toLowerCase(),requestHost=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();return ALLOWED_HOSTS.has(host)||(host.endsWith('.vercel.app')&&host===requestHost)}catch(_){return false}
}
function clean(v,n){return String(v||'').trim().slice(0,n)}
function checkoutOrigin(req){
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  const proto=String(req.headers['x-forwarded-proto']||'https').toLowerCase().split(',')[0].trim()==='http'?'http':'https';
  if(host==='callercore.com'||host==='www.callercore.com'||host.endsWith('.vercel.app')||host.startsWith('localhost'))return proto+'://'+host;
  return SITE_URL;
}
async function stripeRequest(path,{method='GET',body=null}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch('https://api.stripe.com'+path,{
      method,
      headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},
      body:body?body.toString():undefined,
      signal:controller.signal
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error?.message||'Stripe request failed');
    return data;
  }finally{clearTimeout(timer)}
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const origin=req.headers.origin||'';
  if(allowedOrigin(req)&&origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');

  if(req.method==='OPTIONS')return allowedOrigin(req)?res.status(200).end():res.status(403).end();
  if(!allowedOrigin(req))return res.status(403).json({error:'Forbidden'});
  if(!STRIPE_SECRET_KEY)return res.status(503).json({error:'Stripe checkout is not configured'});

  const rl=await rateLimit({scope:'embedded-checkout',identifier:requestIp(req),limit:req.method==='GET'?30:10,windowSeconds:600});
  if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({error:'Too many requests'})}

  if(req.method==='GET'){
    const sessionId=String((req.query||{}).session_id||'').trim();
    if(!/^cs_(?:live|test)_[A-Za-z0-9_]+$/.test(sessionId))return res.status(400).json({error:'Invalid session'});
    try{
      const session=await stripeRequest('/v1/checkout/sessions/'+encodeURIComponent(sessionId));
      return res.status(200).json({
        status:session.status||'',
        paymentStatus:session.payment_status||'',
        customerEmail:session.customer_details?.email||session.customer_email||''
      });
    }catch(err){
      console.error('Checkout status lookup failed',err&&err.message||err);
      return res.status(502).json({error:'Unable to verify checkout'});
    }
  }

  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!STRIPE_PUBLISHABLE_KEY)return res.status(503).json({error:'Embedded checkout is not configured'});

  const raw=req.body||{};
  const name=clean(raw.name,120),business=clean(raw.business,160),email=clean(raw.email,200).toLowerCase();
  const phone=clean(raw.phone,80),industry=clean(raw.industry,160),plan=clean(raw.plan,20);
  const visitorId=clean(raw.visitorId,120),sessionId=clean(raw.sessionId,120),utmSource=clean(raw.utmSource,120),utmMedium=clean(raw.utmMedium,120),utmCampaign=clean(raw.utmCampaign,160);

  if(!name||!business||!email||!phone||!industry||!PLAN_PRICE[plan])return res.status(400).json({error:'Please complete all required fields'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter a valid email address'});

  let prospect,leadId;
  try{
    prospect=await upsertWebsiteProspect({name,business,email,phone,industry,plan,source:'get_started',stage:'checkout_started',visitorId,sessionId,utmSource,utmMedium,utmCampaign});
    await recordSiteEvent({type:'checkout_start',visitorId,sessionId,path:'/get-started',label:plan,utmSource,utmMedium,utmCampaign},req);
    leadId=crypto.randomUUID();
    await kv.set('lead:'+leadId,{
      name,business,email,phone,industry,plan,prospectId:prospect.id,visitorId,sessionId,utmSource,utmMedium,utmCampaign,
      acquisition:{source:prospect.firstSource||prospect.source||'website',utmSource:prospect.firstUtmSource||prospect.utmSource||utmSource,utmMedium:prospect.firstUtmMedium||prospect.utmMedium||utmMedium,utmCampaign:prospect.firstUtmCampaign||prospect.utmCampaign||utmCampaign},
      createdAt:Date.now()
    },{ex:60*60*24*7});
  }catch(err){
    console.error('Embedded checkout lead pre-save failed',err&&err.message||err);
    return res.status(503).json({error:'Checkout is temporarily unavailable. Please try again shortly.'});
  }

  const params=new URLSearchParams();
  params.set('mode','subscription');
  params.set('ui_mode','embedded_page');
  params.set('return_url',checkoutOrigin(req)+'/checkout-complete?session_id={CHECKOUT_SESSION_ID}');
  params.set('redirect_on_completion','always');
  params.set('submit_type','subscribe');
  params.set('customer_email',email);
  params.set('client_reference_id',leadId);
  params.set('line_items[0][price]',PLAN_PRICE[plan]);
  params.set('line_items[0][quantity]','1');
  params.set('line_items[1][price]',SETUP_PRICE);
  params.set('line_items[1][quantity]','1');
  params.set('metadata[plan]',plan);
  params.set('metadata[lead_id]',leadId);
  params.set('metadata[prospect_id]',prospect.id);
  params.set('metadata[business]',business);
  params.set('subscription_data[metadata][plan]',plan);
  params.set('subscription_data[metadata][business]',business);
  params.set('billing_address_collection','auto');

  try{
    const session=await stripeRequest('/v1/checkout/sessions',{method:'POST',body:params});
    if(!session.client_secret)throw new Error('Stripe did not return a client secret');
    return res.status(200).json({clientSecret:session.client_secret,publishableKey:STRIPE_PUBLISHABLE_KEY});
  }catch(err){
    console.error('Embedded checkout session creation failed',err&&err.message||err);
    return res.status(502).json({error:'Unable to start secure checkout'});
  }
};
