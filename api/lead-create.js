const {safeError}=require('../lib/safe-log');
const crypto = require('crypto');
const {kv}=require('../lib/kv');
const {recordSiteEvent,upsertWebsiteProspect}=require('../lib/site-analytics');
const {rateLimit,requestIp}=require('../lib/rate-limit');

// Called from get-started.html right before redirecting to Stripe.
// Stores the lead's form answers under a short-lived leadId so the Stripe
// webhook (which only gets client_reference_id back) can look them up once
// payment completes.

const ALLOWED_HOSTS = new Set([
  'callercore.com',
  'www.callercore.com',
  'localhost:3000',
  'localhost',
]);

function isAllowedOrigin(req) {
  const candidate = req.headers.origin || req.headers.referer || '';
  if (!candidate) return false;
  try {
    const host=new URL(candidate).host.toLowerCase();
    const requestHost=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
    return ALLOWED_HOSTS.has(host)||(host.endsWith('.vercel.app')&&host===requestHost);
  } catch (e) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  const origin=req.headers.origin||'';
  if(isAllowedOrigin(req)&&origin) res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return isAllowedOrigin(req)?res.status(200).end():res.status(403).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
  const rl=await rateLimit({scope:'lead-create',identifier:requestIp(req),limit:10,windowSeconds:600,failClosed:true});if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({error:'Too many requests'})}

  const raw = req.body || {};
  const clean = (v, n) => String(v || '').trim().slice(0, n);
  const name = clean(raw.name, 120);
  const business = clean(raw.business, 160);
  const email = clean(raw.email, 200);
  const phone = clean(raw.phone, 80);
  const industry = clean(raw.industry, 160);
  const plan = clean(raw.plan, 20);
  const visitorId=clean(raw.visitorId,120),sessionId=clean(raw.sessionId,120),utmSource=clean(raw.utmSource,120),utmMedium=clean(raw.utmMedium,120),utmCampaign=clean(raw.utmCampaign,160);
  const allowedPlans = new Set(['Starter','Growth','Pro']);

  if (!name || !business || !email || !phone || !industry || !allowedPlans.has(plan)) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const leadId = crypto.randomUUID();
  let prospect;
  try {
    prospect=await upsertWebsiteProspect({name,business,email,phone,industry,plan,source:'get_started',stage:'checkout_started',visitorId,sessionId,utmSource,utmMedium,utmCampaign});
    await kv.set(
      `lead:${leadId}`,
      { name, business, email, phone, industry, plan, prospectId:prospect.id, visitorId, sessionId, utmSource, utmMedium, utmCampaign, acquisition:{source:prospect.firstSource||prospect.source||'website',utmSource:prospect.firstUtmSource||prospect.utmSource||utmSource,utmMedium:prospect.firstUtmMedium||prospect.utmMedium||utmMedium,utmCampaign:prospect.firstUtmCampaign||prospect.utmCampaign||utmCampaign}, createdAt: Date.now() },
      { ex: 60 * 60 * 24 * 7 }
    );
    try{await recordSiteEvent({type:'checkout_start',visitorId,sessionId,path:'/get-started',label:plan,utmSource,utmMedium,utmCampaign},req)}
    catch(analyticsError){console.error('Lead pre-save analytics failed',safeError(analyticsError))}
    return res.status(200).json({ leadId, prospectId:prospect.id });
  } catch (err) {
    console.error('lead-create KV write failed:', safeError(err));
    return res.status(503).json({ error: 'Lead pre-save temporarily unavailable' });
  }
};
