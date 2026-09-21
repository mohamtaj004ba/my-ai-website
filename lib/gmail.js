const crypto=require('crypto');
const {kv}=require('@vercel/kv');

function encKey(){
  const secret=process.env.CALLERCORE_ENCRYPTION_KEY;
  if(!secret)throw new Error('CALLERCORE_ENCRYPTION_KEY missing');
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
function configReady(){return !!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.CALLERCORE_ENCRYPTION_KEY)}
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
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'
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
async function saveConnection(adminEmail,tokens,profile={}){
  const key='integration:gmail:admin:'+String(adminEmail).toLowerCase();
  const existing=await kv.get(key)||{};
  let refresh='';
  if(tokens.refresh_token)refresh=tokens.refresh_token;
  else if(existing.refreshTokenEnc)refresh=decryptJson(existing.refreshTokenEnc).token;
  if(!refresh)throw new Error('Google did not return a refresh token');
  const value={adminEmail:String(adminEmail).toLowerCase(),gmailEmail:profile.emailAddress||profile.email||existing.gmailEmail||'',
    refreshTokenEnc:encryptJson({token:refresh}),accessTokenEnc:tokens.access_token?encryptJson({token:tokens.access_token}):existing.accessTokenEnc||'',
    accessExpiresAt:tokens.expires_in?Date.now()+Number(tokens.expires_in)*1000:existing.accessExpiresAt||0,
    scope:tokens.scope||existing.scope||'',connectedAt:existing.connectedAt||Date.now(),updatedAt:Date.now()};
  await kv.set(key,value);return value;
}
async function getConnection(adminEmail){return kv.get('integration:gmail:admin:'+String(adminEmail).toLowerCase())}
async function disconnect(adminEmail){await kv.del('integration:gmail:admin:'+String(adminEmail).toLowerCase())}
async function accessToken(adminEmail){
  const c=await getConnection(adminEmail);if(!c)throw new Error('Gmail is not connected');
  if(c.accessTokenEnc&&Number(c.accessExpiresAt||0)>Date.now()+60000)return decryptJson(c.accessTokenEnc).token;
  const refresh=decryptJson(c.refreshTokenEnc).token;
  const t=await tokenRequest({refresh_token:refresh,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,grant_type:'refresh_token'});
  await saveConnection(adminEmail,{...t,refresh_token:refresh},{emailAddress:c.gmailEmail});return t.access_token;
}
async function gmailFetch(adminEmail,path,opts={}){
  const token=await accessToken(adminEmail);
  const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me'+path,{...opts,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opts.headers||{})}});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error?.message||'Gmail API request failed');return data;
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
async function listInbox(adminEmail,{maxResults=40,query='newer_than:30d'}={}){
  const conn=await getConnection(adminEmail);if(!conn)return {connected:false,threads:[],analytics:{}};
  const list=await gmailFetch(adminEmail,'/threads?maxResults='+Math.min(100,maxResults)+'&q='+encodeURIComponent(query));
  const refs=list.threads||[];
  const threads=(await Promise.all(refs.map(async ref=>{
    const t=await gmailFetch(adminEmail,'/threads/'+encodeURIComponent(ref.id)+'?format=full');
    const messages=(t.messages||[]).map(m=>{const h=headersMap(m),from=emailFromHeader(h.from),to=emailFromHeader(h.to);return {
      id:m.id,threadId:t.id,from,to,subject:h.subject||'(no subject)',date:h.date||'',messageId:h['message-id']||'',snippet:m.snippet||'',body:extractBody(m.payload).slice(0,12000),
      at:Number(m.internalDate||0),unread:(m.labelIds||[]).includes('UNREAD'),direction:from===String(conn.gmailEmail||'').toLowerCase()?'outbound':'inbound'
    }}).sort((a,b)=>a.at-b.at);
    const last=messages[messages.length-1]||{};return {id:t.id,historyId:t.historyId||'',messages,last,subject:last.subject||'(no subject)',lastAt:last.at||0,unread:messages.some(m=>m.unread&&m.direction==='inbound')};
  }))).sort((a,b)=>b.lastAt-a.lastAt);
  let inbound=0,outbound=0,responses=[],unread=0;
  for(const t of threads){
    if(t.unread)unread++;
    t.messages.forEach(m=>m.direction==='inbound'?inbound++:outbound++);
    const firstIn=t.messages.find(m=>m.direction==='inbound');if(firstIn){const reply=t.messages.find(m=>m.direction==='outbound'&&m.at>firstIn.at);if(reply)responses.push((reply.at-firstIn.at)/1000)}
  }
  return {connected:true,gmailEmail:conn.gmailEmail,threads,analytics:{threads:threads.length,unread,inbound,outbound,avgFirstResponseSeconds:responses.length?Math.round(responses.reduce((a,b)=>a+b,0)/responses.length):0}};
}
async function markThreadRead(adminEmail,threadId){
  if(!threadId)return;
  return gmailFetch(adminEmail,'/threads/'+encodeURIComponent(threadId)+'/modify',{method:'POST',body:JSON.stringify({removeLabelIds:['UNREAD']})});
}
async function sendMessage(adminEmail,{to,subject,body,threadId='',inReplyTo='',references=''}){
  const lines=['To: '+to,'Subject: '+subject,'MIME-Version: 1.0','Content-Type: text/plain; charset="UTF-8"'];
  if(inReplyTo)lines.push('In-Reply-To: '+inReplyTo);
  if(references)lines.push('References: '+references);
  lines.push('',body);
  const payload={raw:b64urlEncode(lines.join('\r\n'))};if(threadId)payload.threadId=threadId;
  return gmailFetch(adminEmail,'/messages/send',{method:'POST',body:JSON.stringify(payload)});
}
module.exports={configReady,oauthUrl,exchangeCode,saveConnection,getConnection,disconnect,gmailFetch,listInbox,markThreadRead,sendMessage};