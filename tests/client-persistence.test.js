const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

test('lead updates fail closed when the record no longer exists',()=>{
  assert.match(api,/if\(!updated\)return res\.status\(404\)\.json\(\{error:'Lead not found'\}\)/);
  assert.match(api,/Lead data is unavailable/);
  assert.match(dashboard,/data\.updated!==true\)throw new Error\(data\.error\|\|'Could not update this lead\.'/);
});

test('appointment updates fail closed when the record no longer exists',()=>{
  assert.match(api,/if\(!updated\)return res\.status\(404\)\.json\(\{error:'Appointment not found'\}\)/);
  assert.match(api,/Appointment data is unavailable/);
  assert.match(dashboard,/data\.updated!==true\)throw new Error\(data\.error\|\|'Could not update appointment\.'/);
});


test('call read state rolls back when the server cannot persist it',()=>{
  assert.match(dashboard,/async function markCallViewed\(id\)/);
  assert.match(dashboard,/if\(!r\.ok\)throw new Error\('Could not persist call read state'\)/);
  assert.match(dashboard,/callViewedIds\.delete\(key\);renderCalls\(\)/);
});
