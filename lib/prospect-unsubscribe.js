const crypto=require('crypto');
const {compareAndAudit}=require('./config-transaction');
const {marketingEmailConsentState,revokeMarketingEmailConsent}=require('./prospect-consent');

const TOKEN_VERSION='v1';
const MIN_SECRET_LENGTH=32;

function secretOk(secret){return typeof secret==='string'&&secret.length>=MIN_SECRET_LENGTH}
function tokenPayload(id,state){
  return [TOKEN_VERSION,String(id),String(state.recordedAt),String(state.noticeVersion||''),String(state.source||'')].join('\n');
}
function signPayload(payload,secret){return crypto.createHmac('sha256',secret).update(payload).digest('base64url')}
function encodeId(id){return Buffer.from(String(id),'utf8').toString('base64url')}
function decodeId(value){
  if(typeof value!=='string'||value.length<1||value.length>180)throw Object.assign(new Error('Invalid unsubscribe token'),{code:'INVALID_TOKEN'});
  let id='';try{id=Buffer.from(value,'base64url').toString('utf8')}catch(_){}
  if(!id||id.length>100||! /^[A-Za-z0-9._:-]+$/.test(id))throw Object.assign(new Error('Invalid unsubscribe token'),{code:'INVALID_TOKEN'});
  return id;
}
function createMarketingUnsubscribeToken(prospect,secret){
  if(!secretOk(secret))throw Object.assign(new Error('Marketing unsubscribe secret is unavailable'),{code:'SECRET_UNAVAILABLE'});
  const id=String(prospect?.id||''),state=marketingEmailConsentState(prospect);
  if(!id||id.length>100||state.state!=='granted'||state.active!==true)throw Object.assign(new Error('Active marketing consent is required'),{code:'NOT_ACTIVE'});
  const payload=tokenPayload(id,state),sig=signPayload(payload,secret);
  return [TOKEN_VERSION,encodeId(id),String(state.recordedAt),sig].join('.');
}
function parseToken(token){
  const raw=String(token||'');
  if(raw.length<20||raw.length>512)throw Object.assign(new Error('Invalid unsubscribe token'),{code:'INVALID_TOKEN'});
  const parts=raw.split('.');
  if(parts.length!==4||parts[0]!==TOKEN_VERSION||!/^\d{1,17}$/.test(parts[2])||!/^[A-Za-z0-9_-]{43}$/.test(parts[3]))
    throw Object.assign(new Error('Invalid unsubscribe token'),{code:'INVALID_TOKEN'});
  return {version:parts[0],id:decodeId(parts[1]),recordedAt:Number(parts[2]),signature:parts[3]};
}
function tokenMatchesProspect(token,prospect,secret){
  if(!secretOk(secret))throw Object.assign(new Error('Marketing unsubscribe secret is unavailable'),{code:'SECRET_UNAVAILABLE'});
  const parsed=parseToken(token),id=String(prospect?.id||''),state=marketingEmailConsentState(prospect);
  if(parsed.id!==id||!state.verified||!['granted','revoked'].includes(state.state)||Number(state.recordedAt)!==parsed.recordedAt)return false;
  const expected=signPayload(tokenPayload(id,state),secret);
  const a=Buffer.from(expected),b=Buffer.from(parsed.signature);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function marketingUnsubscribeUrl(prospect,secret,{siteUrl='https://www.callercore.com'}={}){
  const base=String(siteUrl||'').replace(/\/+$/,'');
  if(!/^https?:\/\/[^/]+/i.test(base))throw new Error('Marketing unsubscribe site URL is invalid');
  return base+'/unsubscribe?token='+encodeURIComponent(createMarketingUnsubscribeToken(prospect,secret));
}
async function inspectMarketingUnsubscribe(kv,token,secret){
  if(!kv||typeof kv.get!=='function')throw new Error('Marketing unsubscribe storage is unavailable');
  const parsed=parseToken(token),prospect=await kv.get('site:prospect:'+parsed.id);
  if(!prospect||typeof prospect!=='object'||Array.isArray(prospect)||String(prospect.id||'')!==parsed.id)
    throw Object.assign(new Error('Invalid unsubscribe token'),{code:'INVALID_TOKEN'});
  if(!tokenMatchesProspect(token,prospect,secret))throw Object.assign(new Error('Invalid unsubscribe token'),{code:'INVALID_TOKEN'});
  const state=marketingEmailConsentState(prospect);
  return {valid:true,state:state.state,active:state.active===true,alreadyUnsubscribed:state.state==='revoked'};
}
async function revokeMarketingUnsubscribe(kv,token,secret,{now=Date.now()}={}){
  if(!kv||typeof kv.get!=='function'||typeof kv.eval!=='function')throw new Error('Marketing unsubscribe storage is unavailable');
  const parsed=parseToken(token),at=Number(now);
  if(!Number.isFinite(at)||at<=0)throw new Error('Marketing unsubscribe time is invalid');
  for(let attempt=0;attempt<4;attempt++){
    const key='site:prospect:'+parsed.id,current=await kv.get(key);
    if(!current||typeof current!=='object'||Array.isArray(current)||String(current.id||'')!==parsed.id)
      throw Object.assign(new Error('Invalid unsubscribe token'),{code:'INVALID_TOKEN'});
    if(!tokenMatchesProspect(token,current,secret))throw Object.assign(new Error('Invalid unsubscribe token'),{code:'INVALID_TOKEN'});
    const state=marketingEmailConsentState(current);
    if(state.state==='revoked')return {ok:true,unsubscribed:true,alreadyUnsubscribed:true,changed:false};
    if(state.state!=='granted')throw Object.assign(new Error('Marketing consent is not active'),{code:'NOT_ACTIVE'});
    const nextConsent=revokeMarketingEmailConsent(current.marketingEmailConsent,{now:at}),
      next={...current,marketingEmailConsent:nextConsent,updatedAt:Math.max(at,Number(current.updatedAt||current.createdAt||0)+1),updatedBy:'prospect-unsubscribe'};
    const event={
      id:crypto.randomUUID(),actorRole:'prospect',action:'marketing_email_unsubscribe',section:'privacy',
      before:{status:'granted',recordedAt:state.recordedAt},
      after:{status:'revoked',recordedAt:state.recordedAt,revokedAt:nextConsent.revokedAt},
      meta:{noticeVersion:state.noticeVersion,source:state.source,revocationSource:'unsubscribe_link'},at
    };
    const saved=await compareAndAudit(kv,{key,before:current,after:next},'site:consent:audit:'+parsed.id,event);
    if(saved)return {ok:true,unsubscribed:true,alreadyUnsubscribed:false,changed:true};
  }
  throw Object.assign(new Error('Prospect changed during unsubscribe'),{code:'CONFLICT'});
}

module.exports={
  TOKEN_VERSION,MIN_SECRET_LENGTH,createMarketingUnsubscribeToken,tokenMatchesProspect,marketingUnsubscribeUrl,
  inspectMarketingUnsubscribe,revokeMarketingUnsubscribe
};