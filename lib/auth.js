const crypto=require('crypto');
const {kv}=require('./kv');
const SESSION_TTL=60*60*24*7;
function parseCookies(req){return String(req.headers.cookie||'').slice(0,8192).split(';').reduce((a,p)=>{const i=p.indexOf('=');if(i>0){const name=p.slice(0,i).trim();try{a[name]=decodeURIComponent(p.slice(i+1).trim()).slice(0,512)}catch(_){/* Ignore malformed cookie values. */}}return a},{})}
function sessionKey(token){return 'session:v2:'+crypto.createHash('sha256').update(String(token||'')).digest('hex')}
async function readSessionToken(token){
  if(!token)return null;
  const hashed=await kv.get(sessionKey(token));if(hashed)return hashed;
  // Temporary backwards compatibility for sessions created before hashed-at-rest storage.
  return kv.get('session:'+token);
}
async function destroySessionToken(token){
  if(!token)return;
  const hashedKey=sessionKey(token),legacyKey='session:'+token;
  await Promise.all([kv.del(hashedKey),kv.del(legacyKey)]);
  const [hashed,legacy]=await Promise.all([kv.get(hashedKey),kv.get(legacyKey)]);
  if(hashed!=null||legacy!=null)throw new Error('Session revocation could not be confirmed');
}
async function getSession(req){
  const token=parseCookies(req).cc_session;if(!token)return null;
  const s=await readSessionToken(token);
  if(!s||typeof s!=='object'||Array.isArray(s)||!String(s.workspaceId||'')||!String(s.email||''))return null;
  const email=String(s.email||'').trim().toLowerCase();
  const member=await kv.get('user:email:'+email);
  if(!member||typeof member!=='object'||Array.isArray(member)||member.disabled)return null;
  if(member.email&&String(member.email).trim().toLowerCase()!==email)return null;
  if(!s.adminView&&String(member.workspaceId||'')!==String(s.workspaceId))return null;
  if(s.adminView&&(member.role!=='admin'||String(member.workspaceId||'')!==String(s.adminHomeWorkspaceId||'')))return null;
  if(member.sessionVersion!==undefined&&Number(s.authVersion||0)!==Number(member.sessionVersion||0))return null;
  return s
}
async function requireSession(req,res){const s=await getSession(req);if(!s){res.status(401).json({error:'Authentication required'});return null}return s}
async function createSession(res,payload){
  const token=crypto.randomBytes(32).toString('hex'),key=sessionKey(token),record={...payload,createdAt:Date.now()};
  if(!String(record.email||'')||!String(record.workspaceId||''))throw new Error('Session identity incomplete');
  await kv.set(key,record,{ex:SESSION_TTL});
  const confirmed=await kv.get(key);
  if(!confirmed||typeof confirmed!=='object'||Array.isArray(confirmed)||
    String(confirmed.email||'').trim().toLowerCase()!==String(record.email||'').trim().toLowerCase()||
    String(confirmed.workspaceId||'')!==String(record.workspaceId||'')||
    String(confirmed.role||'')!==String(record.role||'')||
    Number(confirmed.createdAt||0)!==Number(record.createdAt))
    throw new Error('Session persistence could not be confirmed');
  const secure=process.env.NODE_ENV==='production'?'; Secure':'';
  res.setHeader('Set-Cookie','cc_session='+encodeURIComponent(token)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+SESSION_TTL+secure);
  return token
}
function clearSessionCookie(res){const secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie','cc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+secure)}
function cleanEmail(v){return String(v||'').trim().toLowerCase().slice(0,200)}
module.exports={parseCookies,getSession,requireSession,createSession,clearSessionCookie,cleanEmail,SESSION_TTL,destroySessionToken,sessionKey};
