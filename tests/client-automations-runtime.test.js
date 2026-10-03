const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const dashboard=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');

test('client automation renderer defines trigger and action label helpers',()=>{
  assert.match(dashboard,/function triggerLabel\(value=''/);
  assert.match(dashboard,/function actionLabel\(value=''/);
  assert.match(dashboard,/triggerLabel\(x\.trigger\)/);
  assert.match(dashboard,/actionLabel\(x\.action\)/);
  assert.match(dashboard,/missed_call:'Missed call'/);
  assert.match(dashboard,/create_followup:'Create follow-up task'/);
});


test('client automation saves serialize mutations and require canonical acknowledgement',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  const start=ui.indexOf('let automationMutationPending=false;');
  const end=ui.indexOf('\nasync function toggleAutomation(',start);
  assert.ok(start>=0&&end>start);
  const fn=ui.slice(start,end);
  assert.match(fn,/if\(automationMutationPending\)return false/);
  assert.match(fn,/automationMutationPending=true/);
  assert.match(fn,/data\.ok!==true/);
  assert.match(fn,/data\.automations\.length!==submitted\.length/);
  assert.match(fn,/id!==submittedIds\[i\]/);
  assert.match(fn,/Number\.isFinite\(Number\(item\.updatedAt\)\)/);
  assert.match(fn,/finally\{automationMutationPending=false;setAutomationMutationUi\(false\)\}/);
});


test('automation controls block overlapping mutations and delete rolls back on save failure',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  const render=ui.slice(ui.indexOf('function renderAutomations(){'),ui.indexOf('let automationMutationPending=false;'));
  const toggle=ui.slice(ui.indexOf('async function toggleAutomation('),ui.indexOf('let editingAutomationId=null;'));
  const saveStart=ui.indexOf('async function saveAutomation(){');
  const save=ui.slice(saveStart,ui.indexOf("\ndocument.querySelectorAll(",saveStart));
  assert.match(render,/automationMutationPending\?'disabled aria-busy="true"'/);
  assert.match(toggle,/if\(automationMutationPending\)return false/);
  assert.match(toggle,/async function deleteAutomation\(id\)/);
  assert.match(toggle,/automationsData=automationsData\.filter/);
  assert.match(toggle,/automationsData=before;renderAutomations\(\);return false/);
  assert.match(save,/if\(automationMutationPending\)return false/);
});

test('automation delete binding points to an implemented handler',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  assert.match(ui,/data-delete-auto/);
  assert.match(ui,/async function deleteAutomation\(id\)/);
  assert.match(ui,/deleteAutomation\(btn\.dataset\.deleteAuto\)/);
});


test('automation pending state is visible, blocks modal dismissal, and exposes toggle state accessibly',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  const render=ui.slice(ui.indexOf('function renderAutomations(){'),ui.indexOf('let automationMutationPending=false;'));
  const persist=ui.slice(ui.indexOf('async function persistAutomations(){'),ui.indexOf('async function toggleAutomation('));
  const close=ui.slice(ui.indexOf('function closeAutomation(){'),ui.indexOf('async function saveAutomation(){'));
  assert.match(render,/aria-pressed="'\+String\(!!x\.enabled\)\+'"/);
  assert.match(render,/x\.enabled\?'Disable ':'Enable '/);
  assert.match(render,/x\.name\|\|'automation'/);
  assert.match(render,/function setAutomationMutationUi\(pending\)/);
  assert.match(render,/modal\.setAttribute\('aria-busy',String\(busy\)\)/);
  assert.match(render,/save\.textContent=busy\?'Saving…':'Save automation'/);
  assert.match(render,/create\.disabled=busy/);
  assert.match(render,/btn\.disabled=busy/);
  assert.match(persist,/automationMutationPending=true;setAutomationMutationUi\(true\)/);
  assert.match(persist,/finally\{automationMutationPending=false;setAutomationMutationUi\(false\)\}/);
  assert.match(close,/if\(automationMutationPending\)return false/);
});


test('automation builder gives inline validation and accessible save feedback',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','dashboard.html'),'utf8');
  const open=ui.slice(ui.indexOf('function openAutomation('),ui.indexOf('function closeAutomation()'));
  const save=ui.slice(ui.indexOf('async function saveAutomation(){'),ui.indexOf("\ndocument.querySelectorAll(",ui.indexOf('async function saveAutomation(){')));
  assert.match(html,/id="automationFormStatus" role="status" aria-live="polite"/);
  assert.match(html,/id="automationName" maxlength="120" autocomplete="off" aria-describedby="automationFormStatus"/);
  assert.match(html,/id="saveAutomationButton" type="button"/);
  assert.match(open,/status\.textContent=''/);
  assert.match(open,/name\.removeAttribute\('aria-invalid'\)/);
  assert.match(open,/setTimeout\(\(\)=>name\?\.focus\(\),20\)/);
  assert.match(save,/nameInput\.setAttribute\('aria-invalid','true'\)/);
  assert.match(save,/Add a name before saving this automation\./);
  assert.match(save,/nameInput\?\.removeAttribute\('aria-invalid'\)/);
  assert.match(save,/Automation was not saved\. Review the message and try again\./);
});
