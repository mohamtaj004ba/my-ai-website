const {recordSiteEvent}=require('../lib/site-analytics');
const {rateLimit,requestIp}=require('../lib/rate-limit');
const {safeError}=require('../lib/safe-log');
const ALLOWED_HOSTS=new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
function allowed(req){const c=req.headers.origin||req.headers.referer||'';if(!c)return false;try{const h=new URL(c).host.toLowerCase(),requestHost=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();return ALLOWED_HOSTS.has(h)||(h.endsWith('.vercel.app')&&h===requestHost)}catch(_){return false}}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS')return allowed(req)?res.status(200).end():res.status(403).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!allowed(req))return res.status(403).json({error:'Forbidden'});
  const rl=await rateLimit({scope:'site-track',identifier:requestIp(req),limit:120,windowSeconds:60});if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({error:'Rate limited'})}
  try{const event=await recordSiteEvent(req.body||{},req);return res.status(event?200:400).json(event?{ok:true}:{error:'Invalid event'})}
  catch(err){console.error('site tracking failed',safeError(err));return res.status(503).json({error:'Tracking unavailable'})}
};