const crypto=require('crypto');
const {kv}=require('./kv');

function clean(v,n=500){return String(v||'').trim().slice(0,n)}
function emailKey(email){return crypto.createHash('sha256').update(clean(email,200).toLowerCase()).digest('hex')}
// Compare the session before appending the tracking event. A concurrent page
// view retries against the new session rather than overwriting another visit.
const SITE_EVENT_ATOMIC_RECORD=`
if ARGV[1]=='1' and (redis.call('GET',KEYS[2]) or '')~=ARGV[2] then return 0 end
redis.call('LPUSH',KEYS[1],ARGV[3])
redis.call('LTRIM',KEYS[1],0,4999)
if ARGV[1]=='1' then
  redis.call('SET',KEYS[2],ARGV[4],'EX',7776000)
  if ARGV[5]=='1' then
    redis.call('LPUSH',KEYS[3],ARGV[6])
    redis.call('LTRIM',KEYS[3],0,1999)
  end
end
return 1
`;
async function recordSiteEvent(raw={},req=null){
  const allowed=new Set(['session_start','page_view','engagement','page_exit','cta_click','plan_select','form_start','form_submit','form_abandon','checkout_start','checkout_complete','contact_submit','chat_open','chat_message','chat_handoff']);
  const type=clean(raw.type,60);if(!allowed.has(type))return null;
  const now=Date.now(),activeMs=Number(raw.activeMs||0),event={
    id:crypto.randomUUID(),type,at:now,
    visitorId:clean(raw.visitorId,120),sessionId:clean(raw.sessionId,120),
    path:clean(raw.path,300)||'/',title:clean(raw.title,200),
    referrer:clean(raw.referrer,500),source:clean(raw.source,120),
    utmSource:clean(raw.utmSource,120),utmMedium:clean(raw.utmMedium,120),utmCampaign:clean(raw.utmCampaign,160),
    label:clean(raw.label,200),value:clean(raw.value,200),
    activeMs:Number.isFinite(activeMs)?Math.max(0,Math.min(activeMs,60*60*1000)):0,
    device:clean(raw.device,40)
  };
  if(req){
    event.country=clean(req.headers['x-vercel-ip-country'],10);
    event.region=clean(req.headers['x-vercel-ip-country-region'],80);
    event.city=clean(req.headers['x-vercel-ip-city'],120);
  }
  const key=event.sessionId?'site:session:'+event.sessionId:'';
  for(let attempt=0;attempt<4;attempt++){
    const snapshot=key?await kv.get(key):null,old=snapshot||{};
    if(snapshot&&(typeof snapshot!=='object'||Array.isArray(snapshot)||String(snapshot.id||'')!==event.sessionId||!Number.isFinite(Number(snapshot.firstAt))||Number(snapshot.firstAt)<=0))throw new Error('Website session is malformed');
    let session=null;
    if(key){
      const pages=Array.isArray(old.pages)?[...old.pages]:[];
      if(type==='page_view'&&event.path&&!pages.includes(event.path))pages.push(event.path);
      session={...old,id:event.sessionId,visitorId:event.visitorId||old.visitorId||'',firstAt:Math.min(now,Number(old.firstAt||now)),lastAt:Math.max(now,Number(old.lastAt||0)),
        referrer:old.referrer||event.referrer||'',source:old.source||event.source||'',utmSource:old.utmSource||event.utmSource||'',
        utmMedium:old.utmMedium||event.utmMedium||'',utmCampaign:old.utmCampaign||event.utmCampaign||'',device:old.device||event.device||'',
        country:old.country||event.country||'',region:old.region||event.region||'',city:old.city||event.city||'',
        activeMs:Number(old.activeMs||0)+(type==='engagement'||type==='page_exit'?event.activeMs:0),pages:pages.slice(-20),
        events:Number(old.events||0)+1};
    }
    const keys=key?['site:events',key,'site:session:index']:['site:events'];
    const args=[key?'1':'0',snapshot==null?'':JSON.stringify(snapshot),JSON.stringify(event),key?JSON.stringify(session):'',key&&snapshot==null?'1':'0',event.sessionId];
    const saved=Number(await kv.eval(SITE_EVENT_ATOMIC_RECORD,keys,args));
    if(saved===1)return event;
    if(saved!==0)throw new Error('Website tracking transaction could not be confirmed');
  }
  throw new Error('Website session changed during tracking. Retry the event.');
}
// Record, email lookups and bounded directory must publish as one Redis operation.
// A competing same-email submission fails its snapshot and may retry against
// the newly published email owner rather than creating a duplicate prospect.
const PROSPECT_ATOMIC_UPSERT=`
if (redis.call('GET',KEYS[1]) or '')~=ARGV[1] then return 0 end
if ARGV[5]=='1' and (redis.call('GET',KEYS[3]) or '')~=ARGV[3] then return 0 end
local previous=3
if ARGV[5]=='1' then previous=4 end
if ARGV[6]=='1' and (redis.call('GET',KEYS[previous]) or '')~=ARGV[4] then return 0 end
local auditKey=2
if ARGV[5]=='1' then auditKey=auditKey+1 end
if ARGV[6]=='1' then auditKey=auditKey+1 end
local auditHistory=nil
local auditEncoded=nil
if ARGV[10]=='1' then
  auditKey=auditKey+1
  local rawHistory=redis.call('GET',KEYS[auditKey])
  auditHistory={}
  if rawHistory then
    if string.sub(rawHistory,1,1)~='[' then return -1 end
    local ok,decoded=pcall(cjson.decode,rawHistory)
    if not ok or type(decoded)~='table' then return -1 end
    auditHistory=decoded
  end
  local ok,event=pcall(cjson.decode,ARGV[11])
  if not ok or type(event)~='table' then return -2 end
  table.insert(auditHistory,1,event)
  while #auditHistory>200 do table.remove(auditHistory) end
  local encodedOk,encoded=pcall(cjson.encode,auditHistory)
  if not encodedOk then return -2 end
  auditEncoded=encoded
end
redis.call('SET',KEYS[1],ARGV[2])
if ARGV[5]=='1' then redis.call('SET',KEYS[3],ARGV[9]) end
if ARGV[6]=='1' and ARGV[7]=='1' then redis.call('DEL',KEYS[previous]) end
if ARGV[8]=='1' then
  redis.call('LPUSH',KEYS[2],ARGV[9])
  redis.call('LTRIM',KEYS[2],0,1999)
end
if ARGV[10]=='1' then redis.call('SET',KEYS[auditKey],auditEncoded) end
return 1
`;
function nextStage(raw,old){
  const requested=clean(raw.stage!==undefined?raw.stage:old.stage,60)||'new',current=old.stage||'';
  if(current==='converted'&&requested!=='converted')return 'converted';
  // Public engagement is evidence of interest, not permission to reset work in
  // the sales pipeline. Checkout can reopen a lost lead but not demote an active one.
  if(!raw.updatedBy&&requested==='inquiry'&&['checkout_started','follow_up','qualified','proposal'].includes(current))return current;
  if(!raw.updatedBy&&requested==='checkout_started'&&['follow_up','qualified','proposal'].includes(current))return current;
  return requested;
}
async function upsertWebsiteProspectAttempt(raw={}){
  const email=clean(raw.email,200).toLowerCase(),now=Date.now();
  let id=clean(raw.id,100),matchedEmailLookup=false;
  if(!id&&email){id=await kv.get('site:prospect:email:'+emailKey(email));matchedEmailLookup=!!id}
  if(!id)id=crypto.randomUUID();
  const key='site:prospect:'+id,snapshot=await kv.get(key),old=snapshot||{};
  if(matchedEmailLookup&&!snapshot)throw new Error('Prospect email lookup points to a missing record');
  if(snapshot&&(typeof snapshot!=='object'||Array.isArray(snapshot)||String(snapshot.id||'')!==String(id)))throw new Error('Prospect record is malformed');
  if(raw.requireNew&&snapshot)throw Object.assign(new Error('Prospect already exists. Open the existing record instead.'),{code:'PROSPECT_EXISTS',prospectId:id});
  const retainCuratedProfile=!!(old.id&&!raw.updatedBy&&!raw.workspaceId&&(old.stage==='converted'||old.updatedBy));
  const next={...old,id,
    name:clean(retainCuratedProfile&&old.name?old.name:raw.name!==undefined?raw.name:old.name,120),
    business:clean(retainCuratedProfile&&old.business?old.business:raw.business!==undefined?raw.business:old.business,160),
    email:email||old.email||'',phone:clean(retainCuratedProfile&&old.phone?old.phone:raw.phone!==undefined?raw.phone:old.phone,80),
    industry:clean(retainCuratedProfile&&old.industry?old.industry:raw.industry!==undefined?raw.industry:old.industry,160),
    category:clean(raw.category!==undefined?raw.category:old.category,100),
    message:clean(raw.message!==undefined?raw.message:old.message,4000),
    plan:clean(retainCuratedProfile&&old.stage==='converted'&&old.plan?old.plan:raw.plan!==undefined?raw.plan:old.plan,30),
    source:clean(raw.source!==undefined?raw.source:old.source,80)||'website',
    stage:nextStage(raw,old),
    visitorId:clean(raw.visitorId!==undefined?raw.visitorId:old.visitorId,120),
    sessionId:clean(raw.sessionId!==undefined?raw.sessionId:old.sessionId,120),
    utmSource:clean(raw.utmSource!==undefined?raw.utmSource:old.utmSource,120),
    utmMedium:clean(raw.utmMedium!==undefined?raw.utmMedium:old.utmMedium,120),
    utmCampaign:clean(raw.utmCampaign!==undefined?raw.utmCampaign:old.utmCampaign,160),
    firstSource:old.firstSource||old.source||clean(raw.source,80)||'website',
    firstUtmSource:old.firstUtmSource||old.utmSource||clean(raw.utmSource,120),
    firstUtmMedium:old.firstUtmMedium||old.utmMedium||clean(raw.utmMedium,120),
    firstUtmCampaign:old.firstUtmCampaign||old.utmCampaign||clean(raw.utmCampaign,160),
    workspaceId:clean(raw.workspaceId!==undefined?raw.workspaceId:old.workspaceId,100),
    stripeCustomerId:clean(raw.stripeCustomerId!==undefined?raw.stripeCustomerId:old.stripeCustomerId,120),
    convertedAt:Number(raw.convertedAt!==undefined?raw.convertedAt:(old.convertedAt||0))||null,
    monthlyValue:Number(raw.monthlyValue!==undefined?raw.monthlyValue:(old.monthlyValue||0))||0,
    setupValue:Number(raw.setupValue!==undefined?raw.setupValue:(old.setupValue||0))||0,
    owner:raw.owner!==undefined?clean(raw.owner||old.owner||raw.defaultSalesOwner,120):(old.owner||''),
    campaign:raw.campaign!==undefined?clean(raw.campaign||old.campaign||old.utmCampaign,160):(old.campaign||old.utmCampaign||''),
    notes:raw.notes!==undefined?clean(raw.notes||old.notes,3000):(old.notes||''),
    nextFollowUpAt:raw.nextFollowUpAt!==undefined?(Number(raw.nextFollowUpAt)||old.nextFollowUpAt||(!['converted','lost'].includes(nextStage(raw,old))&&Number(raw.autoFollowupHours||0)>0?now+Number(raw.autoFollowupHours)*3600000:null)):(old.nextFollowUpAt||null),
    lastContactAt:raw.lastContactAt!==undefined?(Number(raw.lastContactAt)||old.lastContactAt||null):(old.lastContactAt||null),
    tags:Array.isArray(raw.tags)?raw.tags.map(tag=>clean(tag,60)).filter(Boolean).slice(0,12):(old.tags||[]),
    updatedBy:raw.updatedBy!==undefined?clean(raw.updatedBy,200):(old.updatedBy||''),
    createdAt:old.createdAt||now,updatedAt:Math.max(now,Number(old.updatedAt||old.createdAt||0)+1)};
  const finalEmail=next.email,previousEmail=clean(old.email,200).toLowerCase();
  const nextKey=finalEmail?'site:prospect:email:'+emailKey(finalEmail):'';
  const previousKey=previousEmail&&previousEmail!==finalEmail?'site:prospect:email:'+emailKey(previousEmail):'';
  const [owner,previousOwner]=await Promise.all([nextKey?kv.get(nextKey):null,previousKey?kv.get(previousKey):null]);
  if(owner&&String(owner)!==id)throw new Error('Prospect email is linked to another record');
  if(!raw.id&&snapshot&&email&&previousEmail&&previousEmail!==email)throw new Error('Prospect email lookup disagrees with the stored record');
  const keys=[key,'site:prospect:index'];
  if(nextKey)keys.push(nextKey);
  if(previousKey)keys.push(previousKey);
  const auditSpec=raw.adminAudit;
  const auditEnabled=!!(auditSpec&&raw.requireNew&&auditSpec.workspaceId&&auditSpec.actorEmail);
  if(auditSpec&&!auditEnabled)throw new Error('Manual prospect audit requires a valid admin identity and create-only operation');
  const event=auditEnabled?{id:crypto.randomUUID(),workspaceId:clean(auditSpec.workspaceId,100),
    actorEmail:clean(auditSpec.actorEmail,200),actorRole:'admin',action:'sales_prospect_create',section:'growth',
    before:null,after:{id,stage:next.stage,updatedAt:next.updatedAt},meta:{prospectId:id},at:now}:null;
  if(auditEnabled)keys.push('audit:'+event.workspaceId);
  const args=[snapshot==null?'':JSON.stringify(snapshot),JSON.stringify(next),owner==null?'':String(owner),previousOwner==null?'':String(previousOwner),nextKey?'1':'0',previousKey?'1':'0',previousKey&&String(previousOwner||'')===id?'1':'0',snapshot==null?'1':'0',id,auditEnabled?'1':'0',auditEnabled?JSON.stringify(event):''];
  const result=Number(await kv.eval(PROSPECT_ATOMIC_UPSERT,keys,args));
  if(result===-1)throw new Error('Admin prospect audit history is malformed. No lead was created');
  if(result===-2)throw new Error('Admin prospect audit event could not be encoded. No lead was created');
  if(result!==1&&result!==0)throw new Error('Prospect transaction could not be confirmed');
  if(!result)throw Object.assign(new Error('Prospect changed during save. Retry after refreshing the record'),{code:'PROSPECT_CONFLICT'});
  return next;
}
async function upsertWebsiteProspect(raw={}){
  for(let attempt=0;attempt<4;attempt++){
    try{return await upsertWebsiteProspectAttempt(raw)}
    catch(err){if(err?.code!=='PROSPECT_CONFLICT'||attempt===3)throw err}
  }
}
module.exports={recordSiteEvent,upsertWebsiteProspect,emailKey};
