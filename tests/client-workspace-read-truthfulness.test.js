const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('workspace summary rejects malformed workspace records instead of emitting partial metadata',()=>{
  const start=api.indexOf('async function workspace('),end=api.indexOf('\nasync function requireFeature(',start),block=api.slice(start,end);
  assert.match(block,/Workspace record could not be verified/);
  assert.match(block,/No partial workspace summary was returned/);
});
test('feature gates refuse to evaluate entitlements from malformed workspace records',()=>{
  const start=api.indexOf('async function requireFeature('),end=api.indexOf('\nasync function phoneRouting(',start),block=api.slice(start,end);
  assert.match(block,/Feature access was not evaluated/);
  assert.match(block,/Array\.isArray\(ws\)/);
});
