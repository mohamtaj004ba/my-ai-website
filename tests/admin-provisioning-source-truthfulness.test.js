const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('admin provisioning validates nested onboarding and override state before summarizing progress',()=>{
  const start=api.indexOf('async function adminProvisioning('),end=api.indexOf('\nfunction validProvisioningHistory(',start),block=api.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(block,/onboardingValid=/);
  assert.match(block,/onboarding\.checklist==null/);
  assert.match(block,/onboarding\.onboardingInviteDelivery==null/);
  assert.match(block,/Number\.isFinite\(Number\(onboarding\.completionPercent\)\)/);
  assert.match(block,/overrideValid=/);
  assert.match(block,/Number\.isFinite\(Number\(override\.updatedAt\)\)/);
  assert.match(block,/agent\?\.qualificationQuestions!=null&&!Array\.isArray\(agent\.qualificationQuestions\)/);
});
