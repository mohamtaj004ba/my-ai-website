const https = require('https');
const crypto = require('crypto');
const { kv } = require('@vercel/kv');

const SITE_URL = process.env.SITE_URL || 'https://www.callercore.com';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

const PLAN_PRICE = {
  Starter: 'price_1To98LF0BXlPng7V4YXh69Yc',
  Growth: 'price_1To9D3F0BXlPng7VH3Ye2OzZ',
  Pro: 'price_1To9G4F0BXlPng7VkvMGPE2Y',
};
const SETUP_PRICE = 'price_1To9HhF0BXlPng7V0OBFPmQR';

const ALLOWED_HOSTS = new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
const hits = new Map();

function isAllowedOrigin(req){
  const candidate=req.headers.origin||req.headers.referer||'';
  if(!candidate) return false;
  try{
    const host=new URL(candidate).host;
    return ALLOWED_HOSTS.has(host)||host.endsWith('.vercel.app');
  }catch(_){ return false; }
}
function rateLimited(ip){
  const now=Date.now(),entry=hits.get(ip),windowMs=10*60*1000;
  if(!entry||now-entry.start>windowMs){hits.set(ip,{start:now,count:1});return false}
  entry.count+=1;
  return entry.count>12;
}
function clean(v,n){ return String(v||'').trim().slice(0,n); }

function stripePost(path, params){
  return new Promise((resolve,reject)=>{
    const body=params.toString();
    const req=https.request({
      hostname:'api.stripe.com',
      path,
      method:'POST',
      headers:{
        'Authorization':`Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type':'application/x-www-form-urlencoded',
        'Content-Length':Buffer.byteLength(body)
      }
    },res=>{
      let data='';
      res.on('data',chunk=>{data+=chunk});
      res.on('end',()=>{
        let parsed;
        try{parsed=JSON.parse(data)}catch(_){return reject(new Error('Invalid Stripe response'))}
        if(res.statusCode<200||res.statusCode>=300){
          const err=new Error(parsed.error?.message||'Stripe request failed');
          err.status=res.statusCode; err.code=parsed.error?.code;
          return reject(err);
        }
        resolve(parsed);
      });
    });
    req.on('error',reject);
    req.setTimeout(12000,()=>req.destroy(new Error('Stripe request timed out')));
    req.write(body);
    req.end();
  });
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const origin=req.headers.origin||'';
  if(isAllowedOrigin(req)&&origin) res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');

  if(req.method==='OPTIONS') return isAllowedOrigin(req)?res.status(200).end():res.status(403).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if(!isAllowedOrigin(req)) return res.status(403).json({error:'Forbidden'});
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  if(rateLimited(ip)) return res.status(429).json({error:'Too many requests'});
  if(!STRIPE_SECRET_KEY||!STRIPE_PUBLISHABLE_KEY) return res.status(503).json({error:'Embedded checkout is not configured yet'});

  const raw=req.body||{};
  const name=clean(raw.name,120);
  const business=clean(raw.business,160);
  const email=clean(raw.email,200);
  const phone=clean(raw.phone,80);
  const industry=clean(raw.industry,160);
  const plan=clean(raw.plan,20);

  if(!name||!business||!email||!phone||!industry||!PLAN_PRICE[plan]) return res.status(400).json({error:'Please complete all required fields'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Enter a valid email address'});

  const leadId=crypto.randomUUID();
  try{
    await kv.set(`lead:${leadId}`,{name,business,email,phone,industry,plan,createdAt:Date.now()},{ex:60*60*24*7});
  }catch(err){
    console.error('Embedded checkout lead pre-save failed:',err);
  }

  const params=new URLSearchParams();
  params.set('mode','subscription');
  params.set('ui_mode','embedded_page');
  params.set('return_url',`${SITE_URL}/checkout-complete?session_id={CHECKOUT_SESSION_ID}`);
  params.set('redirect_on_completion','always');
  params.set('submit_type','subscribe');
  params.set('customer_email',email);
  params.set('client_reference_id',leadId);
  params.set('line_items[0][price]',PLAN_PRICE[plan]);
  params.set('line_items[0][quantity]','1');
  params.set('line_items[1][price]',SETUP_PRICE);
  params.set('line_items[1][quantity]','1');
  params.set('metadata[plan]',plan);
  params.set('metadata[name]',name);
  params.set('metadata[business]',business);
  params.set('metadata[phone]',phone);
  params.set('metadata[industry]',industry);
  params.set('subscription_data[metadata][plan]',plan);
  params.set('subscription_data[metadata][business]',business);
  params.set('billing_address_collection','auto');

  try{
    const session=await stripePost('/v1/checkout/sessions',params);
    if(!session.client_secret) throw new Error('Stripe did not return a client secret');
    return res.status(200).json({clientSecret:session.client_secret,publishableKey:STRIPE_PUBLISHABLE_KEY});
  }catch(err){
    console.error('Embedded checkout session creation failed:',err);
    return res.status(502).json({error:'Unable to start secure checkout'});
  }
};