const crypto=require('crypto');
const {kv}=require('@vercel/kv');
const {cleanEmail,createSession,parseCookies,clearSessionCookie,requireSession}=require('../lib/auth');
const {sendMail}=require('../lib/mail');
const {entitlementsFor}=require('../lib/plans');

const SITE_URL=process.env.SITE_URL||'https://www.callercore.com';
const WINDOW=10*60,MAX=5;

function requestOrigin(req){
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  const proto=String(req.headers['x-forwarded-proto']||'https').toLowerCase().split(',')[0].trim()==='http'?'http':'https';
  if(host==='callercore.com'||host==='www.callercore.com'||host.endsWith('.vercel.app'))return proto+'://'+host;
  return SITE_URL;
}


async function appendAudit(workspaceId,{actorEmail='',actorRole='client',action='',section='',before=null,after=null,meta={}}={}){
  if(!workspaceId)return;
  const key='audit:'+workspaceId,list=await kv.get(key)||[];
  const item={id:crypto.randomUUID(),workspaceId,actorEmail,actorRole,action,section,before,after,meta,at:Date.now()};
  const next=Array.isArray(list)?list:[];
  next.unshift(item);await kv.set(key,next.slice(0,200));
  return item;
}
function configKey(section,workspaceId){
  const map={workspace:'workspace:',settings:'settings:',agent:'agent:',automations:'automations:',integrations:'integrations:',locations:'locations:'};
  return map[section]?map[section]+workspaceId:null;
}
async function getWorkspaceConfigSnapshot(workspaceId){
  const [workspace,settings,agent,automations,integrations,locations,phones]=await Promise.all([
    kv.get('workspace:'+workspaceId),kv.get('settings:'+workspaceId),kv.get('agent:'+workspaceId),
    kv.get('automations:'+workspaceId),kv.get('integrations:'+workspaceId),kv.get('locations:'+workspaceId),kv.get('phone:index')
  ]);
  const phone=(Array.isArray(phones)?phones:[]).find(x=>x&&x.workspaceId===workspaceId)||null;
  return {workspace:workspace||null,settings:settings||null,agent:agent||null,automations:Array.isArray(automations)?automations:[],integrations:integrations||null,locations:Array.isArray(locations)?locations:[],phone};
}

async function bootstrapPreview(req,res){
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  if(!host.endsWith('.vercel.app'))return res.status(404).json({error:'Not found'});
  const configured=String(process.env.CALLERCORE_BOOTSTRAP_SECRET||'');
  const supplied=String(req.headers['x-bootstrap-secret']||'');
  if(!configured||!supplied||supplied!==configured)return res.status(403).json({error:'Forbidden'});
  const email=cleanEmail((req.body||{}).email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Valid email required'});
  const existing=await kv.get('user:email:'+email);
  if(existing&&existing.workspaceId)return res.status(409).json({error:'User already provisioned',workspaceId:existing.workspaceId});
  const workspaceId=crypto.randomUUID();
  const name=String((req.body||{}).businessName||'CallerCore Test Workspace').trim().slice(0,160);
  const plan=['Starter','Growth','Pro'].includes((req.body||{}).plan)?(req.body||{}).plan:'Pro';
  const now=Date.now();
  const workspace={
    id:workspaceId,name,ownerName:'TJ',ownerEmail:email,phone:'',industry:'Testing',
    plan,status:'active',subscriptionStatus:'active',
    stripeCustomerId:null,stripeSubscriptionId:null,stripeCheckoutSessionId:null,
    usage:{minutes:0},createdAt:now,updatedAt:now
  };
  await kv.set('workspace:'+workspaceId,workspace);
  await kv.set('user:email:'+email,{workspaceId,role:'owner',email});
  const index=await kv.get('workspace:index')||[];
  if(Array.isArray(index)&&!index.includes(workspaceId))await kv.set('workspace:index',[...index,workspaceId]);
  return res.status(201).json({ok:true,workspaceId,email,plan});
}

async function promotePreviewAdmin(req,res){
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  if(!host.endsWith('.vercel.app'))return res.status(404).json({error:'Not found'});
  const configured=String(process.env.CALLERCORE_BOOTSTRAP_SECRET||'');
  const supplied=String(req.headers['x-bootstrap-secret']||'');
  if(!configured||!supplied||supplied!==configured)return res.status(403).json({error:'Forbidden'});
  const email=cleanEmail((req.body||{}).email);
  const member=await kv.get('user:email:'+email);
  if(!member||!member.workspaceId)return res.status(404).json({error:'User not found'});
  await kv.set('user:email:'+email,{...member,email,role:'admin'});
  const index=await kv.get('workspace:index')||[];
  if(Array.isArray(index)&&!index.includes(member.workspaceId))await kv.set('workspace:index',[...index,member.workspaceId]);
  return res.status(200).json({ok:true,email,role:'admin'});
}

async function requireAdmin(req,res){
  const s=await requireSession(req,res);if(!s)return null;
  const member=await kv.get('user:email:'+cleanEmail(s.email));
  if(!member||member.role!=='admin')return res.status(403).json({error:'Admin access required'}),null;
  return {...s,role:'admin'};
}

async function adminSummary(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const ids=await kv.get('workspace:index')||[];
  const workspaces=[];
  for(const id of Array.isArray(ids)?ids.slice(0,250):[]){
    const ws=await kv.get('workspace:'+id);if(ws)workspaces.push(ws);
  }
  const prices={Starter:349,Growth:599,Pro:999};
  const billable=workspaces.filter(w=>String(w.subscriptionStatus||'active')!=='canceled');
  const active=workspaces.filter(w=>(w.status||'active')==='active'&&String(w.subscriptionStatus||'active')!=='canceled');
  const mrr=billable.reduce((sum,w)=>sum+(prices[w.plan]||0),0);
  const pastDue=workspaces.filter(w=>w.subscriptionStatus==='past_due').length;
  const onboarding=workspaces.filter(w=>w.status==='onboarding').length;
  const suspended=workspaces.filter(w=>w.status==='suspended').length;
  const totalMinutes=workspaces.reduce((sum,w)=>sum+Number(w.usage&&w.usage.minutes||0),0);
  const planMix={Starter:0,Growth:0,Pro:0};workspaces.forEach(w=>{if(planMix[w.plan]!==undefined)planMix[w.plan]++});
  return res.status(200).json({summary:{mrr,clients:workspaces.length,activeClients:active.length,pastDue,onboarding,suspended,totalMinutes,planMix}});
}

async function adminClients(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const ids=await kv.get('workspace:index')||[];
  const clients=[];
  for(const id of Array.isArray(ids)?ids.slice(0,250):[]){
    const ws=await kv.get('workspace:'+id);if(!ws)continue;
    clients.push({
      id:ws.id,name:ws.name||'Unnamed workspace',plan:ws.plan||'Starter',
      status:ws.status||'active',subscriptionStatus:ws.subscriptionStatus||'active',
      ownerEmail:ws.ownerEmail||'',usage:ws.usage||{minutes:0},
      stripeLinked:!!ws.stripeCustomerId,createdAt:ws.createdAt||null
    });
  }
  clients.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return res.status(200).json({clients});
}

async function adminUpdateClient(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80);
  if(!id)return res.status(400).json({error:'Client id required'});
  const key='workspace:'+id,ws=await kv.get(key);if(!ws)return res.status(404).json({error:'Client not found'});
  const next={...ws};
  if(body.status!==undefined){
    const allowedStatus=['active','onboarding','suspended'];
    if(!allowedStatus.includes(body.status))return res.status(400).json({error:'Invalid workspace status'});
    next.status=body.status;
  }
  if(body.plan!==undefined&&body.plan!==ws.plan){
    if(ws.stripeSubscriptionId)return res.status(409).json({error:'Plan is managed by Stripe for this workspace'});
    if(!['Starter','Growth','Pro'].includes(body.plan))return res.status(400).json({error:'Invalid plan'});
    next.plan=body.plan;
  }
  next.updatedAt=Date.now();
  await kv.set(key,next);
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'workspace_update',section:'workspace',before:ws,after:next});
  return res.status(200).json({ok:true,client:{id:next.id,name:next.name,plan:next.plan,status:next.status,subscriptionStatus:next.subscriptionStatus||'active'}});
}

async function adminDeleteClient(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.body||{}).id||'').slice(0,80);
  if(!id)return res.status(400).json({error:'Client id required'});
  if(id===admin.workspaceId)return res.status(409).json({error:'You cannot delete the workspace currently used by your admin account'});
  const key='workspace:'+id,ws=await kv.get(key);if(!ws)return res.status(404).json({error:'Client not found'});
  if(ws.stripeSubscriptionId&&String(ws.subscriptionStatus||'active')!=='canceled'){
    return res.status(409).json({error:'This workspace has an active Stripe subscription. Cancel the subscription before deleting the workspace.'});
  }
  const index=await kv.get('workspace:index')||[];
  await kv.set('workspace:index',(Array.isArray(index)?index:[]).filter(x=>x!==id));
  if(ws.ownerEmail){
    const memberKey='user:email:'+cleanEmail(ws.ownerEmail),member=await kv.get(memberKey);
    if(member&&member.workspaceId===id)await kv.del(memberKey);
  }
  if(ws.stripeCustomerId)await kv.del('stripe:customer:'+ws.stripeCustomerId);
  if(ws.stripeSubscriptionId)await kv.del('stripe:subscription:'+ws.stripeSubscriptionId);
  const phoneIndex=await kv.get('phone:index')||[];
  if(Array.isArray(phoneIndex)){
    await kv.set('phone:index',phoneIndex.map(x=>x&&x.workspaceId===id?{...x,workspaceId:'',workspaceName:'',updatedAt:Date.now()}:x));
  }
  const supportIndex=await kv.get('support:index')||[],keepSupport=[];
  for(const ticketId of Array.isArray(supportIndex)?supportIndex:[]){
    const ticket=await kv.get('support:'+ticketId);
    if(ticket&&ticket.workspaceId===id)await kv.del('support:'+ticketId);else keepSupport.push(ticketId);
  }
  await kv.set('support:index',keepSupport);
  await Promise.all([
    'workspace:','agent:','calls:','leads:','conversations:','appointments:','automations:',
    'settings:','integrations:','locations:','provisioning:override:','provisioning:history:'
  ].map(prefix=>kv.del(prefix+id)));
  return res.status(200).json({ok:true,deleted:{id,name:ws.name||'Workspace'}});
}

async function adminViewClient(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.body||{}).id||'').slice(0,80);
  const ws=await kv.get('workspace:'+id);if(!ws)return res.status(404).json({error:'Client not found'});
  const old=parseCookies(req).cc_session;if(old)await kv.del('session:'+old);
  await createSession(res,{email:admin.email,workspaceId:id,role:'admin',adminView:true,adminHomeWorkspaceId:admin.workspaceId});
  return res.status(200).json({ok:true,redirect:'/dashboard',workspace:{id:ws.id,name:ws.name}});
}

async function adminExitClientView(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const member=await kv.get('user:email:'+cleanEmail(s.email));
  if(!member||member.role!=='admin')return res.status(403).json({error:'Admin access required'});
  const home=String(s.adminHomeWorkspaceId||member.workspaceId||'');
  if(!home)return res.status(409).json({error:'Admin home workspace unavailable'});
  const old=parseCookies(req).cc_session;if(old)await kv.del('session:'+old);
  await createSession(res,{email:s.email,workspaceId:home,role:'admin'});
  return res.status(200).json({ok:true,redirect:'/admin-dashboard'});
}

async function requireWritableSession(req,res){
  const s=await requireSession(req,res);if(!s)return null;
  if(s.adminView)return res.status(403).json({error:'Admin client view is read-only'}),null;
  return s;
}

async function adminProvisioning(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const ids=await kv.get('workspace:index')||[];
  const items=[];
  for(const id of Array.isArray(ids)?ids.slice(0,250):[]){
    const ws=await kv.get('workspace:'+id);if(!ws)continue;
    const [settings,agent]=await Promise.all([kv.get('settings:'+id),kv.get('agent:'+id)]);
    const hasIntake=!!(settings&&((settings.businessName||'').trim()||(settings.primaryEmail||'').trim()));
    const hasAgent=!!(agent&&((agent.name||'').trim()||(agent.openingMessage||'').trim()));
    const hasPhone=!!String(ws.phone||'').trim();
    let autoStage='Paid';
    if(hasIntake)autoStage='Intake';
    if(hasAgent)autoStage='Building';
    if(hasAgent&&hasPhone)autoStage='Ready';
    if(ws.status==='active'&&hasAgent&&hasPhone)autoStage='Live';
    const override=await kv.get('provisioning:override:'+id);
    const stage=override&&['Paid','Intake','Building','Ready','Live'].includes(override.stage)?override.stage:autoStage;
    items.push({id:ws.id,name:ws.name||'Unnamed workspace',plan:ws.plan||'Starter',status:ws.status||'active',stage,autoStage,manualOverride:!!override,stageUpdatedAt:override&&override.updatedAt||null,hasIntake,hasAgent,hasPhone,phone:ws.phone||''});
  }
  return res.status(200).json({provisioning:items});
}

async function adminSaveProvisioningStage(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),stage=String(body.stage||'');
  const allowed=['Paid','Intake','Building','Ready','Live'];
  if(!id||!allowed.includes(stage))return res.status(400).json({error:'Invalid provisioning stage'});
  const ws=await kv.get('workspace:'+id);if(!ws)return res.status(404).json({error:'Workspace not found'});
  const record={stage,updatedAt:Date.now(),updatedBy:admin.email};
  await kv.set('provisioning:override:'+id,record);
  const history=await kv.get('provisioning:history:'+id)||[];
  const next=Array.isArray(history)?history:[];
  next.unshift({stage,at:record.updatedAt,by:admin.email});
  await kv.set('provisioning:history:'+id,next.slice(0,50));
  return res.status(200).json({ok:true,stage,updatedAt:record.updatedAt});
}

async function adminClearProvisioningStage(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.body||{}).id||'').slice(0,80);
  if(!id)return res.status(400).json({error:'Workspace id required'});
  await kv.del('provisioning:override:'+id);
  return res.status(200).json({ok:true});
}

async function adminPhoneNumbers(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const numbers=await kv.get('phone:index')||[];
  return res.status(200).json({numbers:Array.isArray(numbers)?numbers:[]});
}

async function adminSavePhoneNumber(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{};
  const id=String(body.id||crypto.randomUUID()).slice(0,100);
  const number=String(body.number||'').trim().slice(0,40);
  const workspaceId=String(body.workspaceId||'').trim().slice(0,80);
  const provider=String(body.provider||'Vapi').trim().slice(0,40);
  const label=String(body.label||'Primary').trim().slice(0,80);
  const forwardingFrom=String(body.forwardingFrom||'').trim().slice(0,40);
  const transferNumber=String(body.transferNumber||'').trim().slice(0,40);
  const afterHours=['ai','transfer','voicemail'].includes(body.afterHours)?body.afterHours:'ai';
  const smsEnabled=body.smsEnabled!==false;
  if(!/^\+?[0-9() .-]{7,30}$/.test(number))return res.status(400).json({error:'Valid phone number required'});
  if(forwardingFrom&&!/^\+?[0-9() .-]{7,30}$/.test(forwardingFrom))return res.status(400).json({error:'Forwarding source number is invalid'});
  if(transferNumber&&!/^\+?[0-9() .-]{7,30}$/.test(transferNumber))return res.status(400).json({error:'Transfer destination is invalid'});
  let workspaceName='';
  if(workspaceId){
    const ws=await kv.get('workspace:'+workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
    workspaceName=ws.name||'';
    await kv.set('workspace:'+workspaceId,{...ws,phone:number,updatedAt:Date.now()});
  }
  const current=await kv.get('phone:index')||[];
  const list=Array.isArray(current)?current:[];
  const previous=list.find(x=>x&&String(x.id)===id);
  if(previous&&previous.workspaceId&&previous.workspaceId!==workspaceId){
    const oldKey='workspace:'+previous.workspaceId,oldWs=await kv.get(oldKey);
    if(oldWs&&String(oldWs.phone||'')===String(previous.number||''))await kv.set(oldKey,{...oldWs,phone:'',updatedAt:Date.now()});
  }
  const item={id,number,workspaceId,workspaceName,provider,label,forwardingFrom,transferNumber,afterHours,smsEnabled,status:'active',updatedAt:Date.now()};
  const i=list.findIndex(x=>x&&String(x.id)===id);
  if(i>=0)list[i]=item;else list.push(item);
  await kv.set('phone:index',list.slice(0,500));
  return res.status(200).json({ok:true,number:item});
}

async function adminDeletePhoneNumber(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.body||{}).id||'').slice(0,100);
  if(!id)return res.status(400).json({error:'Phone id required'});
  const current=await kv.get('phone:index')||[];
  const list=Array.isArray(current)?current:[];
  const item=list.find(x=>x&&String(x.id)===id);
  if(!item)return res.status(404).json({error:'Phone number not found'});
  const next=list.filter(x=>!x||String(x.id)!==id);
  await kv.set('phone:index',next);
  if(item.workspaceId){
    const key='workspace:'+item.workspaceId,ws=await kv.get(key);
    if(ws&&String(ws.phone||'')===String(item.number||'')){
      await kv.set(key,{...ws,phone:'',updatedAt:Date.now()});
    }
  }
  return res.status(200).json({ok:true,deleted:{id:item.id,number:item.number}});
}

async function adminFleet(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const ids=await kv.get('workspace:index')||[];
  const agents=[],calls=[],leads=[],automations=[];
  for(const id of Array.isArray(ids)?ids.slice(0,250):[]){
    const ws=await kv.get('workspace:'+id);if(!ws)continue;
    const [agent,wsCalls,wsLeads,wsAutos]=await Promise.all([
      kv.get('agent:'+id),kv.get('calls:'+id),kv.get('leads:'+id),kv.get('automations:'+id)
    ]);
    agents.push({workspaceId:id,workspaceName:ws.name||'Unnamed workspace',plan:ws.plan||'Starter',status:ws.status||'active',phone:ws.phone||'',agent:agent||null});
    (Array.isArray(wsCalls)?wsCalls:[]).slice(0,200).forEach(x=>calls.push({...x,workspaceId:id,workspaceName:ws.name||'Unnamed workspace'}));
    (Array.isArray(wsLeads)?wsLeads:[]).slice(0,200).forEach(x=>leads.push({...x,workspaceId:id,workspaceName:ws.name||'Unnamed workspace'}));
    const autos=Array.isArray(wsAutos)?wsAutos:[];
    automations.push({workspaceId:id,workspaceName:ws.name||'Unnamed workspace',plan:ws.plan||'Starter',total:autos.length,enabled:autos.filter(x=>x&&x.enabled!==false).length});
  }
  const time=x=>Number(x?.createdAt||x?.timestamp||x?.dateMs||x?.updatedAt||0);
  calls.sort((a,b)=>time(b)-time(a));leads.sort((a,b)=>time(b)-time(a));
  return res.status(200).json({agents,calls:calls.slice(0,500),leads:leads.slice(0,500),automations});
}

async function createSupportTicket(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  const body=req.body||{},subject=String(body.subject||'').trim().slice(0,160),message=String(body.message||'').trim().slice(0,4000),priority=['normal','urgent'].includes(body.priority)?body.priority:'normal';
  if(subject.length<3||message.length<10)return res.status(400).json({error:'Subject and message are required'});
  const id=crypto.randomUUID(),now=Date.now();
  const ticket={id,workspaceId:s.workspaceId,workspaceName:ws.name||'Workspace',email:s.email,subject,message,priority,status:'open',createdAt:now,updatedAt:now};
  await kv.set('support:'+id,ticket);
  const index=await kv.get('support:index')||[];const list=Array.isArray(index)?index:[];
  await kv.set('support:index',[id,...list.filter(x=>x!==id)].slice(0,500));
  const platform=await kv.get('platform:settings')||{};
  const to=platform.supportEmail||process.env.SUPPORT_EMAIL||process.env.MAILGUN_TO_EMAIL||'';
  if(to){try{await sendMail({to,subject:'CallerCore support · '+subject,text:'Workspace: '+ticket.workspaceName+'\nFrom: '+s.email+'\nPriority: '+priority+'\n\n'+message})}catch(err){console.error('support email failed',err)}}
  return res.status(201).json({ok:true,ticket});
}

async function supportTickets(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const index=await kv.get('support:index')||[],tickets=[];
  for(const id of Array.isArray(index)?index.slice(0,100):[]){
    const t=await kv.get('support:'+id);if(t&&t.workspaceId===s.workspaceId)tickets.push(t);
  }
  return res.status(200).json({tickets});
}

async function adminSupport(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const index=await kv.get('support:index')||[],tickets=[];
  for(const id of Array.isArray(index)?index.slice(0,250):[]){const t=await kv.get('support:'+id);if(t)tickets.push(t)}
  return res.status(200).json({tickets});
}

async function adminSupportUpdate(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),status=String(body.status||'');
  if(!id||!['open','in_progress','resolved'].includes(status))return res.status(400).json({error:'Invalid support update'});
  const key='support:'+id,t=await kv.get(key);if(!t)return res.status(404).json({error:'Ticket not found'});
  const next={...t,status,updatedAt:Date.now(),updatedBy:admin.email};await kv.set(key,next);
  return res.status(200).json({ok:true,ticket:next});
}

async function adminPlatformSettings(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const saved=await kv.get('platform:settings')||{};
  return res.status(200).json({settings:{supportEmail:saved.supportEmail||process.env.SUPPORT_EMAIL||'',defaultAgentName:saved.defaultAgentName||'Maya',defaultTimezone:saved.defaultTimezone||'America/Los_Angeles',maintenanceMode:!!saved.maintenanceMode,updatedAt:saved.updatedAt||null}});
}

async function adminPlatformSettingsSave(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},supportEmail=cleanEmail(body.supportEmail),defaultAgentName=String(body.defaultAgentName||'Maya').trim().slice(0,80),defaultTimezone=String(body.defaultTimezone||'America/Los_Angeles').trim().slice(0,100);
  if(supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))return res.status(400).json({error:'Valid support email required'});
  const settings={supportEmail,defaultAgentName:defaultAgentName||'Maya',defaultTimezone,maintenanceMode:!!body.maintenanceMode,updatedAt:Date.now(),updatedBy:admin.email};
  await kv.set('platform:settings',settings);return res.status(200).json({ok:true,settings});
}


async function adminTechSupport(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.query||{}).id||'').slice(0,80);
  if(!id)return res.status(400).json({error:'Client id required'});
  const ws=await kv.get('workspace:'+id);if(!ws)return res.status(404).json({error:'Client not found'});
  const email=cleanEmail(ws.ownerEmail||''),member=email?await kv.get('user:email:'+email):null;
  const config=await getWorkspaceConfigSnapshot(id),audit=await kv.get('audit:'+id)||[];
  return res.status(200).json({
    diagnostics:{
      workspaceExists:true,workspaceId:id,workspaceStatus:ws.status||'active',subscriptionStatus:ws.subscriptionStatus||'active',
      ownerEmail:email,userMappingExists:!!member,userMappingMatches:!!member&&member.workspaceId===id,
      role:member?.role||null,sessionVersion:Number(member?.sessionVersion||0),
      stripeCustomerLinked:!!ws.stripeCustomerId,stripeSubscriptionLinked:!!ws.stripeSubscriptionId,
      phoneConfigured:!!config.phone,agentConfigured:!!config.agent,settingsConfigured:!!config.settings,
      locationsConfigured:Array.isArray(config.locations)?config.locations.length:0
    },
    config,audit:Array.isArray(audit)?audit.slice(0,100):[]
  });
}
async function adminSendClientLogin(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.body||{}).id||'').slice(0,80),ws=await kv.get('workspace:'+id);
  if(!ws)return res.status(404).json({error:'Client not found'});
  const email=cleanEmail(ws.ownerEmail||'');if(!email)return res.status(409).json({error:'Client has no owner email'});
  const member=await kv.get('user:email:'+email);
  if(!member||member.workspaceId!==id)return res.status(409).json({error:'Client access mapping is broken. Repair access first.'});
  const token=crypto.randomBytes(32).toString('hex');
  await kv.set('login:'+token,{email,workspaceId:id,role:member.role||'owner',next:'/dashboard',authVersion:Number(member.sessionVersion||0)},{ex:15*60});
  const link=requestOrigin(req)+'/api/account?action=verify&token='+encodeURIComponent(token);
  await sendMail({to:email,subject:'Your CallerCore sign-in link',text:'CallerCore support sent you a secure sign-in link:\n\n'+link+'\n\nThis link expires in 15 minutes.',html:'<p>CallerCore support sent you a secure sign-in link:</p><p><a href="'+link+'">Sign in to CallerCore</a></p><p>This link expires in 15 minutes.</p>'});
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'login_link_sent',section:'access',meta:{recipient:email}});
  return res.status(200).json({ok:true,email});
}
async function adminForceLogout(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.body||{}).id||'').slice(0,80),ws=await kv.get('workspace:'+id);
  if(!ws)return res.status(404).json({error:'Client not found'});
  const email=cleanEmail(ws.ownerEmail||''),key='user:email:'+email,member=email?await kv.get(key):null;
  if(!member||member.workspaceId!==id)return res.status(409).json({error:'Client access mapping is missing or broken'});
  const sessionVersion=Number(member.sessionVersion||0)+1;
  await kv.set(key,{...member,sessionVersion});
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'force_logout',section:'access',meta:{sessionVersion}});
  return res.status(200).json({ok:true,sessionVersion});
}
async function adminRepairAccess(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),email=cleanEmail(body.email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Valid owner email required'});
  const key='workspace:'+id,ws=await kv.get(key);if(!ws)return res.status(404).json({error:'Client not found'});
  const existing=await kv.get('user:email:'+email);
  if(existing&&existing.workspaceId&&existing.workspaceId!==id)return res.status(409).json({error:'That email already belongs to another workspace'});
  const oldEmail=cleanEmail(ws.ownerEmail||''),oldMember=oldEmail?await kv.get('user:email:'+oldEmail):null;
  if(oldEmail&&oldEmail!==email&&oldMember&&oldMember.workspaceId===id)await kv.del('user:email:'+oldEmail);
  const sessionVersion=Number(existing?.sessionVersion||oldMember?.sessionVersion||0)+1;
  const member={workspaceId:id,role:'owner',email,sessionVersion};
  await kv.set('user:email:'+email,member);
  const next={...ws,ownerEmail:email,updatedAt:Date.now()};await kv.set(key,next);
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'access_repair',section:'access',before:{ownerEmail:oldEmail,mapping:oldMember||null},after:{ownerEmail:email,mapping:member}});
  return res.status(200).json({ok:true,email,sessionVersion});
}
function sanitizeAdminOverride(section,value,current){
  if(section==='settings'||section==='agent'||section==='integrations'){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Section must be a JSON object');
    return {...value,updatedAt:Date.now()};
  }
  if(section==='automations'||section==='locations'){
    if(!Array.isArray(value))throw new Error('Section must be a JSON array');
    return value.slice(0,section==='automations'?20:5);
  }
  if(section==='workspace'){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Workspace override must be a JSON object');
    const safe={...current};
    for(const k of ['name','ownerName','ownerEmail','industry','phone','status','plan','usage'])if(value[k]!==undefined)safe[k]=value[k];
    if(!['Starter','Growth','Pro'].includes(safe.plan))throw new Error('Invalid plan');
    if(!['active','onboarding','suspended'].includes(safe.status))throw new Error('Invalid status');
    safe.id=current.id;safe.updatedAt=Date.now();return safe;
  }
  throw new Error('Unsupported section');
}
async function adminOverrideConfig(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),section=String(body.section||'');
  const key=configKey(section,id);if(!key)return res.status(400).json({error:'Unsupported configuration section'});
  const ws=await kv.get('workspace:'+id);if(!ws)return res.status(404).json({error:'Client not found'});
  const before=await kv.get(key);
  let after;try{after=sanitizeAdminOverride(section,body.value,before||ws)}catch(err){return res.status(400).json({error:err.message})}
  await kv.set(key,after);
  if(section==='settings'&&after.businessName){const current=await kv.get('workspace:'+id);await kv.set('workspace:'+id,{...current,name:after.businessName,updatedAt:Date.now()})}
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'admin_override',section,before:before||null,after});
  return res.status(200).json({ok:true,section,value:after});
}
async function adminRestoreAudit(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),auditId=String(body.auditId||'').slice(0,80);
  const list=await kv.get('audit:'+id)||[],entry=(Array.isArray(list)?list:[]).find(x=>x&&x.id===auditId);
  if(!entry)return res.status(404).json({error:'Audit entry not found'});
  const key=configKey(entry.section,id);if(!key)return res.status(400).json({error:'This change cannot be restored automatically'});
  if(entry.before===undefined)return res.status(400).json({error:'No prior snapshot is available'});
  const current=await kv.get(key),restored=entry.before===null?(entry.section==='automations'||entry.section==='locations'?[]:{}):entry.before;
  await kv.set(key,restored);
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'restore_snapshot',section:entry.section,before:current||null,after:restored,meta:{restoredFrom:auditId}});
  return res.status(200).json({ok:true,section:entry.section,value:restored});
}

async function adminSystemHealth(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  let kvOk=false;
  try{await kv.set('health:last_check',Date.now(),{ex:120});const v=await kv.get('health:last_check');kvOk=!!v}catch(e){kvOk=false}
  const services=[
    {key:'database',name:'Upstash / KV',status:kvOk?'operational':'error',detail:kvOk?'Read/write check passed':'Database check failed'},
    {key:'stripe',name:'Stripe',status:process.env.STRIPE_SECRET_KEY?'configured':'not_configured',detail:process.env.STRIPE_SECRET_KEY?'Secret key available':'STRIPE_SECRET_KEY missing'},
    {key:'mailgun',name:'Mailgun',status:(process.env.MAILGUN_API_KEY&&process.env.MAILGUN_DOMAIN)?'configured':'not_configured',detail:(process.env.MAILGUN_API_KEY&&process.env.MAILGUN_DOMAIN)?'API credentials available':'Mailgun credentials incomplete'},
    {key:'voice',name:'Voice provider',status:(process.env.VAPI_API_KEY||process.env.VAPI_PRIVATE_KEY)?'configured':'not_configured',detail:(process.env.VAPI_API_KEY||process.env.VAPI_PRIVATE_KEY)?'Voice API credentials available':'Voice API credentials not configured'}
  ];
  return res.status(200).json({services,checkedAt:Date.now()});
}

async function adminClient(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.query||{}).id||'').slice(0,80);
  if(!id)return res.status(400).json({error:'Client id required'});
  const ws=await kv.get('workspace:'+id);if(!ws)return res.status(404).json({error:'Client not found'});
  const [agent,calls,leads,appointments,locations]=await Promise.all([
    kv.get('agent:'+id),kv.get('calls:'+id),kv.get('leads:'+id),kv.get('appointments:'+id),kv.get('locations:'+id)
  ]);
  return res.status(200).json({client:{
    id:ws.id,name:ws.name,plan:ws.plan,status:ws.status||'active',
    subscriptionStatus:ws.subscriptionStatus||'active',ownerEmail:ws.ownerEmail||'',
    phone:ws.phone||'',industry:ws.industry||'',usage:ws.usage||{minutes:0},
    stripe:{customerLinked:!!ws.stripeCustomerId,subscriptionLinked:!!ws.stripeSubscriptionId},
    agent:agent||null,
    counts:{calls:Array.isArray(calls)?calls.length:0,leads:Array.isArray(leads)?leads.length:0,appointments:Array.isArray(appointments)?appointments.length:0,locations:Array.isArray(locations)?locations.length:0}
  }});
}

async function requestLogin(req,res){
  const body=req.body||{};
  const email=cleanEmail(body.email);
  const requestedNext=String(body.next||'');
  const next=requestedNext==='/admin-dashboard'||requestedNext==='/dashboard'?requestedNext:'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(200).json({ok:true});
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const bucket='auth:rate:'+crypto.createHash('sha256').update(ip).digest('hex');
  const count=await kv.incr(bucket);if(count===1)await kv.expire(bucket,WINDOW);
  if(count>MAX)return res.status(429).json({error:'Too many requests. Try again shortly.'});
  const member=await kv.get('user:email:'+email);
  if(member&&member.workspaceId){
    const token=crypto.randomBytes(32).toString('hex');
    await kv.set('login:'+token,{email,workspaceId:member.workspaceId,role:member.role||'owner',next,authVersion:Number(member.sessionVersion||0)},{ex:15*60});
    const link=requestOrigin(req)+'/api/account?action=verify&token='+encodeURIComponent(token);
    try{
      await sendMail({
        to:email,
        subject:'Your CallerCore sign-in link',
        text:'Use this secure link to sign in to CallerCore:\n\n'+link+'\n\nThis link expires in 15 minutes.',
        html:'<p>Use this secure link to sign in to CallerCore:</p><p><a href="'+link+'">Sign in to CallerCore</a></p><p>This link expires in 15 minutes.</p>'
      });
    }catch(err){console.error('auth email failed',err);return res.status(503).json({error:'Sign-in email temporarily unavailable'})}
  }
  return res.status(200).json({ok:true});
}

async function verify(req,res){
  const token=String((req.query||{}).token||'');
  if(!/^[a-f0-9]{64}$/.test(token))return res.redirect(302,'/login?error=invalid');
  const key='login:'+token,record=await kv.get(key);
  if(!record||!record.workspaceId)return res.redirect(302,'/login?error=expired');
  await kv.del(key);
  await createSession(res,{email:record.email,workspaceId:record.workspaceId,role:record.role||'owner',authVersion:Number(record.authVersion||0)});
  const destination=record.next||((record.role||'owner')==='admin'?'/admin-dashboard':'/dashboard');
  return res.redirect(302,destination);
}

async function session(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);
  if(!ws)return res.status(404).json({error:'Workspace not found'});
  const ent=entitlementsFor(ws.plan);
  const member=await kv.get('user:email:'+cleanEmail(s.email));
  return res.status(200).json({
    user:{email:s.email,role:member&&member.role||s.role,adminView:!!s.adminView},
    workspace:{
      id:ws.id,name:ws.name,plan:ent.plan,status:ws.status||'active',
      subscriptionStatus:ws.subscriptionStatus||'active',
      usage:ws.usage||{minutes:0},phone:ws.phone||'',locations:ent.locations,
      stripe:{customerLinked:!!ws.stripeCustomerId,subscriptionLinked:!!ws.stripeSubscriptionId},
      entitlements:ent
    }
  });
}

async function workspace(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);
  if(!ws)return res.status(404).json({error:'Workspace not found'});
  return res.status(200).json({workspace:{
    id:ws.id,name:ws.name,plan:ws.plan,status:ws.status,ownerEmail:ws.ownerEmail,
    usage:ws.usage||{minutes:0},createdAt:ws.createdAt
  }});
}

async function requireFeature(req,res,feature){
  const s=await requireSession(req,res);if(!s)return null;
  const ws=await kv.get('workspace:'+s.workspaceId);
  if(!ws)return res.status(404).json({error:'Workspace not found'}),null;
  const ent=entitlementsFor(ws.plan);
  if(!ent.features[feature])return res.status(403).json({error:'Upgrade required',feature}),null;
  return {session:s,workspace:ws,entitlements:ent};
}

async function phoneRouting(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const numbers=await kv.get('phone:index')||[];
  const item=(Array.isArray(numbers)?numbers:[]).find(x=>x&&x.workspaceId===s.workspaceId)||null;
  return res.status(200).json({routing:item?{number:item.number||'',label:item.label||'Primary',provider:item.provider||'Vapi',forwardingFrom:item.forwardingFrom||'',transferNumber:item.transferNumber||'',afterHours:item.afterHours||'ai',smsEnabled:item.smsEnabled!==false,status:item.status||'active'}:null});
}

async function locations(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  const items=await kv.get('locations:'+s.workspaceId)||[];
  const ent=entitlementsFor(ws.plan);
  return res.status(200).json({locations:Array.isArray(items)?items:[],limit:ent.locations});
}

async function saveLocations(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  const ent=entitlementsFor(ws.plan),incoming=Array.isArray((req.body||{}).locations)?req.body.locations:[];
  if(incoming.length>ent.locations)return res.status(403).json({error:'Your '+ent.plan+' plan supports up to '+ent.locations+' location'+(ent.locations===1?'':'s')});
  const clean=(v,n)=>String(v||'').trim().slice(0,n);
  const items=incoming.map((x,i)=>({
    id:clean(x.id,100)||crypto.randomUUID(),
    name:clean(x.name,120)||('Location '+(i+1)),
    phone:clean(x.phone,40),
    address:clean(x.address,300),
    timezone:clean(x.timezone,100)||'America/Los_Angeles',
    active:x.active!==false,
    updatedAt:Date.now()
  }));
  for(const item of items){if(item.phone&&!/^\+?[0-9() .-]{7,30}$/.test(item.phone))return res.status(400).json({error:'One or more location phone numbers are invalid'})}
  const previous=await kv.get('locations:'+s.workspaceId)||[];
  await kv.set('locations:'+s.workspaceId,items);
  await appendAudit(s.workspaceId,{actorEmail:s.email,actorRole:s.role||'client',action:'locations_save',section:'locations',before:previous,after:items});
  return res.status(200).json({ok:true,locations:items,limit:ent.locations});
}

async function agent(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);
  if(!ws)return res.status(404).json({error:'Workspace not found'});
  const saved=await kv.get('agent:'+s.workspaceId)||{};
  const platform=await kv.get('platform:settings')||{};
  return res.status(200).json({agent:{
    name:saved.name||platform.defaultAgentName||'Maya',
    role:saved.role||'AI Receptionist',
    openingMessage:saved.openingMessage||('Thank you for calling '+(ws.name||'our business')+'. This is Maya. How can I help you today?'),
    tone:saved.tone||'Warm & professional',
    serviceArea:saved.serviceArea||'',
    businessHours:saved.businessHours||'',
    emergencyInstructions:saved.emergencyInstructions||'',
    qualificationQuestions:Array.isArray(saved.qualificationQuestions)?saved.qualificationQuestions:[],
    transferNumber:saved.transferNumber||'',
    updatedAt:saved.updatedAt||null
  }});
}

async function saveAgent(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const body=req.body||{};
  const clean=(v,n)=>String(v||'').trim().slice(0,n);
  const agent={
    name:clean(body.name,80)||'Maya',
    role:clean(body.role,120)||'AI Receptionist',
    openingMessage:clean(body.openingMessage,1200),
    tone:clean(body.tone,80)||'Warm & professional',
    serviceArea:clean(body.serviceArea,500),
    businessHours:clean(body.businessHours,500),
    emergencyInstructions:clean(body.emergencyInstructions,1200),
    qualificationQuestions:Array.isArray(body.qualificationQuestions)?body.qualificationQuestions.map(v=>clean(v,240)).filter(Boolean).slice(0,12):[],
    transferNumber:clean(body.transferNumber,40),
    updatedAt:Date.now()
  };
  const previous=await kv.get('agent:'+s.workspaceId)||null;
  await kv.set('agent:'+s.workspaceId,agent);
  await appendAudit(s.workspaceId,{actorEmail:s.email,actorRole:s.role||'client',action:'agent_save',section:'agent',before:previous,after:agent});
  return res.status(200).json({ok:true,agent});
}

async function automations(req,res){
  const access=await requireFeature(req,res,'automations');if(!access)return;
  const items=await kv.get('automations:'+access.session.workspaceId)||[];
  return res.status(200).json({automations:Array.isArray(items)?items:[]});
}

async function saveAutomations(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  if(!entitlementsFor(ws.plan).features.automations)return res.status(403).json({error:'Upgrade required',feature:'automations'});
  const access={session:s,workspace:ws};
  const incoming=Array.isArray((req.body||{}).automations)?req.body.automations:[];
  const allowedTriggers=['missed_call','new_lead','qualified_lead','appointment_booked','after_hours_call'];
  const allowedActions=['send_sms','notify_team','create_followup','mark_priority','send_confirmation'];
  const items=incoming.slice(0,20).map((item,i)=>({
    id:String(item.id||('auto_'+i)).slice(0,120),
    name:String(item.name||'Automation').trim().slice(0,120),
    trigger:allowedTriggers.includes(item.trigger)?item.trigger:'new_lead',
    action:allowedActions.includes(item.action)?item.action:'notify_team',
    enabled:item.enabled!==false,
    updatedAt:Date.now()
  }));
  const previous=await kv.get('automations:'+access.session.workspaceId)||[];
  await kv.set('automations:'+access.session.workspaceId,items);
  await appendAudit(access.session.workspaceId,{actorEmail:access.session.email,actorRole:access.session.role||'client',action:'automations_save',section:'automations',before:previous,after:items});
  return res.status(200).json({ok:true,automations:items});
}

async function conversations(req,res){
  const access=await requireFeature(req,res,'unifiedInbox');if(!access)return;
  const items=await kv.get('conversations:'+access.session.workspaceId)||[];
  return res.status(200).json({conversations:Array.isArray(items)?items:[]});
}

async function appointments(req,res){
  const access=await requireFeature(req,res,'appointments');if(!access)return;
  const items=await kv.get('appointments:'+access.session.workspaceId)||[];
  return res.status(200).json({appointments:Array.isArray(items)?items:[]});
}

async function updateAppointment(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  if(!entitlementsFor(ws.plan).features.appointments)return res.status(403).json({error:'Upgrade required',feature:'appointments'});
  const access={session:s,workspace:ws};
  const id=String((req.body||{}).id||'').slice(0,120);
  const status=String((req.body||{}).status||'').slice(0,40);
  if(!id||!['Scheduled','Confirmed','Completed','Canceled'].includes(status))return res.status(400).json({error:'Invalid appointment update'});
  const key='appointments:'+access.session.workspaceId;
  const items=await kv.get(key)||[];if(!Array.isArray(items))return res.status(200).json({ok:true,updated:false});
  let updated=false;const next=items.map(item=>item&&String(item.id)===id?(updated=true,{...item,status,updatedAt:Date.now()}):item);
  if(updated)await kv.set(key,next);
  return res.status(200).json({ok:true,updated});
}

async function analytics(req,res){
  const access=await requireFeature(req,res,'advancedAnalytics');if(!access)return;
  const calls=await kv.get('calls:'+access.session.workspaceId)||[];
  const leads=await kv.get('leads:'+access.session.workspaceId)||[];
  const appointments=await kv.get('appointments:'+access.session.workspaceId)||[];
  const safeCalls=Array.isArray(calls)?calls:[],safeLeads=Array.isArray(leads)?leads:[],safeAppointments=Array.isArray(appointments)?appointments:[];
  const qualified=safeCalls.filter(x=>/qualified|booked/i.test(String(x.outcome||''))).length;
  const won=safeLeads.filter(x=>x&&x.stage==='Won').length;
  const pipeline=safeLeads.reduce((sum,x)=>sum+Number(x&&x.value||0),0);
  const reasons={};safeCalls.forEach(x=>{const k=String(x&&x.reason||'Other').slice(0,80);reasons[k]=(reasons[k]||0)+1});
  return res.status(200).json({analytics:{
    calls:safeCalls.length,leads:safeLeads.length,appointments:safeAppointments.length,
    qualified,won,pipeline,conversion:safeLeads.length?Math.round((won/safeLeads.length)*100):0,
    callReasons:Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([label,value])=>({label,value}))
  }});
}

async function settings(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  const saved=await kv.get('settings:'+s.workspaceId)||{};
  const platform=await kv.get('platform:settings')||{};
  return res.status(200).json({settings:{
    businessName:saved.businessName||ws.name||'',
    primaryEmail:saved.primaryEmail||ws.ownerEmail||s.email||'',
    contactName:saved.contactName||ws.ownerName||'',
    businessPhone:saved.businessPhone||'',
    website:saved.website||'',
    streetAddress:saved.streetAddress||'',
    city:saved.city||'',
    state:saved.state||'',
    postalCode:saved.postalCode||'',
    industry:saved.industry||ws.industry||'',
    serviceArea:saved.serviceArea||'',
    timezone:saved.timezone||platform.defaultTimezone||'America/Los_Angeles',
    notificationEmail:saved.notificationEmail||ws.ownerEmail||s.email||'',
    smsAlerts:saved.smsAlerts!==false,
    emailAlerts:saved.emailAlerts!==false
  }});
}

async function saveSettings(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const body=req.body||{},clean=(v,n)=>String(v||'').trim().slice(0,n);
  const settings={
    businessName:clean(body.businessName,160),
    primaryEmail:clean(body.primaryEmail,200).toLowerCase(),
    contactName:clean(body.contactName,160),
    businessPhone:clean(body.businessPhone,40),
    website:clean(body.website,300),
    streetAddress:clean(body.streetAddress,240),
    city:clean(body.city,120),
    state:clean(body.state,80),
    postalCode:clean(body.postalCode,30),
    industry:clean(body.industry,120),
    serviceArea:clean(body.serviceArea,500),
    timezone:clean(body.timezone,100)||'America/Los_Angeles',
    notificationEmail:clean(body.notificationEmail,200).toLowerCase(),
    smsAlerts:body.smsAlerts!==false,emailAlerts:body.emailAlerts!==false,updatedAt:Date.now()
  };
  if(settings.primaryEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.primaryEmail))return res.status(400).json({error:'Valid primary email required'});
  if(settings.notificationEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.notificationEmail))return res.status(400).json({error:'Valid notification email required'});
  if(settings.businessPhone&&!/^\+?[0-9() .-]{7,30}$/.test(settings.businessPhone))return res.status(400).json({error:'Valid business phone required'});
  if(settings.website&&!/^https?:\/\//i.test(settings.website))return res.status(400).json({error:'Website must begin with http:// or https://'});
  const previous=await kv.get('settings:'+s.workspaceId)||null;
  await kv.set('settings:'+s.workspaceId,settings);
  await appendAudit(s.workspaceId,{actorEmail:s.email,actorRole:s.role||'client',action:'settings_save',section:'settings',before:previous,after:settings});
  if(settings.businessName){
    const key='workspace:'+s.workspaceId,ws=await kv.get(key);
    if(ws)await kv.set(key,{...ws,name:settings.businessName,ownerName:settings.contactName||ws.ownerName,industry:settings.industry||ws.industry,updatedAt:Date.now()});
  }
  return res.status(200).json({ok:true,settings});
}

async function integrations(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  const saved=await kv.get('integrations:'+s.workspaceId)||{};
  return res.status(200).json({integrations:{
    googleCalendar:!!saved.googleCalendar,
    stripe:!!ws.stripeCustomerId,
    webhookUrl:saved.webhookUrl||'',
    apiAccess:entitlementsFor(ws.plan).features.apiAccess
  }});
}

async function saveIntegrations(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  if(!entitlementsFor(ws.plan).features.apiAccess)return res.status(403).json({error:'Upgrade required',feature:'apiAccess'});
  const access={session:s,workspace:ws};
  const url=String((req.body||{}).webhookUrl||'').trim().slice(0,500);
  if(url&&!/^https:\/\//i.test(url))return res.status(400).json({error:'Webhook URL must use HTTPS'});
  const saved=await kv.get('integrations:'+access.session.workspaceId)||{};
  const next={...saved,webhookUrl:url,updatedAt:Date.now()};
  await kv.set('integrations:'+access.session.workspaceId,next);
  await appendAudit(access.session.workspaceId,{actorEmail:access.session.email,actorRole:access.session.role||'client',action:'integrations_save',section:'integrations',before:saved,after:next});
  return res.status(200).json({ok:true,integrations:next});
}

async function calls(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const items=await kv.get('calls:'+s.workspaceId)||[];
  return res.status(200).json({calls:Array.isArray(items)?items:[]});
}

async function leads(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const items=await kv.get('leads:'+s.workspaceId)||[];
  return res.status(200).json({leads:Array.isArray(items)?items:[]});
}

async function updateLead(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const id=String((req.body||{}).id||'').slice(0,120);
  const stage=String((req.body||{}).stage||'').slice(0,40);
  const allowed=['New','Contacted','Qualified','Appointment','Won','Lost'];
  if(!id||!allowed.includes(stage))return res.status(400).json({error:'Invalid lead update'});
  const key='leads:'+s.workspaceId;
  const items=await kv.get(key)||[];
  if(!Array.isArray(items))return res.status(200).json({ok:true,updated:false});
  let updated=false;
  const next=items.map(item=>item&&String(item.id)===id?(updated=true,{...item,stage,updatedAt:Date.now()}):item);
  if(updated)await kv.set(key,next);
  return res.status(200).json({ok:true,updated});
}

async function billingPortal(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  if(!ws.stripeCustomerId)return res.status(409).json({error:'No Stripe customer is linked to this workspace'});
  if(!process.env.STRIPE_SECRET_KEY)return res.status(503).json({error:'Stripe billing is not configured'});
  try{
    const body=new URLSearchParams({customer:String(ws.stripeCustomerId),return_url:requestOrigin(req)+'/dashboard'});
    const r=await fetch('https://api.stripe.com/v1/billing_portal/sessions',{method:'POST',headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
    const data=await r.json();
    if(!r.ok||!data.url)return res.status(502).json({error:data.error?.message||'Could not create Stripe billing portal session'});
    return res.status(200).json({url:data.url});
  }catch(err){console.error('billing portal failed',err);return res.status(502).json({error:'Could not open Stripe billing portal'})}
}

async function logout(req,res){
  const token=parseCookies(req).cc_session;if(token)await kv.del('session:'+token);
  clearSessionCookie(res);return res.status(200).json({ok:true});
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const action=String((req.query||{}).action||'');
  if(action==='bootstrap-preview'&&req.method==='POST')return bootstrapPreview(req,res);
  if(action==='promote-preview-admin'&&req.method==='POST')return promotePreviewAdmin(req,res);
  if(action==='admin-summary'&&req.method==='GET')return adminSummary(req,res);
  if(action==='admin-clients'&&req.method==='GET')return adminClients(req,res);
  if(action==='admin-client'&&req.method==='GET')return adminClient(req,res);
  if(action==='admin-provisioning'&&req.method==='GET')return adminProvisioning(req,res);
  if(action==='admin-provisioning-stage-save'&&req.method==='POST')return adminSaveProvisioningStage(req,res);
  if(action==='admin-provisioning-stage-clear'&&req.method==='POST')return adminClearProvisioningStage(req,res);
  if(action==='admin-phone-numbers'&&req.method==='GET')return adminPhoneNumbers(req,res);
  if(action==='admin-phone-number-save'&&req.method==='POST')return adminSavePhoneNumber(req,res);
  if(action==='admin-phone-number-delete'&&req.method==='POST')return adminDeletePhoneNumber(req,res);
  if(action==='admin-tech-support'&&req.method==='GET')return adminTechSupport(req,res);
  if(action==='admin-send-client-login'&&req.method==='POST')return adminSendClientLogin(req,res);
  if(action==='admin-force-logout'&&req.method==='POST')return adminForceLogout(req,res);
  if(action==='admin-repair-access'&&req.method==='POST')return adminRepairAccess(req,res);
  if(action==='admin-config-override'&&req.method==='POST')return adminOverrideConfig(req,res);
  if(action==='admin-audit-restore'&&req.method==='POST')return adminRestoreAudit(req,res);
  if(action==='admin-system-health'&&req.method==='GET')return adminSystemHealth(req,res);
  if(action==='admin-fleet'&&req.method==='GET')return adminFleet(req,res);
  if(action==='admin-support'&&req.method==='GET')return adminSupport(req,res);
  if(action==='admin-support-update'&&req.method==='POST')return adminSupportUpdate(req,res);
  if(action==='admin-platform-settings'&&req.method==='GET')return adminPlatformSettings(req,res);
  if(action==='admin-platform-settings-save'&&req.method==='POST')return adminPlatformSettingsSave(req,res);
  if(action==='admin-client-update'&&req.method==='POST')return adminUpdateClient(req,res);
  if(action==='admin-client-delete'&&req.method==='POST')return adminDeleteClient(req,res);
  if(action==='admin-view-client'&&req.method==='POST')return adminViewClient(req,res);
  if(action==='admin-exit-client-view'&&req.method==='POST')return adminExitClientView(req,res);
  if(action==='request'&&req.method==='POST')return requestLogin(req,res);
  if(action==='verify'&&req.method==='GET')return verify(req,res);
  if(action==='session'&&req.method==='GET')return session(req,res);
  if(action==='workspace'&&req.method==='GET')return workspace(req,res);
  if(action==='phone-routing'&&req.method==='GET')return phoneRouting(req,res);
  if(action==='locations'&&req.method==='GET')return locations(req,res);
  if(action==='locations-save'&&req.method==='POST')return saveLocations(req,res);
  if(action==='agent'&&req.method==='GET')return agent(req,res);
  if(action==='agent-save'&&req.method==='POST')return saveAgent(req,res);
  if(action==='automations'&&req.method==='GET')return automations(req,res);
  if(action==='automations-save'&&req.method==='POST')return saveAutomations(req,res);
  if(action==='analytics'&&req.method==='GET')return analytics(req,res);
  if(action==='settings'&&req.method==='GET')return settings(req,res);
  if(action==='settings-save'&&req.method==='POST')return saveSettings(req,res);
  if(action==='integrations'&&req.method==='GET')return integrations(req,res);
  if(action==='integrations-save'&&req.method==='POST')return saveIntegrations(req,res);
  if(action==='calls'&&req.method==='GET')return calls(req,res);
  if(action==='conversations'&&req.method==='GET')return conversations(req,res);
  if(action==='appointments'&&req.method==='GET')return appointments(req,res);
  if(action==='appointment-update'&&req.method==='POST')return updateAppointment(req,res);
  if(action==='leads'&&req.method==='GET')return leads(req,res);
  if(action==='lead-update'&&req.method==='POST')return updateLead(req,res);
  if(action==='support-tickets'&&req.method==='GET')return supportTickets(req,res);
  if(action==='support-ticket-create'&&req.method==='POST')return createSupportTicket(req,res);
  if(action==='billing-portal'&&req.method==='POST')return billingPortal(req,res);
  if(action==='logout'&&req.method==='POST')return logout(req,res);
  return res.status(404).json({error:'Unknown account action'});
};