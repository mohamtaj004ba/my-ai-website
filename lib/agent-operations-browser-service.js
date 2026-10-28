'use strict';
// Dedicated-runtime boundary. Browser routing is defense in depth, not an OS firewall.
const crypto = require('node:crypto');
const net = require('node:net');
const dns = require('node:dns').promises;
const policy = require('./agent-operations-engineering-browser-policy');
let active = false;
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function isPublicAddress(address) {
  if (net.isIP(address) !== 4) return false; // IPv6 is deliberately unsupported, including mapped IPv4.
  const [a,b,c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 2))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}
function validateRequest(input) {
  if (!input || Object.keys(input).some(k => !['binding','url','taskId','executionId','viewport'].includes(k))) fail('BROWSER_REQUEST_FIELDS');
  if (!input.binding || Object.keys(input.binding).some(k => !['environment','branch','origin','sourceCommit'].includes(k))) fail('BROWSER_REQUEST_FIELDS');
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(input.taskId || '') || !/^[a-zA-Z0-9_-]{1,96}$/.test(input.executionId || '')) fail('BROWSER_TASK_BINDING');
  let scope;
  try { scope = policy.authorize(input.binding, input.url); } catch { fail('BROWSER_SCOPE_DENIED'); }
  const preset=input.viewport===undefined?'desktop':input.viewport;
  if(!['desktop','mobile'].includes(preset))fail('BROWSER_VIEWPORT_DENIED');
  const viewport=preset==='desktop'?{width:1280,height:900}:{width:390,height:844};
  return { ...scope, viewport, taskId: input.taskId, executionId: input.executionId, url: new URL(input.url).href };
}
async function authorizeNetworkRequest(scope, url, method, lookup = dns.lookup) {
  let u; try { u = new URL(url); } catch { fail('BROWSER_NETWORK_DENIED'); }
  if (method !== 'GET' || u.origin !== scope.origin || u.username || u.password || u.search || u.hash || u.protocol !== 'https:') fail('BROWSER_NETWORK_DENIED');
  // Paths containing API/auth/admin/customer state are denied even as subresources.
  if (/\/(?:api|admin|dashboard|auth|login|logout|customer)(?:\/|$)/i.test(u.pathname)) fail('BROWSER_NETWORK_DENIED');
  const records = await lookup(u.hostname, { all: true, verbatim: true });
  if (!Array.isArray(records) || records.length === 0 || records.some(r => !isPublicAddress(r.address))) fail('BROWSER_DNS_DENIED');
  return true;
}
async function capturePublicPreview(input, options = {}) {
  const scope = validateRequest(input);
  // Deployment operator must provide independently verified network enforcement.
  // No browser/OAuth/session/credential provisioning is performed here.
  if (options.egressIsolationVerified !== true || options.runtime !== 'dedicated-public-browser-v1') fail('BROWSER_INFRASTRUCTURE_UNVERIFIED');
  if (active) fail('BROWSER_CONCURRENCY_LIMIT');
  if (options.signal?.aborted) fail('BROWSER_CANCELLED');
  active = true;
  let browser, context, timer, abort, interruptClose, result, timedOut = false;
  const started = Date.now();
  let deadlineAt = started + 30000;
  const check = () => { if (options.signal?.aborted) fail('BROWSER_CANCELLED'); if (timedOut || Date.now() - started >= 30000) fail('BROWSER_TIMEOUT'); };
  const step = async pending => { let deadline; try { return await Promise.race([pending, new Promise((_, reject) => { deadline = setTimeout(() => { timedOut = true; abort?.(); const e = Error('BROWSER_TIMEOUT'); e.code = e.message; reject(e); }, Math.max(1, deadlineAt - Date.now())); })]); } finally { clearTimeout(deadline); } };
  const boundedClose = async fn => { let deadline; try { await Promise.race([fn(), new Promise((_, reject) => { deadline = setTimeout(() => reject(Error('cleanup timeout')), 2000); })]); return true; } catch { return false; } finally { clearTimeout(deadline); } };
  try {
    const playwright = options.playwright || require('playwright');
    browser = await playwright.chromium.launch({ headless: true, timeout: 10000 });
    deadlineAt = Math.min(deadlineAt, Date.now() + 20000);
    abort = () => { if (browser && !interruptClose) interruptClose = boundedClose(() => browser.close()); };
    check();
    options.signal?.addEventListener('abort', abort, { once: true });
    check();
    timer = setTimeout(() => { timedOut = true; abort(); }, Math.min(20000, 30000 - (Date.now() - started)));
    context = await step(browser.newContext({ viewport: scope.viewport, acceptDownloads: false, serviceWorkers: 'block', permissions: [], javaScriptEnabled: false }));
    let requests = 0;
    await step(context.route('**/*', async route => {
      try {
        if (++requests > 80 || options.signal?.aborted) fail('BROWSER_RESOURCE_LIMIT');
        await authorizeNetworkRequest(scope, route.request().url(), route.request().method(), options.lookup || dns.lookup);
        await route.continue();
      } catch { await route.abort('blockedbyclient').catch(() => {}); }
    }));
    check();
    const page = await step(context.newPage());
    const diagnostics = [];
    page.on('pageerror', () => { if (diagnostics.length < 20) diagnostics.push({ type: 'page-error' }); });
    page.on('requestfailed', () => { if (diagnostics.length < 20) diagnostics.push({ type: 'resource-failed' }); });
    check();
    const response = await step(page.goto(scope.url, { waitUntil: 'domcontentloaded', timeout: 15000 }));
    if (!response || response.status() !== 200 || page.url() !== scope.url) fail('BROWSER_TARGET_UNAVAILABLE');
    const content = await step(page.evaluate(() => ({ text: document.body.innerText.slice(0, 12000), elements: Array.from(document.querySelectorAll('h1,h2,h3,main img')).slice(0, 80).map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), x: r.x, y: r.y, width: r.width, height: r.height }; }) })));
    const png = await step(page.screenshot({ type: 'png', fullPage: false, timeout: 5000 }));
    check();
    if (png.length > 4 * 1024 * 1024) fail('BROWSER_RESOURCE_LIMIT');
    return (result = { version: 'public-browser-capture-v1', taskId: scope.taskId, executionId: scope.executionId, sourceCommit: scope.sourceCommit, origin: scope.origin, path: scope.path, viewport: scope.viewport, capturedAt: new Date().toISOString(), screenshotHash: crypto.createHash('sha256').update(png).digest('hex'), png, content, diagnostics, limitations: ['JavaScript disabled', 'Public unauthenticated pages only', 'Source binding supplied by trusted caller; remote release identity requires independent verification'] });
  } catch (error) {
    if (options.signal?.aborted) fail('BROWSER_CANCELLED');
    if (timedOut) fail('BROWSER_TIMEOUT');
    if (/^BROWSER_[A-Z_]+$/.test(error.code || '')) throw error;
    fail('BROWSER_CAPTURE_FAILED');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    const contextClosed = !context || await boundedClose(() => context.close());
    const browserClosed = !browser || (interruptClose ? await interruptClose : await boundedClose(() => browser.close()));
    // Quarantine this process after unconfirmed disposal; do not reuse capacity.
    active = !(contextClosed && browserClosed);
    if (active) { const error = new Error('BROWSER_CLEANUP_UNCONFIRMED'); error.code = error.message; error.cleanup = { contextClosed, browserClosed }; throw error; }
    if (result) result.cleanup = { contextClosed, browserClosed };
  }
}
module.exports = { validateRequest, authorizeNetworkRequest, isPublicAddress, capturePublicPreview };
