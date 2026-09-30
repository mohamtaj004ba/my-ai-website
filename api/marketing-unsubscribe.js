const {kv}=require('../lib/kv');
const {safeError}=require('../lib/safe-log');
const {rateLimit,requestIp}=require('../lib/rate-limit');
const {inspectMarketingUnsubscribe,revokeMarketingUnsubscribe}=require('../lib/prospect-unsubscribe');

const SECRET=process.env.MARKETING_UNSUBSCRIBE_SECRET||'';

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  if(!SECRET||SECRET.length<32)return res.status(503).json({error:'Email preference management is temporarily unavailable. Please contact support@callercore.com.'});
  const rl=await rateLimit({scope:'marketing-unsubscribe',identifier:requestIp(req),limit:30,windowSeconds:600,failClosed:true});
  if(rl.limited){res.setHeader('Retry-After',String(rl.retryAfter));return res.status(429).json({error:'Too many requests. Please try again later.'})}
  const token=String(req.method==='GET'?(req.query||{}).token:(req.body||{}).token||'').slice(0,512);
  if(!token)return res.status(400).json({error:'This unsubscribe link is invalid or incomplete.'});
  try{
    if(req.method==='GET'){
      const status=await inspectMarketingUnsubscribe(kv,token,SECRET);
      return res.status(200).json({ok:true,state:status.state,active:status.active,alreadyUnsubscribed:status.alreadyUnsubscribed});
    }
    const result=await revokeMarketingUnsubscribe(kv,token,SECRET,{now:Date.now()});
    return res.status(200).json({ok:true,unsubscribed:true,alreadyUnsubscribed:result.alreadyUnsubscribed===true});
  }catch(err){
    const code=String(err?.code||'');
    if(code==='INVALID_TOKEN'||code==='NOT_ACTIVE')return res.status(400).json({error:'This unsubscribe link is invalid or no longer current.'});
    if(code==='CONFLICT')return res.status(409).json({error:'Your email preference changed while we were saving. Please try again.'});
    console.error('marketing unsubscribe failed',safeError(err));
    return res.status(503).json({error:'We could not confirm your email preference change. Please contact support@callercore.com.'});
  }
};
