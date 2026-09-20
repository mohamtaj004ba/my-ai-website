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
const PLAN_BY_PAYMENT_LINK = {
  'plink_1To9m8F0BXlPng7VihxbmKPJ': 'Starter',
  'plink_1To9pBF0BXlPng7VdkdBhHcx': 'Growth',
  'plink_1To9qJF0BXlPng7VXXwBIHHf': 'Pro',
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = sigHeader.split(',').map((p) => p.split('=').map((s) => s.trim()));
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([,v]) => v);
  if (!timestamp || !signatures.length) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  return signatures.some((sig) => {
    try {
      const gotBuf = Buffer.from(sig, 'hex');
      return expectedBuf.length === gotBuf.length && crypto.timingSafeEqual(expectedBuf, gotBuf);
    } catch (_) { return false; }
  });
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

  let event;
  try { event = JSON.parse(rawBody); }
  catch (_) { return res.status(400).json({ error: 'Invalid payload' }); }

  const checkoutEvent = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  if (!checkoutEvent) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const eventKey = event.id ? `stripe:event:${event.id}` : null;
  if (eventKey && await kv.get(eventKey)) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  const session = event.data.object;
  if (event.type === 'checkout.session.completed' && !['paid','no_payment_required'].includes(session.payment_status)) {
    return res.status(200).json({ received: true, pending_payment: true });
  }
  const paidPlan = PLAN_BY_PAYMENT_LINK[session.payment_link] || null;
  const sessionKey = session.id ? `stripe:session:${session.id}` : null;
  let sessionState = sessionKey ? await kv.get(sessionKey) : null;

  if (sessionState && sessionState.status === 'complete') {
    if (eventKey) await kv.set(eventKey, true, { ex: 60 * 60 * 24 * 90 });
    return res.status(200).json({ received: true, duplicate: true });
  }

  const leadId = session.client_reference_id;
  const customerEmail = session.customer_details && session.customer_details.email;
  let lead = null;
  let token = sessionState && sessionState.token ? sessionState.token : null;

  if (token) {
    lead = await kv.get(`onboarding:${token}`);
  }

  if (!lead) {
    if (leadId) lead = await kv.get(`lead:${leadId}`);
    if (!lead) {
      lead = {
        name: (session.customer_details && session.customer_details.name) || '',
        business: '',
        email: customerEmail || '',
        phone: (session.customer_details && session.customer_details.phone) || '',
        industry: '',
        plan: paidPlan || 'Unknown',
      };
    }

    if (paidPlan) lead.plan = paidPlan;
    token = crypto.randomBytes(24).toString('hex');

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
      { ex: 60 * 60 * 24 * 30 }
    );

    if (sessionKey) {
      await kv.set(sessionKey, { token, status: 'pending_email' }, { ex: 60 * 60 * 24 * 90 });
    }
  }

  const magicLink = `${SITE_URL}/onboarding?token=${token}`;
  const firstName = (lead.name || '').split(' ')[0] || 'there';
  const recipient = lead.email || customerEmail;

  if (!recipient) {
    console.error('Stripe checkout completed without a usable customer email', session.id);
    return res.status(500).json({ error: 'Missing customer email' });
  }

  try {
    await sendMail({
      to: recipient,
      subject: 'Welcome to CallerCore — your setup link',
      text: `Hi ${firstName},\n\nWelcome to CallerCore — payment received.\n\nYour next steps: ${magicLink}\n\nSign your service agreement and fill out your intake form there. We start building your AI the moment your intake form comes in — most accounts go live within 1 business day of that.\n\nQuestions any time: support@callercore.com\n\n— Tj, CallerCore`,
      html: `<p>Hi ${firstName},</p><p>Welcome to CallerCore — payment received.</p><p><a href="${magicLink}">Click here for your next steps</a> — sign your service agreement and fill out your intake form. We start building your AI the moment your intake form comes in, and most accounts go live within 1 business day of that.</p><p>Questions any time: support@callercore.com</p><p>— Tj, CallerCore</p>`,
    });
  } catch (err) {
    console.error('Failed to send onboarding email:', err);
    // Return 500 so Stripe retries the webhook. The session->token mapping
    // lets a retry reuse the same onboarding link instead of creating duplicates.
    return res.status(500).json({ error: 'Onboarding email failed' });
  }

  if (sessionKey) {
    await kv.set(sessionKey, { token, status: 'complete' }, { ex: 60 * 60 * 24 * 90 });
  }
  if (eventKey) {
    await kv.set(eventKey, true, { ex: 60 * 60 * 24 * 90 });
  }
  return res.status(200).json({ received: true });
};
