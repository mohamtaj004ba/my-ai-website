const crypto = require('crypto');
const {rateLimit,requestIp}=require('../lib/rate-limit');

const SECRET = process.env.DEMO_TOKEN_SECRET || '';

const ALLOWED_HOSTS=new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
function sign(ts){return crypto.createHmac('sha256',SECRET).update(String(ts)).digest('hex')}
function allowed(req){
  const candidate=req.headers.origin||req.headers.referer||'';
  if(!candidate)return false;
  try{const host=new URL(candidate).host;return ALLOWED_HOSTS.has(host)||host.endsWith('.vercel.app')}catch(_){return false}
}
module.exports = async function handler(req, res) {
  const origin=req.headers.origin||'';
  if(allowed(req)&&origin) res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return allowed(req)?res.status(200).end():res.status(403).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if(!allowed(req)) return res.status(403).json({error:'Forbidden'});
  if(!SECRET)return res.status(503).json({error:'Demo unavailable'});
  const rl=await rateLimit({scope:'demo-reveal-token',identifier:requestIp(req),limit:12,windowSeconds:600});if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({error:'Too many requests'})}
  const ts = Date.now();
  const sig = sign(ts);
  return res.status(200).json({ token: `${ts}.${sig}` });
};
