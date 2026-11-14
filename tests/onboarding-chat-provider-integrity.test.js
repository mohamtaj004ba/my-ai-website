const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('api/onboarding-chat.js','utf8');

test('onboarding chat verifies OpenAI response structure before returning text',()=>{
  assert.match(src,/!parsed\|\|typeof parsed!=='object'\|\|Array\.isArray\(parsed\)\|\|!Array\.isArray\(parsed\.output\)/);
  assert.match(src,/parsed\.output\.flatMap/);
  assert.match(src,/item\.type==='output_text'/);
  assert.match(src,/OpenAI onboarding response did not contain verified text/);
  assert.match(src,/res\.status\(502\)\.json\(\{ error: 'Assistant response unavailable' \}\)/);
});

test('setup guidance keeps activation and provider delivery dependent on verified account evidence',()=>{
  assert.doesNotMatch(src,/Most accounts are live|We start the same day|they get a text with a link|check-in text around day two|a PDF copy was emailed to them/);
  assert.match(src,/Completing intake or payment does not activate their number/);
  assert.match(src,/Do not claim a number has been provisioned without verified account evidence/);
  assert.match(src,/Never infer successful email delivery from signing or form submission alone/);
});
