const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('launch checklist rejects malformed workspace and checklist state before mutation',()=>{
  const start=api.indexOf('async function adminProvisioningChecklistSave('),end=api.indexOf('\nasync function adminHealth(',start),block=api.slice(start,end);
  assert.match(block,/Client workspace record is unavailable\. No onboarding changes were made/);
  assert.match(block,/Onboarding checklist is unavailable\. No changes were made/);
});
test('launch checklist refuses malformed agent and phone inventory instead of reporting ordinary setup gaps',()=>{
  const start=api.indexOf('async function adminProvisioningChecklistSave('),end=api.indexOf('\nasync function adminHealth(',start),block=api.slice(start,end);
  assert.match(block,/AI receptionist configuration is unavailable\. Launch state was not changed/);
  assert.match(block,/Phone inventory is unavailable\. Launch state was not changed/);
  assert.match(block,/Phone inventory contains unverifiable records\. Launch state was not changed/);
  assert.match(block,/new Set\(phoneIds\)\.size!==phoneIds\.length/);
});
