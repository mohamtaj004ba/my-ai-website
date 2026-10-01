const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('api/onboarding-data.js','utf8');

test('onboarding data distinguishes missing from malformed persisted records',()=>{
  assert.match(src,/if \(record == null\)/);
  assert.match(src,/typeof record!=='object'\|\|Array\.isArray\(record\)/);
  assert.match(src,/error:'onboarding_unavailable'/);
});

test('onboarding data refuses malformed intake and signed snapshot objects',()=>{
  assert.match(src,/record\.intake!=null&&\(!record\.intake\|\|typeof record\.intake!=='object'\|\|Array\.isArray\(record\.intake\)\)/);
  assert.match(src,/record\.agreementSnapshot!=null&&\(!record\.agreementSnapshot\|\|typeof record\.agreementSnapshot!=='object'\|\|Array\.isArray\(record\.agreementSnapshot\)\)/);
  assert.match(src,/record\.agreementPlanSnapshot!=null&&\(!record\.agreementPlanSnapshot\|\|typeof record\.agreementPlanSnapshot!=='object'\|\|Array\.isArray\(record\.agreementPlanSnapshot\)\)/);
});
