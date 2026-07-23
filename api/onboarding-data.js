const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  const record = await kv.get(`onboarding:${token}`);
  if (!record) {
    return res.status(404).json({ error: 'not_found' });
  }

  // Never leak internal fields (stripe session id) to the client.
  const { stripeSessionId, ...safe } = record;
  return res.status(200).json(safe);
};
