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


test('phone routing mutations restore synchronized state when persistence fails',()=>{
  assert.match(api,/admin phone routing save failed/);
  assert.match(api,/admin phone routing delete failed/);
  assert.match(api,/Promise\.allSettled\(restore\)/);
  assert.match(api,/kv\.set\('phone:index',list\.slice\(0,500\)\)/);
  assert.match(api,/kv\.set\('workspace:'\+previous\.workspaceId,previousWorkspaceBefore\)/);
  assert.match(api,/kv\.set\('onboarding:workspace:'\+previous\.workspaceId,previousOnboardingBefore\)/);
  assert.match(api,/Could not save phone routing\. No changes were kept\./);
  assert.match(api,/Could not delete phone routing\. No changes were kept\./);
});
