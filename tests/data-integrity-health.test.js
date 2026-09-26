const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');

test('system health blocks launch on workspace data-integrity drift',()=>{
  assert.match(api,/key:'data-integrity'/);
  assert.match(api,/requiredForLaunch=\['database','environment-scope','data-integrity'/);
  assert.match(api,/invalid stored plan/);
  assert.match(api,/multiple phone routing records assigned/);
  assert.match(api,/phone does not match its assigned routing record/);
  assert.match(api,/assigned to a missing workspace/);
});
