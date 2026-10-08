const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('phone inventory saves stage onboarding assignment state in their audited atomic update set',()=>{
  const handler=api.slice(api.indexOf('async function adminSavePhoneNumber('),api.indexOf('async function adminDeletePhoneNumber('));
  assert.match(handler,/stageOnboarding\(previous\.workspaceId,previousOnboardingBefore,false\)/);
  assert.match(handler,/stageOnboarding\(workspaceId,targetOnboardingBefore,true\)/);
  assert.match(handler,/compareAndAuditBatch\(kv,updates,'audit:'\+auditWorkspace,audit\)/);
  assert.doesNotMatch(handler,/await appendAudit\(/);
});

test('phone deletion stages inventory, workspace, onboarding and audit history together',()=>{
  const handler=api.slice(api.indexOf('async function adminDeletePhoneNumber('),api.indexOf('async function adminFleet('));
  assert.match(handler,/updates=\[\{key:'phone:index'/);
  assert.match(handler,/key:'workspace:'\+item\.workspaceId/);
  assert.match(handler,/key:'onboarding:workspace:'\+item\.workspaceId/);
  assert.match(handler,/compareAndAuditBatch\(kv,updates,'audit:'\+auditWorkspace,audit\)/);
  assert.doesNotMatch(handler,/Promise\.allSettled|kv\.set|await appendAudit\(/);
});
