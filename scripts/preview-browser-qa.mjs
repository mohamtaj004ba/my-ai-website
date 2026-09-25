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

  await page.locator('#adminSearch').fill('North Ridge Plumbing');
  const clientResult=page.locator('[data-global-search-type="client"]').first();
  await clientResult.waitFor({state:'visible',timeout:8000});
  await clientResult.click();
  await page.locator('#adminClientDrawer.open').waitFor({state:'visible',timeout:8000});
  await assertAdminTechPendingOverride(page);
  report.admin.interactions.push('global search → client deep link');
  report.admin.interactions.push('configuration override pending lock + immediate refresh');
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
    if(kind==='admin'){
      await ensureView(page,'phones');await assertLayout(page,kind+'-'+name+'-phones');await shot(page,kind+'-'+name+'-phones');
      const edit=page.locator('#phoneTable [data-edit-phone]').first();
      if(!await edit.isVisible())throw new Error('Phone edit action is hidden at '+name+' width');
      await edit.click();await page.locator('#phoneModal.open').waitFor({state:'visible'});
      await page.locator('#savePhoneButton').scrollIntoViewIfNeeded();
      const saveBox=await page.locator('#savePhoneButton').boundingBox();if(!saveBox||saveBox.y<0||saveBox.y+saveBox.height>viewport.height+1)throw new Error('Phone save action is not reachable at '+name+' width');
      await assertLayout(page,kind+'-'+name+'-phone-editor');await shot(page,kind+'-'+name+'-phone-editor');
      await page.locator('#closePhoneModal').click();
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
