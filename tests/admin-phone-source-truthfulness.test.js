const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('phone save validates target and previous routing sources before atomic mutation',()=>{
  const start=api.indexOf('async function adminSavePhoneNumber('),end=api.indexOf('\nasync function adminDeletePhoneNumber(',start),block=api.slice(start,end);
  assert.match(block,/Target workspace record is unavailable/);
  assert.match(block,/Target routing sources are unavailable/);
  assert.match(block,/Previous workspace routing sources are unavailable/);
  assert.ok(block.indexOf('Target routing sources are unavailable')<block.indexOf("const item="));
});
test('phone delete refuses partial cleanup when assigned workspace or onboarding sources cannot be verified',()=>{
  const start=api.indexOf('async function adminDeletePhoneNumber('),end=api.indexOf('\nasync function adminFleet(',start),block=api.slice(start,end);
  assert.match(block,/Assigned workspace record is unavailable/);
  assert.match(block,/Assigned onboarding record is unavailable/);
  assert.ok(block.indexOf('Assigned workspace record is unavailable')<block.indexOf("const updates="));
});
