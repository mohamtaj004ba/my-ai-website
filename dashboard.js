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

async function bootstrapClient(){
  if(document.body.dataset.dashboard!=='client')return true;
  if(demoMode){document.body.classList.add('demo-mode');return true}
  try{
    const r=await fetch('/api/session',{headers:{Accept:'application/json'},cache:'no-store'});
    if(r.status===401){location.replace('/login?next=%2Fdashboard');return false}
    if(!r.ok)throw new Error('session');
    const data=await r.json();sessionWorkspace=data.workspace;
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
async function logout(){try{await fetch('/api/logout',{method:'POST'})}finally{location.href='/login'}}


function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));document.querySelector('.sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});if(name==='billing')renderBilling();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelector('.mobile-menu')?.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('open'));

function has(feature){return !!PLAN_DATA[currentPlan]?.features?.[feature]}
function featureStage(el,feature){const info=FEATURE_INFO[feature],ok=has(feature);if(ok){el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>Included with '+currentPlan+'</h2><p class="muted">'+info.copy+'</p><div class="fake-chart"></div></article><article class="panel"><span class="eyebrow">Active feature</span><h2>Ready to configure</h2><p class="muted">This prototype shows the entitlement state. Production data and controls will plug into this surface.</p><button class="primary">Configure</button></article></div>'}else{el.innerHTML='<div class="feature-demo"><article class="panel feature-preview"><span class="eyebrow">'+info.title+'</span><h2>See what this could do for your business.</h2><p class="muted">'+info.copy+'</p><div class="fake-chart"></div></article><article class="panel gate-card"><small>AVAILABLE ON '+info.tier.toUpperCase()+'</small><h2>Unlock '+info.title+'</h2><p>'+info.copy+'</p><ul>'+info.items.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="primary" data-upgrade="'+info.tier+'">Upgrade to '+info.tier+'</button></article></div>'}}
function renderStages(){document.querySelectorAll('[data-feature-card]').forEach(el=>featureStage(el,el.dataset.featureCard));document.querySelectorAll('[data-feature]').forEach(el=>{const f=el.dataset.feature;el.classList.toggle('feature-locked',!has(f));const lock=el.querySelector('.lock');if(lock)lock.textContent=has(f)?'ON':FEATURE_INFO[f]?.tier?.toUpperCase()||'LOCKED'});bindUpgradeButtons()}

function renderOverviewUnlocks(){const el=document.getElementById('overviewUnlocks');if(!el)return;const next=PLAN_DATA[currentPlan].unlock;if(!next){el.innerHTML='<article class="unlock-card"><small>PRO PLAN</small><h3>You have every core feature.</h3><p>Future enterprise capabilities and add-ons can appear here without changing the plan architecture.</p></article>';return}const locked=Object.keys(PLAN_DATA[currentPlan].features).filter(f=>!has(f)).slice(0,3);if(!locked.length&&next==='Pro')locked.push('apiAccess');el.innerHTML=locked.map(f=>{const i=FEATURE_INFO[f];return '<article class="unlock-card"><small>UNLOCK WITH '+i.tier.toUpperCase()+'</small><h3>'+i.title+'</h3><p>'+i.copy+'</p><button data-upgrade="'+i.tier+'">See what you unlock →</button></article>'}).join('');bindUpgradeButtons()}

function renderBilling(){const d=PLAN_DATA[currentPlan];document.getElementById('billingPlan')&&(document.getElementById('billingPlan').textContent=currentPlan);document.getElementById('billingPrice')&&(document.getElementById('billingPrice').textContent='$'+d.price+'/month');const usageText=d.minutes?d.used+' / '+d.minutes:d.used+' min · unlimited plan';document.getElementById('billingUsageText')&&(document.getElementById('billingUsageText').textContent=usageText);const pct=d.minutes?Math.min(100,(d.used/d.minutes)*100):38;document.getElementById('billingUsage')?.style.setProperty('width',pct+'%');document.getElementById('sidebarUsage')?.style.setProperty('width',pct+'%');document.getElementById('sidebarUsageLabel')&&(document.getElementById('sidebarUsageLabel').textContent=usageText);document.getElementById('sidebarPlan')&&(document.getElementById('sidebarPlan').textContent=currentPlan);
const wrap=document.getElementById('planComparison');if(wrap)wrap.innerHTML=Object.entries(PLAN_DATA).map(([name,p])=>{const current=name===currentPlan;const list=name==='Starter'?['300 included minutes','1 location','Lead capture + summaries','Basic routing']:name==='Growth'?['600 included minutes','Up to 2 locations','Appointments','Automations','Advanced analytics']:['Unlimited minutes','Up to 5 locations','API + webhooks','Advanced integrations','Custom workflows'];return '<article class="plan-option '+(current?'current':'')+'"><span class="eyebrow">'+(current?'Your plan':'CallerCore '+name)+'</span><h3>'+name+'</h3><b>$'+p.price+'/mo</b><ul>'+list.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="'+(current?'secondary-btn':'primary')+'" '+(current?'disabled':'data-upgrade="'+name+'"')+'>'+(current?'Current plan':(p.price>d.price?'Upgrade to ':'Switch to ')+name)+'</button></article>'}).join('');bindUpgradeButtons()}
function setPlan(plan){currentPlan=plan;document.getElementById('planSelector')&&(document.getElementById('planSelector').value=plan);renderBilling();renderStages();renderOverviewUnlocks()}
document.getElementById('planSelector')?.addEventListener('change',e=>setPlan(e.target.value));

const modal=document.getElementById('upgradeModal');function openModal(target){if(!modal)return;const t=PLAN_DATA[target];document.getElementById('modalTitle').textContent=(t.price>PLAN_DATA[currentPlan].price?'Upgrade to ':'Switch to ')+target;document.getElementById('modalCopy').textContent=target==='Pro'?'Unlock the full CallerCore platform, including API access, advanced integrations and custom workflows.':'Unlock appointment booking, automations, the unified inbox and advanced analytics.';const fs=Object.entries(FEATURE_INFO).filter(([k,v])=>target==='Pro'||v.tier==='Growth').slice(0,target==='Pro'?6:4);document.getElementById('modalFeatures').innerHTML=fs.map(([k,v])=>'<span>✓ '+v.title+'</span>').join('');document.getElementById('modalCta').textContent='Continue with Stripe · $'+t.price+'/mo';modal.classList.add('open');modal.setAttribute('aria-hidden','false')}
function bindUpgradeButtons(){document.querySelectorAll('[data-upgrade]').forEach(b=>{b.onclick=()=>openModal(b.dataset.upgrade)})}
document.querySelector('.modal-close')?.addEventListener('click',()=>modal.classList.remove('open'));modal?.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});document.getElementById('upgradeButton')?.addEventListener('click',()=>document.getElementById('planComparison')?.scrollIntoView({behavior:'smooth'}));document.getElementById('paymentButton')?.addEventListener('click',()=>openModal(currentPlan));document.getElementById('modalCta')?.addEventListener('click',()=>alert('Prototype only: authenticated Stripe customer + subscription mapping is required before enabling real in-dashboard billing changes.'));

(async()=>{const ok=await bootstrapClient();if(!ok)return;if(document.body.dataset.dashboard==='client'){setPlan(currentPlan)}else{renderBilling()}})();
document.getElementById('logoutButton')?.addEventListener('click',logout);
