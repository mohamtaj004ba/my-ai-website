const PLAN_DATA={
Starter:{price:349,minutes:300,used:214,features:{appointments:false,automations:false,advancedAnalytics:false,apiAccess:false,unifiedInbox:false},unlock:'Growth'},
Growth:{price:599,minutes:600,used:428,features:{appointments:true,automations:true,advancedAnalytics:true,apiAccess:false,unifiedInbox:true},unlock:'Pro'},
Pro:{price:999,minutes:null,used:1240,features:{appointments:true,automations:true,advancedAnalytics:true,apiAccess:true,unifiedInbox:true},unlock:null}
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
let sessionWorkspace=null;
let callsData=[],leadsData=[],conversationsData=[],appointmentsData=[],agentData=null,automationsData=[],analyticsData=null,settingsData=null,integrationsData=null;
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
    const data=await r.json();sessionWorkspace=data.workspace;
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
    if(data.workspace.usage&&Number.isFinite(data.workspace.usage.minutes)){PLAN_DATA[currentPlan].used=data.workspace.usage.minutes}
    return true;
  }catch(err){console.error('Dashboard bootstrap failed',err);location.replace('/login?error=session');return false}
}
async function logout(){try{await fetch('/api/account?action=logout',{method:'POST'})}finally{location.href='/login'}}


function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));document.querySelector('.sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});if(name==='overview')renderOverview();if(name==='billing')renderBilling();if(name==='calls')renderCalls();if(name==='leads')renderLeads();if(name==='conversations')renderConversations();if(name==='appointments')renderAppointments();if(name==='agent')renderAgent();if(name==='automations')renderAutomations();if(name==='analytics')renderAnalytics();if(name==='integrations')renderIntegrations();if(name==='settings')renderSettings();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelector('.mobile-menu')?.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('open'));

function has(feature){return !!PLAN_DATA[currentPlan]?.features?.[feature]}
function featureStage(el,feature){const info=FEATURE_INFO[feature],ok=has(feature);if(ok){el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>Included with '+currentPlan+'</h2><p class="muted">'+info.copy+'</p><div class="fake-chart"></div></article><article class="panel"><span class="eyebrow">Active feature</span><h2>Ready to configure</h2><p class="muted">This prototype shows the entitlement state. Production data and controls will plug into this surface.</p><button class="primary">Configure</button></article></div>'}else{el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>See what this could do for your business.</h2><p class="muted">'+info.copy+'</p><div class="fake-chart"></div></article><article class="panel gate-card"><small>AVAILABLE ON '+info.tier.toUpperCase()+'</small><h2>Unlock '+info.title+'</h2><p>'+info.copy+'</p><ul>'+info.items.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="primary" data-upgrade="'+info.tier+'">Upgrade to '+info.tier+'</button></article></div>'}}
function renderStages(){document.querySelectorAll('[data-feature-card]').forEach(el=>featureStage(el,el.dataset.featureCard));document.querySelectorAll('[data-feature]').forEach(el=>{const f=el.dataset.feature;el.classList.toggle('feature-locked',!has(f));const lock=el.querySelector('.lock');if(lock)lock.textContent=has(f)?'ON':FEATURE_INFO[f]?.tier?.toUpperCase()||'LOCKED'});bindUpgradeButtons()}

function renderOverviewUnlocks(){const el=document.getElementById('overviewUnlocks');if(!el)return;const next=PLAN_DATA[currentPlan].unlock;if(!next){el.innerHTML='<article class="unlock-card"><small>PRO PLAN</small><h3>You have every core feature.</h3><p>Future enterprise capabilities and add-ons can appear here without changing the plan architecture.</p></article>';return}const locked=Object.keys(PLAN_DATA[currentPlan].features).filter(f=>!has(f)).slice(0,3);if(!locked.length&&next==='Pro')locked.push('apiAccess');el.innerHTML=locked.map(f=>{const i=FEATURE_INFO[f];return '<article class="unlock-card"><small>UNLOCK WITH '+i.tier.toUpperCase()+'</small><h3>'+i.title+'</h3><p>'+i.copy+'</p><button data-upgrade="'+i.tier+'">See what you unlock →</button></article>'}).join('');bindUpgradeButtons()}

function renderBilling(){const d=PLAN_DATA[currentPlan];document.getElementById('billingPlan')&&(document.getElementById('billingPlan').textContent=currentPlan);document.getElementById('billingPrice')&&(document.getElementById('billingPrice').textContent='$'+d.price+'/month');const usageText=d.minutes?d.used+' / '+d.minutes:d.used+' min · unlimited plan';document.getElementById('billingUsageText')&&(document.getElementById('billingUsageText').textContent=usageText);const pct=d.minutes?Math.min(100,(d.used/d.minutes)*100):38;document.getElementById('billingUsage')?.style.setProperty('width',pct+'%');document.getElementById('sidebarUsage')?.style.setProperty('width',pct+'%');document.getElementById('sidebarUsageLabel')&&(document.getElementById('sidebarUsageLabel').textContent=usageText);document.getElementById('sidebarPlan')&&(document.getElementById('sidebarPlan').textContent=currentPlan);
const wrap=document.getElementById('planComparison');if(wrap)wrap.innerHTML=Object.entries(PLAN_DATA).map(([name,p])=>{const current=name===currentPlan;const list=name==='Starter'?['300 included minutes','1 location','Lead capture + summaries','Basic routing']:name==='Growth'?['600 included minutes','Up to 2 locations','Appointments','Automations','Advanced analytics']:['Unlimited minutes','Up to 5 locations','API + webhooks','Advanced integrations','Custom workflows'];return '<article class="plan-option '+(current?'current':'')+'"><span class="eyebrow">'+(current?'Your plan':'CallerCore '+name)+'</span><h3>'+name+'</h3><b>$'+p.price+'/mo</b><ul>'+list.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="'+(current?'secondary-btn':'primary')+'" '+(current?'disabled':'data-upgrade="'+name+'"')+'>'+(current?'Current plan':(p.price>d.price?'Upgrade to ':'Switch to ')+name)+'</button></article>'}).join('');bindUpgradeButtons()}
function setPlan(plan){currentPlan=plan;document.getElementById('planSelector')&&(document.getElementById('planSelector').value=plan);renderBilling();renderStages();renderOverviewUnlocks();renderEntitledApps()}
document.getElementById('planSelector')?.addEventListener('change',e=>setPlan(e.target.value));


async function loadOperations(){
  if(demoMode){
    callsData=DEMO_CALLS.map(x=>({...x}));leadsData=DEMO_LEADS.map(x=>({...x}));
    conversationsData=DEMO_CONVERSATIONS.map(x=>({...x}));appointmentsData=DEMO_APPOINTMENTS.map(x=>({...x}));
    agentData={...DEMO_AGENT,qualificationQuestions:[...DEMO_AGENT.qualificationQuestions]};
    automationsData=DEMO_AUTOMATIONS.map(x=>({...x}));
    settingsData={...DEMO_SETTINGS};integrationsData={...DEMO_INTEGRATIONS,apiAccess:has('apiAccess')};
    analyticsData=buildLocalAnalytics();
    renderCalls();renderLeads();renderConversations();renderAppointments();renderAgent();renderAutomations();renderAnalytics();renderIntegrations();renderSettings();renderOverview();renderAnalytics();renderIntegrations();renderSettings();return;
  }
  try{
    const jobs=[
      fetch('/api/account?action=calls',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=leads',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=agent',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=settings',{headers:{Accept:'application/json'},cache:'no-store'}),
      fetch('/api/account?action=integrations',{headers:{Accept:'application/json'},cache:'no-store'})
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
    let idx=5;
    if(has('advancedAnalytics')){if(results[idx].ok)analyticsData=(await results[idx].json()).analytics||null;idx++}
    if(has('unifiedInbox')){if(results[idx].ok)conversationsData=(await results[idx].json()).conversations||[];idx++}
    if(has('appointments')){if(results[idx].ok)appointmentsData=(await results[idx].json()).appointments||[];idx++}
    if(has('automations')){if(results[idx].ok)automationsData=(await results[idx].json()).automations||[]}
  }catch(err){console.error('Operations data failed',err)}
  renderCalls();renderLeads();renderConversations();renderAppointments();renderAgent();renderAutomations();renderAnalytics();renderIntegrations();renderSettings();renderOverview();
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
    return '<div class="lead-column" data-stage="'+stage+'"><h3>'+stage+' <span>'+items.length+'</span></h3>'+items.map(x=>'<article draggable="true" data-lead-id="'+esc(x.id)+'"><b>'+esc(x.name||'Unnamed lead')+'</b><small>'+esc(x.service||'General inquiry')+'</small><div class="lead-value">'+money(x.value)+'</div><div class="lead-foot"><span>'+esc(x.source||'CallerCore')+'</span><span>'+esc(x.age||'')+'</span></div></article>').join('')+'</div>';
  }).join('');
  document.getElementById('leadsEmpty').hidden=visible.length!==0;
  board.querySelectorAll('[draggable="true"]').forEach(card=>{
    card.addEventListener('dragstart',()=>{card.classList.add('dragging');card.dataset.dragging='1'});
    card.addEventListener('dragend',()=>card.classList.remove('dragging'));
  });
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
  wrap.innerHTML=automationsData.map(x=>'<article class="automation-card"><div><h3>'+esc(x.name)+'</h3><p>When <b>'+esc(triggerLabel(x.trigger))+'</b> → '+esc(actionLabel(x.action))+'</p></div><div class="automation-actions"><button data-edit-auto="'+esc(x.id)+'">Edit</button><button class="switch '+(x.enabled?'on':'')+'" data-toggle-auto="'+esc(x.id)+'" aria-label="Toggle automation"><i></i></button></div></article>').join('');
  document.getElementById('automationEmpty').hidden=automationsData.length!==0;
  wrap.querySelectorAll('[data-toggle-auto]').forEach(btn=>btn.addEventListener('click',()=>toggleAutomation(btn.dataset.toggleAuto)));
  wrap.querySelectorAll('[data-edit-auto]').forEach(btn=>btn.addEventListener('click',()=>openAutomation(btn.dataset.editAuto)));
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
  put('settingsBusinessName',settingsData.businessName);put('settingsPrimaryEmail',settingsData.primaryEmail);put('settingsTimezone',settingsData.timezone);put('settingsNotificationEmail',settingsData.notificationEmail);
  const e=document.getElementById('settingsEmailAlerts'),s=document.getElementById('settingsSmsAlerts');if(e)e.checked=settingsData.emailAlerts!==false;if(s)s.checked=settingsData.smsAlerts!==false;
}
async function saveSettings(){
  const payload={businessName:document.getElementById('settingsBusinessName')?.value||'',primaryEmail:document.getElementById('settingsPrimaryEmail')?.value||'',timezone:document.getElementById('settingsTimezone')?.value||'America/Los_Angeles',notificationEmail:document.getElementById('settingsNotificationEmail')?.value||'',emailAlerts:!!document.getElementById('settingsEmailAlerts')?.checked,smsAlerts:!!document.getElementById('settingsSmsAlerts')?.checked};
  if(demoMode)settingsData={...payload};
  else{
    const r=await fetch('/api/account?action=settings-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok){alert('Could not save workspace settings.');return}
    settingsData=(await r.json()).settings||payload;
    if(settingsData.businessName){document.getElementById('workspaceName').textContent=settingsData.businessName;document.querySelectorAll('[data-business-name]').forEach(el=>el.textContent=settingsData.businessName)}
  }
  const tag=document.getElementById('settingsSaveStatus');if(tag){tag.classList.add('show');setTimeout(()=>tag.classList.remove('show'),1600)}
}
document.getElementById('saveWebhookButton')?.addEventListener('click',saveWebhook);
document.getElementById('saveSettingsButton')?.addEventListener('click',saveSettings);


let adminClientsData=[],adminSummaryData=null,currentAdminClient=null,adminProvisioningData=[],adminPhoneData=[],adminHealthData=[];
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
      const av=document.getElementById('adminAvatar');if(av)av.textContent=email.slice(0,1).toUpperCase();
    }
    renderAdmin();await loadAdminOps();
    return true;
  }catch(err){console.error('Admin bootstrap failed',err);return false}
}

async function loadAdminOps(){
  try{
    const [pr,ph,hr]=await Promise.all([
      fetch('/api/account?action=admin-provisioning',{cache:'no-store'}),
      fetch('/api/account?action=admin-phone-numbers',{cache:'no-store'}),
      fetch('/api/account?action=admin-system-health',{cache:'no-store'})
    ]);
    if(pr.ok)adminProvisioningData=(await pr.json()).provisioning||[];
    if(ph.ok)adminPhoneData=(await ph.json()).numbers||[];
    if(hr.ok)adminHealthData=(await hr.json()).services||[];
  }catch(e){console.error('Admin ops load failed',e)}
  renderProvisioning();renderPhones();renderHealth();
}
function renderProvisioning(){
  const board=document.getElementById('provisioningBoard');if(!board)return;
  const stages=['Paid','Intake','Building','Ready','Live'];
  board.innerHTML=stages.map(stage=>{
    const rows=adminProvisioningData.filter(x=>x.stage===stage);
    return '<div><h3>'+stage+' <span>'+rows.length+'</span></h3>'+rows.map(x=>'<article><b>'+esc(x.name)+'</b><small>'+esc(x.plan)+(x.phone?' · '+esc(x.phone):'')+'</small></article>').join('')+'</div>';
  }).join('');
}
function renderPhones(){
  const wrap=document.getElementById('phoneTable');if(!wrap)return;
  wrap.innerHTML=adminPhoneData.map(x=>'<div class="call-row"><span><strong>'+esc(x.number)+'</strong><small class="subtle">'+esc(x.label||'Primary')+'</small></span><span>'+esc(x.workspaceName||'Unassigned')+'</span><span>'+esc(x.provider||'')+'</span><span class="tag green">'+esc(x.status||'active')+'</span><span><button class="admin-link" data-edit-phone="'+esc(x.id)+'">Edit</button></span></div>').join('');
  const empty=document.getElementById('phoneEmpty');if(empty)empty.hidden=adminPhoneData.length!==0;
  wrap.querySelectorAll('[data-edit-phone]').forEach(b=>b.addEventListener('click',()=>openPhoneModal(b.dataset.editPhone)));
}
function renderHealth(){
  const wrap=document.getElementById('systemHealthGrid');if(!wrap)return;
  wrap.innerHTML=adminHealthData.map(x=>'<article class="panel integration-card"><div><b>'+esc(x.name)+'</b><p>'+esc(x.detail||'')+'</p></div><span class="tag '+(x.status==='operational'||x.status==='configured'?'green':x.status==='error'?'red':'amber')+'">'+esc(x.status.replace('_',' '))+'</span></article>').join('');
}
function openPhoneModal(id=null){
  const item=id?adminPhoneData.find(x=>String(x.id)===String(id)):null;
  const modal=document.getElementById('phoneModal');if(!modal)return;
  modal.dataset.editId=id||'';
  document.getElementById('phoneNumberInput').value=item?.number||'';
  document.getElementById('phoneLabelInput').value=item?.label||'Primary';
  document.getElementById('phoneProviderInput').value=item?.provider||'Vapi';
  const sel=document.getElementById('phoneWorkspaceInput');
  sel.innerHTML='<option value="">Unassigned</option>'+adminClientsData.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
  sel.value=item?.workspaceId||'';
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
}
function closePhoneModal(){const m=document.getElementById('phoneModal');m?.classList.remove('open');m?.setAttribute('aria-hidden','true')}
async function savePhone(){
  const modal=document.getElementById('phoneModal');
  const payload={id:modal?.dataset.editId||undefined,number:document.getElementById('phoneNumberInput')?.value||'',label:document.getElementById('phoneLabelInput')?.value||'',provider:document.getElementById('phoneProviderInput')?.value||'Vapi',workspaceId:document.getElementById('phoneWorkspaceInput')?.value||''};
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
    attention.innerHTML=rows.slice(0,6).join('')||'<div class="empty-state"><h3>Nothing needs attention</h3><p>Billing and onboarding alerts will appear here.</p></div>';
  }
  renderAdminClients();
  const recent=document.getElementById('adminRecentClients');if(recent){
    recent.innerHTML=adminClientsData.slice(0,5).map(x=>adminClientRow(x,true)).join('')||'<div class="empty-state"><h3>No clients yet</h3></div>';
    recent.querySelectorAll('[data-admin-client]').forEach(b=>b.addEventListener('click',()=>openAdminClient(b.dataset.adminClient)));
  }
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
  if(activity)return '<div class="activity-row"><span class="time">'+esc(x.plan)+'</span><div class="person"><b>'+esc(initials)+'</b><span><strong>'+esc(x.name)+'</strong><small>'+esc(usage)+'</small></span></div><span class="tag '+adminBillingTag(x.subscriptionStatus)+'">'+esc(x.subscriptionStatus||'active')+'</span><button class="admin-link" data-admin-client="'+esc(x.id)+'">Open</button></div>';
  return '<div class="call-row"><span><strong>'+esc(x.name)+'</strong><small class="subtle">'+esc(x.ownerEmail||'')+'</small></span><span>'+esc(x.plan)+'</span><span>'+esc(usage)+'</span><span class="tag '+adminBillingTag(x.subscriptionStatus)+'">'+esc(x.subscriptionStatus||'active')+'</span><span><button class="admin-link" data-admin-client="'+esc(x.id)+'">Open</button></span></div>';
}
function renderAdminClients(){
  const wrap=document.getElementById('adminClientsTable');if(!wrap)return;
  const q=(document.getElementById('adminSearch')?.value||'').trim().toLowerCase();
  const rows=adminClientsData.filter(x=>!q||[x.name,x.ownerEmail,x.plan,x.subscriptionStatus].join(' ').toLowerCase().includes(q));
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
  document.getElementById('adminClientCounts').innerHTML=[['Calls',x.counts?.calls||0],['Leads',x.counts?.leads||0],['Appointments',x.counts?.appointments||0]].map(([k,v])=>'<div><b>'+esc(v)+'</b><span>'+esc(k)+'</span></div>').join('');
  document.getElementById('adminClientAgent').textContent=x.agent?(x.agent.name||'Maya')+' · '+(x.agent.role||'AI Receptionist'):'No agent configured yet.';
  currentAdminClient=x;
  const planSel=document.getElementById('adminClientPlan'),statusSel=document.getElementById('adminClientStatus');
  if(planSel){planSel.value=x.plan||'Starter';planSel.disabled=!!x.stripe?.subscriptionLinked}
  if(statusSel)statusSel.value=x.status||'active';
  const note=document.getElementById('adminClientManageNote');if(note)note.textContent=x.stripe?.subscriptionLinked?'Plan is managed by Stripe for this workspace.':'Plan can be adjusted manually because no Stripe subscription is linked.';
  document.getElementById('adminClientDrawer').classList.add('open');document.getElementById('adminClientBackdrop').classList.add('open');
}
function closeAdminClient(){document.getElementById('adminClientDrawer')?.classList.remove('open');document.getElementById('adminClientBackdrop')?.classList.remove('open')}
document.getElementById('adminSearch')?.addEventListener('input',renderAdminClients);
document.getElementById('closeAdminClient')?.addEventListener('click',closeAdminClient);
document.getElementById('adminClientBackdrop')?.addEventListener('click',closeAdminClient);

async function saveAdminClient(){
  if(!currentAdminClient)return;
  const plan=document.getElementById('adminClientPlan')?.value;
  const status=document.getElementById('adminClientStatus')?.value;
  const r=await fetch('/api/account?action=admin-client-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id,plan,status})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not update client.');return}
  const local=adminClientsData.find(x=>x.id===currentAdminClient.id);if(local){local.plan=data.client.plan;local.status=data.client.status}
  currentAdminClient={...currentAdminClient,plan:data.client.plan,status:data.client.status};
  renderAdmin();openAdminClient(currentAdminClient.id);
}
async function viewAdminClient(){
  if(!currentAdminClient)return;
  const r=await fetch('/api/account?action=admin-view-client',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentAdminClient.id})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){alert(data.error||'Could not open client view.');return}
  location.href=data.redirect||'/dashboard';
}
document.getElementById('adminSaveClientButton')?.addEventListener('click',saveAdminClient);
document.getElementById('adminViewClientButton')?.addEventListener('click',viewAdminClient);


const modal=document.getElementById('upgradeModal');function openModal(target){if(!modal)return;const t=PLAN_DATA[target];document.getElementById('modalTitle').textContent=(t.price>PLAN_DATA[currentPlan].price?'Upgrade to ':'Switch to ')+target;document.getElementById('modalCopy').textContent=target==='Pro'?'Unlock the full CallerCore platform, including API access, advanced integrations and custom workflows.':'Unlock appointment booking, automations, the unified inbox and advanced analytics.';const fs=Object.entries(FEATURE_INFO).filter(([k,v])=>target==='Pro'||v.tier==='Growth').slice(0,target==='Pro'?6:4);document.getElementById('modalFeatures').innerHTML=fs.map(([k,v])=>'<span>✓ '+v.title+'</span>').join('');document.getElementById('modalCta').textContent='Continue with Stripe · $'+t.price+'/mo';modal.classList.add('open');modal.setAttribute('aria-hidden','false')}
function bindUpgradeButtons(){document.querySelectorAll('[data-upgrade]').forEach(b=>{b.onclick=()=>openModal(b.dataset.upgrade)})}
document.querySelector('.modal-close')?.addEventListener('click',()=>modal.classList.remove('open'));modal?.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});document.getElementById('upgradeButton')?.addEventListener('click',()=>document.getElementById('planComparison')?.scrollIntoView({behavior:'smooth'}));document.getElementById('paymentButton')?.addEventListener('click',()=>openModal(currentPlan));document.getElementById('modalCta')?.addEventListener('click',()=>alert('Prototype only: authenticated Stripe customer + subscription mapping is required before enabling real in-dashboard billing changes.'));

(async()=>{if(document.body.dataset.dashboard==='admin'){await bootstrapAdmin();return}const ok=await bootstrapClient();if(!ok)return;if(document.body.dataset.dashboard==='client'){setPlan(currentPlan);await loadOperations()}else{renderBilling()}})();
document.getElementById('logoutButton')?.addEventListener('click',logout);
