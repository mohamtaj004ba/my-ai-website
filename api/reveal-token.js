const crypto = require('crypto');

// Fallback secret so this works out of the box; for stronger protection,
// set DEMO_TOKEN_SECRET as an env var in Vercel (Project Settings -> Environment Variables).
const SECRET = process.env.DEMO_TOKEN_SECRET || 'callercore-demo-reveal-secret-v1';

const ALLOWED_HOSTS=new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
const hits=new Map();
function sign(ts){return crypto.createHmac('sha256',SECRET).update(String(ts)).digest('hex')}
function allowed(req){
  const candidate=req.headers.origin||req.headers.referer||'';
  if(!candidate)return false;
  try{const host=new URL(candidate).host;return ALLOWED_HOSTS.has(host)||host.endsWith('.vercel.app')}catch(_){return false}
}
function limited(ip){
  const now=Date.now(),e=hits.get(ip),windowMs=10*60*1000;
  if(!e||now-e.start>windowMs){hits.set(ip,{start:now,count:1});return false}
  e.count++;return e.count>12;
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
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  if(limited(ip)) return res.status(429).json({error:'Too many requests'});
  const ts = Date.now();
  const sig = sign(ts);
  return res.status(200).json({ token: `${ts}.${sig}` });
};
