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

async function requestLogin(req,res){
  const email=cleanEmail((req.body||{}).email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(200).json({ok:true});
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const bucket='auth:rate:'+crypto.createHash('sha256').update(ip).digest('hex');
  const count=await kv.incr(bucket);if(count===1)await kv.expire(bucket,WINDOW);
  if(count>MAX)return res.status(429).json({error:'Too many requests. Try again shortly.'});
  const member=await kv.get('user:email:'+email);
  if(member&&member.workspaceId){
    const token=crypto.randomBytes(32).toString('hex');
    await kv.set('login:'+token,{email,workspaceId:member.workspaceId,role:member.role||'owner'},{ex:15*60});
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
  await createSession(res,{email:record.email,workspaceId:record.workspaceId,role:record.role||'owner'});
  return res.redirect(302,'/dashboard');
}

async function session(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);
  if(!ws)return res.status(404).json({error:'Workspace not found'});
  const ent=entitlementsFor(ws.plan);
  return res.status(200).json({
    user:{email:s.email,role:s.role},
    workspace:{
      id:ws.id,name:ws.name,plan:ent.plan,status:ws.status||'active',
      subscriptionStatus:ws.subscriptionStatus||'active',
      usage:ws.usage||{minutes:0},
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

async function agent(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const ws=await kv.get('workspace:'+s.workspaceId);
  if(!ws)return res.status(404).json({error:'Workspace not found'});
  const saved=await kv.get('agent:'+s.workspaceId)||{};
  return res.status(200).json({agent:{
    name:saved.name||'Maya',
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
  const s=await requireSession(req,res);if(!s)return;
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
  await kv.set('agent:'+s.workspaceId,agent);
  return res.status(200).json({ok:true,agent});
}

async function automations(req,res){
  const access=await requireFeature(req,res,'automations');if(!access)return;
  const items=await kv.get('automations:'+access.session.workspaceId)||[];
  return res.status(200).json({automations:Array.isArray(items)?items:[]});
}

async function saveAutomations(req,res){
  const access=await requireFeature(req,res,'automations');if(!access)return;
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
  await kv.set('automations:'+access.session.workspaceId,items);
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
  const access=await requireFeature(req,res,'appointments');if(!access)return;
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
  return res.status(200).json({settings:{
    businessName:saved.businessName||ws.name||'',
    primaryEmail:saved.primaryEmail||ws.ownerEmail||s.email||'',
    timezone:saved.timezone||'America/Los_Angeles',
    notificationEmail:saved.notificationEmail||ws.ownerEmail||s.email||'',
    smsAlerts:saved.smsAlerts!==false,
    emailAlerts:saved.emailAlerts!==false
  }});
}

async function saveSettings(req,res){
  const s=await requireSession(req,res);if(!s)return;
  const body=req.body||{},clean=(v,n)=>String(v||'').trim().slice(0,n);
  const settings={
    businessName:clean(body.businessName,160),
    primaryEmail:clean(body.primaryEmail,200).toLowerCase(),
    timezone:clean(body.timezone,100)||'America/Los_Angeles',
    notificationEmail:clean(body.notificationEmail,200).toLowerCase(),
    smsAlerts:body.smsAlerts!==false,emailAlerts:body.emailAlerts!==false,updatedAt:Date.now()
  };
  await kv.set('settings:'+s.workspaceId,settings);
  if(settings.businessName){
    const key='workspace:'+s.workspaceId,ws=await kv.get(key);
    if(ws)await kv.set(key,{...ws,name:settings.businessName,updatedAt:Date.now()});
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
  const access=await requireFeature(req,res,'apiAccess');if(!access)return;
  const url=String((req.body||{}).webhookUrl||'').trim().slice(0,500);
  if(url&&!/^https:\/\//i.test(url))return res.status(400).json({error:'Webhook URL must use HTTPS'});
  const saved=await kv.get('integrations:'+access.session.workspaceId)||{};
  const next={...saved,webhookUrl:url,updatedAt:Date.now()};
  await kv.set('integrations:'+access.session.workspaceId,next);
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
  const s=await requireSession(req,res);if(!s)return;
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

async function logout(req,res){
  const token=parseCookies(req).cc_session;if(token)await kv.del('session:'+token);
  clearSessionCookie(res);return res.status(200).json({ok:true});
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const action=String((req.query||{}).action||'');
  if(action==='request'&&req.method==='POST')return requestLogin(req,res);
  if(action==='verify'&&req.method==='GET')return verify(req,res);
  if(action==='session'&&req.method==='GET')return session(req,res);
  if(action==='workspace'&&req.method==='GET')return workspace(req,res);
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
  if(action==='logout'&&req.method==='POST')return logout(req,res);
  return res.status(404).json({error:'Unknown account action'});
};