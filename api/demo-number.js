const crypto = require('crypto');

const SECRET = process.env.DEMO_TOKEN_SECRET || 'callercore-demo-reveal-secret-v1';

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

// Very small in-memory rate limiter. Resets on cold start, but adds real
// friction against a warm function instance being hammered.
const hits = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 6;

function sign(ts) {
  return crypto.createHmac('sha256', SECRET).update(String(ts)).digest('hex');
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const candidate = origin || referer;
  if (!candidate) return false;
  try {
    const host = new URL(candidate).host;
    return ALLOWED_HOSTS.has(host) || host.endsWith('.vercel.app');
  } catch (e) {
    return false;
  }
}

function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    hits.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Layer 1: origin/referer must be our own site.
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Layer 2: per-IP rate limit.
  const ip = getIp(req);
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests, try again later' });
  }

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
