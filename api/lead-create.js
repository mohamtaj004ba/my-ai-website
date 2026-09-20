const crypto = require('crypto');
const { kv } = require('@vercel/kv');

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
    const host = new URL(candidate).host;
    return ALLOWED_HOSTS.has(host) || host.endsWith('.vercel.app');
  } catch (e) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const raw = req.body || {};
  const clean = (v, n) => String(v || '').trim().slice(0, n);
  const name = clean(raw.name, 120);
  const business = clean(raw.business, 160);
  const email = clean(raw.email, 200);
  const phone = clean(raw.phone, 80);
  const industry = clean(raw.industry, 160);
  const plan = clean(raw.plan, 20);
  const allowedPlans = new Set(['Starter','Growth','Pro']);

  if (!name || !business || !email || !allowedPlans.has(plan)) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const leadId = crypto.randomUUID();

  await kv.set(
    `lead:${leadId}`,
    { name, business, email, phone, industry, plan, createdAt: Date.now() },
    { ex: 60 * 60 * 24 * 7 } // expires in 7 days if payment never completes
  );

  return res.status(200).json({ leadId });
};
