const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('admin build approval validates the confirmed state and surfaces delivery warnings',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const start=ui.indexOf('async function approveProvisioningBuild(id,button){');
  const end=ui.indexOf('\nasync function updateProvisioningChecklist(',start);
  assert.ok(start>=0&&end>start);
  const fn=ui.slice(start,end);
  assert.match(fn,/data\.ok!==true/);
  assert.match(fn,/data\.onboarding\.checklist\?\.adminReview!==true/);
  assert.match(fn,/if\(data\.warning\)alert\(String\(data\.warning\)\)/);
  assert.match(fn,/Build approval was saved, but onboarding could not refresh/);
  assert.match(fn,/finally\{if\(button\?\.isConnected\)\{button\.disabled=false;button\.textContent=idleLabel\}\}/);
  assert.match(fn,/loadNotifications\(\{silent:true\}\)\.catch/);
});


test('provisioning checklist mutations are serialized and require canonical acknowledgement',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const start=ui.indexOf('function setProvisioningChecklistControls(id,pending){');
  const end=ui.indexOf('\nfunction setProvisioningStageControls(',start);
  assert.ok(start>=0&&end>start);
  const block=ui.slice(start,end);
  assert.match(ui,/adminProvisioningChecklistPending=new Set\(\)/);
  assert.match(block,/if\(adminProvisioningChecklistPending\.has\(key\)\)return false/);
  assert.match(block,/setProvisioningChecklistControls\(key,true\)/);
  assert.match(block,/data\.ok!==true/);
  assert.match(block,/data\.onboarding\.checklist\?\.\[field\]!==value/);
  assert.match(block,/Checklist update was saved, but onboarding could not refresh/);
  assert.match(block,/if\(data\.warning\)alert\(String\(data\.warning\)\)/);
  assert.match(block,/loadNotifications\(\{silent:true\}\)\.catch/);
  assert.match(block,/finally\{adminProvisioningChecklistPending\.delete\(key\);setProvisioningChecklistControls\(key,false\);renderProvisioning\(\)\}/);
});


test('onboarding drawer stays open when checklist or build approval fails',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const start=ui.indexOf('function bindOnboardingDrawerActions(){');
  const end=ui.indexOf('\nfunction openOnboardingDrawer(',start);
  assert.ok(start>=0&&end>start);
  const fn=ui.slice(start,end);
  assert.match(fn,/if\(await updateProvisioningChecklist\([^\n]+\)\)closeOnboardingDrawer\(\)/);
  assert.match(fn,/if\(await approveProvisioningBuild\([^\n]+\)\)closeOnboardingDrawer\(\)/);
});
