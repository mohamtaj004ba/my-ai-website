const {kv}=require('../lib/kv');
const {rateLimit,requestIp}=require('../lib/rate-limit');
const { buildAgreementPdfBytes } = require('./_lib/agreement-pdf');
const { LEGACY_CLAUSES, LEGACY_AGREEMENT_VERSION } = require('./_lib/agreement-clauses');

function validToken(token){return typeof token==='string'&&/^[a-f0-9]{48}$/i.test(token)}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!validToken(token)) return res.status(400).json({ error: 'Invalid token' });
  const rl=await rateLimit({scope:'agreement-pdf',identifier:requestIp(req),limit:20,windowSeconds:600,failClosed:true});
  if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({error:'Too many download attempts. Try again shortly.'})}

  const record = await kv.get(`onboarding:${token}`);
  if (!record || !record.agreementSigned) {
    return res.status(404).json({ error: 'not_found' });
  }

  const signedDate = record.agreementSignedAt
    ? new Date(record.agreementSignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const snap=record.agreementSnapshot||{version:record.agreementVersion||LEGACY_AGREEMENT_VERSION,effectiveDate:record.agreementEffectiveDate||'',clauses:LEGACY_CLAUSES};
  const pdfBytes = await buildAgreementPdfBytes({
    business: record.business,
    fullName: record.agreementFullName,
    plan: record.plan,
    signedAt: signedDate,
    clauses: snap.clauses,
    agreementVersion: snap.version,
    effectiveDate: snap.effectiveDate,
    planSnapshot: record.agreementPlanSnapshot||null,
  });

  const safeName = (record.business || 'CallerCore-Client').replace(/[^a-z0-9]+/gi, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="CallerCore-Service-Agreement-${safeName}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(Buffer.from(pdfBytes));
};
