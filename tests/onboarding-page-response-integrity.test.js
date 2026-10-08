const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const page=fs.readFileSync('onboarding.html','utf8');

test('onboarding page only renders verified onboarding records',()=>{
  assert.match(page,/const loaded = await res\.json\(\)\.catch\(\(\)=>null\)/);
  assert.match(page,/!String\(loaded\.status\|\|''\)\|\|!String\(loaded\.plan\|\|''\)/);
  assert.match(page,/loaded\.intake!=null&&\(!loaded\.intake\|\|typeof loaded\.intake!=='object'\|\|Array\.isArray\(loaded\.intake\)\)/);
});

test('agreement signing and intake mutations require canonical saved acknowledgements',()=>{
  assert.match(page,/signData\.ok!==true\|\|!String\(signData\.status\|\|''\)/);
  assert.match(page,/Agreement save could not be verified/);
  assert.match(page,/data\.ok!==true\|\|!String\(data\.status\|\|''\)\|\|!Number\.isFinite\(Number\(data\.completionPercent\)\)/);
  assert.match(page,/Autosave acknowledgement could not be verified/);
  assert.match(page,/submitData\.ok!==true\|\|submitData\.status!=='intake_complete'/);
  assert.match(page,/Onboarding submission could not be verified/);
});

test('website prefill and setup-help responses are shape-verified before use',()=>{
  assert.match(page,/data\.ok!==true\|\|!data\.fields\|\|typeof data\.fields!=='object'\|\|Array\.isArray\(data\.fields\)/);
  assert.match(page,/reply=String\(data&&typeof data==='object'&&!Array\.isArray\(data\)\?data\.reply\|\|'':''\)\.trim\(\)/);
  assert.match(page,/if\(!reply\)throw new Error\('bad response'\)/);
});
