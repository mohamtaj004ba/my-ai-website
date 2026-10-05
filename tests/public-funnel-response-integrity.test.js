const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const contact=fs.readFileSync('contact.html','utf8');
const checkout=fs.readFileSync('get-started.html','utf8');
const complete=fs.readFileSync('checkout-complete.html','utf8');
const live=fs.readFileSync('live-demo.html','utf8');
const demoApi=fs.readFileSync('api/demo-number.js','utf8');
const chat=fs.readFileSync('chat-widget.js','utf8');

test('public contact form only shows success after a canonical saved-inquiry acknowledgement',()=>{
  assert.match(contact,/const body=await r\.json\(\)\.catch\(\(\)=>null\)/);
  assert.match(contact,/body\.ok!==true/);
  assert.match(contact,/!String\(body\.prospectId\|\|''\)/);
  assert.match(contact,/saved inquiry receipt/);
});

test('public embedded checkout validates publishable key and client secret before mounting Stripe',()=>{
  assert.match(checkout,/const data=await sessionResponse\.json\(\)\.catch\(\(\)=>null\)/);
  assert.match(checkout,/\^pk_\(\?:live\|test\)_\[A-Za-z0-9_\]\+\$/);
  assert.match(checkout,/\^cs_\(\?:live\|test\)_\[A-Za-z0-9_\]\+_secret_\[A-Za-z0-9_\]\+\$/);
  assert.match(checkout,/Secure checkout response could not be verified/);
  const verifyAt=checkout.indexOf('Secure checkout response could not be verified');
  const mountAt=checkout.indexOf('stripe.initCheckoutElementsSdk');
  assert.ok(verifyAt>=0&&mountAt>verifyAt);
});


test('checkout completion requires canonical payment and persisted onboarding',()=>{
  assert.match(complete,/typeof data.paid!=='boolean'/);
  assert.match(complete,/typeof data.onboarding!=='boolean'/);
  assert.match(complete,/if\(data.paid&&data.onboarding\)/);
  assert.match(complete,/receipt=\w*/);
  assert.doesNotMatch(complete,/session_id/);
});


test('live demo verifies signed token and phone response shape before revealing a callable number',()=>{
  assert.match(live,/\^\\d\{13\}\\\.\[a-f0-9\]\{64\}\$\/i\.test\(String\(data\.token\|\|''\)\)/);
  assert.match(live,/\^\\\+\[1-9\]\\d\{7,14\}\$\/\.test\(String\(d\.number\|\|''\)\)/);
  assert.match(demoApi,/\^\\\+\[1-9\]\\d\{7,14\}\$\/\.test\(String\(DEMO_NUMBER_E164\|\|''\)\)/);
  assert.match(demoApi,/DEMO_NUMBER_DISPLAY\)\.length>40/);
});


test('public chat requires verified assistant text and a canonical handoff receipt',()=>{
  assert.match(chat,/data=await r\.json\(\)\.catch\(\(\)=>null\),reply=String/);
  assert.match(chat,/if\(!reply\)throw new Error\('chat'\)/);
  assert.match(chat,/data\.ok!==true\|\|!String\(data\.prospectId\|\|''\)/);
  assert.match(chat,/Could not verify that your message was saved/);
});
