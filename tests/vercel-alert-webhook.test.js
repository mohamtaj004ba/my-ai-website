const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const src=fs.readFileSync(path.join(__dirname,'..','api','vercel-alert-webhook.js'),'utf8');

test('Vercel alert webhook validates signed raw requests',()=>{
  assert.match(src,/bodyParser:false/);
  assert.match(src,/x-vercel-signature/);
  assert.match(src,/createHmac\('sha1'/);
  assert.match(src,/timingSafeEqual/);
});

test('Vercel alert webhook caps payloads and deduplicates alerts',()=>{
  assert.match(src,/MAX_BYTES=128\*1024/);
  assert.match(src,/Payload too large/);
  assert.match(src,/vercel:alert:/);
  assert.match(src,/duplicate:true/);
});

test('Vercel alert webhook sends internal alert email through CallerCore mail',()=>{
  assert.match(src,/CALLERCORE_ALERT_EMAIL/);
  assert.match(src,/support@callercore\.com/);
  assert.match(src,/\[CallerCore ALERT\]/);
  assert.match(src,/sendMail/);
});


test('production alert webhook records dedupe only after verified email delivery',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','api','vercel-alert-webhook.js'),'utf8');
  const sendAt=src.indexOf('await sendMail('),receiptWrite=src.indexOf('await kv.set(dedupeKey,true',sendAt);
  assert.ok(sendAt>=0&&receiptWrite>sendAt,'dedupe receipt must be written after sendMail succeeds');
  assert.match(src,/const confirmedReceipt=await kv\.get\(dedupeKey\)/);
  assert.match(src,/Alert delivery succeeded but its receipt could not be confirmed/);
  const failureAt=src.indexOf("return res.status(502).json({error:'Alert delivery failed'})");
  assert.ok(failureAt>=0&&failureAt<receiptWrite,'failed delivery must not be marked delivered');
});
