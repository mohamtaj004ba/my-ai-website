const crypto=require('crypto');
const {kv,storageEnvironment}=require('../lib/kv');
const {cleanEmail,createSession,parseCookies,clearSessionCookie,requireSession}=require('../lib/auth');
const {sendMail}=require('../lib/mail');
const {lifecycleEmail,authEmail,esc:escapeEmailHtml}=require('../lib/email-template');
const {entitlementsFor}=require('../lib/plans');
const {emailKey}=require('../lib/site-analytics');
const {safeError}=require('../lib/safe-log');
const previewSeed=require('../lib/preview-seed');
const {configReady:gmailConfigReady,oauthUrl:getGmailOauthUrl,getConnection:getGmailConnection,disconnect:disconnectGmail,listInbox:listGmailInbox,listAliases:listGmailAliases,gmailFetch,markThreadRead:markGmailThreadRead,sendMessage:sendGmailMessage}=require('../lib/gmail');

const SITE_URL=process.env.SITE_URL||'https://www.callercore.com';
const WINDOW=10*60,MAX=5;

function requestOrigin(req){
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  const proto=String(req.headers['x-forwarded-proto']||'https').toLowerCase().split(',')[0].trim()==='http'?'http':'https';
  if(host==='callercore.com'||host==='www.callercore.com'||host.endsWith('.vercel.app'))return proto+'://'+host;
  return SITE_URL;
}


function mutationOriginAllowed(req){
  const fetchSite=String(req.headers['sec-fetch-site']||'').toLowerCase();
  if(fetchSite==='cross-site')return false;
  const origin=String(req.headers.origin||'').trim();
  if(!origin)return true;
  try{
    const originHost=new URL(origin).host.toLowerCase();
    const requestHost=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
    return !!requestHost&&originHost===requestHost;
  }catch(_){return false}
}

async function kvHealthCheck(timeoutMs=2500){
  const stamp=Date.now(),key='health:last_check';
  try{
    const work=(async()=>{await kv.set(key,stamp,{ex:120});const value=await kv.get(key);return Number(value)===stamp})();
    const ok=await Promise.race([work,new Promise((_,reject)=>setTimeout(()=>reject(new Error('KV health check timed out')),timeoutMs))]);
    return {ok:!!ok,error:''};
  }catch(err){
    const raw=String(err&&err.message||err||'Database check failed');
    const error=/ENOTFOUND|getaddrinfo/i.test(raw)?'dns':/timed out/i.test(raw)?'timeout':'unavailable';
    return {ok:false,error};
  }
}

async function publicHealth(req,res){
  const db=await kvHealthCheck();
  res.setHeader('Cache-Control','no-store');
  return res.status(db.ok?200:503).json({ok:db.ok,database:db.ok?'operational':'error',storage:storageEnvironment(),checkedAt:Date.now()});
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

async function seedPreviewData(req,res){
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  if(process.env.VERCEL_ENV!=='preview'||!host.endsWith('.vercel.app'))return res.status(404).json({error:'Not found'});
  const configured=String(process.env.CALLERCORE_BOOTSTRAP_SECRET||''),supplied=String(req.headers['x-bootstrap-secret']||'');
  if(!configured||!supplied||supplied!==configured)return res.status(403).json({error:'Forbidden'});
  const email=cleanEmail((req.body||{}).email);
  const member=await kv.get('user:email:'+email);
  if(!member||!member.workspaceId)return res.status(404).json({error:'Create the workspace first'});
  const workspaceId=member.workspaceId,now=Date.now(),dataset=previewSeed.makePrimaryDataset();
  const workspace=previewSeed.primaryWorkspace(workspaceId,email,now);
  workspace.usage.minutes=dataset.minutes;
  const seededFollowups={};
  dataset.calls.forEach((call,index)=>{
    const outcome=String(call&&call.outcome||''),reason=String(call&&call.reason||''),requires=/miss|follow|qualif/i.test(outcome)||/urgent|emergency|no heat|gas|carbon monoxide/i.test(reason);
    if(!requires)return;
    const ageDays=Math.max(0,(now-Number(call.createdAt||now))/86400000),urgent=/urgent|emergency|no heat|gas|carbon monoxide/i.test(reason),missed=/miss/i.test(outcome),qualified=/qualif/i.test(outcome),follow=/follow/i.test(outcome);
    const keepOpen=ageDays<2.25&&(urgent||missed||(follow&&index%3===0)||(qualified&&index%6===0));
    seededFollowups[String(call.id)]={status:keepOpen?'open':'handled',note:'',updatedAt:keepOpen?Number(call.createdAt||now):Math.min(now,Number(call.createdAt||now)+Math.round((4+(index%36))*3600000)),updatedBy:keepOpen?'':'office@summitheatingair.com'};
  });
  await Promise.all([
    kv.set('workspace:'+workspaceId,workspace),
    kv.set('settings:'+workspaceId,previewSeed.primarySettings(email)),
    kv.set('agent:'+workspaceId,previewSeed.primaryAgent()),
    kv.set('automations:'+workspaceId,previewSeed.primaryAutomations()),
    kv.set('locations:'+workspaceId,previewSeed.primaryLocations()),
    kv.set('calls:'+workspaceId,dataset.calls),
    kv.set('leads:'+workspaceId,dataset.leads),
    kv.set('conversations:'+workspaceId,dataset.conversations),
    kv.set('followup:state:'+workspaceId,seededFollowups),
    kv.set('appointments:'+workspaceId,dataset.appointments),
    kv.set('integrations:'+workspaceId,{googleCalendar:false,stripe:false,webhookUrl:'',apiAccess:true,updatedAt:now}),
    kv.set('onboarding:workspace:'+workspaceId,{status:'live',completionPercent:100,checklist:{payment:true,accountReview:true,onboardingSent:true,agreement:true,intake:true,businessProfile:true,agentDraft:true,routingCaptured:true,phoneAssigned:true,adminReview:true,testCall:true,clientApproval:true,live:true},updatedAt:now})
  ]);
  const phoneIndex=await kv.get('phone:index')||[],primaryPhone=previewSeed.primaryPhone(workspaceId);
  const phoneList=(Array.isArray(phoneIndex)?phoneIndex:[]).filter(x=>x&&x.workspaceId!==workspaceId&&x.id!==primaryPhone.id);
  phoneList.unshift(primaryPhone);
  await kv.set('phone:index',phoneList.slice(0,500));

  const currentIndex=await kv.get('workspace:index')||[],index=Array.isArray(currentIndex)?currentIndex:[];
  const seedPrefix=workspaceId.slice(0,8);
  const keep=index.filter(id=>!String(id).startsWith('seed_'+seedPrefix+'_'));
  const adminIds=[];
  for(let i=0;i<previewSeed.ADMIN_CLIENTS.length;i++){
    const ws=previewSeed.adminWorkspace(seedPrefix,i,now);adminIds.push(ws.id);
    const settings={businessName:ws.name,primaryEmail:ws.ownerEmail,contactName:ws.ownerName,businessPhone:ws.phone,website:'https://example-client.test',streetAddress:(1200+i*113)+' W Riverside Ave',city:'Spokane',state:'WA',postalCode:'99201',industry:ws.industry,serviceArea:'Spokane metro and surrounding communities.',timezone:'America/Los_Angeles',notificationEmail:ws.ownerEmail,emailAlerts:true,smsAlerts:false,notifyBilling:true,notifySetup:true,notifyCalls:true,notifySupport:true,notifyUsage:true,updatedAt:now};
    const autos=i%3===0?[]:[{id:'seed_auto_'+i,name:'New lead alert',trigger:'new_lead',action:'notify_team',enabled:true}];
    const onboarding=ws.status==='onboarding'
      ?{status:'building_review',completionPercent:66,checklist:{payment:true,accountReview:true,onboardingSent:true,agreement:true,intake:true,businessProfile:true,agentDraft:true,routingCaptured:true,phoneAssigned:false,adminReview:false,testCall:false,clientApproval:false,live:false},updatedAt:now}
      :{status:'live',completionPercent:100,checklist:{payment:true,accountReview:true,onboardingSent:true,agreement:true,intake:true,businessProfile:true,agentDraft:true,routingCaptured:true,phoneAssigned:true,adminReview:true,testCall:true,clientApproval:true,live:true},updatedAt:now};
    await Promise.all([
      kv.set('workspace:'+ws.id,ws),kv.set('settings:'+ws.id,settings),kv.set('agent:'+ws.id,previewSeed.adminSeedAgent(ws.industry)),
      kv.set('automations:'+ws.id,autos),kv.set('calls:'+ws.id,previewSeed.adminSeedCalls(i,ws.name)),kv.set('leads:'+ws.id,previewSeed.adminSeedLeads(i)),
      kv.set('conversations:'+ws.id,[]),kv.set('appointments:'+ws.id,[]),kv.set('locations:'+ws.id,[{id:'loc_'+i,name:'Main office',phone:ws.phone,address:(1200+i*113)+' W Riverside Ave, Spokane, WA 99201',timezone:'America/Los_Angeles',active:true}]),
      kv.set('onboarding:workspace:'+ws.id,onboarding)
    ]);
  }
  await kv.set('workspace:index',[workspaceId,...adminIds,...keep.filter(id=>id!==workspaceId)].slice(0,250));
  await appendAudit(workspaceId,{actorEmail:email,actorRole:'owner',action:'preview_seed_realistic_dataset',section:'workspace',before:null,after:{calls:dataset.calls.length,leads:dataset.leads.length,conversations:dataset.conversations.length,days:60,adminClients:adminIds.length}});
  return res.status(200).json({ok:true,workspaceId,businessName:workspace.name,days:60,calls:dataset.calls.length,leads:dataset.leads.length,conversations:dataset.conversations.length,appointments:dataset.appointments.length,adminClients:adminIds.length,plan:workspace.plan,minutes:dataset.minutes});
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
  const body=req.body||{},id=String(body.id||'').slice(0,80);
  if(!id)return res.status(400).json({error:'Client id required'});
  if(id===admin.workspaceId)return res.status(409).json({error:'You cannot delete the workspace currently used by your admin account'});
  const key='workspace:'+id,ws=await kv.get(key);if(!ws)return res.status(404).json({error:'Client not found'});
  if(ws.stripeSubscriptionId&&String(ws.subscriptionStatus||'active')!=='canceled'){
    return res.status(409).json({error:'This workspace has an active Stripe subscription. Cancel the subscription before scheduling deletion.'});
  }
  if(ws.status==='pending_deletion')return res.status(200).json({ok:true,pendingDeletion:true,purgeEligibleAt:ws.purgeEligibleAt||null});
  const now=Date.now(),purgeEligibleAt=now+30*24*60*60*1000;
  const next={...ws,status:'pending_deletion',deletionRequestedAt:now,purgeEligibleAt,deletionRequestedBy:admin.email,deletionReason:String(body.reason||'').trim().slice(0,500),preDeletionStatus:ws.status||'active',updatedAt:now};
  await kv.set(key,next);
  const email=cleanEmail(ws.ownerEmail||''),memberKey=email?'user:email:'+email:'',member=memberKey?await kv.get(memberKey):null;
  if(member&&member.workspaceId===id)await kv.set(memberKey,{...member,disabled:true,sessionVersion:Number(member.sessionVersion||0)+1});
  try{if(email)await disconnectGmail(email)}catch(_){}
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'deletion_scheduled',section:'privacy',before:{status:ws.status||'active'},after:{status:'pending_deletion',purgeEligibleAt},meta:{reason:next.deletionReason}});
  return res.status(200).json({ok:true,pendingDeletion:true,purgeEligibleAt});
}

async function adminRestoreDeletedClient(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.body||{}).id||'').slice(0,80),key='workspace:'+id,ws=await kv.get(key);
  if(!ws)return res.status(404).json({error:'Client not found'});
  if(ws.status!=='pending_deletion')return res.status(409).json({error:'Workspace is not pending deletion'});
  const restoredStatus=['active','onboarding','suspended'].includes(ws.preDeletionStatus)?ws.preDeletionStatus:'suspended';
  const next={...ws,status:restoredStatus,updatedAt:Date.now()};
  delete next.deletionRequestedAt;delete next.purgeEligibleAt;delete next.deletionRequestedBy;delete next.deletionReason;delete next.preDeletionStatus;
  await kv.set(key,next);
  const email=cleanEmail(ws.ownerEmail||''),memberKey=email?'user:email:'+email:'',member=memberKey?await kv.get(memberKey):null;
  if(member&&member.workspaceId===id)await kv.set(memberKey,{...member,disabled:false,sessionVersion:Number(member.sessionVersion||0)+1});
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'deletion_restored',section:'privacy',before:{status:'pending_deletion'},after:{status:restoredStatus}});
  return res.status(200).json({ok:true,status:restoredStatus});
}

async function adminPurgeClient(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),key='workspace:'+id,ws=await kv.get(key);
  if(!ws)return res.status(404).json({error:'Client not found'});
  if(ws.status!=='pending_deletion')return res.status(409).json({error:'Workspace must be pending deletion first'});
  if(Date.now()<Number(ws.purgeEligibleAt||0))return res.status(409).json({error:'30-day recovery window has not ended',purgeEligibleAt:ws.purgeEligibleAt||null});
  if(String(body.confirm||'')!=='DELETE '+id)return res.status(400).json({error:'Confirmation must equal DELETE '+id});
  if(ws.stripeSubscriptionId&&String(ws.subscriptionStatus||'active')!=='canceled')return res.status(409).json({error:'Active Stripe subscription blocks permanent deletion'});
  const onboarding=await kv.get('onboarding:workspace:'+id)||{};
  const retained={
    workspaceId:id,businessName:ws.name||'',ownerEmail:cleanEmail(ws.ownerEmail||''),
    stripeCustomerId:ws.stripeCustomerId||null,stripeSubscriptionId:ws.stripeSubscriptionId||null,
    agreementVersion:onboarding.agreementVersion||'',agreementSignedAt:onboarding.agreementSignedAt||null,
    agreementSignedName:onboarding.agreementSignedName||onboarding.agreementFullName||'',
    deletionRequestedAt:ws.deletionRequestedAt||null,purgedAt:Date.now(),purgedBy:admin.email
  };
  await kv.set('retention:workspace:'+id,retained,{ex:60*60*24*365*7});
  const index=await kv.get('workspace:index')||[];
  await kv.set('workspace:index',(Array.isArray(index)?index:[]).filter(x=>x!==id));
  if(ws.ownerEmail){
    const memberKey='user:email:'+cleanEmail(ws.ownerEmail),member=await kv.get(memberKey);
    if(member&&member.workspaceId===id)await kv.del(memberKey);
  }
  if(ws.stripeCustomerId)await kv.del('stripe:customer:'+ws.stripeCustomerId);
  if(ws.stripeSubscriptionId)await kv.del('stripe:subscription:'+ws.stripeSubscriptionId);
  const phoneIndex=await kv.get('phone:index')||[];
  if(Array.isArray(phoneIndex))await kv.set('phone:index',phoneIndex.map(x=>x&&x.workspaceId===id?{...x,workspaceId:'',workspaceName:'',updatedAt:Date.now()}:x));
  const supportIndex=await kv.get('support:index')||[],keepSupport=[],retainedSupport=[];
  for(const ticketId of Array.isArray(supportIndex)?supportIndex:[]){
    const ticket=await kv.get('support:'+ticketId);
    if(ticket&&ticket.workspaceId===id){retainedSupport.push(ticket);await kv.del('support:'+ticketId)}else keepSupport.push(ticketId);
  }
  await kv.set('support:index',keepSupport);
  const audit=await kv.get('audit:'+id)||[];
  if(retainedSupport.length)await kv.set('retention:support:'+id,{workspaceId:id,tickets:retainedSupport,retainedAt:Date.now()},{ex:60*60*24*365*2});
  if(Array.isArray(audit)&&audit.length)await kv.set('retention:audit:'+id,{workspaceId:id,events:audit,retainedAt:Date.now()},{ex:60*60*24*365*2});
  const onboardingToken=await kv.get('onboarding:workspace-token:'+id);
  await Promise.all([
    'workspace:','agent:','calls:','leads:','conversations:','appointments:','automations:',
    'settings:','integrations:','locations:','routing-request:','onboarding:workspace:',
    'onboarding:workspace-token:','provisioning:override:','provisioning:history:','audit:'
  ].map(prefix=>kv.del(prefix+id)));
  if(onboardingToken)await kv.del('onboarding:'+onboardingToken);
  return res.status(200).json({ok:true,purged:{id,name:ws.name||'Workspace'},retainedUntil:Date.now()+60*60*24*365*7*1000});
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
    const [settings,agent,onboarding,routing]=await Promise.all([
      kv.get('settings:'+id),kv.get('agent:'+id),kv.get('onboarding:workspace:'+id),kv.get('routing-request:'+id)
    ]);
    const hasIntake=!!(onboarding?.checklist?.intake||(settings&&((settings.businessName||'').trim()||(settings.primaryEmail||'').trim())));
    const hasAgent=!!(onboarding?.checklist?.agentDraft||(agent&&((agent.name||'').trim()||(agent.openingMessage||'').trim())));
    const hasPhone=!!String(ws.phone||'').trim();
    const checklist={
      payment:onboarding?.checklist?.payment!==false,
      accountReview:!!onboarding?.checklist?.accountReview,
      onboardingSent:!!onboarding?.checklist?.onboardingSent,
      agreement:!!onboarding?.checklist?.agreement,
      intake:!!onboarding?.checklist?.intake,
      businessProfile:!!onboarding?.checklist?.businessProfile,
      agentDraft:!!onboarding?.checklist?.agentDraft,
      routingCaptured:!!(onboarding?.checklist?.routingCaptured||routing?.routingChoice),
      phoneAssigned:hasPhone,
      adminReview:!!onboarding?.checklist?.adminReview,
      testCall:!!onboarding?.checklist?.testCall,
      clientApproval:!!onboarding?.checklist?.clientApproval,
      live:!!onboarding?.checklist?.live
    };
    let autoStage='Paid';
    if(onboarding?.status==='awaiting_review')autoStage='Review';
    else if(['awaiting_agreement','intake_in_progress'].includes(onboarding?.status)||checklist.onboardingSent&&!checklist.intake)autoStage='Intake';
    else if(onboarding?.status==='building_review'||checklist.intake&&!checklist.adminReview)autoStage='Building';
    else if(onboarding?.status==='qa_complete'||checklist.adminReview&&!checklist.testCall)autoStage='QA';
    else if(onboarding?.status==='client_test'||checklist.testCall&&!checklist.clientApproval)autoStage='Client Test';
    else if(onboarding?.status==='ready'||checklist.clientApproval&&!checklist.live)autoStage='Ready';
    if(checklist.live||onboarding?.status==='live')autoStage='Live';
    const override=await kv.get('provisioning:override:'+id);
    const allowedStages=['Paid','Review','Intake','Building','QA','Client Test','Ready','Live'];
    const stage=override&&allowedStages.includes(override.stage)?override.stage:autoStage;
    const doneCount=Object.values(checklist).filter(Boolean).length,totalCount=Object.keys(checklist).length;
    items.push({
      id:ws.id,name:ws.name||'Unnamed workspace',plan:ws.plan||'Starter',status:ws.status||'active',
      stage,autoStage,manualOverride:!!override,stageUpdatedAt:override&&override.updatedAt||null,
      hasIntake,hasAgent,hasPhone,phone:ws.phone||'',checklist,
      checklistDone:doneCount,checklistTotal:totalCount,
      completionPercent:Number(onboarding?.completionPercent||0),
      onboardingStatus:onboarding?.status||'paid',
      reviewEligibleAt:onboarding?.reviewEligibleAt||null,
      onboardingLinkSent:!!onboarding?.onboardingLinkSent,
      onboardingSentAt:onboarding?.onboardingSentAt||null,
      buildEligibleAt:onboarding?.buildEligibleAt||null,
      adminReviewedAt:onboarding?.adminReviewedAt||null,
      agreementVersion:onboarding?.agreementVersion||'',
      agreementSignedAt:onboarding?.agreementSignedAt||null,
      agreementSignedName:onboarding?.agreementSignedName||'',
      website:onboarding?.website||settings?.website||'',
      websiteScan:onboarding?.websiteScan||null,
      routing:routing||null,
      intakeCompletedAt:onboarding?.intakeCompletedAt||null
    });
  }
  return res.status(200).json({provisioning:items});
}

async function adminSaveProvisioningStage(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),stage=String(body.stage||'');
  const allowed=['Paid','Review','Intake','Building','QA','Client Test','Ready','Live'];
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
  const smsEnabled=process.env.CALLERCORE_SMS_ENABLED==='true'&&body.smsEnabled!==false;
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
  const ticket={id,workspaceId:s.workspaceId,workspaceName:ws.name||'Workspace',email:s.email,subject,message,priority,status:'open',messages:[{id:crypto.randomUUID(),direction:'client',from:s.email,body:message,at:now}],createdAt:now,updatedAt:now};
  await kv.set('support:'+id,ticket);
  const index=await kv.get('support:index')||[];const list=Array.isArray(index)?index:[];
  await kv.set('support:index',[id,...list.filter(x=>x!==id)].slice(0,500));
  const [platform,clientSettings]=await Promise.all([kv.get('platform:settings'),kv.get('settings:'+s.workspaceId)]);
  const supportTo=platform?.supportEmail||process.env.SUPPORT_EMAIL||process.env.MAILGUN_TO_EMAIL||'';
  if(supportTo){try{await sendMail({to:supportTo,subject:'CallerCore support · '+subject,text:'Workspace: '+ticket.workspaceName+'\nFrom: '+s.email+'\nPriority: '+priority+'\nTicket: '+id+'\n\n'+message})}catch(err){console.error('support email failed',safeError(err))}}
  if(s.email&&clientSettings?.emailAlerts!==false&&clientSettings?.notifySupport!==false){
    try{
      const firstName=String(ws.ownerName||clientSettings?.contactName||'').split(' ')[0]||'there';
      const emailBody=lifecycleEmail({
        preheader:'We received your CallerCore support request.',
        eyebrow:'SUPPORT REQUEST RECEIVED',
        title:'We’ve got your request, '+firstName+'.',
        intro:'Your CallerCore support request has been received and added to our queue.',
        statusLabel:'Ticket status',
        statusText:(priority==='urgent'?'Urgent · ':'')+'Open',
        bodyHtml:'<p style="margin:0 0 12px"><strong>'+escapeEmailHtml(subject)+'</strong></p><p style="margin:0">Reference: '+escapeEmailHtml(id.slice(0,8).toUpperCase())+'. Requests are reviewed during normal business hours, Monday–Friday, 9 AM–5 PM Pacific. You can reply to this email if there’s anything else we should know.</p>',
        ctaLabel:'View support requests',
        ctaUrl:requestOrigin(req)+'/dashboard',
        siteUrl:requestOrigin(req)
      });
      await sendMail({to:s.email,subject:'We received your CallerCore support request',...emailBody});
    }catch(err){console.error('support client acknowledgement failed',safeError(err))}
  }
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


async function replySupportTicket(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),message=String(body.message||'').trim().slice(0,4000);
  if(!id||message.length<2)return res.status(400).json({error:'Reply is required'});
  const key='support:'+id,t=await kv.get(key);if(!t||t.workspaceId!==s.workspaceId)return res.status(404).json({error:'Support request not found'});
  const now=Date.now(),messages=Array.isArray(t.messages)?t.messages.slice():[{id:crypto.randomUUID(),direction:'client',from:t.email||s.email,body:t.message||'',at:t.createdAt||now}];
  messages.push({id:crypto.randomUUID(),direction:'client',from:s.email,body:message,at:now});
  const next={...t,messages:messages.slice(-100),status:t.status==='resolved'?'open':t.status,updatedAt:now,updatedBy:s.email};
  await kv.set(key,next);
  const platform=await kv.get('platform:settings')||{},to=platform.supportEmail||process.env.SUPPORT_EMAIL||process.env.MAILGUN_TO_EMAIL||'';
  if(to){try{await sendMail({to,subject:'CallerCore support reply · '+t.subject,text:'Workspace: '+(t.workspaceName||'Workspace')+'\nFrom: '+s.email+'\n\n'+message})}catch(err){console.error('support reply email failed',safeError(err))}}
  return res.status(200).json({ok:true,ticket:next});
}

async function adminSupport(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const index=await kv.get('support:index')||[],tickets=[];
  for(const id of Array.isArray(index)?index.slice(0,250):[]){const t=await kv.get('support:'+id);if(t)tickets.push(t)}
  return res.status(200).json({tickets});
}


async function adminSupportReply(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),message=String(body.message||'').trim().slice(0,4000);
  if(!id||message.length<2)return res.status(400).json({error:'Reply is required'});
  const key='support:'+id,t=await kv.get(key);if(!t)return res.status(404).json({error:'Ticket not found'});
  const now=Date.now(),messages=Array.isArray(t.messages)?t.messages.slice():[{id:crypto.randomUUID(),direction:'client',from:t.email||'',body:t.message||'',at:t.createdAt||now}];
  messages.push({id:crypto.randomUUID(),direction:'support',from:admin.email,body:message,at:now});
  const next={...t,messages:messages.slice(-100),status:t.status==='open'?'in_progress':t.status,updatedAt:now,updatedBy:admin.email};
  await kv.set(key,next);
  if(t.email){
    const clientSettings=await kv.get('settings:'+t.workspaceId)||{};
    if(clientSettings.emailAlerts!==false&&clientSettings.notifySupport!==false){
      try{
        const emailBody=lifecycleEmail({
          preheader:'CallerCore support replied to your request.',
          eyebrow:'SUPPORT UPDATE',
          title:'We replied to your support request.',
          intro:'There’s a new response on “'+escapeEmailHtml(t.subject||'your support request')+'”.',
          statusLabel:'Support status',
          statusText:String(next.status||'in_progress').replace('_',' '),
          bodyHtml:'<div style="padding:14px 16px;border-left:3px solid #D2673C;background:#FFF8F4;border-radius:8px">'+escapeEmailHtml(message).replace(/\n/g,'<br>')+'</div><p style="margin:16px 0 0">You can reply directly to this email or continue the conversation from Help & Support in your CallerCore dashboard.</p>',
          ctaLabel:'Open support',
          ctaUrl:requestOrigin(req)+'/dashboard',
          siteUrl:requestOrigin(req)
        });
        await sendMail({to:t.email,subject:'CallerCore support replied · '+t.subject,...emailBody});
      }catch(err){console.error('support client reply email failed',safeError(err))}
    }
  }
  await appendAudit(t.workspaceId,{actorEmail:admin.email,actorRole:'admin',action:'support_reply',section:'support',meta:{ticketId:id}});
  return res.status(200).json({ok:true,ticket:next});
}

async function adminSupportUpdate(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),status=String(body.status||'');
  if(!id||!['open','in_progress','resolved'].includes(status))return res.status(400).json({error:'Invalid support update'});
  const key='support:'+id,t=await kv.get(key);if(!t)return res.status(404).json({error:'Ticket not found'});
  const previousStatus=t.status||'open',next={...t,status,updatedAt:Date.now(),updatedBy:admin.email};await kv.set(key,next);
  if(t.email&&status!==previousStatus){
    const clientSettings=await kv.get('settings:'+t.workspaceId)||{};
    if(clientSettings.emailAlerts!==false&&clientSettings.notifySupport!==false&&(status==='in_progress'||status==='resolved')){
      try{
        const resolved=status==='resolved',label=resolved?'Resolved':'In progress';
        const emailBody=lifecycleEmail({
          preheader:resolved?'Your CallerCore support request has been resolved.':'Your CallerCore support request is being worked on.',
          eyebrow:resolved?'SUPPORT RESOLVED':'SUPPORT UPDATE',
          title:resolved?'Your support request is marked resolved.':'We’re working on your support request.',
          intro:resolved?'We’ve marked “'+escapeEmailHtml(t.subject||'your support request')+'” as resolved.':'Your request “'+escapeEmailHtml(t.subject||'support request')+'” is now in progress.',
          statusLabel:'Status',statusText:label,
          bodyHtml:resolved?'<p style="margin:0">If anything is still unresolved, reply to this email or reopen the conversation from Help & Support in your CallerCore dashboard.</p>':'<p style="margin:0">No action is required unless we contact you for more information. You can reply to this email or add information from Help & Support in your dashboard.</p>',
          ctaLabel:'Open support',ctaUrl:requestOrigin(req)+'/dashboard',siteUrl:requestOrigin(req)
        });
        await sendMail({to:t.email,subject:'CallerCore support update · '+label,...emailBody});
      }catch(err){console.error('support status email failed',safeError(err))}
    }
  }
  await appendAudit(t.workspaceId,{actorEmail:admin.email,actorRole:'admin',action:'support_status_update',section:'support',meta:{ticketId:id,from:previousStatus,to:status}});
  return res.status(200).json({ok:true,ticket:next});
}

const LAUNCH_GATE_DEFS=[
  {key:'previewIsolation',name:'Preview data isolation',detail:'Preview KV/storage is confirmed separate from Production before destructive E2E testing'},
  {key:'disposableE2E',name:'Disposable-client E2E',detail:'A complete authenticated customer journey has passed in the isolated test environment'},
  {key:'voiceLifecycle',name:'Voice lifecycle validation',detail:'Voice assistant, phone number, authenticated webhooks, calls, transfers, transcripts, duration/cost and usage flow have passed end-to-end'},
  {key:'productionEnvScope',name:'Production environment scope',detail:'Production and Preview secrets/storage bindings have been reviewed and intentionally scoped'},
  {key:'supportEmail',name:'Support email verification',detail:'support@callercore.com inbound and outbound delivery has been verified'},
  {key:'businessTax',name:'Business / tax readiness',detail:'Operating entity, Washington registration/classification and required tax setup are confirmed'},
  {key:'legalReview',name:'Legal / compliance review',detail:'Launch legal documents and recording/communications policies have completed owner/legal review'}
];
function launchGateState(saved={}){
  const raw=saved&&typeof saved==='object'?saved:{};
  return Object.fromEntries(LAUNCH_GATE_DEFS.map(x=>[x.key,!!raw[x.key]]));
}

async function adminPlatformSettings(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const saved=await kv.get('platform:settings')||{};
  return res.status(200).json({settings:{supportEmail:saved.supportEmail||process.env.SUPPORT_EMAIL||'',defaultAgentName:saved.defaultAgentName||'Maya',defaultTimezone:saved.defaultTimezone||'America/Los_Angeles',maintenanceMode:!!saved.maintenanceMode,launchGates:launchGateState(saved.launchGates),updatedAt:saved.updatedAt||null}});
}

async function adminPlatformSettingsSave(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},supportEmail=cleanEmail(body.supportEmail),defaultAgentName=String(body.defaultAgentName||'Maya').trim().slice(0,80),defaultTimezone=String(body.defaultTimezone||'America/Los_Angeles').trim().slice(0,100);
  if(supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))return res.status(400).json({error:'Valid support email required'});
  const previous=await kv.get('platform:settings')||{},launchGates=body.launchGates&&typeof body.launchGates==='object'?launchGateState(body.launchGates):launchGateState(previous.launchGates);
  const settings={supportEmail,defaultAgentName:defaultAgentName||'Maya',defaultTimezone,maintenanceMode:!!body.maintenanceMode,launchGates,updatedAt:Date.now(),updatedBy:admin.email};
  await kv.set('platform:settings',settings);
  const changedGates=LAUNCH_GATE_DEFS.filter(g=>!!launchGateState(previous.launchGates)[g.key]!==!!launchGates[g.key]).map(g=>({key:g.key,from:!!launchGateState(previous.launchGates)[g.key],to:!!launchGates[g.key]}));
  if(changedGates.length)await appendAudit(admin.workspaceId,{actorEmail:admin.email,actorRole:'admin',action:'platform_launch_gates_update',section:'platform',before:launchGateState(previous.launchGates),after:launchGates,meta:{changedGates}});
  return res.status(200).json({ok:true,settings});
}






async function validatedGmailFrom(adminEmail,requested=''){
  const conn=await getGmailConnection(adminEmail);
  if(!conn)return '';
  const aliases=await listGmailAliases(adminEmail);
  const wanted=String(requested||'').trim().toLowerCase();
  if(!wanted)return (aliases.find(a=>a.isDefault&&a.verificationStatus!=='pending')||aliases.find(a=>a.isPrimary)||{}).email||conn.gmailEmail||adminEmail;
  const match=aliases.find(a=>a.email===wanted&&(a.isPrimary||a.verificationStatus==='accepted'));
  if(!match)throw new Error('Selected From address is not an accepted Gmail send-as alias');
  return match.email;
}

async function adminGmailStatus(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const conn=await getGmailConnection(admin.email);
  return res.status(200).json({configured:gmailConfigReady(),connected:!!conn,gmailEmail:conn?.gmailEmail||'',connectedAt:conn?.connectedAt||null});
}
async function adminGmailConnect(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  if(!gmailConfigReady())return res.status(409).json({error:'Google OAuth is not configured yet'});
  const state=crypto.randomBytes(24).toString('hex'),redirectUri=requestOrigin(req)+'/api/google-oauth-callback';
  await kv.set('oauth:gmail:'+state,{adminEmail:admin.email,redirectUri,createdAt:Date.now()},{ex:10*60});
  return res.status(200).json({url:getGmailOauthUrl({state,redirectUri})});
}
async function adminGmailDisconnect(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  await disconnectGmail(admin.email);return res.status(200).json({ok:true});
}
async function adminGmailInbox(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  if(!gmailConfigReady())return res.status(200).json({configured:false,connected:false,threads:[],analytics:{}});
  const hash=crypto.createHash('sha256').update(String(admin.email||'').toLowerCase()).digest('hex'),cacheKey='gmail:inbox:'+hash,summaryKey='gmail:summary:'+hash;
  const cached=await kv.get(cacheKey),force=String(req.query?.force||'')==='1';
  if(String(req.query?.cached||'')==='1'){
    return res.status(200).json(cached?{configured:true,...cached,cached:true}:{configured:true,connected:true,threads:[],analytics:{},cached:true,emptyCache:true});
  }
  if(!force&&cached&&Date.now()-Number(cached.syncedAt||0)<2*60*1000){
    return res.status(200).json({configured:true,...cached,cached:true,fresh:true});
  }
  try{
    const data=await listGmailInbox(admin.email,{maxResults:Math.min(25,Math.max(1,Number(req.query?.limit||25))),query:String(req.query?.q||'newer_than:30d').slice(0,200)});
    for(const t of data.threads||[]){
      const inbound=(t.messages||[]).find(m=>m.direction==='inbound'),sender=inbound?.from||'';
      if(sender){const pid=await kv.get('site:prospect:email:'+emailKey(sender));if(pid){const p=await kv.get('site:prospect:'+pid);if(p)t.prospect={id:p.id,name:p.name,business:p.business,email:p.email,stage:p.stage}}}
    }
    const snapshot={...data,syncedAt:Date.now()};
    await Promise.all([
      kv.set(cacheKey,snapshot,{ex:60*60*24*7}),
      kv.set(summaryKey,{analytics:data.analytics||{},syncedAt:snapshot.syncedAt},{ex:60*60*24*7})
    ]);
    return res.status(200).json({configured:true,...snapshot,cached:false});
  }catch(err){
    console.error('gmail inbox failed',safeError(err));
    if(cached)return res.status(200).json({configured:true,...cached,cached:true,stale:true,warning:'Fresh Gmail sync failed'});
    return res.status(502).json({error:'Gmail sync failed'})
  }
}


async function adminGmailAliases(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const conn=await getGmailConnection(admin.email);if(!conn)return res.status(200).json({connected:false,aliases:[]});
  const hash=crypto.createHash('sha256').update(String(admin.email||'').toLowerCase()).digest('hex'),cacheKey='gmail:aliases:'+hash;
  const aliasCache=await kv.get(cacheKey),cachedAliases=Array.isArray(aliasCache)?aliasCache:(aliasCache?.aliases||[]),aliasCachedAt=Number(aliasCache?.cachedAt||0),force=String(req.query?.force||'')==='1';
  if(String(req.query?.cached||'')==='1'){
    return res.status(200).json({connected:true,gmailEmail:conn.gmailEmail||'',aliases:cachedAliases,cached:true});
  }
  if(!force&&cachedAliases.length&&aliasCachedAt&&Date.now()-aliasCachedAt<6*60*60*1000){
    return res.status(200).json({connected:true,gmailEmail:conn.gmailEmail||'',aliases:cachedAliases,cached:true,fresh:true});
  }
  try{
    const aliases=await listGmailAliases(admin.email);
    await kv.set(cacheKey,{aliases,cachedAt:Date.now()},{ex:60*60*24*7});
    return res.status(200).json({connected:true,gmailEmail:conn.gmailEmail||'',aliases,cached:false});
  }catch(err){
    console.error('gmail aliases failed',safeError(err));
    if(cachedAliases.length)return res.status(200).json({connected:true,gmailEmail:conn.gmailEmail||'',aliases:cachedAliases,cached:true,stale:true});
    return res.status(502).json({error:'Could not load Gmail aliases'})
  }
}

async function adminGmailRead(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.body||{}).threadId||'').slice(0,120);if(!id)return res.status(400).json({error:'Thread id required'});
  try{await markGmailThreadRead(admin.email,id);return res.status(200).json({ok:true})}
  catch(err){console.error('gmail mark read failed',safeError(err));return res.status(502).json({error:'Could not update Gmail thread'})}
}

async function adminGmailSend(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const b=req.body||{},to=String(b.to||'').trim().toLowerCase(),subject=String(b.subject||'').trim().slice(0,300),body=String(b.body||'').trim().slice(0,20000),requestedFrom=String(b.from||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!subject||!body)return res.status(400).json({error:'Valid recipient, subject, and message required'});
  try{
    const from=await validatedGmailFrom(admin.email,requestedFrom);const sent=await sendGmailMessage(admin.email,{to,subject,body,from,threadId:String(b.threadId||''),inReplyTo:String(b.inReplyTo||''),references:String(b.references||'')});
    return res.status(200).json({ok:true,id:sent.id||'',threadId:sent.threadId||b.threadId||''});
  }catch(err){console.error('gmail send failed',safeError(err));return res.status(502).json({error:'Could not send Gmail message'})}
}

async function adminWebsiteConversation(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.query||{}).id||'').slice(0,100);
  if(!id)return res.status(400).json({error:'Prospect id required'});
  const prospect=await kv.get('site:prospect:'+id);if(!prospect)return res.status(404).json({error:'Prospect not found'});
  const messages=await kv.get('site:conversation:'+id)||[];
  return res.status(200).json({prospect,messages:Array.isArray(messages)?messages:[]});
}
async function adminWebsiteReply(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,100),message=String(body.message||'').trim().slice(0,10000),requestedFrom=String(body.from||'').trim().toLowerCase();
  if(!id||!message)return res.status(400).json({error:'Prospect and reply message required'});
  const key='site:prospect:'+id,prospect=await kv.get(key);if(!prospect)return res.status(404).json({error:'Prospect not found'});
  const to=String(prospect.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return res.status(409).json({error:'This prospect has no valid email address'});
  const subject='Re: '+(prospect.category||'Your CallerCore inquiry');
  let channel='mailgun',from='support@callercore.com';
  try{
    const gmail=await getGmailConnection(admin.email);
    if(gmail){
      from=await validatedGmailFrom(admin.email,requestedFrom);await sendGmailMessage(admin.email,{to,subject,body:message,from});
      channel='gmail';
    }else{
      await sendMail({to,subject,text:message,html:'<p>'+message.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])).replace(/\n/g,'<br>')+'</p>'});
    }
  }catch(err){console.error('website reply failed',safeError(err));return res.status(502).json({error:'Unable to send reply'})}
  const convKey='site:conversation:'+id,conversation=await kv.get(convKey)||[];
  const item={id:crypto.randomUUID(),direction:'outbound',channel,from,to,subject,body:message,actorEmail:admin.email,at:Date.now()};
  const next=Array.isArray(conversation)?conversation:[];
  next.push(item);await kv.set(convKey,next.slice(-200));
  const updated={...prospect,stage:prospect.stage==='new'||prospect.stage==='inquiry'?'follow_up':prospect.stage,lastRepliedAt:Date.now(),updatedAt:Date.now(),updatedBy:admin.email};
  await kv.set(key,updated);
  return res.status(200).json({ok:true,message:item,prospect:updated});
}

async function adminWebsiteAnalytics(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  try{
    const [eventsRaw,sessionIds,prospectIds]=await Promise.all([
      kv.lrange('site:events',0,4999),kv.lrange('site:session:index',0,999),kv.lrange('site:prospect:index',0,999)
    ]);
    const events=Array.isArray(eventsRaw)?eventsRaw.filter(Boolean):[];
    const sessions=(await Promise.all((Array.isArray(sessionIds)?sessionIds:[]).slice(0,500).map(id=>kv.get('site:session:'+id)))).filter(Boolean);
    const prospects=(await Promise.all((Array.isArray(prospectIds)?prospectIds:[]).slice(0,1000).map(id=>kv.get('site:prospect:'+id)))).filter(Boolean).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const now=Date.now(),cut30=now-30*24*60*60*1000,cut7=now-7*24*60*60*1000;
    const s30=sessions.filter(s=>(s.firstAt||0)>=cut30),e30=events.filter(e=>(e.at||0)>=cut30),e7=events.filter(e=>(e.at||0)>=cut7);
    const uniqueVisitors=new Set(s30.map(s=>s.visitorId).filter(Boolean)).size;
    const pageViews=e30.filter(e=>e.type==='page_view').length;
    const avgActive=s30.length?Math.round(s30.reduce((n,s)=>n+Number(s.activeMs||0),0)/s30.length/1000):0;
    const bounced=s30.filter(s=>(s.pages||[]).length<=1&&Number(s.activeMs||0)<15000).length;
    const bounceRate=s30.length?Math.round((bounced/s30.length)*100):0;
    const uniqueEventSessions=(type,label='')=>new Set(e30.filter(e=>e.type===type&&(!label||e.label===label)).map(e=>e.sessionId).filter(Boolean)).size;
    const funnel={
      visitors:s30.length,
      getStarted:new Set(e30.filter(e=>e.type==='page_view'&&String(e.path||'').startsWith('/get-started')).map(e=>e.sessionId).filter(Boolean)).size,
      formStarted:uniqueEventSessions('form_start','startForm'),
      checkoutStarted:uniqueEventSessions('checkout_start'),
      converted:prospects.filter(p=>p.stage==='converted'&&(p.updatedAt||0)>=cut30).length
    };
    const pageMap={},sourceMap={},conversionMap={};
    e30.filter(e=>e.type==='page_view').forEach(e=>{const p=String(e.path||'/').split('?')[0];pageMap[p]=pageMap[p]||{count:0,totalMs:0,exits:0};pageMap[p].count++});
    e30.filter(e=>e.type==='page_exit').forEach(e=>{const p=String(e.path||'/').split('?')[0];pageMap[p]=pageMap[p]||{count:0,totalMs:0,exits:0};pageMap[p].totalMs+=Number(e.activeMs||0);pageMap[p].exits++});
    s30.forEach(s=>{const source=s.utmSource||s.source||'direct';sourceMap[source]=(sourceMap[source]||0)+1});
    prospects.filter(p=>p.stage==='converted'&&Number(p.convertedAt||p.updatedAt||0)>=cut30).forEach(p=>{
      const source=p.firstUtmSource||p.utmSource||p.firstSource||p.source||'direct',row=conversionMap[source]||(conversionMap[source]={conversions:0,mrr:0,setupRevenue:0});
      row.conversions++;row.mrr+=Number(p.monthlyValue||0);row.setupRevenue+=Number(p.setupValue||0);
    });
    const topPages=Object.entries(pageMap).sort((a,b)=>b[1].count-a[1].count).slice(0,10).map(([path,v])=>({path,count:v.count,avgSeconds:v.exits?Math.round(v.totalMs/v.exits/1000):0}));
    const sourceNames=[...new Set([...Object.keys(sourceMap),...Object.keys(conversionMap)])];
    const sources=sourceNames.map(source=>({source,count:sourceMap[source]||0,...(conversionMap[source]||{conversions:0,mrr:0,setupRevenue:0})})).sort((a,b)=>(b.mrr-a.mrr)||(b.count-a.count)).slice(0,10);
    const attributedMrr=Object.values(conversionMap).reduce((n,x)=>n+Number(x.mrr||0),0),attributedSetupRevenue=Object.values(conversionMap).reduce((n,x)=>n+Number(x.setupRevenue||0),0);
    const eventBySession={};e30.forEach(e=>{if(!e.sessionId)return;(eventBySession[e.sessionId]||(eventBySession[e.sessionId]=[])).push(e)});
    const recentSessions=sessions.sort((a,b)=>(b.lastAt||0)-(a.lastAt||0)).slice(0,60).map(s=>({
      ...s,journey:(eventBySession[s.id]||[]).sort((a,b)=>(a.at||0)-(b.at||0)).slice(-40).map(e=>({type:e.type,at:e.at,path:e.path,label:e.label,value:e.value,activeMs:e.activeMs}))
    }));
    return res.status(200).json({analytics:{
      periodDays:30,sessions:s30.length,visitors:uniqueVisitors,pageViews,avgActiveSeconds:avgActive,bounceRate,
      contactInquiries:e30.filter(e=>e.type==='contact_submit').length,chatSessions:uniqueEventSessions('chat_open'),
      formAbandons:uniqueEventSessions('form_abandon'),checkoutStarts:uniqueEventSessions('checkout_start'),
      checkoutAbandoned:prospects.filter(p=>p.stage==='checkout_started').length,conversions:funnel.converted,
      attributedMrr,attributedSetupRevenue,last7Events:e7.length,funnel,topPages,sources,recentSessions,prospects
    }});
  }catch(err){console.error('admin website analytics failed',safeError(err));return res.status(500).json({error:'Website analytics unavailable'})}
}
async function adminWebsiteProspectUpdate(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,100),key='site:prospect:'+id,old=await kv.get(key);
  if(!old)return res.status(404).json({error:'Website prospect not found'});
  const allowed=['new','inquiry','checkout_started','follow_up','qualified','lost','converted'];
  const stage=body.stage!==undefined?String(body.stage):old.stage;
  if(!allowed.includes(stage))return res.status(400).json({error:'Invalid prospect stage'});
  const next={...old,stage,notes:body.notes!==undefined?String(body.notes||'').trim().slice(0,3000):(old.notes||''),updatedAt:Date.now(),updatedBy:admin.email};
  await kv.set(key,next);
  return res.status(200).json({ok:true,prospect:next});
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
  {const emailBody=authEmail({
    preheader:'CallerCore support sent you a secure sign-in link.',
    title:'Your secure sign-in link',
    intro:'CallerCore support created a secure sign-in link for your account.',
    statusLabel:'Security',
    statusText:'This link expires in 15 minutes and can only be used once.',
    bodyHtml:'<p style="margin:0">If you did not request help signing in, you can ignore this email.</p>',
    ctaLabel:'Sign in to CallerCore',
    ctaUrl:link,
    siteUrl:requestOrigin(req)
  });await sendMail({to:email,subject:'Your CallerCore sign-in link',...emailBody});}
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
    if(value.ownerEmail!==undefined&&cleanEmail(value.ownerEmail)!==cleanEmail(current.ownerEmail))throw new Error('Owner email is protected. Use Repair access mapping instead.');
    if(value.phone!==undefined&&String(value.phone||'')!==String(current.phone||''))throw new Error('CallerCore phone assignment is protected. Use Phone Numbers instead.');
    if(value.plan!==undefined&&value.plan!==current.plan&&current.stripeSubscriptionId)throw new Error('Plan is managed by Stripe for this workspace.');
    const safe={...current};
    for(const k of ['name','ownerName','industry','status','plan','usage'])if(value[k]!==undefined)safe[k]=value[k];
    if(!['Starter','Growth','Pro'].includes(safe.plan))throw new Error('Invalid plan');
    if(!['active','onboarding','suspended'].includes(safe.status))throw new Error('Invalid status');
    safe.id=current.id;safe.ownerEmail=current.ownerEmail;safe.phone=current.phone;safe.updatedAt=Date.now();return safe;
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



async function adminSendOnboardingInvite(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String(req.body?.id||'').slice(0,80);if(!id)return res.status(400).json({error:'Client is required'});
  const [ws,state,token]=await Promise.all([
    kv.get('workspace:'+id),kv.get('onboarding:workspace:'+id),kv.get('onboarding:workspace-token:'+id)
  ]);
  if(!ws||!state||!token)return res.status(404).json({error:'Onboarding record not found'});
  if(state.onboardingLinkSent)return res.status(200).json({ok:true,alreadySent:true});
  if(Number(state.reviewEligibleAt||0)>Date.now())return res.status(409).json({error:'This account is still in the post-payment review hold.',eligibleAt:state.reviewEligibleAt});
  const onboarding=await kv.get('onboarding:'+token),to=String(onboarding?.email||ws.ownerEmail||'').trim().toLowerCase();
  if(!to)return res.status(400).json({error:'Client email is missing'});
  const link=requestOrigin(req)+'/onboarding?token='+token,firstName=String(onboarding?.name||ws.ownerName||'').split(' ')[0]||'there';
  {const emailBody=lifecycleEmail({
    preheader:'Your CallerCore onboarding workspace is ready.',
    eyebrow:'ONBOARDING READY',
    title:'Your setup workspace is ready, '+firstName+'.',
    intro:'We’ve reviewed your CallerCore account and prepared your secure onboarding workspace.',
    statusLabel:'Next step',
    statusText:'Complete your service agreement and business intake.',
    bodyHtml:'<p style="margin:0 0 12px">Your progress saves automatically, so you can stop and come back if needed.</p><p style="margin:0">Once submitted, CallerCore will prepare your initial business profile, AI-agent configuration, routing preferences, and launch checklist for review.</p>',
    ctaLabel:'Open onboarding',
    ctaUrl:link,
    siteUrl:requestOrigin(req),
    showDashboardSupport:false
  });await sendMail({to,subject:'Your CallerCore onboarding is ready',...emailBody});}
  const next={...state,status:'awaiting_agreement',onboardingLinkSent:true,onboardingSentAt:Date.now(),reviewedAt:Date.now(),reviewedBy:admin.email,checklist:{...(state.checklist||{}),accountReview:true,onboardingSent:true},updatedAt:Date.now()};
  await kv.set('onboarding:workspace:'+id,next);
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'onboarding_invite_sent',section:'workspace',meta:{to}});
  return res.status(200).json({ok:true,onboarding:next});
}

async function adminProvisioningChecklistSave(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const body=req.body||{},id=String(body.id||'').slice(0,80),field=String(body.field||''),value=body.value===true;
  const allowed=new Set(['adminReview','testCall','clientApproval','live']);
  if(!id||!allowed.has(field))return res.status(400).json({error:'Invalid provisioning checklist update'});
  const wsKey='workspace:'+id,ws=await kv.get(wsKey);if(!ws)return res.status(404).json({error:'Client not found'});
  const key='onboarding:workspace:'+id,state=await kv.get(key)||{workspaceId:id,status:'building_review',completionPercent:100,checklist:{}};
  if(field==='adminReview'&&value&&Number(state.buildEligibleAt||0)>Date.now())return res.status(409).json({error:'The build is still in its review hold.',eligibleAt:state.buildEligibleAt});
  if(field==='live'&&value){
    const agent=await kv.get('agent:'+id);
    if(!agent||!String(agent.openingMessage||agent.name||'').trim())return res.status(409).json({error:'An AI agent must be configured before launch'});
    if(!String(ws.phone||'').trim())return res.status(409).json({error:'Assign a CallerCore phone number before launch'});
  }
  const next={...state,checklist:{...(state.checklist||{}),phoneAssigned:!!String(ws.phone||'').trim(),[field]:value},updatedAt:Date.now(),updatedBy:admin.email};
  const to=String(ws.ownerEmail||'').trim().toLowerCase(),firstName=String(ws.ownerName||'').split(' ')[0]||'there';
  if(field==='adminReview'&&value){
    next.status='qa_complete';next.adminReviewedAt=Date.now();
    if(to){const emailBody=lifecycleEmail({
      preheader:'Your CallerCore build passed its initial review.',
      eyebrow:'BUILD REVIEW COMPLETE',
      title:'Initial review complete, '+firstName+'.',
      intro:'We’ve completed the initial review of your CallerCore configuration.',
      statusLabel:'Current status',
      statusText:'Phone routing and test-call preparation are in progress.',
      bodyHtml:'<p style="margin:0">Your AI agent and business rules have been prepared from the information you submitted. No action is needed from you right now — we’ll let you know when the next step is ready.</p>',
      ctaLabel:'View setup progress',
      ctaUrl:requestOrigin(req)+'/dashboard',
      siteUrl:requestOrigin(req)
    });await sendMail({to,subject:'Your CallerCore build has passed our initial review',...emailBody});}
  }
  if(field==='testCall'&&value){
    next.status='client_test';next.testReadyAt=Date.now();
    if(to){const emailBody=lifecycleEmail({
      preheader:'Your CallerCore test stage is ready.',
      eyebrow:'TEST STAGE READY',
      title:'It’s time to test your CallerCore setup.',
      intro:'Your agent configuration has been reviewed and the test-call stage is ready.',
      statusLabel:'Action needed',
      statusText:'Review the setup and test experience before final launch preparation.',
      bodyHtml:'<p style="margin:0">Once everything sounds right, we’ll move into final launch preparation.</p>',
      ctaLabel:'Open test stage',
      ctaUrl:requestOrigin(req)+'/dashboard',
      siteUrl:requestOrigin(req)
    });await sendMail({to,subject:'Your CallerCore test stage is ready',...emailBody});}
  }
  if(field==='clientApproval'&&value){
    next.status='ready';next.clientApprovedAt=Date.now();
    if(to){const emailBody=lifecycleEmail({
      preheader:'Your CallerCore setup is in final launch preparation.',
      eyebrow:'FINAL LAUNCH PREPARATION',
      title:'Your setup is almost live.',
      intro:'Your test stage is complete and your CallerCore setup is now in final launch preparation.',
      statusLabel:'Current status',
      statusText:'Final routing and activation checks are underway.',
      bodyHtml:'<p style="margin:0">No action is needed right now. We’ll send you a confirmation as soon as your AI receptionist is live.</p>',
      ctaLabel:'View launch progress',
      ctaUrl:requestOrigin(req)+'/dashboard',
      siteUrl:requestOrigin(req)
    });await sendMail({to,subject:'CallerCore is preparing your launch',...emailBody});}
  }
  if(field==='live'&&value){
    next.checklist.adminReview=true;next.checklist.testCall=true;next.checklist.clientApproval=true;
    next.status='live';next.liveAt=Date.now();await kv.set(wsKey,{...ws,status:'active',updatedAt:Date.now()});
    if(to){const emailBody=lifecycleEmail({
      preheader:'Your CallerCore AI receptionist is now live.',
      eyebrow:'YOU’RE LIVE',
      title:'CallerCore is live, '+firstName+'.',
      intro:'Your AI receptionist is now active and your launch is complete.',
      statusLabel:'Status',
      statusText:'Live and ready to handle production traffic.',
      bodyHtml:'<p style="margin:0 0 12px">You can monitor calls, leads, conversations, routing, and setup details from your client dashboard.</p><p style="margin:0"><strong>Welcome aboard.</strong></p>',
      ctaLabel:'Open CallerCore dashboard',
      ctaUrl:requestOrigin(req)+'/dashboard',
      siteUrl:requestOrigin(req)
    });await sendMail({to,subject:'CallerCore is live',...emailBody});}
  }else if(field==='live'&&!value&&state.status==='live'){
    next.status='ready';await kv.set(wsKey,{...ws,status:'onboarding',updatedAt:Date.now()});
  }
  await kv.set(key,next);
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'provisioning_checklist',section:'workspace',meta:{field,value}});
  return res.status(200).json({ok:true,onboarding:next});
}

async function stripeConfigurationHealth(){
  const key=process.env.STRIPE_SECRET_KEY||'';
  if(!key)return {ok:false,webhook:false,portal:false,detail:'STRIPE_SECRET_KEY missing'};
  const headers={Authorization:'Bearer '+key};
  const expected=['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.payment_failed','invoice.paid'];
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
    try{
      const [whRes,portalRes]=await Promise.all([
        fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100',{headers,signal:controller.signal}),
        fetch('https://api.stripe.com/v1/billing_portal/configurations?active=true&limit=10',{headers,signal:controller.signal})
      ]);
      const [wh,portalData]=await Promise.all([whRes.json().catch(()=>({})),portalRes.json().catch(()=>({}))]);
      if(!whRes.ok||!portalRes.ok)return {ok:false,webhook:false,portal:false,detail:'Stripe configuration check failed'};
      const desiredUrl=(process.env.SITE_URL||'https://www.callercore.com').replace(/\/$/,'')+'/api/stripe-webhook';
      const endpoint=(Array.isArray(wh.data)?wh.data:[]).find(x=>x&&x.status==='enabled'&&x.url===desiredUrl);
      const enabled=new Set(Array.isArray(endpoint?.enabled_events)?endpoint.enabled_events:[]);
      const missing=expected.filter(e=>!enabled.has(e)&&!enabled.has('*'));
      const webhook=!!endpoint&&missing.length===0;
      const portal=Array.isArray(portalData.data)&&portalData.data.some(x=>x&&x.active!==false);
      return {ok:webhook&&portal,webhook,portal,missingEvents:missing,detail:!endpoint?'Stripe webhook endpoint not found/enabled':missing.length?('Stripe webhook missing: '+missing.join(', ')):!portal?'Stripe Customer Portal has no active configuration':'Stripe webhook and Customer Portal configured'};
    }finally{clearTimeout(timer)}
  }catch(err){
    return {ok:false,webhook:false,portal:false,detail:/aborted|timeout/i.test(String(err&&err.message||err))?'Stripe configuration check timed out':'Stripe configuration check unavailable'};
  }
}

function environmentScopeHealth(){
  const env=String(process.env.VERCEL_ENV||'').toLowerCase();
  const stripeSecret=String(process.env.STRIPE_SECRET_KEY||'');
  const stripePublishable=String(process.env.STRIPE_PUBLISHABLE_KEY||'');
  const issues=[];
  if(env==='preview'){
    if(/^sk_live_/.test(stripeSecret)||/^pk_live_/.test(stripePublishable))issues.push('Preview is using live Stripe credentials');
    if(process.env.CALLERCORE_CHECKOUT_ENABLED==='true')issues.push('Preview checkout launch gate is enabled');
  }
  if(env==='production'&&process.env.CALLERCORE_BOOTSTRAP_SECRET)issues.push('Preview bootstrap secret is present in Production');
  if(env&& !['production','preview','development'].includes(env))issues.push('Unexpected VERCEL_ENV value');
  return {ok:issues.length===0,env:env||'unknown',issues,detail:issues.length?issues.join('; '):('Environment scope checks passed for '+(env||'unknown'))};
}

async function adminSystemHealth(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const [kvHealth,stripeHealth,platformSettings]=await Promise.all([kvHealthCheck(),stripeConfigurationHealth(),kv.get('platform:settings')]),kvOk=kvHealth.ok,launchGates=launchGateState(platformSettings?.launchGates),envScope=environmentScopeHealth();
  const stripeEnv=!!(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PUBLISHABLE_KEY&&process.env.STRIPE_WEBHOOK_SECRET);
  const stripeReady=stripeEnv&&stripeHealth.ok;
  const services=[
    {key:'database',name:'Upstash / KV',status:kvOk?'operational':'error',detail:kvOk?'Read/write check passed':('Database check failed ('+kvHealth.error+')')},
    {key:'environment-scope',name:'Environment scope',status:envScope.ok?'operational':'error',detail:envScope.detail,meta:{environment:envScope.env,issueCount:envScope.issues.length}},
    {key:'checkout',name:'Sales / checkout',status:process.env.CALLERCORE_CHECKOUT_ENABLED==='true'?'operational':'not_configured',detail:process.env.CALLERCORE_CHECKOUT_ENABLED==='true'?'Customer checkout is enabled':'Checkout launch gate is closed'},
    {key:'stripe',name:'Stripe',status:stripeReady?'operational':(stripeEnv?'error':'not_configured'),detail:!stripeEnv?(!process.env.STRIPE_SECRET_KEY?'STRIPE_SECRET_KEY missing':(!process.env.STRIPE_PUBLISHABLE_KEY?'STRIPE_PUBLISHABLE_KEY missing':'STRIPE_WEBHOOK_SECRET missing')):stripeHealth.detail,meta:{webhook:stripeHealth.webhook,portal:stripeHealth.portal,missingEvents:stripeHealth.missingEvents||[]}},
    {key:'mailgun',name:'Mailgun',status:(process.env.MAILGUN_API_KEY&&process.env.MAILGUN_DOMAIN)?'configured':'not_configured',detail:(process.env.MAILGUN_API_KEY&&process.env.MAILGUN_DOMAIN)?'API credentials available':'Mailgun credentials incomplete'},
    {key:'demo',name:'Live demo protection',status:process.env.DEMO_TOKEN_SECRET?'configured':'not_configured',detail:process.env.DEMO_TOKEN_SECRET?'Demo reveal signing secret available':'DEMO_TOKEN_SECRET missing — live demo number reveal is disabled'},
    {key:'gmail',name:'Gmail / Google OAuth',status:gmailConfigReady()?'configured':'not_configured',detail:gmailConfigReady()?'OAuth credentials + token encryption available':'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or CALLERCORE_ENCRYPTION_KEY missing'},
    {key:'onboarding-ai',name:'Smart Onboarding AI',status:process.env.ANTHROPIC_API_KEY?'configured':'not_configured',detail:process.env.ANTHROPIC_API_KEY?'Website extraction and agent-draft model available':'ANTHROPIC_API_KEY missing'},
    {key:'voice',name:'Voice provider',status:(process.env.VAPI_API_KEY||process.env.VAPI_PRIVATE_KEY)?'configured':'not_configured',detail:(process.env.VAPI_API_KEY||process.env.VAPI_PRIVATE_KEY)?'Voice API credentials available; lifecycle validation is tracked separately':'Voice API credentials not configured'},
    ...LAUNCH_GATE_DEFS.map(g=>({key:'gate-'+g.key,name:g.name,status:launchGates[g.key]?'confirmed':'pending',detail:launchGates[g.key]?'Owner/admin confirmation recorded':g.detail,manual:true}))
  ];
  const requiredForLaunch=['database','environment-scope','checkout','stripe','mailgun','onboarding-ai','voice',...LAUNCH_GATE_DEFS.map(g=>'gate-'+g.key)];
  const blockers=services.filter(x=>requiredForLaunch.includes(x.key)&&!['operational','configured','confirmed'].includes(x.status));
  const readiness={ready:blockers.length===0,requiredForLaunch,blockers:blockers.map(x=>({key:x.key,name:x.name,detail:x.detail})),configured:services.filter(x=>['operational','configured','confirmed'].includes(x.status)).length,total:services.length};
  return res.status(200).json({services,readiness,checkedAt:Date.now()});
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


function notificationReadKey(scope,email,workspaceId=''){
  return 'notification:read:'+crypto.createHash('sha256').update(scope+'|'+String(email||'').toLowerCase()+'|'+workspaceId).digest('hex');
}
async function getNotificationReadSet(scope,email,workspaceId=''){
  const raw=await kv.get(notificationReadKey(scope,email,workspaceId))||[];
  return new Set(Array.isArray(raw)?raw:[]);
}
async function saveNotificationReadSet(scope,email,workspaceId,ids){
  const list=[...new Set(ids)].slice(-500);
  await kv.set(notificationReadKey(scope,email,workspaceId),list,{ex:60*60*24*365});
}
function notificationItem(id,{title='',body='',kind='info',view='overview',createdAt=Date.now(),meta={}}={}){
  return {id,title,body,kind,view,createdAt,meta};
}
async function buildClientNotifications(s){
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return [];
  const savedSettings=await kv.get('settings:'+ws.id)||{},prefs={
    billing:savedSettings.notifyBilling!==false,setup:savedSettings.notifySetup!==false,calls:savedSettings.notifyCalls!==false,support:savedSettings.notifySupport!==false,usage:savedSettings.notifyUsage!==false
  };
  const items=[],now=Date.now(),plan=entitlementsFor(ws.plan),usage=Number(ws.usage?.minutes||0);
  if(prefs.billing&&ws.subscriptionStatus==='past_due')items.push(notificationItem('billing:'+ws.id+':past_due',{title:'Billing needs attention',body:'Your CallerCore subscription is past due.',kind:'danger',view:'billing',createdAt:ws.updatedAt||now}));
  if(prefs.billing&&ws.subscriptionStatus==='canceled')items.push(notificationItem('billing:'+ws.id+':canceled',{title:'Subscription canceled',body:'Your CallerCore subscription is canceled.',kind:'danger',view:'billing',createdAt:ws.updatedAt||now}));
  if(prefs.support&&ws.status==='suspended')items.push(notificationItem('workspace:'+ws.id+':suspended',{title:'Workspace suspended',body:'Your CallerCore workspace is currently suspended. Contact support for help.',kind:'danger',view:'support',createdAt:ws.updatedAt||now}));
  if(prefs.setup&&ws.status==='onboarding')items.push(notificationItem('workspace:'+ws.id+':onboarding',{title:'Onboarding in progress',body:'CallerCore is still being configured for your business.',kind:'info',view:'overview',createdAt:ws.updatedAt||ws.createdAt||now}));
  const onboarding=await kv.get('onboarding:workspace:'+ws.id);
  if(prefs.setup&&onboarding?.status==='awaiting_review')items.push(notificationItem('onboarding:'+ws.id+':account-review',{title:'Account review in progress',body:'Payment is confirmed. CallerCore is reviewing your account before sending onboarding.',kind:'info',view:'overview',createdAt:onboarding.paidAt||onboarding.updatedAt||now}));
  if(prefs.setup&&onboarding?.checklist?.intake&&!onboarding?.checklist?.adminReview)items.push(notificationItem('onboarding:'+ws.id+':review',{title:'Your setup is being reviewed',body:'We received your onboarding and are reviewing the initial AI-agent configuration.',kind:'info',view:'overview',createdAt:onboarding.intakeCompletedAt||onboarding.updatedAt||now}));
  if(prefs.setup&&onboarding?.checklist?.adminReview&&!onboarding?.checklist?.testCall)items.push(notificationItem('onboarding:'+ws.id+':test',{title:'Next step: test call',body:'CallerCore has reviewed your setup. A test call is the next launch step.',kind:'info',view:'calls',createdAt:onboarding.updatedAt||now}));
  if(prefs.setup&&onboarding?.checklist?.live)items.push(notificationItem('onboarding:'+ws.id+':live',{title:'CallerCore is live',body:'Your AI receptionist setup is marked live.',kind:'success',view:'overview',createdAt:onboarding.updatedAt||now}));
  if(prefs.usage&&plan.minutes){
    const pct=Math.round((usage/plan.minutes)*100);
    const threshold=pct>=100?100:pct>=85?85:pct>=70?70:0;
    if(threshold){
      const title=threshold>=100?'Included minutes reached':threshold>=85?'Minutes usage at 85%':'Minutes usage at 70%';
      const body=usage+' of '+plan.minutes+' included minutes used.'+(threshold>=100?' This notice does not by itself mean an overage charge has been applied.':'');
      items.push(notificationItem('usage:'+ws.id+':'+threshold,{title,body,kind:threshold>=100?'danger':'warning',view:'billing',createdAt:now,meta:{usage,limit:plan.minutes,threshold}}));
    }
  }
  const [agent,numbers,calls,index]=await Promise.all([
    kv.get('agent:'+ws.id),kv.get('phone:index'),kv.get('calls:'+ws.id),kv.get('support:index')
  ]);
  const phone=(Array.isArray(numbers)?numbers:[]).find(x=>x&&x.workspaceId===ws.id);
  if(prefs.setup&&!agent)items.push(notificationItem('setup:'+ws.id+':agent',{title:'AI agent setup incomplete',body:'Your AI agent has not been configured yet.',kind:'warning',view:'agent',createdAt:ws.createdAt||now}));
  if(prefs.setup&&!phone)items.push(notificationItem('setup:'+ws.id+':phone',{title:'Phone routing not configured',body:'No CallerCore phone number is currently assigned.',kind:'warning',view:'phone-routing',createdAt:ws.createdAt||now}));
  const missed=(Array.isArray(calls)?calls:[]).filter(x=>/missed|failed/i.test(String(x.outcome||''))).slice(-8).reverse();
  if(prefs.calls)missed.forEach((x,i)=>{
    const id=String(x.id||x.callId||x.phone||i),at=Number(x.createdAt||x.at||x.timestamp||Date.now());
    items.push(notificationItem('call:'+id+':missed',{title:'Missed call',body:(x.caller||x.phone||'A caller')+' was not successfully handled.',kind:'warning',view:'calls',createdAt:at}));
  });
  for(const id of Array.isArray(index)?index.slice(0,100):[]){
    const t=await kv.get('support:'+id);if(!t||t.workspaceId!==ws.id)continue;
    if(prefs.support&&t.updatedAt&&t.updatedAt>t.createdAt){
      items.push(notificationItem('support:'+t.id+':'+t.status+':'+t.updatedAt,{title:'Support request updated',body:'“'+t.subject+'” is now '+String(t.status||'').replace('_',' ')+'.',kind:t.status==='resolved'?'success':'info',view:'support',createdAt:t.updatedAt}));
    }
  }
  return items;
}
async function buildAdminNotifications(admin){
  const items=[],now=Date.now();
  const [supportIndex,workspaceIndex,prospectIds,gmailConn]=await Promise.all([
    kv.get('support:index'),kv.get('workspace:index'),kv.lrange('site:prospect:index',0,99),getGmailConnection(admin.email)
  ]);
  for(const id of Array.isArray(supportIndex)?supportIndex.slice(0,100):[]){
    const t=await kv.get('support:'+id);if(!t||t.status==='resolved')continue;
    items.push(notificationItem('admin-support:'+t.id+':'+t.status,{title:(t.priority==='urgent'?'Urgent support request':'Client support request'),body:(t.workspaceName||'Client')+' · '+t.subject,kind:t.priority==='urgent'?'danger':'warning',view:'admin-support',createdAt:t.updatedAt||t.createdAt||now,meta:{ticketId:t.id}}));
  }
  for(const id of Array.isArray(workspaceIndex)?workspaceIndex.slice(0,300):[]){
    const ws=await kv.get('workspace:'+id);if(!ws)continue;
    if(ws.subscriptionStatus==='past_due')items.push(notificationItem('admin-billing:'+id+':past_due',{title:'Client billing past due',body:(ws.name||'Client')+' has a past-due subscription.',kind:'danger',view:'revenue',createdAt:ws.updatedAt||now}));
    if(ws.status==='suspended')items.push(notificationItem('admin-workspace:'+id+':suspended',{title:'Client workspace suspended',body:(ws.name||'Client')+' is currently suspended.',kind:'warning',view:'clients',createdAt:ws.updatedAt||now}));
    const plan=entitlementsFor(ws.plan),usage=Number(ws.usage?.minutes||0);
    if(plan.minutes){
      const pct=Math.round((usage/plan.minutes)*100),threshold=pct>=100?100:pct>=85?85:0;
      if(threshold)items.push(notificationItem('admin-usage:'+id+':'+threshold,{title:(ws.name||'Client')+' usage at '+Math.min(pct,100)+'%',body:usage+' of '+plan.minutes+' included minutes used. Review usage; no overage policy is implied by this notice.',kind:threshold>=100?'danger':'warning',view:'usage',createdAt:ws.updatedAt||now,meta:{workspaceId:id,usage,limit:plan.minutes,threshold}}));
    }
    const onboarding=await kv.get('onboarding:workspace:'+id);
    if(onboarding?.status==='awaiting_review'){
      const eligible=Number(onboarding.reviewEligibleAt||0)<=now;
      items.push(notificationItem('admin-onboarding:'+id+':account-review',{title:eligible?'Paid client ready for onboarding review':'New paid client in review hold',body:(ws.name||'Client')+(eligible?' is ready for account review and onboarding approval.':' has paid. The onboarding invite will become eligible during business hours.'),kind:eligible?'warning':'info',view:'provisioning',createdAt:onboarding.paidAt||onboarding.updatedAt||now,meta:{workspaceId:id}}));
    }
    if(onboarding?.checklist?.intake&&!onboarding?.checklist?.adminReview){
      const eligible=Number(onboarding.buildEligibleAt||0)<=now;
      items.push(notificationItem('admin-onboarding:'+id+':build-review',{title:eligible?'Build ready for QA review':'Build in QA hold',body:(ws.name||'Client')+' submitted intake and has an AI-agent draft '+(eligible?'ready for review.':'waiting for the review window.'),kind:eligible?'warning':'info',view:'provisioning',createdAt:onboarding.intakeCompletedAt||onboarding.updatedAt||now,meta:{workspaceId:id}}));
    }
  }
  const prospectList=(await Promise.all((Array.isArray(prospectIds)?prospectIds:[]).slice(0,100).map(id=>kv.get('site:prospect:'+id)))).filter(Boolean);
  prospectList.filter(p=>['new','inquiry','checkout_started'].includes(p.stage)).slice(0,25).forEach(p=>{
    const title=p.stage==='checkout_started'?'Signup checkout started':'New website inquiry';
    items.push(notificationItem('prospect:'+p.id+':'+p.stage,{title,body:(p.name||p.business||p.email||'Website prospect')+(p.plan?' · '+p.plan:''),kind:'info',view:p.stage==='checkout_started'?'admin-leads':'inbox',createdAt:p.updatedAt||p.createdAt||now,meta:{prospectId:p.id}}));
  });
  if(gmailConn){
    try{
      const summaryKey='gmail:summary:'+crypto.createHash('sha256').update(String(admin.email||'').toLowerCase()).digest('hex');
      const cached=await kv.get(summaryKey),count=Number(cached?.analytics?.unread||0);
      if(count>0)items.push(notificationItem('gmail:unread',{title:count+' unread Gmail thread'+(count===1?'':'s'),body:'Your connected CallerCore inbox has unread email.',kind:'info',view:'inbox',createdAt:Number(cached?.syncedAt||now),meta:{count}}));
    }catch(err){console.error('notification gmail summary failed',safeError(err))}
  }
  return items;
}
async function followups(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const state=await kv.get('followup:state:'+s.workspaceId)||{};
  return res.status(200).json({state:state&&typeof state==='object'&&!Array.isArray(state)?state:{}});
}
async function followupUpdate(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const body=req.body||{},callId=String(body.callId||'').slice(0,120),status=String(body.status||''),legacyNote=String(body.note||'').trim().slice(0,2000),appendNote=String(body.appendNote||'').trim().slice(0,2000);
  if(!callId||!['open','handled'].includes(status))return res.status(400).json({error:'Invalid follow-up update'});
  const calls=await kv.get('calls:'+s.workspaceId)||[];
  if(!Array.isArray(calls)||!calls.some(x=>x&&String(x.id)===callId))return res.status(404).json({error:'Call not found'});
  const key='followup:state:'+s.workspaceId,state=await kv.get(key)||{},base=state&&typeof state==='object'&&!Array.isArray(state)?state:{},next={...base},previous=base[callId]&&typeof base[callId]==='object'?base[callId]:{};
  let notes=Array.isArray(previous.notes)?previous.notes.slice(-100):[];
  if(previous.note&&String(previous.note).trim()&&!notes.some(n=>n&&n.text===previous.note))notes.unshift({id:'legacy',text:String(previous.note).slice(0,2000),at:Number(previous.updatedAt||0),by:previous.updatedBy||''});
  if(legacyNote&&!appendNote&&!notes.length)notes.push({id:'legacy_'+Date.now(),text:legacyNote,at:Date.now(),by:s.email||''});
  if(appendNote)notes.push({id:'note_'+Date.now().toString(36),text:appendNote,at:Date.now(),by:s.email||''});
  notes=notes.slice(-100);
  next[callId]={status,notes,updatedAt:Date.now(),updatedBy:s.email||''};
  await kv.set(key,next);
  await appendAudit(s.workspaceId,{actorEmail:s.email,actorRole:s.role||'client',action:appendNote?'followup_note_added':'followup_'+status,section:'calls',before:previous||null,after:next[callId],meta:{callId}});
  return res.status(200).json({ok:true,state:next});
}

async function notifications(req,res){
  const scope=String((req.query||{}).scope||'client')==='admin'?'admin':'client';
  let sessionData;
  if(scope==='admin'){sessionData=await requireAdmin(req,res);if(!sessionData)return}
  else{sessionData=await requireSession(req,res);if(!sessionData)return}
  const items=scope==='admin'?await buildAdminNotifications(sessionData):await buildClientNotifications(sessionData);
  const workspaceId=scope==='client'?sessionData.workspaceId:'';
  const read=await getNotificationReadSet(scope,sessionData.email,workspaceId);
  const sorted=items.sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,80).map(x=>({...x,read:read.has(x.id)}));
  return res.status(200).json({notifications:sorted,unreadCount:sorted.filter(x=>!x.read).length});
}
async function notificationsRead(req,res){
  const scope=String((req.body||{}).scope||'client')==='admin'?'admin':'client';
  let sessionData;
  if(scope==='admin'){sessionData=await requireAdmin(req,res);if(!sessionData)return}
  else{sessionData=await requireSession(req,res);if(!sessionData)return}
  const ids=Array.isArray(req.body?.ids)?req.body.ids.map(x=>String(x).slice(0,220)).filter(Boolean):[];
  const workspaceId=scope==='client'?sessionData.workspaceId:'';
  const read=await getNotificationReadSet(scope,sessionData.email,workspaceId);ids.forEach(id=>read.add(id));
  await saveNotificationReadSet(scope,sessionData.email,workspaceId,[...read]);
  return res.status(200).json({ok:true});
}
async function notificationsReadAll(req,res){
  const scope=String((req.body||{}).scope||'client')==='admin'?'admin':'client';
  let sessionData;
  if(scope==='admin'){sessionData=await requireAdmin(req,res);if(!sessionData)return}
  else{sessionData=await requireSession(req,res);if(!sessionData)return}
  const items=scope==='admin'?await buildAdminNotifications(sessionData):await buildClientNotifications(sessionData);
  const workspaceId=scope==='client'?sessionData.workspaceId:'';
  const read=await getNotificationReadSet(scope,sessionData.email,workspaceId);
  items.forEach(x=>read.add(x.id));await saveNotificationReadSet(scope,sessionData.email,workspaceId,[...read]);
  return res.status(200).json({ok:true});
}


function userProfileKey(email){
  return 'user:profile:'+crypto.createHash('sha256').update(cleanEmail(email)).digest('hex');
}
function defaultDisplayName(email,ws){
  const owner=String(ws?.ownerName||'').trim();
  if(owner)return owner.slice(0,80);
  const local=String(email||'').split('@')[0].replace(/[._-]+/g,' ').trim();
  return local?local.replace(/\b\w/g,m=>m.toUpperCase()).slice(0,80):'CallerCore User';
}
async function getUserProfile(email,ws=null){
  const saved=await kv.get(userProfileKey(email))||{};
  return {
    displayName:String(saved.displayName||defaultDisplayName(email,ws)).slice(0,80),
    avatarDataUrl:String(saved.avatarDataUrl||''),
    updatedAt:Number(saved.updatedAt||0)
  };
}
async function profile(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);
  const p=await getUserProfile(s.email,ws);
  return res.status(200).json({profile:{...p,email:s.email}});
}
async function profileSave(req,res){
  const s=await requireWritableSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);
  const body=req.body||{},existing=await getUserProfile(s.email,ws);
  const displayName=String(body.displayName===undefined?existing.displayName:body.displayName).trim().slice(0,80);
  if(displayName.length<1)return res.status(400).json({error:'Display name is required'});
  let avatarDataUrl=body.avatarDataUrl===undefined?existing.avatarDataUrl:String(body.avatarDataUrl||'');
  if(avatarDataUrl){
    if(avatarDataUrl.length>450000)return res.status(413).json({error:'Profile photo is too large'});
    if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatarDataUrl))return res.status(400).json({error:'Invalid profile photo'});
  }
  const next={displayName,avatarDataUrl,updatedAt:Date.now()};
  await kv.set(userProfileKey(s.email),next);
  return res.status(200).json({ok:true,profile:{...next,email:s.email}});
}

async function requestLogin(req,res){
  const body=req.body||{};
  const email=cleanEmail(body.email);
  const requestedNext=String(body.next||'');
  const next=requestedNext==='/admin-dashboard'||requestedNext==='/dashboard'?requestedNext:'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(200).json({ok:true});
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const bucket='auth:rate:'+crypto.createHash('sha256').update(ip).digest('hex');
  const emailBucket='auth:email-rate:'+crypto.createHash('sha256').update(email).digest('hex');
  const [count,emailCount]=await Promise.all([kv.incr(bucket),kv.incr(emailBucket)]);
  if(count===1)await kv.expire(bucket,WINDOW);
  if(emailCount===1)await kv.expire(emailBucket,WINDOW);
  if(count>MAX||emailCount>MAX)return res.status(429).json({error:'Too many requests. Try again shortly.'});
  const member=await kv.get('user:email:'+email);
  if(member&&member.workspaceId&&!member.disabled){
    const loginWs=await kv.get('workspace:'+member.workspaceId);
    if(loginWs&&loginWs.status==='pending_deletion')return res.status(200).json({ok:true});
    const token=crypto.randomBytes(32).toString('hex');
    await kv.set('login:'+token,{email,workspaceId:member.workspaceId,role:member.role||'owner',next,authVersion:Number(member.sessionVersion||0)},{ex:15*60});
    const link=requestOrigin(req)+'/api/account?action=verify&token='+encodeURIComponent(token);
    try{
      {const emailBody=authEmail({
        preheader:'Use this secure link to sign in to CallerCore.',
        title:'Sign in to CallerCore',
        intro:'Use the secure button below to access your CallerCore account.',
        statusLabel:'Security',
        statusText:'This link expires in 15 minutes and can only be used once.',
        bodyHtml:'<p style="margin:0">If you didn’t request this email, no action is required.</p>',
        ctaLabel:'Sign in securely',
        ctaUrl:link,
        siteUrl:requestOrigin(req)
      });await sendMail({to:email,subject:'Your CallerCore sign-in link',...emailBody});}
    }catch(err){console.error('auth email failed',safeError(err));return res.status(503).json({error:'Sign-in email temporarily unavailable'})}
  }
  return res.status(200).json({ok:true});
}

async function verify(req,res){
  const token=String((req.query||{}).token||'');
  if(!/^[a-f0-9]{64}$/.test(token))return res.redirect(302,'/login?error=invalid');
  const key='login:'+token,record=await kv.get(key);
  if(!record||!record.workspaceId)return res.redirect(302,'/login?error=expired');
  await kv.del(key);
  const member=await kv.get('user:email:'+cleanEmail(record.email)),loginWs=await kv.get('workspace:'+record.workspaceId);
  if(!member||member.disabled||!loginWs||loginWs.status==='pending_deletion')return res.redirect(302,'/login?error=disabled');
  await createSession(res,{email:record.email,workspaceId:record.workspaceId,role:record.role||'owner',authVersion:Number(record.authVersion||0)});
  const destination=record.next||((record.role||'owner')==='admin'?'/admin-dashboard':'/dashboard');
  return res.redirect(302,destination);
}

async function session(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);
  if(!ws)return res.status(404).json({error:'Workspace not found'});
  if(ws.status==='pending_deletion'&&!s.adminView)return res.status(403).json({error:'Workspace is pending deletion'});
  const ent=entitlementsFor(ws.plan);
  const member=await kv.get('user:email:'+cleanEmail(s.email));
  const profileData=await getUserProfile(s.email,ws);
  const onboardingState=await kv.get('onboarding:workspace:'+s.workspaceId)||null;
  const onboardingToken=await kv.get('onboarding:workspace-token:'+s.workspaceId)||'';
  const needsOnboarding=!!onboardingToken&&!!onboardingState?.onboardingLinkSent&&!['intake_complete','building_review','qa_complete','client_test','ready','live'].includes(onboardingState.status);
  return res.status(200).json({
    user:{email:s.email,role:member&&member.role||s.role,adminView:!!s.adminView,profile:profileData},
    onboarding:onboardingState?{...onboardingState,needsCompletion:needsOnboarding,url:needsOnboarding?('/onboarding?token='+onboardingToken):''}:{needsCompletion:needsOnboarding,url:needsOnboarding?('/onboarding?token='+onboardingToken):''},
    workspace:{
      id:ws.id,name:ws.name,plan:ent.plan,status:ws.status||'active',
      subscriptionStatus:ws.subscriptionStatus||'active',
      usage:ws.usage||{minutes:0},phone:ws.phone||'',locations:ent.locations,
      stripe:{customerLinked:!!ws.stripeCustomerId,subscriptionLinked:!!ws.stripeSubscriptionId},
      entitlements:ent
    }
  });
}

function redactExportSecrets(value){
  if(Array.isArray(value))return value.map(redactExportSecrets);
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const [key,val] of Object.entries(value)){
    if(/(?:^|_)(?:password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|webhook[_-]?secret)$/i.test(key)||/(?:password|secret|apiKey|accessToken|refreshToken|privateKey|webhookSecret)$/i.test(key)){
      out[key]='[redacted]';
    }else out[key]=redactExportSecrets(val);
  }
  return out;
}

async function buildWorkspaceExportData(id){
  const [workspace,settings,agent,calls,leads,conversations,appointments,automations,integrations,locations,phones,supportIndex,onboarding,audit]=await Promise.all([
    kv.get('workspace:'+id),kv.get('settings:'+id),kv.get('agent:'+id),kv.get('calls:'+id),kv.get('leads:'+id),kv.get('conversations:'+id),kv.get('appointments:'+id),kv.get('automations:'+id),kv.get('integrations:'+id),kv.get('locations:'+id),kv.get('phone:index'),kv.get('support:index'),kv.get('onboarding:workspace:'+id),kv.get('audit:'+id)
  ]);
  if(!workspace)return null;
  const support=[];
  for(const ticketId of Array.isArray(supportIndex)?supportIndex:[]){
    const t=await kv.get('support:'+ticketId);if(t&&t.workspaceId===id)support.push(t);
  }
  const phone=(Array.isArray(phones)?phones:[]).find(x=>x&&x.workspaceId===id)||null;
  return {
    exportVersion:'1.0',exportedAt:new Date().toISOString(),
    workspace:redactExportSecrets(workspace),settings:redactExportSecrets(settings||null),agent:redactExportSecrets(agent||null),phone:redactExportSecrets(phone),
    locations:redactExportSecrets(Array.isArray(locations)?locations:[]),integrations:redactExportSecrets(integrations||null),
    calls:redactExportSecrets(Array.isArray(calls)?calls:[]),leads:redactExportSecrets(Array.isArray(leads)?leads:[]),
    conversations:redactExportSecrets(Array.isArray(conversations)?conversations:[]),appointments:redactExportSecrets(Array.isArray(appointments)?appointments:[]),
    automations:redactExportSecrets(Array.isArray(automations)?automations:[]),support:redactExportSecrets(support),onboarding:redactExportSecrets(onboarding||null),
    audit:redactExportSecrets(Array.isArray(audit)?audit:[])
  };
}
function validateWorkspaceExportData(data){
  const issues=[],warnings=[],arraySections=['locations','calls','leads','conversations','appointments','automations','support','audit'];
  if(!data||typeof data!=='object')return {ok:false,issues:['Export payload is missing or invalid'],warnings:[],sections:{},recoverable:false};
  if(data.exportVersion!=='1.0')issues.push('Unsupported export version');
  if(!data.workspace||typeof data.workspace!=='object')issues.push('Workspace section missing');
  if(data.workspace&&!data.workspace.id)warnings.push('Workspace id is missing');
  if(data.workspace&&!data.workspace.ownerEmail)warnings.push('Workspace owner email is missing');
  for(const key of arraySections)if(!Array.isArray(data[key]))issues.push(key+' must be an array');
  for(const key of ['settings','agent','phone','integrations','onboarding']){
    if(data[key]!==null&&typeof data[key]!=='object')issues.push(key+' must be an object or null');
  }
  const secretLeaks=[];
  const walk=(value,path='root')=>{
    if(Array.isArray(value)){value.forEach((v,i)=>walk(v,path+'['+i+']'));return}
    if(!value||typeof value!=='object')return;
    for(const [key,val] of Object.entries(value)){
      const next=path+'.'+key;
      const secretKey=/(?:^|_)(?:password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|webhook[_-]?secret)$/i.test(key)||/(?:password|secret|apiKey|accessToken|refreshToken|privateKey|webhookSecret)$/i.test(key);
      if(secretKey&&val!=='[redacted]'&&val!==null&&val!=='')secretLeaks.push(next);
      walk(val,next);
    }
  };
  walk(data);
  if(secretLeaks.length)issues.push('Potential unredacted secret fields: '+secretLeaks.slice(0,8).join(', '));
  const redactedText=JSON.stringify(data);
  const hasRedactions=redactedText.includes('"[redacted]"');
  if(hasRedactions)warnings.push('Integration/authentication secrets are intentionally redacted and must be reconnected after a restore');
  const sections={
    workspace:!!data.workspace,settings:!!data.settings,agent:!!data.agent,phone:!!data.phone,locations:Array.isArray(data.locations),
    integrations:!!data.integrations,calls:Array.isArray(data.calls),leads:Array.isArray(data.leads),conversations:Array.isArray(data.conversations),
    appointments:Array.isArray(data.appointments),automations:Array.isArray(data.automations),support:Array.isArray(data.support),
    onboarding:!!data.onboarding,audit:Array.isArray(data.audit)
  };
  const recoverable=issues.length===0&&!!data.workspace;
  return {ok:issues.length===0,issues,warnings,sections,recoverable,requiresProviderReconnect:hasRedactions};
}

function sendWorkspaceExport(res,id,data,prefix='CallerCore-workspace-export'){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="'+prefix+'-'+String(id).slice(0,8)+'.json"');
  return res.status(200).send(JSON.stringify(data,null,2));
}
async function workspaceExport(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const data=await buildWorkspaceExportData(s.workspaceId);if(!data)return res.status(404).json({error:'Workspace not found'});
  return sendWorkspaceExport(res,s.workspaceId,data);
}
async function adminWorkspaceExport(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.query||{}).id||'').slice(0,80);if(!id)return res.status(400).json({error:'Client id required'});
  const data=await buildWorkspaceExportData(id);if(!data)return res.status(404).json({error:'Workspace not found'});
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'workspace_export',section:'access',meta:{reason:'admin_download'}});
  return sendWorkspaceExport(res,id,data,'CallerCore-admin-workspace-export');
}
async function adminRecoveryDrill(req,res){
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String((req.query||{}).id||'').slice(0,80);if(!id)return res.status(400).json({error:'Client id required'});
  const data=await buildWorkspaceExportData(id);if(!data)return res.status(404).json({error:'Workspace not found'});
  const validation=validateWorkspaceExportData(data);
  await appendAudit(id,{actorEmail:admin.email,actorRole:'admin',action:'recovery_drill',section:'access',meta:{ok:validation.ok,recoverable:validation.recoverable,issueCount:validation.issues.length,warningCount:validation.warnings.length}});
  return res.status(validation.ok?200:409).json({ok:validation.ok,recoverable:validation.recoverable,issues:validation.issues,warnings:validation.warnings,sections:validation.sections,requiresProviderReconnect:validation.requiresProviderReconnect,checkedAt:Date.now()});
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
  const smsLive=process.env.CALLERCORE_SMS_ENABLED==='true';
  return res.status(200).json({routing:item?{number:item.number||'',label:item.label||'Primary',provider:item.provider||'Vapi',forwardingFrom:item.forwardingFrom||'',transferNumber:item.transferNumber||'',afterHours:item.afterHours||'ai',smsEnabled:smsLive&&item.smsEnabled!==false,status:item.status||'active'}:null});
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
  const calendarLive=process.env.CALLERCORE_CALENDAR_ENABLED==='true',smsLive=process.env.CALLERCORE_SMS_ENABLED==='true';
  const allowedTriggers=['missed_call','new_lead','qualified_lead','after_hours_call',...(calendarLive?['appointment_booked']:[])];
  const allowedActions=['notify_team','create_followup','mark_priority',...(smsLive?['send_sms','send_confirmation']:[])];
  if(incoming.some(item=>item&&item.trigger==='appointment_booked'&&!calendarLive))return res.status(409).json({error:'Calendar automation triggers are not enabled'});
  if(incoming.some(item=>item&&['send_sms','send_confirmation'].includes(item.action)&&!smsLive))return res.status(409).json({error:'SMS automation actions are not enabled'});
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
    logoDataUrl:saved.logoDataUrl||'',
    timezone:saved.timezone||platform.defaultTimezone||'America/Los_Angeles',
    notificationEmail:saved.notificationEmail||ws.ownerEmail||s.email||'',
    smsAlerts:process.env.CALLERCORE_SMS_ENABLED==='true'&&saved.smsAlerts!==false,
    emailAlerts:saved.emailAlerts!==false,
    notifyBilling:saved.notifyBilling!==false,
    notifySetup:saved.notifySetup!==false,
    notifyCalls:saved.notifyCalls!==false,
    notifySupport:saved.notifySupport!==false,
    notifyUsage:saved.notifyUsage!==false
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
    logoDataUrl:String(body.logoDataUrl||'').trim().slice(0,450000),
    timezone:clean(body.timezone,100)||'America/Los_Angeles',
    notificationEmail:clean(body.notificationEmail,200).toLowerCase(),
    smsAlerts:process.env.CALLERCORE_SMS_ENABLED==='true'&&body.smsAlerts!==false,emailAlerts:body.emailAlerts!==false,
    notifyBilling:body.notifyBilling!==false,notifySetup:body.notifySetup!==false,notifyCalls:body.notifyCalls!==false,notifySupport:body.notifySupport!==false,notifyUsage:body.notifyUsage!==false,
    updatedAt:Date.now()
  };
  if(!settings.businessName)return res.status(400).json({error:'Business name is required'});
  if(settings.primaryEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.primaryEmail))return res.status(400).json({error:'Valid primary email required'});
  if(settings.notificationEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.notificationEmail))return res.status(400).json({error:'Valid notification email required'});
  if(settings.businessPhone&&!/^\+?[0-9() .-]{7,30}$/.test(settings.businessPhone))return res.status(400).json({error:'Valid business phone required'});
  if(settings.state&&!/^[A-Za-z]{2}$/.test(settings.state))return res.status(400).json({error:'State / region must be a 2-letter code'});
  if(settings.postalCode&&!/^\d{5}(?:-\d{4})?$/.test(settings.postalCode))return res.status(400).json({error:'Valid ZIP code required'});
  if(settings.website&&!/^https?:\/\//i.test(settings.website))return res.status(400).json({error:'Website must begin with http:// or https://'});
  if(settings.logoDataUrl&&!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(settings.logoDataUrl))return res.status(400).json({error:'Business logo must be a JPG, PNG, or WebP image'});
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
    googleCalendar:process.env.CALLERCORE_CALENDAR_ENABLED==='true'&&!!saved.googleCalendar,
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

async function clientDashboardData(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);if(!ws)return res.status(404).json({error:'Workspace not found'});
  const ent=entitlementsFor(ws.plan);
  const keys=['calls:'+s.workspaceId,'leads:'+s.workspaceId,'agent:'+s.workspaceId,'settings:'+s.workspaceId,'integrations:'+s.workspaceId,'locations:'+s.workspaceId,'conversations:'+s.workspaceId,'appointments:'+s.workspaceId,'automations:'+s.workspaceId,'followup:state:'+s.workspaceId,'platform:settings','phone:index'];
  const [callsRaw,leadsRaw,agentRaw,settingsRaw,integrationsRaw,locationsRaw,conversationsRaw,appointmentsRaw,automationsRaw,followupRaw,platformRaw,phoneIndex]=await Promise.all(keys.map(k=>kv.get(k)));
  const savedAgent=agentRaw||{},savedSettings=settingsRaw||{},platform=platformRaw||{},savedIntegrations=integrationsRaw||{},numbers=Array.isArray(phoneIndex)?phoneIndex:[],phone=numbers.find(x=>x&&x.workspaceId===s.workspaceId)||null;
  const smsLive=process.env.CALLERCORE_SMS_ENABLED==='true',calendarLive=process.env.CALLERCORE_CALENDAR_ENABLED==='true';
  const settings={
    businessName:savedSettings.businessName||ws.name||'',primaryEmail:savedSettings.primaryEmail||ws.ownerEmail||s.email||'',contactName:savedSettings.contactName||ws.ownerName||'',businessPhone:savedSettings.businessPhone||'',website:savedSettings.website||'',streetAddress:savedSettings.streetAddress||'',city:savedSettings.city||'',state:savedSettings.state||'',postalCode:savedSettings.postalCode||'',industry:savedSettings.industry||ws.industry||'',serviceArea:savedSettings.serviceArea||'',logoDataUrl:savedSettings.logoDataUrl||'',timezone:savedSettings.timezone||platform.defaultTimezone||'America/Los_Angeles',notificationEmail:savedSettings.notificationEmail||ws.ownerEmail||s.email||'',smsAlerts:smsLive&&savedSettings.smsAlerts!==false,emailAlerts:savedSettings.emailAlerts!==false,notifyBilling:savedSettings.notifyBilling!==false,notifySetup:savedSettings.notifySetup!==false,notifyCalls:savedSettings.notifyCalls!==false,notifySupport:savedSettings.notifySupport!==false,notifyUsage:savedSettings.notifyUsage!==false
  };
  const agent={name:savedAgent.name||platform.defaultAgentName||'Maya',role:savedAgent.role||'AI Receptionist',openingMessage:savedAgent.openingMessage||('Thank you for calling '+(ws.name||'our business')+'. This is Maya. How can I help you today?'),tone:savedAgent.tone||'Warm & professional',serviceArea:savedAgent.serviceArea||'',businessHours:savedAgent.businessHours||'',emergencyInstructions:savedAgent.emergencyInstructions||'',qualificationQuestions:Array.isArray(savedAgent.qualificationQuestions)?savedAgent.qualificationQuestions:[],transferNumber:savedAgent.transferNumber||'',updatedAt:savedAgent.updatedAt||null};
  const routing=phone?{number:phone.number||'',label:phone.label||'Primary',provider:phone.provider||'Vapi',forwardingFrom:phone.forwardingFrom||'',transferNumber:phone.transferNumber||'',afterHours:phone.afterHours||'ai',smsEnabled:smsLive&&phone.smsEnabled!==false,status:phone.status||'active'}:null;
  return res.status(200).json({
    calls:Array.isArray(callsRaw)?callsRaw.map(x=>x?({id:x.id,caller:x.caller,phone:x.phone,address:x.address,category:x.category||'General question',reason:x.reason,duration:x.duration,outcome:x.outcome,agent:x.agent,time:x.time,date:x.date,createdAt:x.createdAt}):x):[],leads:[],agent,settings,
    integrations:{googleCalendar:calendarLive&&!!savedIntegrations.googleCalendar,stripe:!!ws.stripeCustomerId,webhookUrl:savedIntegrations.webhookUrl||'',apiAccess:!!ent.features.apiAccess},
    locations:Array.isArray(locationsRaw)?locationsRaw:[],locationsLimit:ent.locations,routing,
    conversations:[],appointments:[],automations:[],
    followupState:followupRaw&&typeof followupRaw==='object'&&!Array.isArray(followupRaw)?followupRaw:{},
    loadedAt:Date.now()
  });
}

async function callDetail(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const id=String((req.query&&req.query.id)||'').slice(0,120);
  if(!id)return res.status(400).json({error:'Call ID is required'});
  const items=await kv.get('calls:'+s.workspaceId)||[];
  const call=Array.isArray(items)?items.find(x=>x&&String(x.id)===id):null;
  if(!call)return res.status(404).json({error:'Call not found'});
  return res.status(200).json({call});
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
  }catch(err){console.error('billing portal failed',safeError(err));return res.status(502).json({error:'Could not open Stripe billing portal'})}
}

async function logout(req,res){
  const token=parseCookies(req).cc_session;if(token)await kv.del('session:'+token);
  clearSessionCookie(res);return res.status(200).json({ok:true});
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const action=String((req.query||{}).action||'');
  if(req.method==='POST'&&!mutationOriginAllowed(req))return res.status(403).json({error:'Cross-site request blocked'});
  if(action==='health'&&req.method==='GET')return publicHealth(req,res);
  if(action==='bootstrap-preview'&&req.method==='POST')return bootstrapPreview(req,res);
  if(action==='seed-preview-data'&&req.method==='POST')return seedPreviewData(req,res);
  if(action==='promote-preview-admin'&&req.method==='POST')return promotePreviewAdmin(req,res);
  if(action==='admin-summary'&&req.method==='GET')return adminSummary(req,res);
  if(action==='admin-clients'&&req.method==='GET')return adminClients(req,res);
  if(action==='admin-client'&&req.method==='GET')return adminClient(req,res);
  if(action==='admin-provisioning'&&req.method==='GET')return adminProvisioning(req,res);
  if(action==='admin-provisioning-stage-save'&&req.method==='POST')return adminSaveProvisioningStage(req,res);
  if(action==='admin-provisioning-stage-clear'&&req.method==='POST')return adminClearProvisioningStage(req,res);
  if(action==='admin-provisioning-checklist-save'&&req.method==='POST')return adminProvisioningChecklistSave(req,res);
  if(action==='admin-onboarding-send'&&req.method==='POST')return adminSendOnboardingInvite(req,res);
  if(action==='admin-phone-numbers'&&req.method==='GET')return adminPhoneNumbers(req,res);
  if(action==='admin-phone-number-save'&&req.method==='POST')return adminSavePhoneNumber(req,res);
  if(action==='admin-phone-number-delete'&&req.method==='POST')return adminDeletePhoneNumber(req,res);
  if(action==='admin-gmail-status'&&req.method==='GET')return adminGmailStatus(req,res);
  if(action==='admin-gmail-connect'&&req.method==='POST')return adminGmailConnect(req,res);
  if(action==='admin-gmail-disconnect'&&req.method==='POST')return adminGmailDisconnect(req,res);
  if(action==='admin-gmail-inbox'&&req.method==='GET')return adminGmailInbox(req,res);
  if(action==='admin-gmail-aliases'&&req.method==='GET')return adminGmailAliases(req,res);
  if(action==='admin-gmail-read'&&req.method==='POST')return adminGmailRead(req,res);
  if(action==='admin-gmail-send'&&req.method==='POST')return adminGmailSend(req,res);
  if(action==='admin-website-conversation'&&req.method==='GET')return adminWebsiteConversation(req,res);
  if(action==='admin-website-reply'&&req.method==='POST')return adminWebsiteReply(req,res);
  if(action==='admin-website-analytics'&&req.method==='GET')return adminWebsiteAnalytics(req,res);
  if(action==='admin-website-prospect-update'&&req.method==='POST')return adminWebsiteProspectUpdate(req,res);
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
  if(action==='admin-support-reply'&&req.method==='POST')return adminSupportReply(req,res);
  if(action==='admin-platform-settings'&&req.method==='GET')return adminPlatformSettings(req,res);
  if(action==='admin-platform-settings-save'&&req.method==='POST')return adminPlatformSettingsSave(req,res);
  if(action==='admin-client-update'&&req.method==='POST')return adminUpdateClient(req,res);
  if(action==='admin-client-delete'&&req.method==='POST')return adminDeleteClient(req,res);
  if(action==='admin-client-delete-restore'&&req.method==='POST')return adminRestoreDeletedClient(req,res);
  if(action==='admin-client-purge'&&req.method==='POST')return adminPurgeClient(req,res);
  if(action==='admin-view-client'&&req.method==='POST')return adminViewClient(req,res);
  if(action==='admin-exit-client-view'&&req.method==='POST')return adminExitClientView(req,res);
  if(action==='profile'&&req.method==='GET')return profile(req,res);
  if(action==='profile-save'&&req.method==='POST')return profileSave(req,res);
  if(action==='notifications'&&req.method==='GET')return notifications(req,res);
  if(action==='notifications-read'&&req.method==='POST')return notificationsRead(req,res);
  if(action==='notifications-read-all'&&req.method==='POST')return notificationsReadAll(req,res);
  if(action==='followups'&&req.method==='GET')return followups(req,res);
  if(action==='followup-update'&&req.method==='POST')return followupUpdate(req,res);
  if(action==='request'&&req.method==='POST')return requestLogin(req,res);
  if(action==='verify'&&req.method==='GET')return verify(req,res);
  if(action==='session'&&req.method==='GET')return session(req,res);
  if(action==='workspace'&&req.method==='GET')return workspace(req,res);
  if(action==='workspace-export'&&req.method==='GET')return workspaceExport(req,res);
  if(action==='admin-workspace-export'&&req.method==='GET')return adminWorkspaceExport(req,res);
  if(action==='admin-recovery-drill'&&req.method==='GET')return adminRecoveryDrill(req,res);
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
  if(action==='client-dashboard-data'&&req.method==='GET')return clientDashboardData(req,res);
  if(action==='call-detail'&&req.method==='GET')return callDetail(req,res);
  if(action==='calls'&&req.method==='GET')return calls(req,res);
  if(action==='conversations'&&req.method==='GET')return conversations(req,res);
  if(action==='appointments'&&req.method==='GET')return appointments(req,res);
  if(action==='appointment-update'&&req.method==='POST')return updateAppointment(req,res);
  if(action==='leads'&&req.method==='GET')return leads(req,res);
  if(action==='lead-update'&&req.method==='POST')return updateLead(req,res);
  if(action==='support-tickets'&&req.method==='GET')return supportTickets(req,res);
  if(action==='support-ticket-create'&&req.method==='POST')return createSupportTicket(req,res);
  if(action==='support-ticket-reply'&&req.method==='POST')return replySupportTicket(req,res);
  if(action==='billing-portal'&&req.method==='POST')return billingPortal(req,res);
  if(action==='logout'&&req.method==='POST')return logout(req,res);
  return res.status(404).json({error:'Unknown account action'});
};