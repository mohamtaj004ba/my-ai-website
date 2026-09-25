module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  if(process.env.VERCEL_ENV!=='preview'||!host.endsWith('.vercel.app'))return res.status(404).send('Not found');
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>CallerCore Preview E2E Launcher</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0d10;color:#f5f7fa;margin:0;padding:32px}main{max-width:720px;margin:auto;background:#12161c;border:1px solid #2b313a;border-radius:18px;padding:28px}h1{margin-top:0}label{display:block;margin:18px 0 6px;color:#b9c2ce}input,select,button{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #38414c;background:#0d1117;color:#fff;font:inherit}button{margin-top:14px;background:#fff;color:#111;font-weight:700;cursor:pointer}button:disabled{opacity:.65;cursor:wait}button.secondary{background:#1a2028;color:#fff}.note{color:#98a4b3;line-height:1.5}.ok{color:#8ee59b}.err{color:#ff9d9d}pre{white-space:pre-wrap;background:#0a0d11;padding:14px;border-radius:10px;border:1px solid #252c35}
</style></head><body><main>
<h1>CallerCore Preview E2E Launcher</h1>
<p class="note">Preview only. Uses the isolated Preview KV store. The bootstrap secret stays in this browser session and is never displayed back by the page.</p>
<label>Preview bootstrap secret</label><input id="secret" type="password" autocomplete="off">
<label>Test email</label><input id="email" type="email" value="support@callercore.com">
<label>Business name</label><input id="business" value="Summit Heating & Air">
<label>Plan</label><select id="plan"><option>Growth</option><option>Starter</option><option selected>Pro</option></select>
<button id="create">1. Create disposable workspace</button>
<button class="secondary" id="seed">2. Load realistic 60-day business data</button>
<button class="secondary" id="clientLogin">3. Open client dashboard (QA session)</button>
<button class="secondary" id="adminLogin">4. Open admin dashboard (QA session)</button>
<button class="secondary" id="promote">5. Promote test user to admin (legacy)</button>
<button class="secondary" id="login">6. Send magic login link (fallback)</button>
<pre id="out">Ready.</pre>
<script src="/preview-e2e-client.js" defer></script></main></body></html>`);
};