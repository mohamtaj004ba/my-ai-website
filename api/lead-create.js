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

  const { name, business, email, phone, industry, plan } = req.body || {};
  if (!name || !business || !email || !plan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const leadId = crypto.randomUUID();

  await kv.set(
    `lead:${leadId}`,
    { name, business, email, phone, industry, plan, createdAt: Date.now() },
    { ex: 60 * 60 * 24 * 7 } // expires in 7 days if payment never completes
  );

  return res.status(200).json({ leadId });
};
