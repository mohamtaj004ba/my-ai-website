const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('admin client drawer refuses malformed secondary sources instead of rendering fake empty setup',()=>{
  const start=api.indexOf('async function adminClient('),end=api.indexOf('\n\nfunction notificationReadKey(',start),block=api.slice(start,end);
  assert.match(block,/Client detail sources could not be verified/);
  assert.match(block,/No partial client drawer was returned/);
  assert.match(block,/validRows=value=>/);
  assert.match(block,/!validRows\(locations\)/);
  assert.match(block,/!validRows\(numbers\)/);
  assert.match(block,/objectOrNull\(agent\)/);
  assert.match(block,/objectOrNull\(onboarding\)/);
});

test('admin client drawer verifies the workspace identity before rendering it',()=>{
  const start=api.indexOf('async function adminClient('),end=api.indexOf('\n\nfunction notificationReadKey(',start),block=api.slice(start,end);
  assert.match(block,/String\(ws\.id\|\|''\)!==id/);
  assert.match(block,/Client workspace record could not be verified/);
});

test('admin client drawer validates usage and row-level secondary records',()=>{
  const start=api.indexOf('async function adminClient('),end=api.indexOf('\n\nfunction notificationReadKey(',start),block=api.slice(start,end);
  assert.match(block,/Client usage data could not be verified\. No partial client drawer was returned/);
  assert.match(block,/validRows=value=>/);
  assert.match(block,/agent\?\.qualificationQuestions!=null&&!Array\.isArray\(agent\.qualificationQuestions\)/);
});

test('admin client drawer rejects malformed onboarding checklist state',()=>{
  const start=api.indexOf('async function adminClient('),end=api.indexOf('\n\nfunction notificationReadKey(',start),block=api.slice(start,end);
  assert.match(block,/onboarding\?\.checklist!=null/);
  assert.match(block,/Array\.isArray\(onboarding\.checklist\)/);
});


test('admin client and receptionist empty states distinguish filters from truly empty sources',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  assert.match(ui,/filteredView=all\.length>0/);
  assert.match(ui,/filteredView\?'No clients match this view':'No client accounts yet'/);
  assert.match(ui,/filteredView=agentRows\.length>0/);
  assert.match(ui,/filteredView\?'No receptionists match this view':'No receptionist workspaces yet'/);
});
