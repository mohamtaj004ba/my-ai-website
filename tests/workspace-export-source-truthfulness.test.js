const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('workspace export validates every stored source before emitting arrays or null defaults',()=>{
  const start=api.indexOf('async function buildWorkspaceExportData('),end=api.indexOf('\nfunction validateWorkspaceExportData(',start),block=api.slice(start,end);
  for(const label of ['settings','agent','calls','leads','appointments','automations','integrations','locations','phone inventory','support index','onboarding','audit'])assert.ok(block.includes("'"+label+"'"),label+' validation missing');
  assert.match(block,/Workspace export source unavailable/);
  assert.match(block,/new Set\(supportIds\)\.size!==supportIds\.length/);
  assert.match(block,/support record/);
  assert.match(block,/!Array\.isArray\(conversations\)/);
});

test('client and admin exports refuse partial downloads when source verification fails',()=>{
  const client=api.slice(api.indexOf('async function workspaceExport('),api.indexOf('\nasync function adminWorkspaceExport('));
  const admin=api.slice(api.indexOf('async function adminWorkspaceExport('),api.indexOf('\nasync function adminRecoveryDrill('));
  assert.match(client,/No partial export was downloaded/);assert.match(admin,/No partial export was downloaded/);
  assert.match(client,/status\(503\)/);assert.match(admin,/status\(503\)/);
});

test('recovery drill refuses to report recovery readiness from unverifiable source data',()=>{
  const start=api.indexOf('async function adminRecoveryDrill('),block=api.slice(start,api.indexOf('\nasync function workspace(',start));
  assert.match(block,/Recovery source data could not be verified/);
  assert.match(block,/No partial recovery result was reported/);
  assert.match(block,/status\(503\)/);
});

test('workspace export validates row identity, workspace usage, and receptionist questions',()=>{
  const start=api.indexOf('async function buildWorkspaceExportData('),end=api.indexOf('\nfunction validateWorkspaceExportData(',start),block=api.slice(start,end);
  assert.match(block,/recordListOrNull=value=>/);
  assert.match(block,/String\(workspace\.id\|\|''\)===String\(id\)/);
  assert.match(block,/Number\.isFinite\(Number\(workspace\.usage\.minutes\)\)/);
  assert.match(block,/qualificationQuestions==null\|\|Array\.isArray\(value\.qualificationQuestions\)/);
});

test('workspace export rejects malformed onboarding checklist state',()=>{
  const start=api.indexOf('async function buildWorkspaceExportData('),end=api.indexOf('\nfunction validateWorkspaceExportData(',start),block=api.slice(start,end);
  assert.match(block,/\['onboarding',onboarding,value=>objectOrNull\(value\)&&\(value==null\|\|value\.checklist==null/);
});
