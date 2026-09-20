const crypto=require('crypto');
const {kv}=require('@vercel/kv');
const {cleanEmail}=require('../lib/auth');
const {sendMail}=require('../lib/mail');
const SITE_URL=process.env.SITE_URL||'https://www.callercore.com';
const WINDOW=10*60,MAX=5;
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const email=cleanEmail((req.body||{}).email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(200).json({ok:true});
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const bucket='auth:rate:'+crypto.createHash('sha256').update(ip).digest('hex');
  const count=(await kv.incr(bucket)); if(count===1)await kv.expire(bucket,WINDOW);
  if(count>MAX)return res.status(429).json({error:'Too many requests. Try again shortly.'});
  const member=await kv.get('user:email:'+email);
  if(member&&member.workspaceId){
    const token=crypto.randomBytes(32).toString('hex');
    await kv.set('login:'+token,{email,workspaceId:member.workspaceId,role:member.role||'owner'},{ex:15*60});
    const link=SITE_URL+'/api/auth-verify?token='+encodeURIComponent(token);
    try{await sendMail({to:email,subject:'Your CallerCore sign-in link',text:'Use this secure link to sign in to CallerCore:\n\n'+link+'\n\nThis link expires in 15 minutes.',html:'<p>Use this secure link to sign in to CallerCore:</p><p><a href="'+link+'">Sign in to CallerCore</a></p><p>This link expires in 15 minutes.</p>'})}
    catch(err){console.error('auth email failed',err);return res.status(503).json({error:'Sign-in email temporarily unavailable'})}
  }
  return res.status(200).json({ok:true});
};