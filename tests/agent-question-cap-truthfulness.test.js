const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

test('receptionist read rejects malformed stored config instead of substituting Maya defaults',()=>{
  const start=api.indexOf('async function agent('),end=api.indexOf('\nasync function saveAgent(',start),block=api.slice(start,end);
  assert.match(block,/Receptionist configuration is unavailable\. No default configuration was substituted/);
  assert.match(block,/rawSaved!=null/);
});
test('receptionist save fails closed on malformed previous config',()=>{
  const start=api.indexOf('async function saveAgent('),end=api.indexOf('\nasync function automations(',start),block=api.slice(start,end);
  assert.match(block,/Receptionist configuration is unavailable\. No changes were made/);
});
test('qualification question limit rejects the entire save instead of silently slicing to 12',()=>{
  const start=api.indexOf('async function saveAgent('),end=api.indexOf('\nasync function automations(',start),block=api.slice(start,end);
  assert.match(block,/qualificationQuestions\.length>12/);
  assert.match(block,/supports up to 12 receptionist qualification questions/);
  assert.doesNotMatch(block,/qualificationQuestions[^\n]*slice\(0,12\)/);
});
test('client editor visibly disables and explains adding past the 12-question limit',()=>{
  assert.match(dashboard,/12-question limit/);
  assert.match(dashboard,/add\.disabled=active==='qualification'&&count>=12/);
  assert.match(dashboard,/Remove a qualification question before adding another/);
});

test('receptionist read refuses malformed platform defaults rather than falling back to Maya',()=>{
  const start=api.indexOf('async function agent('),end=api.indexOf('\nasync function saveAgent(',start),block=api.slice(start,end);
  assert.match(block,/Receptionist platform defaults are unavailable/);
  assert.match(block,/No default receptionist configuration was substituted/);
});

test('receptionist read and save reject malformed qualification-question storage instead of substituting an empty list',()=>{
  const readStart=api.indexOf('async function agent('),readEnd=api.indexOf('\nasync function saveAgent(',readStart),readBlock=api.slice(readStart,readEnd);
  const saveStart=api.indexOf('async function saveAgent('),saveEnd=api.indexOf('\nasync function automations(',saveStart),saveBlock=api.slice(saveStart,saveEnd);
  assert.match(readBlock,/qualification questions are unavailable\. No empty question list was substituted/);
  assert.match(saveBlock,/qualification questions are unavailable\. No changes were made/);
});
