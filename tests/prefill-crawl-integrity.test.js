const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('api/prefill-crawl.js','utf8');

test('prefill crawl verifies Anthropic response structure before parsing extracted fields',()=>{
  assert.match(src,/!p\|\|typeof p!=='object'\|\|Array\.isArray\(p\)\|\|!Array\.isArray\(p\.content\)/);
  assert.match(src,/p\.content\.find\(x=>x&&x\.type==='text'/);
  assert.match(src,/anthropic_response_empty/);
  assert.match(src,/anthropic_payload_unverified/);
});

test('prefill crawl fails closed on malformed onboarding storage and confirms scan persistence',()=>{
  assert.match(src,/record!=null/);
  assert.match(src,/!record\|\|typeof record!=='object'\|\|Array\.isArray\(record\)/);
  assert.match(src,/onboarding_record_unverified/);
  assert.match(src,/const confirmed=await kv\.get\(key\)/);
  assert.match(src,/onboarding_scan_persistence_unverified/);
});
