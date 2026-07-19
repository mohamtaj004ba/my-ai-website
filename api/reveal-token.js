const crypto = require('crypto');

// Fallback secret so this works out of the box; for stronger protection,
// set DEMO_TOKEN_SECRET as an env var in Vercel (Project Settings -> Environment Variables).
const SECRET = process.env.DEMO_TOKEN_SECRET || 'callercore-demo-reveal-secret-v1';

function sign(ts) {
  return crypto.createHmac('sha256', SECRET).update(String(ts)).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ts = Date.now();
  const sig = sign(ts);
  return res.status(200).json({ token: `${ts}.${sig}` });
};
