const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function seedPreviewData(req,res){');
const end=source.indexOf('\nasync function ',start+1);
assert.ok(start>=0&&end>start,'seedPreviewData must remain discoverable');
const body=source.slice(start,end);

test('Preview seed validates workspace directory before the first seed write',()=>{
  const read=body.indexOf("const rawWorkspaceIndex=await kv.get('workspace:index');");
  const guard=body.indexOf("Preview workspace directory is unavailable; seed data was not changed");
  const firstWrite=body.indexOf("kv.set('workspace:'+workspaceId,workspace)");
  assert.ok(read>=0,'workspace index read must exist');
  assert.ok(guard>read,'malformed workspace directory must have an explicit fail-closed response');
  assert.ok(firstWrite>guard,'workspace directory validation must complete before any primary seed write');
  assert.match(body,/!Array\.isArray\(rawWorkspaceIndex\)/);
  assert.match(body,/new Set\(rawWorkspaceIndex\)\.size!==rawWorkspaceIndex\.length/);
});

test('Preview seed does not silently replace a malformed workspace directory with an empty list',()=>{
  assert.doesNotMatch(body,/const currentIndex=await kv\.get\('workspace:index'\)\|\|\[\],index=Array\.isArray\(currentIndex\)\?currentIndex:\[\]/);
  assert.match(body,/const index=rawWorkspaceIndex\|\|\[\]/);
});
