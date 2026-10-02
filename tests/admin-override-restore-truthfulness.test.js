const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('admin override array limits reject oversize payloads instead of silently slicing records',()=>{
  const start=api.indexOf('function sanitizeAdminOverride('),end=api.indexOf('\nasync function configTransactionUpdates(',start),block=api.slice(start,end);
  assert.match(block,/override exceeds the .* safety limit/);
  assert.match(block,/No records were dropped/);
  assert.doesNotMatch(block,/return value\.slice\(0,/);
});
test('admin override refuses malformed existing config, workspace and routing sources',()=>{
  const start=api.indexOf('async function adminOverrideConfig('),end=api.indexOf('\nasync function adminRestoreAudit(',start),block=api.slice(start,end);
  assert.match(block,/Client workspace record is unavailable\. No override was applied/);
  assert.match(block,/Existing .* configuration is unavailable\. No override was applied/);
  const tx=api.slice(api.indexOf('async function configTransactionUpdates('),start);
  assert.match(tx,/Workspace record is malformed/);
  assert.match(tx,/Routing request is malformed/);
  assert.match(tx,/Phone inventory records are malformed/);
});
test('audit restore distinguishes unavailable audit/current data from a genuine missing audit entry',()=>{
  const start=api.indexOf('async function adminRestoreAudit('),end=api.indexOf('\n\n\nasync function adminSendOnboardingInvite(',start),block=api.slice(start,end);
  assert.match(block,/Audit history is unavailable\. No restore was attempted/);
  assert.match(block,/Audit history contains unverifiable entries/);
  assert.match(block,/Current .* configuration is unavailable\. No restore was attempted/);
  assert.match(block,/Client workspace record is unavailable\. No restore was attempted/);
});

test('admin override and restore reject malformed rows inside array configurations',()=>{
  const override=api.slice(api.indexOf('async function adminOverrideConfig('),api.indexOf('\nasync function adminRestoreAudit('));
  const restore=api.slice(api.indexOf('async function adminRestoreAudit('),api.indexOf('\n\n\nasync function adminSendOnboardingInvite('));
  assert.match(override,/Array\.isArray\(before\)&&before\.every/);
  assert.match(restore,/Array\.isArray\(current\)&&current\.every/);
});

test('admin override sanitizer rejects malformed array rows and receptionist question payloads',()=>{
  const start=api.indexOf('function sanitizeAdminOverride('),end=api.indexOf('\nasync function configTransactionUpdates(',start),block=api.slice(start,end);
  assert.match(block,/Section contains unverifiable records/);
  assert.match(block,/Qualification questions must be a list of text values/);
});
