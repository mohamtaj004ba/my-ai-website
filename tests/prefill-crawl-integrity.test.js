const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('api/prefill-crawl.js','utf8');

test('prefill crawl verifies OpenAI response structure before parsing extracted fields',()=>{
  assert.match(src,/!p\|\|typeof p!=='object'\|\|Array\.isArray\(p\)\|\|!Array\.isArray\(p\.output\)/);
  assert.match(src,/p\.output\.flatMap/);
  assert.match(src,/x\.type==='output_text'/);
  assert.match(src,/openai_response_empty/);
  assert.match(src,/openai_payload_unverified/);
});

test('prefill crawl fails closed on malformed onboarding storage and confirms scan persistence',()=>{
  assert.match(src,/record!=null/);
  assert.match(src,/!record\|\|typeof record!=='object'\|\|Array\.isArray\(record\)/);
  assert.match(src,/onboarding_record_unverified/);
  assert.match(src,/const confirmed=await kv\.get\(key\)/);
  assert.match(src,/onboarding_scan_persistence_unverified/);
});
