const { kv } = require('@vercel/kv');
const https = require('https');
const { buildAgreementPdfBytes } = require('./_lib/agreement-pdf');
const { sendMail } = require('./_lib/mailgun');

// Fires when a client's intake form is complete, so Tj knows the build clock
// has started. Same webhook the website forms already POST to.
const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || '';

function notifyGHL(payload) {
  return new Promise((resolve, reject) => {
    if (!GHL_WEBHOOK_URL) return resolve(null);
    let url;
    try { url = new URL(GHL_WEBHOOK_URL); } catch (e) { return resolve(null); }
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('ghl_timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Handles two kinds of saves from the onboarding page:
//   { token, type: 'intake', fields: {...} }        -> merges into intake progress
//   { token, type: 'agreement', fullName: '...' }   -> records agreement signature
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, type, fields, fullName } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  const key = `onboarding:${token}`;
  const record = await kv.get(key);
  if (!record) return res.status(404).json({ error: 'not_found' });

  if (type === 'agreement') {
    if (!fullName || typeof fullName !== 'string') {
      return res.status(400).json({ error: 'Missing fullName' });
    }
    record.agreementSigned = true;
    record.agreementSignedAt = Date.now();
    record.agreementFullName = fullName;

    await kv.set(key, record, { ex: 60 * 60 * 24 * 30 });

    // Email a signed copy. Don't fail the request if this errors — the
    // client can still download the PDF on demand from /api/agreement-pdf.
    try {
      const signedDate = new Date(record.agreementSignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const pdfBytes = await buildAgreementPdfBytes({
        business: record.business, fullName, plan: record.plan, signedAt: signedDate,
      });
      await sendMail({
        to: record.email,
        subject: 'Your signed CallerCore service agreement',
        text: `Hi ${(fullName || '').split(' ')[0] || 'there'},\n\nAttached is your signed CallerCore service agreement for your records.\n\nQuestions any time: support@callercore.com\n\n\u2014 CallerCore`,
        html: `<p>Attached is your signed CallerCore service agreement for your records.</p><p>Questions any time: support@callercore.com</p>`,
        attachments: [{ filename: 'CallerCore-Service-Agreement.pdf', data: Buffer.from(pdfBytes), contentType: 'application/pdf' }],
      });
    } catch (err) {
      console.error('Failed to email signed agreement PDF:', err);
    }

    return res.status(200).json({ ok: true, status: record.status });
  } else if (type === 'intake') {
    record.intake = { ...(record.intake || {}), ...(fields || {}) };
    // If every required intake field is present, mark it submitted and
    // flip status so your GHL/notification workflow can pick it up.
    // Mirrors the conditional logic in onboarding.html's requiredFieldsForStep().
    const required = [
      'businessName', 'contactName', 'phone', 'email', 'industry', 'address', 'addressSharing', 'serviceArea', 'outOfArea',
      'servicesOffered', 'servicesNotOffered', 'hours',
      'exampleRoutine', 'promiseRoutine',
      'exampleUrgent', 'promiseUrgent',
      'exampleEmergency', 'promiseEmergency',
      'routingChoice', 'callHandling', 'notificationPreference', 'notifyRecipient',
      'escalationName', 'escalationPhone',
      'pricingPolicy',
    ];
    if (record.intake.notifyRecipient === 'Someone else on my team' || record.intake.notifyRecipient === 'Me and someone else') {
      required.push('notifyOtherName', 'notifyOtherTitle', 'notifyOtherPhone', 'notifyOtherEmail');
    }
    if (record.intake.industry === 'Other') {
      required.push('industryOther');
    }
    if (record.intake.outOfArea === 'Refer them elsewhere (tell us who below)') {
      required.push('outOfAreaReferral');
    }
    if (record.intake.industry === 'Trades & Construction (plumbing, HVAC, electrical, construction, roofing, etc.)') {
      required.push('tradeType');
      if (record.intake.tradeType === 'Plumbing' || record.intake.tradeType === 'HVAC') {
        required.push('gasUtility');
      }
      if (record.intake.tradeType === 'Other trade') {
        required.push('tradeTypeOther');
      }
    }
    if (record.intake.routingChoice === 'Forward existing number') {
      required.push('forwardNumber');
    }
    if (record.intake.pricingPolicy === 'Yes, give price ranges') {
      required.push('pricingRanges');
    }
    const complete = required.every((k) => record.intake[k] && String(record.intake[k]).trim() !== '');
    const justCompleted = complete && record.status !== 'intake_complete';
    if (justCompleted) {
      record.status = 'intake_complete';
      record.intakeCompletedAt = Date.now();
    }

    await kv.set(key, record, { ex: 60 * 60 * 24 * 30 });

    if (justCompleted) {
      const i = record.intake || {};
      const trade = i.tradeType ? `${i.industry} / ${i.tradeType}` : i.industry;

      // 1) Push into GHL so the contact is updated and any workflow can trigger.
      try {
        await notifyGHL({
          source: 'onboarding_intake_complete',
          event: 'intake_complete',
          first_name: (i.contactName || record.name || '').split(' ')[0] || '',
          full_name: i.contactName || record.name || '',
          business_name: i.businessName || record.business || '',
          phone: i.phone || record.phone || '',
          email: i.email || record.email || '',
          address: i.address || '',
          plan: record.plan || '',
          industry: trade || '',
          service_area: i.serviceArea || '',
          hours: i.hours || '',
          call_handling: i.callHandling || '',
          routing_choice: i.routingChoice || '',
          forward_number: i.forwardNumber || '',
          phone_carrier: i.phoneCarrier || '',
          escalation_name: i.escalationName || '',
          escalation_phone: i.escalationPhone || '',
          notify_recipient: i.notifyRecipient || '',
          emergency_example: i.exampleEmergency || '',
          emergency_promise: i.promiseEmergency || '',
          agreement_signed_at: record.agreementSignedAt
            ? new Date(record.agreementSignedAt).toISOString() : '',
          intake_completed_at: new Date(record.intakeCompletedAt).toISOString(),
        });
      } catch (err) {
        console.error('GHL intake_complete notify failed:', err);
      }

      // 2) Direct email to Tj, so a GHL workflow misfire never means a silent miss.
      try {
        const lines = [
          `Business: ${i.businessName || record.business || '-'}`,
          `Contact: ${i.contactName || '-'} · ${i.phone || '-'} · ${i.email || '-'}`,
          `Plan: ${record.plan || '-'}`,
          `Industry: ${trade || '-'}`,
          `Service area: ${i.serviceArea || '-'}`,
          `Hours: ${i.hours || '-'}`,
          `Routing: ${i.routingChoice || '-'}${i.forwardNumber ? ' (' + i.forwardNumber + ')' : ''}`,
          `Carrier: ${i.phoneCarrier || 'not given'}`,
          `AI answers: ${i.callHandling || '-'}`,
          `Escalation: ${i.escalationName || '-'} · ${i.escalationPhone || '-'}`,
          `Emergency example: ${i.exampleEmergency || '-'} → ${i.promiseEmergency || '-'}`,
        ];
        await sendMail({
          to: 'tj@callercore.com',
          subject: `Intake complete — ${i.businessName || record.business || 'new client'} (build clock started)`,
          text: `Intake form submitted. The 1-business-day build clock starts now.\n\n${lines.join('\n')}\n\n— CallerCore onboarding`,
          html: `<p><b>Intake form submitted.</b> The 1-business-day build clock starts now.</p><p>${lines.join('<br>')}</p>`,
        });
      } catch (err) {
        console.error('Internal intake_complete email failed:', err);
      }
    }

    return res.status(200).json({ ok: true, status: record.status });
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }
};
