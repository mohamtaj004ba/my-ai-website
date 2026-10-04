const crypto=require('crypto');
const {kv}=require('./kv');
const {compareAndSetConfig,compareAndSetWithDelete}=require('./config-transaction');

function encKey(){
  const secret=process.env.CALLERCORE_ENCRYPTION_KEY;
  if(!secret)throw new Error('CALLERCORE_ENCRYPTION_KEY missing');
  if(String(secret).length<32)throw new Error('CALLERCORE_ENCRYPTION_KEY must be at least 32 characters');
  return crypto.createHash('sha256').update(secret).digest();
}
function encryptJson(value){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encKey(),iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,data]).toString('base64url');
}
function decryptJson(blob){
  const raw=Buffer.from(String(blob||''),'base64url');if(raw.length<29)throw new Error('Invalid encrypted token');
  const iv=raw.subarray(0,12),tag=raw.subarray(12,28),data=raw.subarray(28),decipher=crypto.createDecipheriv('aes-256-gcm',encKey(),iv);
  decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));
}
function configReady(){return !!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&String(process.env.CALLERCORE_ENCRYPTION_KEY||'').length>=32)}
function oauthUrl({state,redirectUri}){
  if(!configReady())throw new Error('Google OAuth not configured');
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id',process.env.GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri',redirectUri);
  u.searchParams.set('response_type','code');
  u.searchParams.set('access_type','offline');
  u.searchParams.set('prompt','consent');
  u.searchParams.set('include_granted_scopes','true');
  u.searchParams.set('state',state);
  u.searchParams.set('scope',[
    'openid','email','profile',
    'https://www.googleapis.com/auth/gmail.modify'
  ].join(' '));
  return u.toString();
}
async function tokenRequest(params){
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error_description||data.error||'Google token request failed');return data;
}
async function exchangeCode({code,redirectUri}){
  return tokenRequest({code,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'});
}
async function saveConnection(adminEmail,tokens,profile={},expectedConnection){
  const normalizedAdmin=String(adminEmail).toLowerCase(),key='integration:gmail:admin:'+normalizedAdmin;
  const rawExisting=await kv.get(key);
  if(expectedConnection!==undefined&&JSON.stringify(rawExisting??null)!==JSON.stringify(expectedConnection))throw new Error('Gmail connection changed during token refresh');
  if(rawExisting!=null&&(!rawExisting||typeof rawExisting!=='object'||Array.isArray(rawExisting)))throw new Error('Stored Gmail connection is malformed');
  if(!profile||typeof profile!=='object'||Array.isArray(profile))throw new Error('Gmail profile could not be verified');
  const gmailEmail=String(profile.emailAddress||profile.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmailEmail))throw new Error('Gmail profile email could not be verified');
  const existing=rawExisting||{};
  let refresh='';
  if(tokens.refresh_token)refresh=tokens.refresh_token;
  else if(existing.refreshTokenEnc&&String(existing.gmailEmail||'').trim().toLowerCase()===gmailEmail)refresh=decryptJson(existing.refreshTokenEnc).token;
  if(!refresh)throw new Error('Google did not return a refresh token');
  const value={adminEmail:normalizedAdmin,gmailEmail,
    refreshTokenEnc:encryptJson({token:refresh}),accessTokenEnc:tokens.access_token?encryptJson({token:tokens.access_token}):existing.accessTokenEnc||'',
    accessExpiresAt:tokens.expires_in?Date.now()+Number(tokens.expires_in)*1000:existing.accessExpiresAt||0,
    scope:tokens.scope||existing.scope||'',connectedAt:existing.connectedAt||Date.now(),updatedAt:Date.now()};
  if(!await compareAndSetConfig(kv,[{key,before:rawExisting,after:value}]))throw new Error('Gmail connection changed during save');
  const confirmed=await kv.get(key);
  if(!confirmed||typeof confirmed!=='object'||Array.isArray(confirmed)||String(confirmed.adminEmail||'').toLowerCase()!==normalizedAdmin||
    String(confirmed.refreshTokenEnc||'')!==String(value.refreshTokenEnc)||String(confirmed.gmailEmail||'')!==String(value.gmailEmail||''))
    throw new Error('Gmail connection save could not be confirmed');
  return confirmed;
}
async function getConnection(adminEmail){return kv.get('integration:gmail:admin:'+String(adminEmail).toLowerCase())}
async function disconnect(adminEmail,expectedGmailEmail){
  const key='integration:gmail:admin:'+String(adminEmail).toLowerCase();
  const before=await kv.get(key);
  if(expectedGmailEmail!==undefined&&String(before?.gmailEmail||'').trim().toLowerCase()!==String(expectedGmailEmail).trim().toLowerCase()){
    const error=new Error('Gmail account changed after confirmation. Refresh before disconnecting.');error.code='GMAIL_CONNECTION_CHANGED';throw error;
  }
  if(!await compareAndSetWithDelete(kv,[{key,before,after:null}],{deleteKeys:[key]}))throw new Error('Gmail connection changed during disconnect');
  if(await kv.get(key)!=null)throw new Error('Gmail disconnect could not be confirmed');
}
async function accessToken(adminEmail,expectedGmailEmail){
  const c=await getConnection(adminEmail);if(!c)throw new Error('Gmail is not connected');
  if(expectedGmailEmail!==undefined&&String(c.gmailEmail||'').trim().toLowerCase()!==String(expectedGmailEmail).trim().toLowerCase()){
    const error=new Error('Gmail account changed during synchronization');error.code='GMAIL_CONNECTION_CHANGED';throw error;
  }
  if(c.accessTokenEnc&&Number(c.accessExpiresAt||0)>Date.now()+60000)return decryptJson(c.accessTokenEnc).token;
  const refresh=decryptJson(c.refreshTokenEnc).token;
  const t=await tokenRequest({refresh_token:refresh,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,grant_type:'refresh_token'});
  await saveConnection(adminEmail,{...t,refresh_token:refresh},{emailAddress:c.gmailEmail},c);return t.access_token;
}
async function gmailFetch(adminEmail,path,opts={},expectedGmailEmail){
  const sending=path==='/messages/send'&&String(opts.method||'GET').toUpperCase()==='POST';
  const failure=message=>Object.assign(new Error(message),sending?{code:'GMAIL_DELIVERY_UNCERTAIN',deliveryState:'uncertain'}:{});
  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    const token=await accessToken(adminEmail,expectedGmailEmail);
    let r;try{r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me'+path,{...opts,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opts.headers||{})}})}
    catch(_){throw failure('Gmail API transport result could not be verified')}
    const data=await r.json().catch(()=>null);
    if(r.ok){if(!data||typeof data!=='object'||Array.isArray(data))throw failure('Gmail API response could not be verified');return data}
    const message=data?.error?.message||'Gmail API request failed';
    const retryable=r.status===429||(r.status===403&&/quota|rate|concurrent/i.test(message));
    lastError=r.status>=500?failure(message):new Error(message);
    if(!retryable||attempt===2)throw lastError;
    const retryAfter=Number(r.headers.get('retry-after')||0);
    const delay=retryAfter>0?retryAfter*1000:800*Math.pow(2,attempt);
    await new Promise(resolve=>setTimeout(resolve,Math.min(delay,5000)));
  }
  throw lastError||new Error('Gmail API request failed');
}
function b64urlDecode(s=''){try{return Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')}catch(_){return''}}
function b64urlEncode(s=''){return Buffer.from(s,'utf8').toString('base64url')}
function headersMap(message){const out={};for(const h of message?.payload?.headers||[])out[String(h.name||'').toLowerCase()]=h.value||'';return out}
function extractBody(payload){
  if(!payload)return'';
  if(payload.mimeType==='text/plain'&&payload.body?.data)return b64urlDecode(payload.body.data);
  for(const p of payload.parts||[]){const t=extractBody(p);if(t)return t}
  if(payload.body?.data){const raw=b64urlDecode(payload.body.data);return raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
  return'';
}
function emailFromHeader(v=''){const m=String(v).match(/<([^>]+)>/);return String(m?m[1]:v).trim().toLowerCase()}
function threadCacheKey(adminEmail,threadId,gmailEmail){
  const who=crypto.createHash('sha256').update(JSON.stringify([String(adminEmail||'').trim().toLowerCase(),String(gmailEmail||'').trim().toLowerCase()])).digest('hex').slice(0,24);
  return 'gmail:thread:v2:'+who+':'+String(threadId||'');
}
async function listInbox(adminEmail,{maxResults=25,query='newer_than:30d'}={}){
  const normalizedLimit=Math.min(100,Math.max(1,Number(maxResults)||25)),queryWindow=query==='newer_than:30d'?'30d':'custom';
  const conn=await getConnection(adminEmail);if(!conn)return {connected:false,threads:[],analytics:{},coverage:{verified:true,limited:false,loadedThreads:0,estimatedThreads:0,queryWindow}};
  const list=await gmailFetch(adminEmail,'/threads?maxResults='+normalizedLimit+'&q='+encodeURIComponent(query),{},conn.gmailEmail);
  if(list.threads!==undefined&&!Array.isArray(list.threads)||list.resultSizeEstimate!==undefined&&(!Number.isSafeInteger(list.resultSizeEstimate)||list.resultSizeEstimate<0)||list.nextPageToken!==undefined&&typeof list.nextPageToken!=='string')throw new Error('Gmail thread list could not be verified');
  const refs=Array.isArray(list.threads)?list.threads:[],estimateRaw=Number(list.resultSizeEstimate),
    estimatedThreads=Number.isFinite(estimateRaw)&&estimateRaw>=0?estimateRaw:null,
    coverage={verified:true,limited:!!list.nextPageToken||(estimatedThreads!==null&&estimatedThreads>refs.length),loadedThreads:refs.length,estimatedThreads,queryWindow},
    threads=[];
  if(refs.some(ref=>!ref||typeof ref!=='object'||Array.isArray(ref)||typeof ref.id!=='string'||!ref.id.trim())||new Set(refs.map(ref=>ref.id)).size!==refs.length)throw new Error('Gmail thread identities could not be verified');
  const loadThread=async ref=>{
    const cacheKey=threadCacheKey(adminEmail,ref.id,conn.gmailEmail),cached=await kv.get(cacheKey);
    if(cached&&cached.thread&&String(cached.thread.id||'')===ref.id&&Array.isArray(cached.thread.messages)&&cached.thread.messages.length>0&&cached.thread.messages.every(message=>message&&typeof message==='object'&&!Array.isArray(message)&&typeof message.id==='string'&&!!message.id)&&ref.historyId&&String(cached.historyId||'')===String(ref.historyId))return cached.thread;
    const t=await gmailFetch(adminEmail,'/threads/'+encodeURIComponent(ref.id)+'?format=full',{},conn.gmailEmail);
    if(String(t.id||'')!==ref.id||!Array.isArray(t.messages)||!t.messages.length||t.messages.some(m=>!m||typeof m!=='object'||Array.isArray(m)||typeof m.id!=='string'||!m.id.trim()||m.threadId!==undefined&&String(m.threadId)!==ref.id||m.labelIds!==undefined&&!Array.isArray(m.labelIds)||!m.payload||typeof m.payload!=='object'||Array.isArray(m.payload)||m.payload.headers!==undefined&&(!Array.isArray(m.payload.headers)||m.payload.headers.some(h=>!h||typeof h.name!=='string'||typeof h.value!=='string'))))throw new Error('Gmail thread detail could not be verified');
    const messages=(t.messages||[]).map(m=>{const h=headersMap(m),from=emailFromHeader(h.from),to=emailFromHeader(h.to);return {
      id:m.id,threadId:t.id,from,to,subject:h.subject||'(no subject)',date:h.date||'',messageId:h['message-id']||'',snippet:m.snippet||'',body:extractBody(m.payload).slice(0,12000),
      at:Number(m.internalDate||0),unread:(m.labelIds||[]).includes('UNREAD'),direction:(m.labelIds||[]).includes('SENT')||from===String(conn.gmailEmail||'').toLowerCase()?'outbound':'inbound'
    }}).sort((a,b)=>a.at-b.at);
    const last=messages[messages.length-1]||{},thread={id:t.id,historyId:t.historyId||'',messages,last,subject:last.subject||'(no subject)',lastAt:last.at||0,unread:messages.some(m=>m.unread&&m.direction==='inbound')};
    await kv.set(cacheKey,{historyId:t.historyId||ref.historyId||'',thread},{ex:60*60*24*7});
    return thread;
  };
  for(let i=0;i<refs.length;i++){
    threads.push(await loadThread(refs[i]));
    if(i+1<refs.length)await new Promise(r=>setTimeout(r,180));
  }
  threads.sort((a,b)=>b.lastAt-a.lastAt);
  let inbound=0,outbound=0,responses=[],unread=0;
  for(const t of threads){
    if(t.unread)unread++;
    t.messages.forEach(m=>m.direction==='inbound'?inbound++:outbound++);
    const firstIn=t.messages.find(m=>m.direction==='inbound');if(firstIn){const reply=t.messages.find(m=>m.direction==='outbound'&&m.at>firstIn.at);if(reply)responses.push((reply.at-firstIn.at)/1000)}
  }
  const current=await getConnection(adminEmail);if(String(current?.gmailEmail||'').trim().toLowerCase()!==String(conn.gmailEmail||'').trim().toLowerCase())throw new Error('Gmail account changed during synchronization');
  return {connected:true,gmailEmail:conn.gmailEmail,threads,coverage,analytics:{threads:threads.length,unread,inbound,outbound,avgFirstResponseSeconds:responses.length?Math.round(responses.reduce((a,b)=>a+b,0)/responses.length):0}};
}
async function markThreadRead(adminEmail,threadId,expectedGmailEmail){
  const id=String(threadId||'').trim();
  if(!id)throw new Error('Gmail thread id required');
  const conn=await getConnection(adminEmail);
  const result=await gmailFetch(adminEmail,'/threads/'+encodeURIComponent(id)+'/modify',{method:'POST',body:JSON.stringify({removeLabelIds:['UNREAD']})},expectedGmailEmail??conn?.gmailEmail);
  if(!result||typeof result!=='object'||Array.isArray(result)||String(result.id||'')!==id)throw new Error('Gmail read-state response could not be verified');
  try{await kv.del(threadCacheKey(adminEmail,id,conn?.gmailEmail))}
  catch(_){return {...result,warning:'Gmail marked this thread as read, but cached detail could not be refreshed. Refresh the inbox.'}}
  return result;
}
async function listAliases(adminEmail){
  const conn=await getConnection(adminEmail);if(!conn)throw new Error('Gmail is not connected');
  const data=await gmailFetch(adminEmail,'/settings/sendAs',{},conn.gmailEmail);
  if(!Array.isArray(data.sendAs)||!data.sendAs.length||data.sendAs.some(a=>!a||typeof a!=='object'||Array.isArray(a)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.sendAsEmail||'').trim())||['isPrimary','isDefault','treatAsAlias'].some(key=>a[key]!==undefined&&typeof a[key]!=='boolean')||a.verificationStatus!==undefined&&!['verificationStatusUnspecified','accepted','pending'].includes(a.verificationStatus))||data.sendAs.filter(a=>a.isPrimary===true).length!==1)throw new Error('Gmail sender aliases could not be verified');
  if(String(data.sendAs.find(a=>a.isPrimary===true).sendAsEmail).trim().toLowerCase()!==String(conn.gmailEmail||'').trim().toLowerCase()||new Set(data.sendAs.map(a=>String(a.sendAsEmail).trim().toLowerCase())).size!==data.sendAs.length)throw new Error('Gmail sender alias identity could not be verified');
  const aliases=[];
  for(const a of data.sendAs||[]){
    let inboundSeen=false,inboundVerified=false;
    try{
      const q='to:'+String(a.sendAsEmail||'');
      const r=await gmailFetch(adminEmail,'/messages?maxResults=1&q='+encodeURIComponent(q),{},conn.gmailEmail);
      if(r.messages!==undefined&&(!Array.isArray(r.messages)||r.messages.some(message=>!message||typeof message.id!=='string'||!message.id.trim())))throw new Error('Gmail inbound alias check could not be verified');
      inboundSeen=Array.isArray(r.messages)&&r.messages.length>0;inboundVerified=true;
    }catch(_){}
    aliases.push({
      email:String(a.sendAsEmail||'').toLowerCase(),
      displayName:a.displayName||'',
      isPrimary:!!a.isPrimary,isDefault:!!a.isDefault,
      treatAsAlias:!!a.treatAsAlias,
      verificationStatus:a.verificationStatus||(a.isPrimary?'accepted':'verificationStatusUnspecified'),
      inboundSeen,inboundVerified
    });
  }
  const current=await getConnection(adminEmail);if(String(current?.gmailEmail||'').trim().toLowerCase()!==String(conn.gmailEmail||'').trim().toLowerCase())throw new Error('Gmail account changed during alias synchronization');
  return aliases;
}
function safeMailHeader(value,max=500){return String(value||'').replace(/[\r\n\0-\x1f\x7f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
async function sendMessage(adminEmail,{to,subject,body,threadId='',inReplyTo='',references='',from='',expectedGmailEmail}){
  const conn=await getConnection(adminEmail);
  const safeTo=safeMailHeader(to,320),safeFrom=safeMailHeader(from,320),safeSubject=safeMailHeader(subject,500),safeReply=safeMailHeader(inReplyTo,500),safeReferences=safeMailHeader(references,1200),safeThread=String(threadId||'').trim().slice(0,120);
  const lines=[];if(safeFrom)lines.push('From: '+safeFrom);lines.push('To: '+safeTo,'Subject: '+safeSubject,'MIME-Version: 1.0','Content-Type: text/plain; charset="UTF-8"');
  if(safeReply)lines.push('In-Reply-To: '+safeReply);
  if(safeReferences)lines.push('References: '+safeReferences);
  lines.push('',String(body||'').replace(/\0/g,''));
  const payload={raw:b64urlEncode(lines.join('\r\n'))};if(safeThread)payload.threadId=safeThread;
  const result=await gmailFetch(adminEmail,'/messages/send',{method:'POST',body:JSON.stringify(payload)},expectedGmailEmail??conn?.gmailEmail);
  if(!result||typeof result!=='object'||Array.isArray(result)||typeof result.id!=='string'||!result.id.trim()||typeof result.threadId!=='string'||!result.threadId.trim())throw Object.assign(new Error('Gmail send response could not be verified'),{code:'GMAIL_DELIVERY_UNCERTAIN',deliveryState:'uncertain'});
  const threadMismatch=!!safeThread&&result.threadId!==safeThread,warnings=[];
  if(threadMismatch)warnings.push('Gmail message sent, but Gmail placed it in a different thread. Refresh the inbox to review the sent message before replying again.');
  try{for(const id of new Set([safeThread,result.threadId].filter(Boolean)))await kv.del(threadCacheKey(adminEmail,id,conn?.gmailEmail))}
  catch(_){warnings.push('Gmail message sent, but cached detail could not be refreshed. Refresh the inbox before sending again.')}
  return warnings.length?{...result,threadMismatch,warning:warnings.join(' ')}:result;
}
module.exports={configReady,oauthUrl,exchangeCode,saveConnection,getConnection,disconnect,gmailFetch,listInbox,listAliases,markThreadRead,sendMessage};
