const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');
const ui=fs.readFileSync('dashboard.js','utf8');

test('lead stage update requires the displayed record revision',()=>{
  const start=api.indexOf('async function updateLead('),end=api.indexOf('\nasync function billingPortal(',start),block=api.slice(start,end);
  assert.match(block,/hasOwnProperty\.call\(req\.body\|\|\{\},'expectedUpdatedAt'\)/);
  assert.match(block,/expectedUpdatedAt!==Number\(previous\.updatedAt\|\|0\)/);
  assert.match(block,/lead changed since you opened the pipeline/i);
  const uiBlock=ui.slice(ui.indexOf('async function moveLead('),ui.indexOf("\ndocument.getElementById('callSearch')",ui.indexOf('async function moveLead(')));
  assert.match(uiBlock,/expectedUpdatedAt:Number\(lead\.updatedAt\|\|0\)/);
});

test('appointment status update requires the displayed record revision',()=>{
  const start=api.indexOf('async function updateAppointment('),end=api.indexOf('\nasync function analytics(',start),block=api.slice(start,end);
  assert.match(block,/hasOwnProperty\.call\(req\.body\|\|\{\},'expectedUpdatedAt'\)/);
  assert.match(block,/expectedUpdatedAt!==Number\(previous\.updatedAt\|\|0\)/);
  assert.match(block,/appointment changed since you opened the schedule/i);
  const uiBlock=ui.slice(ui.indexOf('async function updateAppointment('),ui.indexOf("\ndocument.getElementById('conversationSearch')",ui.indexOf('async function updateAppointment(')));
  assert.match(uiBlock,/expectedUpdatedAt:Number\(item\.updatedAt\|\|0\)/);
});


test('client accepts lead and appointment mutations only with a newer revision receipt',()=>{
  const lead=ui.slice(ui.indexOf('async function moveLead('),ui.indexOf("\ndocument.getElementById('callSearch')",ui.indexOf('async function moveLead(')));
  const appointment=ui.slice(ui.indexOf('async function updateAppointment('),ui.indexOf("\ndocument.getElementById('conversationSearch')",ui.indexOf('async function updateAppointment(')));
  assert.match(lead,/Number\(data\.lead\.updatedAt\)<=Number\(lead\.updatedAt\|\|0\)/);
  assert.match(appointment,/Number\(data\.appointment\.updatedAt\)<=Number\(item\.updatedAt\|\|0\)/);
});
