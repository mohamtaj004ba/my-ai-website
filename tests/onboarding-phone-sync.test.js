const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('phone inventory saves stage onboarding assignment state in their atomic update set',()=>{
  assert.match(api,/stageOnboarding\(previous\.workspaceId,previousOnboardingBefore,false\)/);
  assert.match(api,/stageOnboarding\(workspaceId,targetOnboardingBefore,true\)/);
  assert.match(api,/compareAndSetConfig\(kv,updates\)/);
});

test('phone deletion stages its inventory, workspace and onboarding changes together',()=>{
  const handler=api.slice(api.indexOf('async function adminDeletePhoneNumber('),api.indexOf('async function adminFleet('));
  assert.match(handler,/updates=\[\{key:'phone:index'/);assert.match(handler,/key:'workspace:'\+item\.workspaceId/);assert.match(handler,/key:'onboarding:workspace:'\+item\.workspaceId/);assert.match(handler,/compareAndSetConfig\(kv,updates\)/);assert.doesNotMatch(handler,/Promise\.allSettled|kv\.set/);
});
