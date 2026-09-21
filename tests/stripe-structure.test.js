const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','api','stripe-webhook.js'),'utf8');

test('Stripe event idempotency key is declared before lifecycle branches',()=>{
  const declaration=src.indexOf("const eventKey=event.id?'stripe:event:'+event.id:null");
  const lifecycle=src.indexOf("if(lifecycleEvent)");
  const checkout=src.indexOf("const session=event.data.object");
  assert.ok(declaration>=0,'eventKey declaration missing');
  assert.ok(lifecycle>declaration,'lifecycle branch must come after eventKey declaration');
  assert.ok(checkout>declaration,'checkout branch must come after eventKey declaration');
});

test('Stripe webhook checks duplicate event ids before side effects',()=>{
  const declaration=src.indexOf("const eventKey=event.id?'stripe:event:'+event.id:null");
  const duplicate=src.indexOf("if(eventKey&&await kv.get(eventKey))",declaration);
  const lifecycle=src.indexOf("if(lifecycleEvent)");
  assert.ok(duplicate>declaration&&duplicate<lifecycle,'duplicate check must happen before lifecycle side effects');
});

test('Stripe webhook still verifies signatures before parsing events',()=>{
  const verify=src.indexOf("verifyStripeSignature");
  const parse=src.indexOf("JSON.parse(rawBody)");
  assert.ok(verify>=0&&parse>verify);
});

test('embedded checkout uses verified CallerCore prices and preserves lead tracking',()=>{
  const checkout=fs.readFileSync(path.join(__dirname,'..','api','create-checkout-session.js'),'utf8');
  assert.match(checkout,/price_1To98LF0BXlPng7V4YXh69Yc/);
  assert.match(checkout,/price_1To9D3F0BXlPng7VH3Ye2OzZ/);
  assert.match(checkout,/price_1To9G4F0BXlPng7VkvMGPE2Y/);
  assert.match(checkout,/price_1To9HhF0BXlPng7V0OBFPmQR/);
  assert.match(checkout,/params\.set\('ui_mode','embedded_page'\)/);
  assert.match(checkout,/params\.set\('client_reference_id',leadId\)/);
  assert.match(checkout,/upsertWebsiteProspect/);
  assert.match(checkout,/recordSiteEvent/);
});

test('Stripe webhook accepts embedded checkout plan metadata as well as legacy payment links',()=>{
  assert.match(src,/const metadataPlan=String\(session\.metadata\?\.plan\|\|''\)/);
  assert.match(src,/PLAN_BY_PAYMENT_LINK\[session\.payment_link\]\|\|\(\['Starter','Growth','Pro'\]\.includes\(metadataPlan\)\?metadataPlan:null\)/);
});

test('get-started mounts Stripe Embedded Checkout instead of redirecting to Payment Links',()=>{
  const page=fs.readFileSync(path.join(__dirname,'..','get-started.html'),'utf8');
  assert.match(page,/https:\/\/js\.stripe\.com\/v3\//);
  assert.match(page,/fetch\('\/api\/create-checkout-session'/);
  assert.match(page,/initEmbeddedCheckout/);
  assert.doesNotMatch(page,/buy\.stripe\.com/);
});

test('checkout completion page distinguishes confirmed and pending payments',()=>{
  const page=fs.readFileSync(path.join(__dirname,'..','checkout-complete.html'),'utf8');
  assert.match(page,/data\.status==='complete'&&\['paid','no_payment_required'\]\.includes\(data\.paymentStatus\)/);
  assert.match(page,/Your payment is processing\./);
  assert.match(page,/Do not submit another payment\./);
});

test('embedded checkout is closed unless the explicit sales launch flag is enabled',()=>{
  const checkout=fs.readFileSync(path.join(__dirname,'..','api','create-checkout-session.js'),'utf8');
  assert.match(checkout,/process\.env\.CALLERCORE_CHECKOUT_ENABLED!=='true'/);
  assert.match(checkout,/CallerCore checkout is not open yet/);
});
