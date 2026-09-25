const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

test('client receptionist transfer destination syncs into assigned phone routing',()=>{
  assert.match(api,/phonePos=phoneIndex\.findIndex\(x=>x&&String\(x\.workspaceId\|\|''\)===String\(s\.workspaceId\)\)/);
  assert.match(api,/phoneAfter=\{\.\.\.phoneBefore,transferNumber:agent\.transferNumber/);
  assert.match(api,/routingTransferSynced:phonePos>=0/);
  assert.match(dashboard,/if\(data\.routing\)phoneRoutingData=data\.routing/);
});

test('admin phone routing transfer changes sync back into receptionist config',()=>{
  assert.match(api,/if\(savedAgent\)await kv\.set\('agent:'\+workspaceId,\{\.\.\.savedAgent,transferNumber/);
  assert.match(api,/if\(routingRequest\)await kv\.set\('routing-request:'\+workspaceId,\{\.\.\.routingRequest,transferNumber/);
});

test('client transfer destination uses the same server validation as routing inventory',()=>{
  assert.match(api,/if\(agent\.transferNumber&&!\/\^\\\+\?\[0-9\(\) \.-\]\{7,30\}\$\/\.test\(agent\.transferNumber\)\)return res\.status\(400\)/);
});
