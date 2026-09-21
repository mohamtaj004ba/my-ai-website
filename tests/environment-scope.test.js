const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const account=fs.readFileSync(path.join(root,'api','account.js'),'utf8');
const checkout=fs.readFileSync(path.join(root,'api','create-checkout-session.js'),'utf8');
const reveal=fs.readFileSync(path.join(root,'api','reveal-token.js'),'utf8');
const demo=fs.readFileSync(path.join(root,'api','demo-number.js'),'utf8');
const alert=fs.readFileSync(path.join(root,'api','vercel-alert-webhook.js'),'utf8');

test('preview bootstrap is host-restricted and secret-gated',()=>{
  assert.match(account,/host\.endsWith\('\.vercel\.app'\)/);
  assert.match(account,/CALLERCORE_BOOTSTRAP_SECRET/);
  assert.match(account,/x-bootstrap-secret/);
  assert.match(account,/return res\.status\(404\)\.json\(\{error:'Not found'\}\)/);
});

test('checkout remains explicit opt-in rather than fail-open',()=>{
  assert.match(checkout,/CALLERCORE_CHECKOUT_ENABLED/);
  assert.match(checkout,/!==\s*'true'/);
  assert.match(checkout,/checkout is not open yet/i);
});

test('demo and alert secrets have no hard-coded fallback',()=>{
  assert.match(reveal,/process\.env\.DEMO_TOKEN_SECRET/);
  assert.match(demo,/process\.env\.DEMO_TOKEN_SECRET/);
  assert.doesNotMatch(reveal,/DEMO_TOKEN_SECRET\s*\|\|\s*['"][^'"]+['"]/);
  assert.doesNotMatch(demo,/DEMO_TOKEN_SECRET\s*\|\|\s*['"][^'"]+['"]/);
  assert.match(alert,/process\.env\.VERCEL_ALERT_WEBHOOK_SECRET/);
});
