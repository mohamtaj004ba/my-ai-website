const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');

test('standard onboarding does not offer Medical & Dental',()=>{
  const page=fs.readFileSync(path.join(root,'onboarding.html'),'utf8');
  assert.doesNotMatch(page,/<option>Medical &amp; Dental<\/option>/);
  assert.doesNotMatch(page,/insurance carrier and member ID/i);
});

test('server rejects regulated medical onboarding and does not accept insuranceInfo',()=>{
  const src=fs.readFileSync(path.join(root,'api','onboarding-save.js'),'utf8');
  assert.match(src,/incoming\.industry==='Medical & Dental'/);
  assert.match(src,/separately approved compliant configuration/);
  const allowlist=src.slice(src.indexOf('const ALLOWED_INTAKE_FIELDS'),src.indexOf('function validToken'));
  assert.doesNotMatch(allowlist,/insuranceInfo/);
});
