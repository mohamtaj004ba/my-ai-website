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
