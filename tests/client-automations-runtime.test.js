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
  assert.match(fn,/finally\{automationMutationPending=false\}/);
});
