const crypto = require('crypto');
const {rateLimit,requestIp}=require('../lib/rate-limit');

const SECRET = process.env.DEMO_TOKEN_SECRET || '';

// The actual demo line. Kept server-side only — never shipped in the HTML/JS bundle.
// Optionally override via Vercel env var DEMO_PHONE_NUMBER (E.164, e.g. +15098907757).
const DEMO_NUMBER_E164 = process.env.DEMO_PHONE_NUMBER || '+15098907757';
const DEMO_NUMBER_DISPLAY = process.env.DEMO_PHONE_NUMBER_DISPLAY || '(509) 890-7757';

const ALLOWED_HOSTS = new Set([
  'callercore.com',
  'www.callercore.com',
  'localhost:3000',
  'localhost',
]);

// Minimum age of a token before it can be redeemed. A real visitor loads the
// page, and the button click always happens at least this long after the
// token was issued. A bot that fetches the token then immediately hits this
// endpoint gets rejected.
const MIN_TOKEN_AGE_MS = 1000;
const MAX_TOKEN_AGE_MS = 5 * 60 * 1000; // 5 minutes

function sign(ts) {
  return crypto.createHmac('sha256', SECRET).update(String(ts)).digest('hex');
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const candidate = origin || referer;
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

  if (req.method === 'OPTIONS') {
    return isAllowedOrigin(req)?res.status(200).end():res.status(403).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Layer 1: origin/referer must be our own site.
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if(!SECRET)return res.status(503).json({error:'Demo unavailable'});

  // Layer 2: per-IP distributed rate limit.
  const rl=await rateLimit({scope:'demo-number',identifier:requestIp(req),limit:6,windowSeconds:600,failClosed:true});
  if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({ error: 'Too many requests, try again later' })}

  // Layer 3: token must be valid, correctly signed, and aged appropriately.
  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const [tsStr, sig] = token.split('.');
  const ts = Number(tsStr);
  if (!ts || !sig) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const expectedSig = sign(ts);
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  const age = Date.now() - ts;
  if (age < MIN_TOKEN_AGE_MS || age > MAX_TOKEN_AGE_MS) {
    return res.status(403).json({ error: 'Token expired, refresh the page and try again' });
  }

  return res.status(200).json({
    number: DEMO_NUMBER_E164,
    display: DEMO_NUMBER_DISPLAY
  });
};
