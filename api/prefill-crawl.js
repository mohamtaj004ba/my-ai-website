const https = require('https');
const http = require('http');
const { URL } = require('url');

// Fetches a business's own website and extracts ONLY the safe, factual,
// logistics-style fields — never anything from the emergency/urgency,
// escalation, routing, or pricing-policy sections of the intake form.
// Those stay manual, always, on purpose (see CallerCore ops manual).

const MAX_BYTES = 500 * 1000; // 500KB cap
const FETCH_TIMEOUT_MS = 8000;

function fetchPage(targetUrl, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error('invalid_url'));
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return reject(new Error('invalid_protocol'));
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(parsed, { timeout: FETCH_TIMEOUT_MS }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        const nextUrl = new URL(res.headers.location, parsed).toString();
        res.resume();
        return resolve(fetchPage(nextUrl, redirectsLeft - 1));
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`http_${res.statusCode}`));
      }
      let data = '';
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          req.destroy();
          return;
        }
        data += chunk;
      });
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

function callClaude(pageText) {
  const SYSTEM_PROMPT = `You extract ONLY facts explicitly stated in the provided website text. You never infer, guess, assume, or fill in a "typical" value for the industry. If a field is not clearly and explicitly stated in the text, its value must be null.

Extract these fields, and nothing else:
- businessName: the business's name, if stated
- phone: a business phone number, if stated (as written)
- address: the business's street address, if stated (full line: street, city, state, ZIP)
- servicesOffered: a short comma-separated list of services explicitly mentioned, or null
- serviceArea: cities/region explicitly mentioned as served, or null
- hours: business hours if explicitly stated, or null

Respond with ONLY a raw JSON object, no markdown fences, no commentary, in this exact shape:
{"businessName": null, "phone": null, "address": null, "servicesOffered": null, "serviceArea": null, "hours": null}`;

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Website text:\n\n${pageText}` }],
  });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  };

  return new Promise((resolve, reject) => {
    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', (c) => { data += c; });
      apiRes.on('end', () => {
        if (apiRes.statusCode !== 200) return reject(new Error(`anthropic_${apiRes.statusCode}`));
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content[0].text.trim()
            .replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
          resolve(JSON.parse(text));
        } catch (err) {
          reject(err);
        }
      });
    });
    apiReq.on('error', reject);
    apiReq.write(body);
    apiReq.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url' });
  }

  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const html = await fetchPage(normalized);
    const text = htmlToText(html);
    if (!text || text.length < 40) {
      return res.status(200).json({ ok: false, reason: 'no_content' });
    }
    const fields = await callClaude(text);
    return res.status(200).json({ ok: true, fields, source: normalized });
  } catch (err) {
    console.error('Crawl/prefill failed:', err.message);
    // Never a hard error to the client — the form just falls back to blank.
    return res.status(200).json({ ok: false, reason: 'crawl_failed' });
  }
};
