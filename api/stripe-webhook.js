const crypto = require('crypto');
const https = require('https');
const { kv } = require('@vercel/kv');

// Vercel needs the raw request body to verify the Stripe signature —
// disable the default JSON body parser for this route.
module.exports.config = { api: { bodyParser: false } };

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mail.callercore.com';
const SITE_URL = process.env.SITE_URL || 'https://www.callercore.com';

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map((p) => p.split('=').map((s) => s.trim()))
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== gotBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, gotBuf);
}

function sendMail({ to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64');
    const params = new URLSearchParams({
      from: 'CallerCore <support@callercore.com>',
      to,
      subject,
      text,
      html,
    }).toString();

    const options = {
      hostname: 'api.mailgun.net',
      path: `/v3/${MAILGUN_DOMAIN}/messages`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new Error(`Mailgun error ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await getRawBody(req);

  if (!verifyStripeSignature(rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody);

  if (event.type !== 'checkout.session.completed') {
    // Ignore everything else — this endpoint only cares about completed payments.
    return res.status(200).json({ received: true, ignored: true });
  }

  const session = event.data.object;
  const leadId = session.client_reference_id;
  const customerEmail = session.customer_details && session.customer_details.email;

  let lead = null;
  if (leadId) {
    lead = await kv.get(`lead:${leadId}`);
  }
  // Fallback: if the lead record expired or client_reference_id was missing,
  // still onboard them using whatever Stripe collected, so nobody who paid
  // falls through the cracks.
  if (!lead) {
    lead = {
      name: (session.customer_details && session.customer_details.name) || '',
      business: '',
      email: customerEmail || '',
      phone: (session.customer_details && session.customer_details.phone) || '',
      industry: '',
      plan: 'Growth',
    };
  }

  const token = crypto.randomBytes(24).toString('hex');

  await kv.set(
    `onboarding:${token}`,
    {
      ...lead,
      stripeSessionId: session.id,
      agreementSigned: false,
      agreementSignedAt: null,
      intake: {},
      status: 'awaiting_agreement',
      createdAt: Date.now(),
    },
    { ex: 60 * 60 * 24 * 30 } // 30-day link validity
  );

  const magicLink = `${SITE_URL}/onboarding?token=${token}`;
  const firstName = (lead.name || '').split(' ')[0] || 'there';

  try {
    await sendMail({
      to: lead.email || customerEmail,
      subject: 'Welcome to CallerCore — your setup link',
      text: `Hi ${firstName},\n\nWelcome to CallerCore — payment received.\n\nYour next steps: ${magicLink}\n\nSign your service agreement and fill out your intake form there. We start building your AI the moment your intake form comes in — most accounts go live within 1 business day of that.\n\nQuestions any time: support@callercore.com\n\n— Tj, CallerCore`,
      html: `<p>Hi ${firstName},</p><p>Welcome to CallerCore — payment received.</p><p><a href="${magicLink}">Click here for your next steps</a> — sign your service agreement and fill out your intake form. We start building your AI the moment your intake form comes in, and most accounts go live within 1 business day of that.</p><p>Questions any time: support@callercore.com</p><p>— Tj, CallerCore</p>`,
    });
  } catch (err) {
    console.error('Failed to send onboarding email:', err);
    // Don't fail the webhook over an email issue — Stripe will retry and
    // we'd send a duplicate. Log it; the record still exists in KV.
  }

  return res.status(200).json({ received: true });
};
