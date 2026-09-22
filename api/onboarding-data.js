const {kv}=require('../lib/kv');
const { agreementSnapshot, planSnapshot, LEGACY_CLAUSES, LEGACY_AGREEMENT_VERSION } = require('./_lib/agreement-clauses');

function validToken(token){return typeof token==='string'&&/^[a-f0-9]{48}$/i.test(token)}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!validToken(token)) return res.status(400).json({ error: 'Invalid token' });

  const record = await kv.get(`onboarding:${token}`);
  if (!record) {
    return res.status(404).json({ error: 'not_found' });
  }

  // Never leak internal fields (stripe session id) to the client.
  const { stripeSessionId, agreementSnapshot:storedSnapshot, ...safe } = record;
  const agreement = record.agreementSigned
    ? (storedSnapshot || {version:record.agreementVersion||LEGACY_AGREEMENT_VERSION,effectiveDate:record.agreementEffectiveDate||'',clauses:LEGACY_CLAUSES})
    : agreementSnapshot();
  return res.status(200).json({...safe,agreement,planSnapshot:record.agreementPlanSnapshot||planSnapshot(record.plan)});
};
