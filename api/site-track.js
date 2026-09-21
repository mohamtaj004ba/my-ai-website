const {recordSiteEvent}=require('../lib/site-analytics');
const ALLOWED_HOSTS=new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
const hits=new Map();
function allowed(req){const c=req.headers.origin||req.headers.referer||'';if(!c)return false;try{const h=new URL(c).host;return ALLOWED_HOSTS.has(h)||h.endsWith('.vercel.app')}catch(_){return false}}
function rateLimited(ip){const now=Date.now(),e=hits.get(ip),windowMs=60*1000;if(!e||now-e.start>windowMs){hits.set(ip,{start:now,count:1});return false}e.count++;return e.count>120}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS')return allowed(req)?res.status(200).end():res.status(403).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!allowed(req))return res.status(403).json({error:'Forbidden'});
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  if(rateLimited(ip))return res.status(429).json({error:'Rate limited'});
  try{const event=await recordSiteEvent(req.body||{},req);return res.status(event?200:400).json(event?{ok:true}:{error:'Invalid event'})}
  catch(err){console.error('site tracking failed',err);return res.status(503).json({error:'Tracking unavailable'})}
};