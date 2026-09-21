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
