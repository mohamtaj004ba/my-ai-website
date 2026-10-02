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
