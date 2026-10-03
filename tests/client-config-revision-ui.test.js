const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const ui=fs.readFileSync('dashboard.js','utf8');

function slice(begin,end){
  const a=ui.indexOf(begin),b=ui.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,'missing source boundary '+begin);
  return ui.slice(a,b);
}

test('client receptionist save always sends the revision displayed by the editor',()=>{
  const block=slice('async function saveAgent(', '\nfunction feedbackStatusLabel(');
  assert.match(block,/expectedUpdatedAt:agentEditSnapshot\?\.updatedAt\|\|agentData\?\.updatedAt\|\|null/);
  assert.match(block,/JSON\.stringify\(next\)/);
});

test('client settings save always sends the loaded settings revision',()=>{
  const block=slice('async function saveSettings(){','\n\nfunction renderPhoneRouting(');
  assert.match(block,/expectedUpdatedAt:settingsData\?\.updatedAt\|\|0/);
  assert.match(block,/JSON\.stringify\(payload\)/);
});

test('admin phone edit carries the record revision captured when the modal opens',()=>{
  const open=slice("function openPhoneModal(id='')",'\nfunction closePhoneModal');
  const save=slice('async function savePhone(){',"\ndocument.getElementById('addPhoneButton')");
  assert.match(open,/dataset\.expectedUpdatedAt=String\(item\?\.updatedAt\|\|0\)/);
  assert.match(save,/expectedUpdatedAt:Number\(modal\?\.dataset\.expectedUpdatedAt\|\|0\)/);
});
