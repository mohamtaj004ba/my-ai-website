const { kv } = require('@vercel/kv');
const { buildAgreementPdfBytes } = require('./_lib/agreement-pdf');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  const record = await kv.get(`onboarding:${token}`);
  if (!record || !record.agreementSigned) {
    return res.status(404).json({ error: 'not_found' });
  }

  const signedDate = record.agreementSignedAt
    ? new Date(record.agreementSignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const pdfBytes = await buildAgreementPdfBytes({
    business: record.business,
    fullName: record.agreementFullName,
    plan: record.plan,
    signedAt: signedDate,
  });

  const safeName = (record.business || 'CallerCore-Client').replace(/[^a-z0-9]+/gi, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="CallerCore-Service-Agreement-${safeName}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(Buffer.from(pdfBytes));
};
