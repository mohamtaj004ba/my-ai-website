const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const account=fs.readFileSync(path.join(root,'api','account.js'),'utf8');
const launcherApi=fs.readFileSync(path.join(root,'api','preview-e2e.js'),'utf8');
const launcherClient=fs.readFileSync(path.join(root,'preview-e2e-client.js'),'utf8');

test('Preview QA sessions are guarded and production-inaccessible',()=>{
  assert.match(account,/async function previewQaSession\(req,res\)/);
  assert.match(account,/process\.env\.VERCEL_ENV!=='preview'/);
  assert.match(account,/!host\.endsWith\('\.vercel\.app'\)/);
  assert.match(account,/process\.env\.CALLERCORE_BOOTSTRAP_SECRET/);
  assert.match(account,/req\.headers\['x-bootstrap-secret'\]/);
  assert.match(account,/workspace\.previewQa!==true/);
  assert.match(account,/action==='preview-session'/);
  assert.match(account,/previewQa:true/);
  assert.match(account,/workspace\.previewQa=true/);
});

test('Preview launcher supports direct client and admin QA sessions',()=>{
  assert.match(launcherApi,/id="clientLogin"/);
  assert.match(launcherApi,/id="adminLogin"/);
  assert.match(launcherClient,/const seed = byId\('seed'\)/);
  assert.match(launcherClient,/post\('preview-session'/);
  assert.match(launcherClient,/openQaSession\(clientLogin, 'client'\)/);
  assert.match(launcherClient,/openQaSession\(adminLogin, 'admin'\)/);
  assert.match(launcherClient,/window\.location\.assign\(data\.redirect\)/);
});


test('Preview reseeding removes stale generated admin fixtures',()=>{
  assert.match(account,/staleSeedWorkspaceIds=index\.filter\(id=>String\(id\)\.startsWith\('seed_'\)\)/);
  assert.match(account,/keep=index\.filter\(id=>!String\(id\)\.startsWith\('seed_'\)\)/);
  assert.match(account,/!String\(x\.workspaceId\|\|''\)\.startsWith\('seed_'\)/);
  assert.match(account,/staleSupportIds=supportIds\.filter\(id=>String\(id\)\.startsWith\('seed_support_seed_'\)\)/);
  assert.match(account,/staleFeedbackIds=feedbackIds\.filter\(id=>String\(id\)\.startsWith\('seed_feedback_seed_'\)\)/);
});
