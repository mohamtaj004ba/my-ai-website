const crypto=require('crypto');
const {kv}=require('@vercel/kv');

function clean(v,n=500){return String(v||'').trim().slice(0,n)}
function emailKey(email){return crypto.createHash('sha256').update(clean(email,200).toLowerCase()).digest('hex')}
async function recordSiteEvent(raw={},req=null){
  const allowed=new Set(['session_start','page_view','engagement','page_exit','cta_click','plan_select','form_start','form_submit','form_abandon','checkout_start','checkout_complete','contact_submit','chat_open','chat_message','chat_handoff']);
  const type=clean(raw.type,60);if(!allowed.has(type))return null;
  const now=Date.now(),event={
    id:crypto.randomUUID(),type,at:now,
    visitorId:clean(raw.visitorId,120),sessionId:clean(raw.sessionId,120),
    path:clean(raw.path,300)||'/',title:clean(raw.title,200),
    referrer:clean(raw.referrer,500),source:clean(raw.source,120),
    utmSource:clean(raw.utmSource,120),utmMedium:clean(raw.utmMedium,120),utmCampaign:clean(raw.utmCampaign,160),
    label:clean(raw.label,200),value:clean(raw.value,200),
    activeMs:Math.max(0,Math.min(Number(raw.activeMs||0),60*60*1000)),
    device:clean(raw.device,40)
  };
  if(req){
    event.country=clean(req.headers['x-vercel-ip-country'],10);
    event.region=clean(req.headers['x-vercel-ip-country-region'],80);
    event.city=clean(req.headers['x-vercel-ip-city'],120);
  }
  await kv.lpush('site:events',event);await kv.ltrim('site:events',0,4999);
  if(event.sessionId){
    const key='site:session:'+event.sessionId,old=await kv.get(key)||{};
    const pages=Array.isArray(old.pages)?old.pages:[];
    if(type==='page_view'&&event.path&&!pages.includes(event.path))pages.push(event.path);
    const session={...old,id:event.sessionId,visitorId:event.visitorId||old.visitorId||'',firstAt:old.firstAt||now,lastAt:now,
      referrer:old.referrer||event.referrer||'',source:old.source||event.source||'',utmSource:old.utmSource||event.utmSource||'',
      utmMedium:old.utmMedium||event.utmMedium||'',utmCampaign:old.utmCampaign||event.utmCampaign||'',device:old.device||event.device||'',
      country:old.country||event.country||'',region:old.region||event.region||'',city:old.city||event.city||'',
      activeMs:Number(old.activeMs||0)+(type==='engagement'||type==='page_exit'?event.activeMs:0),pages:pages.slice(-20),
      events:Number(old.events||0)+1};
    await kv.set(key,session,{ex:60*60*24*90});
    if(!old.firstAt){await kv.lpush('site:session:index',event.sessionId);await kv.ltrim('site:session:index',0,1999)}
  }
  return event;
}
async function upsertWebsiteProspect(raw={}){
  const email=clean(raw.email,200).toLowerCase(),now=Date.now();
  let id=clean(raw.id,100);
  if(!id&&email)id=await kv.get('site:prospect:email:'+emailKey(email));
  if(!id)id=crypto.randomUUID();
  const key='site:prospect:'+id,old=await kv.get(key)||{};
  const next={...old,id,
    name:clean(raw.name!==undefined?raw.name:old.name,120),
    business:clean(raw.business!==undefined?raw.business:old.business,160),
    email:email||old.email||'',phone:clean(raw.phone!==undefined?raw.phone:old.phone,80),
    industry:clean(raw.industry!==undefined?raw.industry:old.industry,160),
    category:clean(raw.category!==undefined?raw.category:old.category,100),
    message:clean(raw.message!==undefined?raw.message:old.message,4000),
    plan:clean(raw.plan!==undefined?raw.plan:old.plan,30),
    source:clean(raw.source!==undefined?raw.source:old.source,80)||'website',
    stage:clean(raw.stage!==undefined?raw.stage:old.stage,60)||'new',
    visitorId:clean(raw.visitorId!==undefined?raw.visitorId:old.visitorId,120),
    sessionId:clean(raw.sessionId!==undefined?raw.sessionId:old.sessionId,120),
    utmSource:clean(raw.utmSource!==undefined?raw.utmSource:old.utmSource,120),
    utmMedium:clean(raw.utmMedium!==undefined?raw.utmMedium:old.utmMedium,120),
    utmCampaign:clean(raw.utmCampaign!==undefined?raw.utmCampaign:old.utmCampaign,160),
    createdAt:old.createdAt||now,updatedAt:now};
  await kv.set(key,next);
  if(email)await kv.set('site:prospect:email:'+emailKey(email),id);
  if(!old.createdAt){await kv.lpush('site:prospect:index',id);await kv.ltrim('site:prospect:index',0,1999)}
  return next;
}
module.exports={recordSiteEvent,upsertWebsiteProspect};
