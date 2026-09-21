const crypto=require('crypto');
const {kv}=require('@vercel/kv');
const SESSION_TTL=60*60*24*7;
function parseCookies(req){return String(req.headers.cookie||'').split(';').reduce((a,p)=>{const i=p.indexOf('=');if(i>0)a[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim());return a},{})}
async function getSession(req){
  const token=parseCookies(req).cc_session;if(!token)return null;
  const s=await kv.get('session:'+token);if(!s||!s.workspaceId)return null;
  const email=String(s.email||'').trim().toLowerCase();
  if(email){
    const member=await kv.get('user:email:'+email);
    if(!member)return null;
    if(member.sessionVersion!==undefined&&Number(s.authVersion||0)!==Number(member.sessionVersion||0))return null;
  }
  return s
}
async function requireSession(req,res){const s=await getSession(req);if(!s){res.status(401).json({error:'Authentication required'});return null}return s}
async function createSession(res,payload){const token=crypto.randomBytes(32).toString('hex');await kv.set('session:'+token,{...payload,createdAt:Date.now()},{ex:SESSION_TTL});const secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie','cc_session='+encodeURIComponent(token)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+SESSION_TTL+secure);return token}
function clearSessionCookie(res){const secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie','cc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+secure)}
function cleanEmail(v){return String(v||'').trim().toLowerCase().slice(0,200)}
module.exports={parseCookies,getSession,requireSession,createSession,clearSessionCookie,cleanEmail,SESSION_TTL};
