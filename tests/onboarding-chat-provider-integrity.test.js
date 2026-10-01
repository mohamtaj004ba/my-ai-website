const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('api/onboarding-chat.js','utf8');

test('onboarding chat verifies Anthropic response structure before returning text',()=>{
  assert.match(src,/!parsed\|\|typeof parsed!=='object'\|\|Array\.isArray\(parsed\)\|\|!Array\.isArray\(parsed\.content\)/);
  assert.match(src,/parsed\.content\.find\(item=>item&&item\.type==='text'/);
  assert.match(src,/Anthropic onboarding response did not contain verified text/);
  assert.match(src,/res\.status\(502\)\.json\(\{ error: 'Assistant response unavailable' \}\)/);
});
