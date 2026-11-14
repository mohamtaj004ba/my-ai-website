const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');

test('suspended workspaces are read-only for operational client changes',()=>{
  assert.match(api,/async function requireOperationalWorkspace\(s,res\)/);
  assert.match(api,/ws\.status==='suspended'[\s\S]*?status\(423\)/);
  for(const name of ['followupUpdate','saveLocations','saveAgent','saveAutomations','updateAppointment','saveSettings','aiAnsweringControl','saveIntegrations','updateLead']){
    const marker='async function '+name+'(req,res){\n  const s=await requireWritableSession(req,res);if(!s)return;\n  if(!await requireOperationalWorkspace(s,res))return;';
    assert.ok(api.includes(marker),name+' must keep the base write guard and suspension guard');
  }
});

test('suspended clients retain billing support and clear portal guidance',()=>{
  assert.ok(api.includes("async function createSupportTicket(req,res){\n  const s=await requireWritableSession(req,res);"));
  assert.ok(api.includes("async function billingPortal(req,res){\n  const s=await requireWritableSession(req,res);"));
  assert.match(html,/id="workspaceHoldBanner"/);
  assert.match(dashboard,/function renderWorkspaceAccessState\(\)/);
  assert.match(dashboard,/sessionWorkspace\?\.status==='suspended'/);
});
