const PLAN_DATA={
Starter:{price:349,minutes:300,locations:1,used:214,features:{appointments:false,sms:false,automations:false,advancedAnalytics:false,apiAccess:false,unifiedInbox:false},unlock:'Growth'},
Growth:{price:599,minutes:600,locations:2,used:428,features:{appointments:false,sms:false,automations:true,advancedAnalytics:true,apiAccess:false,unifiedInbox:true},unlock:'Pro'},
Pro:{price:999,minutes:null,locations:5,used:1240,features:{appointments:false,sms:false,automations:true,advancedAnalytics:true,apiAccess:true,unifiedInbox:true},unlock:null}
};
const FEATURE_INFO={
appointments:{title:'Appointment booking',copy:'Calendar-connected booking is planned for a later release.',tier:'Growth',deferred:true,items:['Calendar sync','Booking rules','Confirmations','Reschedule handling']},
automations:{title:'Advanced automations',copy:'Build follow-up sequences from call and lead events.',tier:'Growth',items:['Missed-call recovery','Lead follow-up','Team alerts','AI outbound steps']},
advancedAnalytics:{title:'Advanced analytics',copy:'Go beyond totals with conversion trends, call reasons and after-hours impact.',tier:'Growth',items:['Conversion trends','Call reason analysis','After-hours demand','Call attribution']},
apiAccess:{title:'API & webhooks',copy:'Connect CallerCore to custom tools and internal systems.',tier:'Pro',items:['Webhooks','API credentials','Custom events','Advanced integrations']},
unifiedInbox:{title:'Unified inbox',copy:'Keep customer call and digital conversation history in one timeline.',tier:'Growth',items:['Call timeline','Shared notes','Website inquiries','Cross-channel history']}
};
const params=new URLSearchParams(location.search);
const demoMode=location.hostname.endsWith('.vercel.app')&&params.get('demo')==='1';
let currentPlan=params.get('plan')||'Growth';if(!PLAN_DATA[currentPlan])currentPlan='Growth';
let sessionWorkspace=null,sessionOnboarding=null;
let currentUserProfile={displayName:'CallerCore User',email:'',avatarDataUrl:''};
let notificationData=[],notificationUnreadCount=0,notificationsLoading=false,notificationMode='unread',clientFeedbackData=[],adminFeedbackData=[];
let callsData=[],leadsData=[],conversationsData=[],appointmentsData=[],agentData=null,automationsData=[],analyticsData=null,settingsData=null,integrationsData=null,supportTicketsData=[],phoneRoutingData=null,locationsData=[],locationsLimit=1;let conversationFilter='all',activeConversationId=null,activeCallContactKey='',activeCallId='',followupState={},showHandledFollowups=false,agentEditing=false,settingsEditing=false,pendingBusinessLogo=null,agentEditSnapshot=null,overviewChartDays=14,callLogGroupBy='day',callLogSort='newest',callQuickFilter='all',pendingTeamStatusCallId='',callMoreFiltersOpen=false,activeContactKey='',contactHistoryFilter='all',callViewedIds=new Set(),activeNoteEditId='',webhookEditing=false;
const DEMO_CALLS=[
{id:'c1',caller:'Sarah Johnson',phone:'(509) 555-0148',category:'New service',reason:'Roof replacement estimate',duration:'4:32',outcome:'Qualified',agent:'Maya',time:'3:14 PM',summary:'Sarah owns a two-story home and wants a full roof replacement estimate. Maya confirmed the property is in the service area and captured the request for the roofing team to follow up.',qualification:{Intent:'High',Service:'Replacement',Timeline:'This month',Value:'$8,500'},transcript:[['Maya','Thank you for calling Alpine Roofing. This is Maya. How can I help?'],['Sarah','I need an estimate to replace my roof.'],['Maya','Absolutely. I can capture the details for the roofing team. Is the property in Spokane?'],['Sarah','Yes, on the South Hill.']]},
{id:'c2',caller:'Mike Peterson',phone:'(509) 555-0193',category:'New service',reason:'Storm damage inspection',duration:'3:17',outcome:'Qualified',agent:'Maya',time:'2:57 PM',summary:'Mike reported visible shingle damage after a recent storm. He is the homeowner, is within the service area, and asked for an inspection this week.',qualification:{Intent:'High',Service:'Storm damage',Timeline:'This week',Value:'$4,200'},transcript:[['Maya','Tell me what happened with the roof.'],['Mike','We lost shingles in the wind and I can see damage from the yard.'],['Maya','Got it. Are you the homeowner?'],['Mike','Yes.']]},
{id:'c3',caller:'Unknown caller',phone:'Private',category:'General question',reason:'Missed call follow-up',duration:'—',outcome:'Follow-up',agent:'Recovery',time:'2:41 PM',summary:'The caller disconnected before the AI answered. CallerCore created a follow-up item for the team.',qualification:{Intent:'Unknown',Service:'Unknown',Timeline:'Unknown',Value:'—'},transcript:[['CallerCore','Missed call detected. Team follow-up created.']]}
];
const DEMO_LEADS=[
{id:'l1',name:'Emily Ross',service:'Roof leak',value:2800,stage:'New',source:'AI call',age:'12m'},
{id:'l2',name:'David Nguyen',service:'Gutter replacement',value:1900,stage:'Contacted',source:'Website',age:'1h'},
{id:'l3',name:'Mike Peterson',service:'Storm damage',value:4200,stage:'Qualified',source:'AI call',age:'2h'},
{id:'l4',name:'Sarah Johnson',service:'Roof replacement',value:8500,stage:'Appointment',source:'AI call',age:'3h'},
{id:'l5',name:'Jared Lee',service:'Full roof',value:13400,stage:'Won',source:'AI call',age:'2d'},
{id:'l6',name:'Chris Bell',service:'Repair estimate',value:1600,stage:'Lost',source:'Web',age:'4d'}
];
const DEMO_CONVERSATIONS=[
{id:'m1',name:'Sarah Johnson',phone:'(509) 555-0148',status:'Active',last:'Preferred time captured for Tuesday morning.',time:'3:22 PM',messages:[{who:'Maya',text:'Thanks for calling Alpine Roofing today. I captured Tuesday morning as your preferred service window and shared it with the team.',dir:'out'},{who:'Sarah',text:'Perfect, thank you!',dir:'in'}]},
{id:'m2',name:'Mike Peterson',phone:'(509) 555-0193',status:'Needs follow-up',last:'Can someone come by this week?',time:'3:02 PM',messages:[{who:'Maya',text:'Thanks for speaking with me about the storm damage. I shared your request with the team.',dir:'out'},{who:'Mike',text:'Can someone come by this week?',dir:'in'}]},
{id:'m3',name:'Unknown caller',phone:'Private',status:'Needs follow-up',last:'Missed call added for team follow-up.',time:'2:42 PM',messages:[{who:'CallerCore',text:'Missed call follow-up task created',dir:'system'}]}
];
const DEMO_APPOINTMENTS=[
{id:'a1',name:'Sarah Johnson',phone:'(509) 555-0148',date:'Tue, Sep 22',time:'10:30 AM',service:'Roof replacement inspection',status:'Confirmed',source:'Maya'},
{id:'a2',name:'Emily Ross',phone:'(509) 555-0114',date:'Wed, Sep 23',time:'1:00 PM',service:'Roof leak inspection',status:'Scheduled',source:'Maya'},
{id:'a3',name:'Jared Lee',phone:'(509) 555-0181',date:'Fri, Sep 18',time:'9:00 AM',service:'Full roof estimate',status:'Completed',source:'Team'}
];
const DEMO_AGENT={name:'Maya',role:'AI Receptionist',openingMessage:'Thank you for calling Alpine Roofing. This is Maya. How can I help you today?',tone:'Warm & professional',serviceArea:'Spokane, Spokane Valley, Liberty Lake and nearby communities.',businessHours:'Monday–Friday 8 AM–5 PM. Saturday by appointment.',emergencyInstructions:'For active leaks or storm damage, collect the address, confirm safety, and mark the lead urgent for immediate team follow-up.',qualificationQuestions:['What service are you calling about?','Are you the property owner?','What is the property address?','How soon are you hoping to have the work completed?'],transferNumber:'(509) 555-0100'};
const DEMO_AUTOMATIONS=[
{id:'auto1',name:'Missed-call follow-up',trigger:'missed_call',action:'create_followup',enabled:true},
{id:'auto2',name:'Hot lead team alert',trigger:'qualified_lead',action:'notify_team',enabled:true}
];
const DEMO_SETTINGS={businessName:'Alpine Roofing',primaryEmail:'owner@alpineroofing.com',timezone:'America/Los_Angeles',notificationEmail:'owner@alpineroofing.com',smsAlerts:false,emailAlerts:true};
const DEMO_INTEGRATIONS={googleCalendar:false,stripe:true,webhookUrl:'',apiAccess:false};
const LEAD_STAGES=['New','Contacted','Qualified','Appointment','Won','Lost'];
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

async function bootstrapClient(){
  if(document.body.dataset.dashboard!=='client')return true;
  if(demoMode){document.body.classList.add('demo-mode');return true}
  try{
    const r=await fetch('/api/account?action=session',{headers:{Accept:'application/json'},cache:'no-store'});
    if(r.status===401){location.replace('/login?next=%2Fdashboard');return false}
    if(!r.ok)throw new Error('session');
    const data=await r.json();sessionWorkspace=data.workspace;sessionOnboarding=data.onboarding||null;applyUserProfile(data.user||{},data.workspace||{});
    if(data.user?.role==='admin'&&!data.user?.adminView){location.replace('/admin-dashboard');return false}
    if(data.onboarding?.needsCompletion&&!data.user?.adminView&&data.onboarding?.url){location.replace(data.onboarding.url);return false}
    if(data.user?.adminView){
      document.body.classList.add('admin-client-view');
      const banner=document.createElement('div');banner.className='admin-view-banner';
      banner.innerHTML='<span><b>Admin view</b> · Read only · Viewing '+esc(data.workspace.name||'client workspace')+'</span><button id="exitAdminView">Return to Admin</button>';
      document.body.prepend(banner);
      document.getElementById('exitAdminView')?.addEventListener('click',async()=>{
        const x=await fetch('/api/account?action=admin-exit-client-view',{method:'POST'});const out=await x.json().catch(()=>({}));
        location.href=out.redirect||'/admin-dashboard';
      });
    }
    currentPlan=data.workspace.plan;
    const name=data.workspace.name||'CallerCore Client';
    const wName=document.getElementById('workspaceName');if(wName)wName.textContent=name;
    const wMeta=document.getElementById('workspaceMeta');if(wMeta)wMeta.textContent=currentPlan+' plan';
    document.querySelectorAll('[data-business-name]').forEach(el=>el.textContent=name);
    const selector=document.getElementById('planSelector');if(selector)selector.closest('.plan-demo').style.display='none';
    const avatar=document.querySelector('.avatar');if(avatar)avatar.textContent=name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
    const now=new Date(),dateEl=document.getElementById('overviewDate'),greet=document.getElementById('overviewGreeting');
    if(dateEl)dateEl.textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
    if(greet){const hour=now.getHours();greet.textContent=(hour<12?'Good morning':hour<18?'Good afternoon':'Good evening')+'.'}
    if(data.workspace.usage&&Number.isFinite(data.workspace.usage.minutes)){PLAN_DATA[currentPlan].used=data.workspace.usage.minutes}
    renderBillingConnection();return true;
  }catch(err){console.error('Dashboard bootstrap failed',err);location.replace('/login?error=session');return false}
}
async function logout(){try{await fetch('/api/account?action=logout',{method:'POST'})}finally{location.href='/login'}}


function showView(name){
  const active=document.querySelector('.view.active')?.id?.replace('view-','')||'';
  if(active!==name&&document.body.dataset.dashboard==='client'&&(agentEditing||settingsEditing)){
    const area=agentEditing?'AI receptionist':'settings';
    if(!confirm('You are editing '+area+'. Leave without saving these changes?'))return;
    if(agentEditing){if(agentEditSnapshot)agentData=JSON.parse(JSON.stringify(agentEditSnapshot));agentEditSnapshot=null;agentEditing=false;renderAgent()}
    if(settingsEditing){settingsEditing=false;pendingBusinessLogo=String(settingsData?.logoDataUrl||'');renderSettings()}
  }
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));document.querySelector('.sidebar')?.classList.remove('open');window.scrollTo({top:0,left:0,behavior:'auto'});if(name==='overview')renderOverview();if(name==='billing')renderBilling();if(name==='calls')renderCalls();if(name==='contacts')renderContacts();if(name==='leads')renderLeads();if(name==='conversations')renderConversations();if(name==='appointments')renderAppointments();if(name==='agent'){document.getElementById('agentFeedbackComposerDetails')?.removeAttribute('open');document.getElementById('agentFeedbackHistoryDetails')?.removeAttribute('open');renderAgent();loadClientFeedback({silent:true})};if(name==='automations')renderAutomations();if(name==='analytics')renderAnalytics();if(name==='integrations'){webhookEditing=false;renderIntegrations()};if(name==='settings')renderSettings();if(name==='inbox'&&document.body.dataset.dashboard==='admin')loadAdminInbox();
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelector('.mobile-menu')?.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('open'));
window.addEventListener('beforeunload',e=>{if(document.body.dataset.dashboard==='client'&&(agentEditing||settingsEditing)){e.preventDefault();e.returnValue=''}});

function resetSurfaceScroll(surface){
  if(!surface)return;
  const reset=()=>{surface.scrollTop=0;const card=surface.querySelector?.('.modal-card');if(card)card.scrollTop=0};
  reset();requestAnimationFrame(reset);
}
const surfaceOpenObserver=new MutationObserver(entries=>entries.forEach(entry=>{const el=entry.target;if(el.classList?.contains('open'))resetSurfaceScroll(el)}));
document.querySelectorAll('.modal,.call-drawer').forEach(el=>surfaceOpenObserver.observe(el,{attributes:true,attributeFilter:['class']}));

function has(feature){
  if(!demoMode&&sessionWorkspace?.entitlements?.features&&Object.prototype.hasOwnProperty.call(sessionWorkspace.entitlements.features,feature))return !!sessionWorkspace.entitlements.features[feature];
  return !!PLAN_DATA[currentPlan]?.features?.[feature];
}
function capability(name){
  if(!demoMode&&sessionWorkspace?.entitlements?.capabilities)return !!sessionWorkspace.entitlements.capabilities[name];
  return false;
}
function featureStage(el,feature){const info=FEATURE_INFO[feature],ok=has(feature);if(info?.deferred){el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>Coming later.</h2><p class="muted">'+info.copy+'</p></article><article class="panel gate-card"><small>NOT ENABLED AT LAUNCH</small><h2>'+info.title+' is not active yet</h2><p>CallerCore will only expose this feature after the calendar integration is production-ready.</p></article></div>';return}if(ok){el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>Included with '+currentPlan+'</h2><p class="muted">'+info.copy+'</p><div class="fake-chart"></div></article><article class="panel"><span class="eyebrow">Active feature</span><h2>Included in your plan</h2><p class="muted">Use the live controls on this page to configure the feature for your workspace.</p></article></div>'}else{el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>See what this could do for your business.</h2><p class="muted">'+info.copy+'</p><div class="fake-chart"></div></article><article class="panel gate-card"><small>AVAILABLE ON '+info.tier.toUpperCase()+'</small><h2>Unlock '+info.title+'</h2><p>'+info.copy+'</p><ul>'+info.items.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="primary" data-upgrade="'+info.tier+'">Upgrade to '+info.tier+'</button></article></div>'}}
function renderStages(){
  document.querySelectorAll('[data-feature-card]').forEach(el=>featureStage(el,el.dataset.featureCard));
  document.querySelectorAll('[data-feature]').forEach(el=>{
    const f=el.dataset.feature,allowed=has(f),info=FEATURE_INFO[f];
    if(info?.deferred){el.hidden=true;return}
    el.hidden=false;el.classList.toggle('feature-locked',!allowed);el.setAttribute('aria-disabled',allowed?'false':'true');
    const lock=el.querySelector('.lock');
    if(lock){lock.textContent=allowed?'ON':(info?.tier||'Locked').toUpperCase();lock.className='lock '+(allowed?'lock-on':'')}
    if(!allowed&&el.classList.contains('integration-card'))el.title='Requires '+(info?.tier||'a higher plan');
  });
  bindUpgradeButtons()
}

function renderOverviewUnlocks(){
  const el=document.getElementById('overviewUnlocks');if(!el)return;
  const plan=PLAN_DATA[currentPlan],usage=Number(plan?.used||0),limit=plan?.minutes;
  const usageText=limit?(usage.toLocaleString()+' of '+limit.toLocaleString()+' included minutes used'):(usage.toLocaleString()+' AI minutes this billing period');
  const pct=limit?Math.min(100,usage/limit*100):Math.min(100,Math.max(8,usage?38:0));
  el.innerHTML='<div class="plan-strip-copy"><span class="eyebrow">Account</span><b>'+esc(currentPlan)+' plan</b><small>'+esc(usageText)+'</small></div><div class="plan-strip-usage"><div class="usage-track"><i style="width:'+pct+'%"></i></div><button data-view="billing">Billing & usage →</button></div>';
  el.querySelector('[data-view]')?.addEventListener('click',()=>showView('billing'));
}

function renderBillingConnection(){
  const box=document.getElementById('billingConnection'),btn=document.getElementById('paymentButton');if(!box||!btn)return;
  const linked=!!sessionWorkspace?.stripe?.customerLinked;
  box.innerHTML=linked?'<b>Stripe customer linked</b><small>Your subscription is connected to secure Stripe billing.</small>':'<b>Billing account not linked</b><small>This workspace does not currently have a Stripe customer attached.</small>';
  btn.disabled=!linked||!sessionWorkspace?.stripe?.customerLinked;btn.textContent=linked?'Manage billing':'Billing unavailable';
}
function planFeatures(name){
  const starter=[
    'AI receptionist call handling','Custom greeting and business instructions','Searchable call log','AI call summaries','Full transcripts when available','Automatic call-type classification','Contact history built from calls and messages','Follow-up queue for calls needing staff','Internal team notes','Business-hours and after-hours instructions','Phone routing visibility','Email alerts','300 included AI minutes','1 business location','CallerCore support'
  ];
  const growth=[
    'AI receptionist call handling','Custom greeting and business instructions','Searchable call log','AI call summaries','Full transcripts when available','Automatic call-type classification','Contact history built from calls and messages','Follow-up queue for calls needing staff','Internal team notes','Business-hours and after-hours instructions','Phone routing visibility','Email alerts','600 included AI minutes','Up to 2 business locations','Unified conversations','Follow-up automations','Advanced insights','Call-type and after-hours analytics','CallerCore support'
  ];
  const pro=[
    'AI receptionist call handling','Custom greeting and business instructions','Searchable call log','AI call summaries','Full transcripts when available','Automatic call-type classification','Contact history built from calls and messages','Follow-up queue for calls needing staff','Internal team notes','Business-hours and after-hours instructions','Phone routing visibility','Email alerts','High-volume usage plan','Up to 5 business locations','Unified conversations','Follow-up automations','Advanced insights','Call-type and after-hours analytics','API access','Webhooks and custom events','Advanced integrations','High-volume workflows','CallerCore support'
  ];
  return name==='Starter'?starter:name==='Growth'?growth:pro;
}
function planLosses(from,to){
  let losses=from==='Pro'&&to==='Growth'?['API & webhook access','Capacity above 2 locations','High-volume Pro workflows']:from==='Pro'&&to==='Starter'?['API & webhooks','Automations','Advanced insights','Unified conversations','Locations above 1','Higher included usage']:from==='Growth'&&to==='Starter'?['Automations','Advanced insights','Unified conversations','Second location','Higher included usage']:[];
  const target=PLAN_DATA[to],used=Number(PLAN_DATA[currentPlan]?.used||0);if(target?.minutes&&used>target.minutes)losses=[...losses,'Your current usage of '+used+' minutes is above the '+target.minutes+' included minutes on '+to];
  const locationLimit=target?.locations;if(locationLimit&&locationsData.length>locationLimit)losses=[...losses,'You currently use '+locationsData.length+' locations; '+to+' supports '+locationLimit];
  return losses;
}
function renderBilling(){
  const d=PLAN_DATA[currentPlan];
  document.getElementById('billingPlan')&&(document.getElementById('billingPlan').textContent=currentPlan);
  document.getElementById('billingPrice')&&(document.getElementById('billingPrice').textContent='$'+d.price+'/month');
  const usageText=d.minutes?d.used+' / '+d.minutes:d.used+' min · usage policy pending';
  document.getElementById('billingUsageText')&&(document.getElementById('billingUsageText').textContent=usageText);
  const pct=d.minutes?Math.min(100,(d.used/d.minutes)*100):38;document.getElementById('billingUsage')?.style.setProperty('width',pct+'%');document.getElementById('sidebarUsage')?.style.setProperty('width',pct+'%');document.getElementById('sidebarUsageLabel')&&(document.getElementById('sidebarUsageLabel').textContent=usageText);document.getElementById('sidebarPlan')&&(document.getElementById('sidebarPlan').textContent=currentPlan);
  const benefits=document.getElementById('currentPlanBenefits');if(benefits)benefits.innerHTML='<div class="benefits-heading"><b>Everything included in '+esc(currentPlan)+'</b><small>Your current plan already includes all of the following.</small></div>'+planFeatures(currentPlan).map(x=>'<span>✓ '+esc(x)+'</span>').join('');
  const wrap=document.getElementById('planComparison');if(wrap)wrap.innerHTML=Object.entries(PLAN_DATA).filter(([name])=>name!==currentPlan).map(([name,p])=>{const losses=planLosses(currentPlan,name),isUpgrade=p.price>d.price,diff=Math.abs(p.price-d.price);return '<article class="plan-option contextual '+(losses.length?'downgrade-option':'upgrade-option')+'"><span class="eyebrow">'+(isUpgrade?'Upgrade option':'Lower-cost option')+'</span><h3>'+name+'</h3><p class="plan-price-delta">'+(isUpgrade?'+':'−')+'$'+diff+'/mo from your current plan</p><ul>'+planFeatures(name).slice(0,4).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+(losses.length?'<div class="loss-preview"><b>You would give up</b><span>'+losses.slice(0,2).map(esc).join(' · ')+(losses.length>2?' · +'+(losses.length-2)+' more':'')+'</span></div>':'<div class="gain-preview"><b>Adds more capacity and features</b></div>')+'<button class="'+(losses.length?'secondary-btn':'primary')+'" data-upgrade="'+esc(name)+'">'+(losses.length?'Review downgrade':'Review upgrade')+'</button></article>'}).join('');
  bindUpgradeButtons();
}
function setPlan(plan){currentPlan=plan;renderBilling();renderStages();renderOverviewUnlocks();renderEntitledApps()}
function setDataHealth(id,degraded){
  const el=document.getElementById(id);if(!el)return;
  el.hidden=!degraded;
}
function setClientLoading(loading,message='Loading your CallerCore activity…'){
  document.body.classList.toggle('client-data-loading',!!loading);
  const overlay=document.getElementById('clientLoadingState');if(overlay){overlay.hidden=!loading;const copy=overlay.querySelector('span');if(copy)copy.textContent=message}
}
async function fetchJsonRetry(url,{attempts=2,timeout=9000}={}){
  let lastErr;
  for(let attempt=0;attempt<attempts;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout+(attempt*3000));
    try{
      const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||('Request failed ('+r.status+')'));
      return data;
    }catch(err){lastErr=err;if(attempt<attempts-1)await new Promise(resolve=>setTimeout(resolve,500+attempt*500))}
    finally{clearTimeout(timer)}
  }
  throw lastErr||new Error('Request failed');
}
async function loadSecondaryClientData(){
  const tasks=[
    ['leads',d=>{leadsData=d.leads||[]}],
    ['conversations',d=>{conversationsData=d.conversations||[]}],
    ['automations',d=>{automationsData=d.automations||[]}],
    ['locations',d=>{locationsData=d.locations||locationsData;locationsLimit=Number(d.limit||locationsLimit||1)}]
  ];
  await Promise.allSettled(tasks.map(async([action,apply])=>{try{const data=await fetchJsonRetry('/api/account?action='+action,{attempts:1,timeout:8000});apply(data)}catch(_){}}));
  renderContacts();renderConversations();renderAutomations();renderLocations();
}
function renderClientData(){
  loadCallLogPrefs();if(callsData.length&&agentData&&settingsData)setDataHealth('clientDataHealth',false);
  renderCalls();renderLeads();renderConversations();renderAppointments();renderAgent();renderAutomations();renderAnalytics();renderIntegrations();renderSettings();renderOverview();renderBillingConnection();renderPhoneRouting();renderLocations();
}
async function loadOperations(){
  if(demoMode){setDataHealth('clientDataHealth',false);
    callsData=DEMO_CALLS.map(x=>({...x}));leadsData=DEMO_LEADS.map(x=>({...x}));conversationsData=DEMO_CONVERSATIONS.map(x=>({...x}));appointmentsData=DEMO_APPOINTMENTS.map(x=>({...x}));agentData={...DEMO_AGENT,qualificationQuestions:[...DEMO_AGENT.qualificationQuestions]};automationsData=DEMO_AUTOMATIONS.map(x=>({...x}));settingsData={...DEMO_SETTINGS};integrationsData={...DEMO_INTEGRATIONS,apiAccess:has('apiAccess')};phoneRoutingData={number:'(509) 555-0100',label:'Primary',provider:'Vapi',forwardingFrom:'(509) 555-0199',transferNumber:'(509) 555-0101',afterHours:'ai',smsEnabled:false,status:'active'};locationsData=[{id:'loc-demo',name:'Spokane',phone:'(509) 555-0199',address:'Spokane, WA',timezone:'America/Los_Angeles',active:true}];locationsLimit=PLAN_DATA[currentPlan].locations||1;analyticsData=buildLocalAnalytics();followupState={};renderClientData();renderSupport();renderClientSetupStatus();return;
  }
  setClientLoading(true);setDataHealth('clientDataHealth',false);
  try{
    const data=await fetchJsonRetry('/api/account?action=client-dashboard-data',{attempts:2,timeout:15000});
    callsData=data.calls||[];leadsData=data.leads||[];agentData=data.agent||null;settingsData=data.settings||null;integrationsData=data.integrations||null;phoneRoutingData=data.routing||null;locationsData=data.locations||[];locationsLimit=Number(data.locationsLimit||1);conversationsData=data.conversations||[];appointmentsData=data.appointments||[];automationsData=data.automations||[];followupState=data.followupState||{};callViewedIds=new Set((data.viewedCallIds||[]).map(String));analyticsData=buildLocalAnalytics();
    renderClientData();setClientLoading(false);
    // Non-critical support history loads separately so it can never block Today.
    fetchJsonRetry('/api/account?action=support-tickets',{attempts:1,timeout:5000}).then(data=>{supportTicketsData=data.tickets||[];renderSupport()}).catch(()=>{});
    loadSecondaryClientData();
    return;
  }catch(err){console.warn('Bundled dashboard load failed; using fallback',err);setClientLoading(true,'Still loading — retrying your workspace data…')}
  try{
    const requests=[
      ['calls','calls'],['leads','leads'],['agent','agent'],['settings','settings'],['integrations','integrations'],['phone-routing','routing'],['locations','locations']
    ];
    let settled=await Promise.allSettled(requests.map(([action])=>fetchJsonRetry('/api/account?action='+action,{attempts:2,timeout:10000})));
    // One slow optional request should not make a fully usable dashboard look broken.
    const retryIndexes=settled.map((x,i)=>x.status==='rejected'?i:-1).filter(i=>i>=0);
    if(retryIndexes.length){
      const retried=await Promise.allSettled(retryIndexes.map(i=>fetchJsonRetry('/api/account?action='+requests[i][0],{attempts:1,timeout:12000})));
      retryIndexes.forEach((idx,k)=>{if(retried[k].status==='fulfilled')settled[idx]=retried[k]});
    }
    for(let i=0;i<settled.length;i++){if(settled[i].status!=='fulfilled')continue;const [action,key]=requests[i],data=settled[i].value;if(action==='calls')callsData=data.calls||[];else if(action==='leads')leadsData=data.leads||[];else if(action==='agent')agentData=data.agent||null;else if(action==='settings')settingsData=data.settings||null;else if(action==='integrations')integrationsData=data.integrations||null;else if(action==='phone-routing')phoneRoutingData=data.routing||null;else if(action==='locations'){locationsData=data.locations||[];locationsLimit=Number(data.limit||1)}}
    await loadFollowupState();try{const viewed=await fetchJsonRetry('/api/account?action=calls-viewed',{attempts:1,timeout:5000});callViewedIds=new Set((viewed.ids||[]).map(String))}catch(_){callViewedIds=new Set()}analyticsData=buildLocalAnalytics();renderClientData();
    const failedActions=settled.map((x,i)=>x.status==='rejected'?requests[i][0]:'').filter(Boolean),criticalFailed=failedActions.filter(x=>['calls','agent','settings'].includes(x));
    setDataHealth('clientDataHealth',criticalFailed.length>0);setClientLoading(false);
    if(failedActions.length&&!criticalFailed.length)console.warn('Optional dashboard data delayed:',failedActions.join(', '));
  }catch(err){console.error('Operations data failed',err);setClientLoading(false);setDataHealth('clientDataHealth',true)}
}

function recordTime(x){
  const n=Number(x?.createdAt||x?.at||0);if(n)return n;
  const d=Date.parse([x?.date,x?.time].filter(Boolean).join(' '));return Number.isFinite(d)?d:0;
}
function sameLocalDay(ts,date=new Date()){const d=new Date(ts);return d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()&&d.getDate()===date.getDate()}
function withinDays(ts,days){return !!ts&&ts>=Date.now()-days*86400000}
function formatFullDateTime(x){
  const ts=recordTime(x);if(ts)return new Date(ts).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  return [x?.date,x?.time].filter(Boolean).join(' · ')||'Date unavailable';
}
function aiAnsweringState(){
  const paused=settingsData?.aiAnsweringPaused===true||phoneRoutingData?.status==='paused',number=phoneRoutingData?.number||'',routingReady=!!number&&!!phoneRoutingData;
  return {paused,number,routingReady,active:routingReady&&!paused&&(phoneRoutingData?.status||'active')==='active',fallback:settingsData?.aiPauseFallbackNumber||phoneRoutingData?.pauseFallbackNumber||''};
}
function renderAiCoverage(){
  const state=aiAnsweringState(),banner=document.getElementById('aiCoverageBanner'),title=document.getElementById('aiCoverageTitle'),copy=document.getElementById('aiCoverageCopy'),eyebrow=document.getElementById('aiCoverageEyebrow');
  if(!banner||!title||!copy)return;banner.classList.remove('active','paused','setup');
  if(state.active){banner.classList.add('active');if(eyebrow)eyebrow.textContent='AI ANSWERING · ON';title.textContent='CallerCore is set to answer calls';copy.textContent=state.number?'Maya is active on '+state.number+'.':'Maya is ready for incoming calls.'}
  else if(state.paused){banner.classList.add('paused');if(eyebrow)eyebrow.textContent='AI ANSWERING · PAUSED';title.textContent='AI answering is temporarily paused';copy.textContent=state.fallback?'Temporary handoff: '+state.fallback+'.':'Resume answering when your team is ready.'}
  else{banner.classList.add('setup');if(eyebrow)eyebrow.textContent='AI ANSWERING · SETUP NEEDED';title.textContent='Phone routing is not ready yet';copy.textContent='Finish phone setup before relying on CallerCore for inbound coverage.'}
  const name=agentData?.name||'Maya',nameEl=document.getElementById('overviewAgentName');if(nameEl)nameEl.textContent=name;
}
function renderOverview(){
  const todayRows=callsData.filter(x=>sameLocalDay(recordTime(x))),todayCalls=todayRows.length,todayCaptured=todayRows.filter(callCaptured).length,todayResolved=todayRows.filter(callResolvedByAi).length;
  const activeFollowups=followupCandidates().filter(teamStatusActive),urgentActive=activeFollowups.filter(x=>followupType(x)==='urgent').length;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};

  set('overviewCalls',todayCalls);
  set('overviewLeads',todayCaptured);
  set('overviewWeekCalls',todayResolved);
  set('overviewFollowup',activeFollowups.length);
  set('overviewCallsMeta',todayCalls===1?'1 inbound call today':todayCalls+' inbound calls today');
  set('overviewLeadsMeta',todayCaptured===1?'1 request or message captured':todayCaptured+' requests or messages captured');
  set('overviewWeekCallsMeta',todayResolved===1?'1 caller needed no staff action':todayResolved+' callers needed no staff action');
  set('overviewFollowupMeta',activeFollowups.length?(urgentActive?urgentActive+' priority · '+activeFollowups.length+' still open':activeFollowups.length+' requests/messages still open'):'Nothing waiting');

  const attentionCard=document.getElementById('overviewAttentionCard');if(attentionCard)attentionCard.classList.toggle('has-attention',activeFollowups.length>0);
  const name=agentData?.name||'Maya';set('overviewAgentName',name);renderAiCoverage();

  const chart=document.getElementById('overviewLineChart');
  if(chart){
    const days=[];
    for(let i=overviewChartDays-1;i>=0;i--){
      const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const next=d.getTime()+86400000;
      const dayCalls=callsData.filter(x=>{const t=recordTime(x);return t>=d.getTime()&&t<next}),needs=dayCalls.filter(teamStatusActive).length,resolved=dayCalls.filter(callResolvedByAi).length,captured=dayCalls.filter(callCaptured).length;
      days.push({date:callLocalDateValue(d.getTime()),label:d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}),short:d.toLocaleDateString(undefined,overviewChartDays>14?{month:'numeric',day:'numeric'}:{weekday:'short'}),n:dayCalls.length,needs,resolved,captured});
    }
    const max=Math.max(1,...days.map(d=>d.n)),w=780,h=248,pad={l:34,r:14,t:24,b:38},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b,step=days.length>1?plotW/(days.length-1):plotW;
    const points=days.map((d,i)=>{const x=pad.l+(days.length===1?plotW/2:i*step),barH=d.n/max*plotH,y=pad.t+plotH-d.needs/max*plotH;return {...d,x,barH,y}});
    const line=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
    const grid=[0,.25,.5,.75,1].map(r=>{const y=pad.t+plotH*(1-r),v=Math.round(max*r);return '<line x1="'+pad.l+'" y1="'+y+'" x2="'+(w-pad.r)+'" y2="'+y+'" class="combo-grid"/><text x="'+(pad.l-8)+'" y="'+(y+3)+'" class="combo-axis" text-anchor="end">'+v+'</text>'}).join('');
    const labelEvery=Math.max(1,Math.ceil(days.length/7));
    const bars=points.map((p,i)=>{const bw=Math.max(10,Math.min(30,step*.58)),x=p.x-bw/2,y=pad.t+plotH-p.barH,show=i%labelEvery===0||i===points.length-1;return '<g class="combo-day" data-chart-date="'+p.date+'" data-index="'+i+'"><rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,p.barH).toFixed(1)+'" rx="5" class="combo-bar"/><circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" class="combo-point"/><rect x="'+Math.max(pad.l,p.x-step/2).toFixed(1)+'" y="'+pad.t+'" width="'+Math.min(step,pad.l+plotW-Math.max(pad.l,p.x-step/2)).toFixed(1)+'" height="'+plotH+'" class="combo-hit"/>'+(show?'<text x="'+p.x.toFixed(1)+'" y="'+(h-12)+'" class="combo-axis" text-anchor="middle">'+esc(p.short)+'</text>':'')+'</g>'}).join('');
    chart.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Daily call volume with open team actions">'+grid+bars+'<path d="'+line+'" class="combo-follow-line"/></svg>';
    const total=days.reduce((n,d)=>n+d.n,0),peak=Math.max(...days.map(d=>d.n));set('overviewChartSummary',total+' calls across the last '+overviewChartDays+' days');set('overviewChartPeak','Peak '+peak+' calls');

    const tip=document.getElementById('overviewChartTooltip');
    chart.querySelectorAll('.combo-day').forEach((group,index)=>{
      const row=days[index],hit=group.querySelector('.combo-hit');
      hit?.addEventListener('mouseenter',()=>{group.classList.add('active');if(!tip)return;tip.innerHTML='<b>'+esc(row.label)+'</b><div><span>Total calls</span><strong>'+row.n+'</strong></div><div><span>Requests captured</span><strong>'+row.captured+'</strong></div><div><span>Resolved by AI</span><strong>'+row.resolved+'</strong></div><div><span>Still open now</span><strong>'+row.needs+'</strong></div>';tip.hidden=false});
      hit?.addEventListener('mousemove',e=>{if(!tip)return;const r=chart.getBoundingClientRect();tip.style.left=Math.min(r.width-165,Math.max(8,e.clientX-r.left+10))+'px';tip.style.top=Math.max(8,e.clientY-r.top-8)+'px'});
      hit?.addEventListener('mouseleave',()=>{group.classList.remove('active');if(tip)tip.hidden=true});
      hit?.addEventListener('click',()=>{showView('calls');const date=document.getElementById('callDateFilter'),from=document.getElementById('callDateFrom'),to=document.getElementById('callDateTo');if(date)date.value='custom';if(from)from.value=row.date;if(to)to.value=row.date;callQuickFilter='all';updateCustomDateVisibility();renderCalls();setTimeout(()=>document.getElementById('callsTable')?.scrollIntoView({behavior:'smooth',block:'start'}),50)});
    });
  }

  const attention=document.getElementById('overviewAttention');
  if(attention){
    const open=[...activeFollowups].sort((a,b)=>{const ap=followupType(a)==='urgent'?1:0,bp=followupType(b)==='urgent'?1:0;return bp-ap||recordTime(b)-recordTime(a)}).slice(0,5);
    attention.innerHTML=open.length?open.map(x=>{const type=followupType(x),time=recordTime(x)?new Date(recordTime(x)).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';return '<button class="attention-call '+(type==='urgent'?'urgent':'')+'" data-call-id="'+esc(x.id)+'"><span class="attention-call-badge">'+esc(followupLabel(type))+'</span><span class="attention-call-copy"><b>'+esc(x.caller||'Unknown caller')+'</b><small>'+esc(x.reason||'Call requires review')+'</small><em>'+esc(teamStatusLabel(x))+' · '+esc(time)+'</em></span><span class="attention-call-arrow">→</span></button>'}).join(''):'<div class="attention-clear"><b>You’re caught up.</b><span>No open team actions right now.</span></div>';
    attention.querySelectorAll('[data-call-id]').forEach(b=>b.addEventListener('click',()=>openCall(b.dataset.callId)));
  }

  const wrap=document.getElementById('overviewActivity');
  if(wrap){
    const recent=[...callsData].sort((a,b)=>recordTime(b)-recordTime(a)).slice(0,6);
    wrap.innerHTML=recent.length?recent.map(x=>{const initials=String(x.caller||'?').split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()||'?',team=TEAM_STATUS_META[teamStatusForCall(x)]||TEAM_STATUS_META.no_action,disposition=callDispositionMeta(x),needs=teamStatusActive(x),label=needs?team.label:disposition.label,stateClass=needs?'activity-pending':callResolvedByAi(x)?'activity-resolved':'activity-neutral';return '<button class="activity-row overview-call-row '+stateClass+'" data-call-id="'+esc(x.id)+'"><span class="time">'+esc(formatFullDateTime(x))+'</span><div class="person"><b>'+esc(initials)+'</b><span><strong>'+esc(x.caller||'Unknown caller')+'</strong><small>'+esc(x.reason||'Call activity')+'</small></span></div><span class="tag '+(needs?'amber':callResolvedByAi(x)?'green':'')+'">'+esc(label)+'</span><strong>'+esc(x.duration||'—')+'</strong></button>'}).join(''):'<div class="empty-state"><h3>No activity yet</h3><p>Calls will appear here as CallerCore starts answering traffic.</p></div>';
    wrap.querySelectorAll('[data-call-id]').forEach(row=>row.addEventListener('click',()=>openCall(row.dataset.callId)));
  }
}
function outcomeClass(outcome){return /book|qualif/i.test(outcome)?'green':/miss|follow/i.test(outcome)?'amber':'amber'}
function dateGroupLabel(ts){
  if(!ts)return 'Date unavailable';
  const d=new Date(ts),today=new Date(),yesterday=new Date();yesterday.setDate(today.getDate()-1);
  if(sameLocalDay(ts,today))return 'Today';
  if(sameLocalDay(ts,yesterday))return 'Yesterday';
  return d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:d.getFullYear()!==today.getFullYear()?'numeric':undefined});
}
function callDateBoundary(value,end=false){
  if(!value)return null;const p=String(value).split('-').map(Number);if(p.length!==3||p.some(Number.isNaN))return null;
  return new Date(p[0],p[1]-1,p[2],end?23:0,end?59:0,end?59:0,end?999:0).getTime();
}
function callLocalDateValue(ts){
  const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function updateCustomDateVisibility(){const range=document.getElementById('customDateRange'),sel=document.getElementById('callDateFilter'),secondary=document.getElementById('callMoreFilters'),toggle=document.getElementById('toggleCallMoreFilters'),custom=sel?.value==='custom';if(range)range.hidden=!custom;if(secondary)secondary.hidden=!(custom||callMoreFiltersOpen);if(toggle){toggle.setAttribute('aria-expanded',(custom||callMoreFiltersOpen)?'true':'false');toggle.textContent=(custom||callMoreFiltersOpen)?'Less':'More'}}
function callLogPrefsKey(){return 'callercore:calllog:prefs:'+(sessionWorkspace?.id||'default')}
function loadCallLogPrefs(){
  try{const p=JSON.parse(localStorage.getItem(callLogPrefsKey())||'{}');if(['day','type','outcome','none'].includes(p.groupBy))callLogGroupBy=p.groupBy;if(['newest','oldest'].includes(p.sort))callLogSort=p.sort}catch(_){}
  const g=document.getElementById('callGroupBy'),s=document.getElementById('callSort');if(g)g.value=callLogGroupBy;if(s)s.value=callLogSort;
}
function saveCallLogPrefs(){
  callLogGroupBy=document.getElementById('callGroupBy')?.value||'day';callLogSort=document.getElementById('callSort')?.value||'newest';
  try{localStorage.setItem(callLogPrefsKey(),JSON.stringify({groupBy:callLogGroupBy,sort:callLogSort}))}catch(_){}
}
function callGroupLabel(x,mode){
  if(mode==='type')return String(x.category||'General question');
  if(mode==='outcome')return String(x.outcome||'Completed');
  if(mode==='day')return dateGroupLabel(recordTime(x));
  return '';
}
function callWasViewed(id){return callViewedIds.has(String(id||''))}
function markCallViewed(id){
  const key=String(id||'');if(!key||callViewedIds.has(key))return;
  callViewedIds.add(key);renderCalls();
  if(!demoMode)fetch('/api/account?action=call-viewed-mark',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callId:key})}).catch(()=>{});
}
function syncCallSortHeader(){
  const btn=document.getElementById('callDateSortButton'),arrow=document.getElementById('callDateSortArrow'),sort=document.getElementById('callSort');
  if(sort&&sort.value!==callLogSort)sort.value=callLogSort;
  if(arrow)arrow.textContent=callLogSort==='oldest'?'↑':'↓';
  if(btn){const copy=callLogSort==='oldest'?'Oldest first':'Newest first';btn.setAttribute('aria-label','Sort calls by date and time, '+copy.toLowerCase());btn.title=copy;}
}
function renderCalls(){
  const wrap=document.getElementById('callsTable');if(!wrap)return;
  const q=(document.getElementById('callSearch')?.value||'').trim().toLowerCase(),filter=document.getElementById('callFilter')?.value||'all',categoryFilter=document.getElementById('callCategoryFilter')?.value||'all',dateFilter=document.getElementById('callDateFilter')?.value||'7',from=callDateBoundary(document.getElementById('callDateFrom')?.value||''),to=callDateBoundary(document.getElementById('callDateTo')?.value||'',true);
  updateCustomDateVisibility();callLogGroupBy=document.getElementById('callGroupBy')?.value||callLogGroupBy;callLogSort=document.getElementById('callSort')?.value||callLogSort;syncCallSortHeader();
  const dateMatches=t=>dateFilter==='all'?true:dateFilter==='custom'?((!from||t>=from)&&(!to||t<=to)):withinDays(t,Number(dateFilter));
  let baseRows=[...callsData].filter(x=>{
    const disposition=callDispositionKey(x),hay=[x.caller,x.phone,x.category,x.reason,callDispositionLabel(x),teamStatusLabel(x),x.agent,x.address].join(' ').toLowerCase(),t=recordTime(x);
    return (!q||hay.includes(q))&&(filter==='all'||disposition===filter)&&(categoryFilter==='all'||String(x.category||'General question')===categoryFilter)&&dateMatches(t);
  });
  const needsCount=baseRows.filter(teamStatusActive).length,resolvedCount=baseRows.filter(callResolvedByAi).length;
  let rows=baseRows.filter(x=>callQuickFilter==='followup'?teamStatusActive(x):callQuickFilter==='resolved'?callResolvedByAi(x):true).sort((a,b)=>callLogSort==='oldest'?recordTime(a)-recordTime(b):recordTime(b)-recordTime(a));
  const renderRow=x=>{
    const disposition=callDispositionMeta(x),team=TEAM_STATUS_META[teamStatusForCall(x)]||TEAM_STATUS_META.no_action,stateClass=teamStatusActive(x)?'call-pending':callResolvedByAi(x)?'call-resolved':'call-neutral',unviewed=!callWasViewed(x.id);
    return '<button class="call-row data '+stateClass+(unviewed?' call-unviewed':' call-viewed')+'" data-call-id="'+esc(x.id)+'" aria-label="Open '+esc(x.caller||'caller')+' call details"><span class="call-caller-cell">'+(unviewed?'<i class="call-new-dot" title="Not opened yet"></i>':'')+'<span><strong title="'+esc(x.caller||'Unknown')+'">'+esc(x.caller||'Unknown')+'</strong><small class="subtle">'+esc(x.phone||'')+(unviewed?' · New':'')+'</small></span></span><span><strong>'+esc(recordTime(x)?new Date(recordTime(x)).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):(x.time||'—'))+'</strong><small class="subtle">'+esc(recordTime(x)?new Date(recordTime(x)).toLocaleDateString(undefined,{month:'short',day:'numeric'}):(x.agent||'Maya'))+'</small></span><span><i class="call-type-pill" title="'+esc(x.category||'General question')+'">'+esc(x.category||'General question')+'</i></span><span class="call-reason" title="'+esc(x.reason||'—')+'">'+esc(x.reason||'—')+'</span><span><i class="disposition-pill '+callDispositionClass(x)+'">'+esc(disposition.label)+'</i></span><span><i class="team-status-pill '+team.tone+'">'+esc(team.label)+'</i></span><span class="call-duration"><b>'+esc(x.duration||'—')+'</b><small class="call-view-cue">View details →</small></span></button>';
  };
  if(callLogGroupBy==='none')wrap.innerHTML=rows.map(renderRow).join('');
  else{
    const groups=new Map();for(const x of rows){const label=callLogGroupBy==='outcome'?callDispositionLabel(x):callGroupLabel(x,callLogGroupBy);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(x)}
    wrap.innerHTML=[...groups.entries()].map(([label,items])=>{const meta=callLogGroupBy==='day'?(items[0]?new Date(recordTime(items[0])||Date.now()).toLocaleDateString(undefined,{month:'short',day:'numeric'}):''):(items.length+' call'+(items.length===1?'':'s'));return '<div class="call-day-heading"><b>'+esc(label)+'</b><span>'+esc(meta)+'</span></div>'+items.map(renderRow).join('')}).join('');
  }
  const allBtn=document.getElementById('callsShownCount'),followBtn=document.getElementById('callsFollowupCount'),resolvedBtn=document.getElementById('callsResolvedCount');
  if(allBtn)allBtn.textContent=baseRows.length+' call'+(baseRows.length===1?'':'s');if(followBtn)followBtn.textContent=needsCount+' open team action'+(needsCount===1?'':'s');if(resolvedBtn)resolvedBtn.textContent=resolvedCount+' resolved by AI';
  document.querySelectorAll('[data-call-quick]').forEach(b=>b.classList.toggle('active',b.dataset.callQuick===callQuickFilter));
  document.getElementById('callsEmpty').hidden=rows.length!==0;
  wrap.querySelectorAll('[data-call-id]').forEach(row=>row.addEventListener('click',()=>openCall(row.dataset.callId)));
}
async function openCall(id){
  let x=callsData.find(c=>String(c.id)===String(id));if(!x)return;
  if(!x.transcript&&!demoMode){try{const data=await fetchJsonRetry('/api/account?action=call-detail&id='+encodeURIComponent(id),{attempts:2,timeout:7000});if(data.call){x=data.call;const idx=callsData.findIndex(c=>String(c.id)===String(id));if(idx>=0)callsData[idx]={...callsData[idx],...x}}}catch(err){console.warn('Call details delayed',err)}}
  activeCallContactKey=contactKey(x);activeCallId=String(x.id||'');markCallViewed(activeCallId);
  document.getElementById('drawerCaller').textContent=x.caller||'Unknown caller';
  const digits=String(x.phone||'').replace(/\D/g,''),setActionLink=(el,href)=>{if(!el)return;const enabled=!!href;if(enabled)el.setAttribute('href',href);else el.removeAttribute('href');el.classList.toggle('disabled-link',!enabled);el.setAttribute('aria-disabled',enabled?'false':'true');el.tabIndex=enabled?0:-1};setActionLink(document.getElementById('drawerCallLink'),digits?'tel:'+digits:'');setActionLink(document.getElementById('drawerTextLink'),digits?'sms:'+digits:'');
  syncDrawerTeamStatus(x);const select=document.getElementById('drawerTeamStatus'),statusButton=document.getElementById('drawerFollowupButton');if(select){const requires=callNeedsTeam(x),noActionOption=select.querySelector('option[value="no_action"]');if(noActionOption)noActionOption.disabled=requires;select.disabled=!requires&&teamStatusForCall(x)==='no_action';select.title=select.disabled?'CallerCore resolved this call without requiring staff action.':'';if(statusButton)statusButton.disabled=select.disabled}
  activeNoteEditId='';resetNoteComposer();renderCallNotes(x.id);
  const when=document.getElementById('drawerWhen');if(when)when.textContent=formatFullDateTime(x);
  const disposition=callDispositionMeta(x),team=TEAM_STATUS_META[teamStatusForCall(x)]||TEAM_STATUS_META.no_action;
  document.getElementById('drawerMeta').innerHTML=[['Phone',x.phone],['Duration',x.duration],['Call disposition',disposition.label],['Team status',team.label],['Answered by',x.agent||'Maya']].filter(([,v])=>v).map(([k,v])=>'<span><small>'+esc(k)+'</small><b>'+esc(v)+'</b></span>').join('');
  const classification=document.getElementById('drawerClassification');if(classification)classification.innerHTML='<span class="call-type-pill large">'+esc(x.category||'General question')+'</span><span class="disposition-pill '+callDispositionClass(x)+'">'+esc(disposition.label)+'</span><span class="team-status-pill '+team.tone+'">'+esc(team.label)+'</span>';
  const explain=document.getElementById('drawerStatusExplainer');if(explain)explain.innerHTML='<b>What CallerCore did</b><span>'+esc(disposition.copy)+'</span>'+(followupState[String(x.id)]?.completionReason?'<b>Team completion</b><span>'+esc(String(followupState[String(x.id)].completionReason).replaceAll('_',' ')+(followupState[String(x.id)].completionNote?' · '+followupState[String(x.id)].completionNote:''))+'</span>':'');
  const addr=document.getElementById('drawerAddress');if(addr)addr.textContent=x.address||contactForRecord(x)?.address||'No address was captured on this call.';
  document.getElementById('drawerSummary').textContent=x.summary||'No AI summary is available yet.';
  const q=x.qualification||{};document.getElementById('drawerQualification').innerHTML=Object.entries(q).filter(([k])=>String(k).toLowerCase()!=='value').map(([k,v])=>{const key=String(k||''),label=key.toLowerCase()==='ai result'?'Call disposition':key;return '<div><b>'+esc(v)+'</b><span>'+esc(label)+'</span></div>'}).join('')||'<span class="muted">No additional call details yet.</span>';
  const t=Array.isArray(x.transcript)?x.transcript:[];document.getElementById('drawerTranscript').innerHTML=t.map(pair=>'<div class="'+(String(pair[0]).toLowerCase()==='maya'?'ai':'')+'"><b>'+esc(pair[0])+'</b>'+esc(pair[1])+'</div>').join('')||'<span class="muted">Transcript unavailable.</span>';
  const historyBtn=document.getElementById('drawerContactButton');if(historyBtn)historyBtn.onclick=()=>{const key=activeCallContactKey;closeCall();setTimeout(()=>openContact(key),30)};
  const feedbackBtn=document.getElementById('drawerAiFeedbackButton');if(feedbackBtn){feedbackBtn.dataset.callId=activeCallId;feedbackBtn.dataset.callContext=[x.caller||x.phone||'Caller',x.reason||x.category||'Call'].filter(Boolean).join(' · ')}
  const drawer=document.getElementById('callDrawer');resetSurfaceScroll(drawer);drawer.classList.add('open');document.getElementById('drawerBackdrop').classList.add('open');drawer.setAttribute('aria-hidden','false');document.body.classList.add('drawer-open');setTimeout(()=>{resetSurfaceScroll(drawer);document.getElementById('closeCallDrawer')?.focus()},20);
}
function closeCall(){document.getElementById('callDrawer')?.classList.remove('open');document.getElementById('drawerBackdrop')?.classList.remove('open');document.getElementById('callDrawer')?.setAttribute('aria-hidden','true');if(!document.getElementById('contactDrawer')?.classList.contains('open'))document.body.classList.remove('drawer-open')}
function money(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}
const CALL_DISPOSITIONS={
  resolved_by_ai:{label:'Resolved by AI',needsTeam:false,tone:'green',copy:'The caller got what they needed without staff action.'},
  request_captured:{label:'Request captured',needsTeam:true,tone:'blue',copy:'CallerCore collected the request, but the business still owes the caller a next step.'},
  message_taken:{label:'Message taken',needsTeam:true,tone:'blue',copy:'CallerCore captured a message or update for the team.'},
  transferred:{label:'Transferred',needsTeam:false,tone:'blue',copy:'The caller was connected to a person during the call.'},
  escalated:{label:'Escalated',needsTeam:true,tone:'red',copy:'CallerCore identified a priority issue that needs human attention.'},
  incomplete:{label:'Incomplete',needsTeam:true,tone:'red',copy:'The call ended before CallerCore could reach a useful conclusion.'},
  non_customer:{label:'Non-customer call',needsTeam:false,tone:'gray',copy:'This was spam, a wrong number, or another call that does not require customer follow-up.'}
};
const TEAM_STATUS_META={
  no_action:{label:'No action needed',tone:'gray'},
  needs_action:{label:'Needs action',tone:'amber'},
  in_progress:{label:'In progress',tone:'blue'},
  completed:{label:'Completed',tone:'green'},
  dismissed:{label:'Dismissed',tone:'gray'}
};
function callDispositionKey(call){
  const saved=String(call?.disposition||'').toLowerCase();
  if(CALL_DISPOSITIONS[saved])return saved;
  const category=String(call?.category||''),outcome=String(call?.outcome||''),reason=String(call?.reason||'');
  if(['Spam','Wrong number'].includes(category))return 'non_customer';
  if(/miss|incomplete|failed/i.test(outcome))return 'incomplete';
  if(category==='Complaint'||/urgent|emergency|gas|carbon monoxide/i.test(reason))return 'escalated';
  if(/transfer/i.test(outcome))return 'transferred';
  if(category==='General question'&&/resolved|answered/i.test(outcome))return 'resolved_by_ai';
  if(['Vendor','Employment','Existing job','Billing','Warranty'].includes(category))return 'message_taken';
  if(['New service','Estimate follow-up'].includes(category)||/qualif|request captured/i.test(outcome))return 'request_captured';
  if(/follow|message/i.test(outcome))return 'message_taken';
  if(/resolved|answered/i.test(outcome))return 'resolved_by_ai';
  return 'message_taken';
}
function callDispositionMeta(call){return CALL_DISPOSITIONS[callDispositionKey(call)]||CALL_DISPOSITIONS.message_taken}
function callDispositionLabel(call){return callDispositionMeta(call).label}
function callNeedsTeam(call){return !!callDispositionMeta(call).needsTeam}
function normalizedTeamStatusValue(value){
  const v=String(value||'');
  if(v==='handled'||v==='completed')return 'completed';
  if(v==='open')return 'needs_action';
  return TEAM_STATUS_META[v]?v:'';
}
function teamStatusForCall(call){
  const saved=normalizedTeamStatusValue(followupState[String(call?.id||'')]?.status);
  if(saved)return saved;
  return callNeedsTeam(call)?'needs_action':'no_action';
}
function teamStatusLabel(call){return (TEAM_STATUS_META[teamStatusForCall(call)]||TEAM_STATUS_META.no_action).label}
function teamStatusActive(call){return ['needs_action','in_progress'].includes(teamStatusForCall(call))}
function teamStatusClosed(call){return ['completed','dismissed','no_action'].includes(teamStatusForCall(call))}
function callAnswered(call){return callDispositionKey(call)!=='incomplete'}
function callResolvedByAi(call){return callDispositionKey(call)==='resolved_by_ai'}
function callCaptured(call){return ['request_captured','message_taken','escalated'].includes(callDispositionKey(call))}
function callDispositionClass(call){return 'disposition-'+callDispositionKey(call)}
function followupType(call){
  const key=callDispositionKey(call),reason=String(call?.reason||'');
  if(key==='escalated'||/no heat|emergency|urgent|gas|carbon monoxide/i.test(reason))return 'urgent';
  if(key==='incomplete'||key==='message_taken')return 'callback';
  if(key==='request_captured')return 'qualified';
  return 'review';
}
function followupLabel(type){return ({urgent:'Urgent',callback:'Callback / message',qualified:'Service request',review:'Review'})[type]||'Review'}
function followupCandidates(){return callsData.filter(callNeedsTeam).sort((a,b)=>recordTime(b)-recordTime(a))}
async function loadFollowupState(){
  if(demoMode)return;
  try{const r=await fetch('/api/account?action=followups',{headers:{Accept:'application/json'},cache:'no-store'});if(r.ok)followupState=(await r.json()).state||{}}catch(err){console.error('Follow-up state failed',err)}
}
function followupIsHandled(call){return teamStatusClosed(call)}
function updateFollowupCounts(){
  const all=followupCandidates(),active=all.filter(teamStatusActive),urgent=active.filter(x=>followupType(x)==='urgent'),inProgress=active.filter(x=>teamStatusForCall(x)==='in_progress'),completedToday=all.filter(x=>{const st=followupState[String(x.id)];return normalizedTeamStatusValue(st?.status)==='completed'&&sameLocalDay(Number(st?.updatedAt||0))});
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};set('followupOpenCount',active.filter(x=>teamStatusForCall(x)==='needs_action').length);set('followupUrgentCount',urgent.length);set('followupCallbackCount',inProgress.length);set('followupHandledCount',completedToday.length);
  const nav=document.getElementById('followupNavCount');if(nav){nav.textContent=active.length>99?'99+':active.length;nav.hidden=active.length===0}
  const overview=document.getElementById('overviewFollowup');if(overview)overview.textContent=active.length;
}
function renderLeads(){
  const board=document.getElementById('leadKanban');if(!board)return;
  const q=(document.getElementById('leadSearch')?.value||'').trim().toLowerCase(),filter=document.getElementById('leadFilter')?.value||'all';
  const rows=followupCandidates().filter(x=>{
    const status=teamStatusForCall(x),closed=['completed','dismissed'].includes(status);if(showHandledFollowups?!closed:closed)return false;
    const type=followupType(x),searchOk=!q||[x.caller,x.phone,x.reason,x.address,callDispositionLabel(x),teamStatusLabel(x)].join(' ').toLowerCase().includes(q),filterOk=filter==='all'||type===filter;
    return searchOk&&filterOk;
  });
  board.innerHTML=rows.map(x=>{
    const type=followupType(x),status=teamStatusForCall(x),phone=String(x.phone||''),digits=phone.replace(/\D/g,''),closed=['completed','dismissed'].includes(status),meta=callDispositionMeta(x),st=TEAM_STATUS_META[status]||TEAM_STATUS_META.needs_action;
    return '<article class="followup-card '+(type==='urgent'?'urgent':'')+' '+(closed?'completed':'')+'"><div class="followup-main"><div class="followup-badge '+type+'">'+esc(followupLabel(type))+'</div><div class="followup-customer"><button class="customer-link" data-contact-key="'+esc(contactKey(x))+'"><b>'+esc(x.caller||'Unknown caller')+'</b></button><span>'+esc(phone||'No phone')+' · '+esc(formatFullDateTime(x))+'</span><p>'+esc(x.reason||'Call requires review')+'</p><div class="followup-status-line"><span class="disposition-pill '+callDispositionClass(x)+'">'+esc(meta.label)+'</span><span class="team-status-pill '+st.tone+'">'+esc(st.label)+'</span></div></div></div><div class="followup-actions">'+(digits?'<a class="secondary-btn action-link" href="tel:'+digits+'">Call</a><a class="secondary-btn action-link" href="sms:'+digits+'">Text</a>':'')+'<button class="secondary-btn" data-call-id="'+esc(x.id)+'">Call details</button><label class="followup-status-select"><span>Team status</span><select data-team-status="'+esc(x.id)+'"><option value="needs_action" '+(status==='needs_action'?'selected':'')+'>Needs action</option><option value="in_progress" '+(status==='in_progress'?'selected':'')+'>In progress</option><option value="completed" '+(status==='completed'?'selected':'')+'>Completed</option><option value="dismissed" '+(status==='dismissed'?'selected':'')+'>Dismissed</option></select></label></div></article>';
  }).join('');
  document.getElementById('leadsEmpty').hidden=rows.length!==0;updateFollowupCounts();
  board.querySelectorAll('[data-contact-key]').forEach(b=>b.addEventListener('click',()=>openContact(b.dataset.contactKey)));
  board.querySelectorAll('[data-call-id]').forEach(b=>b.addEventListener('click',()=>openCall(b.dataset.callId)));
  board.querySelectorAll('[data-team-status]').forEach(sel=>sel.addEventListener('change',()=>requestTeamStatusChange(sel.dataset.teamStatus,sel.value)));
}
async function persistTeamStatus(id,status,{completionReason='',completionNote=''}={}){
  const previous=followupState[id],current=previous||{},notes=Array.isArray(current.notes)?current.notes:[],next={...current,status,notes,completionReason,completionNote,updatedAt:Date.now()};
  followupState[id]=next;renderLeads();renderOverview();renderCalls();const x=callsData.find(c=>String(c.id)===String(id));if(x&&activeCallId===String(id))syncDrawerTeamStatus(x);
  if(demoMode)return true;
  try{
    const r=await fetch('/api/account?action=followup-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callId:id,status,completionReason,completionNote})}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not update team status');followupState=data.state||followupState;return true
  }catch(err){if(previous)followupState[id]=previous;else delete followupState[id];renderLeads();renderOverview();renderCalls();if(x&&activeCallId===String(id))syncDrawerTeamStatus(x);console.error(err);return false}
}
function requestTeamStatusChange(id,status){
  if(status==='completed'){pendingTeamStatusCallId=String(id);const modal=document.getElementById('teamStatusModal'),reason=document.getElementById('teamCompletionReason'),other=document.getElementById('teamCompletionOther'),wrap=document.getElementById('teamCompletionOtherWrap');if(reason)reason.value='';if(other)other.value='';if(wrap)wrap.hidden=true;if(modal){modal.classList.add('open');modal.setAttribute('aria-hidden','false')}return}
  persistTeamStatus(String(id),status);
}
function closeTeamStatusModal(){pendingTeamStatusCallId='';const modal=document.getElementById('teamStatusModal');if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}}
async function saveTeamStatusCompletion(){
  const id=pendingTeamStatusCallId;if(!id)return;const reason=document.getElementById('teamCompletionReason')?.value||'',note=String(document.getElementById('teamCompletionOther')?.value||'').trim().slice(0,160);const ok=await persistTeamStatus(id,'completed',{completionReason:reason,completionNote:note});if(ok)closeTeamStatusModal();
}
function syncDrawerTeamStatus(call){
  const status=teamStatusForCall(call),select=document.getElementById('drawerTeamStatus'),button=document.getElementById('drawerFollowupButton');if(select)select.value=status;if(button){button.dataset.callId=String(call.id||'');button.textContent='Update status'}
}

function normalizedCallNotes(id){
  const state=followupState[String(id)]||{},notes=Array.isArray(state.notes)?state.notes.slice():[];
  if(state.note&&String(state.note).trim()&&!notes.some(n=>n&&n.text===state.note))notes.unshift({id:'legacy',text:String(state.note),at:Number(state.updatedAt||0),by:state.updatedBy||''});
  return notes.filter(n=>n&&String(n.text||'').trim()).sort((a,b)=>Number(b.at||0)-Number(a.at||0));
}
function resetNoteComposer(){
  activeNoteEditId='';
  const composer=document.getElementById('drawerNoteComposer'),input=document.getElementById('drawerInternalNote'),status=document.getElementById('drawerNoteStatus'),save=document.getElementById('drawerSaveNote'),cancel=document.getElementById('drawerCancelNoteEdit');
  if(input)input.value='';if(status)status.textContent='';if(save)save.textContent='Save note';if(cancel)cancel.hidden=true;if(composer)composer.hidden=true;
}
function renderCallNotes(id=activeCallId){
  const list=document.getElementById('drawerNotesList'),count=document.getElementById('drawerNoteCount'),toggle=document.getElementById('drawerAddNoteToggle');if(!list)return;const notes=normalizedCallNotes(id);
  if(count)count.textContent=notes.length+' note'+(notes.length===1?'':'s');const composer=document.getElementById('drawerInternalNote');if(composer)composer.placeholder=activeNoteEditId?'Update this internal note…':(notes.length?'Add another note for your team…':'Add a note for your team…');if(toggle)toggle.textContent=notes.length?'Add another':'Add note';
  list.innerHTML=notes.length?notes.map(n=>'<article class="internal-note-card"><div class="internal-note-copy"><p>'+esc(n.text)+'</p><small>'+esc(n.by||'Team')+(n.at?' · '+new Date(Number(n.at)).toLocaleString():'')+'</small></div><div class="internal-note-actions"><button type="button" data-edit-call-note="'+esc(n.id)+'">Edit</button><button type="button" class="danger-link" data-delete-call-note="'+esc(n.id)+'">Delete</button></div></article>').join(''):'<div class="notes-empty compact">No internal notes yet.</div>';
  list.querySelectorAll('[data-edit-call-note]').forEach(btn=>btn.addEventListener('click',()=>startEditCallNote(btn.dataset.editCallNote)));
  list.querySelectorAll('[data-delete-call-note]').forEach(btn=>btn.addEventListener('click',()=>deleteCallNote(btn.dataset.deleteCallNote)));
}
function startEditCallNote(noteId){
  const note=normalizedCallNotes(activeCallId).find(n=>String(n.id)===String(noteId));if(!note)return;
  activeNoteEditId=String(noteId);const composer=document.getElementById('drawerNoteComposer'),input=document.getElementById('drawerInternalNote'),save=document.getElementById('drawerSaveNote'),cancel=document.getElementById('drawerCancelNoteEdit'),status=document.getElementById('drawerNoteStatus');
  if(composer)composer.hidden=false;if(input){input.value=note.text||'';input.placeholder='Update this internal note…'}if(save)save.textContent='Update note';if(cancel)cancel.hidden=false;if(status)status.textContent='Editing note';setTimeout(()=>input?.focus(),20);
}
async function saveCallNote(){
  const id=activeCallId;if(!id)return;const input=document.getElementById('drawerInternalNote'),status=document.getElementById('drawerNoteStatus'),text=String(input?.value||'').trim().slice(0,2000),current=followupState[String(id)]||{},call=callsData.find(x=>String(x.id)===String(id)),nextStatus=normalizedTeamStatusValue(current.status)||(call&&callNeedsTeam(call)?'needs_action':'no_action'),editId=activeNoteEditId;if(!text){if(status)status.textContent='Write a note first.';return}if(status)status.textContent='Saving…';
  if(demoMode){let notes=normalizedCallNotes(id);if(editId)notes=notes.map(n=>String(n.id)===editId?{...n,text,editedAt:Date.now()}:n);else notes=[...notes,{id:'note_'+Date.now(),text,at:Date.now(),by:currentUserProfile.email||'Team'}];followupState[String(id)]={...current,status:nextStatus,notes,updatedAt:Date.now()};resetNoteComposer();renderCallNotes(id);return}
  try{const payload=editId?{callId:id,status:nextStatus,updateNoteId:editId,updateNoteText:text}:{callId:id,status:nextStatus,appendNote:text},r=await fetch('/api/account?action=followup-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not save note');followupState=data.state||followupState;resetNoteComposer();renderCallNotes(id)}catch(err){if(status)status.textContent=err.message||'Could not save note'}
}
async function deleteCallNote(noteId){
  const id=activeCallId;if(!id||!noteId)return;if(!confirm('Delete this internal note?'))return;
  const current=followupState[String(id)]||{},call=callsData.find(x=>String(x.id)===String(id)),nextStatus=normalizedTeamStatusValue(current.status)||(call&&callNeedsTeam(call)?'needs_action':'no_action');
  if(demoMode){const notes=normalizedCallNotes(id).filter(n=>String(n.id)!==String(noteId));followupState[String(id)]={...current,status:nextStatus,notes,updatedAt:Date.now(),note:''};if(activeNoteEditId===String(noteId))resetNoteComposer();renderCallNotes(id);return}
  try{const r=await fetch('/api/account?action=followup-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callId:id,status:nextStatus,deleteNoteId:String(noteId)})}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not delete note');followupState=data.state||followupState;if(activeNoteEditId===String(noteId))resetNoteComposer();renderCallNotes(id)}catch(err){alert(err.message||'Could not delete note')}
}
async function moveLead(id,stage){
  const lead=leadsData.find(x=>String(x.id)===String(id));if(!lead||lead.stage===stage)return;
  const previous=lead.stage;lead.stage=stage;renderLeads();
  if(demoMode)return;
  try{
    const r=await fetch('/api/account?action=lead-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,stage})});
    if(!r.ok)throw new Error('update failed');
  }catch(err){lead.stage=previous;renderLeads();console.error(err)}
}
document.getElementById('callSearch')?.addEventListener('input',renderCalls);
document.getElementById('callFilter')?.addEventListener('change',()=>{callQuickFilter='all';renderCalls()});
document.getElementById('callDateFilter')?.addEventListener('change',()=>{updateCustomDateVisibility();renderCalls()});
document.getElementById('callDateFrom')?.addEventListener('change',renderCalls);document.getElementById('callDateTo')?.addEventListener('change',renderCalls);
document.getElementById('callCategoryFilter')?.addEventListener('change',renderCalls);
document.getElementById('callGroupBy')?.addEventListener('change',()=>{saveCallLogPrefs();renderCalls()});
document.getElementById('callSort')?.addEventListener('change',()=>{saveCallLogPrefs();renderCalls()});
document.getElementById('callDateSortButton')?.addEventListener('click',()=>{callLogSort=callLogSort==='newest'?'oldest':'newest';const sort=document.getElementById('callSort');if(sort)sort.value=callLogSort;saveCallLogPrefs();renderCalls()});
document.getElementById('leadSearch')?.addEventListener('input',renderLeads);
document.getElementById('leadFilter')?.addEventListener('change',renderLeads);
document.getElementById('showHandledFollowups')?.addEventListener('click',e=>{showHandledFollowups=!showHandledFollowups;e.currentTarget.textContent=showHandledFollowups?'Show active':'Show completed';renderLeads()});
document.getElementById('closeCallDrawer')?.addEventListener('click',closeCall);
document.getElementById('drawerBackdrop')?.addEventListener('click',closeCall);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCall();closeContact()}});


function renderEntitledApps(){
  const cg=document.getElementById('conversationGate'),ca=document.getElementById('conversationApp');
  if(cg&&ca){cg.hidden=has('unifiedInbox');ca.hidden=!has('unifiedInbox')}
  const ag=document.getElementById('appointmentGate'),aa=document.getElementById('appointmentApp'),apptNav=document.querySelector('[data-view="appointments"]');
  if(ag&&aa){const live=capability('calendar')&&has('appointments');ag.hidden=live;aa.hidden=!live}
  if(apptNav)apptNav.hidden=!capability('calendar')
  const aug=document.getElementById('automationGate'),aua=document.getElementById('automationApp'),newBtn=document.getElementById('newAutomationButton');
  if(aug&&aua){aug.hidden=has('automations');aua.hidden=!has('automations')}
  if(newBtn)newBtn.hidden=!has('automations');
  const ang=document.getElementById('analyticsGate'),ana=document.getElementById('analyticsApp');
  if(ang&&ana){ang.hidden=has('advancedAnalytics');ana.hidden=!has('advancedAnalytics')}
  if(has('unifiedInbox'))renderConversations();
  if(has('appointments'))renderAppointments();
  if(has('automations'))renderAutomations();
  if(has('advancedAnalytics'))renderAnalytics();
  renderIntegrations();
}
function renderConversations(){
  if(!has('unifiedInbox'))return;
  const list=document.getElementById('conversationThreads'),stream=document.getElementById('messageStream');if(!list||!stream)return;
  const q=(document.getElementById('conversationSearch')?.value||'').trim().toLowerCase();
  const rows=[...conversationsData].filter(x=>{
    const searchOk=!q||[x.name,x.phone,x.last,x.status,...(x.messages||[]).map(m=>m.text)].join(' ').toLowerCase().includes(q);
    const filterOk=conversationFilter==='all'||(conversationFilter==='attention'&&/follow/i.test(x.status||''))||(conversationFilter==='active'&&/active/i.test(x.status||''));
    return searchOk&&filterOk;
  }).sort((a,b)=>recordTime(b)-recordTime(a));
  list.innerHTML=rows.map(x=>'<button class="thread-item '+(String(activeConversationId)===String(x.id)?'active':'')+'" data-thread-id="'+esc(x.id)+'"><div class="thread-top"><strong>'+esc(x.name||'Unknown')+'</strong><small>'+esc(recordTime(x)?new Date(recordTime(x)).toLocaleDateString(undefined,{month:'short',day:'numeric'}):(x.time||''))+'</small></div><small>'+esc(x.phone||'')+' · '+esc(x.status||'')+'</small><p>'+esc(x.last||'')+'</p></button>').join('');
  list.querySelectorAll('[data-thread-id]').forEach(btn=>btn.addEventListener('click',()=>openConversation(btn.dataset.threadId)));
  const active=rows.find(x=>String(x.id)===String(activeConversationId))||rows[0];if(active)openConversation(active.id);else{activeConversationId=null;document.getElementById('conversationName').textContent='No conversations';document.getElementById('conversationMeta').textContent='';document.getElementById('conversationContactButton').hidden=true;stream.innerHTML='<div class="empty-state"><h3>No conversations in this view</h3><p>Try another filter or search.</p></div>'}
  document.querySelectorAll('[data-conversation-filter]').forEach(b=>b.classList.toggle('active',b.dataset.conversationFilter===conversationFilter));
}
function openConversation(id){
  const x=conversationsData.find(v=>String(v.id)===String(id));if(!x)return;activeConversationId=id;
  document.querySelectorAll('.thread-item').forEach(b=>b.classList.toggle('active',b.dataset.threadId===String(id)));
  document.getElementById('conversationName').textContent=x.name||'Unknown';
  const meta=document.getElementById('conversationMeta');if(meta)meta.textContent=[x.phone,recordTime(x)?'Last activity '+new Date(recordTime(x)).toLocaleString():x.time].filter(Boolean).join(' · ');
  const status=document.getElementById('conversationStatus');status.textContent=x.status||'Active';status.className='tag '+(/active|recover/i.test(x.status||'')?'green':'amber');
  const contactButton=document.getElementById('conversationContactButton');if(contactButton){contactButton.hidden=false;contactButton.dataset.contactKey=contactKey(x)}
  document.getElementById('messageStream').innerHTML=(Array.isArray(x.messages)?x.messages:[]).map(m=>'<div class="message '+(m.dir==='out'?'out':m.dir==='system'?'system':'')+'">'+(m.dir==='system'?'':'<b>'+esc(m.who||'Customer')+'</b>')+esc(m.text||'')+(m.at?'<small>'+new Date(m.at).toLocaleString()+'</small>':'')+'</div>').join('')||'<div class="empty-state"><h3>No messages yet</h3></div>';
}
function contactKey(x){
  const phone=String(x?.phone||'').replace(/\D/g,'');if(phone)return 'p:'+phone;
  return 'n:'+String(x?.name||x?.caller||'unknown').trim().toLowerCase();
}
function buildContacts(){
  const map=new Map(),nameIndex=new Map(),normalName=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  const ensure=(rec,nameField='name')=>{
    const name=rec?.[nameField]||rec?.name||rec?.caller||'Unknown caller',nameNorm=normalName(name),phone=String(rec?.phone||'').replace(/\D/g,''),phoneKey=phone?'p:'+phone:'',knownByName=nameNorm?nameIndex.get(nameNorm):'';
    let key=phoneKey||knownByName||('n:'+nameNorm);
    if(!map.has(key))map.set(key,{key,name,phone:rec?.phone||'',address:rec?.address||'',calls:[],conversations:[],leads:[],lastAt:0,services:new Set()});
    const c=map.get(key);if(name&&c.name==='Unknown caller')c.name=name;if(rec?.phone&&!c.phone)c.phone=rec.phone;if(rec?.address&&!c.address)c.address=rec.address;c.lastAt=Math.max(c.lastAt,recordTime(rec)||0);if(rec?.reason)c.services.add(rec.reason);if(rec?.service)c.services.add(rec.service);if(nameNorm)nameIndex.set(nameNorm,key);return c;
  };
  callsData.filter(x=>!['Spam','Wrong number'].includes(String(x.category||''))).forEach(x=>ensure(x,'caller').calls.push(x));
  conversationsData.forEach(x=>ensure(x).conversations.push(x));
  leadsData.forEach(x=>ensure(x).leads.push(x));
  return [...map.values()].sort((a,b)=>b.lastAt-a.lastAt);
}
function contactType(c){
  const calls=[...(c.calls||[])].sort((a,b)=>recordTime(b)-recordTime(a)),latest=String(calls[0]?.category||''),customerCats=['New service','Existing job','Estimate follow-up','Billing','Complaint','Warranty'];
  if(customerCats.includes(latest)||c.leads?.length)return 'Customer';
  if(latest==='Vendor')return 'Vendor';
  if(latest==='Employment')return 'Applicant';
  if(calls.some(x=>customerCats.includes(String(x.category||''))))return 'Customer';
  if(calls.some(x=>String(x.category||'')==='Vendor'))return 'Vendor';
  if(calls.some(x=>String(x.category||'')==='Employment'))return 'Applicant';
  return 'Contact';
}
function contactForRecord(x){return buildContacts().find(c=>c.key===contactKey(x))||null}
function renderContacts(){
  const wrap=document.getElementById('contactsTable');if(!wrap)return;
  const q=(document.getElementById('contactSearch')?.value||'').trim().toLowerCase(),all=buildContacts(),rows=all.filter(c=>!q||[c.name,c.phone,c.address,contactType(c),...c.services].join(' ').toLowerCase().includes(q));
  const totalInteractions=c=>c.calls.length+c.conversations.reduce((n,x)=>n+(Array.isArray(x.messages)?x.messages.length:0),0);
  const contactCount=document.getElementById('customerCount'),customerCount=document.getElementById('repeatCustomerCount'),interactionCount=document.getElementById('customerAttentionCount');
  if(contactCount)contactCount.textContent=all.length;if(customerCount)customerCount.textContent=all.filter(c=>contactType(c)==='Customer').length;if(interactionCount)interactionCount.textContent=all.reduce((n,c)=>n+totalInteractions(c),0);
  wrap.innerHTML=rows.map(c=>{
    const msgCount=c.conversations.reduce((n,x)=>n+(Array.isArray(x.messages)?x.messages.length:0),0),openCount=c.calls.filter(x=>followupCandidates().some(v=>String(v.id)===String(x.id))&&!followupIsHandled(x)).length,latestCall=[...c.calls].sort((a,b)=>recordTime(b)-recordTime(a))[0],latestText=latestCall?.reason||[...c.services][0]||'General activity',kind=contactType(c),key=encodeURIComponent(c.key);
    return '<div class="contact-row data '+(openCount?'customer-attention':'')+'" role="button" tabindex="0" data-contact-key="'+key+'" aria-label="Open '+esc(c.name)+' contact history"><span><strong>'+esc(c.name)+'</strong><small>'+esc(c.phone||'No phone captured')+(openCount?' · '+openCount+' open team action'+(openCount===1?'':'s'):'')+'</small></span><span><i class="contact-type-pill '+kind.toLowerCase()+'">'+esc(kind)+'</i></span><span>'+esc(c.lastAt?new Date(c.lastAt).toLocaleString():'—')+'</span><span class="contact-count">'+c.calls.length+'</span><span class="contact-count">'+msgCount+'</span><span class="latest-need-link" title="'+esc(latestText)+'">'+esc(latestText)+'</span></div>';
  }).join('');
  document.getElementById('contactsEmpty').hidden=rows.length!==0;
  wrap.querySelectorAll('[data-contact-key]').forEach(row=>{
    row.addEventListener('click',()=>openContactFromRow(row));
    row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openContactFromRow(row)}});
  });
}
function openContactFromRow(row){if(!row)return;let key='';try{key=decodeURIComponent(row.dataset.contactKey||'')}catch(_){key=row.dataset.contactKey||''}if(key)openContact(key)}

function serviceRequestStageLabel(stage){
  const value=String(stage||'').trim();return ({New:'New request',Contacted:'Team contacted',Qualified:'Qualified request',Won:'Completed',Lost:'Closed'})[value]||value||'Service request';
}
function contactDateKey(at){
  const d=new Date(Number(at||0));if(!Number.isFinite(d.getTime()))return 'unknown';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function contactDateLabel(at){
  const d=new Date(Number(at||0));if(!Number.isFinite(d.getTime()))return 'Date unavailable';
  const today=new Date(),yesterday=new Date();yesterday.setDate(today.getDate()-1);
  if(d.toDateString()===today.toDateString())return 'Today';
  if(d.toDateString()===yesterday.toDateString())return 'Yesterday';
  return d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:d.getFullYear()===today.getFullYear()?undefined:'numeric'});
}
function contactTimeLabel(at){
  const d=new Date(Number(at||0));return Number.isFinite(d.getTime())?d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
}
function contactMessageSessions(c){
  const flat=c.conversations.flatMap(conv=>(conv.messages||[]).map((m,index)=>({
    at:Number(m.at||recordTime(conv)||0),dir:m.dir==='out'?'out':'in',who:m.who||conv.name||c.name||'',text:m.text||'',conversationId:conv.id||'',index
  }))).filter(m=>m.text||m.at).sort((a,b)=>a.at-b.at);
  const sessions=[];let current=null;
  for(const m of flat){
    const day=contactDateKey(m.at),gap=current?m.at-current.lastAt:Infinity;
    if(!current||current.day!==day||gap>3*60*60*1000){
      current={day,firstAt:m.at,lastAt:m.at,messages:[]};sessions.push(current);
    }
    current.messages.push(m);current.lastAt=Math.max(current.lastAt,m.at||0);
  }
  return sessions;
}
function contactHistoryEvents(c){
  return [
    ...c.calls.map(x=>({at:recordTime(x),filter:'call',kind:'Call',title:x.reason||'Phone call',call:x})),
    ...contactMessageSessions(c).map(session=>({at:session.lastAt,filter:'message',kind:'Messages',title:session.messages.length+' message'+(session.messages.length===1?'':'s'),session})),
    ...c.leads.map(x=>({at:recordTime(x),filter:'request',kind:'Service request',title:x.service||'Service request',request:x})),
    ...c.calls.flatMap(x=>normalizedCallNotes(x.id).map(n=>({at:Number(n.at||recordTime(x)||0),filter:'note',kind:'Internal note',title:n.by||'Team note',note:n,call:x})))
  ].sort((a,b)=>b.at-a.at);
}
function contactInlineCallHtml(call){
  const disposition=callDispositionMeta(call),team=TEAM_STATUS_META[teamStatusForCall(call)]||TEAM_STATUS_META.no_action,notes=normalizedCallNotes(call.id),transcript=Array.isArray(call.transcript)?call.transcript:[];
  const details=[
    ['Call disposition',disposition.label],
    ['Team status',team.label],
    ['Duration',call.duration||'—'],
    ['Answered by',call.agent||'Maya']
  ];
  return '<div class="contact-inline-call-grid">'+details.map(([k,v])=>'<div><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join('')+'</div>'
    +(call.address?'<div class="contact-inline-block"><span>Location</span><p>'+esc(call.address)+'</p></div>':'')
    +'<div class="contact-inline-block"><span>AI summary</span><p>'+esc(call.summary||'No AI summary is available yet.')+'</p></div>'
    +(notes.length?'<div class="contact-inline-block"><span>Team notes</span>'+notes.map(n=>'<p class="inline-team-note">'+esc(n.text)+'<small>'+esc(n.by||'Team')+(n.at?' · '+new Date(Number(n.at)).toLocaleString():'')+'</small></p>').join('')+'</div>':'')
    +'<div class="contact-inline-block"><span>Transcript</span><div class="contact-inline-transcript">'+(transcript.length?transcript.map(pair=>'<div class="'+(String(pair[0]).toLowerCase()==='maya'?'ai':'caller')+'"><b>'+esc(pair[0])+'</b><p>'+esc(pair[1])+'</p></div>').join(''):'<p class="muted contact-transcript-loading">Open call details loaded without a transcript yet.</p>')+'</div></div>';
}
async function hydrateContactCallDetails(callId,details){
  if(!details||details.dataset.loaded==='1')return;markCallViewed(callId);
  details.dataset.loaded='1';
  let call=callsData.find(x=>String(x.id)===String(callId));if(!call)return;
  const body=details.querySelector('[data-contact-inline-call-body]');
  if(!call.transcript&&!demoMode){
    if(body)body.innerHTML='<div class="contact-inline-loading"><i></i><span>Loading call details…</span></div>';
    try{
      const data=await fetchJsonRetry('/api/account?action=call-detail&id='+encodeURIComponent(callId),{attempts:2,timeout:7000});
      if(data.call){const idx=callsData.findIndex(x=>String(x.id)===String(callId));if(idx>=0)callsData[idx]={...callsData[idx],...data.call};call=callsData[idx>=0?idx:callsData.findIndex(x=>String(x.id)===String(callId))]||data.call}
    }catch(err){console.warn('Inline contact call detail delayed',err)}
  }
  if(body)body.innerHTML=contactInlineCallHtml(call);
}
function renderContactHistoryItem(e){
  if(e.filter==='call'){
    const x=e.call,disp=callDispositionMeta(x),team=TEAM_STATUS_META[teamStatusForCall(x)]||TEAM_STATUS_META.no_action;
    return '<details class="contact-history-card call" data-contact-inline-call="'+esc(x.id)+'"><summary><span class="history-icon call">☎</span><span class="history-summary-copy"><small>'+esc(contactTimeLabel(e.at))+' · '+esc(x.category||'Call')+'</small><b>'+esc(x.reason||'Phone call')+'</b><span><i class="disposition-pill '+callDispositionClass(x)+'">'+esc(disp.label)+'</i><i class="team-status-pill '+team.tone+'">'+esc(team.label)+'</i></span></span><span class="history-chevron">⌄</span></summary><div class="contact-expand-body" data-contact-inline-call-body="'+esc(x.id)+'">'+contactInlineCallHtml(x)+'</div></details>';
  }
  if(e.filter==='message'){
    const s=e.session,count=s.messages.length,start=contactTimeLabel(s.firstAt),finish=contactTimeLabel(s.lastAt),preview=s.messages[s.messages.length-1]?.text||'';
    return '<details class="contact-history-card message"><summary><span class="history-icon message">✉</span><span class="history-summary-copy"><small>'+esc(start+(finish&&finish!==start?'–'+finish:''))+'</small><b>'+count+' message'+(count===1?'':'s')+'</b><p>'+esc(preview)+'</p></span><span class="history-chevron">⌄</span></summary><div class="contact-expand-body"><div class="contact-message-thread">'+s.messages.map(m=>'<div class="contact-message '+(m.dir==='out'?'out':'in')+'"><small>'+esc(m.dir==='out'?'CallerCore / team':m.who||'Caller')+' · '+esc(contactTimeLabel(m.at))+'</small><p>'+esc(m.text)+'</p></div>').join('')+'</div></div></details>';
  }
  if(e.filter==='request'){
    const r=e.request;
    return '<details class="contact-history-card request"><summary><span class="history-icon request">◆</span><span class="history-summary-copy"><small>'+esc(contactTimeLabel(e.at))+' · Service request</small><b>'+esc(r.service||'Service request')+'</b><p>'+esc(serviceRequestStageLabel(r.stage))+'</p></span><span class="history-chevron">⌄</span></summary><div class="contact-expand-body"><div class="contact-inline-call-grid"><div><span>Status</span><b>'+esc(serviceRequestStageLabel(r.stage))+'</b></div><div><span>Source</span><b>'+esc(r.source||'CallerCore')+'</b></div></div></div></details>';
  }
  const n=e.note||{};
  return '<article class="contact-history-card note static"><span class="history-icon note">✎</span><span class="history-summary-copy"><small>'+esc(contactTimeLabel(e.at))+' · Internal note</small><b>'+esc(n.by||'Team note')+'</b><p>'+esc(n.text||'')+'</p></span></article>';
}
function renderContactHistoryTimeline(c){
  const timeline=document.getElementById('contactDrawerTimeline');if(!timeline||!c)return;
  const events=contactHistoryEvents(c).filter(e=>contactHistoryFilter==='all'||e.filter===contactHistoryFilter);
  const groups=new Map();
  for(const e of events){const key=contactDateKey(e.at);if(!groups.has(key))groups.set(key,{at:e.at,items:[]});groups.get(key).items.push(e)}
  timeline.innerHTML=[...groups.values()].map(group=>'<section class="contact-history-day"><div class="contact-history-day-head"><b>'+esc(contactDateLabel(group.at))+'</b><span>'+group.items.length+' item'+(group.items.length===1?'':'s')+'</span></div>'+group.items.map(renderContactHistoryItem).join('')+'</section>').join('')||'<div class="contact-history-empty">No '+esc(contactHistoryFilter==='all'?'activity':contactHistoryFilter+' activity')+' yet.</div>';
  timeline.querySelectorAll('[data-contact-inline-call]').forEach(details=>details.addEventListener('toggle',()=>{if(details.open)hydrateContactCallDetails(details.dataset.contactInlineCall,details)}));
  document.querySelectorAll('[data-contact-history-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.contactHistoryFilter===contactHistoryFilter));
}

function openContact(key){
  const c=buildContacts().find(x=>x.key===key);if(!c)return;
  const drawer=document.getElementById('contactDrawer'),back=document.getElementById('contactDrawerBackdrop');if(!drawer||!back)return;
  activeContactKey=c.key;contactHistoryFilter='all';
  document.getElementById('contactDrawerName').textContent=c.name;
  document.getElementById('contactDrawerMeta').textContent=c.lastAt?'Last interaction '+new Date(c.lastAt).toLocaleString():'No recent interaction date';
  const digits=String(c.phone||'').replace(/\D/g,''),setActionLink=(el,href)=>{if(!el)return;const enabled=!!href;if(enabled)el.setAttribute('href',href);else el.removeAttribute('href');el.classList.toggle('disabled-link',!enabled);el.setAttribute('aria-disabled',enabled?'false':'true');el.tabIndex=enabled?0:-1};setActionLink(document.getElementById('contactCallLink'),digits?'tel:'+digits:'');setActionLink(document.getElementById('contactTextLink'),digits?'sms:'+digits:'');
  const msgCount=c.conversations.reduce((n,x)=>n+(Array.isArray(x.messages)?x.messages.length:0),0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('contactHistoryCalls',c.calls.length);set('contactHistoryMessages',msgCount);set('contactHistoryRequests',c.leads.length);
  document.getElementById('contactDrawerDetails').innerHTML=[
    ['Phone',c.phone||'Not captured'],['Type',contactType(c)],['Address',c.address||'Not captured'],['Last interaction',c.lastAt?new Date(c.lastAt).toLocaleString():'Not available']
  ].map(([k,v])=>'<div><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join('');
  const latestCall=[...c.calls].sort((a,b)=>recordTime(b)-recordTime(a))[0],latestLead=[...c.leads].sort((a,b)=>recordTime(b)-recordTime(a))[0],activeActions=c.calls.filter(teamStatusActive).length;
  const summaryParts=[];if(latestCall)summaryParts.push('Latest call: '+(latestCall.reason||'phone call')+'.');if(activeActions)summaryParts.push(activeActions+' open team action'+(activeActions===1?'':'s')+'.');else if(c.calls.length)summaryParts.push('No open team actions.');if(latestLead?.service)summaryParts.push('Service history includes '+latestLead.service.toLowerCase()+'.');
  document.getElementById('contactDrawerSummary').textContent=summaryParts.join(' ')||'CallerCore has activity for this contact.';
  renderContactHistoryTimeline(c);
  resetSurfaceScroll(drawer);drawer.classList.add('open');back.classList.add('open');drawer.setAttribute('aria-hidden','false');document.body.classList.add('drawer-open');setTimeout(()=>{resetSurfaceScroll(drawer);document.getElementById('closeContactDrawer')?.focus()},20);
}
function closeContact(){document.getElementById('contactDrawer')?.classList.remove('open');document.getElementById('contactDrawerBackdrop')?.classList.remove('open');document.getElementById('contactDrawer')?.setAttribute('aria-hidden','true');if(!document.getElementById('callDrawer')?.classList.contains('open'))document.body.classList.remove('drawer-open')}
document.getElementById('contactSearch')?.addEventListener('input',renderContacts);
document.querySelectorAll('[data-contact-history-filter]').forEach(btn=>btn.addEventListener('click',()=>{contactHistoryFilter=btn.dataset.contactHistoryFilter||'all';const c=buildContacts().find(x=>x.key===activeContactKey);if(c)renderContactHistoryTimeline(c)}));
document.querySelectorAll('[data-contact-stat-filter]').forEach(btn=>btn.addEventListener('click',()=>{contactHistoryFilter=btn.dataset.contactStatFilter||'all';const c=buildContacts().find(x=>x.key===activeContactKey);if(c)renderContactHistoryTimeline(c);document.querySelector('.contact-activity-section')?.scrollIntoView({behavior:'smooth',block:'start'})}));
document.getElementById('closeContactDrawer')?.addEventListener('click',closeContact);
document.getElementById('contactDrawerBackdrop')?.addEventListener('click',closeContact);
document.getElementById('drawerFollowupButton')?.addEventListener('click',e=>{const id=e.currentTarget.dataset.callId,status=document.getElementById('drawerTeamStatus')?.value;if(id&&status)requestTeamStatusChange(id,status)});
document.getElementById('drawerSaveNote')?.addEventListener('click',saveCallNote);
document.getElementById('drawerCancelNoteEdit')?.addEventListener('click',resetNoteComposer);
document.getElementById('drawerAddNoteToggle')?.addEventListener('click',()=>{const composer=document.getElementById('drawerNoteComposer'),input=document.getElementById('drawerInternalNote');if(!composer)return;if(activeNoteEditId)resetNoteComposer();composer.hidden=false;if(input)input.value='';const save=document.getElementById('drawerSaveNote'),cancel=document.getElementById('drawerCancelNoteEdit'),status=document.getElementById('drawerNoteStatus');if(save)save.textContent='Save note';if(cancel)cancel.hidden=true;if(status)status.textContent='';setTimeout(()=>input?.focus(),20)});

function renderAppointments(){
  if(!has('appointments'))return;
  const wrap=document.getElementById('appointmentTable');if(!wrap)return;
  const upcoming=appointmentsData.filter(x=>!['Completed','Canceled'].includes(x.status)).length;
  document.getElementById('apptUpcoming').textContent=upcoming;
  document.getElementById('apptConfirmed').textContent=appointmentsData.filter(x=>x.status==='Confirmed').length;
  document.getElementById('apptCompleted').textContent=appointmentsData.filter(x=>x.status==='Completed').length;
  wrap.innerHTML=appointmentsData.map(x=>'<div class="appointment-row"><span><strong>'+esc(x.name||'Unknown')+'</strong><small class="subtle">'+esc(x.phone||'')+'</small></span><span>'+esc(x.date||'')+'<small class="subtle">'+esc(x.time||'')+'</small></span><span>'+esc(x.service||'General appointment')+'</span><span><select class="appointment-status" data-appointment-id="'+esc(x.id)+'">'+['Scheduled','Confirmed','Completed','Canceled'].map(s=>'<option '+(x.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></span><span>'+esc(x.source||'CallerCore')+'</span></div>').join('');
  document.getElementById('appointmentsEmpty').hidden=appointmentsData.length!==0;
  wrap.querySelectorAll('[data-appointment-id]').forEach(sel=>sel.addEventListener('change',()=>updateAppointment(sel.dataset.appointmentId,sel.value)));
}
async function updateAppointment(id,status){
  const item=appointmentsData.find(x=>String(x.id)===String(id));if(!item)return;
  const previous=item.status;item.status=status;renderAppointments();if(demoMode)return;
  try{const r=await fetch('/api/account?action=appointment-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});if(!r.ok)throw new Error('update failed')}
  catch(err){item.status=previous;renderAppointments();console.error(err)}
}
document.getElementById('conversationSearch')?.addEventListener('input',renderConversations);
document.querySelectorAll('[data-conversation-filter]').forEach(b=>b.addEventListener('click',()=>{conversationFilter=b.dataset.conversationFilter;renderConversations()}));
document.getElementById('conversationContactButton')?.addEventListener('click',e=>{const key=e.currentTarget.dataset.contactKey;if(key)openContact(key)});


const AGENT_SECTION_FIELDS={
  identity:['agentName','agentRole','agentTone','agentOpening'],
  knowledge:['agentServiceArea','agentHours','agentTransfer','agentEmergency'],
  qualification:[],
  handling:['agentHandlingInstructions']
};
function agentControlIds(){return Object.values(AGENT_SECTION_FIELDS).flat()}
function activeAgentSection(){return typeof agentEditing==='string'?agentEditing:''}
function setAgentEditing(section,{restore=false}={}){
  const next=typeof section==='string'&&section?section:'';
  if(next&&!agentEditing&&agentData)agentEditSnapshot=JSON.parse(JSON.stringify(agentData));
  if(restore&&agentEditSnapshot){agentData=JSON.parse(JSON.stringify(agentEditSnapshot));agentEditSnapshot=null;agentEditing=false;renderAgent();return}
  agentEditing=next||false;const active=activeAgentSection();
  agentControlIds().forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!(active&&AGENT_SECTION_FIELDS[active]?.includes(id))});
  document.querySelectorAll('[data-agent-section-card]').forEach(card=>card.dataset.agentEditing=card.dataset.agentSectionCard===active?'true':'false');
  document.querySelectorAll('[data-agent-edit]').forEach(btn=>{btn.hidden=!!active;btn.disabled=!!active});
  document.querySelectorAll('[data-agent-save]').forEach(btn=>btn.hidden=btn.dataset.agentSave!==active);
  document.querySelectorAll('[data-agent-cancel]').forEach(btn=>btn.hidden=btn.dataset.agentCancel!==active);
  const add=document.getElementById('addQuestionButton');if(add)add.hidden=active!=='qualification';
  renderQuestions();
}
function renderAgent(){
  if(!agentData)return;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  set('agentName',agentData.name);set('agentRole',agentData.role);set('agentTone',agentData.tone);
  set('agentOpening',agentData.openingMessage);set('agentServiceArea',agentData.serviceArea);
  set('agentHours',agentData.businessHours);set('agentTransfer',agentData.transferNumber);set('agentEmergency',agentData.emergencyInstructions);
  set('agentHandlingInstructions',agentData.handlingInstructions);
  const test=document.getElementById('agentTestCall'),digits=String(phoneRoutingData?.number||'').replace(/\D/g,'');if(test){test.hidden=!digits;if(digits)test.setAttribute('href','tel:'+digits);else test.removeAttribute('href');test.classList.toggle('disabled-link',!digits);test.setAttribute('aria-disabled',digits?'false':'true');test.tabIndex=digits?0:-1;test.title=digits?'Call '+phoneRoutingData.number+' to test '+(agentData.name||'Maya'):''}
  renderQuestions();setAgentEditing(activeAgentSection());
}
function renderQuestions(){
  const wrap=document.getElementById('qualificationQuestions');if(!wrap||!agentData)return;
  const qs=Array.isArray(agentData.qualificationQuestions)?agentData.qualificationQuestions:[],editing=activeAgentSection()==='qualification';
  wrap.innerHTML=editing
    ?qs.map((q,i)=>'<div class="question-row editing"><input data-question-index="'+i+'" value="'+esc(q)+'" aria-label="Qualification question '+(i+1)+'"><button data-remove-question="'+i+'" aria-label="Remove question '+(i+1)+'">×</button></div>').join('')
    :qs.map((q,i)=>'<div class="question-row locked"><span class="question-number">'+String(i+1).padStart(2,'0')+'</span><p>'+esc(q||'Untitled question')+'</p></div>').join('');
  if(editing){wrap.querySelectorAll('[data-question-index]').forEach(input=>input.addEventListener('input',()=>{agentData.qualificationQuestions[Number(input.dataset.questionIndex)]=input.value}));wrap.querySelectorAll('[data-remove-question]').forEach(btn=>btn.addEventListener('click',()=>{agentData.qualificationQuestions.splice(Number(btn.dataset.removeQuestion),1);renderQuestions()}))}
}
function collectAgent(){
  const val=id=>document.getElementById(id)?.value||'';
  return {name:val('agentName'),role:val('agentRole'),tone:val('agentTone'),openingMessage:val('agentOpening'),serviceArea:val('agentServiceArea'),businessHours:val('agentHours'),transferNumber:val('agentTransfer'),emergencyInstructions:val('agentEmergency'),handlingInstructions:val('agentHandlingInstructions'),qualificationQuestions:[...(agentData?.qualificationQuestions||[])]};
}
async function saveAgent(section=activeAgentSection()){
  if(!section)return;const next=collectAgent(),btn=document.querySelector('[data-agent-save="'+CSS.escape(section)+'"]');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{
    if(!demoMode){const r=await fetch('/api/account?action=agent-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not save the AI receptionist.');agentData=data.agent||next}else agentData=next;
    agentEditSnapshot=null;agentEditing=false;renderAgent();const status=document.getElementById('agentSaveStatus');if(status){status.textContent='Saved';status.classList.add('show');setTimeout(()=>status.classList.remove('show'),1600)}
  }catch(err){alert(err.message||'Could not save the AI receptionist.')}
  finally{if(btn){btn.disabled=false;btn.textContent='Save'}}
}

function feedbackStatusLabel(status){return ({submitted:'Submitted',reviewed:'Reviewed',applied:'Applied',dismissed:'Closed'})[status]||'Submitted'}
function renderClientFeedback(){
  const wrap=document.getElementById('clientFeedbackList');if(!wrap)return;
  const items=(clientFeedbackData||[]).slice(0,8),count=document.getElementById('agentFeedbackCount');if(count)count.textContent=String(clientFeedbackData.length||0);
  wrap.classList.add('feedback-list');
  wrap.innerHTML=items.map(x=>'<article class="feedback-item"><div><b>'+esc((x.category||'Feedback').replaceAll('_',' '))+'</b><small>'+esc(x.source==='call'?'Call feedback'+(x.context?' · '+x.context:''):'AI receptionist feedback')+' · '+(x.createdAt?new Date(x.createdAt).toLocaleString():'')+'</small></div><span class="feedback-status '+esc(x.status||'submitted')+'">'+esc(feedbackStatusLabel(x.status))+'</span><p>'+esc(x.message||'')+'</p></article>').join('')||'<p class="muted">No feedback submitted yet.</p>';
}
async function loadClientFeedback({silent=false}={}){
  const wrap=document.getElementById('clientFeedbackList');if(!wrap)return;
  if(demoMode){renderClientFeedback();return}
  try{const r=await fetch('/api/account?action=ai-feedback',{headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error('feedback load');const data=await r.json();clientFeedbackData=data.feedback||[];renderClientFeedback()}catch(e){if(!silent)console.error(e);if(wrap&&!clientFeedbackData.length)wrap.innerHTML='<p class="muted">Feedback history is temporarily unavailable.</p>'}
}
async function submitAiFeedback({source='receptionist',callId='',category='',message='',context='',button,statusEl}={}){
  const textValue=String(message||'').trim();if(!textValue){if(statusEl)statusEl.textContent='Add a short description first.';return false}
  if(button){button.disabled=true;button.textContent='Sending…'}if(statusEl)statusEl.textContent='Sending feedback…';
  try{
    let item={id:'demo_feedback_'+Date.now(),source,callId,category,message:textValue,context,status:'submitted',createdAt:Date.now(),updatedAt:Date.now()};
    if(!demoMode){const r=await fetch('/api/account?action=ai-feedback-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,callId,category,message:textValue,context})}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not send feedback.');item=data.feedback||item}
    clientFeedbackData=[item,...clientFeedbackData.filter(x=>x.id!==item.id)];renderClientFeedback();if(statusEl)statusEl.textContent='Submitted for review.';return true;
  }catch(err){if(statusEl)statusEl.textContent=err.message||'Could not send feedback.';return false}
  finally{if(button){button.disabled=false;button.textContent=source==='call'?'Send feedback':'Send feedback'}}
}
function openCallFeedbackModal(callId,context=''){
  const modal=document.getElementById('aiFeedbackModal');if(!modal)return;
  closeCall();closeContact();document.getElementById('aiFeedbackCallId').value=callId||'';document.getElementById('aiFeedbackMessage').value='';document.getElementById('aiFeedbackCategory').value='incorrect_information';document.getElementById('aiFeedbackStatus').textContent='';modal.dataset.context=context||'';resetSurfaceScroll(modal);modal.classList.add('open');modal.setAttribute('aria-hidden','false');setTimeout(()=>{resetSurfaceScroll(modal);document.getElementById('aiFeedbackCategory')?.focus()},20);
}
function closeCallFeedbackModal(){const modal=document.getElementById('aiFeedbackModal');if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}}
function renderAutomations(){
  if(!has('automations'))return;
  const wrap=document.getElementById('automationList');if(!wrap)return;
  wrap.innerHTML=automationsData.map(x=>'<article class="automation-card"><div><h3>'+esc(x.name)+'</h3><p>When <b>'+esc(triggerLabel(x.trigger))+'</b> → '+esc(actionLabel(x.action))+'</p></div><div class="automation-actions"><button data-edit-auto="'+esc(x.id)+'">Edit</button><button class="danger-link" data-delete-auto="'+esc(x.id)+'">Delete</button><button class="switch '+(x.enabled?'on':'')+'" data-toggle-auto="'+esc(x.id)+'" aria-label="Toggle automation"><i></i></button></div></article>').join('');
  document.getElementById('automationEmpty').hidden=automationsData.length!==0;
  wrap.querySelectorAll('[data-toggle-auto]').forEach(btn=>btn.addEventListener('click',()=>toggleAutomation(btn.dataset.toggleAuto)));
  wrap.querySelectorAll('[data-edit-auto]').forEach(btn=>btn.addEventListener('click',()=>openAutomation(btn.dataset.editAuto)));
  wrap.querySelectorAll('[data-delete-auto]').forEach(btn=>btn.addEventListener('click',()=>deleteAutomation(btn.dataset.deleteAuto)));
}
async function persistAutomations(){
  if(demoMode)return true;
  const r=await fetch('/api/account?action=automations-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({automations:automationsData})});
  if(!r.ok){alert('Could not save automations right now.');return false}
  automationsData=(await r.json()).automations||automationsData;return true;
}
async function toggleAutomation(id){
  const item=automationsData.find(x=>String(x.id)===String(id));if(!item)return;
  item.enabled=!item.enabled;renderAutomations();await persistAutomations();
}
let editingAutomationId=null;
function openAutomation(id=null,preset=null){
  if(!has('automations'))return;
  const modal=document.getElementById('automationModal');if(!modal)return;
  editingAutomationId=id;
  let item=id?automationsData.find(x=>String(x.id)===String(id)):null;
  if(!item&&preset){
    const defs={
      missed_call:{name:'Missed-call follow-up task',trigger:'missed_call',action:'create_followup'},
      new_lead:{name:'New lead alert',trigger:'new_lead',action:'notify_team'},

    };item=defs[preset]||null;
  }
  document.getElementById('automationModalTitle').textContent=id?'Edit automation':'New automation';
  document.getElementById('automationName').value=item?.name||'';
  document.getElementById('automationTrigger').value=item?.trigger||'new_lead';
  document.getElementById('automationAction').value=item?.action||'notify_team';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}
function closeAutomation(){const modal=document.getElementById('automationModal');modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');editingAutomationId=null}
async function saveAutomation(){
  const name=document.getElementById('automationName').value.trim();if(!name)return;
  const item={id:editingAutomationId||('auto_'+Date.now()),name,trigger:document.getElementById('automationTrigger').value,action:document.getElementById('automationAction').value,enabled:true};
  const i=automationsData.findIndex(x=>String(x.id)===String(editingAutomationId));if(i>=0)automationsData[i]={...automationsData[i],...item};else automationsData.push(item);
  renderAutomations();closeAutomation();await persistAutomations();
}
document.querySelectorAll('[data-agent-edit]').forEach(btn=>btn.addEventListener('click',()=>setAgentEditing(btn.dataset.agentEdit)));
document.querySelectorAll('[data-agent-cancel]').forEach(btn=>btn.addEventListener('click',()=>setAgentEditing(false,{restore:true})));
document.querySelectorAll('[data-agent-save]').forEach(btn=>btn.addEventListener('click',()=>saveAgent(btn.dataset.agentSave)));
document.getElementById('addQuestionButton')?.addEventListener('click',()=>{if(activeAgentSection()!=='qualification')return;if(!agentData)agentData={...DEMO_AGENT,qualificationQuestions:[]};agentData.qualificationQuestions=agentData.qualificationQuestions||[];if(agentData.qualificationQuestions.length<12){agentData.qualificationQuestions.push('');renderQuestions()}});
document.getElementById('submitAgentFeedback')?.addEventListener('click',async()=>{const button=document.getElementById('submitAgentFeedback'),statusEl=document.getElementById('agentFeedbackStatus'),message=document.getElementById('agentFeedbackMessage'),category=document.getElementById('agentFeedbackCategory');const ok=await submitAiFeedback({source:'receptionist',category:category?.value||'other',message:message?.value||'',context:agentData?.name||'AI receptionist',button,statusEl});if(ok&&message)message.value=''});
document.getElementById('drawerAiFeedbackButton')?.addEventListener('click',e=>openCallFeedbackModal(e.currentTarget.dataset.callId||activeCallId,e.currentTarget.dataset.callContext||''));
document.getElementById('closeAiFeedbackModal')?.addEventListener('click',closeCallFeedbackModal);
document.getElementById('aiFeedbackModal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeCallFeedbackModal()});
document.getElementById('submitCallFeedback')?.addEventListener('click',async()=>{const button=document.getElementById('submitCallFeedback'),statusEl=document.getElementById('aiFeedbackStatus'),message=document.getElementById('aiFeedbackMessage'),category=document.getElementById('aiFeedbackCategory'),modal=document.getElementById('aiFeedbackModal');const ok=await submitAiFeedback({source:'call',callId:document.getElementById('aiFeedbackCallId')?.value||'',category:category?.value||'other',message:message?.value||'',context:modal?.dataset.context||'',button,statusEl});if(ok)setTimeout(closeCallFeedbackModal,450)});
document.getElementById('newAutomationButton')?.addEventListener('click',()=>openAutomation());
document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>openAutomation(null,btn.dataset.preset)));
document.getElementById('saveAutomationButton')?.addEventListener('click',saveAutomation);
document.querySelector('.automation-close')?.addEventListener('click',closeAutomation);
document.getElementById('automationModal')?.addEventListener('click',e=>{if(e.target.id==='automationModal')closeAutomation()});


function buildLocalAnalytics(){
  const qualified=callsData.filter(x=>/qualified|booked/i.test(String(x.outcome||''))).length;
  const won=leadsData.filter(x=>x.stage==='Won').length;
  const pipeline=leadsData.reduce((s,x)=>s+Number(x.value||0),0);
  const reasons={};callsData.forEach(x=>{const k=x.reason||'Other';reasons[k]=(reasons[k]||0)+1});
  return {calls:callsData.length,leads:leadsData.length,appointments:appointmentsData.length,qualified,won,pipeline,conversion:leadsData.length?Math.round(won/leadsData.length*100):0,callReasons:Object.entries(reasons).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,6)};
}
function renderAnalytics(){
  if(!has('advancedAnalytics'))return;
  const days=Number(document.getElementById('insightsRange')?.value||30),rows=callsData.filter(x=>withinDays(recordTime(x),days)),total=rows.length,answered=rows.filter(callAnswered).length,resolved=rows.filter(callResolvedByAi).length,afterHours=rows.filter(x=>{const h=new Date(recordTime(x)).getHours();return h<8||h>=18}).length,activeDays=new Set(rows.map(x=>new Date(recordTime(x)).toDateString())).size,avg=activeDays?Math.round(total/activeDays*10)/10:0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};set('analyticsAnswerRate',(total?Math.round(answered/total*100):0)+'%');set('analyticsQualified',(total?Math.round(resolved/total*100):0)+'%');set('analyticsAfterHours',(total?Math.round(afterHours/total*100):0)+'%');set('analyticsDailyAvg',avg);set('analyticsCalls',total+' total calls');
  const reasons={};rows.forEach(x=>{const k=String(x.category||'Other');reasons[k]=(reasons[k]||0)+1});const reasonRows=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,9),reasonMax=Math.max(1,...reasonRows.map(x=>x[1])),reasonWrap=document.getElementById('callReasonBars');if(reasonWrap)reasonWrap.innerHTML=reasonRows.map(([label,value])=>'<div class="bar-row"><span>'+esc(label)+'</span><b>'+Math.round(value/Math.max(1,total)*100)+'%</b><div class="bar-track"><i style="width:'+Math.round(value/reasonMax*100)+'%"></i></div></div>').join('')||'<span class="muted">No call data yet.</span>';
  const daily=document.getElementById('insightDailyBars');if(daily){const vals=[];for(let i=days-1;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const next=d.getTime()+86400000,n=rows.filter(x=>{const t=recordTime(x);return t>=d.getTime()&&t<next}).length;vals.push({d,n})}const display=vals.filter((_,i)=>days<=7||i%Math.max(1,Math.floor(days/12))===0||i===vals.length-1),max=Math.max(1,...display.map(x=>x.n));daily.innerHTML=display.map(x=>'<div class="insight-bar-col"><b>'+x.n+'</b><span><i style="height:'+Math.max(5,Math.round(x.n/max*100))+'%"></i></span><small>'+x.d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+'</small></div>').join('')}
  const hours=Array.from({length:12},(_,i)=>({h:i+7,n:0}));rows.forEach(x=>{const h=new Date(recordTime(x)).getHours(),slot=hours.find(v=>v.h===h);if(slot)slot.n++});const hourWrap=document.getElementById('insightHourBars');if(hourWrap){const max=Math.max(1,...hours.map(x=>x.n));hourWrap.innerHTML=hours.map(x=>'<div><small>'+new Date(2020,1,1,x.h).toLocaleTimeString(undefined,{hour:'numeric'})+'</small><span><i style="width:'+Math.round(x.n/max*100)+'%"></i></span><b>'+x.n+'</b></div>').join('')}
  const outcomes={};rows.forEach(x=>{const k=callDispositionLabel(x);outcomes[k]=(outcomes[k]||0)+1});const donut=document.getElementById('outcomeDonut'),legend=document.getElementById('outcomeLegend'),colors=['#4f9b6a','#5f7f9a','#d88736','#c65d4a','#87919b','#8b78a8','#5f6b73'];if(donut){let cursor=0,parts=Object.values(outcomes).map((v,i)=>{const pct=total?(v/total*100):0,start=cursor;cursor+=pct;return colors[i%colors.length]+' '+start+'% '+cursor+'%'});donut.style.background='conic-gradient('+(parts.join(',')||'#e8ebee 0 100%')+')';set('outcomeDonutLabel',total)}if(legend)legend.innerHTML=Object.entries(outcomes).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>'<div><span><i style="background:'+colors[i%colors.length]+'"></i>'+esc(k)+'</span><b>'+v+' · '+(total?Math.round(v/total*100):0)+'%</b></div>').join('');
}
function setWebhookEditing(editing){
  webhookEditing=!!editing;const editor=document.getElementById('webhookEditor'),edit=document.getElementById('editWebhookButton'),url=document.getElementById('webhookUrl'),status=document.getElementById('webhookEditStatus');
  if(editor)editor.hidden=!webhookEditing;if(edit){edit.hidden=webhookEditing;edit.textContent=(integrationsData?.webhookUrl?'Edit webhook':'Configure webhook')}if(url){url.disabled=!webhookEditing;if(webhookEditing)url.value=integrationsData?.webhookUrl||''}if(status)status.textContent='';
  if(webhookEditing)setTimeout(()=>url?.focus(),20);
}
function renderIntegrations(){
  if(!integrationsData)integrationsData={googleCalendar:false,stripe:!!sessionWorkspace?.stripe?.customerLinked,webhookUrl:'',apiAccess:has('apiAccess')};
  const routeReady=!!phoneRoutingData?.number,agentReady=!!agentData?.name;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  const tag=(id,ok,yes,no)=>{const el=document.getElementById(id);if(el){el.textContent=ok?yes:no;el.className='tag '+(ok?'green':'amber')}};
  set('connectionPhoneTitle',routeReady?'Phone routing active':'Phone routing not ready');set('connectionPhoneCopy',routeReady?(phoneRoutingData.number+' is answering through CallerCore.'):'A CallerCore number has not been assigned yet.');tag('connectionPhoneStatus',routeReady,'Active','Needs setup');
  set('connectionAgentTitle',agentReady?(agentData.name+' is configured'):'AI receptionist needs setup');set('connectionAgentCopy',agentReady?'Business hours, service area, and escalation rules are loaded.':'Finish your AI receptionist configuration before going live.');tag('connectionAgentStatus',agentReady,'Ready','Needs setup');
  const g=document.getElementById('googleCalendarStatus');if(g){const ok=capability('calendar')&&integrationsData.googleCalendar;g.textContent=ok?'Connected':'Not connected';g.className='tag '+(ok?'green':'amber')}
  set('connectionBusinessNumber',phoneRoutingData?.forwardingFrom||settingsData?.businessPhone||'Your business line');set('connectionCallerCoreNumber',phoneRoutingData?.number||'Not assigned');set('connectionTransferNumber',phoneRoutingData?.transferNumber||agentData?.transferNumber||'Not configured');
  const panel=document.getElementById('webhookPanel');if(panel)panel.hidden=!has('apiAccess');set('webhookDisplay',integrationsData.webhookUrl||'Not configured');setWebhookEditing(webhookEditing);
}
async function saveWebhook(){
  if(!has('apiAccess'))return openModal('Pro');
  const webhookUrl=document.getElementById('webhookUrl')?.value.trim()||'',status=document.getElementById('webhookEditStatus');if(status)status.textContent='Saving…';
  if(demoMode){integrationsData={...(integrationsData||{}),webhookUrl};webhookEditing=false;renderIntegrations();return}
  const r=await fetch('/api/account?action=integrations-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({webhookUrl})});
  if(!r.ok){if(status)status.textContent='Could not save. Make sure the URL uses HTTPS.';return}
  integrationsData={...(integrationsData||{}),...((await r.json()).integrations||{})};webhookEditing=false;renderIntegrations();
}
function settingsControlIds(){return ['settingsBusinessName','settingsContactName','settingsPrimaryEmail','settingsBusinessPhone','settingsWebsite','settingsIndustry','settingsServiceArea','settingsStreetAddress','settingsCity','settingsState','settingsPostalCode','settingsTimezone','settingsNotificationEmail','settingsEmailAlerts','settingsNotifyBilling','settingsNotifySetup','settingsNotifyCalls','settingsNotifySupport','settingsNotifyUsage']}
function businessInitials(name=''){const parts=String(name||'Business').trim().split(/\s+/).filter(Boolean);return (parts.length>1?(parts[0][0]+parts[1][0]):String(parts[0]||'B').slice(0,2)).toUpperCase()}
function renderBusinessLogo(){
  const data=pendingBusinessLogo!=null?pendingBusinessLogo:String(settingsData?.logoDataUrl||''),img=document.getElementById('businessLogoImage'),initials=document.getElementById('businessLogoInitials'),remove=document.getElementById('businessLogoRemove'),workspaceImg=document.getElementById('workspaceLogoImage'),workspaceInitials=document.getElementById('workspaceLogoInitials');if(initials)initials.textContent=businessInitials(document.getElementById('settingsBusinessName')?.value||settingsData?.businessName);
  if(img){if(data){img.src=data;img.hidden=false;if(initials)initials.hidden=true}else{img.removeAttribute('src');img.hidden=true;if(initials)initials.hidden=false}}
  if(remove)remove.hidden=!settingsEditing||!data;
  if(workspaceInitials)workspaceInitials.textContent=businessInitials(settingsData?.businessName||sessionWorkspace?.name);if(workspaceImg){if(settingsData?.logoDataUrl){workspaceImg.src=settingsData.logoDataUrl;workspaceImg.hidden=false;if(workspaceInitials)workspaceInitials.hidden=true}else{workspaceImg.removeAttribute('src');workspaceImg.hidden=true;if(workspaceInitials)workspaceInitials.hidden=false}}
}
function setSettingsEditing(editing,{restore=false}={}){
  settingsEditing=!!editing;if(restore)renderSettings();
  settingsControlIds().forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!settingsEditing});
  const sms=document.getElementById('settingsSmsAlerts');if(sms)sms.disabled=true;
  const edit=document.getElementById('settingsEditButton'),cancel=document.getElementById('settingsCancelButton'),save=document.getElementById('saveSettingsButton'),logo=document.getElementById('businessLogoButton');
  if(edit)edit.hidden=settingsEditing;if(cancel)cancel.hidden=!settingsEditing;if(save)save.hidden=!settingsEditing;if(logo)logo.hidden=!settingsEditing;
  renderBusinessLogo();
}
function renderAiAnsweringControl(){
  const state=aiAnsweringState(),title=document.getElementById('settingsAiTitle'),copy=document.getElementById('settingsAiCopy'),button=document.getElementById('toggleAiAnsweringButton'),input=document.getElementById('aiPauseFallbackNumber'),visual=document.getElementById('settingsAiVisual'),note=document.getElementById('aiAnsweringStatusNote');
  if(!title||!button)return;if(visual)visual.classList.remove('active','paused','setup');
  if(input&&!input.matches(':focus'))input.value=state.fallback||'';
  if(state.active){visual?.classList.add('active');title.textContent='AI answering is active';copy.textContent=(state.number?'CallerCore is set to answer '+state.number+'. ':'')+'Use Pause only when you intentionally need your team or another phone to take over.';button.textContent='Pause AI answering';button.className='danger-btn ai-pause-button';button.disabled=false;if(note)note.textContent='Optional: enter a temporary handoff number before pausing.'}
  else if(state.paused){visual?.classList.add('paused');title.textContent='AI answering is paused';copy.textContent=state.fallback?'Temporary handoff number saved: '+state.fallback+'.':'CallerCore AI answering is paused for this workspace.';button.textContent='Resume AI answering';button.className='primary ai-pause-button';button.disabled=!state.routingReady;if(note)note.textContent='Resume when you want CallerCore to take inbound calls again.'}
  else{visual?.classList.add('setup');title.textContent='Phone routing is not configured';copy.textContent='There is no active CallerCore number to pause or resume yet.';button.textContent='AI answering unavailable';button.className='secondary-btn ai-pause-button';button.disabled=true;if(note)note.textContent='Finish phone routing before using emergency answering controls.'}
}
async function toggleAiAnswering(){
  const state=aiAnsweringState(),targetPaused=!state.paused,input=document.getElementById('aiPauseFallbackNumber'),status=document.getElementById('aiAnsweringActionStatus'),button=document.getElementById('toggleAiAnsweringButton'),fallback=normalizePhone(input?.value||'');
  if(fallback&&!validUsPhone(fallback)){if(status)status.textContent='Enter a valid 10-digit handoff number or leave it blank.';input?.focus();return}
  if(targetPaused&&!confirm('Pause CallerCore AI answering for this workspace? You can resume it from Settings at any time.'))return;
  if(status)status.textContent=targetPaused?'Pausing AI answering…':'Resuming AI answering…';if(button)button.disabled=true;
  try{
    if(demoMode){settingsData={...(settingsData||{}),aiAnsweringPaused:targetPaused,aiPauseFallbackNumber:fallback,aiPausedAt:targetPaused?Date.now():0};phoneRoutingData={...(phoneRoutingData||{}),status:targetPaused?'paused':'active',pauseFallbackNumber:fallback}}
    else{
      const r=await fetch('/api/account?action=ai-answering-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paused:targetPaused,fallbackNumber:fallback})}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not change AI answering status');
      settingsData={...(settingsData||{}),...(data.settings||{})};if(data.routing)phoneRoutingData=data.routing;else if(phoneRoutingData)phoneRoutingData={...phoneRoutingData,status:targetPaused?'paused':'active',pauseFallbackNumber:fallback};
    }
    renderAiAnsweringControl();renderOverview();renderPhoneRouting();if(status)status.textContent=targetPaused?'AI answering paused.':'AI answering resumed.';
  }catch(err){if(status)status.textContent=err.message||'Could not change AI answering status';renderAiAnsweringControl()}
}
function renderSettings(){
  if(!settingsData)return;
  const put=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  put('settingsBusinessName',settingsData.businessName);put('settingsContactName',settingsData.contactName);put('settingsPrimaryEmail',settingsData.primaryEmail);put('settingsBusinessPhone',settingsData.businessPhone);put('settingsWebsite',settingsData.website);put('settingsIndustry',settingsData.industry);put('settingsServiceArea',settingsData.serviceArea);put('settingsStreetAddress',settingsData.streetAddress);put('settingsCity',settingsData.city);put('settingsState',settingsData.state);put('settingsPostalCode',settingsData.postalCode);put('settingsTimezone',settingsData.timezone);put('settingsNotificationEmail',settingsData.notificationEmail);
  const e=document.getElementById('settingsEmailAlerts'),sms=document.getElementById('settingsSmsAlerts');if(e)e.checked=settingsData.emailAlerts!==false;if(sms){sms.checked=capability('sms')&&settingsData.smsAlerts!==false;sms.disabled=true}
  for(const [id,key] of [['settingsNotifyBilling','notifyBilling'],['settingsNotifySetup','notifySetup'],['settingsNotifyCalls','notifyCalls'],['settingsNotifySupport','notifySupport'],['settingsNotifyUsage','notifyUsage']]){const el=document.getElementById(id);if(el)el.checked=settingsData[key]!==false}
  pendingBusinessLogo=String(settingsData.logoDataUrl||'');setSettingsEditing(settingsEditing);renderAiAnsweringControl();
}
async function resizeBusinessLogo(file){
  if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Choose a JPG, PNG, or WebP image.');if(file.size>8*1024*1024)throw new Error('Choose an image smaller than 8 MB.');
  const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read image'));r.readAsDataURL(file)}),img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Could not load image'));i.src=src});
  const w=420,h=220,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);const scale=Math.min((w-24)/img.width,(h-24)/img.height),dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);return canvas.toDataURL('image/webp',.82);
}
function settingsFieldError(id,message=''){
  const input=document.getElementById(id);if(!input)return;
  const label=input.closest('label')||input.parentElement;
  input.classList.toggle('field-invalid',!!message);
  input.setAttribute('aria-invalid',message?'true':'false');
  let note=label?.querySelector('.field-error');
  if(message&&!note){note=document.createElement('small');note.className='field-error';label?.appendChild(note)}
  if(note){note.textContent=message;note.hidden=!message}
}
function normalizePhone(value){
  const raw=String(value||'').trim();if(!raw)return '';
  const digits=raw.replace(/\D/g,'');
  if(digits.length===10)return '('+digits.slice(0,3)+') '+digits.slice(3,6)+'-'+digits.slice(6);
  if(digits.length===11&&digits[0]==='1')return '+1 ('+digits.slice(1,4)+') '+digits.slice(4,7)+'-'+digits.slice(7);
  return raw;
}
function normalizeWebsite(value){
  let v=String(value||'').trim();if(!v)return '';
  if(!/^https?:\/\//i.test(v)&&/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(v))v='https://'+v;
  return v;
}
function validUsPhone(value,required=false){
  const raw=String(value||'').trim();if(!raw)return !required;
  const digits=raw.replace(/\D/g,'');
  return digits.length===10||(digits.length===11&&digits[0]==='1');
}
function validateSettingsForm(){
  const val=id=>String(document.getElementById(id)?.value||'').trim(),errors={};
  const business=val('settingsBusinessName'),primary=val('settingsPrimaryEmail'),notify=val('settingsNotificationEmail'),phone=val('settingsBusinessPhone'),website=val('settingsWebsite'),state=val('settingsState'),postal=val('settingsPostalCode');
  if(!business)errors.settingsBusinessName='Business name is required.';
  if(primary&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary))errors.settingsPrimaryEmail='Enter a valid email address.';
  if(notify&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notify))errors.settingsNotificationEmail='Enter a valid notification email.';
  if(phone&&!validUsPhone(phone))errors.settingsBusinessPhone='Enter a 10-digit U.S. phone number.';
  if(website){try{const u=new URL(normalizeWebsite(website));if(!['http:','https:'].includes(u.protocol)||!u.hostname.includes('.'))throw new Error()}catch{errors.settingsWebsite='Enter a valid website, such as https://example.com.'}}
  if(state&&!/^[A-Za-z]{2}$/.test(state))errors.settingsState='Use a 2-letter state code, such as WA.';
  if(postal&&!/^\d{5}(?:-\d{4})?$/.test(postal))errors.settingsPostalCode='Enter a 5-digit ZIP code or ZIP+4.';
  ['settingsBusinessName','settingsPrimaryEmail','settingsNotificationEmail','settingsBusinessPhone','settingsWebsite','settingsState','settingsPostalCode'].forEach(id=>settingsFieldError(id,errors[id]||''));
  const status=document.getElementById('settingsFormStatus');
  if(status){status.textContent=Object.keys(errors).length?'Please correct the highlighted fields.':'';status.className='form-status-line'+(Object.keys(errors).length?' error':'')}
  const first=Object.keys(errors)[0];if(first)document.getElementById(first)?.focus();
  return Object.keys(errors).length===0;
}
async function saveSettings(){
  if(!validateSettingsForm())return;
  const phoneEl=document.getElementById('settingsBusinessPhone'),webEl=document.getElementById('settingsWebsite'),stateEl=document.getElementById('settingsState');
  if(phoneEl)phoneEl.value=normalizePhone(phoneEl.value);
  if(webEl)webEl.value=normalizeWebsite(webEl.value);
  if(stateEl)stateEl.value=stateEl.value.trim().toUpperCase();
  const payload={businessName:document.getElementById('settingsBusinessName')?.value.trim()||'',contactName:document.getElementById('settingsContactName')?.value.trim()||'',primaryEmail:document.getElementById('settingsPrimaryEmail')?.value.trim()||'',businessPhone:phoneEl?.value||'',website:webEl?.value||'',industry:document.getElementById('settingsIndustry')?.value.trim()||'',serviceArea:document.getElementById('settingsServiceArea')?.value.trim()||'',streetAddress:document.getElementById('settingsStreetAddress')?.value.trim()||'',city:document.getElementById('settingsCity')?.value.trim()||'',state:stateEl?.value||'',postalCode:document.getElementById('settingsPostalCode')?.value.trim()||'',timezone:document.getElementById('settingsTimezone')?.value||'America/Los_Angeles',notificationEmail:document.getElementById('settingsNotificationEmail')?.value.trim()||'',emailAlerts:!!document.getElementById('settingsEmailAlerts')?.checked,smsAlerts:!!document.getElementById('settingsSmsAlerts')?.checked,notifyBilling:!!document.getElementById('settingsNotifyBilling')?.checked,notifySetup:!!document.getElementById('settingsNotifySetup')?.checked,notifyCalls:!!document.getElementById('settingsNotifyCalls')?.checked,notifySupport:!!document.getElementById('settingsNotifySupport')?.checked,notifyUsage:!!document.getElementById('settingsNotifyUsage')?.checked,logoDataUrl:pendingBusinessLogo!=null?pendingBusinessLogo:String(settingsData?.logoDataUrl||'')};
  const btn=document.getElementById('saveSettingsButton'),status=document.getElementById('settingsFormStatus');
  if(btn){btn.disabled=true;btn.textContent='Saving…'}if(status){status.textContent='';status.className='form-status-line'}
  try{
    if(demoMode)settingsData={...payload};
    else{
      const r=await fetch('/api/account?action=settings-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Could not save workspace settings.');
      settingsData=data.settings||payload;
      if(settingsData.businessName){document.getElementById('workspaceName').textContent=settingsData.businessName;document.querySelectorAll('[data-business-name]').forEach(el=>el.textContent=settingsData.businessName)}
    }
    pendingBusinessLogo=String(settingsData.logoDataUrl||payload.logoDataUrl||'');setSettingsEditing(false);if(status){status.textContent='Settings saved successfully.';status.className='form-status-line success'}
    const tag=document.getElementById('settingsSaveStatus');if(tag){tag.classList.add('show');setTimeout(()=>tag.classList.remove('show'),1600)}
  }catch(err){if(status){status.textContent=err.message||'Could not save workspace settings.';status.className='form-status-line error'}}
  finally{if(btn){btn.disabled=false;btn.textContent='Save settings'}}
}


function renderPhoneRouting(){
  const d=phoneRoutingData,set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  if(!document.getElementById('clientPhoneNumber'))return;
  set('clientPhoneNumber',d?.number||sessionWorkspace?.phone||'Not assigned');
  set('clientPhoneProvider',d?.provider?d.provider+' · '+((d.status||'active')==='paused'?'AI answering paused':(d.status||'active')):'Awaiting provisioning');
  set('clientForwardingFrom',d?.forwardingFrom||'—');set('clientTransferNumber',d?.transferNumber||agentData?.transferNumber||'—');
  set('clientAfterHours',d?({ai:'AI answers',transfer:'Transfer',voicemail:'Voicemail'}[d.afterHours]||d.afterHours):'—');
  set('clientSmsStatus',capability('sms')?(d&&d.smsEnabled?'SMS enabled':'SMS disabled'):'Messaging not enabled at launch');
  set('clientRoutingHeadline',d?(d.status==='paused'?'AI answering is paused.':'Your CallerCore routing is configured.'):'Phone routing has not been provisioned yet.');
  set('clientRoutingCopy',d?(d.status==='paused'?'Resume AI answering from Settings when you are ready for CallerCore to take calls again.':'Routing changes are managed carefully to prevent accidental call disruption.'):'CallerCore support will configure the AI-facing number and routing details during onboarding.');
}
function renderLocations(){
  const wrap=document.getElementById('locationsGrid'),empty=document.getElementById('locationsEmpty'),label=document.getElementById('locationsLimitLabel'),add=document.getElementById('addLocationButton');if(!wrap)return;
  wrap.innerHTML=locationsData.map(x=>'<article class="panel location-card"><div><span class="tag '+(x.active?'green':'amber')+'">'+(x.active?'Active':'Inactive')+'</span><h3>'+esc(x.name)+'</h3><p>'+esc(x.address||'No address added')+'</p><small>'+esc(x.phone||'No phone')+' · '+esc(x.timezone||'America/Los_Angeles')+'</small></div><div class="location-actions"><button class="admin-link" data-edit-location="'+esc(x.id)+'">Edit</button><button class="admin-link danger-link" data-delete-location="'+esc(x.id)+'">Delete</button></div></article>').join('');
  if(empty)empty.hidden=locationsData.length!==0;if(label)label.textContent=locationsData.length+' of '+locationsLimit+' locations used on '+currentPlan+'.';if(add)add.disabled=locationsData.length>=locationsLimit;
  wrap.querySelectorAll('[data-edit-location]').forEach(b=>b.addEventListener('click',()=>openLocationModal(b.dataset.editLocation)));
  wrap.querySelectorAll('[data-delete-location]').forEach(b=>b.addEventListener('click',()=>deleteLocation(b.dataset.deleteLocation)));
}
function openLocationModal(id=''){
  const modal=document.getElementById('locationModal');if(!modal)return;const x=locationsData.find(v=>String(v.id)===String(id));
  modal.dataset.editId=x?.id||'';document.getElementById('locationModalTitle').textContent=x?'Edit location':'Add location';document.getElementById('locationName').value=x?.name||'';document.getElementById('locationPhone').value=x?.phone||'';document.getElementById('locationAddress').value=x?.address||'';document.getElementById('locationTimezone').value=x?.timezone||settingsData?.timezone||'America/Los_Angeles';document.getElementById('locationActive').checked=x?.active!==false;modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}
function closeLocationModal(){const m=document.getElementById('locationModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}}
async function persistLocations(next){
  const r=await fetch('/api/account?action=locations-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locations:next})}),data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not save locations.');return false}locationsData=data.locations||[];locationsLimit=Number(data.limit||locationsLimit);renderLocations();return true;
}
async function saveLocation(){
  const modal=document.getElementById('locationModal'),id=modal?.dataset.editId||'',item={id:id||undefined,name:document.getElementById('locationName')?.value||'',phone:document.getElementById('locationPhone')?.value||'',address:document.getElementById('locationAddress')?.value||'',timezone:document.getElementById('locationTimezone')?.value||'America/Los_Angeles',active:!!document.getElementById('locationActive')?.checked};
  const next=id?locationsData.map(x=>String(x.id)===String(id)?{...x,...item}:x):[...locationsData,item];if(await persistLocations(next))closeLocationModal();
}
async function deleteLocation(id){const x=locationsData.find(v=>String(v.id)===String(id));if(!x||!confirm('Delete location "'+x.name+'"?'))return;await persistLocations(locationsData.filter(v=>String(v.id)!==String(id)))}
document.getElementById('addLocationButton')?.addEventListener('click',()=>openLocationModal());
document.getElementById('closeLocationModal')?.addEventListener('click',closeLocationModal);
document.getElementById('saveLocationButton')?.addEventListener('click',saveLocation);
document.getElementById('locationModal')?.addEventListener('click',e=>{if(e.target.id==='locationModal')closeLocationModal()});

function renderClientSetupStatus(){
  const title=document.getElementById('clientSetupStatusTitle'),copy=document.getElementById('clientSetupStatusCopy'),pill=document.getElementById('clientSetupStatusPill');
  if(!title||!copy||!pill)return;
  const s=sessionOnboarding?.status||'',ck=sessionOnboarding?.checklist||{};
  let t='Get your workspace live.',p='CallerCore will track the core steps required before your AI receptionist can take production traffic.',b='Setup in progress';
  if(s==='awaiting_review'){t='Your account is under review.';p='Payment is confirmed. Our team is reviewing your order and business details before sending your onboarding workspace. No action is needed from you right now.';b='Awaiting CallerCore review'}
  else if(['awaiting_agreement','intake_in_progress'].includes(s)){t='Complete your onboarding.';p='Your secure onboarding workspace is ready. Complete the service agreement and business intake so we can begin the build.';b='Action needed'}
  else if(s==='building_review'||(ck.intake&&!ck.adminReview)){t='We’re reviewing your build.';p='We received your onboarding. Your initial AI-agent configuration has been prepared and is going through CallerCore review and QA. No action is needed right now.';b='Building & QA'}
  else if(s==='qa_complete'||(ck.adminReview&&!ck.testCall)){t='Initial review complete.';p='Your agent configuration has passed our initial review. We’re finishing phone routing and preparing the test-call step.';b='Preparing test call'}
  else if(s==='client_test'||(ck.testCall&&!ck.clientApproval)){t='Your test stage is ready.';p='Your setup has reached the test-call stage. Review the agent experience before final launch approval.';b='Test & review'}
  else if(s==='ready'||(ck.clientApproval&&!ck.live)){t='Ready for launch.';p='Your configuration is approved and awaiting final activation.';b='Ready'}
  else if(s==='live'||ck.live){t='CallerCore is live.';p='Your AI receptionist is active. Monitor calls, leads, conversations, and performance from this dashboard.';b='Live'}
  title.textContent=t;copy.textContent=p;pill.textContent=b;pill.classList.toggle('live',s==='live'||!!ck.live);
}
function renderClientChecklist(){
  const wrap=document.getElementById('clientOnboardingChecklist');if(!wrap)return;
  const ck=sessionOnboarding?.checklist||{};
  const items=sessionOnboarding?[
    ['Payment received',ck.payment!==false,'billing'],
    ['Account reviewed',!!ck.accountReview,'overview'],
    ['Onboarding sent',!!ck.onboardingSent,'overview'],
    ['Intake submitted',!!ck.intake,'settings'],
    ['Business profile created',!!ck.businessProfile,'settings'],
    ['AI agent draft created',!!ck.agentDraft,'agent'],
    ['Phone number assigned',!!(ck.phoneAssigned||phoneRoutingData?.number||sessionWorkspace?.phone),'phone-routing'],
    ['CallerCore review',!!ck.adminReview,'support'],
    ['Test call completed',!!ck.testCall,'calls'],
    ['Approved for launch',!!ck.clientApproval,'support'],
    ['Live',!!ck.live,'overview']
  ]:[
    ['Business profile',!!settingsData?.businessName,'settings'],
    ['AI agent configured',!!agentData?.openingMessage,'agent'],
    ['Phone number assigned',!!(phoneRoutingData?.number||sessionWorkspace?.phone),'phone-routing'],
    ['Business location',locationsData.length>0,'locations'],
    ['Billing linked',!!sessionWorkspace?.stripe?.customerLinked,'billing']
  ];
  wrap.innerHTML=items.map(([label,done,view])=>'<button class="onboarding-item '+(done?'done':'')+'" data-view="'+view+'"><span>'+(done?'✓':'○')+'</span><b>'+esc(label)+'</b><small>'+(done?'Complete':'Pending')+'</small></button>').join('');
  wrap.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
}
function renderSupport(){
  const wrap=document.getElementById('supportTicketList'),empty=document.getElementById('supportTicketsEmpty');if(!wrap)return;
  wrap.innerHTML=supportTicketsData.map(t=>{
    const messages=(Array.isArray(t.messages)&&t.messages.length?t.messages:[{direction:'client',from:t.email||'',body:t.message||'',at:t.createdAt||Date.now()}]);
    const thread=messages.map(m=>'<div class="support-message '+(m.direction==='support'?'support':'client')+'"><div><b>'+(m.direction==='support'?'CallerCore Support':'You')+'</b><small>'+new Date(m.at||Date.now()).toLocaleString()+'</small></div><p>'+esc(m.body||'').replace(/\n/g,'<br>')+'</p></div>').join('');
    return '<details class="support-ticket-thread" data-support-ticket-id="'+esc(t.id)+'"><summary><div><b>'+esc(t.subject)+'</b><small>'+new Date(t.createdAt).toLocaleString()+' · '+esc(t.priority||'normal')+'</small></div><span class="tag '+(t.status==='resolved'?'green':t.status==='in_progress'?'amber':'')+'">'+esc(String(t.status||'open').replace('_',' '))+'</span></summary><div class="support-thread-messages">'+thread+'</div><div class="support-reply-box"><textarea data-support-client-input="'+esc(t.id)+'" placeholder="Reply to CallerCore support…"></textarea><button class="secondary-btn" type="button" data-support-client-reply="'+esc(t.id)+'">Send reply</button></div></details>';
  }).join('');
  if(empty)empty.hidden=supportTicketsData.length!==0;
  wrap.querySelectorAll('[data-support-client-reply]').forEach(b=>b.addEventListener('click',()=>replyClientSupportTicket(b.dataset.supportClientReply,b)));
}
async function replyClientSupportTicket(id,button){
  const input=document.querySelector('[data-support-client-input="'+CSS.escape(id)+'"]'),message=String(input?.value||'').trim();if(!message)return;
  if(button){button.disabled=true;button.textContent='Sending…'}
  const r=await fetch('/api/account?action=support-ticket-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,message})}),data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not send support reply.');if(button){button.disabled=false;button.textContent='Send reply'};return}
  const i=supportTicketsData.findIndex(x=>x.id===id);if(i>=0)supportTicketsData[i]=data.ticket;
  renderSupport();loadNotifications({silent:true});
}
async function submitSupportTicket(){
  const subject=document.getElementById('supportSubject')?.value.trim(),message=document.getElementById('supportMessage')?.value.trim(),priority=document.getElementById('supportPriority')?.value||'normal',status=document.getElementById('supportStatus'),btn=document.getElementById('submitSupportButton');
  if(!subject||!message){if(status)status.textContent='Add a subject and details before sending.';return}
  if(btn){btn.disabled=true;btn.textContent='Sending…'};if(status)status.textContent='';
  const r=await fetch('/api/account?action=support-ticket-create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject,message,priority})});
  const data=await r.json().catch(()=>({}));
  if(r.ok){supportTicketsData.unshift(data.ticket);document.getElementById('supportSubject').value='';document.getElementById('supportMessage').value='';if(status)status.textContent='Support request sent.';renderSupport()}
  else if(status)status.textContent=data.error||'Could not send support request.';
  if(btn){btn.disabled=false;btn.textContent='Send support request'}
}
document.getElementById('submitSupportButton')?.addEventListener('click',submitSupportTicket);

document.getElementById('editWebhookButton')?.addEventListener('click',()=>setWebhookEditing(true));
document.getElementById('cancelWebhookButton')?.addEventListener('click',()=>{webhookEditing=false;renderIntegrations()});
document.getElementById('saveWebhookButton')?.addEventListener('click',saveWebhook);
document.getElementById('insightsRange')?.addEventListener('change',renderAnalytics);
document.getElementById('saveSettingsButton')?.addEventListener('click',saveSettings);
document.getElementById('settingsEditButton')?.addEventListener('click',()=>setSettingsEditing(true));
document.getElementById('settingsCancelButton')?.addEventListener('click',()=>{settingsEditing=false;pendingBusinessLogo=String(settingsData?.logoDataUrl||'');renderSettings()});
document.getElementById('businessLogoButton')?.addEventListener('click',()=>document.getElementById('businessLogoInput')?.click());
document.getElementById('businessLogoInput')?.addEventListener('change',async e=>{const status=document.getElementById('settingsFormStatus');try{pendingBusinessLogo=await resizeBusinessLogo(e.target.files?.[0]);renderBusinessLogo();if(status){status.textContent='Logo ready — save changes to apply it.';status.className='form-status-line'}}catch(err){if(status){status.textContent=err.message||'Could not use that logo.';status.className='form-status-line error'}}e.target.value=''});
document.getElementById('businessLogoRemove')?.addEventListener('click',()=>{pendingBusinessLogo='';renderBusinessLogo()});
document.getElementById('exportWorkspaceButton')?.addEventListener('click',()=>{window.location.href='/api/account?action=workspace-export'});


let adminClientsData=[],adminSummaryData=null,currentAdminClient=null,currentAdminTech=null,adminProvisioningData=[],adminPhoneData=[],adminHealthData=[],adminReadinessData=null,adminFleetData={agents:[],automations:[]},adminSupportData=[],adminFeedbackData=[],adminFinanceData={mrr:0,recurringExpenses:0,currentMonthExpenses:0,netRecurring:0,margin:0,expenses:[],history:[]},adminPlatformData=null,adminWebsiteData={prospects:[],recentSessions:[],topPages:[],sources:[],funnel:{}},adminInboxData={gmailStatus:{configured:false,connected:false},gmail:{threads:[],analytics:{}},aliases:[],filter:'all',search:'',loading:false,lastSync:0},currentInboxItem=null,adminClientFilter='active',adminClientSearch='',adminAgentFilter='all',adminAgentSearch='',adminAutomationFilter='all',adminAutomationSearch='',adminFeedbackFilter='submitted',adminFeedbackSearch='',adminExpenseFilter='all',adminFinanceRange=6,adminCareTab='support',adminRefreshTimer=null;
async function bootstrapAdmin(){
  try{
    const [sr,cr]=await Promise.all([
      fetch('/api/account?action=admin-summary',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=admin-clients',{headers:{Accept:'application/json'},cache:'no-store'})
    ]);
    if(sr.status===401||cr.status===401){location.replace('/login?next=%2Fadmin-dashboard');return false}
    if(sr.status===403||cr.status===403){document.body.innerHTML='<main style="padding:40px;font-family:system-ui"><h1>Admin access required</h1><p>This account does not have CallerCore admin permissions.</p><a href="/dashboard">Return to client dashboard</a></main>';return false}
    if(!sr.ok||!cr.ok)throw new Error('admin bootstrap');
    adminSummaryData=(await sr.json()).summary||{};
    adminClientsData=(await cr.json()).clients||[];
    const sess=await fetch('/api/account?action=session',{headers:{Accept:'application/json'},cache:'no-store'});
    if(sess.ok){
      const data=await sess.json(),email=data.user?.email||'admin';
      const identity=document.getElementById('adminIdentity');if(identity)identity.textContent=email;
      applyUserProfile(data.user||{},data.workspace||{});
    }
    renderAdmin();await loadAdminOps();initAdminLiveRefresh();
    const qp=new URLSearchParams(location.search);
    if(qp.get('gmail')){showView('inbox');await loadAdminInbox();history.replaceState({},'',location.pathname)}
    return true;
  }catch(err){console.error('Admin bootstrap failed',err);return false}
}

async function loadAdminOps(){
  try{
    const [pr,ph,hr,fr,sr,ps,wr,fbr,fin]=await Promise.all([
      fetch('/api/account?action=admin-provisioning',{cache:'no-store'}),
      fetch('/api/account?action=admin-phone-numbers',{cache:'no-store'}),
      fetch('/api/account?action=admin-system-health',{cache:'no-store'}),
      fetch('/api/account?action=admin-fleet',{cache:'no-store'}),
      fetch('/api/account?action=admin-support',{cache:'no-store'}),
      fetch('/api/account?action=admin-platform-settings',{cache:'no-store'}),
      fetch('/api/account?action=admin-website-analytics',{cache:'no-store'}),
      fetch('/api/account?action=admin-ai-feedback',{cache:'no-store'}),
      fetch('/api/account?action=admin-finance',{cache:'no-store'})
    ]);
    setDataHealth('adminDataHealth',[pr,ph,hr,fr,sr,ps,wr,fbr,fin].some(r=>!r.ok));
    if(pr.ok)adminProvisioningData=(await pr.json()).provisioning||[];
    if(ph.ok)adminPhoneData=(await ph.json()).numbers||[];
    if(hr.ok){const health=await hr.json();adminHealthData=health.services||[];adminReadinessData=health.readiness||null;}
    if(fr.ok)adminFleetData=await fr.json();
    if(sr.ok)adminSupportData=(await sr.json()).tickets||[];
    if(ps.ok)adminPlatformData=(await ps.json()).settings||null;
    if(wr.ok)adminWebsiteData=(await wr.json()).analytics||adminWebsiteData;
    if(fbr.ok)adminFeedbackData=(await fbr.json()).feedback||[];
    if(fin.ok)adminFinanceData=(await fin.json()).finance||adminFinanceData;
  }catch(e){console.error('Admin ops load failed',e);setDataHealth('adminDataHealth',true)}
  renderProvisioning();renderPhones();renderHealth();renderWebsiteAnalytics();renderAdminFleet();renderAdminSupport();renderAdminFeedback();renderAdminFinance();renderPlatformSettings();renderAdmin();
}

function adminAgentGroup(health){
  if(health==='ready')return 'ready';
  if(health==='review')return 'review';
  if(health==='warning')return 'attention';
  return 'setup';
}
function renderAdminFleet(){
  const agents=adminFleetData.agents||[],autos=adminFleetData.automations||[],set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  const agentRows=agents.map(x=>{
    const agent=x.agent||null,phone=adminPhoneFor(x.workspaceId),health=agent?.health||(agent?(phone?'ready':'setup'):'missing'),group=adminAgentGroup(health);
    const issue=agent?.issue||(!agent?'No AI receptionist configuration exists yet.':(!phone?'Phone routing is not assigned yet.':'Configuration looks ready.'));
    const tone=group==='ready'?'green':group==='attention'?'red':'amber',label=({ready:'Ready',review:'Needs review',warning:'Attention',setup:'Setup',test:'Client test',missing:'Missing'})[health]||'Review';
    return {...x,agent,phone,health,group,issue,tone,label};
  });
  set('agentReadyCount',agentRows.filter(x=>x.group==='ready').length);
  set('agentReviewCount',agentRows.filter(x=>x.group==='review').length);
  set('agentAttentionCount',agentRows.filter(x=>x.group==='attention').length);
  set('agentSetupCount',agentRows.filter(x=>x.group==='setup').length);
  const ag=document.getElementById('adminAgentsGrid'),agentSearch=document.getElementById('adminAgentSearch'),agentFilter=document.getElementById('adminAgentHealthFilter');
  if(agentSearch){agentSearch.value=adminAgentSearch;agentSearch.oninput=()=>{adminAgentSearch=agentSearch.value;renderAdminFleet()}}
  if(agentFilter){agentFilter.value=adminAgentFilter;agentFilter.onchange=()=>{adminAgentFilter=agentFilter.value;renderAdminFleet()}}
  const visibleAgents=agentRows.filter(x=>{
    if(adminAgentFilter!=='all'&&x.group!==adminAgentFilter)return false;
    const q=adminAgentSearch.trim().toLowerCase();if(!q)return true;
    return [x.workspaceName,x.agent?.name,x.agent?.role,x.issue,x.phone?.number].filter(Boolean).join(' ').toLowerCase().includes(q);
  });
  if(ag){
    ag.innerHTML=visibleAgents.map(x=>'<article class="panel integration-card admin-agent-card" data-admin-agent-client="'+esc(x.workspaceId)+'"><div><div class="admin-agent-title"><b>'+esc((x.agent?.name||'Not configured')+' · '+x.workspaceName)+'</b><span class="tag '+x.tone+'">'+esc(x.label)+'</span></div><p>'+esc(x.agent?.role||'AI receptionist not configured')+(x.phone?' · '+esc(x.phone.number||'Phone assigned'):' · Phone not assigned')+'</p><small>'+esc(x.issue)+'</small></div><button class="admin-link" type="button">Open account →</button></article>').join('');
    ag.querySelectorAll('[data-admin-agent-client]').forEach(card=>card.addEventListener('click',()=>openAdminClient(card.dataset.adminAgentClient)));
    document.getElementById('adminAgentsEmpty').hidden=visibleAgents.length!==0;
  }

  const configured=autos.filter(x=>x.total>0),fully=configured.filter(x=>x.enabled===x.total),partial=configured.filter(x=>x.enabled>0&&x.enabled<x.total),off=autos.filter(x=>x.enabled===0);
  set('automationConfiguredWorkspaces',configured.length);set('automationFullyCovered',fully.length);set('automationPartial',partial.length);set('automationOff',off.length);
  const automationSearch=document.getElementById('adminAutomationSearch'),automationFilter=document.getElementById('adminAutomationFilter');
  if(automationSearch){automationSearch.value=adminAutomationSearch;automationSearch.oninput=()=>{adminAutomationSearch=automationSearch.value;renderAdminFleet()}}
  if(automationFilter){automationFilter.value=adminAutomationFilter;automationFilter.onchange=()=>{adminAutomationFilter=automationFilter.value;renderAdminFleet()}}
  const aq=adminAutomationSearch.trim().toLowerCase(),visibleAutos=autos.filter(x=>{
    const state=x.total>0&&x.enabled===x.total?'covered':x.enabled>0?'partial':'off';
    if(adminAutomationFilter!=='all'&&state!==adminAutomationFilter)return false;
    return !aq||String(x.workspaceName||'').toLowerCase().includes(aq);
  });
  const aw=document.getElementById('adminAutomationGrid');if(aw){
    aw.innerHTML=visibleAutos.map(x=>{const state=x.total>0&&x.enabled===x.total?'covered':x.enabled>0?'partial':'off',tone=state==='covered'?'green':state==='partial'?'amber':'red',label=state==='covered'?'Fully covered':state==='partial'?'Partial':'None / off';return '<article class="panel integration-card admin-automation-card" data-automation-client="'+esc(x.workspaceId)+'"><div><b>'+esc(x.workspaceName)+'</b><p>'+x.enabled+' enabled of '+x.total+' configured</p><small>'+esc(x.plan)+' plan</small></div><span class="tag '+tone+'">'+label+'</span></article>'}).join('');
    const empty=document.getElementById('adminAutomationsEmpty');if(empty)empty.hidden=visibleAutos.length!==0;
    aw.querySelectorAll('[data-automation-client]').forEach(card=>card.addEventListener('click',()=>openAdminClient(card.dataset.automationClient)));
  }
}
function renderAdminFeedback(){
  const list=document.getElementById('adminFeedbackList'),empty=document.getElementById('adminFeedbackEmpty'),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  const items=[...(adminFeedbackData||[])].sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
  set('adminFeedbackOpen',items.filter(x=>x.status==='submitted').length);set('adminFeedbackReviewed',items.filter(x=>x.status==='reviewed').length);set('adminFeedbackApplied',items.filter(x=>x.status==='applied').length);set('adminFeedbackCalls',items.filter(x=>x.source==='call').length);
  const search=document.getElementById('adminFeedbackSearch'),filter=document.getElementById('adminFeedbackFilter');
  if(search){search.value=adminFeedbackSearch;search.oninput=()=>{adminFeedbackSearch=search.value;renderAdminFeedback()}}
  if(filter){filter.value=adminFeedbackFilter;filter.onchange=()=>{adminFeedbackFilter=filter.value;renderAdminFeedback()}}
  const q=adminFeedbackSearch.trim().toLowerCase(),visible=items.filter(x=>(adminFeedbackFilter==='all'||x.status===adminFeedbackFilter)&&(!q||[x.workspaceName,x.workspaceId,x.category,x.message,x.context,x.source].filter(Boolean).join(' ').toLowerCase().includes(q)));
  if(list){list.classList.add('admin-feedback-list');list.innerHTML=visible.map(x=>'<article class="admin-feedback-card" id="feedback-'+esc(x.id)+'"><div class="admin-feedback-card-head"><div><b>'+esc(x.workspaceName||x.workspaceId||'Client workspace')+'</b><small>'+esc(x.source==='call'?'Call-specific client feedback':'AI receptionist feedback')+(x.context?' · '+esc(x.context):'')+' · '+(x.createdAt?new Date(x.createdAt).toLocaleString():'')+'</small></div><span class="feedback-status '+esc(x.status||'submitted')+'">'+esc(feedbackStatusLabel(x.status))+'</span></div><p><b>'+esc((x.category||'feedback').replaceAll('_',' '))+'</b> · '+esc(x.message||'')+'</p><div class="feedback-admin-actions"><select data-admin-feedback-status="'+esc(x.id)+'">'+['submitted','reviewed','applied','dismissed'].map(s=>'<option value="'+s+'" '+(x.status===s?'selected':'')+'>'+feedbackStatusLabel(s)+'</option>').join('')+'</select>'+(x.workspaceId?'<button class="admin-link" data-feedback-client="'+esc(x.workspaceId)+'">Open client →</button>':'')+'</div></article>').join('')}
  if(empty)empty.hidden=visible.length!==0;
  list?.querySelectorAll('[data-admin-feedback-status]').forEach(sel=>sel.addEventListener('change',()=>updateAdminFeedback(sel.dataset.adminFeedbackStatus,sel.value)));
  list?.querySelectorAll('[data-feedback-client]').forEach(btn=>btn.addEventListener('click',()=>openAdminClient(btn.dataset.feedbackClient)));
  renderClientCareTabs();
}
async function updateAdminFeedback(id,status){
  const item=adminFeedbackData.find(x=>x.id===id);if(!item)return;const before=item.status;item.status=status;item.updatedAt=Date.now();renderAdminFeedback();
  try{const r=await fetch('/api/account?action=admin-ai-feedback-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not update feedback.');Object.assign(item,data.feedback||{});renderAdminFeedback();loadNotifications({silent:true})}
  catch(err){item.status=before;renderAdminFeedback();alert(err.message||'Could not update feedback.')}
}

function renderWebsiteAnalytics(){
  const d=adminWebsiteData||{},set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('webSessions',Number(d.sessions||0).toLocaleString());set('webVisitors',Number(d.visitors||0).toLocaleString()+' unique visitors');
  set('webPageViews',Number(d.pageViews||0).toLocaleString());set('webBounce',Number(d.bounceRate||0)+'% bounce');
  set('webEngagement',formatDuration(Number(d.avgActiveSeconds||0)));set('webConversions',Number(d.conversions||0).toLocaleString());
  const rate=d.sessions?Math.round((Number(d.conversions||0)/Number(d.sessions))*1000)/10:0;set('webConversionRate',rate+'% session conversion');
  const f=d.funnel||{},funnel=document.getElementById('websiteFunnel');
  if(funnel){
    const rows=[['Sessions',f.visitors||0],['Get Started viewed',f.getStarted||0],['Form started',f.formStarted||0],['Checkout started',f.checkoutStarted||0],['Converted',f.converted||0]],base=Math.max(1,Number(f.visitors||0));
    funnel.innerHTML=rows.map(([label,n],i)=>'<div class="funnel-row"><div><b>'+esc(label)+'</b><span>'+Number(n).toLocaleString()+'</span></div><i style="width:'+Math.max(n?4:0,Math.min(100,(Number(n)/base)*100))+'%"></i>'+(i?'<small>'+Math.round((Number(n)/base)*100)+'% of sessions</small>':'')+'</div>').join('');
  }
  const intent=document.getElementById('websiteIntentMetrics');if(intent)intent.innerHTML=[['Contact inquiries',Number(d.contactInquiries||0).toLocaleString()],['Chat sessions',Number(d.chatSessions||0).toLocaleString()],['Checkout starts',Number(d.checkoutStarts||0).toLocaleString()],['Conversions',Number(d.conversions||0).toLocaleString()],['Attributed MRR',money(Number(d.attributedMrr||0))],['Setup revenue',money(Number(d.attributedSetupRevenue||0))]].map(([k,v])=>'<div><b>'+esc(String(v))+'</b><span>'+esc(k)+'</span></div>').join('');
  const pages=document.getElementById('websiteTopPages');if(pages)pages.innerHTML=(d.topPages||[]).map(x=>'<div class="rank-row"><b>'+esc(x.path)+'</b><span>'+Number(x.count).toLocaleString()+' views · '+formatDuration(x.avgSeconds||0)+' avg</span></div>').join('')||'<p class="muted">No page views yet.</p>';
  const sources=document.getElementById('websiteSources');if(sources)sources.innerHTML=(d.sources||[]).map(x=>'<div class="rank-row"><b>'+esc(x.source)+'</b><span>'+Number(x.count).toLocaleString()+' sessions'+(x.conversions?' · '+Number(x.conversions).toLocaleString()+' customer'+(Number(x.conversions)===1?'':'s')+' · '+money(Number(x.mrr||0))+' MRR':'')+'</span></div>').join('')||'<p class="muted">No acquisition data yet.</p>';
  const journeys=document.getElementById('websiteJourneyList'),je=document.getElementById('websiteJourneyEmpty'),sessions=d.recentSessions||[];
  if(journeys)journeys.innerHTML=sessions.map(s=>{
    const loc=[s.city,s.region,s.country].filter(Boolean).join(', '),source=s.utmSource||s.source||'direct';
    const steps=(s.journey||[]).filter(e=>!['engagement'].includes(e.type)).slice(-12).map(e=>'<span><b>'+esc(e.type.replaceAll('_',' '))+'</b>'+esc(e.path||e.label||'')+(e.activeMs?' · '+formatDuration(Math.round(e.activeMs/1000)):'')+'</span>').join('');
    return '<article class="journey-card"><div class="journey-head"><div><b>'+esc(source)+'</b><small>'+new Date(s.firstAt).toLocaleString()+' · '+esc(s.device||'device')+(loc?' · '+esc(loc):'')+'</small></div><span class="tag">'+formatDuration(Math.round(Number(s.activeMs||0)/1000))+'</span></div><div class="journey-steps">'+steps+'</div></article>'
  }).join('');
  if(je)je.hidden=sessions.length!==0;
  const prospects=document.getElementById('websiteProspectList'),pe=document.getElementById('websiteProspectEmpty'),pros=d.prospects||[];
  if(prospects)prospects.innerHTML=pros.slice(0,50).map(p=>'<article class="website-prospect-card" data-website-prospect-id="'+esc(p.id)+'"><div class="prospect-row"><div><b>'+esc(p.name||p.business||p.email||'Website prospect')+'</b><small>'+esc([p.business,p.email,p.phone].filter(Boolean).join(' · '))+'</small></div><span>'+esc(p.source||'website')+'</span><span>'+esc(p.plan||p.category||p.industry||'—')+'</span><select class="prospect-stage" data-prospect-stage="'+esc(p.id)+'">'+['new','inquiry','checkout_started','follow_up','qualified','lost','converted'].map(s=>'<option value="'+s+'" '+(p.stage===s?'selected':'')+'>'+s.replaceAll('_',' ')+'</option>').join('')+'</select></div><details><summary>View lead details</summary><div class="prospect-detail-grid"><div><span>Contact</span><b>'+esc([p.email,p.phone].filter(Boolean).join(' · ')||'Not provided')+'</b></div><div><span>Attribution</span><b>'+esc([p.utmSource,p.utmMedium,p.utmCampaign].filter(Boolean).join(' / ')||p.source||'direct')+'</b></div><div class="full"><span>Inquiry / message</span><p>'+esc(p.message||'No message submitted.')+'</p></div>'+(p.notes?'<div class="full"><span>Admin notes</span><p>'+esc(p.notes)+'</p></div>':'')+'</div></details></article>').join('');
  if(pe)pe.hidden=pros.length!==0;
  prospects?.querySelectorAll('[data-prospect-stage]').forEach(sel=>sel.addEventListener('change',()=>updateWebsiteProspect(sel.dataset.prospectStage,sel.value)));
}
function formatDuration(seconds){seconds=Math.max(0,Math.round(Number(seconds||0)));if(seconds<60)return seconds+'s';const m=Math.floor(seconds/60),s=seconds%60;return m+'m '+(s?s+'s':'')}
async function updateWebsiteProspect(id,stage){
  const r=await fetch('/api/account?action=admin-website-prospect-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,stage})}),data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not update website prospect.');return}
  const p=(adminWebsiteData.prospects||[]).find(x=>x.id===id);if(p)Object.assign(p,data.prospect);
  renderWebsiteAnalytics();renderAdminFleet();
}

async function loadAdminInbox({silent=false,force=false}={}){
  if(adminInboxData.loading)return;
  adminInboxData.loading=true;
  const refresh=document.getElementById('inboxRefreshButton'),auto=document.getElementById('inboxAutoStatus');
  if(refresh&&!silent){refresh.disabled=true;refresh.textContent='Syncing…'}
  try{
    const sr=await fetch('/api/account?action=admin-gmail-status',{headers:{Accept:'application/json'},cache:'no-store'});
    if(sr.ok)adminInboxData.gmailStatus=await sr.json();
    if(!adminInboxData.gmailStatus.connected){
      adminInboxData.gmail={threads:[],analytics:{}};adminInboxData.aliases=[];adminInboxData.loading=false;
      if(refresh){refresh.disabled=false;refresh.textContent='Refresh inbox'}renderAdminInbox();return;
    }

    // Render the last good Gmail snapshot immediately. Never blank the inbox while Google refreshes.
    if(!force){
      const [cachedInbox,cachedAliases]=await Promise.all([
        fetch('/api/account?action=admin-gmail-inbox&cached=1',{headers:{Accept:'application/json'},cache:'no-store'}),
        fetch('/api/account?action=admin-gmail-aliases&cached=1',{headers:{Accept:'application/json'},cache:'no-store'})
      ]);
      if(cachedInbox.ok){
        const d=await cachedInbox.json();
        if(!d.emptyCache&&Array.isArray(d.threads)){adminInboxData.gmail=d;adminInboxData.lastSync=Number(d.syncedAt||adminInboxData.lastSync||0)}
      }
      if(cachedAliases.ok){const d=await cachedAliases.json();if(Array.isArray(d.aliases)&&d.aliases.length)adminInboxData.aliases=d.aliases}
      renderAdminInbox();
      if(auto)auto.textContent='Updating in background…'+(adminInboxData.lastSync?' · last '+new Date(adminInboxData.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'');
    }else if(auto)auto.textContent='Syncing with Gmail…';

    adminInboxData.loading=false;
    refreshAdminInboxLive({silent});
    return;
  }catch(e){
    console.error('Inbox cache load failed',e);adminInboxData.loading=false;
    if(refresh){refresh.disabled=false;refresh.textContent='Refresh inbox'}
    if(auto)auto.textContent='Auto-sync · 3 min';
    renderAdminInbox();
  }
}
async function refreshAdminInboxLive({silent=true,force=false}={}){
  if(adminInboxData.liveLoading)return;
  adminInboxData.liveLoading=true;
  const refresh=document.getElementById('inboxRefreshButton'),auto=document.getElementById('inboxAutoStatus');
  if(refresh&&!silent){refresh.disabled=true;refresh.textContent='Syncing…'}
  if(auto)auto.textContent='Syncing with Gmail…';
  try{
    const gr=await fetch('/api/account?action=admin-gmail-inbox&limit=25'+(force?'&force=1':''),{headers:{Accept:'application/json'},cache:'no-store'});
    if(gr.ok){
      const d=await gr.json();
      if(Array.isArray(d.threads)){adminInboxData.gmail=d;adminInboxData.lastSync=Number(d.syncedAt||Date.now())}
    }
    if(!(adminInboxData.aliases||[]).length){
      const ar=await fetch('/api/account?action=admin-gmail-aliases',{headers:{Accept:'application/json'},cache:'no-store'});
      if(ar.ok){const d=await ar.json();if(Array.isArray(d.aliases))adminInboxData.aliases=d.aliases}
    }
    renderAdminInbox();
    if(currentInboxItem?.kind==='gmail'){
      const t=(adminInboxData.gmail?.threads||[]).find(x=>x.id===currentInboxItem.id);
      if(t){currentInboxItem={kind:'gmail',id:t.id,thread:t,prospect:t.prospect||null,messages:t.messages||[]};renderInboxThread()}
    }
  }catch(e){console.error('Live Gmail sync failed',e)}
  finally{
    adminInboxData.liveLoading=false;
    if(refresh){refresh.disabled=false;refresh.textContent='Refresh inbox'}
    if(auto)auto.textContent='Auto-sync · 3 min'+(adminInboxData.lastSync?' · '+new Date(adminInboxData.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'');
  }
}
function websiteInboxItems(){
  return (adminWebsiteData.prospects||[]).filter(p=>p.message||['contact','chatbot'].includes(p.source)).map(p=>({
    kind:'website',id:p.id,title:p.name||p.business||p.email||'Website inquiry',subject:p.category||'Website inquiry',
    preview:p.message||'',at:p.updatedAt||p.createdAt||0,email:p.email||'',prospect:p
  }));
}
function gmailInboxItems(){
  return (adminInboxData.gmail?.threads||[]).map(t=>{
    const inbound=[...(t.messages||[])].reverse().find(m=>m.direction==='inbound'),last=t.last||t.messages?.[t.messages.length-1]||{};
    return {kind:'gmail',id:t.id,title:inbound?.from||last.from||last.to||'Gmail thread',subject:t.subject||last.subject||'(no subject)',preview:last.snippet||last.body||'',at:t.lastAt||0,unread:!!t.unread,thread:t,prospect:t.prospect||null}
  });
}
function renderAdminInbox(){
  const st=adminInboxData.gmailStatus||{},ga=adminInboxData.gmail?.analytics||{},website=websiteInboxItems(),gmail=gmailInboxItems(),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('inboxWebsiteCount',website.length);set('inboxGmailUnread',ga.unread||0);set('inboxGmailAccount',st.connected?(st.gmailEmail||'Connected'):(st.configured?'Not connected':'OAuth setup required'));
  set('inboxResponseTime',ga.avgFirstResponseSeconds?formatDuration(ga.avgFirstResponseSeconds):'—');set('inboxThreadCount',website.length+gmail.length);
  const connect=document.getElementById('gmailConnectButton'),disconnect=document.getElementById('gmailDisconnectButton'),title=document.getElementById('gmailStatusTitle'),copy=document.getElementById('gmailStatusCopy'),aliasList=document.getElementById('gmailAliasList');
  if(connect){connect.hidden=!!st.connected;connect.textContent=st.configured?'Connect Gmail':'Set up Gmail OAuth'}
  if(disconnect)disconnect.hidden=!st.connected;
  if(title)title.textContent=st.connected?'Gmail connected':st.configured?'Gmail ready to connect':'Gmail OAuth setup required';
  if(copy)copy.textContent=st.connected?('Connected as '+(st.gmailEmail||'Gmail')+'. '+Number(ga.inbound||0)+' received · '+Number(ga.outbound||0)+' sent in the loaded 30-day view. Threads remain in Google and sync into this inbox.'):st.configured?'Authorize the Gmail account you want CallerCore Admin to use.':'Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and CALLERCORE_ENCRYPTION_KEY in Vercel before connecting.';
  if(aliasList)aliasList.innerHTML=(adminInboxData.aliases||[]).map(a=>'<span class="gmail-alias-chip '+(a.inboundSeen?'ok':'warn')+'"><b>'+esc(a.email)+'</b><small>'+(a.isPrimary?'Primary':(a.verificationStatus==='accepted'?'Send as verified':'Pending'))+' · '+(a.inboundSeen?'Inbound seen':'No inbound seen yet')+'</small></span>').join('');
  let items=[...website,...gmail].sort((a,b)=>b.at-a.at);
  if(adminInboxData.filter!=='all')items=items.filter(x=>x.kind===adminInboxData.filter);
  const q=String(adminInboxData.search||'').toLowerCase();if(q)items=items.filter(x=>(x.title+' '+x.subject+' '+x.preview).toLowerCase().includes(q));
  const list=document.getElementById('inboxList'),empty=document.getElementById('inboxEmpty');
  if(list)list.innerHTML=items.map(x=>'<button class="inbox-item '+(currentInboxItem?.kind===x.kind&&currentInboxItem?.id===x.id?'active':'')+'" data-inbox-kind="'+x.kind+'" data-inbox-id="'+esc(x.id)+'"><span class="inbox-source '+x.kind+'">'+(x.kind==='gmail'?'Gmail':'Website')+'</span><div><b>'+esc(x.title)+'</b><strong>'+esc(x.subject)+'</strong><p>'+esc(String(x.preview||'').slice(0,150))+'</p><small>'+new Date(x.at||Date.now()).toLocaleString()+(x.unread?' · unread':'')+'</small></div></button>').join('');
  if(empty)empty.hidden=items.length!==0;
  list?.querySelectorAll('[data-inbox-id]').forEach(b=>b.addEventListener('click',()=>openInboxItem(b.dataset.inboxKind,b.dataset.inboxId)));
  document.querySelectorAll('[data-inbox-filter]').forEach(b=>b.classList.toggle('active',b.dataset.inboxFilter===adminInboxData.filter));
}
async function openInboxItem(kind,id){
  if(kind==='website'){
    const r=await fetch('/api/account?action=admin-website-conversation&id='+encodeURIComponent(id),{cache:'no-store'}),data=await r.json().catch(()=>({}));
    if(!r.ok){alert(data.error||'Could not load website conversation.');return}
    currentInboxItem={kind,id,prospect:data.prospect,messages:data.messages||[]};
  }else{
    const thread=(adminInboxData.gmail?.threads||[]).find(x=>x.id===id);if(!thread)return;
    currentInboxItem={kind,id,thread,prospect:thread.prospect||null,messages:thread.messages||[]};
    if(thread.unread){
      fetch('/api/account?action=admin-gmail-read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({threadId:id})}).catch(()=>{});
      thread.unread=false;if(adminInboxData.gmail?.analytics?.unread>0)adminInboxData.gmail.analytics.unread--;
    }
  }
  renderInboxThread();renderAdminInbox();
}
function preferredInboxFrom(){
  const aliases=adminInboxData.aliases||[];if(!aliases.length)return '';
  if(currentInboxItem?.kind==='gmail'){
    const inbound=[...(currentInboxItem.messages||[])].reverse().find(m=>m.direction==='inbound');
    const sentTo=String(inbound?.to||'').toLowerCase();
    const match=aliases.find(a=>a.email===sentTo&&(a.isPrimary||a.verificationStatus==='accepted'));if(match)return match.email;
  }
  const support=aliases.find(a=>a.email==='support@callercore.com'&&(a.isPrimary||a.verificationStatus==='accepted'));if(support)return support.email;
  return (aliases.find(a=>a.isDefault&&(a.isPrimary||a.verificationStatus==='accepted'))||aliases.find(a=>a.isPrimary)||aliases.find(a=>a.verificationStatus==='accepted')||{}).email||'';
}
function renderInboxFromOptions(){
  const sel=document.getElementById('inboxFromSelect'),hint=document.getElementById('inboxFromHint');if(!sel)return;
  const aliases=(adminInboxData.aliases||[]).filter(a=>a.isPrimary||a.verificationStatus==='accepted'),preferred=preferredInboxFrom(),current=sel.value;
  sel.innerHTML=aliases.map(a=>'<option value="'+esc(a.email)+'" '+((current||preferred)===a.email?'selected':'')+'>'+esc((a.displayName?a.displayName+' · ':'')+a.email)+'</option>').join('');
  if(hint)hint.textContent=aliases.length>1?'Choose which CallerCore address the recipient sees.':(aliases[0]?.email||'');
}
function renderInboxThread(){
  const ph=document.getElementById('inboxThreadPlaceholder'),wrap=document.getElementById('inboxThread');if(!ph||!wrap)return;
  if(!currentInboxItem){ph.hidden=false;wrap.hidden=true;return}
  ph.hidden=true;wrap.hidden=false;
  const website=currentInboxItem.kind==='website',p=currentInboxItem.prospect||{},messages=currentInboxItem.messages||[],last=messages[messages.length-1]||{};
  const subject=website?(p.category||'Website inquiry'):(currentInboxItem.thread?.subject||last.subject||'Gmail thread');
  const contact=website?(p.email||p.phone||'Website visitor'):([...(messages||[])].reverse().find(m=>m.direction==='inbound')?.from||last.from||last.to||'Gmail contact');
  document.getElementById('inboxThreadChannel').textContent=website?(p.source==='chatbot'?'Website · Chatbot':'Website · Contact'):'Gmail';
  document.getElementById('inboxThreadSubject').textContent=subject;
  document.getElementById('inboxThreadMeta').textContent=contact+(p.business?' · '+p.business:'');
  const lead=document.getElementById('inboxThreadLead');if(lead)lead.textContent=p.stage?('Lead · '+p.stage.replaceAll('_',' ')):(currentInboxItem.prospect?'Linked lead':'Email');
  const box=document.getElementById('inboxMessages');
  if(box)box.innerHTML=messages.map(m=>'<div class="inbox-message '+(m.direction==='outbound'?'outbound':'inbound')+'"><div><b>'+(m.direction==='outbound'?'You':esc(m.from||p.email||'Visitor'))+'</b><small>'+new Date(m.at||Date.now()).toLocaleString()+' · '+esc(m.channel||currentInboxItem.kind)+'</small></div><p>'+esc(m.body||m.snippet||'')+'</p></div>').join('');
  if(box)box.scrollTop=box.scrollHeight;
  const reply=document.getElementById('inboxReplyText');if(reply)reply.value='';
  renderInboxFromOptions();
  const status=document.getElementById('inboxReplyStatus');if(status)status.textContent='';
}
async function sendInboxReply(e){
  e?.preventDefault();if(!currentInboxItem)return;
  const field=document.getElementById('inboxReplyText'),status=document.getElementById('inboxReplyStatus'),btn=document.querySelector('#inboxReplyForm button[type="submit"]'),message=String(field?.value||'').trim(),from=String(document.getElementById('inboxFromSelect')?.value||'').trim().toLowerCase();
  if(!message)return;if(btn){btn.disabled=true;btn.textContent='Sending…'}if(status)status.textContent='';
  try{
    if(currentInboxItem.kind==='website'){
      const r=await fetch('/api/account?action=admin-website-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentInboxItem.id,message,from})}),data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Could not send reply');
      currentInboxItem.messages.push(data.message);currentInboxItem.prospect=data.prospect;
      const p=(adminWebsiteData.prospects||[]).find(x=>x.id===currentInboxItem.id);if(p)Object.assign(p,data.prospect);
    }else{
      const msgs=currentInboxItem.messages||[],inbound=[...msgs].reverse().find(m=>m.direction==='inbound'),last=msgs[msgs.length-1]||{},to=inbound?.from||last.from;
      if(!to)throw new Error('No Gmail recipient found');
      const subject=/^re:/i.test(currentInboxItem.thread.subject||'')?(currentInboxItem.thread.subject):'Re: '+(currentInboxItem.thread.subject||'CallerCore');
      const refs=msgs.map(m=>m.messageId).filter(Boolean).join(' ');
      const r=await fetch('/api/account?action=admin-gmail-send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,subject,body:message,from,threadId:currentInboxItem.id,inReplyTo:last.messageId||'',references:refs})}),data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Could not send Gmail reply');
      await loadAdminInbox();
      const t=(adminInboxData.gmail?.threads||[]).find(x=>x.id===(data.threadId||currentInboxItem.id));if(t){currentInboxItem={kind:'gmail',id:t.id,thread:t,prospect:t.prospect||null,messages:t.messages||[]}}
    }
    if(status)status.textContent='Reply sent.';renderInboxThread();renderAdminInbox();renderWebsiteAnalytics();renderAdminFleet();
  }catch(err){if(status)status.textContent=err.message||'Could not send reply'}
  finally{if(btn){btn.disabled=false;btn.textContent='Send reply'}}
}
async function connectGmail(){
  if(!adminInboxData.gmailStatus?.configured){alert('Gmail OAuth needs three Vercel environment variables first: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and CALLERCORE_ENCRYPTION_KEY.');return}
  const r=await fetch('/api/account?action=admin-gmail-connect',{method:'POST'}),data=await r.json().catch(()=>({}));if(!r.ok){alert(data.error||'Could not start Gmail connection.');return}location.href=data.url;
}
async function disconnectGmailAdmin(){
  if(!confirm('Disconnect Gmail from CallerCore Admin? No messages will be deleted from Gmail.'))return;
  const r=await fetch('/api/account?action=admin-gmail-disconnect',{method:'POST'});if(!r.ok)return alert('Could not disconnect Gmail.');currentInboxItem=null;await loadAdminInbox();renderInboxThread();
}
document.getElementById('inboxRefreshButton')?.addEventListener('click',()=>refreshAdminInboxLive({silent:false,force:true}));
document.getElementById('gmailConnectButton')?.addEventListener('click',connectGmail);
document.getElementById('gmailDisconnectButton')?.addEventListener('click',disconnectGmailAdmin);
document.getElementById('inboxReplyForm')?.addEventListener('submit',sendInboxReply);
document.getElementById('inboxSearch')?.addEventListener('input',e=>{adminInboxData.search=e.target.value||'';renderAdminInbox()});
document.querySelectorAll('[data-inbox-filter]').forEach(b=>b.addEventListener('click',()=>{adminInboxData.filter=b.dataset.inboxFilter;renderAdminInbox()}));
setInterval(()=>{
  if(document.body.dataset.dashboard!=='admin'||document.hidden)return;
  const view=document.getElementById('view-inbox');
  if(view?.classList.contains('active'))refreshAdminInboxLive({silent:true});
},180000);


function renderAdminSupport(){
  const tickets=adminSupportData||[],set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('supportOpen',tickets.filter(x=>x.status==='open').length);set('supportProgress',tickets.filter(x=>x.status==='in_progress').length);set('supportResolved',tickets.filter(x=>x.status==='resolved').length);set('supportUrgent',tickets.filter(x=>x.priority==='urgent'&&x.status!=='resolved').length);
  const wrap=document.getElementById('adminSupportList');if(!wrap)return;
  wrap.innerHTML=tickets.map(t=>{
    const messages=(Array.isArray(t.messages)&&t.messages.length?t.messages:[{direction:'client',from:t.email||'',body:t.message||'',at:t.createdAt||Date.now()}]);
    const thread=messages.map(m=>'<div class="support-message '+(m.direction==='support'?'support':'client')+'"><div><b>'+(m.direction==='support'?'CallerCore Support':esc(t.workspaceName||'Client'))+'</b><small>'+new Date(m.at||Date.now()).toLocaleString()+'</small></div><p>'+esc(m.body||'').replace(/\n/g,'<br>')+'</p></div>').join('');
    return '<details class="support-admin-thread" data-support-ticket-id="'+esc(t.id)+'"><summary><div><b>'+esc(t.subject)+'</b><small>'+esc(t.workspaceName||'Workspace')+' · '+esc(t.email||'')+' · '+new Date(t.createdAt).toLocaleString()+'</small></div><div><span class="tag '+(t.priority==='urgent'?'red':'')+'">'+esc(t.priority||'normal')+'</span><select class="support-status-select" data-ticket-status="'+esc(t.id)+'"><option value="open" '+(t.status==='open'?'selected':'')+'>Open</option><option value="in_progress" '+(t.status==='in_progress'?'selected':'')+'>In progress</option><option value="resolved" '+(t.status==='resolved'?'selected':'')+'>Resolved</option></select></div></summary><div class="support-thread-messages">'+thread+'</div><div class="support-reply-box"><textarea data-support-admin-input="'+esc(t.id)+'" placeholder="Reply to the client…"></textarea><button class="primary" type="button" data-support-admin-reply="'+esc(t.id)+'">Send reply</button></div></details>';
  }).join('');
  const empty=document.getElementById('adminSupportEmpty');if(empty)empty.hidden=tickets.length!==0;
  wrap.querySelectorAll('[data-ticket-status]').forEach(s=>s.addEventListener('change',e=>{e.stopPropagation();updateSupportStatus(s.dataset.ticketStatus,s.value)}));
  wrap.querySelectorAll('[data-support-admin-reply]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();replyAdminSupportTicket(b.dataset.supportAdminReply,b)}));
}
function renderClientCareTabs(){
  document.querySelectorAll('[data-care-tab]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.careTab===adminCareTab);btn.onclick=()=>{adminCareTab=btn.dataset.careTab||'support';renderClientCareTabs()}});
  const support=document.getElementById('clientCareSupportPane'),feedback=document.getElementById('clientCareFeedbackPane');if(support)support.hidden=adminCareTab!=='support';if(feedback)feedback.hidden=adminCareTab!=='feedback';
}
function openClientCare(tab='support'){adminCareTab=tab;showView('client-care');renderClientCareTabs()}
async function replyAdminSupportTicket(id,button){
  const input=document.querySelector('[data-support-admin-input="'+CSS.escape(id)+'"]'),message=String(input?.value||'').trim();if(!message)return;
  if(button){button.disabled=true;button.textContent='Sending…'}
  const r=await fetch('/api/account?action=admin-support-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,message})}),data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not send support reply.');if(button){button.disabled=false;button.textContent='Send reply'};return}
  const i=adminSupportData.findIndex(x=>x.id===id);if(i>=0)adminSupportData[i]=data.ticket;
  renderAdminSupport();loadNotifications({silent:true});
}
async function updateSupportStatus(id,status){
  const r=await fetch('/api/account?action=admin-support-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});if(!r.ok)return;
  const t=adminSupportData.find(x=>x.id===id);if(t)t.status=status;renderAdminSupport();
}
function renderPlatformSettings(){
  if(!adminPlatformData)return;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v};
  set('platformAgentName',adminPlatformData.defaultAgentName||'Maya');set('platformTimezone',adminPlatformData.defaultTimezone||'America/Los_Angeles');set('platformSupportEmail',adminPlatformData.supportEmail||'');
  const mm=document.getElementById('platformMaintenanceMode');if(mm)mm.checked=!!adminPlatformData.maintenanceMode;
  const gates=adminPlatformData.launchGates||{},gateMap={launchGatePreviewIsolation:'previewIsolation',launchGateDisposableE2E:'disposableE2E',launchGateVoiceLifecycle:'voiceLifecycle',launchGateProductionEnvScope:'productionEnvScope',launchGateSupportEmail:'supportEmail',launchGateBusinessTax:'businessTax',launchGateLegalReview:'legalReview'};
  Object.entries(gateMap).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.checked=!!gates[key]});
}
async function savePlatformSettings(){
  const emailEl=document.getElementById('platformSupportEmail'),agentEl=document.getElementById('platformAgentName'),status=document.getElementById('platformSettingsFormStatus'),btn=document.getElementById('savePlatformSettings');
  const email=String(emailEl?.value||'').trim(),agentName=String(agentEl?.value||'').trim(),badEmail=email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  settingsFieldError('platformSupportEmail',badEmail?'Enter a valid support email.':'');
  settingsFieldError('platformAgentName',!agentName?'Enter a default agent name.':'');
  if(badEmail||!agentName){if(status){status.textContent='Please correct the highlighted fields.';status.className='form-status-line error'};return}
  const payload={defaultAgentName:agentName,defaultTimezone:document.getElementById('platformTimezone')?.value||'America/Los_Angeles',supportEmail:email,maintenanceMode:!!document.getElementById('platformMaintenanceMode')?.checked,launchGates:{previewIsolation:!!document.getElementById('launchGatePreviewIsolation')?.checked,disposableE2E:!!document.getElementById('launchGateDisposableE2E')?.checked,voiceLifecycle:!!document.getElementById('launchGateVoiceLifecycle')?.checked,productionEnvScope:!!document.getElementById('launchGateProductionEnvScope')?.checked,supportEmail:!!document.getElementById('launchGateSupportEmail')?.checked,businessTax:!!document.getElementById('launchGateBusinessTax')?.checked,legalReview:!!document.getElementById('launchGateLegalReview')?.checked}};
  if(btn){btn.disabled=true;btn.textContent='Saving…'}if(status){status.textContent='';status.className='form-status-line'}
  try{
    const r=await fetch('/api/account?action=admin-platform-settings-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Could not save platform settings.');
    adminPlatformData=data.settings;if(status){status.textContent='Platform settings saved.';status.className='form-status-line success'}
    const tag=document.getElementById('platformSettingsStatus');if(tag){tag.classList.add('show');setTimeout(()=>tag.classList.remove('show'),1500)}
  }catch(err){if(status){status.textContent=err.message||'Could not save platform settings.';status.className='form-status-line error'}}
  finally{if(btn){btn.disabled=false;btn.textContent='Save platform settings'}}
}
document.getElementById('savePlatformSettings')?.addEventListener('click',savePlatformSettings);

function renderProvisioning(){
  const board=document.getElementById('provisioningBoard');if(!board)return;
  const stages=['Paid','Review','Intake','Building','QA','Client Test','Ready','Live'],set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v)};
  set('provisionNeedsReview',adminProvisioningData.filter(x=>['Paid','Review','Intake'].includes(x.stage)||((x.onboardingStatus==='awaiting_review'||x.onboardingStatus==='building_review')&&!x.checklist?.adminReview)).length);
  set('provisionBuilding',adminProvisioningData.filter(x=>['Building','QA'].includes(x.stage)).length);
  set('provisionClientTest',adminProvisioningData.filter(x=>x.stage==='Client Test').length);
  set('provisionLive',adminProvisioningData.filter(x=>x.stage==='Live').length);
  const labels={payment:'Paid',accountReview:'Account review',onboardingSent:'Onboarding sent',agreement:'Agreement',intake:'Intake',businessProfile:'Profile',agentDraft:'Agent draft',routingCaptured:'Routing',phoneAssigned:'Phone',adminReview:'Admin review',testCall:'Test call',clientApproval:'Client approval',live:'Live'};
  board.innerHTML=stages.map(stage=>{
    const rows=adminProvisioningData.filter(x=>x.stage===stage);
    return '<div class="provision-column" data-provision-stage="'+stage+'"><h3>'+stage+' <span>'+rows.length+'</span></h3>'+rows.map(x=>{
      const ck=x.checklist||{},chips=Object.entries(labels).map(([k,label])=>'<button type="button" class="provision-check '+(ck[k]?'done':'')+'" '+(['testCall','clientApproval','live'].includes(k)?'data-provision-check="'+k+'" data-provision-id="'+esc(x.id)+'"':'disabled')+'><span>'+(ck[k]?'✓':'○')+'</span>'+label+'</button>').join('');
      const scan=x.websiteScan?('<span class="provision-scan">Website scan · '+Number(x.websiteScan.pagesScanned||0)+' page'+(Number(x.websiteScan.pagesScanned||0)===1?'':'s')+'</span>'):'';
      const agreement=x.agreementVersion?('<span class="provision-scan">Agreement v'+esc(x.agreementVersion)+(x.agreementSignedName?' · '+esc(x.agreementSignedName):'')+'</span>'):'';
      const now=Date.now(),reviewAt=Number(x.reviewEligibleAt||0),buildAt=Number(x.buildEligibleAt||0);
      let action='';
      if(x.onboardingStatus==='awaiting_review'&&!x.onboardingLinkSent){
        action=reviewAt>now
          ? '<div class="provision-wait">Onboarding invite available '+esc(new Date(reviewAt).toLocaleString())+'</div>'
          : '<button class="primary provision-action" data-send-onboarding="'+esc(x.id)+'">Approve & send onboarding</button>';
      }else if(x.onboardingStatus==='building_review'&&!ck.adminReview){
        action=buildAt>now
          ? '<div class="provision-wait">Build review available '+esc(new Date(buildAt).toLocaleString())+'</div>'
          : '<button class="primary provision-action" data-approve-build="'+esc(x.id)+'">Approve build</button>';
      }
      const stageSelect='<label class="provision-stage-select">Stage<select data-provision-stage-select="'+esc(x.id)+'">'+stages.map(s=>'<option value="'+s+'" '+(x.stage===s?'selected':'')+'>'+s+'</option>').join('')+'</select></label>';
      return '<article draggable="true" data-provision-id="'+esc(x.id)+'"><div class="provision-card-head"><b>'+esc(x.name)+'</b>'+(x.manualOverride?'<span class="tag amber">Manual</span>':'')+'</div><small>'+esc(x.plan)+(x.phone?' · '+esc(x.phone):'')+'</small><div class="provision-progress"><i style="width:'+Math.round((Number(x.checklistDone||0)/Math.max(1,Number(x.checklistTotal||1)))*100)+'%"></i></div><div class="provision-checks">'+chips+'</div>'+agreement+scan+action+stageSelect+'<div class="provision-foot"><span>Auto: '+esc(x.autoStage||x.stage)+'</span>'+(x.manualOverride?'<button data-auto-stage="'+esc(x.id)+'">Use auto</button>':'')+'</div></article>';
    }).join('')+'</div>';
  }).join('');
  board.querySelectorAll('[draggable="true"]').forEach(card=>{
    card.addEventListener('dragstart',e=>{if(e.target.closest('button')){e.preventDefault();return}card.classList.add('dragging');card.dataset.dragging='1'});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');delete card.dataset.dragging});
  });
  board.querySelectorAll('.provision-column').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drop-active')});
    col.addEventListener('dragleave',()=>col.classList.remove('drop-active'));
    col.addEventListener('drop',async e=>{
      e.preventDefault();col.classList.remove('drop-active');
      const card=board.querySelector('[data-dragging="1"]');if(!card)return;
      await moveProvisioningStage(card.dataset.provisionId,col.dataset.provisionStage);
    });
  });
  board.querySelectorAll('[data-auto-stage]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();clearProvisioningOverride(b.dataset.autoStage)}));
  board.querySelectorAll('[data-provision-stage-select]').forEach(sel=>sel.addEventListener('change',e=>{e.stopPropagation();moveProvisioningStage(sel.dataset.provisionStageSelect,sel.value)}));
  board.querySelectorAll('[data-provision-check]').forEach(b=>b.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();await updateProvisioningChecklist(b.dataset.provisionId,b.dataset.provisionCheck,!b.classList.contains('done'))}));
  board.querySelectorAll('[data-send-onboarding]').forEach(b=>b.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();await sendOnboardingInvite(b.dataset.sendOnboarding,b)}));
  board.querySelectorAll('[data-approve-build]').forEach(b=>b.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();await approveProvisioningBuild(b.dataset.approveBuild,b)}));
}
async function sendOnboardingInvite(id,button){
  if(button){button.disabled=true;button.textContent='Sending…'}
  const r=await fetch('/api/account?action=admin-onboarding-send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error+(data.eligibleAt?' Available '+new Date(data.eligibleAt).toLocaleString()+'.':''));if(button){button.disabled=false;button.textContent='Approve & send onboarding'};return}
  await loadAdminOps();await loadNotifications({silent:true});
}
async function approveProvisioningBuild(id,button){
  if(button){button.disabled=true;button.textContent='Approving…'}
  const r=await fetch('/api/account?action=admin-provisioning-checklist-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,field:'adminReview',value:true})}),data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error+(data.eligibleAt?' Available '+new Date(data.eligibleAt).toLocaleString()+'.':''));if(button){button.disabled=false;button.textContent='Approve build'};return}
  await loadAdminOps();await loadNotifications({silent:true});
}
async function updateProvisioningChecklist(id,field,value){
  const r=await fetch('/api/account?action=admin-provisioning-checklist-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,field,value})}),data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not update provisioning checklist.');return}
  await loadAdminOps();
}
async function moveProvisioningStage(id,stage){
  const item=adminProvisioningData.find(x=>String(x.id)===String(id));if(!item||item.stage===stage)return;
  const previous=item.stage;item.stage=stage;item.manualOverride=true;renderProvisioning();
  const r=await fetch('/api/account?action=admin-provisioning-stage-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,stage})});
  if(!r.ok){item.stage=previous;renderProvisioning();const d=await r.json().catch(()=>({}));alert(d.error||'Could not move provisioning stage.')}
}
async function clearProvisioningOverride(id){
  const r=await fetch('/api/account?action=admin-provisioning-stage-clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  if(!r.ok){const d=await r.json().catch(()=>({}));alert(d.error||'Could not restore automatic stage.');return}
  await loadAdminOps();
}
function renderPhones(){
  const wrap=document.getElementById('phoneTable'),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v)};
  if(!wrap)return;
  set('phoneAssignedCount',adminPhoneData.filter(x=>x.workspaceId).length);set('phoneUnassignedCount',adminPhoneData.filter(x=>!x.workspaceId).length);set('phoneMissingTransferCount',adminPhoneData.filter(x=>x.workspaceId&&!x.transferNumber).length);set('phoneAfterHoursTransferCount',adminPhoneData.filter(x=>x.afterHours==='transfer').length);
  wrap.innerHTML=adminPhoneData.map(x=>'<div class="call-row"><span><strong>'+esc(x.number)+'</strong><small class="subtle">'+esc(x.label||'Primary')+(x.forwardingFrom?' · from '+esc(x.forwardingFrom):'')+'</small></span><span>'+esc(x.workspaceName||'Unassigned')+'</span><span>'+esc(x.provider||'')+'</span><span class="tag '+(x.workspaceId&&!x.transferNumber?'amber':'green')+'">'+(x.workspaceId&&!x.transferNumber?'Transfer missing':esc(x.status||'active'))+'</span><span class="phone-actions"><button class="admin-link" data-edit-phone="'+esc(x.id)+'">Edit</button><button class="admin-link danger-link" data-delete-phone="'+esc(x.id)+'">Delete</button></span></div>').join('');
  const empty=document.getElementById('phoneEmpty');if(empty)empty.hidden=adminPhoneData.length!==0;
  wrap.querySelectorAll('[data-edit-phone]').forEach(b=>b.addEventListener('click',()=>openPhoneModal(b.dataset.editPhone)));
  wrap.querySelectorAll('[data-delete-phone]').forEach(b=>b.addEventListener('click',()=>deletePhone(b.dataset.deletePhone)));
}
function renderHealth(){
  const wrap=document.getElementById('systemHealthGrid');if(!wrap)return;
  const requiredKeys=new Set(adminReadinessData?.requiredForLaunch||[]),blockerKeys=new Set((adminReadinessData?.blockers||[]).map(x=>x.key)),healthy=x=>['operational','configured','confirmed'].includes(x.status);
  const required=adminHealthData.filter(x=>requiredKeys.has(x.key)),optional=adminHealthData.filter(x=>!requiredKeys.has(x.key)),critical=required.filter(x=>!healthy(x)).length,requiredReady=required.filter(healthy).length,optionalIssues=optional.filter(x=>!healthy(x)).length;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v)};set('healthRequiredBlockers',critical);set('healthRequiredReady',requiredReady);set('healthOptionalIssues',optionalIssues);set('healthTotalChecks',adminHealthData.length);
  const card=x=>'<article class="panel integration-card admin-health-item '+(blockerKeys.has(x.key)?'blocking':'')+'"><div><b>'+esc(x.name)+'</b><p>'+esc(x.detail||'')+'</p></div><span class="tag '+(healthy(x)?'green':x.status==='error'?'red':'amber')+'">'+esc(x.status.replace('_',' '))+'</span></article>';
  wrap.innerHTML='<section class="admin-health-group"><div class="admin-health-group-head"><div><span class="eyebrow">Required for launch</span><h2>Launch dependencies</h2></div><span>'+requiredReady+' / '+required.length+' ready</span></div><div class="integration-grid">'+required.map(card).join('')+'</div></section><section class="admin-health-group"><div class="admin-health-group-head"><div><span class="eyebrow">Optional & supporting services</span><h2>Additional platform services</h2></div><span>'+optionalIssues+' need setup</span></div><div class="integration-grid">'+optional.map(card).join('')+'</div></section>';
  const side=document.getElementById('adminSidebarHealth'),meta=document.getElementById('adminSidebarHealthMeta');
  if(side)side.textContent=critical?critical+' launch blocker'+(critical===1?'':'s'):(optionalIssues?'Core systems ready':'All systems operational');
  if(meta)meta.textContent=critical?(optionalIssues?optionalIssues+' additional optional / setup item'+(optionalIssues===1?'':'s'):'Required launch items need attention'):(optionalIssues?optionalIssues+' optional or pre-launch item'+(optionalIssues===1?'':'s'):'No open system issues');
  const title=document.getElementById('productionReadinessTitle'),copy=document.getElementById('productionReadinessCopy'),blockers=document.getElementById('productionReadinessBlockers'),readinessCard=document.getElementById('productionReadinessCard');
  if(adminReadinessData&&title&&copy&&blockers){
    title.textContent=adminReadinessData.ready?'Core launch dependencies are ready.':adminReadinessData.blockers.length+' launch blocker'+(adminReadinessData.blockers.length===1?'':'s')+' remain.';
    copy.textContent=adminReadinessData.ready?'Required infrastructure and owner confirmations are ready. Optional integrations are tracked separately below.':'Resolve the required items below before treating the platform as production-ready.';
    blockers.innerHTML=(adminReadinessData.blockers||[]).map(x=>'<div class="readiness-blocker"><b>'+esc(x.name)+'</b><span>'+esc(x.detail||'Needs attention')+'</span></div>').join('')||'<div class="readiness-ok">No dependency blockers detected.</div>';
    readinessCard?.classList.toggle('ready',!!adminReadinessData.ready);
  }
}

async function deletePhone(id){
  const item=adminPhoneData.find(x=>String(x.id)===String(id));if(!item)return;
  const assigned=item.workspaceName?' assigned to '+item.workspaceName:'';
  if(!confirm('Delete '+item.number+assigned+'? This will remove the number from CallerCore'+(item.workspaceId?' and clear it from that workspace.':'.')))return;
  const r=await fetch('/api/account?action=admin-phone-number-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not delete phone number.');return}
  await loadAdminOps();
}

function openPhoneModal(id=null){
  const item=id?adminPhoneData.find(x=>String(x.id)===String(id)):null;
  const modal=document.getElementById('phoneModal');if(!modal)return;
  modal.dataset.editId=id||'';
  document.getElementById('phoneNumberInput').value=item?.number||'';
  document.getElementById('phoneLabelInput').value=item?.label||'Primary';
  document.getElementById('phoneProviderInput').value=item?.provider||'Vapi';
  document.getElementById('phoneForwardingInput').value=item?.forwardingFrom||'';
  document.getElementById('phoneTransferInput').value=item?.transferNumber||'';
  document.getElementById('phoneAfterHoursInput').value=item?.afterHours||'ai';
  const smsBox=document.getElementById('phoneSmsInput');if(smsBox){smsBox.checked=false;smsBox.disabled=true}
  const sel=document.getElementById('phoneWorkspaceInput');
  sel.innerHTML='<option value="">Unassigned</option>'+adminClientsData.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
  sel.value=item?.workspaceId||'';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}
function closePhoneModal(){const m=document.getElementById('phoneModal');m?.classList.remove('open');m?.setAttribute('aria-hidden','true')}
async function savePhone(){
  const modal=document.getElementById('phoneModal'),numberEl=document.getElementById('phoneNumberInput'),forwardEl=document.getElementById('phoneForwardingInput'),transferEl=document.getElementById('phoneTransferInput'),status=document.getElementById('phoneFormStatus'),btn=document.getElementById('savePhoneButton');
  const number=String(numberEl?.value||'').trim(),forwarding=String(forwardEl?.value||'').trim(),transfer=String(transferEl?.value||'').trim(),errors={};
  if(!validUsPhone(number,true))errors.phoneNumberInput='Enter a valid 10-digit phone number.';
  if(forwarding&&!validUsPhone(forwarding))errors.phoneForwardingInput='Enter a valid forwarding number.';
  if(transfer&&!validUsPhone(transfer))errors.phoneTransferInput='Enter a valid transfer number.';
  ['phoneNumberInput','phoneForwardingInput','phoneTransferInput'].forEach(id=>settingsFieldError(id,errors[id]||''));
  if(Object.keys(errors).length){if(status){status.textContent='Please correct the highlighted phone fields.';status.className='form-status-line error'};document.getElementById(Object.keys(errors)[0])?.focus();return}
  if(numberEl)numberEl.value=normalizePhone(number);if(forwardEl)forwardEl.value=normalizePhone(forwarding);if(transferEl)transferEl.value=normalizePhone(transfer);
  const payload={id:modal?.dataset.editId||undefined,number:numberEl?.value||'',label:document.getElementById('phoneLabelInput')?.value||'',provider:document.getElementById('phoneProviderInput')?.value||'Vapi',workspaceId:document.getElementById('phoneWorkspaceInput')?.value||'',forwardingFrom:forwardEl?.value||'',transferNumber:transferEl?.value||'',afterHours:document.getElementById('phoneAfterHoursInput')?.value||'ai',smsEnabled:false};
  if(btn){btn.disabled=true;btn.textContent='Saving…'}if(status){status.textContent='';status.className='form-status-line'}
  try{
    const r=await fetch('/api/account?action=admin-phone-number-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Could not save phone number.');
    closePhoneModal();await loadAdminOps();
  }catch(err){if(status){status.textContent=err.message||'Could not save phone number.';status.className='form-status-line error'}}
  finally{if(btn){btn.disabled=false;btn.textContent='Save number'}}
}
document.getElementById('addPhoneButton')?.addEventListener('click',()=>openPhoneModal());
document.getElementById('addExpenseButton')?.addEventListener('click',()=>openExpenseModal());
document.getElementById('closeExpenseModal')?.addEventListener('click',closeExpenseModal);
document.getElementById('saveExpenseButton')?.addEventListener('click',saveExpense);
document.getElementById('expenseModal')?.addEventListener('click',e=>{if(e.target.id==='expenseModal')closeExpenseModal()});
document.getElementById('closePhoneModal')?.addEventListener('click',closePhoneModal);
document.getElementById('savePhoneButton')?.addEventListener('click',savePhone);
document.getElementById('phoneModal')?.addEventListener('click',e=>{if(e.target.id==='phoneModal')closePhoneModal()});

function adminMoney(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}
function adminPlanMinutes(plan){return plan==='Starter'?300:plan==='Growth'?600:null}
function adminBillingTag(status){return status==='past_due'?'red':status==='canceled'?'amber':'green'}
function adminClientLifecycle(x){
  const subscription=String(x.subscriptionStatus||'active'),status=String(x.status||'active');
  if(subscription==='canceled'||status==='pending_deletion')return 'past';
  if(status==='onboarding')return 'onboarding';
  if(status==='suspended')return 'suspended';
  return 'active';
}
function adminBillingLabel(status){
  status=String(status||'active');
  return status==='past_due'?'Past due':status==='canceled'?'Canceled':'Billing current';
}
function adminWorkspaceLabel(status){
  status=String(status||'active');
  return status==='onboarding'?'Onboarding':status==='suspended'?'Suspended':status==='pending_deletion'?'Pending deletion':'Active';
}
function adminDayKey(ts){
  const d=new Date(Number(ts||0));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function adminRecentDays(n=14){
  const out=[];for(let i=n-1;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);out.push({key:adminDayKey(d.getTime()),label:d.toLocaleDateString(undefined,{month:'short',day:'numeric'}),date:d})}return out;
}
function financeMonthLabel(key){
  const [y,m]=String(key||'').split('-').map(Number);if(!y||!m)return key||'';
  return new Date(y,m-1,1).toLocaleDateString(undefined,{month:'short',year:'2-digit'});
}
function financeMoney(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}
function renderFinanceChart(shellId,tooltipId){
  const shell=document.getElementById(shellId);if(!shell)return;
  const rows=(adminFinanceData.history||[]).slice(-adminFinanceRange),tooltip=document.getElementById(tooltipId);
  if(!rows.length){shell.innerHTML='<div class="empty-state"><h3>No finance history yet</h3><p>Monthly snapshots will appear automatically.</p></div>';return}
  const w=920,h=300,left=52,right=20,top=22,bottom=45,plotW=w-left-right,plotH=h-top-bottom,max=Math.max(1,...rows.flatMap(r=>[Number(r.revenue||0),Number(r.expenses||0)])),step=rows.length>1?plotW/(rows.length-1):plotW;
  const x=i=>left+(rows.length===1?plotW/2:i*step),y=v=>top+plotH-(Number(v||0)/max)*plotH;
  const revenuePoints=rows.map((r,i)=>x(i).toFixed(1)+','+y(r.revenue).toFixed(1)).join(' '),expensePoints=rows.map((r,i)=>x(i).toFixed(1)+','+y(r.expenses).toFixed(1)).join(' ');
  const grid=[0,.25,.5,.75,1].map(p=>{const val=max*p,yy=y(val);return '<g><line x1="'+left+'" x2="'+(w-right)+'" y1="'+yy.toFixed(1)+'" y2="'+yy.toFixed(1)+'"></line><text x="'+(left-9)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end">'+esc(val>=1000?'$'+(val/1000).toFixed(val>=10000?0:1)+'k':'$'+Math.round(val))+'</text></g>'}).join('');
  const labels=rows.map((r,i)=>'<text x="'+x(i).toFixed(1)+'" y="'+(h-14)+'" text-anchor="middle">'+esc(financeMonthLabel(r.month))+'</text>').join('');
  const revenueDots=rows.map((r,i)=>'<circle class="finance-dot revenue" cx="'+x(i).toFixed(1)+'" cy="'+y(r.revenue).toFixed(1)+'" r="4"></circle>').join('');
  const expenseDots=rows.map((r,i)=>'<circle class="finance-dot expense" cx="'+x(i).toFixed(1)+'" cy="'+y(r.expenses).toFixed(1)+'" r="4"></circle>').join('');
  const hitWidth=Math.max(30,plotW/Math.max(1,rows.length));
  const hits=rows.map((r,i)=>'<rect class="finance-hit" data-finance-index="'+i+'" x="'+(x(i)-hitWidth/2).toFixed(1)+'" y="'+top+'" width="'+hitWidth.toFixed(1)+'" height="'+plotH+'" fill="transparent"></rect>').join('');
  shell.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Monthly revenue and company expenses"><g class="admin-chart-grid">'+grid+'</g><polyline class="finance-line revenue" points="'+revenuePoints+'"></polyline><polyline class="finance-line expense" points="'+expensePoints+'"></polyline><g>'+revenueDots+expenseDots+'</g><g class="admin-chart-labels">'+labels+'</g><g>'+hits+'</g></svg>'+(tooltip?'<div class="admin-chart-tooltip" id="'+tooltipId+'"></div>':'');
  const tip=document.getElementById(tooltipId);
  shell.querySelectorAll('[data-finance-index]').forEach(hit=>{
    const show=()=>{const i=Number(hit.dataset.financeIndex),r=rows[i];if(!tip||!r)return;tip.hidden=false;tip.innerHTML='<b>'+esc(financeMonthLabel(r.month))+'</b><span>Revenue <strong>'+financeMoney(r.revenue)+'</strong></span><span>Expenses <strong>'+financeMoney(r.expenses)+'</strong></span><span>Net <strong>'+financeMoney(Number(r.revenue||0)-Number(r.expenses||0))+'</strong></span>';tip.style.left=Math.min(88,Math.max(8,(x(i)/w)*100))+'%';tip.style.top='18px'};
    hit.addEventListener('mouseenter',show);hit.addEventListener('mousemove',show);hit.addEventListener('mouseleave',()=>{if(tip)tip.hidden=true});
  });
}
function renderAdminFinance(){
  const d=adminFinanceData||{},set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('financeMrr',financeMoney(d.mrr));set('financeRecurringExpenses',financeMoney(d.recurringExpenses));set('financeNetRecurring',financeMoney(d.netRecurring));set('financeMargin',Number(d.margin||0).toFixed(1).replace('.0','')+'%');
  set('adminMonthlyCosts',financeMoney(d.recurringExpenses));set('adminNetRecurring',financeMoney(d.netRecurring));set('adminMarginMeta',Number(d.margin||0).toFixed(1).replace('.0','')+'% operating margin');
  const summary=document.getElementById('adminFinanceChartSummary');if(summary)summary.textContent=(d.history?.length||0)+' monthly snapshot'+((d.history?.length||0)===1?'':'s')+' · '+financeMoney(d.netRecurring)+' net recurring';
  document.querySelectorAll('[data-finance-range]').forEach(btn=>{btn.classList.toggle('active',Number(btn.dataset.financeRange)===adminFinanceRange);btn.onclick=e=>{e.stopPropagation();adminFinanceRange=Number(btn.dataset.financeRange)||6;renderAdminFinance()}});
  renderFinanceChart('adminFinanceChart','adminFinanceTooltip');renderFinanceChart('financePageChart','financePageTooltip');

  const prices={Starter:PLAN_DATA.Starter?.price||349,Growth:PLAN_DATA.Growth?.price||599,Pro:PLAN_DATA.Pro?.price||999},chart=document.getElementById('adminRevenuePlanChart'),past=document.getElementById('adminPastDueAccounts');
  if(chart){
    const rows=['Starter','Growth','Pro'].map(plan=>{const clients=adminClientsData.filter(x=>x.plan===plan&&adminClientLifecycle(x)!=='past'),mrr=clients.length*prices[plan];return {plan,count:clients.length,mrr}});
    const max=Math.max(1,...rows.map(x=>x.mrr));chart.innerHTML=rows.map(x=>'<button type="button" data-revenue-plan="'+x.plan+'"><span><b>'+x.plan+'</b><small>'+x.count+' client'+(x.count===1?'':'s')+'</small></span><strong>'+financeMoney(x.mrr)+'</strong><i><em style="width:'+Math.round(x.mrr/max*100)+'%"></em></i></button>').join('');
    chart.querySelectorAll('[data-revenue-plan]').forEach(b=>b.addEventListener('click',()=>{adminClientFilter='all';adminClientSearch=b.dataset.revenuePlan;showView('clients');renderAdminClients()}));
  }
  const pastDue=adminClientsData.filter(x=>x.subscriptionStatus==='past_due');
  if(past)past.innerHTML=pastDue.map(x=>'<button type="button" class="admin-billing-alert" data-open-billing-client="'+esc(x.id)+'"><span><b>'+esc(x.name)+'</b><small>'+esc(x.plan)+' · '+financeMoney(PLAN_DATA[x.plan]?.price||0)+'/mo</small></span><span class="tag red">Past due</span></button>').join('')||'<div class="admin-clear-state"><b>Billing is current</b><span>No past-due client accounts.</span></div>';
  past?.querySelectorAll('[data-open-billing-client]').forEach(b=>b.addEventListener('click',()=>openAdminClient(b.dataset.openBillingClient)));

  const filter=document.getElementById('expenseCategoryFilter');if(filter){filter.value=adminExpenseFilter;filter.onchange=()=>{adminExpenseFilter=filter.value;renderAdminFinance()}}
  const expenses=(d.expenses||[]).filter(x=>adminExpenseFilter==='all'||x.category===adminExpenseFilter),list=document.getElementById('adminExpenseList'),empty=document.getElementById('adminExpenseEmpty');
  if(list)list.innerHTML=expenses.map(x=>{
    const monthly=x.frequency==='monthly'?Number(x.amount||0):x.frequency==='annual'?Number(x.amount||0)/12:0,freq=x.frequency==='one_time'?'One-time':x.frequency==='annual'?'Annual':'Monthly';
    return '<div class="admin-expense-row"><span><strong>'+esc(x.name)+'</strong><small>'+esc(x.vendor||'No vendor')+(x.notes?' · '+esc(x.notes):'')+'</small></span><span>'+esc(x.category||'Other')+'</span><span>'+freq+(x.date?'<small>'+esc(x.date)+'</small>':'')+'</span><span>'+financeMoney(x.amount)+'</span><span>'+(x.frequency==='one_time'?'—':financeMoney(monthly))+'</span><span><span class="tag '+(x.status==='paused'?'amber':'green')+'">'+esc(x.status==='paused'?'Paused':'Active')+'</span></span><span class="phone-actions"><button class="admin-link" data-edit-expense="'+esc(x.id)+'">Edit</button><button class="admin-link danger-link" data-delete-expense="'+esc(x.id)+'">Delete</button></span></div>'
  }).join('');
  if(empty)empty.hidden=expenses.length!==0;
  list?.querySelectorAll('[data-edit-expense]').forEach(b=>b.addEventListener('click',()=>openExpenseModal(b.dataset.editExpense)));
  list?.querySelectorAll('[data-delete-expense]').forEach(b=>b.addEventListener('click',()=>deleteExpense(b.dataset.deleteExpense)));
}
function openExpenseModal(id=''){
  const item=id?(adminFinanceData.expenses||[]).find(x=>String(x.id)===String(id)):null,modal=document.getElementById('expenseModal');if(!modal)return;
  modal.dataset.editId=id||'';document.getElementById('expenseModalTitle').textContent=item?'Edit expense':'Add expense';
  document.getElementById('expenseNameInput').value=item?.name||'';document.getElementById('expenseVendorInput').value=item?.vendor||'';document.getElementById('expenseCategoryInput').value=item?.category||'Software';document.getElementById('expenseAmountInput').value=item?.amount??'';document.getElementById('expenseFrequencyInput').value=item?.frequency||'monthly';document.getElementById('expenseDateInput').value=item?.date||'';document.getElementById('expenseStatusInput').value=item?.status||'active';document.getElementById('expenseNotesInput').value=item?.notes||'';const status=document.getElementById('expenseFormStatus');if(status)status.textContent='';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}
function closeExpenseModal(){const modal=document.getElementById('expenseModal');modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true')}
async function saveExpense(){
  const modal=document.getElementById('expenseModal'),button=document.getElementById('saveExpenseButton'),status=document.getElementById('expenseFormStatus'),name=String(document.getElementById('expenseNameInput')?.value||'').trim(),amount=Number(document.getElementById('expenseAmountInput')?.value);
  if(!name||!Number.isFinite(amount)||amount<0){if(status){status.textContent='Enter an expense name and valid amount.';status.className='form-status-line error'}return}
  const payload={id:modal?.dataset.editId||undefined,name,vendor:document.getElementById('expenseVendorInput')?.value||'',category:document.getElementById('expenseCategoryInput')?.value||'Other',amount,frequency:document.getElementById('expenseFrequencyInput')?.value||'monthly',date:document.getElementById('expenseDateInput')?.value||'',status:document.getElementById('expenseStatusInput')?.value||'active',notes:document.getElementById('expenseNotesInput')?.value||''};
  if(button){button.disabled=true;button.textContent='Saving…'}
  try{const r=await fetch('/api/account?action=admin-finance-expense-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not save expense.');closeExpenseModal();await loadAdminOps()}
  catch(err){if(status){status.textContent=err.message||'Could not save expense.';status.className='form-status-line error'}}
  finally{if(button){button.disabled=false;button.textContent='Save expense'}}
}
async function deleteExpense(id){
  const item=(adminFinanceData.expenses||[]).find(x=>String(x.id)===String(id));if(!item||!confirm('Delete '+item.name+' from company expenses?'))return;
  const r=await fetch('/api/account?action=admin-finance-expense-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),data=await r.json().catch(()=>({}));if(!r.ok){alert(data.error||'Could not delete expense.');return}await loadAdminOps();
}
function updateAdminRefreshStamp(){
  const el=document.getElementById('adminLastRefresh');if(el)el.textContent='Updated '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
}
function adminAttentionItems(){
  const items=[];
  for(const x of adminClientsData){
    if(x.subscriptionStatus==='past_due')items.push({id:'billing:'+x.id,type:'billing',workspaceId:x.id,title:x.name||'Client',message:'Stripe payment needs attention',category:'Billing',severity:'critical',view:'finance'});
    if(x.status==='suspended')items.push({id:'workspace:'+x.id,type:'workspace',workspaceId:x.id,title:x.name||'Client',message:'Workspace access is suspended',category:'Workspace',severity:'critical',view:'clients'});
    if(x.status==='onboarding')items.push({id:'onboarding:'+x.id,type:'onboarding',workspaceId:x.id,title:x.name||'Client',message:'Onboarding is still in progress',category:'Onboarding',severity:'attention',view:'onboarding'});
  }
  for(const t of adminSupportData||[]){
    if(t.status==='resolved')continue;
    items.push({id:'support:'+t.id,type:'support',ticketId:t.id,title:t.workspaceName||'Client',message:t.subject||'Open support request',category:'Client care',severity:t.priority==='urgent'?'critical':'attention',view:'client-care',createdAt:t.updatedAt||t.createdAt||0});
  }
  for(const fb of adminFeedbackData||[]){
    if(fb.status!=='submitted')continue;
    items.push({id:'feedback:'+fb.id,type:'feedback',feedbackId:fb.id,title:fb.workspaceName||'Client',message:'AI feedback awaiting review',category:'Client care',severity:'attention',view:'client-care',createdAt:fb.createdAt||0});
  }
  const blockers=adminReadinessData?.blockers||[];
  if(blockers.length)items.push({id:'platform:readiness',type:'system',title:'Platform launch readiness',message:blockers.length+' required launch item'+(blockers.length===1?'':'s')+' still need attention',category:'System health',severity:'critical',view:'health'});
  const rank={critical:0,attention:1,info:2};
  return items.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9)||Number(b.createdAt||0)-Number(a.createdAt||0));
}
function adminProvisioningFor(id){return (adminProvisioningData||[]).find(x=>String(x.id)===String(id))||null}
function adminPhoneFor(id){return (adminPhoneData||[]).find(x=>String(x.workspaceId||'')===String(id))||null}
function adminStatusLabel(v){return String(v||'active').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
async function openAdminAttentionItem(item){
  if(!item)return;
  if(item.type==='workspace'||item.type==='billing'){showView('clients');await openAdminClient(item.workspaceId);return}
  if(item.type==='support')openClientCare('support');else if(item.type==='feedback')openClientCare('feedback');else showView(item.view||'overview');
  setTimeout(()=>{
    let target=null;
    if(item.type==='onboarding')target=document.querySelector('[data-provision-id="'+CSS.escape(String(item.workspaceId))+'"]');
    else if(item.type==='support')target=document.querySelector('[data-support-ticket-id="'+CSS.escape(String(item.ticketId))+'"]');
    else if(item.type==='feedback')target=document.getElementById('feedback-'+String(item.feedbackId));
    else if(item.type==='system')target=document.getElementById('productionReadinessCard')||document.getElementById('systemHealthGrid');
    if(target){if(target.tagName==='DETAILS')target.open=true;flashAdminSearchTarget(target)}
  },100);
}
function openAdminClientFilter(filter){
  adminClientFilter=filter||'active';adminClientSearch='';showView('clients');renderAdminClients();
}
function bindAdminCommandCenter(){
  document.querySelectorAll('[data-admin-attention-id]').forEach(btn=>btn.onclick=()=>openAdminAttentionItem((window.__adminAttentionItems||[]).find(x=>x.id===btn.dataset.adminAttentionId)));
  document.querySelectorAll('[data-admin-client-row]').forEach(row=>row.onclick=e=>{if(e.target.closest('button,a,select,input'))return;openAdminClient(row.dataset.adminClientRow)});
  document.querySelectorAll('[data-admin-metric-view]').forEach(card=>{card.tabIndex=0;card.setAttribute('role','button');const go=()=>{const view=card.dataset.adminMetricView;if(view==='overview'){document.getElementById('adminAttention')?.scrollIntoView({behavior:'smooth',block:'center'})}else showView(view)};card.onclick=go;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
  document.querySelectorAll('[data-admin-client-filter]').forEach(el=>{el.onclick=()=>openAdminClientFilter(el.dataset.adminClientFilter)});
  document.querySelectorAll('[data-client-filter]').forEach(el=>{el.onclick=()=>{adminClientFilter=el.dataset.clientFilter;renderAdminClients()}});
  document.querySelectorAll('[data-admin-jump]').forEach(el=>{const go=()=>showView(el.dataset.adminJump);el.onclick=go;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
  document.querySelectorAll('[data-plan-client-filter]').forEach(el=>el.onclick=()=>{adminClientFilter='all';adminClientSearch=el.dataset.planClientFilter;showView('clients');renderAdminClients()});
}
function renderAdmin(){
  if(!adminSummaryData)return;
  const s=adminSummaryData,set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v},finance=adminFinanceData||{};
  const attentionItems=adminAttentionItems();window.__adminAttentionItems=attentionItems;
  set('adminMrr',financeMoney(finance.mrr??s.mrr));set('adminActiveClients',s.activeClients||0);set('adminOnboarding',(s.onboarding||0)+' onboarding');
  set('adminMonthlyCosts',financeMoney(finance.recurringExpenses||0));set('adminNetRecurring',financeMoney(finance.netRecurring||0));set('adminMarginMeta',Number(finance.margin||0).toFixed(1).replace('.0','')+'% operating margin');
  set('adminPastDue',s.pastDue||0);set('adminSnapshotOnboarding',s.onboarding||0);set('adminLaunchBlockers',(adminReadinessData?.blockers||[]).length);
  const openCare=(adminSupportData||[]).filter(x=>x.status!=='resolved').length+(adminFeedbackData||[]).filter(x=>x.status==='submitted').length;set('adminOpenCare',openCare);
  const total=Math.max(0,Number(s.currentClients??adminClientsData.filter(x=>adminClientLifecycle(x)!=='past').length)),den=Math.max(1,total),active=Number(s.activeClients||0),healthy=Math.max(0,total-Number(s.pastDue||0)),onboarded=Number(s.onboarded??Math.max(0,total-Number(s.onboarding||0)));
  const activePct=Math.round(active/den*100),billingPct=Math.round(healthy/den*100),livePct=Math.round(onboarded/den*100);
  [['adminActiveRing','adminActivePct',activePct],['adminBillingRing','adminBillingPct',billingPct],['adminLiveRing','adminLivePct',livePct]].forEach(([ringId,textId,pct])=>{const ring=document.getElementById(ringId),txt=document.getElementById(textId);if(ring)ring.style.setProperty('--pct',pct);if(txt)txt.textContent=pct+'%'});
  set('adminActiveCount',active+' of '+total+' current');set('adminBillingCount',healthy+' of '+total+' current');set('adminLiveCount',onboarded+' of '+total+' complete');
  const mix=document.getElementById('adminPlanMix');if(mix){
    const pm=s.planMix||{},max=Math.max(1,...Object.values(pm).map(Number));
    mix.innerHTML=['Starter','Growth','Pro'].map(p=>{const count=Number(pm[p]||0),mrr=count*Number(PLAN_DATA[p]?.price||0);return '<button type="button" data-plan-client-filter="'+p+'"><span><b>'+p+'</b><small>'+count+' client'+(count===1?'':'s')+' · '+financeMoney(mrr)+' MRR</small></span><i><em style="width:'+Math.round(count/max*100)+'%"></em></i></button>'}).join('');
  }
  const attention=document.getElementById('adminAttention');if(attention){
    attention.innerHTML=attentionItems.slice(0,7).map(item=>'<button type="button" class="admin-event admin-attention-item '+(item.severity==='critical'?'critical':'')+'" data-admin-attention-id="'+esc(item.id)+'"><span class="attention-severity-dot '+esc(item.severity)+'"></span><b>'+esc(item.title)+'</b><span>'+esc(item.message)+'</span><small>'+esc(item.category)+' →</small></button>').join('')||'<div class="empty-state"><h3>Nothing needs attention</h3><p>Billing, onboarding, client care, and platform blockers will appear here.</p></div>';
  }
  renderAdminClients();
  const recent=document.getElementById('adminRecentClients');if(recent){
    recent.innerHTML=adminClientsData.filter(x=>adminClientLifecycle(x)!=='past').slice(0,6).map(x=>adminClientRow(x,true)).join('')||'<div class="empty-state"><h3>No clients yet</h3></div>';
    recent.querySelectorAll('[data-admin-client]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openAdminClient(b.dataset.adminClient)}));
  }
  renderAdminFinance();renderClientCareTabs();bindAdminCommandCenter();updateAdminRefreshStamp();
}
function adminClientRow(x,activity=false){
  const lim=adminPlanMinutes(x.plan),used=Number(x.usage?.minutes||0),usage=lim?used+' / '+lim+' min':used.toLocaleString()+' min',initials=String(x.name||'?').split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase()||'?';
  const lifecycle=adminClientLifecycle(x),accountLabel=lifecycle==='past'?'Past client':lifecycle==='onboarding'?'Onboarding':lifecycle==='suspended'?'Suspended':'Active',accountClass=lifecycle==='active'?'green':lifecycle==='suspended'||lifecycle==='past'?'red':'amber';
  const billingLabel=x.subscriptionStatus==='past_due'?'Past due':x.subscriptionStatus==='canceled'?'Canceled':'Current',billingClass=adminBillingTag(x.subscriptionStatus),mrr=lifecycle==='past'?0:Number(PLAN_DATA[x.plan]?.price||0),since=x.createdAt?new Date(x.createdAt).toLocaleDateString(undefined,{month:'short',year:'numeric'}):'—';
  if(activity)return '<div class="activity-row admin-recent-row" data-admin-client-row="'+esc(x.id)+'"><span class="plan-pill">'+esc(x.plan)+'</span><div class="person"><b>'+esc(initials)+'</b><span><strong>'+esc(x.name)+'</strong><small>'+esc(usage)+' · '+financeMoney(mrr)+'/mo</small></span></div><div class="admin-recent-statuses"><span class="tag '+accountClass+'">'+esc(accountLabel)+'</span><span class="tag '+billingClass+'">'+esc(billingLabel)+'</span></div><button class="admin-link" data-admin-client="'+esc(x.id)+'">Manage</button></div>';
  return '<div class="admin-client-row admin-client-row-business" data-admin-client-row="'+esc(x.id)+'"><span><strong>'+esc(x.name)+'</strong><small class="subtle">'+esc(x.ownerEmail||'')+'</small></span><span>'+esc(x.plan)+'</span><span>'+financeMoney(mrr)+'</span><span>'+esc(usage)+'</span><span><span class="tag '+accountClass+'">'+esc(accountLabel)+'</span></span><span><span class="tag '+billingClass+'">'+esc(billingLabel)+'</span></span><span>'+esc(since)+'</span><span><button class="admin-link" data-admin-client="'+esc(x.id)+'">Manage</button></span></div>';
}
function adminClientMatchesFilter(x,filter=adminClientFilter){
  const lifecycle=adminClientLifecycle(x);
  if(filter==='all')return true;if(filter==='past_due')return x.subscriptionStatus==='past_due';return lifecycle===filter;
}
function renderAdminClients(){
  const wrap=document.getElementById('adminClientsTable');if(!wrap)return;
  const q=adminClientSearch.trim().toLowerCase(),all=adminClientsData;
  const counts={active:all.filter(x=>adminClientLifecycle(x)==='active').length,onboarding:all.filter(x=>adminClientLifecycle(x)==='onboarding').length,suspended:all.filter(x=>adminClientLifecycle(x)==='suspended').length,past:all.filter(x=>adminClientLifecycle(x)==='past').length};
  [['clientActiveCount','active'],['clientOnboardingCount','onboarding'],['clientSuspendedCount','suspended'],['clientPastCount','past']].forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.textContent=counts[key]});
  document.querySelectorAll('[data-client-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.clientFilter===adminClientFilter));
  const search=document.getElementById('adminClientSearchInput');if(search){search.value=adminClientSearch;search.oninput=()=>{adminClientSearch=search.value;renderAdminClients()}}
  const filtered=all.filter(x=>adminClientMatchesFilter(x)&&(!q||[x.name,x.ownerEmail,x.plan,x.status,x.subscriptionStatus].filter(Boolean).join(' ').toLowerCase().includes(q)));
  const groups=adminClientFilter==='all'
    ?[['Onboarding','onboarding'],['Active clients','active'],['Suspended','suspended'],['Past clients','past']].map(([label,key])=>[label,filtered.filter(x=>adminClientLifecycle(x)===key)]).filter(([,rows])=>rows.length)
    :[[adminClientFilter==='past_due'?'Past due accounts':adminClientFilter==='past'?'Past clients':adminClientFilter.charAt(0).toUpperCase()+adminClientFilter.slice(1),filtered]];
  wrap.innerHTML=groups.map(([label,rows])=>'<section class="admin-client-group"><div class="admin-client-group-head"><div><span class="eyebrow">'+esc(label)+'</span><b>'+rows.length+' account'+(rows.length===1?'':'s')+'</b></div></div><div class="admin-client-row head admin-client-row-business"><span>Client</span><span>Plan</span><span>MRR</span><span>Usage</span><span>Account</span><span>Billing</span><span>Since</span><span>Action</span></div>'+rows.map(x=>adminClientRow(x)).join('')+'</section>').join('');
  const empty=document.getElementById('adminClientsEmpty');if(empty)empty.hidden=filtered.length!==0;
  wrap.querySelectorAll('[data-admin-client]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openAdminClient(b.dataset.adminClient)}));
  wrap.querySelectorAll('[data-admin-client-row]').forEach(row=>row.addEventListener('click',e=>{if(e.target.closest('button,a,select,input'))return;openAdminClient(row.dataset.adminClientRow)}));
}
async function openAdminClient(id){
  const r=await fetch('/api/account?action=admin-client&id='+encodeURIComponent(id),{headers:{Accept:'application/json'},cache:'no-store'});
  if(!r.ok)return;
  const x=(await r.json()).client;if(!x)return;
  document.getElementById('adminClientName').textContent=x.name||'Client';
  document.getElementById('adminClientMeta').innerHTML=[x.plan,adminWorkspaceLabel(x.status),adminBillingLabel(x.subscriptionStatus),x.ownerEmail].filter(Boolean).map(v=>'<span>'+esc(v)+'</span>').join('');
  document.getElementById('adminClientAccount').innerHTML=[
    ['Plan',x.plan],['Account',adminWorkspaceLabel(x.status)],['Billing',adminBillingLabel(x.subscriptionStatus)],['MRR',financeMoney(adminClientLifecycle(x)==='past'?0:(PLAN_DATA[x.plan]?.price||0))],['Usage',Number(x.usage?.minutes||0).toLocaleString()+' min'],['Stripe',x.stripe?.subscriptionLinked?'Subscription linked':x.stripe?.customerLinked?'Customer linked':'Not linked']
  ].map(([k,v])=>'<div><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join('');
  document.getElementById('adminClientCounts').innerHTML=[
    ['Locations',x.counts?.locations||0],['AI receptionist',x.agent?'Configured':'Not configured'],['Phone routing',x.phoneRouting?'Assigned':'Not assigned'],['Onboarding',x.onboarding?.completionPercent?x.onboarding.completionPercent+'%':(x.status==='active'?'Complete':'—')]
  ].map(([k,v])=>'<div><b>'+esc(String(v))+'</b><span>'+esc(k)+'</span></div>').join('');
  document.getElementById('adminClientAgent').textContent=x.agent?(x.agent.name||'Maya')+' · '+(x.agent.role||'AI Receptionist')+(x.agent.health?' · '+adminStatusLabel(x.agent.health):''):'No AI receptionist configured yet.';
  currentAdminClient=x;
  const planSel=document.getElementById('adminClientPlan'),statusSel=document.getElementById('adminClientStatus');
  if(planSel){planSel.value=x.plan||'Starter';planSel.disabled=!!x.stripe?.subscriptionLinked}
  if(statusSel)statusSel.value=x.status||'active';
  const note=document.getElementById('adminClientManageNote');if(note)note.textContent=(x.stripe?.subscriptionLinked?'Plan is managed by Stripe. ':'Plan can be adjusted manually. ')+'Account status controls access; setup readiness is managed from Onboarding.';
  document.getElementById('adminClientDrawer').classList.add('open');document.getElementById('adminClientBackdrop').classList.add('open');
  await loadAdminTechSupport(id);
}

function adminTechMessage(message,error=false){
  const el=document.getElementById('adminTechStatus');if(!el)return;el.textContent=message||'';el.classList.toggle('error-text',!!error)
}
async function loadAdminTechSupport(id=currentAdminClient?.id){
  if(!id)return;
  adminTechMessage('Running diagnostics…');
  const r=await fetch('/api/account?action=admin-tech-support&id='+encodeURIComponent(id),{headers:{Accept:'application/json'},cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){adminTechMessage(data.error||'Could not load support diagnostics.',true);return}
  currentAdminTech=data;renderAdminTechSupport();adminTechMessage('Diagnostics refreshed.');
}
function renderAdminTechSupport(){
  if(!currentAdminTech)return;
  const d=currentAdminTech.diagnostics||{},diag=document.getElementById('adminDiagnostics');
  if(diag)diag.innerHTML=[
    ['Access mapping',d.userMappingMatches?'Healthy':'Needs repair',d.userMappingMatches?'green':'red'],
    ['Workspace',d.workspaceStatus||'unknown',d.workspaceStatus==='active'?'green':d.workspaceStatus==='suspended'?'red':'amber'],
    ['Billing',d.subscriptionStatus||'unknown',d.subscriptionStatus==='active'?'green':d.subscriptionStatus==='past_due'?'red':'amber'],
    ['Phone',d.phoneConfigured?'Configured':'Missing',d.phoneConfigured?'green':'amber'],
    ['AI agent',d.agentConfigured?'Configured':'Missing',d.agentConfigured?'green':'amber'],
    ['Settings',d.settingsConfigured?'Configured':'Missing',d.settingsConfigured?'green':'amber']
  ].map(([k,v,color])=>'<div><span>'+esc(k)+'</span><b class="status-text '+color+'">'+esc(v)+'</b></div>').join('');
  const email=document.getElementById('adminRepairEmail');if(email)email.value=d.ownerEmail||'';
  renderAdminConfigEditor();
  const list=document.getElementById('adminAuditList'),empty=document.getElementById('adminAuditEmpty'),audit=currentAdminTech.audit||[];
  if(list)list.innerHTML=audit.map(entry=>{
    const when=new Date(entry.at).toLocaleString(),who=entry.actorRole==='admin'?'Admin':'Client';
    const restorable=['workspace','settings','agent','automations','integrations','locations'].includes(entry.section)&&entry.before!==undefined;
    return '<article class="audit-entry"><div class="audit-head"><div><b>'+esc(entry.action.replaceAll('_',' '))+'</b><small>'+esc(when)+' · '+esc(who)+' · '+esc(entry.actorEmail||'unknown')+'</small></div><span class="tag">'+esc(entry.section||'system')+'</span></div><details><summary>Inspect change</summary><div class="audit-diff"><div><span>Before</span><pre>'+esc(JSON.stringify(entry.before,null,2))+'</pre></div><div><span>After</span><pre>'+esc(JSON.stringify(entry.after,null,2))+'</pre></div></div></details>'+(restorable?'<button class="secondary-btn audit-restore" data-restore-audit="'+esc(entry.id)+'">Restore previous snapshot</button>':'')+'</article>'
  }).join('');
  if(empty)empty.hidden=audit.length!==0;
  list?.querySelectorAll('[data-restore-audit]').forEach(b=>b.addEventListener('click',()=>restoreAdminAudit(b.dataset.restoreAudit)));
}
function renderAdminConfigEditor(){
  const section=document.getElementById('adminConfigSection')?.value||'settings',editor=document.getElementById('adminConfigEditor');if(!editor||!currentAdminTech)return;
  const value=currentAdminTech.config?.[section]??(section==='automations'||section==='locations'?[]:{});
  editor.value=JSON.stringify(value,null,2);
}
async function sendClientLogin(){
  if(!currentAdminClient)return;adminTechMessage('Sending secure sign-in link…');
  const r=await fetch('/api/account?action=admin-send-client-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id})}),data=await r.json().catch(()=>({}));
  adminTechMessage(r.ok?'Sign-in link sent to '+data.email:(data.error||'Could not send sign-in link.'),!r.ok);
  if(r.ok)await loadAdminTechSupport();
}
async function forceClientLogout(){
  if(!currentAdminClient||!confirm('Force this client to sign out of all existing CallerCore sessions?'))return;
  const r=await fetch('/api/account?action=admin-force-logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id})}),data=await r.json().catch(()=>({}));
  adminTechMessage(r.ok?'All existing client sessions have been revoked.':(data.error||'Could not revoke sessions.'),!r.ok);
  if(r.ok)await loadAdminTechSupport();
}
async function repairClientAccess(){
  if(!currentAdminClient)return;const email=(document.getElementById('adminRepairEmail')?.value||'').trim();
  if(!confirm('Repair the login mapping for '+email+' and revoke older sessions?'))return;
  const r=await fetch('/api/account?action=admin-repair-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id,email})}),data=await r.json().catch(()=>({}));
  adminTechMessage(r.ok?'Access mapping repaired for '+data.email:(data.error||'Could not repair access.'),!r.ok);
  if(r.ok){await refreshAdminCore();await loadAdminTechSupport()}
}
async function applyAdminConfigOverride(){
  if(!currentAdminClient)return;const section=document.getElementById('adminConfigSection')?.value||'settings',raw=document.getElementById('adminConfigEditor')?.value||'';
  let value;try{value=JSON.parse(raw)}catch(_){adminTechMessage('Configuration JSON is invalid.',true);return}
  if(!confirm('Apply this admin override to '+section+'? The previous value will remain available in Change History.'))return;
  const r=await fetch('/api/account?action=admin-config-override',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id,section,value})}),data=await r.json().catch(()=>({}));
  adminTechMessage(r.ok?'Admin override applied to '+section+'.':(data.error||'Could not apply override.'),!r.ok);
  if(r.ok){await refreshAdminCore();await loadAdminOps();await loadAdminTechSupport()}
}
async function restoreAdminAudit(auditId){
  if(!currentAdminClient||!confirm('Restore the configuration that existed before this change? A new audit entry will record the rollback.'))return;
  const r=await fetch('/api/account?action=admin-audit-restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id,auditId})}),data=await r.json().catch(()=>({}));
  adminTechMessage(r.ok?'Previous '+data.section+' configuration restored.':(data.error||'Could not restore snapshot.'),!r.ok);
  if(r.ok){await refreshAdminCore();await loadAdminOps();await loadAdminTechSupport()}
}
document.getElementById('adminConfigSection')?.addEventListener('change',renderAdminConfigEditor);
document.getElementById('adminReloadConfigButton')?.addEventListener('click',()=>loadAdminTechSupport());
document.getElementById('adminApplyOverrideButton')?.addEventListener('click',applyAdminConfigOverride);
document.getElementById('adminSendLoginButton')?.addEventListener('click',sendClientLogin);
document.getElementById('adminForceLogoutButton')?.addEventListener('click',forceClientLogout);
document.getElementById('adminRepairAccessButton')?.addEventListener('click',repairClientAccess);

function closeAdminClient(){document.getElementById('adminClientDrawer')?.classList.remove('open');document.getElementById('adminClientBackdrop')?.classList.remove('open')}

function adminGlobalSearchItems(q){
  const needle=String(q||'').trim().toLowerCase();if(needle.length<2)return[];
  const match=(parts)=>parts.filter(Boolean).join(' ').toLowerCase().includes(needle),items=[];
  for(const x of adminClientsData)if(match([x.name,x.ownerEmail,x.id,x.plan,x.subscriptionStatus]))items.push({type:'client',id:x.id,title:x.name||'Client',meta:[x.ownerEmail,x.plan,'Client account'].filter(Boolean).join(' · '),view:'clients'});
  for(const p of adminWebsiteData.prospects||[])if(match([p.name,p.business,p.email,p.phone,p.source,p.stage,p.plan,p.industry]))items.push({type:'prospect',id:p.id,title:p.name||p.business||p.email||'Website prospect',meta:[p.business,p.email,p.stage,'CallerCore prospect'].filter(Boolean).join(' · '),view:'website'});
  for(const t of adminSupportData||[])if(match([t.subject,t.workspaceName,t.email,t.message,t.priority,t.status]))items.push({type:'support',id:t.id,title:t.subject||'Support request',meta:[t.workspaceName,t.status,'Client care'].filter(Boolean).join(' · '),view:'client-care'});
  for(const x of adminPhoneData||[])if(match([x.id,x.number,x.forwardingFrom,x.transferNumber,x.workspaceName,x.provider]))items.push({type:'phone',id:String(x.id||''),title:x.number||'Phone number',meta:[x.workspaceName,x.provider,'Phone'].filter(Boolean).join(' · '),view:'phones'});
  for(const x of adminFeedbackData||[])if(match([x.id,x.workspaceName,x.actorEmail,x.category,x.message,x.status]))items.push({type:'feedback',id:String(x.id||''),title:x.workspaceName||'AI feedback',meta:[String(x.category||'feedback').replaceAll('_',' '),x.status,'Client care'].filter(Boolean).join(' · '),view:'client-care'});
  for(const x of adminFinanceData.expenses||[])if(match([x.id,x.name,x.vendor,x.category,x.notes]))items.push({type:'expense',id:String(x.id||''),title:x.name||'Expense',meta:[x.vendor,x.category,financeMoney(x.amount)].filter(Boolean).join(' · '),view:'finance'});
  for(const t of adminInboxData.gmail?.threads||[])if(match([t.subject,t.last?.from,t.last?.to,t.last?.snippet]))items.push({type:'gmail',id:t.id,title:t.subject||'Gmail thread',meta:[t.last?.from,'Gmail'].filter(Boolean).join(' · '),view:'inbox'});
  return items.slice(0,14);
}
function renderAdminGlobalSearch(){
  const input=document.getElementById('adminSearch'),wrap=document.getElementById('adminSearchResults');if(!input||!wrap)return;
  const q=input.value.trim(),items=adminGlobalSearchItems(q);
  if(q.length<2){wrap.hidden=true;wrap.innerHTML='';return}
  wrap.hidden=false;
  wrap.innerHTML=items.length?items.map(x=>'<button type="button" class="admin-search-result" data-global-search-type="'+esc(x.type)+'" data-global-search-id="'+esc(x.id||'')+'" data-global-search-view="'+esc(x.view)+'"><span>'+esc(x.title)+'</span><small>'+esc(x.meta||'')+'</small></button>').join(''):'<div class="admin-search-empty">No CallerCore records match “'+esc(q)+'”.</div>';
  wrap.querySelectorAll('[data-global-search-type]').forEach(b=>b.addEventListener('click',()=>openAdminGlobalSearchResult(b.dataset.globalSearchType,b.dataset.globalSearchId,b.dataset.globalSearchView)));
}
function flashAdminSearchTarget(el){
  if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('search-target-flash');setTimeout(()=>el.classList.remove('search-target-flash'),2200);
}
async function openAdminGlobalSearchResult(type,id,view){
  const input=document.getElementById('adminSearch'),wrap=document.getElementById('adminSearchResults');if(wrap)wrap.hidden=true;if(input)input.value='';
  if(type==='client'){showView('clients');await openAdminClient(id);return}
  if(type==='gmail'){showView('inbox');await openInboxItem('gmail',id);setTimeout(()=>flashAdminSearchTarget(document.querySelector('[data-inbox-kind="gmail"][data-inbox-id="'+CSS.escape(id)+'"]')),80);return}
  if(type==='support')openClientCare('support');else if(type==='feedback')openClientCare('feedback');else showView(view);
  setTimeout(()=>{
    if(type==='prospect')flashAdminSearchTarget(document.querySelector('[data-website-prospect-id="'+CSS.escape(id)+'"]'));
    else if(type==='support'){const el=document.querySelector('[data-support-ticket-id="'+CSS.escape(id)+'"]');if(el)el.open=true;flashAdminSearchTarget(el)}
    else if(type==='phone')flashAdminSearchTarget(document.querySelector('[data-edit-phone="'+CSS.escape(id)+'"]')?.closest('.call-row'));
    else if(type==='feedback')flashAdminSearchTarget(document.getElementById('feedback-'+id));
    else if(type==='expense')flashAdminSearchTarget(document.querySelector('[data-edit-expense="'+CSS.escape(id)+'"]')?.closest('.admin-expense-row'));
  },80);
}
document.getElementById('adminSearch')?.addEventListener('input',renderAdminGlobalSearch);
document.getElementById('adminSearch')?.addEventListener('keydown',e=>{if(e.key==='Escape'){const r=document.getElementById('adminSearchResults');if(r)r.hidden=true}});

document.getElementById('closeAdminClient')?.addEventListener('click',closeAdminClient);
document.getElementById('adminClientBackdrop')?.addEventListener('click',closeAdminClient);

async function refreshAdminCore(){
  const [sr,cr]=await Promise.all([
    fetch('/api/account?action=admin-summary',{headers:{Accept:'application/json'},cache:'no-store'}),
    fetch('/api/account?action=admin-clients',{headers:{Accept:'application/json'},cache:'no-store'})
  ]);
  if(sr.ok)adminSummaryData=(await sr.json()).summary||{};
  if(cr.ok)adminClientsData=(await cr.json()).clients||[];
  renderAdmin();
}
async function refreshAdminDashboard({button=null}={}){
  if(button){button.disabled=true;button.textContent='Refreshing…'}
  try{await refreshAdminCore();await loadAdminOps();updateAdminRefreshStamp();await loadNotifications({silent:true})}
  finally{if(button){button.disabled=false;button.textContent='Refresh'}}
}
function initAdminLiveRefresh(){
  const btn=document.getElementById('refreshAdminCommand');if(btn)btn.onclick=()=>refreshAdminDashboard({button:btn});
  if(adminRefreshTimer)clearInterval(adminRefreshTimer);
  adminRefreshTimer=setInterval(()=>{if(!document.hidden&&document.body.dataset.dashboard==='admin')refreshAdminDashboard().catch(()=>{})},60000);
}
async function saveAdminClient(){
  if(!currentAdminClient)return;
  const plan=document.getElementById('adminClientPlan')?.value;
  const status=document.getElementById('adminClientStatus')?.value;
  const r=await fetch('/api/account?action=admin-client-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id,plan,status})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not update client.');return}
  currentAdminClient={...currentAdminClient,plan:data.client.plan,status:data.client.status};
  await refreshAdminCore();await loadAdminOps();openAdminClient(currentAdminClient.id);
}
async function deleteAdminClient(){
  if(!currentAdminClient)return;
  const name=currentAdminClient.name||'this workspace';
  if(!confirm('Schedule '+name+' for deletion? Customer access will be disabled now and the workspace will enter a 30-day recovery period before permanent deletion can be completed.'))return;
  const typed=prompt('Type DELETE to schedule deletion of '+name+'.');
  if(typed!=='DELETE')return;
  const r=await fetch('/api/account?action=admin-client-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not delete workspace.');return}
  if(data.pendingDeletion&&data.purgeEligibleAt)alert(name+' is now pending deletion. Recovery is available until '+new Date(data.purgeEligibleAt).toLocaleString()+'.');
  closeAdminClient();currentAdminClient=null;await refreshAdminCore();await loadAdminOps();
}
async function viewAdminClient(){
  if(!currentAdminClient)return;
  const r=await fetch('/api/account?action=admin-view-client',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not open client view.');return}
  location.href=data.redirect||'/dashboard';
}
document.getElementById('adminSaveClientButton')?.addEventListener('click',saveAdminClient);
document.getElementById('adminDeleteClientButton')?.addEventListener('click',deleteAdminClient);
document.getElementById('adminViewClientButton')?.addEventListener('click',viewAdminClient);
document.getElementById('adminExportClientButton')?.addEventListener('click',()=>{if(currentAdminClient)window.location.href='/api/account?action=admin-workspace-export&id='+encodeURIComponent(currentAdminClient.id)});
document.getElementById('adminRecoveryDrillButton')?.addEventListener('click',async()=>{
  if(!currentAdminClient)return;
  const btn=document.getElementById('adminRecoveryDrillButton');if(btn){btn.disabled=true;btn.textContent='Checking…'}
  try{
    const r=await fetch('/api/account?action=admin-recovery-drill&id='+encodeURIComponent(currentAdminClient.id),{cache:'no-store'}),data=await r.json().catch(()=>({}));
    const sections=data.sections?Object.entries(data.sections).filter(([,ok])=>ok).length:0,total=data.sections?Object.keys(data.sections).length:0;
    const notes=[data.recoverable?'Core export is structurally recoverable.':'Recovery validation failed.',sections+'/'+total+' sections structurally present'];
    if(data.requiresProviderReconnect)notes.push('provider secrets require reconnection');
    if(Array.isArray(data.warnings)&&data.warnings.length)notes.push(data.warnings.join(' '));
    if(Array.isArray(data.issues)&&data.issues.length)notes.push('Issues: '+data.issues.join('; '));
    alert(notes.join('\n'));
  }finally{if(btn){btn.disabled=false;btn.textContent='Run recovery drill'}}
});


const modal=document.getElementById('upgradeModal');
function openModal(target){
  if(!modal||!PLAN_DATA[target])return;const t=PLAN_DATA[target],current=PLAN_DATA[currentPlan],losses=planLosses(currentPlan,target),upgrade=t.price>current.price;
  document.getElementById('modalTitle').textContent=(upgrade?'Upgrade to ':'Review downgrade to ')+target;
  document.getElementById('modalCopy').textContent=upgrade?'You’re adding capacity or features. Review the changes below before continuing to Stripe.':'This would lower your monthly price, but some CallerCore capabilities may no longer be available.';
  document.getElementById('modalFeatures').innerHTML=planFeatures(target).map(v=>'<span>✓ '+esc(v)+'</span>').join('');
  const loss=document.getElementById('modalLosses');if(loss){loss.hidden=!losses.length;loss.innerHTML=losses.length?'<b>What you would lose</b>'+losses.map(v=>'<span>− '+esc(v)+'</span>').join(''):''}
  document.getElementById('modalCta').textContent='Continue to Stripe';modal.classList.add('open');modal.setAttribute('aria-hidden','false')
}
function bindUpgradeButtons(){document.querySelectorAll('[data-upgrade]').forEach(b=>{b.onclick=()=>openModal(b.dataset.upgrade)})}
function closePlanModal(){modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true')}
modal?.querySelector('.modal-close')?.addEventListener('click',closePlanModal);modal?.addEventListener('click',e=>{if(e.target===modal)closePlanModal()});
document.getElementById('upgradeButton')?.addEventListener('click',()=>{const p=document.getElementById('planOptionsPanel');if(p){p.hidden=false;p.scrollIntoView({behavior:'smooth',block:'start'})}});
document.getElementById('closePlanOptions')?.addEventListener('click',()=>{const p=document.getElementById('planOptionsPanel');if(p)p.hidden=true});
async function openBillingPortal(button,label='Opening…'){if(button){button.disabled=true;button.textContent=label}const r=await fetch('/api/account?action=billing-portal',{method:'POST'}),data=await r.json().catch(()=>({}));if(r.ok&&data.url)location.href=data.url;else{alert(data.error||'Billing portal is unavailable.');if(button){button.disabled=false;button.textContent=button.dataset.original||'Manage billing'}}}
document.getElementById('paymentButton')?.addEventListener('click',async e=>{const b=e.currentTarget;b.dataset.original='Manage billing & invoices';await openBillingPortal(b)});
document.getElementById('modalCta')?.addEventListener('click',async e=>{const b=e.currentTarget;b.dataset.original='Continue to Stripe';await openBillingPortal(b,'Opening Stripe…')});
const retentionModal=document.getElementById('retentionModal');
function closeRetention(){retentionModal?.classList.remove('open');retentionModal?.setAttribute('aria-hidden','true')}
function openRetention(){if(!retentionModal)return;document.getElementById('retentionStatus').textContent='';retentionModal.classList.add('open');retentionModal.setAttribute('aria-hidden','false')}
document.getElementById('retentionButton')?.addEventListener('click',openRetention);retentionModal?.querySelector('.retention-close')?.addEventListener('click',closeRetention);retentionModal?.addEventListener('click',e=>{if(e.target===retentionModal)closeRetention()});
async function requestRetention(kind){
  const status=document.getElementById('retentionStatus'),copy=kind==='pause'?'I would like to discuss temporarily pausing my CallerCore subscription. Please contact me before making any changes.':'I am considering cancelling and would like to review any available retention options, incentives, or a better-fit plan before I decide.';
  if(status)status.textContent='Sending request…';try{const r=await fetch('/api/account?action=support-ticket-create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:kind==='pause'?'Subscription pause request':'Subscription save-options request',message:copy,priority:'normal'})}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not send request');if(status)status.textContent='Request sent. CallerCore support will follow up before any subscription change.'}catch(err){if(status)status.textContent=err.message||'Could not send request'}}
retentionModal?.querySelectorAll('[data-retention]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.retention;if(kind==='plan'){closeRetention();const p=document.getElementById('planOptionsPanel');if(p){p.hidden=false;p.scrollIntoView({behavior:'smooth'})}}else requestRetention(kind)}));
document.getElementById('continueCancelButton')?.addEventListener('click',async e=>{const b=e.currentTarget;b.dataset.original='Continue to cancellation options';await openBillingPortal(b,'Opening cancellation options…')});


function profileInitials(name,email=''){
  const source=String(name||email.split('@')[0]||'CC').trim();
  const parts=source.split(/\s+/).filter(Boolean);
  return (parts.length>1?(parts[0][0]+parts[1][0]):source.slice(0,2)).toUpperCase();
}
function applyUserProfile(user={},workspace={}){
  const p=user.profile||{},email=String(user.email||currentUserProfile.email||''),name=String(p.displayName||workspace.ownerName||email.split('@')[0]||'CallerCore User');
  currentUserProfile={displayName:name,email,avatarDataUrl:String(p.avatarDataUrl||'')};
  renderUserProfile();
}
function renderUserProfile(){
  const p=currentUserProfile,initials=profileInitials(p.displayName,p.email);
  const name=document.getElementById('profileDisplayName'),email=document.getElementById('profileEmail'),input=document.getElementById('profileNameInput');
  if(name)name.textContent=p.displayName;if(email)email.textContent=p.email;if(input&&!input.matches(':focus'))input.value=p.displayName;
  for(const id of ['profileInitials','profileInitialsLarge']){const el=document.getElementById(id);if(el)el.textContent=initials}
  for(const id of ['profileAvatarImage','profileAvatarImageLarge']){
    const img=document.getElementById(id),initial=img?.previousElementSibling;if(!img)continue;
    if(p.avatarDataUrl){img.src=p.avatarDataUrl;img.hidden=false;if(initial)initial.hidden=true}
    else{img.removeAttribute('src');img.hidden=true;if(initial)initial.hidden=false}
  }
  const remove=document.getElementById('profilePhotoRemove');if(remove)remove.hidden=!p.avatarDataUrl;
}
async function resizeProfilePhoto(file){
  if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Choose a JPG, PNG, or WebP image.');
  if(file.size>8*1024*1024)throw new Error('Choose an image smaller than 8 MB.');
  const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read image'));r.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Could not load image'));i.src=src});
  const size=256,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d'),scale=Math.max(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale;
  ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
  return canvas.toDataURL('image/jpeg',.84);
}
async function saveProfile(){
  const input=document.getElementById('profileNameInput'),status=document.getElementById('profileSaveStatus'),btn=document.getElementById('profileSaveButton');
  const displayName=String(input?.value||'').trim();if(!displayName){if(status)status.textContent='Enter your name.';return}
  if(btn){btn.disabled=true;btn.textContent='Saving…'}if(status)status.textContent='';
  try{
    const r=await fetch('/api/account?action=profile-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName,avatarDataUrl:currentUserProfile.avatarDataUrl||''})}),data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Could not save profile');
    currentUserProfile={...currentUserProfile,...data.profile};renderUserProfile();if(status)status.textContent='Saved.';
  }catch(err){if(status)status.textContent=err.message||'Could not save profile'}
  finally{if(btn){btn.disabled=false;btn.textContent='Save profile'}}
}
function initProfileControls(){
  const button=document.getElementById('accountButton'),panel=document.getElementById('accountPanel'),photoInput=document.getElementById('profilePhotoInput');
  if(!button||!panel)return;renderUserProfile();
  button.addEventListener('click',e=>{e.stopPropagation();panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){resetSurfaceScroll(panel);document.getElementById('profileNameInput')?.focus()}});
  panel.addEventListener('click',e=>e.stopPropagation());
  document.getElementById('profilePhotoButton')?.addEventListener('click',()=>photoInput?.click());
  photoInput?.addEventListener('change',async()=>{
    const status=document.getElementById('profileSaveStatus');
    try{const data=await resizeProfilePhoto(photoInput.files?.[0]);currentUserProfile.avatarDataUrl=data;renderUserProfile();if(status)status.textContent='Photo ready — save profile.'}
    catch(err){if(status)status.textContent=err.message||'Could not use that image'}
    photoInput.value='';
  });
  document.getElementById('profilePhotoRemove')?.addEventListener('click',()=>{currentUserProfile.avatarDataUrl='';renderUserProfile();const s=document.getElementById('profileSaveStatus');if(s)s.textContent='Photo removed — save profile.'});
  document.getElementById('profileSaveButton')?.addEventListener('click',saveProfile);
  document.getElementById('profilePanelLogout')?.addEventListener('click',logout);
  document.addEventListener('click',()=>{panel.hidden=true;button.setAttribute('aria-expanded','false')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;button.setAttribute('aria-expanded','false')}})
}

function notificationScope(){return document.body.dataset.dashboard==='admin'?'admin':'client'}
function notificationKindIcon(kind){
  return kind==='danger'?'!':kind==='warning'?'!':kind==='success'?'✓':'•'
}
async function loadNotifications({silent=true}={}){
  if(demoMode||notificationsLoading||!document.getElementById('notificationBell'))return;
  notificationsLoading=true;
  try{
    const scope=notificationScope(),r=await fetch('/api/account?action=notifications&scope='+scope,{headers:{Accept:'application/json'},cache:'no-store'});
    if(r.ok){
      const data=await r.json();notificationData=data.notifications||[];notificationUnreadCount=Number(data.unreadCount||0);renderNotifications();
    }
  }catch(e){if(!silent)console.error('Notifications failed',e)}
  finally{notificationsLoading=false}
}
function renderNotifications(){
  const badge=document.getElementById('notificationBadge'),list=document.getElementById('notificationList'),empty=document.getElementById('notificationEmpty'),items=notificationMode==='history'?notificationData:notificationData.filter(n=>!n.read);
  if(badge){badge.textContent=notificationUnreadCount>99?'99+':String(notificationUnreadCount);badge.hidden=notificationUnreadCount===0}
  document.querySelectorAll('[data-notification-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.notificationMode===notificationMode));
  if(!list)return;
  list.innerHTML=items.map(n=>'<button class="notification-item '+(n.read?'read':'unread')+'" data-notification-id="'+esc(n.id)+'"><span class="notification-dot '+esc(n.kind||'info')+'">'+notificationKindIcon(n.kind)+'</span><span class="notification-copy"><b>'+esc(n.title||'Notification')+'</b><span>'+esc(n.body||'')+'</span><small>'+formatNotificationTime(n.createdAt)+(n.read?' · Read':'')+'</small></span><span class="notification-open-cue">→</span></button>').join('');
  if(empty){empty.hidden=items.length!==0;empty.textContent=notificationMode==='history'?'No notification history yet.':'No unread notifications.'}
  list.querySelectorAll('[data-notification-id]').forEach(b=>b.addEventListener('click',()=>openNotification(b.dataset.notificationId)));
  renderSidebarNotificationDots();
}
function renderSidebarNotificationDots(){
  document.querySelectorAll('.nav-item[data-view]').forEach(btn=>{
    const view=btn.dataset.view,items=notificationData.filter(n=>!n.read&&(n.view||'overview')===view),count=items.length;
    btn.classList.toggle('nav-has-alert',count>0);
    btn.dataset.alertCount=count?String(count):'';
    if(count)btn.title=count+' unread alert'+(count===1?'':'s')+' in '+view.replaceAll('-',' ');
    else if(btn.title&&btn.title.includes('unread alert'))btn.removeAttribute('title');
  });
}
async function markViewNotificationsRead(view){
  const ids=notificationData.filter(n=>!n.read&&(n.view||'overview')===view).map(n=>n.id);
  if(ids.length)await markNotifications(ids);
}
function formatNotificationTime(ts){
  const t=Number(ts||0);if(!t)return '';
  const diff=Math.max(0,Date.now()-t),m=Math.floor(diff/60000);
  if(m<1)return 'Just now';if(m<60)return m+'m ago';
  const h=Math.floor(m/60);if(h<24)return h+'h ago';
  const d=Math.floor(h/24);if(d<7)return d+'d ago';
  return new Date(t).toLocaleDateString();
}
async function markNotifications(ids){
  if(!ids?.length)return;
  const scope=notificationScope();
  await fetch('/api/account?action=notifications-read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope,ids})}).catch(()=>{});
  const set=new Set(ids);notificationData.forEach(n=>{if(set.has(n.id))n.read=true});notificationUnreadCount=notificationData.filter(n=>!n.read).length;renderNotifications();
}
async function navigateNotification(n){
  if(!n)return false;const view=n.view||'overview',meta=n.meta||{};
  if(document.body.dataset.dashboard==='client'){
    if(meta.callId){
      const call=callsData.find(x=>String(x.id)===String(meta.callId));if(!call)return false;
      showView('calls');await openCall(String(meta.callId));return true;
    }
    if(meta.ticketId){
      showView('support');renderSupport();let thread=document.querySelector('[data-support-ticket-id="'+CSS.escape(String(meta.ticketId))+'"]');
      if(!thread){
        try{const data=await fetchJsonRetry('/api/account?action=support-tickets',{attempts:1,timeout:6000});supportTicketsData=data.tickets||[];renderSupport();thread=document.querySelector('[data-support-ticket-id="'+CSS.escape(String(meta.ticketId))+'"]')}catch(_){}
      }
      if(thread){thread.open=true;thread.scrollIntoView({behavior:'smooth',block:'center'});return true}return false;
    }
  }
  if(document.body.dataset.dashboard==='admin'){
    if(meta.workspaceId&&(view==='clients'||view==='revenue')){showView('clients');await openAdminClient(String(meta.workspaceId));return true}
    showView(view);
    await new Promise(resolve=>setTimeout(resolve,60));
    let target=null;
    if(meta.ticketId){target=document.querySelector('[data-support-ticket-id="'+CSS.escape(String(meta.ticketId))+'"]');if(target?.tagName==='DETAILS')target.open=true}
    else if(meta.feedbackId)target=document.getElementById('feedback-'+String(meta.feedbackId));
    else if(meta.workspaceId&&view==='provisioning')target=document.querySelector('[data-provision-id="'+CSS.escape(String(meta.workspaceId))+'"]');
    else if(meta.workspaceId&&view==='usage')target=[...document.querySelectorAll('#adminUsageList .admin-event')].find(el=>el.textContent.includes(adminClientsData.find(x=>String(x.id)===String(meta.workspaceId))?.name||''));
    if(target){flashAdminSearchTarget(target);return true}
    const viewTarget=document.getElementById('view-'+view);return !!viewTarget;
  }
  const target=document.getElementById('view-'+view);if(target){showView(view);return true}
  return false;
}
async function openNotification(id){
  const n=notificationData.find(x=>x.id===id);if(!n)return;
  const opened=await navigateNotification(n);if(!opened)return;
  if(!n.read)await markNotifications([id]);
  const panel=document.getElementById('notificationPanel'),bell=document.getElementById('notificationBell');if(panel)panel.hidden=true;if(bell)bell.setAttribute('aria-expanded','false');
}
async function markAllNotifications(){
  const scope=notificationScope();
  await fetch('/api/account?action=notifications-read-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope})}).catch(()=>{});
  notificationData.forEach(n=>n.read=true);notificationUnreadCount=0;renderNotifications();
}
function initNotifications(){
  const bell=document.getElementById('notificationBell'),panel=document.getElementById('notificationPanel');if(!bell||!panel)return;
  bell.addEventListener('click',e=>{e.stopPropagation();panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){resetSurfaceScroll(panel);loadNotifications({silent:true})}});
  panel.addEventListener('click',e=>e.stopPropagation());
  document.getElementById('notificationReadAll')?.addEventListener('click',markAllNotifications);
  panel.querySelectorAll('[data-notification-mode]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();notificationMode=btn.dataset.notificationMode||'unread';renderNotifications()}));
  document.addEventListener('click',()=>{panel.hidden=true;bell.setAttribute('aria-expanded','false')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;bell.setAttribute('aria-expanded','false')}});
  loadNotifications({silent:true});
  setInterval(()=>{if(!document.hidden)loadNotifications({silent:true})},60000);
}

(async()=>{if(document.body.dataset.dashboard==='admin'){const ok=await bootstrapAdmin();if(ok){initProfileControls();initNotifications()}return}const ok=await bootstrapClient();if(!ok)return;if(document.body.dataset.dashboard==='client'){setPlan(currentPlan);await loadOperations();initProfileControls();initNotifications()}else{renderBilling()}})();
document.getElementById('logoutButton')?.addEventListener('click',logout);

document.getElementById('clientDataRetry')?.addEventListener('click',async()=>{setDataHealth('clientDataHealth',false);await loadOperations()});
document.getElementById('adminDataRetry')?.addEventListener('click',async()=>{setDataHealth('adminDataHealth',false);await loadAdminOps()});

document.querySelectorAll('[data-overview-jump]').forEach(card=>{const go=()=>showView(card.dataset.overviewJump);card.addEventListener('click',e=>{if(e.target.closest('button,a'))return;go()});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})});

const helpButton=document.getElementById('helpButton'),helpPanel=document.getElementById('helpPanel'),helpShell=helpButton?.closest('.help-shell');
function closeHelpPanel(){if(helpPanel)helpPanel.hidden=true;if(helpButton)helpButton.setAttribute('aria-expanded','false')}
helpButton?.addEventListener('click',e=>{e.stopPropagation();const opening=!!helpPanel?.hidden;if(helpPanel){helpPanel.hidden=!opening;if(opening)resetSurfaceScroll(helpPanel)}if(helpButton)helpButton.setAttribute('aria-expanded',opening?'true':'false')});
document.addEventListener('click',e=>{if(helpShell&&!helpShell.contains(e.target))closeHelpPanel()});
helpPanel?.querySelectorAll('[data-help-action]').forEach(btn=>btn.addEventListener('click',()=>{const action=btn.dataset.helpAction;closeHelpPanel();if(action==='billing'){showView('billing');return}showView('support');setTimeout(()=>{const subject=document.getElementById('supportSubject'),message=document.getElementById('supportMessage');if(action==='call-issue'&&subject){subject.value='Call review / issue';if(message&&!message.value)message.placeholder='Include the caller, approximate time, phone number, and what looked wrong.';subject.focus()}else subject?.focus()},50)}));
document.querySelectorAll('#overviewChartRange [data-chart-days]').forEach(btn=>btn.addEventListener('click',()=>{overviewChartDays=Number(btn.dataset.chartDays||14);document.querySelectorAll('#overviewChartRange [data-chart-days]').forEach(x=>x.classList.toggle('active',x===btn));renderOverview()}));

document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  closeHelpPanel?.();
  const np=document.getElementById('notificationPanel'),nb=document.getElementById('notificationBell');if(np&&!np.hidden){np.hidden=true;nb?.setAttribute('aria-expanded','false')}
  const openModalEl=document.querySelector('.modal.open');if(openModalEl)openModalEl.querySelector('.modal-close')?.click();
});

document.getElementById('toggleAiAnsweringButton')?.addEventListener('click',toggleAiAnswering);

document.querySelectorAll('[data-call-quick]').forEach(btn=>btn.addEventListener('click',()=>{callQuickFilter=btn.dataset.callQuick||'all';renderCalls()}));
document.getElementById('toggleCallMoreFilters')?.addEventListener('click',()=>{callMoreFiltersOpen=!callMoreFiltersOpen;updateCustomDateVisibility()});
document.getElementById('resetCallFilters')?.addEventListener('click',()=>{
  const q=document.getElementById('callSearch'),date=document.getElementById('callDateFilter'),type=document.getElementById('callCategoryFilter'),outcome=document.getElementById('callFilter'),from=document.getElementById('callDateFrom'),to=document.getElementById('callDateTo'),group=document.getElementById('callGroupBy'),sort=document.getElementById('callSort');
  if(q)q.value='';if(date)date.value='7';if(type)type.value='all';if(outcome)outcome.value='all';if(from)from.value='';if(to)to.value='';if(group)group.value='day';if(sort)sort.value='newest';callLogGroupBy='day';callLogSort='newest';callQuickFilter='all';callMoreFiltersOpen=false;saveCallLogPrefs();updateCustomDateVisibility();renderCalls();
});

document.getElementById('teamCompletionReason')?.addEventListener('change',e=>{const wrap=document.getElementById('teamCompletionOtherWrap');if(wrap)wrap.hidden=e.target.value!=='other'});
document.getElementById('closeTeamStatusModal')?.addEventListener('click',closeTeamStatusModal);
document.getElementById('cancelTeamStatusModal')?.addEventListener('click',closeTeamStatusModal);
document.getElementById('saveTeamStatusModal')?.addEventListener('click',saveTeamStatusCompletion);
