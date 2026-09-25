const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');

test('phone inventory changes keep onboarding phone checkpoint synchronized',()=>{
  assert.match(api,/async function syncOnboardingPhoneAssignment\(workspaceId,assigned\)/);
  assert.match(api,/syncOnboardingPhoneAssignment\(previous\.workspaceId,false\)/);
  assert.match(api,/syncOnboardingPhoneAssignment\(workspaceId,true\)/);
  assert.match(api,/syncOnboardingPhoneAssignment\(item\.workspaceId,false\)/);
});
