const crypto=require('crypto');
const { kv }=require('@vercel/kv');
const { sendMail } = require('./_lib/mailgun');
const {recordSiteEvent,upsertWebsiteProspect}=require('../lib/site-analytics');
const {rateLimit,requestIp}=require('../lib/rate-limit');

const ALLOWED_HOSTS = new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
function allowed(req){
  const c=req.headers.origin||req.headers.referer||'';
  if(!c)return false;
  try{const h=new URL(c).host.toLowerCase(),requestHost=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();return ALLOWED_HOSTS.has(h)||(h.endsWith('.vercel.app')&&h===requestHost)}catch(e){return false}
}
function clean(v,n=2000){return String(v||'').trim().slice(0,n)}
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!allowed(req))return res.status(403).json({error:'Forbidden'});
  const rl=await rateLimit({scope:'contact',identifier:requestIp(req),limit:5,windowSeconds:600});if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({error:'Too many requests. Please try again later.'})}

  const name=clean(req.body?.name,120),business=clean(req.body?.business,160),email=clean(req.body?.email,200),phone=clean(req.body?.phone,80),category=clean(req.body?.category,80),message=clean(req.body?.message,4000),visitorId=clean(req.body?.visitorId,120),sessionId=clean(req.body?.sessionId,120),utmSource=clean(req.body?.utmSource,120),utmMedium=clean(req.body?.utmMedium,120),utmCampaign=clean(req.body?.utmCampaign,160);
  if(!name||!email||!message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Please complete the required fields'});

  const text=['New CallerCore website inquiry','','Category: '+category,'Name: '+name,'Business: '+business,'Email: '+email,'Phone: '+phone,'','Message:',message].join('\n');
  try{
    const prospect=await upsertWebsiteProspect({name,business,email,phone,category,message,source:category==='Chatbot inquiry'?'chatbot':'contact',stage:'inquiry',visitorId,sessionId,utmSource,utmMedium,utmCampaign});
    const convKey='site:conversation:'+prospect.id,conversation=await kv.get(convKey)||[];
    conversation.push({id:crypto.randomUUID(),direction:'inbound',channel:category==='Chatbot inquiry'?'chatbot':'website',from:email,to:'support@callercore.com',subject:category||'Website inquiry',body:message,at:Date.now()});
    await kv.set(convKey,conversation.slice(-200));
    await recordSiteEvent({type:'contact_submit',visitorId,sessionId,path:'/contact',label:category||'General',utmSource,utmMedium,utmCampaign},req);
    await sendMail({
      to:'support@callercore.com',
      subject:'Website inquiry — '+(category||'General')+' — '+(business||name),
      text,
      html:'<p><b>New CallerCore website inquiry</b></p><p><b>Category:</b> '+escapeHtml(category)+'<br><b>Name:</b> '+escapeHtml(name)+'<br><b>Business:</b> '+escapeHtml(business)+'<br><b>Email:</b> '+escapeHtml(email)+'<br><b>Phone:</b> '+escapeHtml(phone)+'</p><p><b>Message</b><br>'+escapeHtml(message).replace(/\n/g,'<br>')+'</p>'
    });
    return res.status(200).json({ok:true,prospectId:prospect.id});
  }catch(e){
    console.error('contact send failed',e);
    return res.status(500).json({error:'Unable to send'});
  }
};