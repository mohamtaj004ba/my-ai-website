const test=require('node:test');
const assert=require('node:assert/strict');
const seed=require('../lib/preview-seed');
test('primary Preview workspaces use stable separate fictional inventory numbers',()=>{
  const first=seed.primaryPhone('qa-workspace-a'),second=seed.primaryPhone('qa-workspace-b');
  assert.notEqual(first.number,second.number);
  assert.equal(first.number,seed.primaryPhone('qa-workspace-a').number);
  assert.equal(first.number,seed.primaryWorkspace('qa-workspace-a','qa@example.invalid').phone);
  assert.match(first.number,/^\([2-9]\d{2}\) 555-01\d{2}$/);
});
