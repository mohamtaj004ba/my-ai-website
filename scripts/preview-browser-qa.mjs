import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL=String(process.env.PREVIEW_URL||'').replace(/\/$/,'');
const secret=String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||'');
const qaEmail=String(process.env.CALLERCORE_QA_EMAIL||'preview-qa@callercore.test').trim().toLowerCase();
if(!baseURL)throw new Error('PREVIEW_URL is required');
const parsed=new URL(baseURL);
if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.vercel.app'))throw new Error('Authenticated QA only runs against protected Vercel Preview URLs');
if(!secret)throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required');

const outDir=path.resolve('qa-artifacts');
await fs.mkdir(outDir,{recursive:true});

const report={
  ok:false,
  previewUrl:baseURL,
  startedAt:new Date().toISOString(),
  client:{views:[],interactions:[],responsive:[]},
  admin:{views:[],interactions:[],responsive:[]},
  consoleErrors:[],
  pageErrors:[],
  apiErrors:[],
  layoutContracts:[],
  visualScreenshots:[]
};

const browser=await chromium.launch({headless:true});
const contexts=[];

function attachDiagnostics(page,label){
  page.on('console',msg=>{
    if(msg.type()==='error')report.consoleErrors.push({label,message:msg.text().slice(0,1200)});
  });
  page.on('pageerror',err=>report.pageErrors.push({label,message:String(err?.message||err).slice(0,1200)}));
  page.on('response',res=>{
    try{
      const u=new URL(res.url());
      if(u.origin===parsed.origin&&u.pathname.startsWith('/api/')&&res.status()>=400){
        report.apiErrors.push({label,status:res.status(),url:u.pathname+u.search});
      }
    }catch{}
  });
}

async function makeContext(viewport,label){
  const context=await browser.newContext({
    viewport,
    extraHTTPHeaders:{
      'x-vercel-protection-bypass':secret,
      'x-vercel-set-bypass-cookie':'true'
    }
  });
  contexts.push(context);
  const page=await context.newPage();
  attachDiagnostics(page,label);
  return {context,page};
}

const qaHeaders={
  'content-type':'application/json',
  'x-bootstrap-secret':secret,
  'x-qa-secret':secret
};

async function post(request,action,data){
  const res=await request.post(baseURL+'/api/account?action='+encodeURIComponent(action),{headers:qaHeaders,data});
  const text=await res.text();
  let body={};
  try{body=text?JSON.parse(text):{}}catch{}
  if(!res.ok())throw new Error(action+' failed ('+res.status()+'): '+String(body.error||text||'unknown error').slice(0,500));
  return body;
}

async function gotoAuthed(page,route,requiredSelector){
  const res=await page.goto(baseURL+route,{waitUntil:'domcontentloaded',timeout:30000});
  if(!res||!res.ok())throw new Error(route+' returned '+(res?res.status():'no response'));
  await page.waitForSelector(requiredSelector,{timeout:20000});
  await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
  await page.waitForTimeout(1000);
  const body=await page.locator('body').innerText();
  if(/sign in to callercore|authentication required/i.test(body))throw new Error(route+' rendered an authentication screen');
}

async function shot(page,name,{fullPage=true}={}){
  const file=name.replace(/[^a-z0-9_-]+/gi,'-')+'.png';
  await page.screenshot({path:path.join(outDir,file),fullPage});
  report.visualScreenshots.push(file);
  return file;
}

async function assertLayout(page,label,{allowHorizontalOverflow=false}={}){
  const state=await page.evaluate(()=>{
    const active=document.querySelector('.view.active');
    const topbar=document.querySelector('.topbar');
    const main=document.querySelector('.dashboard-main');
    const box=el=>el?(()=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}})():null;
    return {
      viewport:{width:window.innerWidth,height:window.innerHeight},
      scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
      activeView:active?.id||'',
      activeBox:box(active),
      topbarBox:box(topbar),
      mainBox:box(main),
      overflowers:[...document.querySelectorAll('body *')].map(el=>{
        const r=el.getBoundingClientRect(),style=getComputedStyle(el);
        return {tag:el.tagName.toLowerCase(),id:el.id||'',className:String(el.className||'').slice(0,160),text:String(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,120),parent:el.parentElement?{tag:el.parentElement.tagName.toLowerCase(),id:el.parentElement.id||'',className:String(el.parentElement.className||'').slice(0,140)}:null,ancestor:el.parentElement?.parentElement?{tag:el.parentElement.parentElement.tagName.toLowerCase(),id:el.parentElement.parentElement.id||'',className:String(el.parentElement.parentElement.className||'').slice(0,140)}:null,left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),position:style.position,display:style.display,overflowX:style.overflowX};
      }).filter(x=>x.display!=='none'&&(x.right>window.innerWidth+4||x.left<-4)).sort((a,b)=>(b.right-window.innerWidth)-(a.right-window.innerWidth)).slice(0,12)
    };
  });
  report.layoutContracts.push({label,...state});
  if(!state.activeView)throw new Error(label+' has no active dashboard view');
  if(!allowHorizontalOverflow&&state.scrollWidth>state.viewport.width+4){
    throw new Error(label+' horizontally overflows viewport: '+state.scrollWidth+'px > '+state.viewport.width+'px; offenders='+JSON.stringify(state.overflowers));
  }
  if(!state.activeBox||state.activeBox.width<=0||state.activeBox.height<=0)throw new Error(label+' active view is not rendered');
}

async function ensureView(page,view){
  const btn=page.locator('button.nav-item[data-view="'+view+'"]').first();
  if(!(await btn.count()))throw new Error('Missing nav view '+view);
  if(!(await btn.isVisible())){
    const menu=page.locator('.mobile-menu').first();
    if(await menu.isVisible()){await menu.click();await page.waitForTimeout(120)}
  }
  await btn.click();
  await page.waitForTimeout(450);
  const active=await btn.evaluate(el=>el.classList.contains('active'));
  if(!active)throw new Error('Navigation did not activate '+view);
}

async function sweepViews(page,kind){
  const selector='button.nav-item[data-view]';
  const views=await page.locator(selector).evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('data-view')).filter(Boolean))]);
  for(const view of views){
    await ensureView(page,view);
    await shot(page,kind+'-'+view);
    report[kind].views.push(view);
  }
}

async function seedWorkspace(request){
  const boot=await post(request,'bootstrap-preview',{email:qaEmail,businessName:'Summit Heating & Air',plan:'Pro'});
  report.workspaceId=boot.workspaceId||'';
  report.workspaceReused=!!boot.reused;
  const seed=await post(request,'seed-preview-data',{email:qaEmail});
  report.seed={calls:seed.calls,leads:seed.leads,conversations:seed.conversations,adminClients:seed.adminClients,days:seed.days};
}

async function startSession(context,mode){
  const data=await post(context.request,'preview-session',{email:qaEmail,mode});
  const expected=mode==='admin'?'/admin-dashboard':'/dashboard';
  if(data.redirect!==expected)throw new Error('Unexpected '+mode+' redirect: '+String(data.redirect));
}

async function runClientInteractions(page){
  await ensureView(page,'calls');
  await page.locator('#callDateFilter').selectOption('all');
  await page.waitForTimeout(250);
  const firstCall=page.locator('#callsTable [data-call-id]').first();
  await firstCall.waitFor({state:'visible',timeout:10000});
  await firstCall.click();
  await page.locator('#callDrawer.open').waitFor({state:'visible',timeout:5000});
  if(await page.locator('#callDrawer').getAttribute('aria-hidden')!=='false')throw new Error('Call drawer aria state did not open');
  report.client.interactions.push('open call detail drawer');
  await page.locator('#closeCallDrawer').click();

  await page.locator('#callSearch').fill('__qa_no_match__');
  await page.waitForTimeout(250);
  if(await page.locator('#callsTable [data-call-id]').count()!==0)throw new Error('Call search did not filter unmatched query');
  await page.locator('#callSearch').fill('');
  report.client.interactions.push('call search filter');

  await ensureView(page,'settings');
  const originalName=await page.locator('#settingsBusinessName').inputValue();
  await page.locator('#settingsEditButton').click();
  await page.locator('#saveSettingsButton').waitFor({state:'visible'});
  await page.locator('#settingsBusinessName').fill(originalName+' QA TEMP');
  await page.locator('#settingsCancelButton').click();
  await page.waitForTimeout(150);
  if(await page.locator('#settingsBusinessName').inputValue()!==originalName)throw new Error('Settings cancel did not restore business name');
  report.client.interactions.push('settings edit/cancel rollback');

  await ensureView(page,'support');
  await page.locator('#supportSubject').fill('QA unsent support draft');
  await page.locator('#supportMessage').fill('Browser QA verifies support form editing without creating a ticket.');
  if(!(await page.locator('#submitSupportButton').isEnabled()))throw new Error('Support submit unexpectedly disabled');
  await page.locator('#supportSubject').fill('');
  await page.locator('#supportMessage').fill('');
  report.client.interactions.push('support form editability');

  await page.locator('#accountButton').click();
  if(await page.locator('#accountPanel').getAttribute('hidden')!==null)throw new Error('Account panel did not open');
  await page.locator('#accountButton').click();
  report.client.interactions.push('account/profile panel');

  await page.locator('#notificationBell').click();
  if(await page.locator('#notificationPanel').getAttribute('hidden')!==null)throw new Error('Notification panel did not open');
  const history=page.locator('#notificationHistoryTab');
  if(await history.count()){await history.click();await page.locator('#notificationUnreadTab').click()}
  await page.locator('#notificationBell').click();
  report.client.interactions.push('notification panel/tabs');

  await ensureView(page,'overview');
  await page.locator('#refreshClientCommand').click();
  await page.waitForTimeout(650);
  report.client.interactions.push('client live refresh');
}

async function runAdminInteractions(page){
  await page.locator('#adminSearch').fill('North Ridge Plumbing');
  const clientResult=page.locator('[data-global-search-type="client"]').first();
  await clientResult.waitFor({state:'visible',timeout:8000});
  await clientResult.click();
  await page.locator('#adminClientDrawer.open').waitFor({state:'visible',timeout:8000});
  report.admin.interactions.push('global search → client deep link');
  await page.locator('#closeAdminClient').click();

  await page.locator('#adminSearch').fill('System Health');
  await page.locator('#adminSearch').press('Enter');
  await page.locator('#view-health.active').waitFor({state:'visible',timeout:5000});
  report.admin.interactions.push('global search keyboard navigation');

  await ensureView(page,'clients');
  await page.locator('#adminClientSearchInput').fill('North Ridge');
  await page.waitForTimeout(250);
  if(await page.locator('#adminClientsTable [data-admin-client-row]').count()<1)throw new Error('Admin client search did not return seeded client');
  await page.locator('#adminClientSearchInput').fill('');
  report.admin.interactions.push('client account search');

  await ensureView(page,'growth');
  await page.locator('#growthSearch').fill('North');
  await page.waitForTimeout(180);
  await page.locator('#growthSearch').fill('');
  report.admin.interactions.push('growth pipeline search');

  await ensureView(page,'onboarding');
  await page.locator('#onboardingSearch').fill('Lakeview');
  await page.waitForTimeout(180);
  await page.locator('#onboardingSearch').fill('');
  report.admin.interactions.push('onboarding search');

  await page.route('**/api/account?action=admin-ai-guide',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:'QA stub response from Core Intelligence.'})});
  });
  await page.locator('#adminAiLaunch').click();
  await page.locator('#adminAiPanel.open').waitFor({state:'visible'});
  await page.locator('#adminAiInput').fill('QA enter-to-send check');
  await page.locator('#adminAiInput').press('Enter');
  await page.getByText('QA stub response from Core Intelligence.').waitFor({state:'visible',timeout:5000});
  await page.locator('#adminAiClose').click();
  await page.unroute('**/api/account?action=admin-ai-guide');
  report.admin.interactions.push('Core Intelligence open + Enter-to-send');

  await page.locator('#notificationBell').click();
  if(await page.locator('#notificationPanel').getAttribute('hidden')!==null)throw new Error('Admin notification panel did not open');
  await page.locator('#notificationBell').click();
  report.admin.interactions.push('admin notification panel');

  await ensureView(page,'overview');
  await page.locator('#refreshAdminCommand').click();
  await page.waitForTimeout(650);
  report.admin.interactions.push('admin live refresh');
}

async function runResponsive(kind,viewport,name){
  const route=kind==='admin'?'/admin-dashboard':'/dashboard';
  const required='button.nav-item[data-view="overview"]';
  const {context,page}=await makeContext(viewport,kind+'-'+name);
  try{
    await startSession(context,kind);
    await gotoAuthed(page,route,required);
    await assertLayout(page,kind+'-'+name+'-overview');
    await shot(page,kind+'-'+name+'-overview');

    const menu=page.locator('.mobile-menu');
    if(viewport.width<=760){
      await menu.waitFor({state:'visible',timeout:5000});
      await menu.click();
      if(!(await page.locator('.sidebar').evaluate(el=>el.classList.contains('open'))))throw new Error(kind+' '+name+' mobile menu did not open sidebar');
      await shot(page,kind+'-'+name+'-menu',{fullPage:false});
      await ensureView(page,kind==='admin'?'clients':'calls');
      await assertLayout(page,kind+'-'+name+'-secondary',{allowHorizontalOverflow:false});
      await shot(page,kind+'-'+name+'-'+(kind==='admin'?'clients':'calls'));
    }
    report[kind].responsive.push({name,...viewport});
  }finally{
    await context.close().catch(()=>{});
  }
}

try{
  const desktop=await makeContext({width:1440,height:1100},'desktop');
  const launcher=await desktop.page.goto(baseURL+'/api/preview-e2e',{waitUntil:'domcontentloaded',timeout:30000});
  if(!launcher||!launcher.ok())throw new Error('Preview launcher returned '+(launcher?launcher.status():'no response'));
  await desktop.page.waitForSelector('#create',{timeout:10000});

  await seedWorkspace(desktop.context.request);

  await startSession(desktop.context,'client');
  await gotoAuthed(desktop.page,'/dashboard','button.nav-item[data-view="overview"]');
  await assertLayout(desktop.page,'client-desktop-overview');
  await shot(desktop.page,'client-overview-initial');
  await sweepViews(desktop.page,'client');
  await runClientInteractions(desktop.page);

  await startSession(desktop.context,'admin');
  await gotoAuthed(desktop.page,'/admin-dashboard','button.nav-item[data-view="overview"]');
  await assertLayout(desktop.page,'admin-desktop-overview');
  await shot(desktop.page,'admin-overview-initial');
  await sweepViews(desktop.page,'admin');
  await runAdminInteractions(desktop.page);

  // Preview QA sessions deliberately revoke older sessions. Close the desktop
  // context before issuing the next session so strict 401 detection only sees
  // authentication failures from the context currently under test.
  await desktop.context.close();

  await runResponsive('client',{width:1280,height:800},'laptop');
  await runResponsive('admin',{width:1280,height:800},'laptop');
  await runResponsive('client',{width:768,height:1024},'tablet');
  await runResponsive('admin',{width:768,height:1024},'tablet');
  await runResponsive('client',{width:390,height:844},'mobile');
  await runResponsive('admin',{width:390,height:844},'mobile');

  if(report.pageErrors.length)throw new Error('Page errors: '+JSON.stringify(report.pageErrors));
  if(report.consoleErrors.length)throw new Error('Console errors: '+JSON.stringify(report.consoleErrors));
  if(report.apiErrors.length)throw new Error('Unexpected API errors: '+JSON.stringify(report.apiErrors));

  report.ok=true;
}catch(err){
  report.ok=false;
  report.failure=String(err?.stack||err);
  try{
    const last=contexts.at(-1);
    const pages=last?.pages?.()||[];
    if(pages[0])await pages[0].screenshot({path:path.join(outDir,'failure.png'),fullPage:true});
  }catch{}
  throw err;
}finally{
  report.finishedAt=new Date().toISOString();
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2));
  await fs.writeFile(path.join(outDir,'layout-contracts.json'),JSON.stringify(report.layoutContracts,null,2));
  await fs.writeFile(path.join(outDir,'visual-manifest.json'),JSON.stringify(report.visualScreenshots,null,2));
  await Promise.allSettled(contexts.map(c=>c.close()));
  await browser.close();
}
