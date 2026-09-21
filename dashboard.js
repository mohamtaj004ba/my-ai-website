const PLAN_DATA={
Starter:{price:349,minutes:300,locations:1,used:214,features:{appointments:false,automations:false,advancedAnalytics:false,apiAccess:false,unifiedInbox:false},unlock:'Growth'},
Growth:{price:599,minutes:600,locations:2,used:428,features:{appointments:true,automations:true,advancedAnalytics:true,apiAccess:false,unifiedInbox:true},unlock:'Pro'},
Pro:{price:999,minutes:null,locations:5,used:1240,features:{appointments:true,automations:true,advancedAnalytics:true,apiAccess:true,unifiedInbox:true},unlock:null}
};
const FEATURE_INFO={
appointments:{title:'AI appointment booking',copy:'Let Maya check availability and book qualified callers while you work.',tier:'Growth',items:['Calendar sync','Booking rules','Confirmations','Reschedule handling']},
automations:{title:'Advanced automations',copy:'Build follow-up sequences from call and lead events.',tier:'Growth',items:['Missed-call recovery','Lead follow-up','Team alerts','AI outbound steps']},
advancedAnalytics:{title:'Advanced analytics',copy:'Go beyond totals with conversion trends, call reasons and after-hours impact.',tier:'Growth',items:['Conversion trends','Call reason analysis','After-hours revenue','Lead attribution']},
apiAccess:{title:'API & webhooks',copy:'Connect CallerCore to custom tools and internal systems.',tier:'Pro',items:['Webhooks','API credentials','Custom events','Advanced integrations']},
unifiedInbox:{title:'Unified inbox',copy:'Keep customer voice, SMS and digital conversations in one timeline.',tier:'Growth',items:['Voice timeline','SMS inbox','Shared notes','Cross-channel history']}
};
const params=new URLSearchParams(location.search);
const demoMode=location.hostname.endsWith('.vercel.app')&&params.get('demo')==='1';
let currentPlan=params.get('plan')||'Growth';if(!PLAN_DATA[currentPlan])currentPlan='Growth';
let sessionWorkspace=null,sessionOnboarding=null;
let currentUserProfile={displayName:'CallerCore User',email:'',avatarDataUrl:''};
let notificationData=[],notificationUnreadCount=0,notificationsLoading=false;
let callsData=[],leadsData=[],conversationsData=[],appointmentsData=[],agentData=null,automationsData=[],analyticsData=null,settingsData=null,integrationsData=null,supportTicketsData=[],phoneRoutingData=null,locationsData=[],locationsLimit=1;
const DEMO_CALLS=[
{id:'c1',caller:'Sarah Johnson',phone:'(509) 555-0148',reason:'Roof replacement estimate',duration:'4:32',outcome:'Booked',agent:'Maya',time:'3:14 PM',summary:'Sarah owns a two-story home and wants a full roof replacement estimate. Maya confirmed the property is in the service area and booked an inspection for Tuesday at 10:30 AM.',qualification:{Intent:'High',Service:'Replacement',Timeline:'This month',Value:'$8,500'},transcript:[['Maya','Thank you for calling Alpine Roofing. This is Maya. How can I help?'],['Sarah','I need an estimate to replace my roof.'],['Maya','Absolutely. I can help get an inspection scheduled. Is the property in Spokane?'],['Sarah','Yes, on the South Hill.']]},
{id:'c2',caller:'Mike Peterson',phone:'(509) 555-0193',reason:'Storm damage inspection',duration:'3:17',outcome:'Qualified',agent:'Maya',time:'2:57 PM',summary:'Mike reported visible shingle damage after a recent storm. He is the homeowner, is within the service area, and asked for an inspection this week.',qualification:{Intent:'High',Service:'Storm damage',Timeline:'This week',Value:'$4,200'},transcript:[['Maya','Tell me what happened with the roof.'],['Mike','We lost shingles in the wind and I can see damage from the yard.'],['Maya','Got it. Are you the homeowner?'],['Mike','Yes.']]},
{id:'c3',caller:'Unknown caller',phone:'Private',reason:'Missed call recovery',duration:'—',outcome:'Follow-up',agent:'Recovery',time:'2:41 PM',summary:'The caller disconnected before the AI answered. CallerCore automatically sent the missed-call recovery text.',qualification:{Intent:'Unknown',Service:'Unknown',Timeline:'Unknown',Value:'—'},transcript:[['CallerCore','Missed call detected. Recovery SMS sent automatically.']]}
];
const DEMO_LEADS=[
{id:'l1',name:'Emily Ross',service:'Roof leak',value:2800,stage:'New',source:'AI call',age:'12m'},
{id:'l2',name:'David Nguyen',service:'Gutter replacement',value:1900,stage:'Contacted',source:'SMS',age:'1h'},
{id:'l3',name:'Mike Peterson',service:'Storm damage',value:4200,stage:'Qualified',source:'AI call',age:'2h'},
{id:'l4',name:'Sarah Johnson',service:'Roof replacement',value:8500,stage:'Appointment',source:'AI call',age:'3h'},
{id:'l5',name:'Jared Lee',service:'Full roof',value:13400,stage:'Won',source:'AI call',age:'2d'},
{id:'l6',name:'Chris Bell',service:'Repair estimate',value:1600,stage:'Lost',source:'Web',age:'4d'}
];
const DEMO_CONVERSATIONS=[
{id:'m1',name:'Sarah Johnson',phone:'(509) 555-0148',status:'Active',last:'Appointment confirmed for Tuesday at 10:30 AM.',time:'3:22 PM',messages:[{who:'Maya',text:'Thanks for calling Alpine Roofing today. Your inspection is booked for Tuesday at 10:30 AM.',dir:'out'},{who:'Sarah',text:'Perfect, thank you!',dir:'in'},{who:'CallerCore',text:'Appointment confirmation sent',dir:'system'}]},
{id:'m2',name:'Mike Peterson',phone:'(509) 555-0193',status:'Needs follow-up',last:'Can someone come by this week?',time:'3:02 PM',messages:[{who:'Maya',text:'Thanks for speaking with me about the storm damage. I shared your request with the team.',dir:'out'},{who:'Mike',text:'Can someone come by this week?',dir:'in'}]},
{id:'m3',name:'Unknown caller',phone:'Private',status:'Recovered',last:'Sorry we missed you. How can we help?',time:'2:42 PM',messages:[{who:'CallerCore',text:'Missed call recovery SMS sent',dir:'system'},{who:'Maya',text:'Sorry we missed you. How can we help?',dir:'out'}]}
];
const DEMO_APPOINTMENTS=[
{id:'a1',name:'Sarah Johnson',phone:'(509) 555-0148',date:'Tue, Sep 22',time:'10:30 AM',service:'Roof replacement inspection',status:'Confirmed',source:'Maya'},
{id:'a2',name:'Emily Ross',phone:'(509) 555-0114',date:'Wed, Sep 23',time:'1:00 PM',service:'Roof leak inspection',status:'Scheduled',source:'Maya'},
{id:'a3',name:'Jared Lee',phone:'(509) 555-0181',date:'Fri, Sep 18',time:'9:00 AM',service:'Full roof estimate',status:'Completed',source:'Team'}
];
const DEMO_AGENT={name:'Maya',role:'AI Receptionist',openingMessage:'Thank you for calling Alpine Roofing. This is Maya. How can I help you today?',tone:'Warm & professional',serviceArea:'Spokane, Spokane Valley, Liberty Lake and nearby communities.',businessHours:'Monday–Friday 8 AM–5 PM. Saturday by appointment.',emergencyInstructions:'For active leaks or storm damage, collect the address, confirm safety, and mark the lead urgent for immediate team follow-up.',qualificationQuestions:['What service are you calling about?','Are you the property owner?','What is the property address?','How soon are you hoping to have the work completed?'],transferNumber:'(509) 555-0100'};
const DEMO_AUTOMATIONS=[
{id:'auto1',name:'Missed-call recovery',trigger:'missed_call',action:'send_sms',enabled:true},
{id:'auto2',name:'Hot lead team alert',trigger:'qualified_lead',action:'notify_team',enabled:true},
{id:'auto3',name:'Appointment confirmation',trigger:'appointment_booked',action:'send_confirmation',enabled:true}
];
const DEMO_SETTINGS={businessName:'Alpine Roofing',primaryEmail:'owner@alpineroofing.com',timezone:'America/Los_Angeles',notificationEmail:'owner@alpineroofing.com',smsAlerts:true,emailAlerts:true};
const DEMO_INTEGRATIONS={googleCalendar:true,stripe:true,webhookUrl:'',apiAccess:false};
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


function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));document.querySelector('.sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});markViewNotificationsRead(name);if(name==='overview')renderOverview();if(name==='billing')renderBilling();if(name==='calls')renderCalls();if(name==='leads')renderLeads();if(name==='conversations')renderConversations();if(name==='appointments')renderAppointments();if(name==='agent')renderAgent();if(name==='automations')renderAutomations();if(name==='analytics')renderAnalytics();if(name==='integrations')renderIntegrations();if(name==='settings')renderSettings();if(name==='inbox'&&document.body.dataset.dashboard==='admin')loadAdminInbox();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelector('.mobile-menu')?.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('open'));

function has(feature){return !!PLAN_DATA[currentPlan]?.features?.[feature]}
function featureStage(el,feature){const info=FEATURE_INFO[feature],ok=has(feature);if(ok){el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>Included with '+currentPlan+'</h2><p class="muted">'+info.copy+'</p><div class="fake-chart"></div></article><article class="panel"><span class="eyebrow">Active feature</span><h2>Included in your plan</h2><p class="muted">Use the live controls on this page to configure the feature for your workspace.</p></article></div>'}else{el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>See what this could do for your business.</h2><p class="muted">'+info.copy+'</p><div class="fake-chart"></div></article><article class="panel gate-card"><small>AVAILABLE ON '+info.tier.toUpperCase()+'</small><h2>Unlock '+info.title+'</h2><p>'+info.copy+'</p><ul>'+info.items.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="primary" data-upgrade="'+info.tier+'">Upgrade to '+info.tier+'</button></article></div>'}}
function renderStages(){
  document.querySelectorAll('[data-feature-card]').forEach(el=>featureStage(el,el.dataset.featureCard));
  document.querySelectorAll('[data-feature]').forEach(el=>{
    const f=el.dataset.feature,allowed=has(f),info=FEATURE_INFO[f];
    el.classList.toggle('feature-locked',!allowed);el.setAttribute('aria-disabled',allowed?'false':'true');
    const lock=el.querySelector('.lock');
    if(lock){lock.textContent=allowed?'ON':(info?.tier||'Locked').toUpperCase();lock.className='lock '+(allowed?'lock-on':'')}
    if(!allowed&&el.classList.contains('integration-card'))el.title='Requires '+(info?.tier||'a higher plan');
  });
  bindUpgradeButtons()
}

function renderOverviewUnlocks(){const el=document.getElementById('overviewUnlocks');if(!el)return;const next=PLAN_DATA[currentPlan].unlock;if(!next){el.innerHTML='<article class="unlock-card"><small>PRO PLAN</small><h3>You have every core feature.</h3><p>Future enterprise capabilities and add-ons can appear here without changing the plan architecture.</p></article>';return}const locked=Object.keys(PLAN_DATA[currentPlan].features).filter(f=>!has(f)).slice(0,3);if(!locked.length&&next==='Pro')locked.push('apiAccess');el.innerHTML=locked.map(f=>{const i=FEATURE_INFO[f];return '<article class="unlock-card"><small>UNLOCK WITH '+i.tier.toUpperCase()+'</small><h3>'+i.title+'</h3><p>'+i.copy+'</p><button data-upgrade="'+i.tier+'">See what you unlock →</button></article>'}).join('');bindUpgradeButtons()}

function renderBillingConnection(){
  const box=document.getElementById('billingConnection'),btn=document.getElementById('paymentButton');if(!box||!btn)return;
  const linked=!!sessionWorkspace?.stripe?.customerLinked;
  box.innerHTML=linked?'<b>Stripe customer linked</b><small>Your subscription is connected to secure Stripe billing.</small>':'<b>Billing account not linked</b><small>This workspace does not currently have a Stripe customer attached.</small>';
  btn.disabled=!linked||!sessionWorkspace?.stripe?.customerLinked;btn.textContent=linked?'Manage billing':'Billing unavailable';
}
function renderBilling(){
  const d=PLAN_DATA[currentPlan];
  document.getElementById('billingPlan')&&(document.getElementById('billingPlan').textContent=currentPlan);
  document.getElementById('billingPrice')&&(document.getElementById('billingPrice').textContent='$'+d.price+'/month');
  const usageText=d.minutes?d.used+' / '+d.minutes:d.used+' min · unlimited plan';
  document.getElementById('billingUsageText')&&(document.getElementById('billingUsageText').textContent=usageText);
  const pct=d.minutes?Math.min(100,(d.used/d.minutes)*100):38;
  document.getElementById('billingUsage')?.style.setProperty('width',pct+'%');
  document.getElementById('sidebarUsage')?.style.setProperty('width',pct+'%');
  document.getElementById('sidebarUsageLabel')&&(document.getElementById('sidebarUsageLabel').textContent=usageText);
  document.getElementById('sidebarPlan')&&(document.getElementById('sidebarPlan').textContent=currentPlan);
  const wrap=document.getElementById('planComparison');
  if(wrap)wrap.innerHTML=Object.entries(PLAN_DATA).map(([name,p])=>{
    const current=name===currentPlan;
    const list=name==='Starter'
      ?['300 included minutes','1 location','Calls, leads & AI agent','Phone routing & support']
      :name==='Growth'
        ?['600 included minutes','Up to 2 locations','Unified conversations & appointments','Automations & advanced analytics']
        :['Unlimited minutes','Up to 5 locations','Everything in Growth','API & webhooks'];
    return '<article class="plan-option '+(current?'current':'')+'"><span class="eyebrow">'+(current?'Your plan':'CallerCore '+name)+'</span><h3>'+name+'</h3><b>$'+p.price+'/mo</b><ul>'+list.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="'+(current?'secondary-btn':'primary')+'" '+(current?'disabled':'data-upgrade="'+name+'"')+'>'+(current?'Current plan':(p.price>d.price?'Upgrade to ':'Switch to ')+name)+'</button></article>'
  }).join('');
  bindUpgradeButtons()
}
function setPlan(plan){currentPlan=plan;document.getElementById('planSelector')&&(document.getElementById('planSelector').value=plan);renderBilling();renderStages();renderOverviewUnlocks();renderEntitledApps()}
document.getElementById('planSelector')?.addEventListener('change',e=>setPlan(e.target.value));


async function loadOperations(){
  if(demoMode){
    callsData=DEMO_CALLS.map(x=>({...x}));leadsData=DEMO_LEADS.map(x=>({...x}));
    conversationsData=DEMO_CONVERSATIONS.map(x=>({...x}));appointmentsData=DEMO_APPOINTMENTS.map(x=>({...x}));
    agentData={...DEMO_AGENT,qualificationQuestions:[...DEMO_AGENT.qualificationQuestions]};
    automationsData=DEMO_AUTOMATIONS.map(x=>({...x}));
    settingsData={...DEMO_SETTINGS};integrationsData={...DEMO_INTEGRATIONS,apiAccess:has('apiAccess')};
    phoneRoutingData={number:'(509) 555-0100',label:'Primary',provider:'Vapi',forwardingFrom:'(509) 555-0199',transferNumber:'(509) 555-0101',afterHours:'ai',smsEnabled:true,status:'active'};
    locationsData=[{id:'loc-demo',name:'Spokane',phone:'(509) 555-0199',address:'Spokane, WA',timezone:'America/Los_Angeles',active:true}];locationsLimit=PLAN_DATA[currentPlan].locations||1;
    analyticsData=buildLocalAnalytics();
    renderCalls();renderLeads();renderConversations();renderAppointments();renderAgent();renderAutomations();renderAnalytics();renderIntegrations();renderSettings();renderOverview();renderSupport();renderClientSetupStatus();renderClientChecklist();renderBillingConnection();renderPhoneRouting();renderLocations();return;
  }
  try{
    const jobs=[
      fetch('/api/account?action=calls',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=leads',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=agent',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=settings',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=integrations',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=support-tickets',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=phone-routing',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=locations',{headers:{Accept:'application/json'},cache:'no-store'})
    ];
    if(has('advancedAnalytics'))jobs.push(fetch('/api/account?action=analytics',{headers:{Accept:'application/json'},cache:'no-store'}));
    if(has('unifiedInbox'))jobs.push(fetch('/api/account?action=conversations',{headers:{Accept:'application/json'},cache:'no-store'}));
    if(has('appointments'))jobs.push(fetch('/api/account?action=appointments',{headers:{Accept:'application/json'},cache:'no-store'}));
    if(has('automations'))jobs.push(fetch('/api/account?action=automations',{headers:{Accept:'application/json'},cache:'no-store'}));
    const results=await Promise.all(jobs);
    if(results[0].ok)callsData=(await results[0].json()).calls||[];
    if(results[1].ok)leadsData=(await results[1].json()).leads||[];
    if(results[2].ok)agentData=(await results[2].json()).agent||null;
    if(results[3].ok)settingsData=(await results[3].json()).settings||null;
    if(results[4].ok)integrationsData=(await results[4].json()).integrations||null;
    if(results[5].ok)supportTicketsData=(await results[5].json()).tickets||[];
    if(results[6].ok)phoneRoutingData=(await results[6].json()).routing||null;
    if(results[7].ok){const loc=await results[7].json();locationsData=loc.locations||[];locationsLimit=Number(loc.limit||1)}
    let idx=8;
    if(has('advancedAnalytics')){if(results[idx].ok)analyticsData=(await results[idx].json()).analytics||null;idx++}
    if(has('unifiedInbox')){if(results[idx].ok)conversationsData=(await results[idx].json()).conversations||[];idx++}
    if(has('appointments')){if(results[idx].ok)appointmentsData=(await results[idx].json()).appointments||[];idx++}
    if(has('automations')){if(results[idx].ok)automationsData=(await results[idx].json()).automations||[]}
  }catch(err){console.error('Operations data failed',err)}
  renderCalls();renderLeads();renderConversations();renderAppointments();renderAgent();renderAutomations();renderAnalytics();renderIntegrations();renderSettings();renderOverview();renderSupport();renderClientChecklist();renderBillingConnection();renderPhoneRouting();renderLocations();
}

function renderOverview(){
  const calls=callsData.length,leads=leadsData.length,appointments=appointmentsData.length;
  const pipeline=leadsData.reduce((sum,x)=>sum+Number(x&&x.value||0),0);
  const minutes=Number(PLAN_DATA[currentPlan]?.used||0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('overviewCalls',calls);set('overviewLeads',leads);set('overviewAppointments',appointments);set('overviewPipeline',money(pipeline));
  if(!demoMode){
    set('overviewCallsMeta',calls?'Handled in this workspace':'No calls yet');
    set('overviewLeadsMeta',leads?'Captured from CallerCore':'No leads yet');
    set('overviewAppointmentsMeta',appointments?'Booked appointments':'No appointments yet');
    set('overviewPipelineMeta',pipeline?'Estimated opportunity':'No pipeline value yet');
  }
  const name=agentData?.name||'Maya';
  set('overviewAgentName',name+' is online');
  set('overviewAgentMeta',(calls?Math.round((calls/Math.max(1,calls))*100):0)+'% answer rate · '+minutes+' minutes this month');
  set('overviewAgentCalls',calls);set('overviewAgentLeads',leads);set('overviewAgentAppointments',appointments);
  const wrap=document.getElementById('overviewActivity');
  if(wrap){
    const recent=callsData.slice(0,3);
    wrap.innerHTML=recent.length?recent.map(x=>{
      const initials=String(x.caller||'?').split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()||'?';
      const lead=leadsData.find(l=>l&&l.name===x.caller);
      return '<div class="activity-row"><span class="time">'+esc(x.time||'—')+'</span><div class="person"><b>'+esc(initials)+'</b><span><strong>'+esc(x.caller||'Unknown caller')+'</strong><small>'+esc(x.reason||'Call activity')+'</small></span></div><span class="tag '+outcomeClass(x.outcome)+'">'+esc(x.outcome||'Handled')+'</span><strong>'+(lead?money(lead.value):'—')+'</strong></div>';
    }).join(''):'<div class="empty-state"><h3>No activity yet</h3><p>Calls, leads and booked appointments will appear here as CallerCore starts handling traffic.</p></div>';
  }
}

function outcomeClass(outcome){return /book|qualif/i.test(outcome)?'green':/miss|follow/i.test(outcome)?'amber':'amber'}
function renderCalls(){
  const wrap=document.getElementById('callsTable');if(!wrap)return;
  const q=(document.getElementById('callSearch')?.value||'').trim().toLowerCase();
  const filter=document.getElementById('callFilter')?.value||'all';
  const rows=callsData.filter(x=>{
    const hay=[x.caller,x.phone,x.reason,x.outcome,x.agent].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(filter==='all'||String(x.outcome||'').includes(filter));
  });
  wrap.innerHTML=rows.map(x=>'<div class="call-row data" data-call-id="'+esc(x.id)+'"><span><strong>'+esc(x.caller||'Unknown')+'</strong><small class="subtle">'+esc(x.phone||'')+'</small></span><span>'+esc(x.reason||'—')+'</span><span>'+esc(x.duration||'—')+'</span><span class="tag '+outcomeClass(x.outcome)+'">'+esc(x.outcome||'Unknown')+'</span><span>'+esc(x.agent||'Maya')+'</span></div>').join('');
  document.getElementById('callsEmpty').hidden=rows.length!==0;
  wrap.querySelectorAll('[data-call-id]').forEach(row=>row.addEventListener('click',()=>openCall(row.dataset.callId)));
}
function openCall(id){
  const x=callsData.find(c=>String(c.id)===String(id));if(!x)return;
  document.getElementById('drawerCaller').textContent=x.caller||'Unknown caller';
  document.getElementById('drawerMeta').innerHTML=[x.phone,x.time,x.duration,x.outcome,x.agent].filter(Boolean).map(v=>'<span>'+esc(v)+'</span>').join('');
  document.getElementById('drawerSummary').textContent=x.summary||'No AI summary is available yet.';
  const q=x.qualification||{};
  document.getElementById('drawerQualification').innerHTML=Object.entries(q).map(([k,v])=>'<div><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join('')||'<span class="muted">No qualification data yet.</span>';
  const t=Array.isArray(x.transcript)?x.transcript:[];
  document.getElementById('drawerTranscript').innerHTML=t.map(pair=>'<div class="'+(String(pair[0]).toLowerCase()==='maya'?'ai':'')+'"><b>'+esc(pair[0])+'</b>'+esc(pair[1])+'</div>').join('')||'<span class="muted">Transcript unavailable.</span>';
  document.getElementById('callDrawer').classList.add('open');document.getElementById('drawerBackdrop').classList.add('open');
  document.getElementById('callDrawer').setAttribute('aria-hidden','false');
}
function closeCall(){document.getElementById('callDrawer')?.classList.remove('open');document.getElementById('drawerBackdrop')?.classList.remove('open');document.getElementById('callDrawer')?.setAttribute('aria-hidden','true')}
function money(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}
function renderLeads(){
  const board=document.getElementById('leadKanban');if(!board)return;
  const q=(document.getElementById('leadSearch')?.value||'').trim().toLowerCase();
  const visible=leadsData.filter(x=>!q||[x.name,x.service,x.source,x.stage].join(' ').toLowerCase().includes(q));
  board.innerHTML=LEAD_STAGES.map(stage=>{
    const items=visible.filter(x=>(x.stage||'New')===stage);
    return '<div class="lead-column" data-stage="'+stage+'"><h3>'+stage+' <span>'+items.length+'</span></h3>'+items.map(x=>'<article draggable="true" data-lead-id="'+esc(x.id)+'"><b>'+esc(x.name||'Unnamed lead')+'</b><small>'+esc(x.service||'General inquiry')+'</small><div class="lead-value">'+money(x.value)+'</div><div class="lead-foot"><span>'+esc(x.source||'CallerCore')+'</span><span>'+esc(x.age||'')+'</span></div><select class="lead-stage-select" data-lead-stage="'+esc(x.id)+'" aria-label="Lead stage">'+LEAD_STAGES.map(s=>'<option '+(s===stage?'selected':'')+'>'+s+'</option>').join('')+'</select></article>').join('')+'</div>';
  }).join('');
  document.getElementById('leadsEmpty').hidden=visible.length!==0;
  board.querySelectorAll('[draggable="true"]').forEach(card=>{
    card.addEventListener('dragstart',()=>{card.classList.add('dragging');card.dataset.dragging='1'});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');delete card.dataset.dragging});
  });
  board.querySelectorAll('[data-lead-stage]').forEach(sel=>sel.addEventListener('change',e=>{e.stopPropagation();moveLead(sel.dataset.leadStage,sel.value)}));
  board.querySelectorAll('.lead-column').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drop-active')});
    col.addEventListener('dragleave',()=>col.classList.remove('drop-active'));
    col.addEventListener('drop',async e=>{
      e.preventDefault();col.classList.remove('drop-active');
      const card=board.querySelector('[data-dragging="1"]');if(!card)return;
      card.removeAttribute('data-dragging');await moveLead(card.dataset.leadId,col.dataset.stage);
    });
  });
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
document.getElementById('leadSearch')?.addEventListener('input',renderLeads);
document.getElementById('closeCallDrawer')?.addEventListener('click',closeCall);
document.getElementById('drawerBackdrop')?.addEventListener('click',closeCall);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCall()});


function renderEntitledApps(){
  const cg=document.getElementById('conversationGate'),ca=document.getElementById('conversationApp');
  if(cg&&ca){cg.hidden=has('unifiedInbox');ca.hidden=!has('unifiedInbox')}
  const ag=document.getElementById('appointmentGate'),aa=document.getElementById('appointmentApp');
  if(ag&&aa){ag.hidden=has('appointments');aa.hidden=!has('appointments')}
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
  const rows=conversationsData.filter(x=>!q||[x.name,x.phone,x.last,x.status].join(' ').toLowerCase().includes(q));
  list.innerHTML=rows.map((x,i)=>'<button class="thread-item '+(i===0&&!document.querySelector('.thread-item.active')?'active':'')+'" data-thread-id="'+esc(x.id)+'"><div class="thread-top"><strong>'+esc(x.name||'Unknown')+'</strong><small>'+esc(x.time||'')+'</small></div><small>'+esc(x.phone||'')+' · '+esc(x.status||'')+'</small><p>'+esc(x.last||'')+'</p></button>').join('');
  list.querySelectorAll('[data-thread-id]').forEach(btn=>btn.addEventListener('click',()=>openConversation(btn.dataset.threadId)));
  const active=list.querySelector('.thread-item.active')||list.querySelector('.thread-item');if(active)openConversation(active.dataset.threadId);else{document.getElementById('conversationName').textContent='No conversations';stream.innerHTML='<div class="empty-state"><h3>No conversations yet</h3><p>Voice and SMS activity will appear here.</p></div>'}
}
function openConversation(id){
  const x=conversationsData.find(v=>String(v.id)===String(id));if(!x)return;
  document.querySelectorAll('.thread-item').forEach(b=>b.classList.toggle('active',b.dataset.threadId===String(id)));
  document.getElementById('conversationName').textContent=x.name||'Unknown';
  const status=document.getElementById('conversationStatus');status.textContent=x.status||'Active';status.className='tag '+(/active|recover/i.test(x.status||'')?'green':'amber');
  document.getElementById('messageStream').innerHTML=(Array.isArray(x.messages)?x.messages:[]).map(m=>'<div class="message '+(m.dir==='out'?'out':m.dir==='system'?'system':'')+'">'+(m.dir==='system'?'':'<b>'+esc(m.who||'Customer')+'</b>')+esc(m.text||'')+'</div>').join('')||'<div class="empty-state"><h3>No messages yet</h3></div>';
}
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


function renderAgent(){
  if(!agentData)return;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  set('agentName',agentData.name);set('agentRole',agentData.role);set('agentTone',agentData.tone);
  set('agentOpening',agentData.openingMessage);set('agentServiceArea',agentData.serviceArea);
  set('agentHours',agentData.businessHours);set('agentTransfer',agentData.transferNumber);set('agentEmergency',agentData.emergencyInstructions);
  renderQuestions();
}
function renderQuestions(){
  const wrap=document.getElementById('qualificationQuestions');if(!wrap||!agentData)return;
  const qs=Array.isArray(agentData.qualificationQuestions)?agentData.qualificationQuestions:[];
  wrap.innerHTML=qs.map((q,i)=>'<div class="question-row"><input data-question-index="'+i+'" value="'+esc(q)+'"><button data-remove-question="'+i+'" aria-label="Remove">×</button></div>').join('');
  wrap.querySelectorAll('[data-question-index]').forEach(input=>input.addEventListener('input',()=>{agentData.qualificationQuestions[Number(input.dataset.questionIndex)]=input.value}));
  wrap.querySelectorAll('[data-remove-question]').forEach(btn=>btn.addEventListener('click',()=>{agentData.qualificationQuestions.splice(Number(btn.dataset.removeQuestion),1);renderQuestions()}));
}
function collectAgent(){
  const val=id=>document.getElementById(id)?.value||'';
  return {name:val('agentName'),role:val('agentRole'),tone:val('agentTone'),openingMessage:val('agentOpening'),serviceArea:val('agentServiceArea'),businessHours:val('agentHours'),transferNumber:val('agentTransfer'),emergencyInstructions:val('agentEmergency'),qualificationQuestions:[...(agentData?.qualificationQuestions||[])]};
}
async function saveAgent(){
  agentData=collectAgent();
  if(!demoMode){
    const r=await fetch('/api/account?action=agent-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(agentData)});
    if(!r.ok){alert('Could not save the AI agent right now.');return}
    agentData=(await r.json()).agent||agentData;
  }
  const s=document.getElementById('agentSaveStatus');if(s){s.classList.add('show');setTimeout(()=>s.classList.remove('show'),1600)}
}
function triggerLabel(v){return ({missed_call:'Missed call',new_lead:'New lead captured',qualified_lead:'Lead qualified',appointment_booked:'Appointment booked',after_hours_call:'After-hours call'})[v]||v}
function actionLabel(v){return ({send_sms:'Send SMS',notify_team:'Notify team',create_followup:'Create follow-up task',mark_priority:'Mark lead priority',send_confirmation:'Send confirmation'})[v]||v}
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
      missed_call:{name:'Missed-call recovery',trigger:'missed_call',action:'send_sms'},
      new_lead:{name:'New lead alert',trigger:'new_lead',action:'notify_team'},
      appointment_booked:{name:'Booking confirmation',trigger:'appointment_booked',action:'send_confirmation'}
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
document.getElementById('addQuestionButton')?.addEventListener('click',()=>{if(!agentData)agentData={...DEMO_AGENT,qualificationQuestions:[]};agentData.qualificationQuestions=agentData.qualificationQuestions||[];if(agentData.qualificationQuestions.length<12){agentData.qualificationQuestions.push('');renderQuestions()}});
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
  const a=analyticsData||buildLocalAnalytics();if(!a)return;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('analyticsCalls',a.calls||0);set('analyticsQualified',a.qualified||0);set('analyticsConversion',(a.conversion||0)+'%');set('analyticsPipeline',money(a.pipeline||0));
  set('analyticsLeads',a.leads||0);set('analyticsAppointments',a.appointments||0);set('analyticsWon',a.won||0);
  const wrap=document.getElementById('callReasonBars');if(!wrap)return;
  const rows=Array.isArray(a.callReasons)?a.callReasons:[],max=Math.max(1,...rows.map(x=>Number(x.value||0)));
  wrap.innerHTML=rows.map(x=>'<div class="bar-row"><span>'+esc(x.label)+'</span><b>'+Number(x.value||0)+'</b><div class="bar-track"><i style="width:'+Math.round(Number(x.value||0)/max*100)+'%"></i></div></div>').join('')||'<span class="muted">No call data yet.</span>';
}
function renderIntegrations(){
  if(!integrationsData)integrationsData={googleCalendar:false,stripe:!!sessionWorkspace?.stripe?.customerLinked,webhookUrl:'',apiAccess:has('apiAccess')};
  const g=document.getElementById('googleCalendarStatus');if(g){g.textContent=integrationsData.googleCalendar?'Connected':'Not connected';g.className='tag '+(integrationsData.googleCalendar?'green':'amber')}
  const s=document.getElementById('stripeIntegrationStatus');if(s){s.textContent=integrationsData.stripe?'Linked':'Not linked';s.className='tag '+(integrationsData.stripe?'green':'amber')}
  const panel=document.getElementById('webhookPanel');if(panel)panel.hidden=!has('apiAccess');
  const url=document.getElementById('webhookUrl');if(url)url.value=integrationsData.webhookUrl||'';
}
async function saveWebhook(){
  if(!has('apiAccess'))return openModal('Pro');
  const webhookUrl=document.getElementById('webhookUrl')?.value.trim()||'';
  if(demoMode){integrationsData={...(integrationsData||{}),webhookUrl};return}
  const r=await fetch('/api/account?action=integrations-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({webhookUrl})});
  if(!r.ok){alert('Could not save webhook. Make sure it uses HTTPS.');return}
  integrationsData={...(integrationsData||{}),...((await r.json()).integrations||{})};renderIntegrations();
}
function renderSettings(){
  if(!settingsData)return;
  const put=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  put('settingsBusinessName',settingsData.businessName);put('settingsContactName',settingsData.contactName);put('settingsPrimaryEmail',settingsData.primaryEmail);put('settingsBusinessPhone',settingsData.businessPhone);put('settingsWebsite',settingsData.website);put('settingsIndustry',settingsData.industry);put('settingsServiceArea',settingsData.serviceArea);put('settingsStreetAddress',settingsData.streetAddress);put('settingsCity',settingsData.city);put('settingsState',settingsData.state);put('settingsPostalCode',settingsData.postalCode);put('settingsTimezone',settingsData.timezone);put('settingsNotificationEmail',settingsData.notificationEmail);
  const e=document.getElementById('settingsEmailAlerts'),s=document.getElementById('settingsSmsAlerts');if(e)e.checked=settingsData.emailAlerts!==false;if(s)s.checked=settingsData.smsAlerts!==false;
  for(const [id,key] of [['settingsNotifyBilling','notifyBilling'],['settingsNotifySetup','notifySetup'],['settingsNotifyCalls','notifyCalls'],['settingsNotifySupport','notifySupport'],['settingsNotifyUsage','notifyUsage']]){const el=document.getElementById(id);if(el)el.checked=settingsData[key]!==false}
}
async function saveSettings(){
  const payload={businessName:document.getElementById('settingsBusinessName')?.value||'',contactName:document.getElementById('settingsContactName')?.value||'',primaryEmail:document.getElementById('settingsPrimaryEmail')?.value||'',businessPhone:document.getElementById('settingsBusinessPhone')?.value||'',website:document.getElementById('settingsWebsite')?.value||'',industry:document.getElementById('settingsIndustry')?.value||'',serviceArea:document.getElementById('settingsServiceArea')?.value||'',streetAddress:document.getElementById('settingsStreetAddress')?.value||'',city:document.getElementById('settingsCity')?.value||'',state:document.getElementById('settingsState')?.value||'',postalCode:document.getElementById('settingsPostalCode')?.value||'',timezone:document.getElementById('settingsTimezone')?.value||'America/Los_Angeles',notificationEmail:document.getElementById('settingsNotificationEmail')?.value||'',emailAlerts:!!document.getElementById('settingsEmailAlerts')?.checked,smsAlerts:!!document.getElementById('settingsSmsAlerts')?.checked,notifyBilling:!!document.getElementById('settingsNotifyBilling')?.checked,notifySetup:!!document.getElementById('settingsNotifySetup')?.checked,notifyCalls:!!document.getElementById('settingsNotifyCalls')?.checked,notifySupport:!!document.getElementById('settingsNotifySupport')?.checked,notifyUsage:!!document.getElementById('settingsNotifyUsage')?.checked};
  if(demoMode)settingsData={...payload};
  else{
    const r=await fetch('/api/account?action=settings-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok){alert('Could not save workspace settings.');return}
    settingsData=(await r.json()).settings||payload;
    if(settingsData.businessName){document.getElementById('workspaceName').textContent=settingsData.businessName;document.querySelectorAll('[data-business-name]').forEach(el=>el.textContent=settingsData.businessName)}
  }
  const tag=document.getElementById('settingsSaveStatus');if(tag){tag.classList.add('show');setTimeout(()=>tag.classList.remove('show'),1600)}
}


function renderPhoneRouting(){
  const d=phoneRoutingData,set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  if(!document.getElementById('clientPhoneNumber'))return;
  set('clientPhoneNumber',d?.number||sessionWorkspace?.phone||'Not assigned');
  set('clientPhoneProvider',d?.provider?d.provider+' · '+(d.status||'active'):'Awaiting provisioning');
  set('clientForwardingFrom',d?.forwardingFrom||'—');set('clientTransferNumber',d?.transferNumber||agentData?.transferNumber||'—');
  set('clientAfterHours',d?({ai:'AI answers',transfer:'Transfer',voicemail:'Voicemail'}[d.afterHours]||d.afterHours):'—');
  set('clientSmsStatus',d?(d.smsEnabled?'SMS enabled':'SMS disabled'):'SMS status unavailable');
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
  if(!r.ok){alert(data.error||'Could not save locations.');return false}locationsData=data.locations||[];locationsLimit=Number(data.limit||locationsLimit);renderLocations();renderClientChecklist();return true;
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
  wrap.innerHTML=supportTicketsData.map(t=>'<div class="support-ticket"><div><b>'+esc(t.subject)+'</b><small>'+new Date(t.createdAt).toLocaleString()+' · '+esc(t.priority||'normal')+'</small></div><span class="tag '+(t.status==='resolved'?'green':t.status==='in_progress'?'amber':'')+'">'+esc(String(t.status||'open').replace('_',' '))+'</span></div>').join('');
  if(empty)empty.hidden=supportTicketsData.length!==0;
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
document.getElementById('saveSettingsButton')?.addEventListener('click',saveSettings);
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
    if(pr.ok)adminProvisioningData=(await pr.json()).provisioning||[];
    if(ph.ok)adminPhoneData=(await ph.json()).numbers||[];
    if(hr.ok){const health=await hr.json();adminHealthData=health.services||[];adminReadinessData=health.readiness||null;}
    if(fr.ok)adminFleetData=await fr.json();
    if(sr.ok)adminSupportData=(await sr.json()).tickets||[];
    if(ps.ok)adminPlatformData=(await ps.json()).settings||null;
    if(wr.ok)adminWebsiteData=(await wr.json()).analytics||adminWebsiteData;
  }catch(e){console.error('Admin ops load failed',e)}
  renderProvisioning();renderPhones();renderHealth();renderWebsiteAnalytics();renderAdminFleet();renderAdminSupport();renderPlatformSettings();renderAdmin();
}

function renderAdminFleet(){
  const agents=adminFleetData.agents||[],calls=adminFleetData.calls||[],workspaceLeads=adminFleetData.leads||[],autos=adminFleetData.automations||[],webProspects=adminWebsiteData.prospects||[];
  const ag=document.getElementById('adminAgentsGrid');if(ag){ag.innerHTML=agents.filter(x=>x.agent).map(x=>'<article class="panel integration-card"><div><b>'+esc(x.agent.name||'Maya')+' · '+esc(x.workspaceName)+'</b><p>'+esc(x.agent.role||'AI Receptionist')+(x.phone?' · '+esc(x.phone):' · No phone assigned')+'</p></div><span class="tag '+(x.status==='active'&&x.phone?'green':'amber')+'">'+(x.status==='active'&&x.phone?'Ready':'Setup')+'</span></article>').join('');document.getElementById('adminAgentsEmpty').hidden=agents.some(x=>x.agent)}
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('adminCallsTotal',calls.length);set('adminCallsQualified',calls.filter(x=>/booked|qualified/i.test(String(x.outcome||''))).length);set('adminCallsMissed',calls.filter(x=>/missed/i.test(String(x.outcome||''))).length);set('adminCallsWorkspaces',new Set(calls.map(x=>x.workspaceId)).size);
  const ct=document.getElementById('adminCallsTable');if(ct)ct.innerHTML=calls.slice(0,100).map(x=>'<div class="call-row"><span><strong>'+esc(x.caller||x.phone||'Unknown caller')+'</strong><small class="subtle">'+esc(x.phone||'')+'</small></span><span>'+esc(x.workspaceName)+'</span><span>'+esc(x.reason||'General')+'</span><span class="tag '+outcomeClass(x.outcome)+'">'+esc(x.outcome||'Handled')+'</span><span>'+esc(x.time||'—')+'</span></div>').join('');
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
    const clientRows=workspaceLeads.slice(0,100).map(x=>'<div class="lead-admin-row"><span><strong>'+esc(x.name||'Unnamed lead')+'</strong><small class="subtle">'+esc(x.phone||'')+'</small></span><span><span class="tag">Client</span><small class="subtle">'+esc(x.workspaceName||'Workspace')+'</small></span><span>'+esc(x.service||'General inquiry')+'</span><span><span class="tag">'+esc(x.stage||'New')+'</span></span><span>'+money(x.value)+'</span></div>').join('');
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
  const intent=document.getElementById('websiteIntentMetrics');if(intent)intent.innerHTML=[['Contact inquiries',d.contactInquiries||0],['Chat sessions',d.chatSessions||0],['Form abandons',d.formAbandons||0],['Checkout starts',d.checkoutStarts||0],['Open checkout intent',d.checkoutAbandoned||0],['Prospects',(d.prospects||[]).length]].map(([k,v])=>'<div><b>'+Number(v).toLocaleString()+'</b><span>'+esc(k)+'</span></div>').join('');
  const pages=document.getElementById('websiteTopPages');if(pages)pages.innerHTML=(d.topPages||[]).map(x=>'<div class="rank-row"><b>'+esc(x.path)+'</b><span>'+Number(x.count).toLocaleString()+' views · '+formatDuration(x.avgSeconds||0)+' avg</span></div>').join('')||'<p class="muted">No page views yet.</p>';
  const sources=document.getElementById('websiteSources');if(sources)sources.innerHTML=(d.sources||[]).map(x=>'<div class="rank-row"><b>'+esc(x.source)+'</b><span>'+Number(x.count).toLocaleString()+' sessions</span></div>').join('')||'<p class="muted">No acquisition data yet.</p>';
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
    if(auto)auto.textContent='Auto-sync · 60s';
    renderAdminInbox();
  }
}
async function refreshAdminInboxLive({silent=true}={}){
  if(adminInboxData.liveLoading)return;
  adminInboxData.liveLoading=true;
  const refresh=document.getElementById('inboxRefreshButton'),auto=document.getElementById('inboxAutoStatus');
  if(refresh&&!silent){refresh.disabled=true;refresh.textContent='Syncing…'}
  if(auto)auto.textContent='Syncing with Gmail…';
  try{
    const gr=await fetch('/api/account?action=admin-gmail-inbox&limit=35',{headers:{Accept:'application/json'},cache:'no-store'});
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
    if(auto)auto.textContent='Auto-sync · 60s'+(adminInboxData.lastSync?' · '+new Date(adminInboxData.lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'');
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
document.getElementById('inboxRefreshButton')?.addEventListener('click',()=>refreshAdminInboxLive({silent:false}));
document.getElementById('gmailConnectButton')?.addEventListener('click',connectGmail);
document.getElementById('gmailDisconnectButton')?.addEventListener('click',disconnectGmailAdmin);
document.getElementById('inboxReplyForm')?.addEventListener('submit',sendInboxReply);
document.getElementById('inboxSearch')?.addEventListener('input',e=>{adminInboxData.search=e.target.value||'';renderAdminInbox()});
document.querySelectorAll('[data-inbox-filter]').forEach(b=>b.addEventListener('click',()=>{adminInboxData.filter=b.dataset.inboxFilter;renderAdminInbox()}));
setInterval(()=>{
  if(document.body.dataset.dashboard!=='admin'||document.hidden)return;
  const view=document.getElementById('view-inbox');
  if(view?.classList.contains('active'))refreshAdminInboxLive({silent:true});
},60000);


function renderAdminSupport(){
  const tickets=adminSupportData||[],set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('supportOpen',tickets.filter(x=>x.status==='open').length);set('supportProgress',tickets.filter(x=>x.status==='in_progress').length);set('supportResolved',tickets.filter(x=>x.status==='resolved').length);set('supportUrgent',tickets.filter(x=>x.priority==='urgent'&&x.status!=='resolved').length);
  const wrap=document.getElementById('adminSupportList');if(!wrap)return;
  wrap.innerHTML=tickets.map(t=>'<div class="support-admin-row" data-support-ticket-id="'+esc(t.id)+'"><div><b>'+esc(t.subject)+'</b><small>'+esc(t.workspaceName||'Workspace')+' · '+esc(t.email||'')+' · '+new Date(t.createdAt).toLocaleString()+'</small><p>'+esc(t.message||'')+'</p></div><div><span class="tag '+(t.priority==='urgent'?'red':'')+'">'+esc(t.priority||'normal')+'</span><select class="support-status-select" data-ticket-status="'+esc(t.id)+'"><option value="open" '+(t.status==='open'?'selected':'')+'>Open</option><option value="in_progress" '+(t.status==='in_progress'?'selected':'')+'>In progress</option><option value="resolved" '+(t.status==='resolved'?'selected':'')+'>Resolved</option></select></div></div>').join('');
  const empty=document.getElementById('adminSupportEmpty');if(empty)empty.hidden=tickets.length!==0;
  wrap.querySelectorAll('[data-ticket-status]').forEach(s=>s.addEventListener('change',()=>updateSupportStatus(s.dataset.ticketStatus,s.value)));
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
}
async function savePlatformSettings(){
  const payload={defaultAgentName:document.getElementById('platformAgentName')?.value||'Maya',defaultTimezone:document.getElementById('platformTimezone')?.value||'America/Los_Angeles',supportEmail:document.getElementById('platformSupportEmail')?.value||'',maintenanceMode:!!document.getElementById('platformMaintenanceMode')?.checked};
  const r=await fetch('/api/account?action=admin-platform-settings-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not save platform settings.');return}adminPlatformData=data.settings;const tag=document.getElementById('platformSettingsStatus');if(tag){tag.classList.add('show');setTimeout(()=>tag.classList.remove('show'),1500)}
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
  wrap.innerHTML=adminHealthData.map(x=>'<article class="panel integration-card"><div><b>'+esc(x.name)+'</b><p>'+esc(x.detail||'')+'</p></div><span class="tag '+(x.status==='operational'||x.status==='configured'?'green':x.status==='error'?'red':'amber')+'">'+esc(x.status.replace('_',' '))+'</span></article>').join('');
  const bad=adminHealthData.filter(x=>x.status==='error'||x.status==='not_configured').length,side=document.getElementById('adminSidebarHealth');if(side)side.textContent=bad?bad+' system item'+(bad===1?'':'s')+' need attention':'All systems operational';
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
  document.getElementById('phoneSmsInput').checked=item?.smsEnabled!==false;
  const sel=document.getElementById('phoneWorkspaceInput');
  sel.innerHTML='<option value="">Unassigned</option>'+adminClientsData.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
  sel.value=item?.workspaceId||'';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}
function closePhoneModal(){const m=document.getElementById('phoneModal');m?.classList.remove('open');m?.setAttribute('aria-hidden','true')}
async function savePhone(){
  const modal=document.getElementById('phoneModal');
  const payload={id:modal?.dataset.editId||undefined,number:document.getElementById('phoneNumberInput')?.value||'',label:document.getElementById('phoneLabelInput')?.value||'',provider:document.getElementById('phoneProviderInput')?.value||'Vapi',workspaceId:document.getElementById('phoneWorkspaceInput')?.value||'',forwardingFrom:document.getElementById('phoneForwardingInput')?.value||'',transferNumber:document.getElementById('phoneTransferInput')?.value||'',afterHours:document.getElementById('phoneAfterHoursInput')?.value||'ai',smsEnabled:!!document.getElementById('phoneSmsInput')?.checked};
  const r=await fetch('/api/account?action=admin-phone-number-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not save phone number.');return}
  closePhoneModal();await loadAdminOps();
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
      return '<div class="admin-event"><b>'+esc(x.name)+'</b><span>'+used.toLocaleString()+' min'+(lim?' · '+pct+'% of '+lim:' · unlimited')+'</span><small>'+esc(x.plan)+'</small></div>';
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
  showView(view);
  setTimeout(()=>{
    if(type==='prospect')flashAdminSearchTarget(document.querySelector('[data-website-prospect-id="'+CSS.escape(id)+'"]'));
    else if(type==='support')flashAdminSearchTarget(document.querySelector('[data-support-ticket-id="'+CSS.escape(id)+'"]'));
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
  if(!confirm('Delete '+name+'? This permanently removes its CallerCore workspace data. This cannot be undone.'))return;
  const typed=prompt('Type DELETE to confirm permanent deletion of '+name+'.');
  if(typed!=='DELETE')return;
  const r=await fetch('/api/account?action=admin-client-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not delete workspace.');return}
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


const modal=document.getElementById('upgradeModal');
function openModal(target){
  if(!modal||!PLAN_DATA[target])return;
  const t=PLAN_DATA[target];
  document.getElementById('modalTitle').textContent=(t.price>PLAN_DATA[currentPlan].price?'Upgrade to ':'Switch to ')+target;
  document.getElementById('modalCopy').textContent=target==='Pro'
    ?'Unlock everything in Growth plus API and webhook access.'
    :target==='Growth'
      ?'Unlock conversations, appointment booking, automations, and advanced analytics.'
      :'Use CallerCore core calling, lead capture, AI agent, routing, and support features.';
  const fs=Object.entries(FEATURE_INFO).filter(([k,v])=>target==='Pro'?true:v.tier===target);
  document.getElementById('modalFeatures').innerHTML=fs.map(([k,v])=>'<span>✓ '+v.title+'</span>').join('');
  document.getElementById('modalCta').textContent='Open Stripe billing';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false')
}
function bindUpgradeButtons(){document.querySelectorAll('[data-upgrade]').forEach(b=>{b.onclick=()=>openModal(b.dataset.upgrade)})}
modal?.querySelector('.modal-close')?.addEventListener('click',()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')});modal?.addEventListener('click',e=>{if(e.target===modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}});document.getElementById('upgradeButton')?.addEventListener('click',()=>document.getElementById('planComparison')?.scrollIntoView({behavior:'smooth'}));
document.getElementById('paymentButton')?.addEventListener('click',async()=>{const b=document.getElementById('paymentButton');if(b?.disabled)return;b.disabled=true;b.textContent='Opening…';const r=await fetch('/api/account?action=billing-portal',{method:'POST'}),data=await r.json().catch(()=>({}));if(r.ok&&data.url)location.href=data.url;else{alert(data.error||'Billing portal is unavailable.');b.disabled=false;b.textContent='Manage billing'}});
document.getElementById('modalCta')?.addEventListener('click',async()=>{const b=document.getElementById('modalCta');b.disabled=true;b.textContent='Opening Stripe…';const r=await fetch('/api/account?action=billing-portal',{method:'POST'}),data=await r.json().catch(()=>({}));if(r.ok&&data.url)location.href=data.url;else{alert(data.error||'Stripe billing is unavailable for this workspace.');b.disabled=false;b.textContent='Open Stripe billing'}});



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
