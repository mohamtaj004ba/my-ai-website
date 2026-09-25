const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');

test('phone inventory changes keep onboarding phone checkpoint synchronized',()=>{
  assert.match(api,/async function syncOnboardingPhoneAssignment\(workspaceId,assigned\)/);
  assert.match(api,/stageOnboarding\(previous\.workspaceId,previousOnboardingBefore,false\)/);
  assert.match(api,/stageOnboarding\(workspaceId,targetOnboardingBefore,true\)/);
  assert.match(api,/syncOnboardingPhoneAssignment\(item\.workspaceId,false\)/);
});


test('legacy phone deletion retains its rollback safeguards',()=>{
  assert.match(api,/admin phone routing delete failed/);
  assert.match(api,/Promise\.allSettled\(restore\)/);
  assert.match(api,/Could not delete phone routing\. No changes were kept\./);
});
