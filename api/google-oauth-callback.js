const {kv}=require('@vercel/kv');
const {exchangeCode,saveConnection}=require('../lib/gmail');

module.exports=async function handler(req,res){
  const state=String(req.query?.state||''),code=String(req.query?.code||''),error=String(req.query?.error||'');
  if(error)return res.redirect('/admin-dashboard?gmail=error');
  if(!state||!code)return res.status(400).send('Missing Gmail OAuth response');
  const key='oauth:gmail:'+state,record=await kv.get(key);
  if(!record||!record.adminEmail||!record.redirectUri)return res.status(400).send('Invalid or expired Gmail connection request');
  await kv.del(key);
  try{
    const tokens=await exchangeCode({code,redirectUri:record.redirectUri});
    const profileRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+tokens.access_token}});
    const profile=await profileRes.json().catch(()=>({}));
    if(!profileRes.ok)throw new Error(profile.error?.message||'Unable to read Gmail profile');
    await saveConnection(record.adminEmail,tokens,profile);
    return res.redirect('/admin-dashboard?gmail=connected');
  }catch(err){
    console.error('gmail oauth callback failed',err);
    return res.redirect('/admin-dashboard?gmail=error');
  }
};