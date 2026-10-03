const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');
const ui=fs.readFileSync('dashboard.js','utf8');

test('follow-up mutations require the revision visible when the call action began',()=>{
  const start=api.indexOf('async function followupUpdate('),end=api.indexOf('\nfunction aiFeedbackWorkspaceIndexKey',start),block=api.slice(start,end);
  assert.match(block,/hasOwnProperty\.call\(body,'expectedUpdatedAt'\)/);
  assert.match(block,/expectedUpdatedAt!==Number\(previous\.updatedAt\|\|0\)/);
  assert.match(block,/follow-up changed since the call was opened/i);
});

test('team-status and note mutations send their current follow-up revision',()=>{
  const status=ui.slice(ui.indexOf('async function persistTeamStatus('),ui.indexOf('\nfunction requestTeamStatusChange',ui.indexOf('async function persistTeamStatus(')));
  const note=ui.slice(ui.indexOf('async function saveCallNote('),ui.indexOf('\nasync function deleteCallNote',ui.indexOf('async function saveCallNote(')));
  const del=ui.slice(ui.indexOf('async function deleteCallNote('),ui.indexOf('\nasync function moveLead',ui.indexOf('async function deleteCallNote(')));
  assert.match(status,/expectedUpdatedAt:Number\(previous\?\.updatedAt\|\|0\)/);
  assert.match(note,/expectedUpdatedAt:Number\(current\.updatedAt\|\|0\)/);
  assert.match(del,/expectedUpdatedAt:Number\(current\.updatedAt\|\|0\)/);
});


test('team-status receipt must advance the follow-up revision before replacing local state',()=>{
  const status=ui.slice(ui.indexOf('async function persistTeamStatus('),ui.indexOf('\nfunction requestTeamStatusChange',ui.indexOf('async function persistTeamStatus(')));
  assert.match(status,/Number\(confirmed\.updatedAt\)<=Number\(previous\?\.updatedAt\|\|0\)/);
});
