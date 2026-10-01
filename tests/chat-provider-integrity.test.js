const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('api/chat.js','utf8');

test('public chat does not expose raw Anthropic error payloads',()=>{
  assert.match(src,/console\.error\('Anthropic API error:', upstreamCode\(data\)\)/);
  assert.match(src,/res\.status\(502\)\.json\(\{ error: 'Upstream API error' \}\)/);
  assert.doesNotMatch(src,/detail:\s*data/);
});

test('public chat verifies a structured Anthropic text response before returning HTTP 200',()=>{
  assert.match(src,/!parsed\|\|typeof parsed!=='object'\|\|Array\.isArray\(parsed\)\|\|!Array\.isArray\(parsed\.content\)/);
  assert.match(src,/parsed\.content\.find\(item=>item&&item\.type==='text'/);
  assert.match(src,/Anthropic chat response did not contain verified text/);
  assert.match(src,/res\.status\(502\)\.json\(\{ error: 'Assistant response unavailable' \}\)/);
});
