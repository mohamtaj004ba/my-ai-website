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


test('Preview browser QA covers interactions responsive layouts and strict API failures',()=>{
  const qa=fs.readFileSync(path.join(root,'scripts','preview-browser-qa.mjs'),'utf8');
  const visual=fs.readFileSync(path.join(root,'scripts','visual-diff.mjs'),'utf8');
  const workflow=fs.readFileSync(path.join(root,'.github','workflows','preview-browser-qa.yml'),'utf8');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.match(qa,/runClientInteractions/);
  assert.match(qa,/runAdminInteractions/);
  assert.match(qa,/width:390,height:844/);
  assert.match(qa,/width:768,height:1024/);
  assert.match(qa,/horizontally overflows viewport/);
  assert.match(qa,/Unexpected API errors/);
  assert.doesNotMatch(qa,/!\\[401,404\\]\\.includes/);
  assert.equal(pkg.devDependencies.playwright,'1.55.0');
  assert.equal(pkg.devDependencies.pixelmatch,'7.1.0');
  assert.equal(pkg.devDependencies.pngjs,'7.0.0');
  assert.match(workflow,/Cache Playwright browser/);
  assert.match(workflow,/Restore previous successful visual baseline/);
  assert.match(workflow,/Compare visual drift/);
  assert.match(visual,/pixelmatch/);
});


test('drawer open state wins over off-canvas resting offsets',()=>{
  const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');
  assert.ok(css.lastIndexOf('.call-drawer.open{right:0}')>css.lastIndexOf('.call-drawer{right:-590px'));
  assert.ok(css.lastIndexOf('#adminClientDrawer.open{right:0}')>css.lastIndexOf('#adminClientDrawer{right:-760px'));
});

test('Preview QA uses the committed dependency lockfile',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github','workflows','preview-browser-qa.yml'),'utf8');
  const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
  assert.match(workflow,/npm ci --ignore-scripts/);
  assert.equal(lock.lockfileVersion,3);
  assert.equal(lock.packages[''].devDependencies.playwright,'1.55.0');
});


test('closed admin client drawer does not widen mobile viewport',()=>{
  const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');
  assert.match(css,/#adminClientDrawer\{right:0;transform:translateX\(calc\(100% \+ 24px\)\);visibility:hidden;pointer-events:none\}/);
  assert.match(css,/#adminClientDrawer\.open\{right:0;transform:translateX\(0\);visibility:visible;pointer-events:auto\}/);
});


test('closed admin side panels are removed from scroll geometry',()=>{
  const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');
  assert.match(css,/#adminClientDrawer:not\(\.open\),\s*\.onboarding-detail-drawer:not\(\.open\),\s*\.admin-ai-panel:not\(\.open\)\{display:none\}/);
  assert.match(css,/#adminClientDrawer\.open\{display:block\}/);
  assert.match(css,/\.onboarding-detail-drawer\.open,\s*\.admin-ai-panel\.open\{display:grid\}/);
});


test('recent admin client rows shrink text beside avatars on mobile',()=>{
  const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');
  assert.match(css,/\.admin-recent-row \.person\{min-width:0;width:100%\}/);
  assert.match(css,/\.admin-recent-row \.person>span\{flex:1 1 auto;min-width:0;width:auto;max-width:100%\}/);
  assert.match(css,/grid-template-columns:32px minmax\(0,1fr\)/);
  assert.match(css,/\.admin-recent-row \.person>span\{\s*min-width:0;\s*width:auto;\s*max-width:none;/);
  assert.match(css,/\.admin-recent-accounts \.panel-head\{flex-direction:column;align-items:flex-start;gap:10px\}/);
});


test('mobile Command Center attention rows stay inside their cards',()=>{
  const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');
  assert.match(css,/\.admin-attention-item\{\s*width:100%!important;\s*margin:0!important;\s*padding:12px 0!important;\s*grid-template-columns:8px minmax\(0,1fr\) auto!important;/);
  assert.match(css,/\.admin-attention-item>span:not\(\.attention-severity-dot\)\{\s*grid-column:2\/-1;\s*width:auto;\s*max-width:100%;\s*white-space:normal;\s*overflow-wrap:anywhere;/);
});
