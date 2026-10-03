const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ui=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('admin-dashboard.html','utf8');

test('admin client workspace actions use accessible inline feedback instead of browser alerts',()=>{
  assert.match(html,/id="adminClientActionStatus" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(ui,/function setAdminClientActionStatus\(message='',tone=''\)/);
  const start=ui.indexOf('async function saveAdminClient()'),end=ui.indexOf('\nconst modal=document.getElementById(\'upgradeModal\')',start),block=ui.slice(start,end);
  assert.doesNotMatch(block,/\balert\s*\(/);
  assert.match(block,/setAdminClientActionStatus\('Saving workspace changes…'\)/);
  assert.match(block,/setAdminClientActionStatus\('Restoring workspace…'\)/);
  assert.match(block,/setAdminClientActionStatus\('Opening client view…'\)/);
  assert.match(block,/setAdminClientActionStatus\('Running recovery drill…'\)/);
  assert.match(block,/setAdminSyncState\(postDeleteWarning\?'error':'live'/);
});

test('workspace deletion and restoration safety confirmations remain explicit',()=>{
  const start=ui.indexOf('async function deleteAdminClient()'),end=ui.indexOf('\nasync function viewAdminClient()',start),block=ui.slice(start,end);
  assert.match(block,/confirm\('Schedule '/);
  assert.match(block,/prompt\('Type DELETE to schedule deletion of '/);
  assert.match(block,/confirm\('Restore '/);
});
