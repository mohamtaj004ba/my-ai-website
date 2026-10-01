const {kv}=require('../lib/kv');
const {exchangeCode,saveConnection}=require('../lib/gmail');
const {safeError}=require('../lib/safe-log');

function validOauthRedirect(value){
  try{
    const url=new URL(String(value||''));
    return url.protocol==='https:'&&url.pathname==='/api/google-oauth-callback'&&
      (url.hostname==='callercore.com'||url.hostname==='www.callercore.com'||url.hostname.endsWith('.vercel.app'));
  }catch(_){return false}
}
function validOauthStateRecord(record){
  if(!record||typeof record!=='object'||Array.isArray(record))return false;
  const email=String(record.adminEmail||'').trim().toLowerCase(),createdAt=Number(record.createdAt);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&validOauthRedirect(record.redirectUri)&&
    Number.isFinite(createdAt)&&createdAt>0&&Date.now()-createdAt>=0&&Date.now()-createdAt<=15*60*1000;
}

module.exports=async function handler(req,res){
  const state=String(req.query?.state||''),code=String(req.query?.code||''),error=String(req.query?.error||'');
  if(error)return res.redirect('/admin-dashboard?gmail=error');
  if(!/^[a-f0-9]{48}$/.test(state)||!code)return res.status(400).send('Missing or invalid Gmail OAuth response');
  const key='oauth:gmail:'+state,record=await kv.get(key);
  if(!validOauthStateRecord(record))return res.status(400).send('Invalid or expired Gmail connection request');
  await kv.del(key);
  if(await kv.get(key)!=null)return res.status(503).send('Gmail connection request could not be consumed safely');
  try{
    const tokens=await exchangeCode({code,redirectUri:record.redirectUri});
    const profileRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+tokens.access_token}});
    const profile=await profileRes.json().catch(()=>({}));
    if(!profileRes.ok)throw new Error(profile.error?.message||'Unable to read Gmail profile');
    await saveConnection(record.adminEmail,tokens,profile);
    return res.redirect('/admin-dashboard?gmail=connected');
  }catch(err){
    console.error('gmail oauth callback failed',safeError(err));
    return res.redirect('/admin-dashboard?gmail=error');
  }
};