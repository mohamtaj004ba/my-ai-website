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

async function assertPendingSave(page,action,saveSelector,fieldSelector,cancelSelector){
  const pattern='**/api/account?action='+action;
  let release,started;
  const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);
  await page.route(pattern,async route=>{started();await held;await route.continue()},{times:1});
  try{
    await page.locator(saveSelector).click();
    await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Save request not received')),10000))]);
    if(await page.locator(fieldSelector).isEnabled()||await page.locator(cancelSelector).isEnabled())throw new Error('Pending save left editable controls enabled');
    const active=await page.locator('.view.active').getAttribute('id');
    await page.evaluate(()=>document.querySelector('[data-view="overview"]').click());
    if(await page.locator('.view.active').getAttribute('id')!==active)throw new Error('Navigation interrupted a pending save');
  }finally{release()}
}

async function assertAdminTechPendingOverride(page){
  await page.locator('#adminConfigEditor').waitFor({state:'visible',timeout:8000});
  await page.waitForFunction(()=>document.querySelector('#adminConfigEditor')?.value.trim().length>1);
  let release,started;const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);
  await page.route('**/api/account?action=admin-config-override',async route=>{started();await held;await route.continue()},{times:1});
  page.once('dialog',dialog=>dialog.accept());
  try{
    await page.locator('#adminApplyOverrideButton').click();
    await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Admin override request not received')),10000))]);
    for(const selector of ['#adminConfigSection','#adminConfigEditor','#adminReloadConfigButton','#adminApplyOverrideButton','#closeAdminClient']){
      if(await page.locator(selector).isEnabled())throw new Error('Pending admin override left '+selector+' enabled');
    }
    await page.evaluate(()=>closeAdminClient());
    if(!await page.locator('#adminClientDrawer').evaluate(el=>el.classList.contains('open')))throw new Error('Pending admin override allowed the client drawer to close');
  }finally{release()}
  await page.locator('#adminApplyOverrideButton').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#adminApplyOverrideButton')?.disabled);
}

async function assertRefreshPreservesDraft(page,savedName){
  let release,started;
  const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);
  await page.route('**/api/account?action=client-dashboard-data',async route=>{started();await held;await route.continue()},{times:1});
  try{
    await page.evaluate(()=>{window.__qaPendingRefresh=refreshClientDashboard({silent:true})});
    await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Refresh request not received')),10000))]);
    await page.locator('[data-agent-edit="identity"]').click();
    await page.locator('#agentName').fill(savedName+' protected draft');
    release();await page.evaluate(()=>window.__qaPendingRefresh);
    if(await page.locator('#agentName').inputValue()!==savedName+' protected draft')throw new Error('An in-flight refresh replaced the receptionist draft');
    await page.locator('[data-agent-cancel="identity"]').click();
  }finally{release()}
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
  const menu=page.locator('.mobile-menu').first();
  if(await menu.isVisible()){
    const sidebarOpen=await page.locator('.sidebar').evaluate(el=>el.classList.contains('open'));
    if(!sidebarOpen){await menu.click();await page.waitForTimeout(250)}
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
  const rehearsal=(await post(request,'preview-conversation-migration-rehearsal',{email:qaEmail})).rehearsal;
  if(!rehearsal||rehearsal.mode!=='preview_rehearsal'||rehearsal.writeScope!=='shadow_only'||rehearsal.productionExecutorReachable!==false||
     rehearsal.migrationExecutorReachable!==false||rehearsal.legacySourcePreserved!==true||rehearsal.publishReadEquivalent!==true||
     rehearsal.detailFidelityComplete!==true||rehearsal.rollbackApplied!==true||rehearsal.rollbackReadEquivalent!==true||
     rehearsal.concurrentChangeBlocked!==true||rehearsal.concurrentStatePreserved!==true||rehearsal.shadowCleaned!==true||rehearsal.complete!==true)
    throw new Error('Preview conversation migration rehearsal did not prove reversible publication/rollback');
  if(Number(rehearsal.conversationCount||0)!==Number(seed.conversations||0))throw new Error('Preview migration rehearsal conversation count did not match the seeded source');
  const rehearsalJson=JSON.stringify(rehearsal);
  if(rehearsalJson.includes(report.workspaceId)||rehearsalJson.includes('Summit Heating')||rehearsalJson.includes('@callercore.test'))
    throw new Error('Preview migration rehearsal exposed workspace-level data');
  report.admin.interactions.push('shadow-only conversation migration publish/rollback rehearsal');
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

  const initialCallCount=await page.locator('#callsTable [data-call-id]').count();
  const metaText=await page.locator('#callListMeta').textContent();
  const match=String(metaText||'').match(/Showing\s+(\d+)\s+of\s+(\d+)/i);
  if(!match)throw new Error('Call history did not expose progressive-load count context');
  const shown=Number(match[1]),total=Number(match[2]);
  if(shown!==initialCallCount)throw new Error('Call history visible-row count does not match footer');
  if(total>50){
    if(initialCallCount!==50)throw new Error('High-volume call history did not start at 50 rows');
    const more=page.locator('#loadMoreCalls');
    if(!(await more.isVisible()))throw new Error('High-volume call history hid Load more too early');
    await more.click();
    await page.waitForTimeout(180);
    const expanded=await page.locator('#callsTable [data-call-id]').count();
    if(expanded<=initialCallCount)throw new Error('Load more did not increase visible calls');
  }
  report.client.interactions.push('call progressive loading');

  if(!(await page.locator('#callDensity').isVisible())){
    await page.locator('#toggleCallMoreFilters').click();
    await page.locator('#callMoreFilters').waitFor({state:'visible',timeout:5000});
  }
  await page.locator('#callDensity').selectOption('compact');
  if(!(await page.locator('.call-history-panel').evaluate(el=>el.classList.contains('call-density-compact'))))throw new Error('Compact call density did not apply');
  await page.locator('#callDensity').selectOption('comfortable');
  report.client.interactions.push('advanced call filters + density preference');

  const unopened=page.locator('#callsUnviewedCount');
  await unopened.click();
  await page.waitForTimeout(120);
  if(!(await unopened.evaluate(el=>el.classList.contains('active'))))throw new Error('Not opened quick filter did not activate');
  await page.locator('#callsShownCount').click();
  report.client.interactions.push('not-opened call filter');

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

  await ensureView(page,'contacts');
  const initialContacts=await page.locator('#contactsTable [data-contact-key]').count();
  const contactMetaText=await page.locator('#contactListMeta').textContent();
  const contactMatch=String(contactMetaText||'').match(/Showing\s+(\d+)\s+of\s+(\d+)/i);
  if(!contactMatch)throw new Error('Contacts did not expose progressive-load count context');
  const contactShown=Number(contactMatch[1]),contactTotal=Number(contactMatch[2]);
  if(contactShown!==initialContacts)throw new Error('Contacts visible-row count does not match footer');
  if(contactTotal>50){
    if(initialContacts!==50)throw new Error('High-volume Contacts did not start at 50 rows');
    const moreContacts=page.locator('#loadMoreContacts');
    if(!(await moreContacts.isVisible()))throw new Error('High-volume Contacts hid Load more too early');
    await moreContacts.click();
    await page.waitForTimeout(160);
    if(await page.locator('#contactsTable [data-contact-key]').count()<=initialContacts)throw new Error('Load more did not increase visible contacts');
  }
  await page.locator('#contactTypeFilter').selectOption('Customer');
  await page.waitForTimeout(120);
  if(await page.locator('#contactsTable [data-contact-key]').count()<1)throw new Error('Customer contact filter returned no seeded contacts');
  await page.locator('#contactTypeFilter').selectOption('all');
  await page.locator('#contactSort').selectOption('name');
  await page.waitForTimeout(100);
  const firstContact=page.locator('#contactsTable [data-contact-key]').first();
  await firstContact.click();
  await page.locator('#contactDrawer.open').waitFor({state:'visible',timeout:5000});
  await page.locator('#closeContactDrawer').click();
  report.client.interactions.push('contact scaling + filters + detail drawer');

  await ensureView(page,'conversations');
  await page.locator('#conversationApp').waitFor({state:'visible',timeout:5000});
  if(await page.locator('#conversationThreads .thread-item').count()<1)throw new Error('Conversations navigation opened without seeded threads');
  await page.waitForFunction(()=>document.querySelectorAll('#messageStream .message').length===50);
  if(await page.locator('#messageStream .message').count()!==50)throw new Error('Long conversation did not render its latest message batch');
  await page.locator('#loadEarlierMessages').click();
  if(await page.locator('#messageStream .message').count()!==100)throw new Error('Earlier conversation messages did not load');
  await page.locator('#loadEarlierMessages').click();
  if(await page.locator('#messageStream .message').count()!==122||await page.locator('#loadEarlierMessages').count())throw new Error('Final message batch did not expose complete seeded history');
  await page.locator('#conversationThreads .thread-item').nth(1).click();
  await page.locator('#conversationThreads .thread-item').first().click();
  if(await page.locator('#messageStream .message').count()!==50)throw new Error('Message batch did not reset when changing threads');
  await page.locator('#conversationContactButton').click();
  await page.locator('#contactDrawer.open').waitFor({state:'visible',timeout:5000});
  await page.waitForFunction(()=>document.querySelector('#contactDrawer')?.getAttribute('aria-busy')==='false');
  await page.locator('[data-contact-history-filter="message"]').click();
  const contactMessageSession=page.locator('[data-contact-message-session]').first();await contactMessageSession.waitFor({state:'visible'});await contactMessageSession.locator('summary').click();
  if(await contactMessageSession.locator('.contact-message').count()!==50)throw new Error('Contact message history did not start with its latest 50 messages');
  await contactMessageSession.locator('[data-load-contact-messages]').click();
  if(await page.locator('[data-contact-message-session][open] .contact-message').count()!==100)throw new Error('Contact message history did not load an earlier batch');
  await page.locator('[data-contact-message-session][open] [data-load-contact-messages]').click();
  if(await page.locator('[data-contact-message-session][open] .contact-message').count()!==122||await page.locator('[data-contact-message-session][open] [data-load-contact-messages]').count())throw new Error('Contact message history did not expose the complete seeded session');
  await page.locator('#closeContactDrawer').click();
  report.client.interactions.push('long conversation history progressive loading');
  report.client.interactions.push('contact message session progressive loading');
  const conversationTotal=report.seed.conversations;
  const initialThreads=await page.locator('#conversationThreads .thread-item').count();
  if(initialThreads!==Math.min(50,conversationTotal))throw new Error('Conversations initial page size is incorrect');
  if(conversationTotal>50){
    await page.locator('#loadMoreConversations').click();
    await page.waitForFunction(expected=>document.querySelectorAll('#conversationThreads .thread-item').length===expected,Math.min(100,conversationTotal));
    if(await page.locator('#conversationThreads .thread-item').count()!==Math.min(100,conversationTotal))throw new Error('Conversations Load more did not expand the list');
  }
  await page.locator('#conversationSort').selectOption('oldest');
  await page.waitForFunction(expected=>document.querySelectorAll('#conversationThreads .thread-item').length===expected,Math.min(50,conversationTotal));
  if(await page.locator('#conversationThreads .thread-item').count()!==Math.min(50,conversationTotal))throw new Error('Conversation sort did not reset page size');
  await page.locator('#conversationContactButton').click();
  await page.locator('#contactDrawer.open').waitFor({state:'visible',timeout:5000});
  await page.locator('#closeContactDrawer').click();
  await page.locator('#conversationSearch').fill('__qa_no_match__');
  await page.waitForFunction(()=>document.querySelectorAll('#conversationThreads .thread-item').length===0);
  if(await page.locator('#conversationThreads .thread-item').count()!==0)throw new Error('Conversation search did not filter unmatched query');
  if(await page.locator('#conversationStatus').isVisible())throw new Error('Empty search retained a stale status');
  await page.locator('#resetConversationFilters').click();
  await page.waitForFunction(()=>document.querySelectorAll('#conversationThreads .thread-item').length>0);
  if(await page.locator('#conversationSort').inputValue()!=='newest')throw new Error('Clear filters did not restore latest activity order');
  await page.locator('[data-conversation-filter="attention"]').click();
  await page.waitForFunction(()=>!document.querySelector('#loadMoreConversations')?.disabled);
  await page.locator('[data-conversation-filter="all"]').click();
  await page.waitForFunction(()=>!document.querySelector('#loadMoreConversations')?.disabled);
  report.client.interactions.push('Conversations progressive loading + sorting + contact drawer + search/empty/reset');

  await ensureView(page,'leads');
  const firstFollowup=page.locator('#leadKanban .followup-card').first();
  await firstFollowup.waitFor({state:'visible',timeout:5000});
  if(await firstFollowup.locator('[data-team-status]').count()!==1)throw new Error('Follow-up row lost its team status control');
  const viewCall=firstFollowup.locator('.followup-view-call');
  await viewCall.click();
  await page.locator('#callDrawer.open').waitFor({state:'visible',timeout:5000});
  await page.locator('#closeCallDrawer').click();
  report.client.interactions.push('Follow-ups action hierarchy + call detail');

  await ensureView(page,'agent');
  const savedAgentName=await page.locator('#agentName').inputValue();
  await assertRefreshPreservesDraft(page,savedAgentName);
  report.client.interactions.push('in-flight refresh preserves newer draft');
  if(await page.locator('#agentName').isEnabled())throw new Error('Receptionist field editable before Edit');
  await page.locator('[data-agent-edit="identity"]').click();
  await page.locator('#agentName').fill(savedAgentName+' draft');
  await page.locator('[data-agent-cancel="identity"]').click();
  if(await page.locator('#agentName').inputValue()!==savedAgentName)throw new Error('Receptionist cancel did not restore saved name');
  report.client.interactions.push('receptionist explicit editing + draft cancellation');
  await page.locator('[data-agent-edit="identity"]').click();
  await page.locator('#agentName').fill(savedAgentName+' QA');
  await assertPendingSave(page,'agent-save','[data-agent-save="identity"]','#agentName','[data-agent-cancel="identity"]');
  await page.locator('#agentFormStatus.success').waitFor({state:'visible',timeout:10000});
  const savedAgent=await page.request.get(baseURL+'/api/account?action=agent');
  if(!savedAgent.ok()||(await savedAgent.json()).agent.name!==savedAgentName+' QA')throw new Error('Receptionist name did not persist');
  await page.locator('[data-agent-edit="identity"]').click();
  await page.locator('#agentName').fill(savedAgentName);
  await page.locator('[data-agent-save="identity"]').click();
  await page.locator('#agentFormStatus.success').waitFor({state:'visible',timeout:10000});
  const originalTransfer=await page.locator('#agentTransfer').inputValue();
  await page.locator('[data-agent-edit="knowledge"]').click();
  await page.locator('#agentTransfer').fill('(509) 555-0109');
  await page.locator('[data-agent-save="knowledge"]').click();
  await page.locator('#agentFormStatus.success').waitFor({state:'visible',timeout:10000});
  const route=await page.request.get(baseURL+'/api/account?action=phone-routing');
  if(!route.ok()||(await route.json()).routing.transferNumber!=='(509) 555-0109')throw new Error('Receptionist transfer did not synchronize to routing');
  await page.locator('[data-agent-edit="knowledge"]').click();
  await page.locator('#agentTransfer').fill(originalTransfer);
  await page.locator('[data-agent-save="knowledge"]').click();
  await page.locator('#agentFormStatus.success').waitFor({state:'visible',timeout:10000});
  if(await page.locator('#agentTestCall').isVisible())throw new Error('Unverified voice number offered as a live test call');
  report.client.interactions.push('receptionist persisted save/restore + routing synchronization');


  await ensureView(page,'settings');
  if(await page.locator('#toggleAiAnsweringButton').isEnabled())throw new Error('Unconnected live call control is enabled');
  const originalName=await page.locator('#settingsBusinessName').inputValue();
  await page.locator('#settingsEditButton').click();
  await page.locator('#saveSettingsButton').waitFor({state:'visible'});
  await page.locator('#settingsBusinessName').fill('');
  await page.locator('#saveSettingsButton').click();
  if(await page.locator('#settingsBusinessName').getAttribute('aria-invalid')!=='true')throw new Error('Settings required field not identified');
  await page.locator('#settingsBusinessName').fill(originalName+' QA TEMP');
  await page.locator('#settingsCancelButton').click();
  await page.waitForTimeout(150);
  if(await page.locator('#settingsBusinessName').inputValue()!==originalName)throw new Error('Settings cancel did not restore business name');
  if(await page.locator('#settingsBusinessName').getAttribute('aria-invalid')==='true')throw new Error('Settings cancel retained validation errors');
  report.client.interactions.push('settings validation + edit/cancel rollback');
  const originalLogo=await page.locator('#businessLogoImage').getAttribute('src');
  await page.locator('#settingsEditButton').click();
  await page.locator('#businessLogoInput').setInputFiles({name:'qa-logo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=','base64')});
  await page.waitForFunction(()=>document.getElementById('settingsFormStatus').textContent.includes('Logo ready'));
  if(!await page.locator('#saveSettingsButton').isEnabled())throw new Error('Prepared logo left Settings save disabled');
  if(!(await page.locator('#businessLogoImage').getAttribute('src'))?.startsWith('data:image/webp'))throw new Error('Logo preview was not prepared');
  await page.locator('#settingsCancelButton').click();
  if(await page.locator('#businessLogoImage').getAttribute('src')!==originalLogo)throw new Error('Cancel retained an unsaved logo');
  report.client.interactions.push('logo preparation + cancellation');

  await page.locator('#settingsEditButton').click();
  await page.locator('#settingsBusinessName').fill(originalName+' QA');
  await assertPendingSave(page,'settings-save','#saveSettingsButton','#settingsBusinessName','#settingsCancelButton');
  await page.locator('#settingsFormStatus.success').waitFor({state:'visible',timeout:10000});
  const savedSettings=await page.request.get(baseURL+'/api/account?action=settings');
  if(!savedSettings.ok()||(await savedSettings.json()).settings.businessName!==originalName+' QA')throw new Error('Settings name did not persist');
  await page.locator('#settingsEditButton').click();
  await page.locator('#settingsBusinessName').fill(originalName);
  await page.locator('#saveSettingsButton').click();
  await page.locator('#settingsFormStatus.success').waitFor({state:'visible',timeout:10000});
  report.client.interactions.push('pending-save locks + settings persisted save/restore');


  const supportHistoryRoute='**/api/account?action=support-tickets';
  let simulateSupportHistoryFailure=true,injectSupportDraftFixture=false;
  const supportDraftFixture={tickets:[{id:'qa-support-draft',subject:'Fictional Preview draft',createdAt:Date.now(),
    priority:'normal',status:'open',messages:[{direction:'client',body:'Fictional Preview support inquiry',at:Date.now()}],
    messageCount:1,messageHistoryVerified:true,messagesTruncated:false}],coverage:{verified:true,incomplete:false}};
  await page.route(supportHistoryRoute,async route=>{
    if(simulateSupportHistoryFailure)await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({error:'QA simulated malformed history response'})});
    else if(injectSupportDraftFixture)await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(supportDraftFixture)});
    else await route.continue();
  });
  await ensureView(page,'support');
  await page.locator('#clientSupportHistoryHealth').waitFor({state:'visible',timeout:10000});
  if(await page.locator('#supportTicketsEmpty').isVisible())throw new Error('Support outage displayed misleading empty history');
  simulateSupportHistoryFailure=false;
  await page.locator('#clientSupportHistoryRetry').click();
  await page.locator('#clientSupportHistoryHealth').waitFor({state:'hidden',timeout:10000});
  injectSupportDraftFixture=true;
  await page.evaluate(()=>refreshClientSupportHistory());
  const supportThread=page.locator('[data-support-ticket-id="qa-support-draft"]');
  await supportThread.waitFor({state:'visible',timeout:10000});
  await supportThread.locator('summary').click();
  const replyDraft=supportThread.locator('[data-support-client-input]');
  await replyDraft.fill('A draft reply should survive background refreshes.');
  await replyDraft.evaluate(el=>{el.focus();el.setSelectionRange(8,19)});
  await page.evaluate(()=>refreshClientSupportHistory());
  if(!(await supportThread.evaluate(el=>el.open)))throw new Error('Support history refresh collapsed the open ticket');
  if(await replyDraft.inputValue()!=='A draft reply should survive background refreshes.')throw new Error('Support history refresh erased the draft');
  const selection=await replyDraft.evaluate(el=>[el.selectionStart,el.selectionEnd,document.activeElement===el]);
  if(JSON.stringify(selection)!==JSON.stringify([8,19,true]))throw new Error('Support refresh lost draft focus/selection');
  report.client.interactions.push('unsent support reply, open ticket + focus survive refreshed history');
  injectSupportDraftFixture=false;
  await page.evaluate(()=>refreshClientSupportHistory());
  if(await page.locator('[data-support-ticket-id="qa-support-draft"]').count())throw new Error('Disposable support fixture survived history restoration');
  await page.unroute(supportHistoryRoute);
  report.client.interactions.push('support history malformed-response warning + authenticated retry');
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
  if(!(await page.locator('#notificationSyncStatus').textContent()||'').trim())throw new Error('Client notification panel omitted refresh truthfulness');
  if(await page.locator('#notificationRetry').count()!==1)throw new Error('Client notification panel omitted retry control');
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
  await page.waitForFunction(()=>typeof adminMonthlyKpiStatus!=='undefined'&&adminMonthlyKpiStatus?.ok===true,{timeout:20000});
  const monthlyStatus=await page.evaluate(()=>JSON.parse(JSON.stringify(adminMonthlyKpiStatus)));
  const allowedStatusKeys=new Set(['ok','month','recordedAt','saved','cached','degraded','coverage','issues']);
  if(!monthlyStatus.month||!Number(monthlyStatus.recordedAt)||Object.keys(monthlyStatus).some(key=>!allowedStatusKeys.has(key)))throw new Error('Monthly KPI background refresh exposed an invalid status shape');
  if(!monthlyStatus.coverage||typeof monthlyStatus.coverage!=='object'||Array.isArray(monthlyStatus.coverage)||!Array.isArray(monthlyStatus.issues))throw new Error('Monthly KPI background refresh omitted coverage metadata');
  if(['mrr','arr','planMix','callOutcomes','setupRevenue','sessions','visitors','leads'].some(key=>Object.prototype.hasOwnProperty.call(monthlyStatus,key)))throw new Error('Monthly KPI background refresh exposed aggregate KPI values to the maintenance response');
  const rollupHealthResponse=await page.request.get(baseURL+'/api/account?action=admin-system-health');
  if(!rollupHealthResponse.ok())throw new Error('System Health could not verify monthly KPI rollup status');
  const rollupHealth=(await rollupHealthResponse.json()).services?.find(service=>service.key==='analytics-rollup');
  if(!rollupHealth||!['operational','warning'].includes(rollupHealth.status)||rollupHealth.meta?.month!==monthlyStatus.month||!Array.isArray(rollupHealth.meta?.incompleteSources))throw new Error('System Health did not expose the current monthly KPI rollup');
  const paymentCoverageComplete=monthlyStatus.coverage.paymentFailures===true;
  if(rollupHealth.meta.incompleteSources.includes('paymentFailures')===paymentCoverageComplete)throw new Error('System Health payment-failure coverage disagrees with the current monthly rollup');
  report.admin.interactions.push('background monthly KPI rollup + privacy-safe coverage health');
  const retentionResponse=await page.request.get(baseURL+'/api/account?action=admin-retention-report');
  if(!retentionResponse.ok())throw new Error('Retention dry-run endpoint was unavailable');
  const retentionReport=(await retentionResponse.json()).report;
  if(!retentionReport||retentionReport.mode!=='dry_run'||retentionReport.writeActionsEnabled!==false||retentionReport.retentionExecutorReachable!==false)throw new Error('Retention report did not remain read-only');
  const prospectRetention=retentionReport.prospects||{};
  if(prospectRetention.consentEvidenceAvailable!==true||prospectRetention.executorReachable!==false||
     !Number.isFinite(Number(prospectRetention.activeConsentCount))||!Number.isFinite(Number(prospectRetention.verifiedInactiveConsentCount))||
     !Number.isFinite(Number(prospectRetention.unknownConsentCount))||
     Number(prospectRetention.activeConsentCount)+Number(prospectRetention.verifiedInactiveConsentCount)+Number(prospectRetention.unknownConsentCount)!==Number(prospectRetention.scanned||0))
    throw new Error('Retention report did not expose trustworthy aggregate consent evidence');
  if(prospectRetention.consentReviewRequired!==(Number(prospectRetention.unknownConsentCount)>0))
    throw new Error('Retention report consent-review state disagrees with unknown historical evidence');
  if(!['disabled','misconfigured','active'].includes(retentionReport.monthlyRollups?.schedulerState)||typeof retentionReport.monthlyRollups?.finalizationScheduled!=='boolean'||!retentionReport.monthlyRollups?.previousMonth)throw new Error('Retention report omitted scheduler/finalization state');
  const retentionJson=JSON.stringify(retentionReport);
  if(retentionJson.includes('planned')||retentionJson.includes('before')||retentionJson.includes('after')||retentionJson.includes('@callercore.test'))throw new Error('Retention report exposed record-level prospect details');
  report.admin.interactions.push('read-only retention dry-run + consent gate');
  const migrationResponse=await page.request.get(baseURL+'/api/account?action=admin-conversation-migration-report&limit=25&verifyDetails=1');
  if(!migrationResponse.ok())throw new Error('Conversation migration dry-run endpoint was unavailable');
  const migrationReport=(await migrationResponse.json()).report;
  if(!migrationReport||migrationReport.mode!=='dry_run'||migrationReport.writeActionsEnabled!==false||migrationReport.migrationExecutorReachable!==false||migrationReport.legacyPreserved!==true||migrationReport.detailFidelityChecked!==true)throw new Error('Conversation migration report did not remain reversible/read-only with detail verification');
  if(Number(migrationReport.scanned||0)<1||Number(migrationReport.totalWorkspaces||0)<Number(migrationReport.scanned||0)||!migrationReport.counts||!migrationReport.detailCounts||typeof migrationReport.complete!=='boolean'||typeof migrationReport.detailVerificationComplete!=='boolean'||typeof migrationReport.migrationReady!=='boolean')throw new Error('Conversation migration fleet dry run returned an invalid detail-fidelity summary');
  const migrationJson=JSON.stringify(migrationReport);
  if(migrationJson.includes(report.workspaceId)||migrationJson.includes('Summit Heating'))throw new Error('Conversation migration report exposed workspace-level records');

  const focusedMigrationResponse=await page.request.get(baseURL+'/api/account?action=admin-conversation-migration-report&workspaceId='+encodeURIComponent(report.workspaceId));
  if(!focusedMigrationResponse.ok())throw new Error('Focused conversation migration readiness check was unavailable');
  const focusedMigration=(await focusedMigrationResponse.json()).report;
  if(!focusedMigration||focusedMigration.mode!=='dry_run'||focusedMigration.writeActionsEnabled!==false||focusedMigration.migrationExecutorReachable!==false||
     focusedMigration.legacyPreserved!==true||focusedMigration.workspaceState!=='aligned'||focusedMigration.summaryAligned!==true||
     focusedMigration.detailFidelityChecked!==true||focusedMigration.detailFidelityComplete!==true||focusedMigration.detailState!=='aligned'||
     focusedMigration.aligned!==true||focusedMigration.blocking!==false||focusedMigration.migrationCandidate!==false||
     Number(focusedMigration.legacyConversations||0)!==Number(focusedMigration.normalizedConversations||0)||
     Number(focusedMigration.detailRecordsChecked||0)!==Number(focusedMigration.detailRecordsExpected||0)||
     Number(focusedMigration.detailRecordsMatched||0)!==Number(focusedMigration.detailRecordsExpected||0)||
     Number(focusedMigration.detailMissing||0)!==0||Number(focusedMigration.detailMalformed||0)!==0||Number(focusedMigration.detailMismatched||0)!==0)
    throw new Error('Disposable Preview workspace is not detail-faithful for normalized conversation migration');
  if(JSON.stringify(focusedMigration).includes(report.workspaceId)||JSON.stringify(focusedMigration).includes('Summit Heating'))throw new Error('Focused migration readiness exposed workspace identity');
  report.admin.interactions.push('read-only normalized conversation migration readiness');

  await ensureView(page,'phones');
  const initialPhones=await page.locator('#phoneTable [data-edit-phone]').count();
  if(initialPhones<1)throw new Error('Phone inventory has no seeded numbers');
  await page.locator('#phoneSearch').fill('__no_phone_match__');
  if(await page.locator('#phoneTable [data-edit-phone]').count())throw new Error('Phone inventory search did not filter');
  await page.locator('#resetPhoneFilters').click();
  if(await page.locator('#phoneTable [data-edit-phone]').count()!==initialPhones)throw new Error('Phone inventory reset did not restore rows');
  await page.locator('#phoneAssignmentFilter').selectOption('assigned');
  const phoneResponse=await page.request.get(baseURL+'/api/account?action=admin-phone-numbers');
  const phoneItems=(await phoneResponse.json()).numbers||[];
  if(!phoneResponse.ok()||phoneItems.some(x=>x.voice?.operational!==false))throw new Error('Phone inventory claims unverified operational status');
  const qaPhone=phoneItems.find(x=>x.workspaceId===report.workspaceId);
  if(!qaPhone)throw new Error('QA workspace phone is missing');
  await page.locator('[data-edit-phone="'+qaPhone.id+'"]').click();
  const originalLabel=await page.locator('#phoneLabelInput').inputValue();
  await page.locator('#phoneLabelInput').fill(originalLabel+' QA');
  await assertPendingSave(page,'admin-phone-number-save','#savePhoneButton','#phoneLabelInput','#closePhoneModal');
  await page.locator('#phoneModal.open').waitFor({state:'hidden',timeout:10000});
  await page.locator('[data-edit-phone="'+qaPhone.id+'"]').click();
  if(await page.locator('#phoneLabelInput').inputValue()!==originalLabel+' QA')throw new Error('Admin phone edit did not persist');
  await page.locator('#phoneLabelInput').fill(originalLabel);
  await page.locator('#savePhoneButton').click();
  await page.locator('#phoneModal.open').waitFor({state:'hidden',timeout:10000});
  report.admin.interactions.push('phone search/reset + truthful readiness + saved edit/restore');

  // In-page fictional record only: test global search without touching support KV or sending mail.
  await page.evaluate(()=>{
    adminSupportData.unshift({id:'qa-support-search-only',subject:'Fictional search verification',
      workspaceName:'Preview QA company',status:'open',priority:'normal',
      messages:[{direction:'client',body:'QA support response index marker: bridge-orange-north.'}]});
  });
  await page.locator('#adminSearch').fill('bridge-orange-north');
  const supportSearchResult=page.locator('[data-global-search-type="support"][data-global-search-id="qa-support-search-only"]');
  await supportSearchResult.waitFor({state:'visible',timeout:8000});
  await page.locator('#adminSearch').fill('');
  await page.evaluate(()=>{adminSupportData=adminSupportData.filter(x=>x.id!=='qa-support-search-only')});
  report.admin.interactions.push('full global search indexes support conversation body');

  await page.locator('#adminSearch').fill('North Ridge Plumbing');
  const clientResult=page.locator('[data-global-search-type="client"]').first();
  await clientResult.waitFor({state:'visible',timeout:8000});
  await clientResult.click();
  await page.locator('#adminClientDrawer.open').waitFor({state:'visible',timeout:8000});
  const clientDrawer=page.locator('#adminClientDrawer'),clientDrawerLabel=await clientDrawer.getAttribute('aria-labelledby');
  if(await clientDrawer.getAttribute('role')!=='dialog'||await clientDrawer.getAttribute('aria-modal')!=='true'||!clientDrawerLabel||!await page.locator('#'+clientDrawerLabel).count())throw new Error('Admin client drawer is missing accessible dialog semantics');
  await assertAdminTechPendingOverride(page);
  report.admin.interactions.push('global search → client deep link');
  report.admin.interactions.push('configuration override pending lock + immediate refresh');
  await page.locator('#closeAdminClient').click();

  await page.locator('#adminSearch').fill('System Health');
  await page.locator('#adminSearch').press('Enter');
  await page.locator('#view-health.active').waitFor({state:'visible',timeout:5000});
  await page.waitForFunction(()=>typeof adminRetentionData!=='undefined'&&adminRetentionData?.mode==='dry_run',{timeout:15000});
  const retentionPanel=page.locator('#retentionReportPanel');
  await retentionPanel.waitFor({state:'visible',timeout:5000});
  const retentionStatus=(await page.locator('#retentionReportStatus').textContent()||'').trim();
  if(!retentionStatus||retentionStatus==='Not checked'||retentionStatus==='Unavailable')throw new Error('System Health did not render retention dry-run status');
  if((await page.locator('#retentionReportNote').textContent()||'').includes('No records were changed')!==true)throw new Error('Retention panel omitted its read-only guarantee');
  const migrationStatus=(await page.locator('#conversationMigrationStatus').textContent()||'').trim();
  const migrationMeta=(await page.locator('#conversationMigrationMeta').textContent()||'').trim();
  if(!migrationStatus||['—','Not checked','Unavailable'].includes(migrationStatus)||!/workspaces scanned/.test(migrationMeta)||!/detail-verified/.test(migrationMeta)||!/records matched/.test(migrationMeta))
    throw new Error('System Health did not render conversation migration detail-fidelity readiness');
  report.admin.interactions.push('global search keyboard navigation + retention/migration health panel');

  await ensureView(page,'clients');
  await page.locator('#adminClientSearchInput').fill('North Ridge');
  await page.waitForTimeout(250);
  if(await page.locator('#adminClientsTable [data-admin-client-row]').count()<1)throw new Error('Admin client search did not return seeded client');
  await page.locator('#adminClientSearchInput').fill('');
  report.admin.interactions.push('client account search');

  // Exercise the read-only reconciliation UI with a disposable in-page case.
  // This never writes a Stripe record, changes a customer, or sends email.
  await ensureView(page,'finance');
  const financeResponse=await page.request.get(baseURL+'/api/account?action=admin-finance');
  if(!financeResponse.ok())throw new Error('Admin Finance reconciliation feed failed ('+financeResponse.status()+')');
  const financePayload=(await financeResponse.json()).finance;
  if(!Array.isArray(financePayload?.reconciliation))throw new Error('Admin Finance response has no reconciliation collection');
  // Admin operational feeds load asynchronously after navigation. Compare only once the
  // in-page Finance request has completed; an initial `0 open` is not verified data.
  await page.waitForFunction(()=>!adminFinanceLoadError,{timeout:15000});
  // innerText applies CSS text-transform (the badge displays OPEN); textContent reads its actual data label.
  const displayedCount=(await page.locator('#financeReconciliationCount').textContent()).trim();
  if(displayedCount!==(financePayload.reconciliation.length+' open'))throw new Error('Finance reconciliation count differs from authoritative feed: displayed '+displayedCount+', API '+financePayload.reconciliation.length);
  await page.evaluate(()=>{
    window.__qaOriginalFinanceData=adminFinanceData;
    adminFinanceData={...adminFinanceData,reconciliation:[{id:'cs_preview-qa',sessionId:'cs_preview-qa',reason:'account_mapping_conflict',createdAt:Date.now(),status:'open'}]};
    renderAdmin();
  });
  if(!await page.locator('#financeReconciliationList').getByText('Checkout cs_preview-qa').isVisible())throw new Error('Checkout reconciliation case is not visible in Finance');
  const qaCase=await page.locator('#financeReconciliationList').innerText();
  if(!/Review in Stripe/.test(qaCase)||/Resolve automatically|Reassign customer/i.test(qaCase))throw new Error('Checkout conflict panel offers an unsafe or misleading action');
  await ensureView(page,'overview');
  const flagged=await page.evaluate(()=>window.__adminAttentionItems.some(item=>item.type==='checkout-reconciliation'&&item.sessionId==='cs_preview-qa'));
  if(!flagged)throw new Error('Checkout conflict is missing from the admin priority queue');
  await page.evaluate(()=>{
    adminFinanceLoadError='Finance could not refresh; previously loaded records may be outdated.';
    renderAdminFinance();
  });
  await ensureView(page,'finance');
  if(!/outdated/.test(await page.locator('#financeReconciliationStatus').innerText()))throw new Error('Finance reconciliation failure did not disclose stale records');
  await page.evaluate(()=>{
    adminFinanceData=window.__qaOriginalFinanceData;
    delete window.__qaOriginalFinanceData;
    adminFinanceLoadError='';
    renderAdmin();
  });
  report.admin.interactions.push('read-only checkout reconciliation + priority alert + stale Finance disclosure');

  await ensureView(page,'growth');
  await page.locator('#growthSearch').fill('North');
  await page.waitForTimeout(180);
  await page.locator('#growthSearch').fill('');
  await page.evaluate(()=>{
    window.__qaOriginalWebsiteData=adminWebsiteData;
    window.__qaOriginalGrowthFilter=growthFilter;
    adminWebsiteData={...adminWebsiteData,prospects:[{
      id:'qa-consent-ui-only',name:'Consent UI Fixture',business:'Preview Consent Fixture',email:'consent-fixture@example.test',
      source:'contact',stage:'inquiry',plan:'Growth',createdAt:Date.now()-3600000,updatedAt:Date.now(),
      marketingEmailConsent:{status:'granted',source:'contact_form',noticeVersion:'2026-09-29',recordedAt:Date.now()-1800000}
    },...(adminWebsiteData.prospects||[])]};
    growthFilter='all';renderGrowth();
  });
  const consentCard=page.locator('[data-edit-prospect="qa-consent-ui-only"]');
  await consentCard.waitFor({state:'visible',timeout:5000});
  const consentChip=(await consentCard.locator('.consent-mini').textContent()||'').trim();
  if(consentChip!=='Email: Granted')throw new Error('Growth prospect card omitted verified marketing-consent visibility');
  await consentCard.click();
  await page.locator('#prospectModal.open').waitFor({state:'visible',timeout:5000});
  const consentLabel=(await page.locator('#prospectConsentLabel').textContent()||'').trim(),
    consentMeta=(await page.locator('#prospectConsentMeta').textContent()||'').trim();
  if(consentLabel!=='Granted'||!/Contact form/.test(consentMeta))throw new Error('Growth prospect editor omitted read-only verified consent state');
  if(await page.locator('#prospectModal input[name*="consent" i],#prospectModal button[id*="consent" i]').count())throw new Error('Growth prospect editor exposed a consent mutation control');
  await page.locator('#closeProspectModal').click();
  await page.evaluate(()=>{
    adminWebsiteData=window.__qaOriginalWebsiteData;
    growthFilter=window.__qaOriginalGrowthFilter;
    delete window.__qaOriginalWebsiteData;delete window.__qaOriginalGrowthFilter;
    renderGrowth();
  });
  report.admin.interactions.push('growth pipeline search + read-only marketing consent visibility');

  await ensureView(page,'onboarding');
  await page.locator('#onboardingSearch').fill('Lakeview');
  await page.waitForTimeout(180);
  await page.locator('#onboardingSearch').fill('');
  report.admin.interactions.push('onboarding search');

  // Exercise a fictional in-memory stage record. Intercept only its requests: this
  // validates the real admin controls without changing any Preview/production KV.
  await page.evaluate(async()=>{
    const id='qa-stage-ui-only',realFetch=window.fetch,realRefresh=refreshAdminView;
    const fixture={id,name:'QA stage controls (in-memory)',plan:'Starter',stage:'Paid',
      autoStage:'Paid',manualOverride:false,stageUpdatedAt:null,checklist:{},
      checklistDone:0,checklistTotal:13,onboardingStatus:'paid'};
    let releaseStage;const requests=[];
    adminProvisioningData.unshift(fixture);
    window.fetch=async(url,options)=>{
      if(String(url).includes('action=admin-provisioning-stage-save')){
        requests.push(JSON.parse(options.body));
        return new Promise(resolve=>{releaseStage=()=>resolve({ok:true,json:async()=>({ok:true,stage:'Review',updatedAt:1001})})});
      }
      if(String(url).includes('action=admin-provisioning-stage-clear')){
        requests.push(JSON.parse(options.body));
        return {ok:true,json:async()=>({ok:true,clearedAt:1002})};
      }
      return realFetch(url,options);
    };
    refreshAdminView=async()=>{};
    try{
      renderProvisioning();
      const select=document.querySelector('[data-provision-stage-select="'+id+'"]');
      if(!select)throw new Error('Fictional onboarding stage row was not rendered');
      const pending=moveProvisioningStage(id,'Review');
      if(!select.disabled||select.getAttribute('aria-busy')!=='true')throw new Error('Pending onboarding stage was editable');
      if(await moveProvisioningStage(id,'Live')!==false)throw new Error('Concurrent onboarding stage edit was not blocked');
      if(requests.length!==1||requests[0].expectedUpdatedAt!==0)throw new Error('Onboarding save did not send the displayed revision');
      releaseStage();if(await pending!==true)throw new Error('Verified onboarding stage save did not complete');
      if(fixture.stage!=='Review'||fixture.stageUpdatedAt!==1001||!fixture.manualOverride)throw new Error('Saved stage was not reconciled');
      if(await clearProvisioningOverride(id)!==true)throw new Error('Automatic-stage restore did not complete');
      if(requests.length!==2||requests[1].expectedUpdatedAt!==1001)throw new Error('Restoration missed the latest stage revision');
      if(fixture.stage!=='Paid'||fixture.manualOverride||fixture.stageUpdatedAt!==null)throw new Error('Automatic-stage restoration was not reflected');
    }finally{
      window.fetch=realFetch;refreshAdminView=realRefresh;
      adminProvisioningData=adminProvisioningData.filter(item=>item.id!==id);
      adminProvisioningStagePending.delete(id);renderProvisioning();
    }
  });
  report.admin.interactions.push('in-memory onboarding save lock + revision + automatic-stage restoration');

  // Exercise onboarding invite delivery review entirely in memory. Every send/resolve
  // request is intercepted so this cannot send Mailgun email or write Preview/production KV.
  await page.evaluate(async()=>{
    const id='qa-invite-delivery-ui-only',realFetch=window.fetch,realConfirm=window.confirm,
      realRefresh=refreshAdminView,realNotifications=loadNotifications;
    const fixture={id,name:'QA invite delivery controls (in-memory)',plan:'Starter',stage:'Review',
      autoStage:'Review',manualOverride:false,stageUpdatedAt:null,checklist:{payment:true},
      checklistDone:1,checklistTotal:13,onboardingStatus:'awaiting_review',reviewEligibleAt:0,
      onboardingLinkSent:false,inviteDeliveryStatus:'uncertain',inviteDeliveryNeedsReview:true,
      inviteDeliveryAttemptId:'attempt-qa',inviteDeliveryStartedAt:Date.now()-20*60*1000};
    const requests=[];let releaseResolve,lastAction='';
    adminProvisioningData.unshift(fixture);
    window.confirm=()=>true;
    window.fetch=async(url,options={})=>{
      const target=String(url);
      if(target.includes('action=admin-onboarding-delivery-resolve')){
        const body=JSON.parse(options.body||'{}');requests.push({action:'resolve',body});lastAction=body.resolution;
        return new Promise(resolve=>{releaseResolve=()=>resolve({ok:true,json:async()=>({ok:true,deliveryStatus:body.resolution==='sent'?'sent':'failed',retrySafe:body.resolution!=='sent'})})});
      }
      if(target.includes('action=admin-onboarding-send')){
        const body=JSON.parse(options.body||'{}');requests.push({action:'send',body});lastAction='send';
        return {ok:true,json:async()=>({ok:true,deliveryStatus:'sent',onboarding:{id,checklist:{...fixture.checklist,accountReview:true,onboardingSent:true},onboardingStatus:'awaiting_agreement'}})};
      }
      return realFetch(url,options);
    };
    refreshAdminView=async()=>{
      if(lastAction==='not_sent'){fixture.inviteDeliveryStatus='failed';fixture.inviteDeliveryNeedsReview=false}
      if(lastAction==='send'){fixture.inviteDeliveryStatus='sent';fixture.onboardingLinkSent=true;fixture.onboardingStatus='awaiting_agreement';fixture.checklist={...fixture.checklist,accountReview:true,onboardingSent:true}}
    };
    loadNotifications=async()=>{};
    try{
      renderProvisioning();
      const sentButton=document.querySelector('[data-resolve-onboarding-delivery="sent"][data-resolve-onboarding-id="'+id+'"]');
      const notSentButton=document.querySelector('[data-resolve-onboarding-delivery="not_sent"][data-resolve-onboarding-id="'+id+'"]');
      if(!sentButton||!notSentButton)throw new Error('Invite delivery review controls were not rendered');
      const pending=resolveOnboardingInviteDelivery(id,'not_sent','attempt-qa',notSentButton);
      if(!notSentButton.disabled||notSentButton.getAttribute('aria-busy')!=='true'||!sentButton.disabled)throw new Error('Invite delivery review controls were not locked while saving');
      if(await resolveOnboardingInviteDelivery(id,'sent','attempt-qa',sentButton)!==false)throw new Error('Concurrent invite delivery resolution was not blocked');
      if(requests.length!==1||requests[0].body.id!==id||requests[0].body.attemptId!=='attempt-qa'||requests[0].body.resolution!=='not_sent')throw new Error('Invite delivery resolution request did not preserve the reviewed attempt');
      releaseResolve();if(await pending!==true)throw new Error('Verified not-sent delivery resolution did not complete');
      const retryButton=document.querySelector('[data-send-onboarding="'+id+'"]');
      if(!retryButton||!/Retry onboarding invite/.test(retryButton.textContent||''))throw new Error('Confirmed not-sent invite did not expose a safe retry');
      if(await sendOnboardingInvite(id,retryButton)!==true)throw new Error('Safe onboarding invite retry did not complete');
      if(requests.length!==2||requests[1].action!=='send'||requests[1].body.id!==id)throw new Error('Onboarding retry request was not isolated to the fictional client');
    }finally{
      window.fetch=realFetch;window.confirm=realConfirm;refreshAdminView=realRefresh;loadNotifications=realNotifications;
      adminProvisioningData=adminProvisioningData.filter(item=>item.id!==id);
      adminOnboardingInvitePending.delete(id);renderProvisioning();
    }
  });
  report.admin.interactions.push('in-memory onboarding invite delivery review + safe retry');

  // Exercise pending-deletion recovery entirely in memory. The fake client/detail,
  // diagnostics and restore POST are intercepted so QA never schedules/restores a KV record.
  await page.evaluate(async()=>{
    const id='qa-recovery-ui-only',realFetch=window.fetch,realConfirm=window.confirm,
      realRefresh=refreshAdminCore,realOps=loadAdminOps,originalClient=currentAdminClient,originalTech=currentAdminTech,
      drawerWasOpen=document.getElementById('adminClientDrawer')?.classList.contains('open')===true;
    let releaseRestore,restored=false;const requests=[];
    const fakeClient=()=>({id,name:'QA recovery controls (in-memory)',plan:'Starter',
      status:restored?'active':'pending_deletion',subscriptionStatus:'canceled',
      ownerEmail:'qa-recovery@example.test',createdAt:1,updatedAt:restored?30:20,
      deletion:restored?null:{requestedAt:10,purgeEligibleAt:Date.now()+86400000,preDeletionStatus:'active'},
      usage:{minutes:0},stripe:{customerLinked:false,subscriptionLinked:false},agent:null,phoneRouting:null,
      onboarding:null,counts:{locations:0}});
    window.confirm=()=>true;
    window.fetch=async(url,options={})=>{
      const target=String(url);
      if(target.includes('action=admin-client&id='+id))return {ok:true,json:async()=>({client:fakeClient()})};
      if(target.includes('action=admin-tech-support&id='+id))return {ok:true,json:async()=>({diagnostics:{workspaceId:id,workspaceStatus:restored?'active':'pending_deletion',subscriptionStatus:'canceled',ownerEmail:'qa-recovery@example.test',userMappingMatches:true},config:{},audit:[]})};
      if(target.includes('action=admin-client-delete-restore')){
        requests.push(JSON.parse(options.body||'{}'));
        return new Promise(resolve=>{releaseRestore=()=>{restored=true;resolve({ok:true,json:async()=>({ok:true,status:'active',client:{id,status:'active',updatedAt:30}})})}});
      }
      return realFetch(url,options);
    };
    refreshAdminCore=async()=>{};loadAdminOps=async()=>{};
    try{
      if(await openAdminClient(id)!==true)throw new Error('Fictional pending-deletion client did not open');
      const restoreButton=document.getElementById('adminRestoreClientButton'),deleteButton=document.getElementById('adminDeleteClientButton'),saveButton=document.getElementById('adminSaveClientButton'),status=document.getElementById('adminClientStatus');
      if(!restoreButton||restoreButton.hidden||!deleteButton.hidden||!saveButton.hidden||!status.disabled)throw new Error('Pending-deletion recovery controls were not isolated from ordinary edits');
      if(!/Recovery is available/.test(document.getElementById('adminClientManageNote')?.textContent||''))throw new Error('Pending-deletion recovery window was not explained');
      const pending=restoreAdminClient();
      if(!restoreButton.disabled||restoreButton.textContent!=='Restoring…'||document.getElementById('adminClientDrawer')?.getAttribute('aria-busy')!=='true')throw new Error('Workspace recovery did not lock the admin drawer');
      if(await restoreAdminClient()!==false)throw new Error('Concurrent workspace recovery was not blocked');
      if(requests.length!==1||requests[0].id!==id||requests[0].expectedUpdatedAt!==20)throw new Error('Workspace recovery missed the displayed revision');
      releaseRestore();if(await pending!==true)throw new Error('Confirmed workspace recovery did not complete');
      if(currentAdminClient?.status!=='active'||currentAdminClient?.deletion!==null)throw new Error('Confirmed recovery did not reconcile the active client state');
      if(!restoreButton.hidden||deleteButton.hidden||saveButton.hidden||status.disabled)throw new Error('Recovered client controls did not return to normal');
    }finally{
      window.fetch=realFetch;window.confirm=realConfirm;refreshAdminCore=realRefresh;loadAdminOps=realOps;
      currentAdminClient=originalClient;currentAdminTech=originalTech;
      if(drawerWasOpen&&originalClient?.id)await openAdminClient(originalClient.id).catch(()=>{});
      else closeAdminClient();
    }
  });
  report.admin.interactions.push('in-memory pending-deletion recovery + revision + duplicate-action lock');

  await ensureView(page,'client-care');
  const supportCareTab=page.locator('[data-care-tab="support"]').first();
  if(await supportCareTab.count())await supportCareTab.click();
  const adminSupportThread=page.locator('#adminSupportList [data-support-ticket-id]').first();
  if(!(await adminSupportThread.count()))throw new Error('Preview Client Care support fixture missing');
  await adminSupportThread.locator('summary').click();
  const adminReplyDraft=adminSupportThread.locator('[data-support-admin-input]');
  await adminReplyDraft.fill('Unsent admin reply preserved during case refresh and search.');
  await adminReplyDraft.evaluate(el=>{el.focus();el.setSelectionRange(7,19)});
  await page.evaluate(()=>renderAdminSupport());
  if(!(await adminSupportThread.evaluate(el=>el.open)))throw new Error('Admin ticket collapsed on UI refresh');
  if(await adminReplyDraft.inputValue()!=='Unsent admin reply preserved during case refresh and search.')throw new Error('Admin support draft disappeared on redraw');
  const adminSelection=await adminReplyDraft.evaluate(el=>[el.selectionStart,el.selectionEnd,document.activeElement===el]);
  if(JSON.stringify(adminSelection)!==JSON.stringify([7,19,true]))throw new Error('Admin support draft cursor was lost on redraw');
  await page.locator('#adminSupportSearch').fill('__qa_unmatched_support_ticket__');
  if(await page.locator('#adminSupportList [data-support-ticket-id]').count())throw new Error('Admin support search fixture unexpectedly matched');
  await page.locator('#adminSupportSearch').fill('');
  if(await adminReplyDraft.inputValue()!=='Unsent admin reply preserved during case refresh and search.')throw new Error('Admin support draft disappeared after filter reset');
  await adminReplyDraft.fill('');
  report.admin.interactions.push('unsent admin support reply survives redraw and filtering');

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
  if(!(await page.locator('#notificationSyncStatus').textContent()||'').trim())throw new Error('Admin notification panel omitted refresh truthfulness');
  if(await page.locator('#notificationRetry').count()!==1)throw new Error('Admin notification panel omitted retry control');
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
    if(kind==='admin'){
      await ensureView(page,'phones');await assertLayout(page,kind+'-'+name+'-phones');await shot(page,kind+'-'+name+'-phones');
      const edit=page.locator('#phoneTable [data-edit-phone]').first();
      if(!await edit.isVisible())throw new Error('Phone edit action is hidden at '+name+' width');
      await edit.click();await page.locator('#phoneModal.open').waitFor({state:'visible'});
      const phoneModal=page.locator('#phoneModal'),labelId=await phoneModal.getAttribute('aria-labelledby');
      if(await phoneModal.getAttribute('role')!=='dialog'||await phoneModal.getAttribute('aria-modal')!=='true'||!labelId||!await page.locator('#'+labelId).count())throw new Error('Phone editor is missing accessible dialog semantics at '+name+' width');
      await page.locator('#savePhoneButton').scrollIntoViewIfNeeded();
      const saveBox=await page.locator('#savePhoneButton').boundingBox();if(!saveBox||saveBox.y<0||saveBox.y+saveBox.height>viewport.height+1)throw new Error('Phone save action is not reachable at '+name+' width');
      await assertLayout(page,kind+'-'+name+'-phone-editor');await shot(page,kind+'-'+name+'-phone-editor');
      await page.locator('#closePhoneModal').focus();await page.keyboard.press('Shift+Tab');
      if(await page.evaluate(()=>document.activeElement?.id)!=='savePhoneButton')throw new Error('Phone editor did not wrap keyboard focus at '+name+' width');
      await page.locator('#closePhoneModal').focus();await page.keyboard.press('Escape');await page.locator('#phoneModal.open').waitFor({state:'hidden'});
      if(!await edit.evaluate(element=>element===document.activeElement))throw new Error('Phone editor did not restore trigger focus at '+name+' width');
    }
    if(kind==='client'){
      for(const view of ['conversations','agent','settings']){
        await ensureView(page,view);
        await assertLayout(page,kind+'-'+name+'-'+view);
        await shot(page,kind+'-'+name+'-'+view);
      }
    }
    report[kind].responsive.push({name,...viewport});
  }catch(err){
    await shot(page,kind+'-'+name+'-failure').catch(()=>{});
    throw err;
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

  // Close the client page before rotating the disposable session. Background
  // detail hydration must not survive into the admin login and report the
  // intentionally revoked client cookie as a product authentication failure.
  await desktop.page.close();
  desktop.page=await desktop.context.newPage();
  attachDiagnostics(desktop.page,'desktop-admin');
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
