const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('api/onboarding-save.js','utf8');

test('onboarding writes distinguish missing from malformed token records',()=>{
  assert.match(src,/if \(record == null\) return res\.status\(404\)/);
  assert.match(src,/typeof record!=='object'\|\|Array\.isArray\(record\)/);
  assert.match(src,/record\.intake!=null&&\(!record\.intake\|\|typeof record\.intake!=='object'\|\|Array\.isArray\(record\.intake\)\)/);
  assert.match(src,/Onboarding data is unavailable\. No changes were made\./);
});

test('onboarding workspace progress never spreads malformed persisted state',()=>{
  assert.match(src,/rawPrior!=null&&\(!rawPrior\|\|typeof rawPrior!=='object'\|\|Array\.isArray\(rawPrior\)\)/);
  assert.match(src,/Agreement was saved; workspace progress was not overwritten/);
  assert.match(src,/Intake progress was saved; workspace progress was not overwritten/);
  assert.match(src,/rawState!=null&&\(!rawState\|\|typeof rawState!=='object'\|\|Array\.isArray\(rawState\)\)/);
});
