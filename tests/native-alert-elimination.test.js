const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ui=fs.readFileSync('dashboard.js','utf8');

test('routine dashboard feedback no longer uses native browser alerts',()=>{
  assert.doesNotMatch(ui,/\b(?:window\.)?alert\s*\(/);
});

test('consequential confirmations remain explicit after alert cleanup',()=>{
  assert.match(ui,/confirm\('Delete automation /);
  assert.match(ui,/confirm\('Delete location /);
  assert.match(ui,/openAdminActionConfirmation\(\{title:'Disconnect admin Gmail'/);
  assert.match(ui,/openAdminDeleteWorkspaceModal/);
  assert.match(ui,/typed!=='DELETE'/);
  assert.match(ui,/openAdminRestoreWorkspaceModal/);
  assert.match(ui,/admin-client-delete-restore/);
});
