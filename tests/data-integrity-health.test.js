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

test('monthly analytics rollup is visible as an optional health service with coverage metadata',()=>{
  assert.match(api,/key:'analytics-rollup'/);
  assert.match(api,/name:'Monthly analytics rollup'/);
  assert.match(api,/incompleteSources/);
  assert.match(api,/Monthly analytics rollup is current but/);
  assert.match(api,/Monthly analytics rollup is stale/);
  assert.doesNotMatch(api,/requiredForLaunch=\[[^\]]*analytics-rollup/);
});


test('system health surfaces malformed phone inventory rows as data-integrity drift',()=>{
  assert.match(api,/Phone routing inventory contains unverifiable records/);
});

test('system health flags malformed workspace usage as data-integrity drift',()=>{
  assert.match(api,/has malformed usage data/);
});
