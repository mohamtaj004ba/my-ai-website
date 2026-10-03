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
  assert.match(block,/setAdminRestoreWorkspaceStatus\('Restoring workspace…'\)/);
  assert.match(block,/setAdminClientActionStatus\('Opening client view…'\)/);
  assert.match(block,/setAdminClientActionStatus\('Running recovery drill…'\)/);
  assert.match(block,/setAdminSyncState\(postDeleteWarning\?'error':'live'/);
});

test('workspace deletion and restoration safety confirmations remain explicit',()=>{
  const start=ui.indexOf('function setAdminDeleteWorkspaceStatus('),end=ui.indexOf('\nasync function viewAdminClient()',start),block=ui.slice(start,end);
  assert.match(html,/id="adminDeleteWorkspaceModal" role="dialog"/);
  assert.match(html,/Type <b>DELETE<\/b> to confirm/);
  assert.match(block,/typed!=='DELETE'/);
  assert.match(block,/This workspace changed after the confirmation opened/);
  assert.match(html,/id="adminRestoreWorkspaceModal" role="dialog"/);
  assert.match(block,/openAdminRestoreWorkspaceModal/);
  assert.match(block,/This workspace changed after the confirmation opened/);
});
