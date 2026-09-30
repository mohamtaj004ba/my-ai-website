const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');
const ui=fs.readFileSync('dashboard.js','utf8');

test('operational workspace gate rejects malformed workspace records before mutations',()=>{
  const start=api.indexOf('async function requireOperationalWorkspace('),end=api.indexOf('\nasync function adminProvisioning(',start),block=api.slice(start,end);
  assert.match(block,/No operational change was allowed/);
  assert.match(block,/Array\.isArray\(ws\)/);
});
test('admin client view refuses malformed workspace records before replacing the admin session',()=>{
  const start=api.indexOf('async function adminViewClient('),end=api.indexOf('\nasync function adminExitClientView(',start),block=api.slice(start,end);
  assert.match(block,/Admin client view was not opened/);
  assert.ok(block.indexOf('Client workspace record could not be verified')<block.indexOf('destroySessionToken'));
});
test('automation Fleet discloses its 20-workflow payload boundary in the UI',()=>{
  assert.match(api,/workflowCoverage:\{returned:Math\.min\(20,autos\.length\),total:autos\.length,limited:autos\.length>20\}/);
  assert.match(ui,/Showing .* of .* workflows/);
});
