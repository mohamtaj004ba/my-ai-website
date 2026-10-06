import {previewRequestHeaders} from './preview-request-headers.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {installBillingFixture,verifyBillingDialogs} from './native-billing-browser-qa.mjs';
import {verifyCustomerExperience} from './customer-experience-browser-qa.mjs';
import {verifyVoiceOperations} from './voice-browser-qa.mjs';

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
report.readabilityContracts=[];
report.visualFailures=[];

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
  try{
    await page.locator('#adminApplyOverrideButton').click();
    await page.locator('#submitAdminActionConfirmation').click();
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
  await context.route('**/*',route=>route.continue({headers:previewRequestHeaders(route.request().url(),route.request().headers(),baseURL)}));
  contexts.push(context);
  const page=await context.newPage();
  if(label==='desktop'||label.startsWith('client-'))await installBillingFixture(page);
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
  await page.waitForSelector(requiredSelector,{state:'attached',timeout:20000});
  await page.locator('.view.active').waitFor({state:'visible',timeout:20000});
  await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
  await page.waitForTimeout(1000);
  const body=await page.locator('body').innerText();
  if(/sign in to callercore|authentication required/i.test(body))throw new Error(route+' rendered an authentication screen');
}

async function shot(page,name,{fullPage=true}={}){
  const syncCaption=page.locator('#clientLiveStatus .sync-caption');
  if(await syncCaption.isVisible()){
    const readable=await syncCaption.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=85&&r.height<35&&el.scrollWidth<=el.clientWidth+1});
    if(!readable)throw new Error('Dashboard sync caption is squeezed or stacked vertically');
  }
  const file=name.replace(/[^a-z0-9_-]+/gi,'-')+'.png';
  await page.screenshot({path:path.join(outDir,file),fullPage});
  report.visualScreenshots.push(file);
  return file;
}

async function assertLayout(page,label,{allowHorizontalOverflow=false}={}){
  if(await page.locator('#view-health.active').count()){
    const spills=await page.evaluate(()=>{const panel=document.querySelector('.health-map-panel').getBoundingClientRect();return [...document.querySelectorAll('.health-service-node')].filter(el=>{const r=el.getBoundingClientRect();return r.left<panel.left||r.right>panel.right}).map(el=>el.textContent)});
    if(spills.length)throw new Error(label+' dependency map spills outside its panel: '+spills.join(', '));
    const health=await page.evaluate(()=>({core:adminReadinessData?.core,counts:adminReadinessData?.counts,display:{core:document.getElementById('healthReadinessPct')?.textContent,technical:document.getElementById('healthRequiredBlockers')?.textContent,release:document.getElementById('healthRequiredReady')?.textContent,owner:document.getElementById('healthTotalChecks')?.textContent,optional:document.getElementById('healthOptionalIssues')?.textContent},groups:document.querySelectorAll('#systemHealthGrid .admin-health-group').length}));
    if(!health.core||!health.counts||health.groups!==5||health.display.core!==health.core.healthy+'/'+health.core.total||Number(health.display.technical)!==health.counts.technicalBlockers||Number(health.display.release)!==health.counts.releaseSetup||Number(health.display.owner)!==health.counts.ownerActions||Number(health.display.optional)!==health.counts.optionalSetup)throw new Error(label+' rendered readiness totals disagree with the API');
  }
  const state=await page.evaluate(()=>{
    const active=document.querySelector('.view.active');
    const topbar=document.querySelector('.topbar');
    const main=document.querySelector('.dashboard-main');
    const box=el=>el?(()=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}})():null;
    const controls=[...document.querySelectorAll('.top-actions>button,.top-actions>* >button,.top-actions>* >input')].map(box).filter(r=>r?.width>0&&r?.height>0);
    return {
      viewport:{width:window.innerWidth,height:window.innerHeight},
      scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
      activeView:active?.id||'',
      activeBox:box(active),
      topbarBox:box(topbar),
      mainBox:box(main),
      overlappingHeaderControls:controls.some((a,i)=>controls.slice(i+1).some(b=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1)),
      spillingCallBadges:[...document.querySelectorAll('.view.active .call-row.data :is(.call-type-pill,.team-status-pill,.disposition-pill)')].filter(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.width>0&&p.width>0&&(r.left<p.left-1||r.right>p.right+1)}).map(el=>el.textContent),
      squeezedPhoneFollowups:window.innerWidth<=600?[...document.querySelectorAll('.view.active .followup-customer')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.width<200}).map(el=>el.textContent):[],
      brokenPhoneRecords:window.innerWidth<=600&&document.body.dataset.dashboard==='client'?[...document.querySelectorAll('.view.active .call-row.data,.view.active .contact-row.data')].filter(el=>{const r=el.getBoundingClientRect(),children=[...el.children];return r.width>window.innerWidth-24||children.slice(0,2).some(c=>getComputedStyle(c).display==='none')||(el.classList.contains('call-row')&&getComputedStyle(children[3]).display==='none')}).map(el=>el.getAttribute('aria-label')):[],
      clippedIntelligenceLabel:(()=>{const button=document.getElementById('adminAiLaunch');return !!button&&button.scrollWidth>button.clientWidth+2})(),
      renderedClosedDrawers:[...document.querySelectorAll('.call-drawer:not(.open)')].filter(el=>el.getBoundingClientRect().width>0).map(el=>el.id),
      squeezedAttentionCopy:[...document.querySelectorAll('.view.active .attention-call-copy')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.width<160}).map(el=>({text:el.textContent,width:el.getBoundingClientRect().width})),
      overflowers:[...document.querySelectorAll('body *')].map(el=>{
        const r=el.getBoundingClientRect(),style=getComputedStyle(el);
        return {tag:el.tagName.toLowerCase(),id:el.id||'',className:String(el.className||'').slice(0,160),text:String(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,120),parent:el.parentElement?{tag:el.parentElement.tagName.toLowerCase(),id:el.parentElement.id||'',className:String(el.parentElement.className||'').slice(0,140)}:null,ancestor:el.parentElement?.parentElement?{tag:el.parentElement.parentElement.tagName.toLowerCase(),id:el.parentElement.parentElement.id||'',className:String(el.parentElement.parentElement.className||'').slice(0,140)}:null,left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),position:style.position,display:style.display,overflowX:style.overflowX};
      }).filter(x=>x.display!=='none'&&(x.right>window.innerWidth+4||x.left<-4)).sort((a,b)=>(b.right-window.innerWidth)-(a.right-window.innerWidth)).slice(0,12)
    };
  });
  report.layoutContracts.push({label,...state});
  if(!state.activeView)throw new Error(label+' has no active dashboard view');
  if(state.overlappingHeaderControls)throw new Error(label+' header controls overlap');
  if(state.spillingCallBadges.length)throw new Error(label+' call labels spill into adjacent columns: '+state.spillingCallBadges.join(', '));
  if(state.squeezedPhoneFollowups.length)throw new Error(label+' squeezes follow-up customer details');
  if(state.brokenPhoneRecords.length)throw new Error(label+' hides key phone record details or overflows card: '+JSON.stringify(state.brokenPhoneRecords));
  if(state.clippedIntelligenceLabel)throw new Error(label+' Core Intelligence label spills outside its control');
  if(state.renderedClosedDrawers.length)throw new Error(label+' leaves closed drawer controls rendered: '+state.renderedClosedDrawers.join(', '));
  if(state.squeezedAttentionCopy.length)throw new Error(label+' squeezes customer details beside attention badges: '+JSON.stringify(state.squeezedAttentionCopy));
  if(!allowHorizontalOverflow&&state.scrollWidth>state.viewport.width+4){
    throw new Error(label+' horizontally overflows viewport: '+state.scrollWidth+'px > '+state.viewport.width+'px; offenders='+JSON.stringify(state.overflowers));
  }
  if(!state.activeBox||state.activeBox.width<=0||state.activeBox.height<=0)throw new Error(label+' active view is not rendered');
}

async function assertReadableCopy(page,label){
  const undersized=await page.evaluate(()=>[...document.querySelectorAll('.view.active :is(p,small,label,button,input,select,textarea,svg text)')].flatMap(el=>{
    const r=el.getBoundingClientRect(),style=getComputedStyle(el),text=(el.textContent||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim();
    if(!text||!r.width||!r.height||style.visibility==='hidden'||Number(style.opacity)===0)return [];
    const scale=el instanceof SVGElement?Math.abs(el.getScreenCTM()?.a||1):1,size=parseFloat(style.fontSize)*scale;
    // Zero-sized labels belong to intentionally icon-only controls. Their
    // visible icon and accessible name are covered by the interaction checks.
    if(!size||size>=12)return [];
    return [{tag:el.tagName,id:el.id,text:text.slice(0,100),size}];
  }));
  report.readabilityContracts.push({label,undersized});
  if(undersized.length)throw new Error(label+' contains consequential copy smaller than 12px: '+JSON.stringify(undersized.slice(0,10)));
}

async function ensureView(page,view){
  if(view==='conversations'&&await page.locator('body').getAttribute('data-dashboard')==='client'){await ensureView(page,'contacts');await page.locator('#contactRecordedSessions').click();await page.locator('#view-conversations.active').waitFor();return;}
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

async function assertUtilityPanelContrast(page,panelSelector,label){
  const lowContrast=await page.locator(panelSelector).evaluate(panel=>{
    const rgb=value=>value.match(/[\d.]+/g).map(Number);
    const luminance=values=>values.slice(0,3).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const background=luminance(rgb(getComputedStyle(panel).backgroundColor));
    return [...panel.querySelectorAll('.account-panel-head b,.notification-head b,#profileSummaryName,.admin-search-results-head b,.admin-search-empty b')].map(el=>{
      const foreground=luminance(rgb(getComputedStyle(el).color)),text=el.textContent.trim();
      return {text,contrast:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)};
    }).filter(item=>!item.text||item.contrast<4.5);
  });
  report.readabilityContracts.push({label,lowContrast});
  if(lowContrast.length)throw new Error(label+' has unreadable utility-panel titles: '+JSON.stringify(lowContrast));
}

async function sweepViews(page,kind){
  const selector='button.nav-item[data-view]';
  const views=await page.locator(selector).evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('data-view')).filter(Boolean))]);
  if(kind==='client')views.push('conversations');
  for(const view of views){
    await ensureView(page,view);
    await assertLayout(page,kind+'-desktop-'+view);
    await assertReadableCopy(page,kind+'-desktop-'+view);
    await shot(page,kind+'-'+view);
    report[kind].views.push(view);
  }
}
async function assertSectionAlertContext(page,kind,label=kind){
  const view=kind==='client'?'calls':'clients',drawer=kind==='client'?'#callDrawer':'#adminClientDrawer',close=kind==='client'?'#closeCallDrawer':'#closeAdminClient';
  await ensureView(page,view);
  const refreshPattern='**/api/account?action=notifications&*';
  await page.route(refreshPattern,async route=>{const data=await page.evaluate(()=>({notifications:notificationData,unreadCount:notificationUnreadCount}));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})});
  const pattern='**/api/account?action=notifications-read';
  await page.route(pattern,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})}));
  try{
    await page.evaluate(({kind,view,workspaceId})=>{
      window.__qaAlerts={data:notificationData,count:notificationUnreadCount};notificationRequest++;
      notificationData=[{id:'qa-section-alert',read:false,view,title:'A follow-up needs review',body:'Open the exact record for details.',kind:'warning',meta:kind==='client'?{callId:String(callsData[0].id)}:{workspaceId}}];
      notificationUnreadCount=1;renderNotifications();
    },{kind,view,workspaceId:report.workspaceId});
    const surface=page.locator('.view.active .section-alerts');
    if(kind==='client'){
      if(await surface.count())throw new Error('Call alerts displaced the call log');
      await page.locator('#callSearch').fill('');await page.locator('#callDateFilter').selectOption('all');await page.locator('#callCategoryFilter').selectOption('all');await page.locator('#callFilter').selectOption('all');
      await page.evaluate(()=>{callQuickFilter='all';renderCalls()});
      await page.locator('.call-record-alert').first().waitFor({state:'visible'});
    }else{
      await surface.waitFor({state:'visible'});
      if(page.viewportSize().width<=600){
        await shot(page,label+'-section-alert-compact',{fullPage:false});
        if(!await surface.evaluate(el=>el.open))await surface.locator('summary').click();
      }
      if(!await surface.evaluate(el=>el.open))throw new Error('Unread section alert details could not be expanded');
    }
    await assertLayout(page,label+'-section-alert');
    await shot(page,label+'-section-alert-context',{fullPage:false});
    if(kind==='client')await page.locator('.call-row').filter({has:page.locator('.call-record-alert')}).first().click();else await page.locator('[data-section-notification="qa-section-alert"]').click();
    await page.locator(drawer+'.open').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('.view.active .section-alerts'));
    if(kind==='client')await page.waitForFunction(()=>!document.querySelector('.call-record-alert'));
    await page.locator(close).click();
    report[kind].interactions.push('visible contextual unread alerts + exact record navigation + confirmed read removal');
  }finally{
    await page.unroute(pattern);await page.unroute(refreshPattern);
    await page.evaluate(()=>{notificationRequest++;notificationData=window.__qaAlerts.data;notificationUnreadCount=window.__qaAlerts.count;delete window.__qaAlerts;renderNotifications()});
  }
}

async function assertCompletionRecovery(page,label){
  await page.locator('#drawerTeamStatus').selectOption('completed');
  await page.locator('#drawerFollowupButton').click();
  await page.locator('#teamStatusModal.open').waitFor({state:'visible'});
  const completionSurface=await page.evaluate(()=>{
    const modal=document.getElementById('teamStatusModal'),drawer=document.getElementById('callDrawer'),button=document.getElementById('saveTeamStatusModal'),r=button.getBoundingClientRect();
    return {inert:drawer.inert,onTop:modal.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),context:document.getElementById('teamStatusCallContext').textContent};
  });
  if(!completionSurface.inert||!completionSurface.onTop||!completionSurface.context)throw new Error('Completion is obscured by its drawer or lacks record context');
  await shot(page,label+'-completion-dialog',{fullPage:false});
  await page.locator('#saveTeamStatusModal').press('Tab');
  if(await page.evaluate(()=>document.activeElement?.id)!=='closeTeamStatusModal')throw new Error('Completion keyboard focus escaped');
  await page.locator('#closeTeamStatusModal').press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#teamStatusModal').classList.contains('open'));
  if(!await page.locator('#callDrawer').evaluate(el=>el.classList.contains('open')&&!el.inert))throw new Error('Completion cancel lost the original drawer');
  await page.waitForFunction(()=>document.activeElement?.id==='drawerFollowupButton');
  report.client.interactions.push(label+' completion above drawer + context + focus trap + Escape recovery without mutation');
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

async function verifyLiveClientIntelligence(context,page){
  if(process.env.CALLERCORE_VERIFY_GPT!=='true')return;
  // Only the isolated, fictional Pro QA workspace is eligible for this reversible check.
  if(qaEmail!=='preview-qa@callercore.test'||!report.workspaceId)throw new Error('Live GPT verification requires the disposable Preview QA workspace');
  await ensureView(page,'leads');
  const expectedPending=Number((await page.locator('#followupOpenCount').textContent()).trim());
  if(!Number.isSafeInteger(expectedPending)||expectedPending<0)throw new Error('Dashboard pending count is unverifiable');
  const summary=await post(context.request,'client-ai-guide',{question:'How many pending follow-ups do I have? Reply exactly Pending: N, replacing N with followups.totals.pending. Do not propose an action.'});
  if(summary.provider!=='openai'||summary.proposal||!new RegExp('^Pending:\\s*'+expectedPending+'[.!]?$').test(String(summary.answer||'').replace(/\*\*/g,'').trim()))throw new Error('Live Intelligence pending count disagrees with the dashboard');
  const readAgent=async()=>{const response=await context.request.get(baseURL+'/api/account?action=agent');if(!response.ok())throw new Error('Cannot verify QA receptionist');const data=await response.json();if(!data.agent||!Number.isFinite(Number(data.agent.updatedAt)))throw new Error('QA receptionist revision is unverifiable');return data.agent};
  const before=await readAgent(),greeting='Thanks for calling Summit Heating & Air. How can I help today?';
  const guide=await post(context.request,'client-ai-guide',{question:'Set my receptionist openingMessage to exactly: '+greeting});
  if(guide.provider!=='openai'||!guide.model||!guide.proposal?.id||guide.proposal.after!==greeting)throw new Error('Live GPT did not prepare the requested greeting');
  const untouched=await readAgent();if(JSON.stringify(untouched)!==JSON.stringify(before))throw new Error('GPT changed the receptionist before applying its proposal');
  let applied=null;
  try{
    applied=await post(context.request,'intelligence-apply',{id:guide.proposal.id});
    if(applied.ok!==true||applied.agent?.openingMessage!==greeting)throw new Error('Intelligence did not return a verified canonical save receipt');
    const after=await readAgent();if(after.openingMessage!==greeting||Number(after.updatedAt)<=Number(before.updatedAt))throw new Error('Live Intelligence save did not persist with a new revision');
    const replay=await context.request.post(baseURL+'/api/account?action=intelligence-apply',{headers:qaHeaders,data:{id:guide.proposal.id}});if(replay.status()!==409)throw new Error('Live Intelligence proposal could be replayed');
    report.client.liveIntelligence={provider:guide.provider,model:guide.model,pendingCountMatchesDashboard:true,pendingCount:expectedPending,proposalDidNotMutate:true,canonicalSaveVerified:true,replayRejected:true};
  }finally{
    if(applied?.agent){const current=await readAgent();const restored=await post(context.request,'agent-save',{section:'identity',openingMessage:before.openingMessage,expectedUpdatedAt:current.updatedAt});if(restored.ok!==true||restored.agent?.openingMessage!==before.openingMessage)throw new Error('QA greeting recovery was not verified');if(report.client.liveIntelligence)report.client.liveIntelligence.originalGreetingRestored=true;}
  }
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

  if(!(await page.locator('#callSort').isVisible())){
    await page.locator('#toggleCallMoreFilters').click();
    await page.locator('#callMoreFilters').waitFor({state:'visible',timeout:5000});
  }
  if(await page.locator('#callDensity').count())throw new Error('Removed density control is still exposed');
  await page.locator('#callSort').selectOption('oldest');
  await page.locator('.nav-item[data-view="contacts"]').click();
  await page.locator('#contactSearch').fill('nonexistent contact');
  await page.locator('.nav-item[data-view="calls"]').click();
  if(await page.locator('#callSort').inputValue()!=='newest')throw new Error('Leaving calls did not reset sorting');
  await page.locator('.nav-item[data-view="contacts"]').click();
  if(await page.locator('#contactSearch').inputValue()!=='')throw new Error('Leaving contacts did not reset search');
  await page.locator('.nav-item[data-view="calls"]').click();
  report.client.interactions.push('advanced call filters reset on page departure');

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
  await assertCompletionRecovery(page,'client-desktop');
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
  for(const [section,field] of [['location','#settingsCity'],['notifications','#settingsNotificationEmail']]){
    const original=await page.locator(field).inputValue();
    await page.locator('[data-settings-edit="'+section+'"]').click();
    if(await page.locator('#settingsBusinessName').isEnabled())throw new Error('Independent section edit enabled unrelated profile fields');
    await page.locator(field).fill(original+' draft');
    await page.locator('#settingsCancelButton').click();
    if(await page.locator(field).inputValue()!==original)throw new Error('Independent section cancel lost the verified value');
    if(!await page.locator('[data-settings-edit="'+section+'"]').evaluate(el=>document.activeElement===el))throw new Error('Cancel did not return focus to the section edit control');
  }
  report.client.interactions.push('independent Settings sections + draft rollback + focus restoration');
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
  if(!await page.locator('#settingsEditButton').evaluate(el=>document.activeElement===el))throw new Error('Settings save did not restore section focus');
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
  if(await page.locator('#profileNameInput').isVisible()||await page.locator('#profileSaveButton').isVisible())throw new Error('Profile opened in editing mode');
  await page.locator('#profileEditButton').click();
  await page.locator('#profileNameInput').waitFor({state:'visible'});
  await page.locator('#profileNameInput').fill('Unsaved QA profile draft');
  await page.locator('#profileCancelButton').click();
  if(await page.locator('#profileNameInput').isVisible()||await page.locator('#profileSummaryName').textContent()==='Unsaved QA profile draft')throw new Error('Profile cancel did not restore the account summary');
  await page.locator('#accountButton').click();
  report.client.interactions.push('profile summary + explicit edit + cancel without saving');

  await page.evaluate(()=>{window.__qaIntelligencePlan=currentPlan;currentPlan='Pro';initClientIntelligence()});
  await page.route('**/api/account?action=client-ai-guide',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({answer:'## Executive summary\nQA Intelligence summary with several readable paragraphs.\n\n## Key metrics\n- **Pending follow-ups:** 3\n- **Completed:** 2\n\n## Next steps\nReview the proposed greeting below before saving.',proposal:{id:'00000000-0000-0000-0000-000000000000',description:'Review a sample greeting',before:'Original greeting',after:'Proposed greeting',expiresAt:Date.now()+600000}})}));
  await page.locator('#adminAiLaunch').click();
  await page.locator('#adminAiInput').fill('QA review interface only');await page.locator('#adminAiSend').click();
  await page.locator('#intelligenceProposal').waitFor({state:'visible'});
  if(!await page.locator('#intelligenceProposal').getByText('Proposed action · not saved').isVisible())throw new Error('Intelligence incorrectly claimed an unapplied change was saved');
  const intelligenceViewport=page.viewportSize();
  for(const width of [1280,768,320,390]){
    await page.setViewportSize({width,height:844});
    const fits=await page.locator('#adminAiPanel').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&el.scrollWidth<=el.clientWidth+1});
    if(!fits)throw new Error(`Pro Intelligence panel overflows at ${width}px`);
    const responseFits=await page.locator('.admin-ai-rich').evaluate(el=>{const r=el.getBoundingClientRect(),children=[...el.children];return getComputedStyle(el).display==='grid'&&el.scrollWidth<=el.clientWidth+1&&children.every((child,i)=>{const c=child.getBoundingClientRect();return c.left>=r.left-1&&c.right<=r.right+1&&(!i||c.top>=children[i-1].getBoundingClientRect().bottom-1)})});
    if(!responseFits)throw new Error(`Intelligence response is not a readable single column at ${width}px`);
    if(width<=760){
      const inputSize=await page.locator('#adminAiInput').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      if(inputSize<16)throw new Error('Intelligence input would trigger iPhone automatic zoom');
      for(const keyboardHeight of [420,250]){
      await page.setViewportSize({width,height:keyboardHeight});
      await page.locator('#adminAiInput').focus();
      // visualViewport resize is delivered asynchronously after the viewport
      // changes. Assert the settled visible geometry, with a bounded deadline.
      await page.waitForFunction(()=>{const panel=document.getElementById('adminAiPanel').getBoundingClientRect(),send=document.getElementById('adminAiSend').getBoundingClientRect();return panel.top>=0&&panel.bottom<=innerHeight+1&&send.right<=innerWidth&&send.bottom<=innerHeight},null,{timeout:5000});
      await page.screenshot({path:path.join(outDir,`client-intelligence-keyboard-${width}-${keyboardHeight}.png`),fullPage:false});
      const keyboardFits=await page.locator('#adminAiPanel').evaluate(el=>{const r=el.getBoundingClientRect(),send=document.getElementById('adminAiSend').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&send.right<=innerWidth&&send.bottom<=innerHeight});
      if(!keyboardFits)throw new Error('Intelligence composer escapes the reduced keyboard viewport');
      }
      await page.setViewportSize({width,height:844});
    }
    await page.screenshot({path:path.join(outDir,`client-intelligence-${width}.png`),fullPage:false});
  }
  await page.setViewportSize(intelligenceViewport);
  await page.locator('#intelligenceProposal [data-cancel]').click();await page.locator('#adminAiClose').click();
  await page.unroute('**/api/account?action=client-ai-guide');
  await page.evaluate(()=>{currentPlan=window.__qaIntelligencePlan;delete window.__qaIntelligencePlan;initClientIntelligence()});
  report.client.interactions.push('Pro Intelligence summary + specific change review + dismiss without mutation');

  await page.locator('#notificationBell').click();
  if(await page.locator('#notificationPanel').getAttribute('hidden')!==null)throw new Error('Notification panel did not open');
  if(!(await page.locator('#notificationSyncStatus').textContent()||'').trim())throw new Error('Client notification panel omitted refresh truthfulness');
  if(await page.locator('#notificationRetry').count()!==1)throw new Error('Client notification panel omitted retry control');
  const history=page.locator('#notificationHistoryTab');
  if(await history.count()){await history.click();await page.locator('#notificationUnreadTab').click()}
  await page.locator('#notificationBell').click();
  report.client.interactions.push('notification panel/tabs');
  await assertSectionAlertContext(page,'client');

  await ensureView(page,'overview');
  await page.locator('#refreshClientCommand').click();
  await page.waitForTimeout(650);
  report.client.interactions.push('client live refresh');
}

async function runAdminInteractions(page){
  await ensureView(page,'overview');
  const financeMonth=page.locator('#adminFinanceChart [data-finance-index="0"]');
  await financeMonth.press('Enter');
  const financeTip=page.locator('#adminFinanceTooltip');
  await financeTip.waitFor({state:'visible'});
  const financeCopy=await financeTip.innerText();
  if(!financeCopy.includes('MRR')||!financeCopy.includes('Expenses')||!financeCopy.includes('Net run-rate')||!financeCopy.includes('$'))throw new Error('Keyboard finance selection omitted exact financial detail');
  await shot(page,'admin-keyboard-finance-detail',{fullPage:false});
  await financeMonth.press('Escape');await financeTip.waitFor({state:'hidden'});
  await financeMonth.press('Space');await financeTip.waitFor({state:'visible'});
  const financeMonths=page.locator('#adminFinanceChart [data-finance-index]');
  const financeMonthCount=await financeMonths.count();
  await financeMonth.press('Tab');
  if(financeMonthCount>1){
    await financeTip.waitFor({state:'visible'});
    const nextMonth=await page.evaluate(()=>({index:document.activeElement?.dataset?.financeIndex,month:document.activeElement?.dataset?.financeMonth,copy:document.getElementById('adminFinanceTooltip')?.textContent}));
    if(nextMonth.index!=='1'||!nextMonth.copy?.includes('MRR'))throw new Error('Tab did not expose the next finance month');
    for(let i=1;i<financeMonthCount;i++)await financeMonths.nth(i).press('Tab');
  }
  await financeTip.waitFor({state:'hidden'});
  report.admin.interactions.push('finance chart keyboard details after initial loading + Escape/blur recovery');
  await page.waitForFunction(()=>typeof adminMonthlyKpiStatus!=='undefined'&&adminMonthlyKpiStatus?.ok===true,{timeout:20000});
  const monthlyStatus=await page.evaluate(()=>JSON.parse(JSON.stringify(adminMonthlyKpiStatus)));
  const allowedStatusKeys=new Set(['ok','month','recordedAt','saved','cached','degraded','coverage','issues']);
  if(!monthlyStatus.month||!Number(monthlyStatus.recordedAt)||Object.keys(monthlyStatus).some(key=>!allowedStatusKeys.has(key)))throw new Error('Monthly KPI background refresh exposed an invalid status shape');
  if(!monthlyStatus.coverage||typeof monthlyStatus.coverage!=='object'||Array.isArray(monthlyStatus.coverage)||!Array.isArray(monthlyStatus.issues))throw new Error('Monthly KPI background refresh omitted coverage metadata');
  if(['mrr','arr','planMix','callOutcomes','setupRevenue','sessions','visitors','leads'].some(key=>Object.prototype.hasOwnProperty.call(monthlyStatus,key)))throw new Error('Monthly KPI background refresh exposed aggregate KPI values to the maintenance response');
  const rollupHealthResponse=await page.request.get(baseURL+'/api/account?action=admin-system-health');
  if(!rollupHealthResponse.ok())throw new Error('System Health could not verify monthly KPI rollup status');
  const healthPayload=await rollupHealthResponse.json();
  const rollupHealth=healthPayload.services?.find(service=>service.key==='analytics-rollup');
  const healthServices=healthPayload.services||[],healthReadiness=healthPayload.readiness||{},healthByKey=new Map(healthServices.map(x=>[x.key,x]));
  if(healthByKey.get('checkout')?.state!=='launch-gated'||healthByKey.get('stripe')?.category!=='release')throw new Error('Preview release setup was misclassified as infrastructure failure');
  if(healthByKey.get('gate-previewIsolation')?.state!=='operational'||healthByKey.get('application-e2e')?.state!=='operational'||healthByKey.has('gate-disposableE2E'))throw new Error('Verified Preview/application evidence was not separated from voice lifecycle');
  if(healthByKey.get('gate-voiceLifecycle')?.state!=='blocked'||healthByKey.get('voice')?.category!=='technical')throw new Error('Voice validation stopped being a technical launch gate');
  if(healthServices.filter(x=>x.category==='core').length!==healthReadiness.core?.total||healthServices.filter(x=>x.state==='blocked').length!==healthReadiness.counts?.technicalBlockers)throw new Error('Readiness counts disagree with classified checks');
  if(healthReadiness.blockers.some(x=>['release','owner','optional'].includes(healthByKey.get(x.key)?.category)))throw new Error('Manual/optional setup leaked into technical blockers');
  report.admin.interactions.push('classified core health / technical blockers / release and owner setup parity');
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
  let phoneDeleteRequests=0;const phoneDeleteRoute=/\/api\/account\?action=admin-phone-number-delete$/;
  await page.route(phoneDeleteRoute,async route=>{
    phoneDeleteRequests++;const id=route.request().postDataJSON()?.id;
    await route.fulfill({status:id==='qa-confirmation-focus'?200:409,contentType:'application/json',body:JSON.stringify(id==='qa-confirmation-focus'?{ok:true,deleted:{id}}:{error:'QA intercepted unexpected phone removal'})});
  });
  const phoneDeleteLauncher=page.locator('[data-delete-phone="'+qaPhone.id+'"]');
  const phoneFixtureReadRoute=/\/api\/account\?action=admin-phone-numbers$/;
  try{
    await phoneDeleteLauncher.click();
    const confirmation=page.locator('#adminActionConfirmationModal');await confirmation.waitFor({state:'visible'});
    if(!(await page.locator('#adminActionConfirmationCopy').textContent()).includes(qaPhone.number))throw new Error('Phone removal confirmation omitted number identity');
    if(!/does not release a provider-owned number/.test(await page.locator('#adminActionConfirmationConsequences').textContent()))throw new Error('Phone removal confirmation omitted provider limitation');
    await page.locator('#closeAdminActionConfirmation').focus();await page.keyboard.press('Shift+Tab');
    if(!await page.locator('#submitAdminActionConfirmation').evaluate(el=>document.activeElement===el))throw new Error('Phone confirmation did not trap reverse Tab');
    await page.keyboard.press('Escape');await confirmation.waitFor({state:'hidden'});
    try{await page.waitForFunction(id=>document.activeElement?.dataset?.deletePhone===id||document.activeElement?.id==='addPhoneButton',qaPhone.id)}catch(error){const active=await page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,dataset:{...document.activeElement?.dataset}}));throw new Error('Phone cancellation focus recovery failed: '+JSON.stringify(active),{cause:error})}
    if(phoneDeleteRequests!==0)throw new Error('Phone cancellation sent a removal request');
    // A temporary in-page row tests confirmed deletion focus without deleting stored inventory.
    await page.route(phoneFixtureReadRoute,async route=>{
      if(route.request().method()!=='GET')return route.continue();
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({numbers:[...phoneItems,...(phoneDeleteRequests===0?[{...qaPhone,id:'qa-confirmation-focus',updatedAt:1}]:[])]})});
    });
    await page.evaluate(async item=>{window.__qaOriginalPhoneData=adminPhoneData;await refreshAdminView('phones',{force:true,announce:false});if(!adminPhoneData.some(x=>x.id==='qa-confirmation-focus'))adminPhoneData.push({...item,id:'qa-confirmation-focus',updatedAt:1});renderPhones()},qaPhone);
    await page.locator('[data-delete-phone="qa-confirmation-focus"]').click();await page.locator('#submitAdminActionConfirmation').click();
    await page.locator('#adminActionConfirmationModal').waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.activeElement?.id==='addPhoneButton');
    if(phoneDeleteRequests!==1)throw new Error('Phone focus fixture did not submit exactly one intercepted request');
  }finally{
    await page.evaluate(()=>{if(window.__qaOriginalPhoneData){adminPhoneData=window.__qaOriginalPhoneData;delete window.__qaOriginalPhoneData;renderPhones()}});
    await page.unroute(phoneDeleteRoute);
    await page.unroute(phoneFixtureReadRoute);
  }
  report.admin.interactions.push('phone removal identity + provider truthfulness + keyboard cancellation + confirmed focus recovery without stored deletion');

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
  await page.waitForFunction(()=>currentAdminTech?.diagnostics?.workspaceId===currentAdminClient?.id&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById('adminRepairEmail')?.value||''),{},{timeout:15000});
  let canceledRepairs=0;const repairRoute=/\/api\/account\?action=admin-repair-access$/;
  await page.route(repairRoute,async route=>{canceledRepairs++;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'QA intercepted unexpected repair'})})});
  try{
    await page.locator('#adminRepairAccessButton').click();
    await page.locator('#adminActionConfirmationModal').waitFor({state:'visible'});
    if(!/North Ridge Plumbing/.test(await page.locator('#adminActionConfirmationCopy').textContent()))throw new Error('Repair confirmation omitted workspace identity');
    await page.locator('#cancelAdminActionConfirmation').click();
    await page.waitForFunction(()=>document.activeElement?.id==='adminRepairAccessButton');
    if(canceledRepairs!==0)throw new Error('Canceled access repair sent a request');
  }finally{await page.unroute(repairRoute)}
  report.admin.interactions.push('access-repair identity + cancellation + focus return without mutation');
  const originalWorkspaceStatus=await page.locator('#adminClientStatus').inputValue();
  let serviceChangeRequests=0;const serviceChangeRoute=/\/api\/account\?action=admin-client-update$/;
  await page.route(serviceChangeRoute,async route=>{serviceChangeRequests++;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'QA intercepted unexpected service access change'})})});
  try{
    await page.locator('#adminClientStatus').selectOption(originalWorkspaceStatus==='suspended'?'active':'suspended');
    await page.locator('#adminSaveClientButton').click();await page.locator('#adminActionConfirmationModal').waitFor({state:'visible'});
    if(!/North Ridge Plumbing/.test(await page.locator('#adminActionConfirmationCopy').textContent()))throw new Error('Service access confirmation omitted workspace identity');
    if(!/Stripe/.test(await page.locator('#adminActionConfirmationConsequences').textContent()))throw new Error('Service access confirmation omitted billing scope');
    await page.locator('#cancelAdminActionConfirmation').click();await page.waitForFunction(()=>document.activeElement?.id==='adminSaveClientButton');
    if(serviceChangeRequests!==0)throw new Error('Canceled service access change sent a mutation');
  }finally{await page.locator('#adminClientStatus').selectOption(originalWorkspaceStatus);await page.unroute(serviceChangeRoute)}
  report.admin.interactions.push('service suspension/restoration review + cancellation without mutation');
  await assertAdminTechPendingOverride(page);
  report.admin.interactions.push('global search → client deep link');
  report.admin.interactions.push('configuration override pending lock + immediate refresh');
  // Exercise the real confirmation controls without revoking any Preview user sessions.
  let logoutRequests=0;
  const logoutRoute=/\/api\/account\?action=admin-force-logout$/;
  await page.route(logoutRoute,async route=>{
    logoutRequests++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,sessionVersion:2})});
  });
  try{
    await page.locator('#adminForceLogoutButton').click();
    const logoutModal=page.locator('#adminLogoutModal');
    await logoutModal.waitFor({state:'visible'});
    if(await logoutModal.getAttribute('role')!=='dialog'||await logoutModal.getAttribute('aria-modal')!=='true')throw new Error('Sign-out confirmation lacks dialog semantics');
    if(!/North Ridge Plumbing/.test(await page.locator('#adminLogoutCopy').textContent()))throw new Error('Sign-out confirmation omitted workspace identity');
    await page.locator('#cancelAdminLogout').click();
    if(logoutRequests!==0)throw new Error('Canceled sign-out sent a mutation');
    await page.waitForFunction(()=>document.activeElement?.id==='adminForceLogoutButton');
    await page.locator('#adminForceLogoutButton').click();
    await page.locator('#closeAdminLogoutModal').focus();
    await page.keyboard.press('Shift+Tab');
    if(!await page.locator('#confirmAdminLogout').evaluate(el=>document.activeElement===el))throw new Error('Sign-out confirmation did not trap reverse Tab');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.activeElement?.id==='adminForceLogoutButton');
    await page.locator('#adminForceLogoutButton').click();
    await page.locator('#confirmAdminLogout').click();
    await page.waitForFunction(()=>!adminTechSaving&&document.getElementById('adminLogoutModal')?.getAttribute('aria-hidden')==='true');
    await page.waitForFunction(()=>document.activeElement?.id==='adminForceLogoutButton');
    if(logoutRequests!==1)throw new Error('Confirmed sign-out did not send exactly one intercepted mutation');
  }finally{await page.unroute(logoutRoute)}
  report.admin.interactions.push('sign-out target identity + cancellation + keyboard focus/trap + intercepted confirmation');
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
  if(await page.locator('#prospectSourceInput').inputValue()!=='contact')throw new Error('Contact prospect source was blank in its editor');
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

  await ensureView(page,'inbox');
  await page.evaluate(()=>{
    window.__qaWebsiteReplyOriginalFetch=window.fetch;window.__qaWebsiteReplyRequests=0;
    window.fetch=async(url,options)=>{
      if(!String(url).includes('action=admin-website-reply'))return window.__qaWebsiteReplyOriginalFetch(url,options);
      const body=JSON.parse(options?.body||'{}');window.__qaWebsiteReplyRequests++;
      if(body?.id!=='qa-recipient-review-ui-only'||body?.expectedRecipientEmail!=='reviewed@callercore.test'||body?.message!=='QA intercepted reply')throw new Error('Website reply lost its reviewed recipient or conversation');
      if(window.__qaWebsiteReplyRequests===3)return new Response(JSON.stringify({error:'Reply delivery could not be confirmed. Review the delivery provider before retrying; another send could create duplicate mail.',deliveryStatus:'uncertain',retrySafe:false}),{status:502,headers:{'Content-Type':'application/json'}});
      const rejected=window.__qaWebsiteReplyRequests===1;
      return new Response(JSON.stringify(rejected?{error:'The recipient changed. Refresh this conversation before replying. No reply was sent.'}:{ok:true,message:{id:'qa-intercepted-reply',direction:'outbound',channel:'qa-intercepted',from:'support@callercore.test',to:'reviewed@callercore.test',body:body.message,at:Date.now()},warning:'QA intercepted reply; no email was sent.'}),{status:rejected?409:200,headers:{'Content-Type':'application/json'}});
    };
  });
  try{
    await page.evaluate(()=>{window.__qaOriginalInboxItem=currentInboxItem;currentInboxItem={kind:'website',id:'qa-recipient-review-ui-only',prospect:{id:'qa-recipient-review-ui-only',email:'reviewed@callercore.test',name:'QA reviewed recipient',stage:'new'},messages:[]};renderInboxThread()});
    await page.locator('#inboxReplyText').fill('QA intercepted reply');await page.locator('#inboxReplyForm button[type="submit"]').click();
    await page.locator('#inboxReplyStatus').filter({hasText:'recipient changed'}).waitFor({state:'visible'});
    if(await page.locator('#inboxReplyText').inputValue()!=='QA intercepted reply')throw new Error('Stale-recipient failure discarded the website reply draft');
    await page.locator('#inboxReplyForm button[type="submit"]').click();
    await page.locator('#inboxReplyStatus').filter({hasText:'QA intercepted reply; no email was sent.'}).waitFor({state:'visible'});
    if(await page.evaluate(()=>window.__qaWebsiteReplyRequests)!==2||await page.locator('#inboxReplyText').inputValue()!=='')throw new Error('Website reply retry did not preserve confirmed receipt behavior');
    await page.locator('#inboxReplyText').fill('QA intercepted reply');await page.locator('#inboxReplyForm button[type="submit"]').click();
    await page.locator('#inboxReplyStatus').filter({hasText:'Review the delivery provider before retrying'}).waitFor({state:'visible'});
    if(await page.evaluate(()=>window.__qaWebsiteReplyRequests)!==3||await page.locator('#inboxReplyText').inputValue()!=='QA intercepted reply')throw new Error('Uncertain website delivery hid review instructions, discarded its draft or automatically retried');
  }finally{
    await page.evaluate(()=>{window.fetch=window.__qaWebsiteReplyOriginalFetch;delete window.__qaWebsiteReplyOriginalFetch;delete window.__qaWebsiteReplyRequests;currentInboxItem=window.__qaOriginalInboxItem;delete window.__qaOriginalInboxItem;renderInboxThread()});
  }
  report.admin.interactions.push('intercepted website reply recipient identity + stale draft recovery + confirmed receipt warning + uncertain delivery review without sending mail');
  await page.waitForFunction(()=>!adminInboxData.loading&&!adminWebsiteAnalyticsLoading);
  await page.evaluate(()=>{window.__qaIntakeSaved={data:adminWebsiteData,filter:adminInboxData.filter,search:adminInboxData.search,error:adminWebsiteLoadError};adminWebsiteLoadError='';adminInboxData.search='';adminWebsiteData={...adminWebsiteData,prospects:[{id:'qa-intake-contact',source:'contact',name:'Website visitor',message:'A website question',stage:'inquiry',updatedAt:Date.now()},{id:'qa-intake-chat',source:'chatbot',name:'Chat visitor',message:'A chatbot question',stage:'inquiry',updatedAt:Date.now()},{id:'qa-intake-checkout',source:'get_started',name:'Signup visitor',stage:'checkout_started',plan:'Growth',updatedAt:Date.now()},{id:'qa-intake-paid',source:'get_started',name:'Paid visitor',stage:'converted',updatedAt:Date.now()}]};renderAdminInbox()});
  try{
    if((await page.locator('#inboxWebsiteCount').textContent()).trim()!=='2'||(await page.locator('#inboxCheckoutCount').textContent()).trim()!=='1')throw new Error('Intake counts mixed messages with completed or unpaid checkouts');
    for(const [channel,id] of [['website','qa-intake-contact'],['chatbot','qa-intake-chat'],['checkout','qa-intake-checkout']]){await page.locator('[data-inbox-filter="'+channel+'"]').click();if(await page.locator('#inboxList [data-inbox-id]').count()!==1||await page.locator('#inboxList [data-inbox-id]').getAttribute('data-inbox-id')!==id)throw new Error('Inbox channel did not isolate '+channel);}
    await page.evaluate(()=>{currentInboxItem={kind:'website',id:'qa-intake-checkout',prospect:adminWebsiteData.prospects.find(p=>p.id==='qa-intake-checkout'),messages:[],coverage:{verified:true,totalMessages:0}};renderInboxThread()});
    if(!/payment not confirmed/i.test(await page.locator('#inboxMessages').innerText()))throw new Error('Unfinished checkout lacked an honest payment-status explanation');
    await shot(page,'admin-inbox-unfinished-checkout',{fullPage:false});
  }finally{await page.evaluate(()=>{adminWebsiteData=window.__qaIntakeSaved.data;adminInboxData.filter=window.__qaIntakeSaved.filter;adminInboxData.search=window.__qaIntakeSaved.search;adminWebsiteLoadError=window.__qaIntakeSaved.error;delete window.__qaIntakeSaved;currentInboxItem=null;renderAdminInbox();renderInboxThread()});}
  report.admin.interactions.push('contact/chatbot/unfinished checkout channel isolation, truthful counts and payment state without sending messages');

  await ensureView(page,'onboarding');
  await page.locator('#onboardingSearch').fill('Lakeview');
  await page.waitForTimeout(180);
  await page.locator('#onboardingSearch').fill('');
  report.admin.interactions.push('onboarding search');

  await page.evaluate(()=>{
    window.__qaDeliveryOriginalProvisioning=adminProvisioningData;
    adminProvisioningData=[{id:'qa-delivery-ui-only',name:'QA delivery review',plan:'Starter',stage:'Review',autoStage:'Review',manualOverride:false,stageUpdatedAt:null,checklist:{},checklistDone:0,checklistTotal:13,onboardingStatus:'awaiting_review',onboardingLinkSent:false,inviteDeliveryStatus:'uncertain',inviteDeliveryNeedsReview:true,inviteDeliveryAttemptId:'qa-attempt',onboardingUpdatedAt:1},...adminProvisioningData];renderProvisioning();
  });
  let deliveryResolutions=0;const deliveryRoute=/\/api\/account\?action=admin-onboarding-delivery-resolve$/;
  await page.route(deliveryRoute,async route=>{
    const body=route.request().postDataJSON();deliveryResolutions++;
    if(body?.id!=='qa-delivery-ui-only'||body?.attemptId!=='qa-attempt'||body?.resolution!=='not_sent')throw new Error('Delivery fixture attempted an unexpected resolution');
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,deliveryStatus:'failed'})});
  });
  try{
    await page.locator('.onboarding-row[data-provision-id="qa-delivery-ui-only"]>summary').click();
    const drawer=page.locator('#onboardingDetailDrawer'),launcher=drawer.locator('[data-resolve-onboarding-delivery="not_sent"]');
    await launcher.click();await page.locator('#adminActionConfirmationModal').waitFor({state:'visible'});
    if(!/QA delivery review.*qa-attempt/.test(await page.locator('#adminActionConfirmationCopy').textContent()))throw new Error('Delivery review omitted target or attempt identity');
    if(!/sends no email.*duplicate mail/.test(await page.locator('#adminActionConfirmationConsequences').textContent()))throw new Error('Delivery review omitted no-send and duplicate-mail recovery scope');
    await page.locator('#cancelAdminActionConfirmation').click();
    await page.waitForFunction(()=>document.activeElement?.dataset?.resolveOnboardingDelivery==='not_sent');
    if(!await drawer.evaluate(el=>el.classList.contains('open'))||deliveryResolutions!==0)throw new Error('Canceled delivery review closed its drawer or sent a resolution');
    await launcher.click();await page.locator('#submitAdminActionConfirmation').click();
    await page.locator('#adminActionConfirmationModal').waitFor({state:'hidden'});
    await page.waitForFunction(()=>!document.getElementById('onboardingDetailDrawer')?.classList.contains('open')&&document.activeElement?.id==='onboardingSearch');
    if(deliveryResolutions!==1)throw new Error('Delivery fixture did not submit exactly one intercepted resolution');
  }finally{
    await page.unroute(deliveryRoute);
    await page.evaluate(()=>{adminProvisioningData=window.__qaDeliveryOriginalProvisioning;delete window.__qaDeliveryOriginalProvisioning;closeAdminActionConfirmation();closeOnboardingDrawer();renderProvisioning()});
  }
  report.admin.interactions.push('uncertain delivery identity + no-send scope + nested drawer cancellation + intercepted resolution focus recovery');

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
      if(await resolveOnboardingInviteDelivery(id,'not_sent','attempt-qa',notSentButton)!==true)throw new Error('Invite delivery confirmation did not open');
      if(requests.length!==0)throw new Error('Invite delivery resolution bypassed confirmation');
      const pending=submitAdminActionConfirmation();
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
      adminOnboardingInvitePending.delete(id);closeAdminActionConfirmation();renderProvisioning();
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
      if(openAdminRestoreWorkspaceModal()!==true)throw new Error('Workspace recovery confirmation did not open');
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
  const careWorkspaceId=await adminSupportThread.locator('[data-care-action="settings"]').getAttribute('data-care-workspace');
  await adminSupportThread.locator('[data-care-action="settings"]').click();
  await page.locator('#adminClientDrawer.open').waitFor({state:'visible'});
  await page.waitForFunction(id=>String(currentAdminClient?.id)===id&&document.getElementById('adminConfigSection').value==='settings'&&!adminCareNavigationPending,careWorkspaceId);
  if(!await page.locator('#adminConfigEditor').evaluate(el=>document.activeElement===el))throw new Error('Client Care did not focus the selected configuration');
  await page.locator('#closeAdminClient').click();
  await adminSupportThread.locator('[data-care-action="access"]').click();
  await page.locator('#adminClientDrawer.open').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.activeElement?.id==='adminRepairEmail');
  if(await page.evaluate(()=>String(currentAdminClient?.id))!==careWorkspaceId)throw new Error('Client Care opened another client');
  await page.locator('#closeAdminClient').click();
  report.admin.interactions.push('Client Care exact workspace configuration + access shortcuts + keyboard focus without mutations');


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
  await assertSectionAlertContext(page,'admin');

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
      await menu.focus();await page.keyboard.press('Shift+Tab');
      if(await page.locator('.sidebar').evaluate(el=>el.contains(document.activeElement)))throw new Error('Closed phone navigation contains off-screen keyboard focus at '+name+' width');
      await menu.click();
      if(kind==='client'||kind==='admin'){
        await page.locator('#navigationBackdrop').click({position:{x:viewport.width-12,y:180}});
        if(await page.locator('.sidebar').evaluate(el=>el.classList.contains('open')))throw new Error('Outside tap did not dismiss phone navigation');
        await menu.click();
      }
      if(!(await page.locator('.sidebar').evaluate(el=>el.classList.contains('open'))))throw new Error(kind+' '+name+' mobile menu did not open sidebar');
      await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left)<1);
      await shot(page,kind+'-'+name+'-menu',{fullPage:false});
      await ensureView(page,kind==='admin'?'clients':'calls');
      await assertLayout(page,kind+'-'+name+'-secondary',{allowHorizontalOverflow:false});
      await shot(page,kind+'-'+name+'-'+(kind==='admin'?'clients':'calls'));
      if(kind==='client'&&viewport.width<=600){
        const identity=await page.locator('#headerWorkspaceName').textContent();
        if(!identity||identity==='Your business')throw new Error('Mobile header is missing business identity');
        await ensureView(page,'contacts');
        const compact=await page.locator('.customer-summary-strip').evaluate(el=>{const boxes=[...el.children].map(x=>x.getBoundingClientRect());return boxes.every(b=>Math.abs(b.y-boxes[0].y)<1)&&el.getBoundingClientRect().height<100});
        if(!compact)throw new Error('Mobile contact totals are not a compact single row');
        await page.locator('#contactsTable [data-contact-key]').first().click();
        await page.locator('#contactDrawer.open').waitFor();
        await page.locator('#contactDrawerBackdrop').click({position:{x:8,y:200}});
        if(await page.locator('#contactDrawer').evaluate(el=>el.classList.contains('open')))throw new Error('Outside tap did not dismiss contact details');
        await ensureView(page,'leads');
        for(const status of ['priority','dismissed','completed','pending']){
          await page.locator('[data-followup-filter="'+status+'"]').click();
          const actual=await page.locator('[data-followup-filter="'+status+'"]').getAttribute('aria-pressed');
          if(actual!=='true')throw new Error('Follow-up filter is not active: '+status);
          const statuses=await page.locator('#leadKanban [data-team-status]').evaluateAll(selects=>selects.map(s=>s.selectedOptions[0]?.textContent.trim()||''));
          if(['dismissed','completed'].includes(status)&&statuses.some(s=>s.toLowerCase()!==status))throw new Error('Follow-up status filter mixed different statuses');
        }
        await shot(page,kind+'-'+name+'-followups');
        if(await page.locator('#leadKanban .team-status-pill').count())throw new Error('Follow-up cards repeat their editable status');
        await shot(page,kind+'-'+name+'-followups-viewport',{fullPage:false});
        await ensureView(page,'contacts');
        const cleanContacts=await page.locator('#contactsTable .contact-row.data').evaluateAll(rows=>rows.every(row=>[...row.children].slice(2).every(cell=>getComputedStyle(cell).display==='none')&&getComputedStyle(row.querySelector('.contact-open-cue')).display!=='none'));
        if(!cleanContacts)throw new Error('Phone contact list exposes activity or unlabeled counts');
        await shot(page,kind+'-'+name+'-contacts-viewport',{fullPage:false});
        if(await page.locator('#adminAiLaunch').isVisible()||await page.locator('#helpButton').isVisible())throw new Error('Phone header still contains sidebar utilities');
        await page.locator('#accountButton').click();
        const accountHeight=await page.locator('#accountPanel').evaluate(el=>el.getBoundingClientRect().height);
        if(accountHeight>480)throw new Error('Read-only account panel has excess blank space');
        await page.locator('#accountPanel [data-close-topbar]').click();
        if(await page.locator('#accountPanel').isVisible())throw new Error('Account sheet close did not dismiss');
        await page.locator('#notificationBell').click();
        await page.locator('#topbarSheetBackdrop').click({position:{x:8,y:200}});
        if(await page.locator('#notificationPanel').isVisible())throw new Error('Notification sheet outside tap did not dismiss');
        await ensureView(page,'overview');
        await page.locator('.client-header-identity').click();
        if(!(await page.locator('#view-overview').isVisible()))throw new Error('Business header does not return to Today');
        await shot(page,kind+'-'+name+'-overview-viewport',{fullPage:false});
        await ensureView(page,'calls');
        const callHeights=await page.locator('#callsTable .call-row.data').evaluateAll(rows=>rows.slice(0,8).map(row=>row.getBoundingClientRect().height));
        if(callHeights.some(height=>height>235))throw new Error('Phone call cards have excessive vertical space');
        await shot(page,kind+'-'+name+'-compact-calls-viewport',{fullPage:false});
        const toolbar=await page.locator('.call-toolbar-main').evaluate(el=>{const r=el.getBoundingClientRect(),search=el.querySelector('.call-search-field').getBoundingClientRect();return {fullSearch:search.width>=r.width-2,touch:[...el.querySelectorAll('input,select,button')].every(x=>x.getBoundingClientRect().height>=43)}});
        if(!toolbar.fullSearch||!toolbar.touch)throw new Error('Phone call search or filters are too cramped at '+name+' width');
        await ensureView(page,'integrations');
        const connections=await page.locator('.connection-health').evaluateAll(cards=>cards.map(card=>{const copy=card.querySelector('div').getBoundingClientRect(),badge=card.querySelector('.tag').getBoundingClientRect();return copy.width>=180&&badge.y>=copy.bottom-1}));
        if(!connections.every(Boolean))throw new Error('Phone connection status squeezes its explanation at '+name+' width');
        await assertLayout(page,kind+'-'+name+'-connections');await shot(page,kind+'-'+name+'-connections');
      }
    }
    if(kind==='admin'){
      if(viewport.width<=760){
        if(await page.locator('.admin-workspace-card').isVisible())throw new Error('Phone sidebar repeats the admin header identity');
        await page.locator('#adminSearch').fill('Summit');
        await page.locator('#adminSearchResults').waitFor({state:'visible'});
        await assertUtilityPanelContrast(page,'#adminSearchResults','admin-'+name+'-search-contrast');
        await assertLayout(page,'admin-'+name+'-global-search');await shot(page,'admin-'+name+'-global-search',{fullPage:false});
        await page.locator('#adminSearch').press('Escape');
        if(await page.locator('#adminSearchResults').isVisible())throw new Error('Phone global search did not dismiss with Escape');
        await page.locator('#adminSearch').fill('');await page.locator('#adminSearch').press('Escape');await page.locator('.admin-header-identity').focus();
        await page.locator('.admin-header-identity').click();
        if(!await page.locator('#view-overview').isVisible())throw new Error('Admin identity does not return to Command Center');
        const totalsFit=await page.locator('.admin-command-metrics strong').evaluateAll(values=>values.every(el=>{const r=el.getBoundingClientRect(),p=el.parentElement,s=getComputedStyle(p);return el.scrollWidth<=el.clientWidth+1&&r.width<=p.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)+1&&r.height<=parseFloat(getComputedStyle(el).lineHeight)+1}));
        if(!totalsFit)throw new Error('Phone Command Center totals wrap or spill out of their cards');
        await page.locator('#accountButton').click();
        if(await page.locator('#accountPanel').evaluate(el=>el.getBoundingClientRect().height)>480)throw new Error('Admin account panel has excess blank space');
        await assertUtilityPanelContrast(page,'#accountPanel','admin-'+name+'-account-contrast');
        await shot(page,'admin-'+name+'-account-panel',{fullPage:false});
        await page.locator('#accountPanel [data-close-topbar]').click();
        await page.locator('#notificationBell').click();
        await assertUtilityPanelContrast(page,'#notificationPanel','admin-'+name+'-notification-contrast');
        await shot(page,'admin-'+name+'-notification-panel',{fullPage:false});
        await page.locator('#topbarSheetBackdrop').click({position:{x:8,y:200}});
        if(await page.locator('#notificationPanel').isVisible())throw new Error('Admin notification outside tap did not dismiss');
        await menu.click();await page.locator('#adminSidebarIntelligence').click();
        await page.locator('#adminAiPanel.open').waitFor();
        await assertLayout(page,'admin-'+name+'-intelligence-phone');await shot(page,'admin-'+name+'-intelligence-phone',{fullPage:false});
        await page.setViewportSize({width:viewport.width,height:250});
        await page.waitForFunction(()=>{const panel=document.getElementById('adminAiPanel').getBoundingClientRect(),send=document.getElementById('adminAiSend').getBoundingClientRect();return panel.top>=0&&panel.bottom<=innerHeight+1&&send.right<=innerWidth&&send.bottom<=innerHeight},null,{timeout:5000});
        await shot(page,'admin-'+name+'-intelligence-keyboard',{fullPage:false});
        await page.setViewportSize(viewport);
        await page.waitForFunction(()=>Math.abs(document.getElementById('adminAiPanel').getBoundingClientRect().height-innerHeight)<2);
        await page.locator('#adminAiClose').click();
        await ensureView(page,'clients');
        const rows=await page.locator('.admin-client-row-business:not(.head)').evaluateAll(rows=>rows.map(row=>({height:row.getBoundingClientRect().height,cells:[...row.children].every(cell=>getComputedStyle(cell).display!=='none')})));
        if(rows.some(row=>row.height>330||!row.cells))throw new Error('Admin account rows lost fields or remain excessively tall');
        await ensureView(page,'onboarding');await shot(page,'admin-'+name+'-onboarding-viewport',{fullPage:false});
      }
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
      const removePhone=page.locator('#phoneTable [data-delete-phone]').first(),phoneId=await removePhone.getAttribute('data-delete-phone');
      const phoneNumber=await page.evaluate(id=>adminPhoneData.find(item=>String(item.id)===String(id))?.number||'',phoneId);
      const removeRoute=/\/api\/account\?action=admin-phone-number-delete$/;let removeRequests=0;
      await page.route(removeRoute,async route=>{removeRequests++;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Responsive QA must never delete stored inventory'})})});
      try{
        await removePhone.click();await page.locator('#adminActionConfirmationModal').waitFor({state:'visible'});
        if(!phoneNumber||!(await page.locator('#adminActionConfirmationCopy').textContent()).includes(phoneNumber))throw new Error('Responsive phone review omitted its number at '+name+' width');
        await page.locator('#closeAdminActionConfirmation').focus();await page.keyboard.press('Shift+Tab');
        if(!await page.locator('#submitAdminActionConfirmation').evaluate(el=>el===document.activeElement))throw new Error('Responsive phone review did not trap keyboard focus at '+name+' width');
        await page.locator('#cancelAdminActionConfirmation').scrollIntoViewIfNeeded();await assertLayout(page,kind+'-'+name+'-phone-removal-review');await shot(page,kind+'-'+name+'-phone-removal-review');
        await page.locator('#cancelAdminActionConfirmation').click();await page.locator('#adminActionConfirmationModal').waitFor({state:'hidden'});
        await page.waitForFunction(id=>document.activeElement?.dataset?.deletePhone===id||document.activeElement?.id==='addPhoneButton',phoneId);
        if(removeRequests!==0)throw new Error('Responsive phone cancellation sent a deletion request');
      }finally{await page.unroute(removeRoute)}
      await ensureView(page,'inbox');
      await page.evaluate(()=>{currentInboxItem={kind:'website',id:'qa-mobile-inbox-ui-only',prospect:{id:'qa-mobile-inbox-ui-only',name:'QA mobile inquiry',email:'mobile-review@callercore.test',business:'Fictional mobile workspace',stage:'new'},messages:[{id:'qa-mobile-message',direction:'inbound',from:'mobile-review@callercore.test',channel:'qa-in-page',body:'A fictional inquiry for mobile layout and keyboard verification. No message is sent by this check.',at:Date.now()}]};renderInboxThread()});
      await page.locator('#inboxReplyText').fill('Unsent mobile review draft');
      await page.locator('#inboxReplyText').focus();await page.keyboard.press('Tab');
      if(!await page.locator('#inboxReplyForm button[type="submit"]').evaluate(el=>el===document.activeElement))throw new Error('Inbox composer keyboard order skipped its send action at '+name+' width');
      await page.locator('#inboxReplyForm button[type="submit"]').scrollIntoViewIfNeeded();
      const inboxSend=await page.locator('#inboxReplyForm button[type="submit"]').boundingBox();
      if(!inboxSend||inboxSend.x<0||inboxSend.x+inboxSend.width>viewport.width+1||inboxSend.y<0||inboxSend.y+inboxSend.height>viewport.height+1)throw new Error('Inbox send action is not reachable at '+name+' width');
      await page.evaluate(()=>{document.getElementById('inboxReplyStatus').textContent='Reply delivery could not be confirmed. Review the provider before retrying; another send could create duplicate mail.'});
      await assertLayout(page,kind+'-'+name+'-inbox-composer');await shot(page,kind+'-'+name+'-inbox-composer');
    }
    {
      const views=await page.locator('button.nav-item[data-view]').evaluateAll(nodes=>[...new Set(nodes.map(node=>node.dataset.view).filter(Boolean))]);
      if(kind==='client')views.push('conversations');
      for(const view of views){
        await ensureView(page,view);
        // Gather independent view defects in one run without weakening the gate.
        for(const verify of [assertLayout,assertReadableCopy]){
          try{await verify(page,kind+'-'+name+'-'+view)}catch(error){report.visualFailures.push(String(error?.message||error))}
        }
        if(kind==='admin'&&(view==='overview'||view==='finance')){
          const chart=page.locator(view==='overview'?'#adminFinanceChart':'#financePageChart');
          const months=chart.locator('[data-finance-index]');
          for(const [edge,month] of [['first',months.first()],['last',months.last()]]){
            await month.press('Enter');
            const tip=chart.locator('.admin-chart-tooltip');await tip.waitFor({state:'visible'});
            const bounds=await tip.boundingBox(),shellBounds=await chart.boundingBox();
            if(!bounds||!shellBounds||bounds.x<shellBounds.x-1||bounds.x+bounds.width>shellBounds.x+shellBounds.width+1)report.visualFailures.push(kind+'-'+name+'-'+view+' finance tooltip clips exact values');
            const lowContrast=await chart.evaluate(shell=>{
              const el=shell.querySelector('.admin-chart-tooltip');
              if(!el||el.hidden)throw new Error('Finance details disappeared during chart refresh');
              const rgb=value=>value.match(/[\d.]+/g).map(Number);
              const composite=(fg,bg)=>fg.slice(0,3).map((c,i)=>c*(fg[3]??1)+bg[i]*(1-(fg[3]??1)));
              const luminance=c=>c.map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
              const bg=composite(rgb(getComputedStyle(el).backgroundColor),[255,255,255]);
              return [...el.querySelectorAll('span,strong,b')].map(label=>{const fg=composite(rgb(getComputedStyle(label).color),bg),a=luminance(fg),b=luminance(bg);return {text:label.textContent,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}}).filter(label=>label.contrast<4.5);
            });
            if(lowContrast.length)report.visualFailures.push(kind+'-'+name+'-'+view+' finance tooltip text lacks contrast: '+JSON.stringify(lowContrast));
            if(edge==='last')await shot(page,kind+'-'+name+'-'+view+'-finance-detail',{fullPage:false});
            await month.press('Escape');await tip.waitFor({state:'hidden'});
          }
        }
        await shot(page,kind+'-'+name+'-'+view);
      }
    }
    await assertSectionAlertContext(page,kind,kind+'-'+name);
    if(kind==='client'){
      await verifyBillingDialogs(page,{assertLayout,shot,ensureView,label:kind+'-'+name});
      await ensureView(page,'settings');
      await page.locator('[data-settings-edit="notifications"]').click();
      await assertLayout(page,kind+'-'+name+'-settings-section-edit');
      if(viewport.width<=600){
        const footer=await page.locator('#settingsSectionActions').boundingBox();
        if(!footer||footer.y<0||footer.y+footer.height>viewport.height)throw new Error('Mobile Settings actions fell outside the viewport');
      }
      await shot(page,kind+'-'+name+'-settings-section-edit',{fullPage:false});
      await page.locator('#settingsCancelButton').click();
      await ensureView(page,'leads');await page.locator('.followup-view-call').first().click();await page.locator('#callDrawer.open').waitFor({state:'visible'});
      await assertCompletionRecovery(page,kind+'-'+name);await page.locator('#closeCallDrawer').click();
    }
    report[kind].responsive.push({name,...viewport});
  }catch(err){
    await shot(page,kind+'-'+name+'-failure').catch(()=>{});
    throw err;
  }finally{
    await context.close().catch(()=>{});
  }
}

async function runReadOnlyBannerQA(viewport,name){
  const {context,page}=await makeContext(viewport,'read-only-'+name);
  try{
    await startSession(context,'admin');
    await post(context.request,'admin-view-client',{id:report.workspaceId});
    await gotoAuthed(page,'/dashboard','button.nav-item[data-view="overview"]');
    await page.locator('.admin-view-banner').waitFor({state:'visible'});
    const check=async(label,{sidebar=false,table=false}={})=>{
      const state=await page.evaluate(({sidebar,table})=>{
        const box=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
        return {banner:box('.admin-view-banner'),topbar:box('.topbar'),sidebar:sidebar?box('.sidebar'):null,table:table?box('.view.active .sticky-table-head'):null};
      },{sidebar,table});
      if(!state.banner||!state.topbar||state.topbar.top<state.banner.bottom-1)throw new Error(label+' banner covers the client header: '+JSON.stringify(state));
      if(state.sidebar&&state.sidebar.top<state.banner.bottom-1)throw new Error(label+' banner covers the sidebar: '+JSON.stringify(state));
      if(state.table&&state.table.top<state.topbar.bottom-1)throw new Error(label+' sticky table covers the client header: '+JSON.stringify(state));
      report.layoutContracts.push({label,...state});
    };
    await assertLayout(page,'read-only-'+name+'-overview');
    await check('read-only-'+name+'-header',{sidebar:viewport.width>760});
    await shot(page,'read-only-'+name+'-overview');
    await ensureView(page,'leads');
    if(await page.locator('[data-team-status]:enabled').count())throw new Error('Read-only client inspection offered editable follow-up status');
    await page.locator('.followup-view-call').first().click();
    await page.locator('#callDrawer.open').waitFor({state:'visible'});
    if(await page.locator('#drawerTeamStatus').isEnabled()||await page.locator('#drawerFollowupButton').isEnabled())throw new Error('Read-only call drawer offered a status mutation');
    const closeBounds=await page.locator('#closeCallDrawer').boundingBox(),bannerBounds=await page.locator('.admin-view-banner').boundingBox();
    if(!closeBounds||!bannerBounds||closeBounds.y<bannerBounds.y+bannerBounds.height)throw new Error('Read-only banner obscures the call drawer close control');
    await shot(page,'read-only-'+name+'-call-drawer',{fullPage:false});
    await page.locator('#closeCallDrawer').click();
    await ensureView(page,'overview');
    if(viewport.width<=760){
      await page.locator('.mobile-menu').click();await check('read-only-'+name+'-menu',{sidebar:true});
      await shot(page,'read-only-'+name+'-menu',{fullPage:false});
    }else{
      await ensureView(page,'calls');await page.locator('.call-row.data').nth(15).scrollIntoViewIfNeeded();
      await check('read-only-'+name+'-scrolled-table',{sidebar:true,table:true});
      await shot(page,'read-only-'+name+'-scrolled-table',{fullPage:false});
    }
    await page.locator('#exitAdminView').click();
    await page.waitForURL('**/admin-dashboard');
  }finally{await context.close().catch(()=>{})}
}

async function runPublicSiteQA(){
  report.publicSite={pages:[],contracts:[],interactions:[]};
  for(const [name,viewport] of [['wide',{width:1920,height:1080}],['laptop',{width:1440,height:1000}],['tablet',{width:768,height:1024}],['large-phone',{width:430,height:932}],['phone',{width:390,height:844}],['small-phone',{width:320,height:740}]]){
    const {context,page}=await makeContext(viewport,'public-'+name);
    try{
      await page.route('**/api/site-track',r=>r.fulfill({status:204,body:''}));
      await page.route('https://js.stripe.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'/* Checkout is not initiated in this visual test. */'}));
      await page.route('**/api/reveal-token',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({token:Date.now()+'.preview-qa'})}));
      await page.route('**/api/demo-number',()=>{throw new Error('Public visual QA must not reveal or dial a live number')});
      await page.route('**/api/create-checkout-session',()=>{throw new Error('Public visual QA must not create a payment session')});
      await page.route('**/api/chat',()=>{throw new Error('Public visual QA must not send a chat message')});
      const contract=async label=>{
        const state=await page.evaluate(()=>{
          const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
          const overflowing=[...document.querySelectorAll('main :is(section,article,form,input:not([type=checkbox]),select,textarea,.phone-demo,.live-stage,.business-day)')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1}).map(el=>el.className||el.id||el.tagName);
          const smallFields=innerWidth<=600?[...document.querySelectorAll('main input:not([type=checkbox]),main select,main textarea')].filter(visible).filter(el=>parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.name||el.id):[];
          const smallCopy=[...document.querySelectorAll('main p,main label,main summary')].filter(visible).filter(el=>parseFloat(getComputedStyle(el).fontSize)<12).map(el=>el.textContent.slice(0,80));
          const footerTop=document.querySelector('.footer-top')?.getBoundingClientRect(),footerBottom=document.querySelector('.footer-bottom')?.getBoundingClientRect();
          const footerCopy=document.querySelector('.footer-cta p'),footerCta=footerCopy?.parentElement;
          const misalignedFooterCopy=!!(footerCopy&&footerCta&&getComputedStyle(footerCta).display==='block'&&Math.abs(footerCopy.getBoundingClientRect().left-footerCta.getBoundingClientRect().left)>2);
          const brokenFooter=misalignedFooterCopy||!!(footerTop&&footerBottom&&footerBottom.top<footerTop.bottom-1);
          return {width:innerWidth,overflowing,smallFields,smallCopy,brokenFooter,h1:document.querySelectorAll('main h1').length};
        });
        report.publicSite.contracts.push({label,...state});
        if(state.h1!==1||state.overflowing.length||state.smallFields.length||state.smallCopy.length||state.brokenFooter)throw new Error('Public site layout failure '+label+': '+JSON.stringify(state));
      };
      for(const [route,key] of [['/','home'],['/contact','contact'],['/live-demo','demo'],['/get-started','get-started'],['/privacy','privacy'],['/terms','terms'],['/login','login'],['/404','not-found'],['/checkout-complete','checkout-status'],['/unsubscribe','email-preferences']]){
        await page.goto(baseURL+route,{waitUntil:'networkidle'});
        await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);
        await contract(name+'-'+key);await shot(page,'public-'+name+'-'+key);
        report.publicSite.pages.push(name+'-'+key);
        if(key==='home'){
          const visitorLayout=await page.evaluate(()=>{
            const rect=s=>document.querySelector(s).getBoundingClientRect();
            return {footerHeight:rect('.site-footer').height,dashboardCards:document.querySelectorAll('[data-dashboard-card]').length,industryLinks:document.querySelectorAll('.industry-group:not([aria-hidden]) a').length,featureHeights:[...document.querySelectorAll('.feature-grid article')].map(el=>el.getBoundingClientRect().height),growthColors:[...document.querySelectorAll('.featured li')].map(el=>getComputedStyle(el).color)};
          });
          if(visitorLayout.dashboardCards!==4||visitorLayout.industryLinks!==6||visitorLayout.growthColors.some(color=>color==='rgb(208, 204, 195)'))throw new Error('Visitor layout lacks dashboard views, industry destinations or legible plan features: '+JSON.stringify(visitorLayout));
          if(viewport.width<=600&&(visitorLayout.footerHeight>420||visitorLayout.featureHeights.some(height=>height>190)))throw new Error('Phone footer or capability rows remain oversized: '+JSON.stringify(visitorLayout));
          report.publicSite.contracts.push({label:name+'-visitor-layout',...visitorLayout});
          await shot(page,'public-'+name+'-home-first-screen',{fullPage:false});
          if(viewport.width<=900){
            await page.locator('.menu').click();await page.locator('#primary-nav.open').waitFor();
            if(await page.locator('.menu').getAttribute('aria-expanded')!=='true')throw new Error('Public mobile menu did not announce its open state');
            if(!await page.locator('#primary-nav a').first().evaluate(el=>el===document.activeElement))throw new Error('Opening phone navigation did not focus its first link');
            const menuGeometry=await page.evaluate(()=>{const header=document.querySelector('.site-header'),nav=document.getElementById('primary-nav'),h=header.getBoundingClientRect(),n=nav.getBoundingClientRect();return {headerBottom:h.bottom,navTop:n.top,left:n.left,right:n.right,width:innerWidth,background:getComputedStyle(header).backgroundColor,radius:getComputedStyle(nav).borderRadius};});
            if(Math.abs(menuGeometry.navTop-menuGeometry.headerBottom)>2||Math.abs(menuGeometry.left)>1||Math.abs(menuGeometry.right-menuGeometry.width)>2||menuGeometry.radius!=='0px'||menuGeometry.background!=='rgb(255, 254, 250)')throw Error('Mobile navigation is detached or the light header regressed: '+JSON.stringify(menuGeometry));
            const menuSize=await page.locator('.menu').boundingBox();
            if(menuSize.width<90||menuSize.height<44||!await page.locator('.nav-backdrop').isVisible())throw new Error('Phone navigation lacks a prominent control or dismissible backdrop');
            await page.locator('#primary-nav a').last().focus();await page.keyboard.press('Tab');
            if(!await page.locator('.menu').evaluate(el=>el===document.activeElement))throw new Error('Phone menu keyboard focus escaped behind the navigation');
            await page.keyboard.press('Tab');
            if(!await page.locator('#primary-nav a').first().evaluate(el=>el===document.activeElement))throw new Error('Phone menu did not cycle back to its links');
            await shot(page,'public-'+name+'-navigation',{fullPage:false});
            await page.locator('.menu').press('Escape');
            if(await page.locator('.menu').getAttribute('aria-expanded')!=='false')throw new Error('Public mobile menu did not close on Escape');
            await page.locator('.menu').click();await page.locator('.nav-backdrop').click({position:{x:2,y:600}});
            if(await page.locator('.menu').getAttribute('aria-expanded')!=='false'||!await page.locator('.nav-backdrop').isHidden())throw new Error('Phone navigation backdrop failed to dismiss');
            await page.locator('.menu').click();await page.locator('#primary-nav a[href="/#pricing"]').click();
            if(await page.locator('.menu').getAttribute('aria-expanded')!=='false')throw new Error('Public anchor navigation left the phone menu open');
          }
          await page.locator('[data-dashboard-view="calls"]').click();
          if(await page.locator('[data-dashboard-view="calls"]').getAttribute('aria-pressed')!=='true'||!(await page.locator('[data-dashboard-caption]').innerText()).includes('who called'))throw new Error('Dashboard stack selection did not update');
          await page.locator('[data-dashboard-view="calls"]').press('ArrowRight');
          if(await page.locator('[data-dashboard-view="contacts"]').getAttribute('aria-pressed')!=='true')throw new Error('Dashboard stack is not keyboard operable');
          await page.locator('.dashboard-layer.is-front .dashboard-window-head [data-dashboard-expand]').click();
          await page.locator('.dashboard-lightbox[open]').waitFor();
          if(!(await page.locator('[data-full-title]').innerText()).includes('Contacts · sample workspace'))throw new Error('Dashboard enlargement lost its sample label');
          const viewer=page.locator('.dashboard-lightbox'),picture=page.locator('.dashboard-viewport');
          const viewerBox=await viewer.boundingBox();if(viewerBox.x<12||viewerBox.y<12||viewerBox.width>viewport.width-24||viewerBox.height>viewport.height*.82)throw Error('Dashboard viewer leaves no outside dismissal space');
          await page.waitForFunction(()=>{const image=document.querySelector('.dashboard-lightbox img'),v=document.querySelector('.dashboard-viewport');return image.complete&&image.naturalWidth>0&&image.style.visibility==='visible'&&v.scrollWidth-v.clientWidth<=2&&v.scrollHeight-v.clientHeight<=2;},{},{timeout:10000});
          const fitted=await picture.evaluate(el=>({x:el.scrollWidth-el.clientWidth,y:el.scrollHeight-el.clientHeight}));if(fitted.x>2||fitted.y>2)throw Error('Dashboard picture did not initially fit');
          await shot(page,'public-'+name+'-dashboard-viewer-fit',{fullPage:false});
          await picture.focus();for(let z=0;z<6;z++)await page.keyboard.press('+');
          const enlarged=await picture.evaluate(el=>{el.scrollLeft=100;el.scrollTop=100;return {x:el.scrollWidth-el.clientWidth,y:el.scrollHeight-el.clientHeight,left:el.scrollLeft,top:el.scrollTop};});if(enlarged.x<=0||enlarged.y<=0||enlarged.left<=0||enlarged.top<=0)throw Error('Zoomed dashboard cannot scroll in both directions');
          const closeBox=await page.locator('[data-viewer-close]').boundingBox();if(closeBox.y<viewerBox.y||closeBox.y+closeBox.height>viewport.height||closeBox.x+closeBox.width>viewport.width)throw Error('Dashboard close action escaped the viewer');
          await shot(page,'public-'+name+'-dashboard-viewer-zoom',{fullPage:false});
          await picture.focus();await page.keyboard.press('0');if(await page.locator('[data-zoom-level]').innerText()!=='100%')throw Error('Dashboard fit action did not reset zoom');
          if(viewport.width<=600){
            const touch=await page.context().newCDPSession(page),box=await picture.boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
            const points=d=>[{x:cx-d,y:cy,id:1},{x:cx+d,y:cy,id:2}];
            await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(25)});
            for(const distance of [35,50,65])await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(distance)});
            await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            if(parseInt(await page.locator('[data-zoom-level]').innerText())<=100)throw Error('Two-finger picture pinch did not zoom');
            const bounds=await page.locator('[data-viewer-close]').boundingBox();if(bounds.y!==closeBox.y)throw Error('Pinching picture moved its exit control');
            await touch.detach();await shot(page,'public-'+name+'-dashboard-viewer-pinch',{fullPage:false});
          }
          await page.locator('[data-viewer-close]').click();
          if(!await page.locator('.dashboard-layer.is-front .dashboard-window-head [data-dashboard-expand]').evaluate(el=>el===document.activeElement))throw new Error('Closing dashboard enlargement lost keyboard focus');
          await page.locator('.dashboard-layer.is-front .dashboard-window-head [data-dashboard-expand]').click();await page.locator('.dashboard-lightbox[open]').waitFor();await page.mouse.click(4,viewport.height/2);if(await viewer.getAttribute('open')!==null)throw Error('Dashboard outside tap did not close preview');
          await shot(page,'public-'+name+'-dashboard-stack',{fullPage:false});
          await page.locator('#monthlyCalls').press('Home');for(let step=0;step<20;step++)await page.locator('#monthlyCalls').press('ArrowRight');
          if(await page.locator('#monthlyMinutes').innerText()!=='630'||!(await page.locator('#planSuggestion').innerText()).includes('Above Growth'))throw new Error('Call volume planner returned an incorrect estimate');
          await page.locator('#monthlyCalls').press('ArrowLeft');
          if(await page.locator('#monthlyMinutes').innerText()!=='600')throw new Error('Call volume planner is not keyboard operable');
          await shot(page,'public-'+name+'-planner',{fullPage:false});
          await page.emulateMedia({reducedMotion:'reduce'});
          if(await page.locator('#estimateBar').evaluate(el=>getComputedStyle(el).transitionDuration)!=='0s')throw new Error('Planner ignores reduced motion');
          await page.emulateMedia({reducedMotion:'no-preference'});
          await page.locator('.faq-list summary').first().click();await page.locator('.faq-list details[open] p').first().waitFor();
          await page.locator('#ccChatLauncher').click();await page.locator('#ccChatPanel.open').waitFor();await page.locator('#ccChatClose').click();
          if(viewport.width===390){
            await page.route('**/api/contact',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,prospectId:'qa-intercepted-chat',warning:'Your inquiry was saved, but its email notification could not be confirmed.'})}));
            try{
              await page.locator('#ccChatLauncher').click();await page.locator('#ccChatHandoffButton').click();
              if(!await page.locator('#ccChatHandoff [name="name"]').evaluate(el=>el===document.activeElement))throw new Error('Phone chat handoff did not focus its first field');
              const handoffUsable=await page.locator('#ccChatHandoff').evaluate(el=>[...el.querySelectorAll('input,textarea,button')].every(x=>x.getBoundingClientRect().height>=43&&x.getBoundingClientRect().right<=innerWidth&&(!x.matches('input,textarea')||parseFloat(getComputedStyle(x).fontSize)>=16)));
              if(!handoffUsable)throw new Error('Phone chat handoff has cramped or overflowing fields');
              await shot(page,'public-phone-chat-handoff-form',{fullPage:false});
              await page.locator('#ccChatClose').click();await page.locator('#ccChatLauncher').click();
              await page.waitForFunction(()=>document.activeElement===document.querySelector('#ccChatHandoff [name="name"]'));
              await page.locator('#ccChatHandoff [name="name"]').fill('Preview QA');await page.locator('#ccChatHandoff [name="email"]').fill('preview-qa@example.test');await page.locator('#ccChatHandoff [name="message"]').fill('Intercepted phone receipt test');
              await page.locator('#ccChatHandoff button[type="submit"]').click();await page.locator('.cc-chat-handoff-success').waitFor();
              if(!(await page.locator('.cc-chat-handoff-success').innerText()).includes('notification could not be confirmed')||!await page.locator('.cc-chat-handoff-success').evaluate(el=>el===document.activeElement))throw new Error('Chat handoff lost saved-message warning or receipt focus');
              await shot(page,'public-phone-chat-handoff-receipt',{fullPage:false});await page.locator('.cc-chat-handoff-success button').click();
              if(!await page.locator('#ccChatForm').isVisible()||await page.locator('#ccChatHandoffButton').isVisible())throw new Error('Chat handoff receipt did not return safely to chat');
              await page.locator('#ccChatClose').click();
              report.publicSite.interactions.push('phone chat handoff saved receipt, escaped warning and keyboard focus with return to chat; no inquiry transmitted');
            }finally{await page.unroute('**/api/contact')}
          }
          await page.locator('.footer-bottom').scrollIntoViewIfNeeded();
          const footerActionClear=await page.evaluate(()=>{
            const a=document.querySelector('.footer-bottom a').getBoundingClientRect(),b=document.querySelector('#ccChatLauncher').getBoundingClientRect();
            return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;
          });
          if(!footerActionClear)throw new Error('Floating assistant covers the footer plan link at '+name);
          report.publicSite.contracts.push({label:name+'-footer-action-clear',ok:footerActionClear});
          await shot(page,'public-'+name+'-footer',{fullPage:false});
          report.publicSite.interactions.push(name+' menu/anchor/Escape, example selection, FAQ and chat open/close without sending');
        }
        if(key==='get-started'){
          const assertCheckoutHeading=async()=>{if(await page.locator('.checkout-stage.active .stage-head>div:has(h2)').evaluate(el=>getComputedStyle(el).display)!=='block')throw new Error('Checkout heading inherited the demo row layout')};
          await assertCheckoutHeading();
          await page.locator('[data-plan="Starter"]').click();await page.locator('#toBusiness').click();await page.locator('#stage2.active').waitFor();
          if(!await page.locator('#stage2 .stage-head h2').evaluate(el=>el===document.activeElement))throw new Error('Business step did not receive keyboard focus');
          await assertCheckoutHeading();await contract(name+'-business-details');await shot(page,'public-'+name+'-business-details');
          await page.locator('#backToPlan').click();
          if(await page.locator('[data-plan="Starter"]').getAttribute('aria-pressed')!=='true')throw new Error('Public checkout lost the selected plan after navigation');
          if(!await page.locator('#stage1 .stage-head h2').evaluate(el=>el===document.activeElement))throw new Error('Plan step did not recover keyboard focus');
          report.publicSite.interactions.push(name+' plan selection and business-step navigation without payment');
        }
        if(key==='contact'&&name==='phone'){
          let attempts=0;await page.route('**/api/contact',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(++attempts===1?{ok:true}:{ok:true,prospectId:'public-visual-qa'})}));
          await page.locator('#contactForm [name="name"]').fill('Preview Visual QA');await page.locator('#contactForm [name="email"]').fill('preview-qa@callercore.test');await page.locator('#contactForm [name="message"]').fill('Isolated UI verification; this request is intercepted and never sent.');
          await page.locator('#contactForm button[type="submit"]').click();await page.locator('#contactStatus.error').waitFor();
          if(!await page.locator('#contactForm').isVisible())throw new Error('Unverified inquiry receipt hid the contact draft');
          await page.locator('#contactForm button[type="submit"]').click();await page.locator('#contactSuccess').waitFor({state:'visible'});if(await page.locator('#contactForm').isVisible()||await page.locator('#contactForm [name="message"]').inputValue())throw new Error('Contact receipt retained visible form or submitted message');await shot(page,'public-phone-contact-receipt',{fullPage:false});
          await page.locator('#contactNewMessage').click();if(!await page.locator('#contactForm [name="name"]').evaluate(el=>el===document.activeElement)||await page.locator('#contactForm button[type="submit"]').isDisabled())throw new Error('New contact message did not reset form and keyboard focus');
          report.publicSite.interactions.push('contact malformed receipt preserves draft, verified intercepted receipt shows success; no inquiry transmitted');
        }
      }
    }finally{await context.close().catch(()=>{})}
  }
}

try{
  await runPublicSiteQA();
  await verifyCustomerExperience({makeContext,baseURL,assertLayout,shot,report});
  await verifyVoiceOperations({makeContext,baseURL,shot,report});
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
  report.nativeBilling={uiFixture:true,providerComplete:false,note:'Billing UI uses intercepted canonical fixtures. Separate real Stripe acceptance is recorded in docs/STRIPE_SANDBOX_ACCEPTANCE.md.'};
  await verifyBillingDialogs(desktop.page,{assertLayout,shot,ensureView,label:'client-desktop'});
  await runClientInteractions(desktop.page);
  await verifyLiveClientIntelligence(desktop.context,desktop.page);

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
  await runResponsive('admin',{width:1536,height:864},'wide-laptop');
  await runResponsive('admin',{width:1040,height:900},'small-laptop');
  await runResponsive('client',{width:768,height:1024},'tablet');
  await runResponsive('admin',{width:768,height:1024},'tablet');
  await runResponsive('client',{width:320,height:760},'small-phone');
  await runResponsive('client',{width:390,height:844},'mobile');
  await runResponsive('client',{width:430,height:932},'large-phone');
  await runResponsive('admin',{width:390,height:844},'mobile');
  await runResponsive('admin',{width:320,height:760},'small-phone');
  await runResponsive('admin',{width:430,height:932},'large-phone');
  await runReadOnlyBannerQA({width:1440,height:900},'desktop');
  await runReadOnlyBannerQA({width:390,height:844},'mobile');

  if(report.visualFailures.length)throw new Error('Dashboard visual verification failures:\n'+report.visualFailures.join('\n'));
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



