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

  // Token holders only receive fields required by onboarding.html.
  // Keep this as an explicit allowlist so internal provisioning, Stripe,
  // workspace, attribution, and diagnostic fields can never leak by accident.
  const storedSnapshot=record.agreementSnapshot;
  const agreement = record.agreementSigned
    ? (storedSnapshot || {version:record.agreementVersion||LEGACY_AGREEMENT_VERSION,effectiveDate:record.agreementEffectiveDate||'',clauses:LEGACY_CLAUSES})
    : agreementSnapshot();
  return res.status(200).json({
    business:String(record.business||'').slice(0,160),
    plan:String(record.plan||'').slice(0,40),
    status:String(record.status||'').slice(0,60),
    agreementSigned:!!record.agreementSigned,
    intake:record.intake&&typeof record.intake==='object'?record.intake:{},
    agreement,
    planSnapshot:record.agreementPlanSnapshot||planSnapshot(record.plan)
  });
};
