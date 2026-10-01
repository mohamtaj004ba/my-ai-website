const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const contact=fs.readFileSync('contact.html','utf8');
const checkout=fs.readFileSync('get-started.html','utf8');

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
  const mountAt=checkout.indexOf('stripe.initEmbeddedCheckout');
  assert.ok(verifyAt>=0&&mountAt>verifyAt);
});
