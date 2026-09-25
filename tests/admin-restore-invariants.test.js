const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');

test('admin audit restore reuses current sanitization before writing a snapshot',()=>{
  assert.match(api,/let restored;try\{restored=sanitizeAdminOverride\(entry\.section,rawRestored,current\|\|await kv\.get\('workspace:'\+id\)\|\|\{\}\)\}/);
  assert.match(api,/This snapshot can no longer be restored safely/);
  assert.match(api,/syncConfigDerivedState\(id,entry\.section,restored\)/);
});

test('restored agent transfer destinations synchronize into phone routing',()=>{
  assert.match(api,/async function syncConfigDerivedState\(workspaceId,section,value\)/);
  assert.match(api,/section==='agent'[\s\S]*?transferNumber[\s\S]*?phone:index/);
  assert.match(api,/routing-request:'\+workspaceId/);
});

test('admin agent overrides validate transfer destinations',()=>{
  assert.match(api,/section==='agent'&&value\.transferNumber/);
  assert.match(api,/Transfer destination is invalid/);
});
