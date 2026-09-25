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
