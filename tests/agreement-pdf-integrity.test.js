const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('api/agreement-pdf.js','utf8');

test('agreement PDF distinguishes missing from malformed signed records',()=>{
  assert.match(src,/record == null \|\| !record\?\.agreementSigned/);
  assert.match(src,/typeof record!=='object'\|\|Array\.isArray\(record\)/);
  assert.match(src,/error:'agreement_unavailable'/);
});

test('agreement PDF verifies stored snapshots, signing timestamp, and clauses before rendering',()=>{
  assert.match(src,/record\.agreementSnapshot!=null/);
  assert.match(src,/record\.agreementPlanSnapshot!=null/);
  assert.match(src,/!Number\.isFinite\(signedAt\)\|\|signedAt<=0/);
  assert.match(src,/!Array\.isArray\(snap\.clauses\)\|\|!snap\.clauses\.length/);
});
