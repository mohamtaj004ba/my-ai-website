const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('admin configuration snapshot validates every repair source instead of substituting empty arrays',()=>{
  const start=api.indexOf('async function getWorkspaceConfigSnapshot('),end=api.indexOf('\nasync function bootstrapPreview(',start),block=api.slice(start,end);
  assert.match(block,/Workspace configuration source unavailable/);
  for(const label of ['workspace','settings','agent','automations','integrations','locations','phone inventory'])assert.ok(block.includes("'"+label+"'"),label+' validation missing');
  assert.doesNotMatch(block,/automations:Array\.isArray\(automations\)\?automations:\[\]/);
  assert.doesNotMatch(block,/locations:Array\.isArray\(locations\)\?locations:\[\]/);
});

test('admin tech support returns no partial repair snapshot when configuration verification fails',()=>{
  const start=api.indexOf('async function adminTechSupport('),end=api.indexOf('\nasync function adminSendClientLogin(',start),block=api.slice(start,end);
  assert.match(block,/Workspace diagnostics could not be verified/);
  assert.match(block,/No partial repair snapshot was returned/);
  assert.match(block,/status\(503\)/);
  assert.match(block,/Client workspace record is unavailable/);
});

test('admin configuration snapshot validates rows inside arrays and receptionist questions',()=>{
  const start=api.indexOf('async function getWorkspaceConfigSnapshot('),end=api.indexOf('\nasync function bootstrapPreview(',start),block=api.slice(start,end);
  assert.match(block,/qualificationQuestions==null\|\|Array\.isArray\(value\.qualificationQuestions\)/);
  assert.match(block,/\['automations',automations,value=>value==null\|\|Array\.isArray\(value\)&&value\.every/);
  assert.match(block,/\['phone inventory',phones,value=>value==null\|\|Array\.isArray\(value\)&&value\.every/);
});
