const PLAN_DATA={
Starter:{price:349,minutes:300,locations:1,used:214,features:{appointments:false,sms:false,automations:false,advancedAnalytics:false,apiAccess:false,unifiedInbox:false},unlock:'Growth'},
Growth:{price:599,minutes:600,locations:2,used:428,features:{appointments:false,sms:false,automations:true,advancedAnalytics:true,apiAccess:false,unifiedInbox:true},unlock:'Pro'},
Pro:{price:999,minutes:null,locations:5,used:1240,features:{appointments:false,sms:false,automations:true,advancedAnalytics:true,apiAccess:true,unifiedInbox:true},unlock:null}
};
const FEATURE_INFO={
appointments:{title:'Appointment booking',copy:'Calendar-connected booking is planned for a later release.',tier:'Growth',deferred:true,items:['Calendar sync','Booking rules','Confirmations','Reschedule handling']},
automations:{title:'Advanced automations',copy:'Build follow-up sequences from call and lead events.',tier:'Growth',items:['Missed-call recovery','Lead follow-up','Team alerts','AI outbound steps']},
advancedAnalytics:{title:'Advanced analytics',copy:'Go beyond totals with conversion trends, call reasons and after-hours impact.',tier:'Growth',items:['Conversion trends','Call reason analysis','After-hours revenue','Lead attribution']},
apiAccess:{title:'API & webhooks',copy:'Connect CallerCore to custom tools and internal systems.',tier:'Pro',items:['Webhooks','API credentials','Custom events','Advanced integrations']},
unifiedInbox:{title:'Unified inbox',copy:'Keep customer call and digital conversation history in one timeline.',tier:'Growth',items:['Call timeline','Shared notes','Website inquiries','Cross-channel history']}
};
const params=new URLSearchParams(location.search);
const demoMode=location.hostname.endsWith('.vercel.app')&&params.get('demo')==='1';
let currentPlan=params.get('plan')||'Growth';if(!PLAN_DATA[currentPlan])currentPlan='Growth';
let sessionWorkspace=null,sessionOnboarding=null;
let currentUserProfile={displayName:'CallerCore User',email:'',avatarDataUrl:''};
let notificationData=[],notificationUnreadCount=0,notificationsLoading=false;
let callsData=[],leadsData=[],conversationsData=[],appointmentsData=[],agentData=null,automationsData=[],analyticsData=null,settingsData=null,integrationsData=null,supportTicketsData=[],phoneRoutingData=null,locationsData=[],locationsLimit=1;let conversationFilter='all',activeConversationId=null,activeCallContactKey='',activeCallId='',followupState={},showHandledFollowups=false,agentEditing=false,settingsEditing=false,pendingBusinessLogo=null,agentEditSnapshot=null;
const DEMO_CALLS=[
{id:'c1',caller:'Sarah Johnson',phone:'(509) 555-0148',reason:'Roof replacement estimate',duration:'4:32',outcome:'Booked',agent:'Maya',time:'3:14 PM',summary:'Sarah owns a two-story home and wants a full roof replacement estimate. Maya confirmed the property is in the service area and booked an inspection for Tuesday at 10:30 AM.',qualification:{Intent:'High',Service:'Replacement',Timeline:'This month',Value:'$8,500'},transcript:[['Maya','Thank you for calling Alpine Roofing. This is Maya. How can I help?'],['Sarah','I need an estimate to replace my roof.'],['Maya','Absolutely. I can help get an inspection scheduled. Is the property in Spokane?'],['Sarah','Yes, on the South Hill.']]},
{id:'c2',caller:'Mike Peterson',phone:'(509) 555-0193',reason:'Storm damage inspection',duration:'3:17',outcome:'Qualified',agent:'Maya',time:'2:57 PM',summary:'Mike reported visible shingle damage after a recent storm. He is the homeowner, is within the service area, and asked for an inspection this week.',qualification:{Intent:'High',Service:'Storm damage',Timeline:'This week',Value:'$4,200'},transcript:[['Maya','Tell me what happened with the roof.'],['Mike','We lost shingles in the wind and I can see damage from the yard.'],['Maya','Got it. Are you the homeowner?'],['Mike','Yes.']]},
{id:'c3',caller:'Unknown caller',phone:'Private',reason:'Missed call follow-up',duration:'—',outcome:'Follow-up',agent:'Recovery',time:'2:41 PM',summary:'The caller disconnected before the AI answered. CallerCore created a follow-up item for the team.',qualification:{Intent:'Unknown',Service:'Unknown',Timeline:'Unknown',Value:'—'},transcript:[['CallerCore','Missed call detected. Team follow-up created.']]}
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
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));document.querySelector('.sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});markViewNotificationsRead(name);if(name==='overview')renderOverview();if(name==='billing')renderBilling();if(name==='calls')renderCalls();if(name==='contacts')renderContacts();if(name==='leads')renderLeads();if(name==='conversations')renderConversations();if(name==='appointments')renderAppointments();if(name==='agent')renderAgent();if(name==='automations')renderAutomations();if(name==='analytics')renderAnalytics();if(name==='integrations')renderIntegrations();if(name==='settings')renderSettings();if(name==='inbox'&&document.body.dataset.dashboard==='admin')loadAdminInbox();
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelector('.mobile-menu')?.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('open'));
window.addEventListener('beforeunload',e=>{if(document.body.dataset.dashboard==='client'&&(agentEditing||settingsEditing)){e.preventDefault();e.returnValue=''}});

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
  return name==='Starter'?['300 included minutes','1 location','Core call handling','AI receptionist','Phone routing & support']:name==='Growth'?['600 included minutes','Up to 2 locations','Everything in Starter','Unified conversations','Automations','Advanced insights']:['High-volume workflows','Up to 5 locations','Everything in Growth','API & webhooks'];
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
  const benefits=document.getElementById('currentPlanBenefits');if(benefits)benefits.innerHTML=planFeatures(currentPlan).map(x=>'<span>✓ '+esc(x)+'</span>').join('');
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
function renderClientData(){
  renderCalls();renderLeads();renderConversations();renderAppointments();renderAgent();renderAutomations();renderAnalytics();renderIntegrations();renderSettings();renderOverview();renderBillingConnection();renderPhoneRouting();renderLocations();
}
async function loadOperations(){
  if(demoMode){setDataHealth('clientDataHealth',false);
    callsData=DEMO_CALLS.map(x=>({...x}));leadsData=DEMO_LEADS.map(x=>({...x}));conversationsData=DEMO_CONVERSATIONS.map(x=>({...x}));appointmentsData=DEMO_APPOINTMENTS.map(x=>({...x}));agentData={...DEMO_AGENT,qualificationQuestions:[...DEMO_AGENT.qualificationQuestions]};automationsData=DEMO_AUTOMATIONS.map(x=>({...x}));settingsData={...DEMO_SETTINGS};integrationsData={...DEMO_INTEGRATIONS,apiAccess:has('apiAccess')};phoneRoutingData={number:'(509) 555-0100',label:'Primary',provider:'Vapi',forwardingFrom:'(509) 555-0199',transferNumber:'(509) 555-0101',afterHours:'ai',smsEnabled:false,status:'active'};locationsData=[{id:'loc-demo',name:'Spokane',phone:'(509) 555-0199',address:'Spokane, WA',timezone:'America/Los_Angeles',active:true}];locationsLimit=PLAN_DATA[currentPlan].locations||1;analyticsData=buildLocalAnalytics();followupState={};renderClientData();renderSupport();renderClientSetupStatus();return;
  }
  setClientLoading(true);setDataHealth('clientDataHealth',false);
  try{
    const data=await fetchJsonRetry('/api/account?action=client-dashboard-data',{attempts:3,timeout:7000});
    callsData=data.calls||[];leadsData=data.leads||[];agentData=data.agent||null;settingsData=data.settings||null;integrationsData=data.integrations||null;phoneRoutingData=data.routing||null;locationsData=data.locations||[];locationsLimit=Number(data.locationsLimit||1);conversationsData=data.conversations||[];appointmentsData=data.appointments||[];automationsData=data.automations||[];followupState=data.followupState||{};analyticsData=buildLocalAnalytics();
    renderClientData();setClientLoading(false);
    // Non-critical support history loads separately so it can never block Today.
    fetchJsonRetry('/api/account?action=support-tickets',{attempts:2,timeout:6000}).then(data=>{supportTicketsData=data.tickets||[];renderSupport()}).catch(err=>console.warn('Support history delayed',err));
    return;
  }catch(err){console.warn('Bundled dashboard load failed; using fallback',err);setClientLoading(true,'Still loading — retrying your workspace data…')}
  try{
    const requests=[
      ['calls','calls'],['leads','leads'],['agent','agent'],['settings','settings'],['integrations','integrations'],['phone-routing','routing'],['locations','locations']
    ];
    const settled=await Promise.allSettled(requests.map(([action])=>fetchJsonRetry('/api/account?action='+action,{attempts:2,timeout:7000})));
    for(let i=0;i<settled.length;i++){if(settled[i].status!=='fulfilled')continue;const [action,key]=requests[i],data=settled[i].value;if(action==='calls')callsData=data.calls||[];else if(action==='leads')leadsData=data.leads||[];else if(action==='agent')agentData=data.agent||null;else if(action==='settings')settingsData=data.settings||null;else if(action==='integrations')integrationsData=data.integrations||null;else if(action==='phone-routing')phoneRoutingData=data.routing||null;else if(action==='locations'){locationsData=data.locations||[];locationsLimit=Number(data.limit||1)}}
    await loadFollowupState();analyticsData=buildLocalAnalytics();renderClientData();setDataHealth('clientDataHealth',settled.some(x=>x.status==='rejected'));setClientLoading(false);
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
function renderOverview(){
  const callTimes=callsData.map(recordTime).filter(Boolean),todayCalls=callsData.filter(x=>sameLocalDay(recordTime(x))).length,weekCalls=callsData.filter(x=>withinDays(recordTime(x),7)).length,monthCalls=callsData.filter(x=>withinDays(recordTime(x),30)).length;
  const weekLeads=callsData.filter(x=>withinDays(recordTime(x),7)&&/qualif/i.test(String(x.outcome||''))).length;
  const followups=followupCandidates().filter(x=>withinDays(recordTime(x),7)&&!followupIsHandled(x)).length;
  const qualified30=callsData.filter(x=>withinDays(recordTime(x),30)&&/book|qualif/i.test(String(x.outcome||''))).length;
  const activeDays=new Set(callsData.filter(x=>withinDays(recordTime(x),30)).map(x=>new Date(recordTime(x)).toDateString())).size;
  const dailyAvg=activeDays?Math.round(monthCalls/activeDays*10)/10:0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('overviewCalls',todayCalls);set('overviewWeekCalls',weekCalls);set('overviewLeads',weekLeads);set('overviewFollowup',followups);
  set('overviewCallsMeta',todayCalls===1?'1 call so far today':todayCalls+' calls so far today');
  set('overviewWeekCallsMeta',weekCalls+' handled in the last 7 days');
  set('overviewLeadsMeta',weekLeads+' surfaced in the last 7 days');
  set('overviewFollowupMeta',followups?'Calls waiting for your team':'Nothing waiting');const attentionCard=document.getElementById('overviewAttentionCard');if(attentionCard)attentionCard.classList.toggle('has-attention',followups>0);
  const name=agentData?.name||'Maya';set('overviewAgentName',name+' is online');
  const recent60=callsData.filter(x=>withinDays(recordTime(x),60)),answered60=recent60.filter(x=>!/miss/i.test(String(x.outcome||''))).length,qualified60=recent60.filter(x=>/book|qualif/i.test(String(x.outcome||''))).length,clean60=recent60.filter(x=>!/miss|follow/i.test(String(x.outcome||''))).length;
  const answerPct=recent60.length?Math.round(answered60/recent60.length*100):0,qualifiedPct=recent60.length?Math.round(qualified60/recent60.length*100):0,recoveryPct=recent60.length?Math.round(clean60/recent60.length*100):0;
  [['overviewAnswerRing','overviewAnswerPct',answerPct],['overviewQualifiedRing','overviewQualifiedPct',qualifiedPct],['overviewRecoveryRing','overviewRecoveryPct',recoveryPct]].forEach(([ringId,textId,pct])=>{const ring=document.getElementById(ringId),txt=document.getElementById(textId);if(ring)ring.style.setProperty('--pct',pct);if(txt)txt.textContent=pct+'%'});
  set('overviewAgentMeta','Handling incoming calls for '+(settingsData?.businessName||sessionWorkspace?.name||'your business')+'.');
  set('overviewAgentCalls',monthCalls);set('overviewAgentLeads',qualified30);set('overviewDailyAvg',dailyAvg);
  const chart=document.getElementById('overviewLineChart');
  if(chart){
    const days=[];for(let i=13;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const next=d.getTime()+86400000,n=callsData.filter(x=>{const t=recordTime(x);return t>=d.getTime()&&t<next}).length;days.push({label:d.toLocaleDateString(undefined,{month:'short',day:'numeric'}),short:d.toLocaleDateString(undefined,{weekday:'short'}),n})}
    const max=Math.max(1,...days.map(d=>d.n)),min=0,w=760,h=210,pad={l:36,r:14,t:20,b:34},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b;
    const pts=days.map((d,i)=>({x:pad.l+(plotW*(i/(days.length-1))),y:pad.t+plotH-(d.n-min)/(max-min||1)*plotH,...d}));
    const line=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' '),area=line+' L '+pts[pts.length-1].x.toFixed(1)+' '+(pad.t+plotH)+' L '+pts[0].x.toFixed(1)+' '+(pad.t+plotH)+' Z';
    const grid=[0,.5,1].map(r=>{const y=pad.t+plotH*(1-r),v=Math.round(max*r);return '<line x1="'+pad.l+'" y1="'+y+'" x2="'+(w-pad.r)+'" y2="'+y+'" class="chart-grid"/><text x="'+(pad.l-8)+'" y="'+(y+3)+'" class="chart-axis" text-anchor="end">'+v+'</text>'}).join('');
    const labels=pts.map((p,i)=>i%2===0||i===pts.length-1?'<text x="'+p.x+'" y="'+(h-10)+'" class="chart-axis" text-anchor="middle">'+esc(p.short)+'</text>':'').join('');
    const dots=pts.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="4" class="chart-dot" data-label="'+esc(p.label)+'" data-count="'+p.n+'"><title>'+esc(p.label)+' · '+p.n+' calls</title></circle>').join('');
    chart.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" role="img"><defs><linearGradient id="callArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#c85d35" stop-opacity=".22"/><stop offset="100%" stop-color="#c85d35" stop-opacity=".02"/></linearGradient></defs>'+grid+'<path d="'+area+'" class="chart-area"/><path d="'+line+'" class="chart-line"/>'+dots+labels+'</svg>';
    const total=days.reduce((n,d)=>n+d.n,0),avg=Math.round(total/days.length*10)/10,peak=Math.max(...days.map(d=>d.n)),summary=document.getElementById('overviewChartSummary'),peakEl=document.getElementById('overviewChartPeak');if(summary)summary.textContent=avg+' calls/day average';if(peakEl)peakEl.textContent='Peak '+peak+' calls';
    const tip=document.getElementById('overviewChartTooltip');chart.querySelectorAll('.chart-dot').forEach(dot=>{dot.addEventListener('mouseenter',()=>{if(!tip)return;tip.innerHTML='<b>'+esc(dot.dataset.count)+' calls</b><span>'+esc(dot.dataset.label)+'</span>';tip.hidden=false});dot.addEventListener('mousemove',e=>{if(!tip)return;const r=chart.getBoundingClientRect();tip.style.left=(e.clientX-r.left+12)+'px';tip.style.top=(e.clientY-r.top-8)+'px'});dot.addEventListener('mouseleave',()=>{if(tip)tip.hidden=true})});
  }
  const attention=document.getElementById('overviewAttention');
  if(attention){
    const open=[...followupCandidates()].filter(x=>!followupIsHandled(x)).sort((a,b)=>{
      const ap=followupType(a)==='urgent'?1:0,bp=followupType(b)==='urgent'?1:0;return bp-ap||recordTime(b)-recordTime(a)
    }).slice(0,4);
    attention.innerHTML=open.length?open.map(x=>{
      const type=followupType(x),label=followupLabel(type),time=recordTime(x)?new Date(recordTime(x)).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
      return '<button class="attention-call '+(type==='urgent'?'urgent':'')+'" data-call-id="'+esc(x.id)+'"><span class="attention-call-badge">'+esc(label)+'</span><span class="attention-call-copy"><b>'+esc(x.caller||'Unknown caller')+'</b><small>'+esc(x.reason||'Call requires review')+'</small><em>'+esc(time)+'</em></span><span class="attention-call-arrow">→</span></button>';
    }).join(''):'<div class="attention-clear"><b>You’re caught up.</b><span>No calls are waiting for your team.</span></div>';
    attention.querySelectorAll('[data-call-id]').forEach(b=>b.addEventListener('click',()=>openCall(b.dataset.callId)));
  }
  const wrap=document.getElementById('overviewActivity');
  if(wrap){
    const recent=[...callsData].sort((a,b)=>recordTime(b)-recordTime(a)).slice(0,6);
    wrap.innerHTML=recent.length?recent.map(x=>{
      const initials=String(x.caller||'?').split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()||'?';
      const candidate=followupCandidates().some(c=>String(c.id)===String(x.id)),handled=candidate&&followupIsHandled(x),pending=candidate&&!handled,label=pending?'● Needs follow-up':handled?'✓ Handled':(/resolved/i.test(String(x.outcome||''))?'✓ Resolved':('• '+(x.outcome||'Handled'))),stateClass=pending?'activity-pending':handled?'activity-handled':'activity-resolved';
      return '<button class="activity-row overview-call-row '+stateClass+'" data-call-id="'+esc(x.id)+'"><span class="time">'+esc(formatFullDateTime(x))+'</span><div class="person"><b>'+esc(initials)+'</b><span><strong>'+esc(x.caller||'Unknown caller')+'</strong><small>'+esc(x.reason||'Call activity')+'</small></span></div><span class="tag '+(pending?'amber':'green')+'">'+esc(label)+'</span><strong>'+esc(x.duration||'—')+'</strong></button>';
    }).join(''):'<div class="empty-state"><h3>No activity yet</h3><p>Calls will appear here as CallerCore starts handling traffic.</p></div>';
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
function renderCalls(){
  const wrap=document.getElementById('callsTable');if(!wrap)return;
  const q=(document.getElementById('callSearch')?.value||'').trim().toLowerCase(),filter=document.getElementById('callFilter')?.value||'all',dateFilter=document.getElementById('callDateFilter')?.value||'60';
  let rows=[...callsData].filter(x=>{
    const hay=[x.caller,x.phone,x.reason,x.outcome,x.agent,x.address].join(' ').toLowerCase(),t=recordTime(x);
    const dateOk=dateFilter==='all'||withinDays(t,Number(dateFilter));
    return (!q||hay.includes(q))&&(filter==='all'||String(x.outcome||'').includes(filter))&&dateOk;
  }).sort((a,b)=>recordTime(b)-recordTime(a));
  let lastGroup='';
  wrap.innerHTML=rows.map(x=>{
    const group=dateGroupLabel(recordTime(x)),header=group!==lastGroup?'<div class="call-day-heading"><b>'+esc(group)+'</b><span>'+new Date(recordTime(x)||Date.now()).toLocaleDateString(undefined,{month:'short',day:'numeric'})+'</span></div>':'';lastGroup=group;
    const candidate=followupCandidates().some(c=>String(c.id)===String(x.id)),handled=candidate&&followupIsHandled(x),pending=candidate&&!handled,stateClass=pending?'call-pending':handled?'call-handled':'call-resolved',status=pending?'Needs follow-up':handled?'Handled':(x.outcome||'Handled');
    return header+'<button class="call-row data '+stateClass+'" data-call-id="'+esc(x.id)+'"><span><strong>'+esc(x.caller||'Unknown')+'</strong><small class="subtle">'+esc(x.phone||'')+'</small></span><span><strong>'+esc(recordTime(x)?new Date(recordTime(x)).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):(x.time||'—'))+'</strong><small class="subtle">'+esc(x.agent||'Maya')+'</small></span><span>'+esc(x.reason||'—')+'</span><span class="tag '+(pending?'amber':'green')+'">'+esc(status)+'</span><span>'+esc(x.duration||'—')+'</span></button>';
  }).join('');
  document.getElementById('callsEmpty').hidden=rows.length!==0;
  wrap.querySelectorAll('[data-call-id]').forEach(row=>row.addEventListener('click',()=>openCall(row.dataset.callId)));
}
function openCall(id){
  const x=callsData.find(c=>String(c.id)===String(id));if(!x)return;
  activeCallContactKey=contactKey(x);activeCallId=String(x.id||'');
  document.getElementById('drawerCaller').textContent=x.caller||'Unknown caller';
  const digits=String(x.phone||'').replace(/\D/g,'');const callLink=document.getElementById('drawerCallLink'),textLink=document.getElementById('drawerTextLink');if(callLink){callLink.href=digits?'tel:'+digits:'#';callLink.classList.toggle('disabled-link',!digits)}if(textLink){textLink.href=digits?'sms:'+digits:'#';textLink.classList.toggle('disabled-link',!digits)}
  const followBtn=document.getElementById('drawerFollowupButton');if(followBtn){const isCandidate=followupCandidates().some(c=>String(c.id)===String(x.id));followBtn.hidden=!isCandidate;followBtn.dataset.callId=x.id;followBtn.textContent=followupIsHandled(x)?'Reopen follow-up':'Mark handled'}
  const note=document.getElementById('drawerInternalNote');if(note)note.value='';const ns=document.getElementById('drawerNoteStatus');if(ns)ns.textContent='';renderCallNotes(x.id);
  const when=document.getElementById('drawerWhen');if(when)when.textContent=formatFullDateTime(x);
  document.getElementById('drawerMeta').innerHTML=[['Phone',x.phone],['Duration',x.duration],['Status',followupCandidates().some(c=>String(c.id)===String(x.id))?(followupIsHandled(x)?'Handled':'Needs follow-up'):(x.outcome||'Handled')],['Answered by',x.agent||'Maya']].filter(([,v])=>v).map(([k,v])=>'<span><small>'+esc(k)+'</small><b>'+esc(v)+'</b></span>').join('');
  const addr=document.getElementById('drawerAddress');if(addr)addr.textContent=x.address||contactForRecord(x)?.address||'No address was captured on this call.';
  document.getElementById('drawerSummary').textContent=x.summary||'No AI summary is available yet.';
  const q=x.qualification||{};
  document.getElementById('drawerQualification').innerHTML=Object.entries(q).filter(([k])=>String(k).toLowerCase()!=='value').map(([k,v])=>'<div><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join('')||'<span class="muted">No additional call details yet.</span>';
  const t=Array.isArray(x.transcript)?x.transcript:[];
  document.getElementById('drawerTranscript').innerHTML=t.map(pair=>'<div class="'+(String(pair[0]).toLowerCase()==='maya'?'ai':'')+'"><b>'+esc(pair[0])+'</b>'+esc(pair[1])+'</div>').join('')||'<span class="muted">Transcript unavailable.</span>';
  const historyBtn=document.getElementById('drawerContactButton');if(historyBtn)historyBtn.onclick=()=>{const key=activeCallContactKey;closeCall();setTimeout(()=>openContact(key),30)};
  document.getElementById('callDrawer').classList.add('open');document.getElementById('drawerBackdrop').classList.add('open');document.getElementById('callDrawer').setAttribute('aria-hidden','false');
}
function closeCall(){document.getElementById('callDrawer')?.classList.remove('open');document.getElementById('drawerBackdrop')?.classList.remove('open');document.getElementById('callDrawer')?.setAttribute('aria-hidden','true')}
function money(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}
function followupType(call){
  const reason=String(call?.reason||''),outcome=String(call?.outcome||'');
  if(/no heat|emergency|urgent|gas|carbon monoxide/i.test(reason))return 'urgent';
  if(/miss/i.test(outcome))return 'callback';
  if(/follow/i.test(outcome))return 'callback';
  if(/book|qualif/i.test(outcome))return 'qualified';
  return 'review';
}
function followupLabel(type){return ({urgent:'Urgent',callback:'Callback',qualified:'Qualified request',review:'Review'})[type]||'Review'}
function followupCandidates(){
  return callsData.filter(x=>/miss|follow|qualif/i.test(String(x.outcome||''))||/urgent|emergency|no heat|gas|carbon monoxide/i.test(String(x.reason||''))).sort((a,b)=>recordTime(b)-recordTime(a));
}
async function loadFollowupState(){
  if(demoMode)return;
  try{const r=await fetch('/api/account?action=followups',{headers:{Accept:'application/json'},cache:'no-store'});if(r.ok)followupState=(await r.json()).state||{}}catch(err){console.error('Follow-up state failed',err)}
}
function followupIsHandled(call){return followupState[String(call.id)]?.status==='handled'}
function updateFollowupCounts(){
  const all=followupCandidates(),open=all.filter(x=>!followupIsHandled(x)),urgent=open.filter(x=>followupType(x)==='urgent'),callbacks=open.filter(x=>followupType(x)==='callback'),handledToday=all.filter(x=>{const st=followupState[String(x.id)];return st?.status==='handled'&&sameLocalDay(Number(st.updatedAt||0))});
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};set('followupOpenCount',open.length);set('followupUrgentCount',urgent.length);set('followupCallbackCount',callbacks.length);set('followupHandledCount',handledToday.length);
  const nav=document.getElementById('followupNavCount');if(nav){nav.textContent=open.length>99?'99+':open.length;nav.hidden=open.length===0}
  const overview=document.getElementById('overviewFollowup');if(overview)overview.textContent=open.filter(x=>withinDays(recordTime(x),7)).length;
}
function renderLeads(){
  const board=document.getElementById('leadKanban');if(!board)return;
  const q=(document.getElementById('leadSearch')?.value||'').trim().toLowerCase(),filter=document.getElementById('leadFilter')?.value||'all';
  let rows=followupCandidates().filter(x=>{
    const handled=followupIsHandled(x);if(showHandledFollowups?!handled:handled)return false;
    const type=followupType(x),searchOk=!q||[x.caller,x.phone,x.reason,x.address,x.outcome].join(' ').toLowerCase().includes(q),filterOk=filter==='all'||type===filter;
    return searchOk&&filterOk;
  });
  board.innerHTML=rows.map(x=>{
    const type=followupType(x),handled=followupIsHandled(x),phone=String(x.phone||''),digits=phone.replace(/\D/g,'');
    return '<article class="followup-card '+(type==='urgent'?'urgent':'')+' '+(handled?'handled':'')+'"><div class="followup-main"><div class="followup-badge '+type+'">'+followupLabel(type)+'</div><div class="followup-customer"><button class="customer-link" data-contact-key="'+esc(contactKey(x))+'"><b>'+esc(x.caller||'Unknown caller')+'</b></button><span>'+esc(phone||'No phone')+' · '+esc(formatFullDateTime(x))+'</span><p>'+esc(x.reason||'Call requires review')+'</p><small>'+esc(x.address||'No service address captured')+'</small></div></div><div class="followup-actions">'+(digits?'<a class="secondary-btn action-link" href="tel:'+digits+'">Call</a><a class="secondary-btn action-link" href="sms:'+digits+'">Text</a>':'')+'<button class="secondary-btn" data-call-id="'+esc(x.id)+'">Call details</button><button class="'+(handled?'secondary-btn':'primary')+'" data-followup-toggle="'+esc(x.id)+'">'+(handled?'Reopen':'Mark handled')+'</button></div></article>';
  }).join('');
  document.getElementById('leadsEmpty').hidden=rows.length!==0;updateFollowupCounts();
  board.querySelectorAll('[data-contact-key]').forEach(b=>b.addEventListener('click',()=>openContact(b.dataset.contactKey)));
  board.querySelectorAll('[data-call-id]').forEach(b=>b.addEventListener('click',()=>openCall(b.dataset.callId)));
  board.querySelectorAll('[data-followup-toggle]').forEach(b=>b.addEventListener('click',()=>toggleFollowup(b.dataset.followupToggle)));
}
async function toggleFollowup(id){
  const handled=followupState[id]?.status==='handled',next=handled?'open':'handled',previous=followupState[id],note=followupState[id]?.note||'',notes=Array.isArray(followupState[id]?.notes)?followupState[id].notes:[];
  followupState[id]={status:next,note,notes,updatedAt:Date.now()};renderLeads();renderOverview();const x=callsData.find(c=>String(c.id)===String(id));const drawerBtn=document.getElementById('drawerFollowupButton');if(x&&drawerBtn&&drawerBtn.dataset.callId===String(id))drawerBtn.textContent=next==='handled'?'Reopen follow-up':'Mark handled';
  if(demoMode)return;
  try{const r=await fetch('/api/account?action=followup-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callId:id,status:next,note,notes})});if(!r.ok)throw new Error('Could not update follow-up');followupState=(await r.json()).state||followupState}
  catch(err){if(previous)followupState[id]=previous;else delete followupState[id];renderLeads();renderOverview();console.error(err)}
}
function normalizedCallNotes(id){
  const state=followupState[String(id)]||{},notes=Array.isArray(state.notes)?state.notes.slice():[];
  if(state.note&&String(state.note).trim()&&!notes.some(n=>n&&n.text===state.note))notes.unshift({id:'legacy',text:String(state.note),at:Number(state.updatedAt||0),by:state.updatedBy||''});
  return notes.filter(n=>n&&String(n.text||'').trim()).sort((a,b)=>Number(b.at||0)-Number(a.at||0));
}
function renderCallNotes(id=activeCallId){
  const list=document.getElementById('drawerNotesList'),count=document.getElementById('drawerNoteCount');if(!list)return;const notes=normalizedCallNotes(id);
  if(count)count.textContent=notes.length+' note'+(notes.length===1?'':'s');
  list.innerHTML=notes.length?notes.map(n=>'<article class="internal-note-card"><p>'+esc(n.text)+'</p><small>'+esc(n.by||'Team')+(n.at?' · '+new Date(Number(n.at)).toLocaleString():'')+'</small></article>').join(''):'<div class="notes-empty">No internal notes yet.</div>';
}
async function saveCallNote(){
  const id=activeCallId;if(!id)return;const input=document.getElementById('drawerInternalNote'),status=document.getElementById('drawerNoteStatus'),text=String(input?.value||'').trim().slice(0,2000),current=followupState[String(id)]||{},call=callsData.find(x=>String(x.id)===String(id)),nextStatus=current.status||(call&&followupCandidates().some(x=>String(x.id)===String(id))?'open':'handled');if(!text){if(status)status.textContent='Write a note first.';return}if(status)status.textContent='Saving…';
  if(demoMode){const notes=[...(current.notes||[]),{id:'note_'+Date.now(),text,at:Date.now(),by:currentUserProfile.email||'Team'}];followupState[String(id)]={...current,status:nextStatus,notes,updatedAt:Date.now()};input.value='';renderCallNotes(id);if(status)status.textContent='Note added';return}
  try{const r=await fetch('/api/account?action=followup-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callId:id,status:nextStatus,appendNote:text})}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not save note');followupState=data.state||followupState;input.value='';renderCallNotes(id);if(status)status.textContent='Note added'}catch(err){if(status)status.textContent=err.message||'Could not save note'}
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
document.getElementById('callFilter')?.addEventListener('change',renderCalls);
document.getElementById('callDateFilter')?.addEventListener('change',renderCalls);
document.getElementById('leadSearch')?.addEventListener('input',renderLeads);
document.getElementById('leadFilter')?.addEventListener('change',renderLeads);
document.getElementById('showHandledFollowups')?.addEventListener('click',e=>{showHandledFollowups=!showHandledFollowups;e.currentTarget.textContent=showHandledFollowups?'Show open':'Show handled';renderLeads()});
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
  const map=new Map();
  const ensure=(rec,nameField='name')=>{
    const key=contactKey(rec),name=rec?.[nameField]||rec?.name||rec?.caller||'Unknown caller';
    if(!map.has(key))map.set(key,{key,name,phone:rec?.phone||'',address:rec?.address||'',calls:[],conversations:[],leads:[],lastAt:0,services:new Set()});
    const c=map.get(key);if(name&&c.name==='Unknown caller')c.name=name;if(rec?.phone&&!c.phone)c.phone=rec.phone;if(rec?.address&&!c.address)c.address=rec.address;c.lastAt=Math.max(c.lastAt,recordTime(rec)||0);if(rec?.reason)c.services.add(rec.reason);if(rec?.service)c.services.add(rec.service);return c;
  };
  callsData.forEach(x=>ensure(x,'caller').calls.push(x));
  conversationsData.forEach(x=>ensure(x).conversations.push(x));
  leadsData.forEach(x=>ensure(x).leads.push(x));
  return [...map.values()].sort((a,b)=>b.lastAt-a.lastAt);
}
function contactForRecord(x){return buildContacts().find(c=>c.key===contactKey(x))||null}
function renderContacts(){
  const wrap=document.getElementById('contactsTable');if(!wrap)return;
  const q=(document.getElementById('contactSearch')?.value||'').trim().toLowerCase();
  const rows=buildContacts().filter(c=>!q||[c.name,c.phone,c.address,...c.services].join(' ').toLowerCase().includes(q));
  wrap.innerHTML=rows.map(c=>{
    const msgCount=c.conversations.reduce((n,x)=>n+(Array.isArray(x.messages)?x.messages.length:0),0),openCount=c.calls.filter(x=>followupCandidates().some(v=>String(v.id)===String(x.id))&&!followupIsHandled(x)).length;
    return '<div class="contact-row data '+(openCount?'customer-attention':'')+'" data-contact-row="'+esc(c.key)+'"><span><button class="customer-link contact-open" data-contact-open="'+esc(c.key)+'"><strong>'+esc(c.name)+'</strong></button><small>'+esc(c.phone||'No phone captured')+(openCount?' · '+openCount+' open follow-up'+(openCount===1?'':'s'):'')+'</small></span><span>'+esc(c.lastAt?new Date(c.lastAt).toLocaleString():'—')+'</span><span><button class="count-link contact-open" data-contact-open="'+esc(c.key)+'">'+c.calls.length+'</button></span><span><button class="count-link contact-open" data-contact-open="'+esc(c.key)+'">'+msgCount+'</button></span><span><button class="latest-need-link contact-open" data-contact-open="'+esc(c.key)+'">'+esc([...c.services][0]||'General inquiry')+'</button></span></div>';
  }).join('');
  document.getElementById('contactsEmpty').hidden=rows.length!==0;
  wrap.onclick=e=>{const btn=e.target.closest('[data-contact-open]'),row=e.target.closest('[data-contact-row]');const key=btn?.dataset.contactOpen||row?.dataset.contactRow;if(key)openContact(key)};
}
function openContact(key){
  const c=buildContacts().find(x=>x.key===key);if(!c)return;
  const drawer=document.getElementById('contactDrawer'),back=document.getElementById('contactDrawerBackdrop');if(!drawer||!back)return;
  document.getElementById('contactDrawerName').textContent=c.name;
  document.getElementById('contactDrawerMeta').textContent=c.lastAt?'Last interaction '+new Date(c.lastAt).toLocaleString():'No recent interaction date';
  const digits=String(c.phone||'').replace(/\D/g,'');const callLink=document.getElementById('contactCallLink'),textLink=document.getElementById('contactTextLink');if(callLink){callLink.href=digits?'tel:'+digits:'#';callLink.classList.toggle('disabled-link',!digits)}if(textLink){textLink.href=digits?'sms:'+digits:'#';textLink.classList.toggle('disabled-link',!digits)}
  document.getElementById('contactDrawerDetails').innerHTML=[
    ['Phone',c.phone||'Not captured'],['Address',c.address||'Not captured'],['Calls',c.calls.length],['Messages',c.conversations.reduce((n,x)=>n+(Array.isArray(x.messages)?x.messages.length:0),0)]
  ].map(([k,v])=>'<div><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join('');
  const latestCall=[...c.calls].sort((a,b)=>recordTime(b)-recordTime(a))[0],latestLead=[...c.leads].sort((a,b)=>recordTime(b)-recordTime(a))[0];
  document.getElementById('contactDrawerSummary').textContent=latestCall?.summary||((latestLead?.service)?c.name+' contacted the business about '+latestLead.service.toLowerCase()+'.':'CallerCore has contact activity for this person.');
  const events=[
    ...c.calls.map(x=>({at:recordTime(x),kind:'Call',title:x.reason||'Phone call',copy:[x.outcome,x.duration].filter(Boolean).join(' · '),callId:x.id})),
    ...c.conversations.flatMap(x=>(x.messages||[]).map(m=>({at:Number(m.at||recordTime(x)||0),kind:m.dir==='in'?'Message received':'Message sent',title:m.who||x.name,copy:m.text||''}))),
    ...c.leads.map(x=>({at:recordTime(x),kind:'Service request',title:x.service||'Service request',copy:leadDisplayStatus(x.stage)})),
    ...c.calls.flatMap(x=>normalizedCallNotes(x.id).map(n=>({at:Number(n.at||recordTime(x)||0),kind:'Internal note',title:n.by||'Team note',copy:n.text||''})))
  ].sort((a,b)=>b.at-a.at);
  document.getElementById('contactDrawerTimeline').innerHTML=events.slice(0,80).map(e=>'<'+(e.callId?'button':'div')+' class="contact-event" '+(e.callId?'data-contact-call="'+esc(e.callId)+'"':'')+'><span class="contact-event-dot"></span><span><small>'+esc(e.kind)+' · '+esc(e.at?new Date(e.at).toLocaleString():'Date unavailable')+'</small><b>'+esc(e.title)+'</b><p>'+esc(e.copy)+'</p></span></'+(e.callId?'button':'div')+'>').join('')||'<p class="muted">No activity is available yet.</p>';
  document.getElementById('contactDrawerTimeline').querySelectorAll('[data-contact-call]').forEach(b=>b.addEventListener('click',()=>{closeContact();openCall(b.dataset.contactCall)}));
  drawer.classList.add('open');back.classList.add('open');drawer.setAttribute('aria-hidden','false');
}
function closeContact(){document.getElementById('contactDrawer')?.classList.remove('open');document.getElementById('contactDrawerBackdrop')?.classList.remove('open');document.getElementById('contactDrawer')?.setAttribute('aria-hidden','true')}
document.getElementById('contactSearch')?.addEventListener('input',renderContacts);
document.getElementById('closeContactDrawer')?.addEventListener('click',closeContact);
document.getElementById('contactDrawerBackdrop')?.addEventListener('click',closeContact);
document.getElementById('drawerFollowupButton')?.addEventListener('click',e=>{const id=e.currentTarget.dataset.callId;if(id)toggleFollowup(id)});
document.getElementById('drawerSaveNote')?.addEventListener('click',saveCallNote);

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


function agentControlIds(){return ['agentName','agentRole','agentTone','agentOpening','agentServiceArea','agentHours','agentTransfer','agentEmergency']}
function setAgentEditing(editing,{restore=false}={}){
  if(editing&&!agentEditing&&agentData)agentEditSnapshot=JSON.parse(JSON.stringify(agentData));
  agentEditing=!!editing;if(restore&&agentEditSnapshot){agentData=JSON.parse(JSON.stringify(agentEditSnapshot));renderAgent();return}
  agentControlIds().forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!agentEditing});
  const edit=document.getElementById('agentEditButton'),cancel=document.getElementById('agentCancelButton'),save=document.getElementById('saveAgentButton'),add=document.getElementById('addQuestionButton');
  if(edit)edit.hidden=agentEditing;if(cancel)cancel.hidden=!agentEditing;if(save)save.hidden=!agentEditing;if(add)add.hidden=!agentEditing;
  renderQuestions();
}
function renderAgent(){
  if(!agentData)return;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  set('agentName',agentData.name);set('agentRole',agentData.role);set('agentTone',agentData.tone);
  set('agentOpening',agentData.openingMessage);set('agentServiceArea',agentData.serviceArea);
  set('agentHours',agentData.businessHours);set('agentTransfer',agentData.transferNumber);set('agentEmergency',agentData.emergencyInstructions);
  renderQuestions();setAgentEditing(agentEditing);
}
function renderQuestions(){
  const wrap=document.getElementById('qualificationQuestions');if(!wrap||!agentData)return;
  const qs=Array.isArray(agentData.qualificationQuestions)?agentData.qualificationQuestions:[];
  wrap.innerHTML=qs.map((q,i)=>'<div class="question-row '+(agentEditing?'editing':'locked')+'"><input data-question-index="'+i+'" value="'+esc(q)+'" '+(agentEditing?'':'disabled')+'><button data-remove-question="'+i+'" aria-label="Remove" '+(agentEditing?'':'hidden')+'>×</button></div>').join('');
  if(agentEditing){wrap.querySelectorAll('[data-question-index]').forEach(input=>input.addEventListener('input',()=>{agentData.qualificationQuestions[Number(input.dataset.questionIndex)]=input.value}));wrap.querySelectorAll('[data-remove-question]').forEach(btn=>btn.addEventListener('click',()=>{agentData.qualificationQuestions.splice(Number(btn.dataset.removeQuestion),1);renderQuestions()}))}
}
function collectAgent(){
  const val=id=>document.getElementById(id)?.value||'';
  return {name:val('agentName'),role:val('agentRole'),tone:val('agentTone'),openingMessage:val('agentOpening'),serviceArea:val('agentServiceArea'),businessHours:val('agentHours'),transferNumber:val('agentTransfer'),emergencyInstructions:val('agentEmergency'),qualificationQuestions:[...(agentData?.qualificationQuestions||[])]};
}
async function saveAgent(){
  if(!agentEditing)return;const next=collectAgent(),btn=document.getElementById('saveAgentButton');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{
    if(!demoMode){const r=await fetch('/api/account?action=agent-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not save the AI receptionist.');agentData=data.agent||next}else agentData=next;
    agentEditSnapshot=null;setAgentEditing(false);const status=document.getElementById('agentSaveStatus');if(status){status.textContent='Saved';status.classList.add('show');setTimeout(()=>status.classList.remove('show'),1600)}
  }catch(err){alert(err.message||'Could not save the AI receptionist.')}
  finally{if(btn){btn.disabled=false;btn.textContent='Save changes'}}
}
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
document.getElementById('saveAgentButton')?.addEventListener('click',saveAgent);
document.getElementById('agentEditButton')?.addEventListener('click',()=>setAgentEditing(true));
document.getElementById('agentCancelButton')?.addEventListener('click',()=>{if(agentEditSnapshot)agentData=JSON.parse(JSON.stringify(agentEditSnapshot));agentEditSnapshot=null;agentEditing=false;renderAgent()});
document.getElementById('addQuestionButton')?.addEventListener('click',()=>{if(!agentEditing)return;if(!agentData)agentData={...DEMO_AGENT,qualificationQuestions:[]};agentData.qualificationQuestions=agentData.qualificationQuestions||[];if(agentData.qualificationQuestions.length<12){agentData.qualificationQuestions.push('');renderQuestions()}});
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
  const days=Number(document.getElementById('insightsRange')?.value||30),rows=callsData.filter(x=>withinDays(recordTime(x),days)),total=rows.length;
  const answered=rows.filter(x=>!/miss/i.test(String(x.outcome||''))).length,qualified=rows.filter(x=>/book|qualif/i.test(String(x.outcome||''))).length;
  const afterHours=rows.filter(x=>{const h=new Date(recordTime(x)).getHours();return h<8||h>=18}).length;
  const activeDays=new Set(rows.map(x=>new Date(recordTime(x)).toDateString())).size,avg=activeDays?Math.round(total/activeDays*10)/10:0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('analyticsAnswerRate',(total?Math.round(answered/total*100):0)+'%');set('analyticsQualified',(total?Math.round(qualified/total*100):0)+'%');set('analyticsAfterHours',(total?Math.round(afterHours/total*100):0)+'%');set('analyticsDailyAvg',avg);set('analyticsCalls',total+' total calls');
  const reasons={};rows.forEach(x=>{const k=String(x.reason||'Other').slice(0,70);reasons[k]=(reasons[k]||0)+1});const reasonRows=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,7),reasonMax=Math.max(1,...reasonRows.map(x=>x[1]));
  const reasonWrap=document.getElementById('callReasonBars');if(reasonWrap)reasonWrap.innerHTML=reasonRows.map(([label,value])=>'<div class="bar-row"><span>'+esc(label)+'</span><b>'+Math.round(value/Math.max(1,total)*100)+'%</b><div class="bar-track"><i style="width:'+Math.round(value/reasonMax*100)+'%"></i></div></div>').join('')||'<span class="muted">No call data yet.</span>';
  const daily=document.getElementById('insightDailyBars');if(daily){const vals=[];for(let i=days-1;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const next=d.getTime()+86400000,n=rows.filter(x=>{const t=recordTime(x);return t>=d.getTime()&&t<next}).length;vals.push({d,n})}const display=vals.filter((_,i)=>days<=7||i%Math.max(1,Math.floor(days/12))===0||i===vals.length-1),max=Math.max(1,...display.map(x=>x.n));daily.innerHTML=display.map(x=>'<div class="insight-bar-col"><b>'+x.n+'</b><span><i style="height:'+Math.max(5,Math.round(x.n/max*100))+'%"></i></span><small>'+x.d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+'</small></div>').join('')}
  const hours=Array.from({length:12},(_,i)=>({h:i+7,n:0}));rows.forEach(x=>{const h=new Date(recordTime(x)).getHours(),slot=hours.find(v=>v.h===h);if(slot)slot.n++});const hourWrap=document.getElementById('insightHourBars');if(hourWrap){const max=Math.max(1,...hours.map(x=>x.n));hourWrap.innerHTML=hours.map(x=>'<div><small>'+new Date(2020,1,1,x.h).toLocaleTimeString(undefined,{hour:'numeric'})+'</small><span><i style="width:'+Math.round(x.n/max*100)+'%"></i></span><b>'+x.n+'</b></div>').join('')}
  const outcomes={Answered:0,Qualified:0,'Follow-up':0,Missed:0};rows.forEach(x=>{/miss/i.test(x.outcome||'')?outcomes.Missed++:/follow/i.test(x.outcome||'')?outcomes['Follow-up']++:/book|qualif/i.test(x.outcome||'')?outcomes.Qualified++:outcomes.Answered++});const donut=document.getElementById('outcomeDonut'),legend=document.getElementById('outcomeLegend');if(donut){const pctQ=total?Math.round(outcomes.Qualified/total*100):0,pctF=total?Math.round(outcomes['Follow-up']/total*100):0,pctM=total?Math.round(outcomes.Missed/total*100):0;donut.style.background='conic-gradient(var(--accent) 0 '+pctQ+'%,#e2a56f '+pctQ+'% '+(pctQ+pctF)+'%,#cfd5dc '+(pctQ+pctF)+'% '+(100-pctM)+'%,#d8614c '+(100-pctM)+'% 100%)';set('outcomeDonutLabel',total)}if(legend)legend.innerHTML=Object.entries(outcomes).map(([k,v])=>'<div><span>'+esc(k)+'</span><b>'+v+' · '+(total?Math.round(v/total*100):0)+'%</b></div>').join('');
}
function renderIntegrations(){
  if(!integrationsData)integrationsData={googleCalendar:false,stripe:!!sessionWorkspace?.stripe?.customerLinked,webhookUrl:'',apiAccess:has('apiAccess')};
  const routeReady=!!phoneRoutingData?.number,agentReady=!!agentData?.name;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  const tag=(id,ok,yes,no)=>{const el=document.getElementById(id);if(el){el.textContent=ok?yes:no;el.className='tag '+(ok?'green':'amber')}};
  set('connectionPhoneTitle',routeReady?'Phone routing active':'Phone routing not ready');set('connectionPhoneCopy',routeReady?(phoneRoutingData.number+' is answering through CallerCore.'):'A CallerCore number has not been assigned yet.');tag('connectionPhoneStatus',routeReady,'Active','Needs setup');
  set('connectionAgentTitle',agentReady?(agentData.name+' is configured'):'AI receptionist needs setup');set('connectionAgentCopy',agentReady?'Business hours, service area, and escalation rules are loaded.':'Finish your AI receptionist configuration before going live.');tag('connectionAgentStatus',agentReady,'Online','Needs setup');
  const g=document.getElementById('googleCalendarStatus');if(g){const ok=capability('calendar')&&integrationsData.googleCalendar;g.textContent=ok?'Connected':'Not connected';g.className='tag '+(ok?'green':'amber')}
  set('connectionBusinessNumber',phoneRoutingData?.forwardingFrom||settingsData?.businessPhone||'Your business line');set('connectionCallerCoreNumber',phoneRoutingData?.number||'Not assigned');set('connectionTransferNumber',phoneRoutingData?.transferNumber||agentData?.transferNumber||'Not configured');
  const panel=document.getElementById('webhookPanel');if(panel)panel.hidden=!has('apiAccess');const url=document.getElementById('webhookUrl');if(url)url.value=integrationsData.webhookUrl||'';
}
async function saveWebhook(){
  if(!has('apiAccess'))return openModal('Pro');
  const webhookUrl=document.getElementById('webhookUrl')?.value.trim()||'';
  if(demoMode){integrationsData={...(integrationsData||{}),webhookUrl};return}
  const r=await fetch('/api/account?action=integrations-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({webhookUrl})});
  if(!r.ok){alert('Could not save webhook. Make sure it uses HTTPS.');return}
  integrationsData={...(integrationsData||{}),...((await r.json()).integrations||{})};renderIntegrations();
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
function renderSettings(){
  if(!settingsData)return;
  const put=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  put('settingsBusinessName',settingsData.businessName);put('settingsContactName',settingsData.contactName);put('settingsPrimaryEmail',settingsData.primaryEmail);put('settingsBusinessPhone',settingsData.businessPhone);put('settingsWebsite',settingsData.website);put('settingsIndustry',settingsData.industry);put('settingsServiceArea',settingsData.serviceArea);put('settingsStreetAddress',settingsData.streetAddress);put('settingsCity',settingsData.city);put('settingsState',settingsData.state);put('settingsPostalCode',settingsData.postalCode);put('settingsTimezone',settingsData.timezone);put('settingsNotificationEmail',settingsData.notificationEmail);
  const e=document.getElementById('settingsEmailAlerts'),sms=document.getElementById('settingsSmsAlerts');if(e)e.checked=settingsData.emailAlerts!==false;if(sms){sms.checked=capability('sms')&&settingsData.smsAlerts!==false;sms.disabled=true}
  for(const [id,key] of [['settingsNotifyBilling','notifyBilling'],['settingsNotifySetup','notifySetup'],['settingsNotifyCalls','notifyCalls'],['settingsNotifySupport','notifySupport'],['settingsNotifyUsage','notifyUsage']]){const el=document.getElementById(id);if(el)el.checked=settingsData[key]!==false}
  pendingBusinessLogo=String(settingsData.logoDataUrl||'');setSettingsEditing(settingsEditing);
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
  set('clientPhoneProvider',d?.provider?d.provider+' · '+(d.status||'active'):'Awaiting provisioning');
  set('clientForwardingFrom',d?.forwardingFrom||'—');set('clientTransferNumber',d?.transferNumber||agentData?.transferNumber||'—');
  set('clientAfterHours',d?({ai:'AI answers',transfer:'Transfer',voicemail:'Voicemail'}[d.afterHours]||d.afterHours):'—');
  set('clientSmsStatus',capability('sms')?(d&&d.smsEnabled?'SMS enabled':'SMS disabled'):'Messaging not enabled at launch');
  set('clientRoutingHeadline',d?'Your CallerCore routing is configured.':'Phone routing has not been provisioned yet.');
  set('clientRoutingCopy',d?'Routing changes are managed by CallerCore support to prevent accidental call disruption.':'CallerCore support will configure the AI-facing number and routing details during onboarding.');
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
    return '<details class="support-ticket-thread"><summary><div><b>'+esc(t.subject)+'</b><small>'+new Date(t.createdAt).toLocaleString()+' · '+esc(t.priority||'normal')+'</small></div><span class="tag '+(t.status==='resolved'?'green':t.status==='in_progress'?'amber':'')+'">'+esc(String(t.status||'open').replace('_',' '))+'</span></summary><div class="support-thread-messages">'+thread+'</div><div class="support-reply-box"><textarea data-support-client-input="'+esc(t.id)+'" placeholder="Reply to CallerCore support…"></textarea><button class="secondary-btn" type="button" data-support-client-reply="'+esc(t.id)+'">Send reply</button></div></details>';
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

document.getElementById('saveWebhookButton')?.addEventListener('click',saveWebhook);
document.getElementById('insightsRange')?.addEventListener('change',renderAnalytics);
document.getElementById('saveSettingsButton')?.addEventListener('click',saveSettings);
document.getElementById('settingsEditButton')?.addEventListener('click',()=>setSettingsEditing(true));
document.getElementById('settingsCancelButton')?.addEventListener('click',()=>{settingsEditing=false;pendingBusinessLogo=String(settingsData?.logoDataUrl||'');renderSettings()});
document.getElementById('businessLogoButton')?.addEventListener('click',()=>document.getElementById('businessLogoInput')?.click());
document.getElementById('businessLogoInput')?.addEventListener('change',async e=>{const status=document.getElementById('settingsFormStatus');try{pendingBusinessLogo=await resizeBusinessLogo(e.target.files?.[0]);renderBusinessLogo();if(status){status.textContent='Logo ready — save changes to apply it.';status.className='form-status-line'}}catch(err){if(status){status.textContent=err.message||'Could not use that logo.';status.className='form-status-line error'}}e.target.value=''});
document.getElementById('businessLogoRemove')?.addEventListener('click',()=>{pendingBusinessLogo='';renderBusinessLogo()});
document.getElementById('exportWorkspaceButton')?.addEventListener('click',()=>{window.location.href='/api/account?action=workspace-export'});


let adminClientsData=[],adminSummaryData=null,currentAdminClient=null,currentAdminTech=null,adminProvisioningData=[],adminPhoneData=[],adminHealthData=[],adminReadinessData=null,adminFleetData={agents:[],calls:[],leads:[],automations:[]},adminSupportData=[],adminPlatformData=null,adminWebsiteData={prospects:[],recentSessions:[],topPages:[],sources:[],funnel:{}},adminInboxData={gmailStatus:{configured:false,connected:false},gmail:{threads:[],analytics:{}},aliases:[],filter:'all',search:'',loading:false,lastSync:0},currentInboxItem=null;
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
    renderAdmin();await loadAdminOps();
    const qp=new URLSearchParams(location.search);
    if(qp.get('gmail')){showView('inbox');await loadAdminInbox();history.replaceState({},'',location.pathname)}
    return true;
  }catch(err){console.error('Admin bootstrap failed',err);return false}
}

async function loadAdminOps(){
  try{
    const [pr,ph,hr,fr,sr,ps,wr]=await Promise.all([
      fetch('/api/account?action=admin-provisioning',{cache:'no-store'}),
      fetch('/api/account?action=admin-phone-numbers',{cache:'no-store'}),
      fetch('/api/account?action=admin-system-health',{cache:'no-store'}),
      fetch('/api/account?action=admin-fleet',{cache:'no-store'}),
      fetch('/api/account?action=admin-support',{cache:'no-store'}),
      fetch('/api/account?action=admin-platform-settings',{cache:'no-store'}),
      fetch('/api/account?action=admin-website-analytics',{cache:'no-store'})
    ]);
    setDataHealth('adminDataHealth',[pr,ph,hr,fr,sr,ps,wr].some(r=>!r.ok));
    if(pr.ok)adminProvisioningData=(await pr.json()).provisioning||[];
    if(ph.ok)adminPhoneData=(await ph.json()).numbers||[];
    if(hr.ok){const health=await hr.json();adminHealthData=health.services||[];adminReadinessData=health.readiness||null;}
    if(fr.ok)adminFleetData=await fr.json();
    if(sr.ok)adminSupportData=(await sr.json()).tickets||[];
    if(ps.ok)adminPlatformData=(await ps.json()).settings||null;
    if(wr.ok)adminWebsiteData=(await wr.json()).analytics||adminWebsiteData;
  }catch(e){console.error('Admin ops load failed',e);setDataHealth('adminDataHealth',true)}
  renderProvisioning();renderPhones();renderHealth();renderWebsiteAnalytics();renderAdminFleet();renderAdminSupport();renderPlatformSettings();renderAdmin();
}

function renderAdminFleet(){
  const agents=adminFleetData.agents||[],calls=adminFleetData.calls||[],workspaceLeads=adminFleetData.leads||[],autos=adminFleetData.automations||[],webProspects=adminWebsiteData.prospects||[];
  const ag=document.getElementById('adminAgentsGrid');if(ag){ag.innerHTML=agents.filter(x=>x.agent).map(x=>'<article class="panel integration-card"><div><b>'+esc(x.agent.name||'Maya')+' · '+esc(x.workspaceName)+'</b><p>'+esc(x.agent.role||'AI Receptionist')+(x.phone?' · '+esc(x.phone):' · No phone assigned')+'</p></div><span class="tag '+(x.status==='active'&&x.phone?'green':'amber')+'">'+(x.status==='active'&&x.phone?'Ready':'Setup')+'</span></article>').join('');document.getElementById('adminAgentsEmpty').hidden=agents.some(x=>x.agent)}
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('adminCallsTotal',calls.length);set('adminCallsQualified',calls.filter(x=>/booked|qualified/i.test(String(x.outcome||''))).length);set('adminCallsMissed',calls.filter(x=>/missed/i.test(String(x.outcome||''))).length);set('adminCallsWorkspaces',new Set(calls.map(x=>x.workspaceId)).size);
  const ct=document.getElementById('adminCallsTable');if(ct)ct.innerHTML=calls.slice(0,100).map(x=>'<div class="call-row" data-admin-call-id="'+esc(String(x.id||x.callId||''))+'"><span><strong>'+esc(x.caller||x.phone||'Unknown caller')+'</strong><small class="subtle">'+esc(x.phone||'')+'</small></span><span>'+esc(x.workspaceName)+'</span><span>'+esc(x.reason||'General')+'</span><span class="tag '+outcomeClass(x.outcome)+'">'+esc(x.outcome||'Handled')+'</span><span>'+esc(x.time||'—')+'</span></div>').join('');
  const ce=document.getElementById('adminCallsEmpty');if(ce)ce.hidden=calls.length!==0;

  const totalLeads=workspaceLeads.length+webProspects.length;
  const qualified=workspaceLeads.filter(x=>x.stage==='Qualified').length+webProspects.filter(x=>x.stage==='qualified').length;
  const checkoutStarts=webProspects.filter(x=>x.stage==='checkout_started').length;
  const won=workspaceLeads.filter(x=>x.stage==='Won').length+webProspects.filter(x=>x.stage==='converted').length;
  set('adminLeadsTotal',totalLeads);set('adminLeadsQualified',qualified);set('adminLeadsAppointments',checkoutStarts);set('adminLeadsWon',won);
  const lt=document.getElementById('adminLeadsTable');
  if(lt){
    const webRows=webProspects.slice(0,100).map(p=>{
      const interest=p.plan||p.category||p.industry||'Website inquiry';
      return '<div class="lead-admin-row"><span><strong>'+esc(p.name||p.business||p.email||'Website prospect')+'</strong><small class="subtle">'+esc(p.business||p.email||'')+'</small></span><span><span class="tag amber">Website</span><small class="subtle">'+esc(p.source||'website')+'</small></span><span>'+esc(interest)+'</span><span><select class="prospect-stage" data-prospect-stage="'+esc(p.id)+'">'+['new','inquiry','checkout_started','follow_up','qualified','lost','converted'].map(s=>'<option value="'+s+'" '+(p.stage===s?'selected':'')+'>'+s.replaceAll('_',' ')+'</option>').join('')+'</select></span><span><button class="admin-link" data-view="website">Journey</button></span></div>'
    }).join('');
    const clientRows=workspaceLeads.slice(0,100).map(x=>'<div class="lead-admin-row" data-admin-lead-id="'+esc(String(x.id||''))+'"><span><strong>'+esc(x.name||'Unnamed lead')+'</strong><small class="subtle">'+esc(x.phone||'')+'</small></span><span><span class="tag">Client</span><small class="subtle">'+esc(x.workspaceName||'Workspace')+'</small></span><span>'+esc(x.service||'General inquiry')+'</span><span><span class="tag">'+esc(x.stage||'New')+'</span></span><span>'+money(x.value)+'</span></div>').join('');
    lt.innerHTML=webRows+clientRows;
    lt.querySelectorAll('[data-prospect-stage]').forEach(sel=>sel.addEventListener('change',()=>updateWebsiteProspect(sel.dataset.prospectStage,sel.value)));
    lt.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  }
  const le=document.getElementById('adminLeadsEmpty');if(le)le.hidden=totalLeads!==0;
  const aw=document.getElementById('adminAutomationGrid');if(aw){aw.innerHTML=autos.filter(x=>x.total).map(x=>'<article class="panel integration-card"><div><b>'+esc(x.workspaceName)+'</b><p>'+x.enabled+' enabled of '+x.total+' configured</p></div><span class="tag '+(x.enabled?'green':'amber')+'">'+esc(x.plan)+'</span></article>').join('');document.getElementById('adminAutomationsEmpty').hidden=autos.some(x=>x.total)}
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
  const stages=['Paid','Review','Intake','Building','QA','Client Test','Ready','Live'];
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
      return '<article draggable="true" data-provision-id="'+esc(x.id)+'"><div class="provision-card-head"><b>'+esc(x.name)+'</b>'+(x.manualOverride?'<span class="tag amber">Manual</span>':'')+'</div><small>'+esc(x.plan)+(x.phone?' · '+esc(x.phone):'')+'</small><div class="provision-progress"><i style="width:'+Math.round((Number(x.checklistDone||0)/Math.max(1,Number(x.checklistTotal||1)))*100)+'%"></i></div><div class="provision-checks">'+chips+'</div>'+agreement+scan+action+'<div class="provision-foot"><span>Auto: '+esc(x.autoStage||x.stage)+'</span>'+(x.manualOverride?'<button data-auto-stage="'+esc(x.id)+'">Use auto</button>':'')+'</div></article>';
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
  const wrap=document.getElementById('phoneTable');if(!wrap)return;
  wrap.innerHTML=adminPhoneData.map(x=>'<div class="call-row"><span><strong>'+esc(x.number)+'</strong><small class="subtle">'+esc(x.label||'Primary')+(x.forwardingFrom?' · from '+esc(x.forwardingFrom):'')+'</small></span><span>'+esc(x.workspaceName||'Unassigned')+'</span><span>'+esc(x.provider||'')+'</span><span class="tag green">'+esc(x.status||'active')+'</span><span class="phone-actions"><button class="admin-link" data-edit-phone="'+esc(x.id)+'">Edit</button><button class="admin-link danger-link" data-delete-phone="'+esc(x.id)+'">Delete</button></span></div>').join('');
  const empty=document.getElementById('phoneEmpty');if(empty)empty.hidden=adminPhoneData.length!==0;
  wrap.querySelectorAll('[data-edit-phone]').forEach(b=>b.addEventListener('click',()=>openPhoneModal(b.dataset.editPhone)));
  wrap.querySelectorAll('[data-delete-phone]').forEach(b=>b.addEventListener('click',()=>deletePhone(b.dataset.deletePhone)));
}
function renderHealth(){
  const wrap=document.getElementById('systemHealthGrid');if(!wrap)return;
  wrap.innerHTML=adminHealthData.map(x=>'<article class="panel integration-card"><div><b>'+esc(x.name)+'</b><p>'+esc(x.detail||'')+'</p></div><span class="tag '+(x.status==='operational'||x.status==='configured'||x.status==='confirmed'?'green':x.status==='error'?'red':'amber')+'">'+esc(x.status.replace('_',' '))+'</span></article>').join('');
  const bad=adminHealthData.filter(x=>['error','not_configured','pending'].includes(x.status)).length,side=document.getElementById('adminSidebarHealth');if(side)side.textContent=bad?bad+' system item'+(bad===1?'':'s')+' need attention':'All systems operational';
  const title=document.getElementById('productionReadinessTitle'),copy=document.getElementById('productionReadinessCopy'),blockers=document.getElementById('productionReadinessBlockers'),card=document.getElementById('productionReadinessCard');
  if(adminReadinessData&&title&&copy&&blockers){
    title.textContent=adminReadinessData.ready?'Core launch dependencies are ready.':adminReadinessData.blockers.length+' launch blocker'+(adminReadinessData.blockers.length===1?'':'s')+' remain.';
    copy.textContent=adminReadinessData.ready?'Required infrastructure is configured. Complete the end-to-end release checklist before production launch.':'These are infrastructure requirements for a broad production launch, not just optional integrations.';
    blockers.innerHTML=(adminReadinessData.blockers||[]).map(x=>'<div class="readiness-blocker"><b>'+esc(x.name)+'</b><span>'+esc(x.detail||'Needs attention')+'</span></div>').join('')||'<div class="readiness-ok">No dependency blockers detected.</div>';
    card?.classList.toggle('ready',!!adminReadinessData.ready);
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
document.getElementById('closePhoneModal')?.addEventListener('click',closePhoneModal);
document.getElementById('savePhoneButton')?.addEventListener('click',savePhone);
document.getElementById('phoneModal')?.addEventListener('click',e=>{if(e.target.id==='phoneModal')closePhoneModal()});

function adminMoney(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}
function adminPlanMinutes(plan){return plan==='Starter'?300:plan==='Growth'?600:null}
function adminBillingTag(status){return status==='past_due'?'red':status==='canceled'?'amber':'green'}
function renderAdmin(){
  if(!adminSummaryData)return;
  const s=adminSummaryData,set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('adminMrr',adminMoney(s.mrr));set('adminActiveClients',s.activeClients||0);set('adminOnboarding',(s.onboarding||0)+' onboarding');
  set('adminMinutes',Number(s.totalMinutes||0).toLocaleString());set('adminPastDue',s.pastDue||0);
  const clientTotal=Math.max(1,Number(s.clients||adminClientsData.length||0)),activePct=Math.round(Number(s.activeClients||0)/clientTotal*100),billingPct=Math.round((clientTotal-Number(s.pastDue||0))/clientTotal*100),livePct=Math.round((clientTotal-Number(s.onboarding||0))/clientTotal*100);
  [['adminActiveRing','adminActivePct',activePct],['adminBillingRing','adminBillingPct',billingPct],['adminLiveRing','adminLivePct',livePct]].forEach(([ringId,textId,pct])=>{const ring=document.getElementById(ringId),txt=document.getElementById(textId);if(ring)ring.style.setProperty('--pct',pct);if(txt)txt.textContent=pct+'%'});
  set('revenueMrr',adminMoney(s.mrr));set('revenueActive',s.activeClients||0);set('revenuePastDue',s.pastDue||0);set('revenueOnboarding',s.onboarding||0);
  const mix=document.getElementById('adminPlanMix');if(mix){
    const pm=s.planMix||{},max=Math.max(1,...Object.values(pm).map(Number));
    mix.innerHTML=['Starter','Growth','Pro'].map(p=>'<div><span>'+p+' · '+Number(pm[p]||0)+' clients</span><i style="width:'+Math.round(Number(pm[p]||0)/max*100)+'%"></i></div>').join('');
  }
  const attention=document.getElementById('adminAttention');if(attention){
    const rows=[];
    adminClientsData.filter(x=>x.subscriptionStatus==='past_due').forEach(x=>rows.push('<div class="admin-event redline"><b>'+esc(x.name)+'</b><span>Stripe payment needs attention</span><small>Billing</small></div>'));
    adminClientsData.filter(x=>x.status==='onboarding').forEach(x=>rows.push('<div class="admin-event"><b>'+esc(x.name)+'</b><span>Workspace onboarding in progress</span><small>Onboarding</small></div>'));
    adminClientsData.filter(x=>x.status==='suspended').forEach(x=>rows.push('<div class="admin-event redline"><b>'+esc(x.name)+'</b><span>Workspace access is suspended</span><small>Workspace</small></div>'));
    attention.innerHTML=rows.slice(0,6).join('')||'<div class="empty-state"><h3>Nothing needs attention</h3><p>Billing and onboarding alerts will appear here.</p></div>';
  }
  renderAdminClients();
  const recent=document.getElementById('adminRecentClients');if(recent){
    recent.innerHTML=adminClientsData.slice(0,5).map(x=>adminClientRow(x,true)).join('')||'<div class="empty-state"><h3>No clients yet</h3></div>';
    recent.querySelectorAll('[data-admin-client]').forEach(b=>b.addEventListener('click',()=>openAdminClient(b.dataset.adminClient)));
  }
  const revenue=document.getElementById('adminRevenueList');if(revenue){revenue.innerHTML=adminClientsData.map(x=>'<div class="admin-event"><b>'+esc(x.name)+'</b><span>'+esc(x.plan)+' · '+esc(x.subscriptionStatus||'active')+'</span><small>'+adminMoney(PLAN_DATA[x.plan]?.price||0)+'/mo</small></div>').join('')||'<div class="empty-state"><h3>No revenue yet</h3></div>'}
  const usage=document.getElementById('adminUsageList');if(usage){
    usage.innerHTML=adminClientsData.map(x=>{
      const lim=adminPlanMinutes(x.plan),used=Number(x.usage?.minutes||0),pct=lim?Math.round(used/lim*100):null;
      return '<div class="admin-event"><b>'+esc(x.name)+'</b><span>'+used.toLocaleString()+' min'+(lim?' · '+pct+'% of '+lim:' · high-volume plan')+'</span><small>'+esc(x.plan)+'</small></div>';
    }).join('')||'<div class="empty-state"><h3>No usage yet</h3></div>';
  }
}
function adminClientRow(x,activity=false){
  const lim=adminPlanMinutes(x.plan),used=Number(x.usage?.minutes||0);
  const usage=lim?used+' / '+lim:used.toLocaleString()+' min';
  const initials=String(x.name||'?').split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase()||'?';
  if(activity)return '<div class="activity-row"><span class="time">'+esc(x.plan)+'</span><div class="person"><b>'+esc(initials)+'</b><span><strong>'+esc(x.name)+'</strong><small>'+esc(usage)+' · Billing '+esc(x.subscriptionStatus||'active')+'</small></span></div><span class="tag '+(x.status==='active'?'green':x.status==='suspended'?'red':'amber')+'">'+esc(x.status||'active')+'</span><button class="admin-link" data-admin-client="'+esc(x.id)+'">Manage</button></div>';
  return '<div class="admin-client-row"><span><strong>'+esc(x.name)+'</strong><small class="subtle">'+esc(x.ownerEmail||'')+'</small></span><span>'+esc(x.plan)+'</span><span>'+esc(usage)+'</span><span class="tag '+(x.status==='active'?'green':x.status==='suspended'?'red':'amber')+'">'+esc(x.status||'active')+'</span><span class="tag '+adminBillingTag(x.subscriptionStatus)+'">'+esc(x.subscriptionStatus||'active')+'</span><span><button class="admin-link" data-admin-client="'+esc(x.id)+'">Manage</button></span></div>';
}
function renderAdminClients(){
  const wrap=document.getElementById('adminClientsTable');if(!wrap)return;
  const rows=adminClientsData;
  wrap.innerHTML=rows.map(x=>adminClientRow(x)).join('');
  const empty=document.getElementById('adminClientsEmpty');if(empty)empty.hidden=rows.length!==0;
  wrap.querySelectorAll('[data-admin-client]').forEach(b=>b.addEventListener('click',()=>openAdminClient(b.dataset.adminClient)));
}
async function openAdminClient(id){
  const r=await fetch('/api/account?action=admin-client&id='+encodeURIComponent(id),{headers:{Accept:'application/json'},cache:'no-store'});
  if(!r.ok)return;
  const x=(await r.json()).client;if(!x)return;
  document.getElementById('adminClientName').textContent=x.name||'Client';
  document.getElementById('adminClientMeta').innerHTML=[x.plan,x.subscriptionStatus,x.ownerEmail].filter(Boolean).map(v=>'<span>'+esc(v)+'</span>').join('');
  document.getElementById('adminClientAccount').innerHTML=[
    ['Plan',x.plan],['Status',x.status],['Billing',x.subscriptionStatus],['Minutes',Number(x.usage?.minutes||0).toLocaleString()],['Stripe customer',x.stripe?.customerLinked?'Linked':'Not linked'],['Stripe subscription',x.stripe?.subscriptionLinked?'Linked':'Not linked']
  ].map(([k,v])=>'<div><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join('');
  document.getElementById('adminClientCounts').innerHTML=[['Calls',x.counts?.calls||0],['Leads',x.counts?.leads||0],['Appointments',x.counts?.appointments||0],['Locations',x.counts?.locations||0]].map(([k,v])=>'<div><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join('');
  document.getElementById('adminClientAgent').textContent=x.agent?(x.agent.name||'Maya')+' · '+(x.agent.role||'AI Receptionist'):'No agent configured yet.';
  currentAdminClient=x;
  const planSel=document.getElementById('adminClientPlan'),statusSel=document.getElementById('adminClientStatus');
  if(planSel){planSel.value=x.plan||'Starter';planSel.disabled=!!x.stripe?.subscriptionLinked}
  if(statusSel)statusSel.value=x.status||'active';
  const note=document.getElementById('adminClientManageNote');if(note)note.textContent=(x.stripe?.subscriptionLinked?'Plan is managed by Stripe. ':'Plan can be adjusted manually. ')+'Workspace status controls access/readiness; billing status is tracked separately.';
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
  for(const x of adminClientsData)if(match([x.name,x.ownerEmail,x.id,x.plan,x.subscriptionStatus]))items.push({type:'client',id:x.id,title:x.name||'Client',meta:[x.ownerEmail,x.plan,'Client'].filter(Boolean).join(' · '),view:'clients'});
  for(const p of adminWebsiteData.prospects||[])if(match([p.name,p.business,p.email,p.phone,p.source,p.stage,p.plan,p.industry]))items.push({type:'prospect',id:p.id,title:p.name||p.business||p.email||'Website prospect',meta:[p.business,p.email,p.stage,'Website prospect'].filter(Boolean).join(' · '),view:'website'});
  for(const t of adminSupportData||[])if(match([t.subject,t.workspaceName,t.email,t.message,t.priority,t.status]))items.push({type:'support',id:t.id,title:t.subject||'Support request',meta:[t.workspaceName,t.status,'Support'].filter(Boolean).join(' · '),view:'admin-support'});
  for(const x of adminFleetData.calls||[])if(match([x.id,x.callId,x.caller,x.phone,x.reason,x.summary,x.workspaceName,x.outcome]))items.push({type:'call',id:String(x.id||x.callId||''),title:x.caller||x.phone||'Call',meta:[x.workspaceName,x.reason,x.outcome,'Call'].filter(Boolean).join(' · '),view:'calls'});
  for(const x of adminFleetData.leads||[])if(match([x.id,x.name,x.email,x.phone,x.stage,x.workspaceName,x.source]))items.push({type:'lead',id:String(x.id||''),title:x.name||x.email||x.phone||'Lead',meta:[x.workspaceName,x.stage,'Lead'].filter(Boolean).join(' · '),view:'admin-leads'});
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
  showView(view);
  setTimeout(()=>{
    if(type==='prospect')flashAdminSearchTarget(document.querySelector('[data-website-prospect-id="'+CSS.escape(id)+'"]'));
    else if(type==='support')flashAdminSearchTarget(document.querySelector('[data-support-ticket-id="'+CSS.escape(id)+'"]'));
    else if(type==='call')flashAdminSearchTarget(document.querySelector('[data-admin-call-id="'+CSS.escape(id)+'"]'));
    else if(type==='lead')flashAdminSearchTarget(document.querySelector('[data-admin-lead-id="'+CSS.escape(id)+'"]'));
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
  button.addEventListener('click',e=>{e.stopPropagation();panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)document.getElementById('profileNameInput')?.focus()});
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
  const badge=document.getElementById('notificationBadge'),list=document.getElementById('notificationList'),empty=document.getElementById('notificationEmpty');
  if(badge){badge.textContent=notificationUnreadCount>99?'99+':String(notificationUnreadCount);badge.hidden=notificationUnreadCount===0}
  if(!list)return;
  list.innerHTML=notificationData.map(n=>'<button class="notification-item '+(n.read?'read':'unread')+'" data-notification-id="'+esc(n.id)+'" data-notification-view="'+esc(n.view||'overview')+'"><span class="notification-dot '+esc(n.kind||'info')+'">'+notificationKindIcon(n.kind)+'</span><span class="notification-copy"><b>'+esc(n.title||'Notification')+'</b><span>'+esc(n.body||'')+'</span><small>'+formatNotificationTime(n.createdAt)+'</small></span></button>').join('');
  if(empty)empty.hidden=notificationData.length!==0;
  list.querySelectorAll('[data-notification-id]').forEach(b=>b.addEventListener('click',()=>openNotification(b.dataset.notificationId,b.dataset.notificationView)));
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
async function openNotification(id,view){
  await markNotifications([id]);
  const panel=document.getElementById('notificationPanel'),bell=document.getElementById('notificationBell');if(panel)panel.hidden=true;if(bell)bell.setAttribute('aria-expanded','false');
  if(view)showView(view);
}
async function markAllNotifications(){
  const scope=notificationScope();
  await fetch('/api/account?action=notifications-read-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope})}).catch(()=>{});
  notificationData.forEach(n=>n.read=true);notificationUnreadCount=0;renderNotifications();
}
function initNotifications(){
  const bell=document.getElementById('notificationBell'),panel=document.getElementById('notificationPanel');if(!bell||!panel)return;
  bell.addEventListener('click',e=>{e.stopPropagation();panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)loadNotifications({silent:true})});
  panel.addEventListener('click',e=>e.stopPropagation());
  document.getElementById('notificationReadAll')?.addEventListener('click',markAllNotifications);
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
