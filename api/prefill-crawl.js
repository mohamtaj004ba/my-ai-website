const https = require('https');
const http = require('http');
const { URL } = require('url');
const dns = require('dns');
const net = require('net');

// Fetches a business's own website and extracts ONLY the safe, factual,
// logistics-style fields — never anything from the emergency/urgency,
// escalation, routing, or pricing-policy sections of the intake form.
// Those stay manual, always, on purpose (see CallerCore ops manual).

const MAX_BYTES = 500 * 1000; // 500KB cap
const FETCH_TIMEOUT_MS = 8000;
const ALLOWED_HOSTS = new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
const hits = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;

function isAllowedOrigin(req) {
  const candidate = req.headers.origin || req.headers.referer || '';
  if (!candidate) return false;
  try { const host = new URL(candidate).host; return ALLOWED_HOSTS.has(host) || host.endsWith('.vercel.app'); }
  catch (_) { return false; }
}
function getIp(req) {
  const fwd=req.headers['x-forwarded-for'];
  return fwd ? fwd.split(',')[0].trim() : (req.socket?.remoteAddress || 'unknown');
}
function rateLimited(ip) {
  const now=Date.now(), entry=hits.get(ip);
  if(!entry || now-entry.start>RATE_WINDOW_MS){hits.set(ip,{start:now,count:1});return false}
  entry.count+=1; return entry.count>RATE_MAX;
}
function isPrivateAddress(address) {
  if (!address) return true;
  if (net.isIPv4(address)) {
    const p=address.split('.').map(Number);
    return p[0]===10 || p[0]===127 || p[0]===0 || (p[0]===169&&p[1]===254) || (p[0]===172&&p[1]>=16&&p[1]<=31) || (p[0]===192&&p[1]===168) || (p[0]===100&&p[1]>=64&&p[1]<=127) || p[0]>=224;
  }
  const a=address.toLowerCase();
  return a==='::1' || a==='::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb') || a.startsWith('::ffff:127.') || a.startsWith('::ffff:10.') || a.startsWith('::ffff:192.168.');
}
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, {all:false,verbatim:true}, (err,address,family)=>{
    if(err) return callback(err);
    if(isPrivateAddress(address)) return callback(new Error('blocked_host'));
    callback(null,address,family);
  });
}
function validateTarget(parsed) {
  if (!['http:','https:'].includes(parsed.protocol)) throw new Error('invalid_protocol');
  const host=parsed.hostname.toLowerCase();
  if(host==='localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('blocked_host');
  if(net.isIP(host) && isPrivateAddress(host)) throw new Error('blocked_host');
  if(parsed.username || parsed.password) throw new Error('credentials_not_allowed');
  if(parsed.port && !['80','443'].includes(parsed.port)) throw new Error('blocked_port');
}

function fetchPage(targetUrl, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error('invalid_url'));
    }
    try { validateTarget(parsed); } catch (e) { return reject(e); }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(parsed, { timeout: FETCH_TIMEOUT_MS, lookup: safeLookup, headers: { 'User-Agent':'CallerCoreOnboarding/1.0', 'Accept':'text/html,text/plain;q=0.9' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        const nextUrl = new URL(res.headers.location, parsed).toString();
        res.resume();
        return resolve(fetchPage(nextUrl, redirectsLeft - 1));
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`http_${res.statusCode}`));
      }
      const contentType=String(res.headers['content-type']||'').toLowerCase();
      if(contentType && !contentType.includes('text/html') && !contentType.includes('text/plain')){
        res.resume();return reject(new Error('unsupported_content_type'));
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
  res.setHeader('Cache-Control', 'no-store');
  const origin=req.headers.origin||'';
  if (req.method === 'OPTIONS') {
    if(!isAllowedOrigin(req)) return res.status(403).end();
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if(!isAllowedOrigin(req)) return res.status(403).json({error:'Forbidden'});
  res.setHeader('Access-Control-Allow-Origin',origin);
  if(rateLimited(getIp(req))) return res.status(429).json({ok:false,reason:'rate_limited'});
  if(!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ok:false,reason:'assistant_unavailable'});

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url' });
  }

  if(url.length>500) return res.status(400).json({error:'URL too long'});
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
