const {kv}=require('@vercel/kv');
const {createSession}=require('../lib/auth');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).end();
  const token=String((req.query||{}).token||'');
  if(!/^[a-f0-9]{64}$/.test(token))return res.redirect(302,'/login?error=invalid');
  const key='login:'+token,record=await kv.get(key);
  if(!record||!record.workspaceId)return res.redirect(302,'/login?error=expired');
  await kv.del(key);
  await createSession(res,{email:record.email,workspaceId:record.workspaceId,role:record.role||'owner'});
  return res.redirect(302,'/dashboard');
};