const {previewGate,authenticated}=require('../lib/voice-provider');
// Uses the existing restricted voice callback credential. No new credential,
// arbitrary tenant selector, customer activation or public cron is introduced.
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{previewGate()}catch{return res.status(503).json({error:'Voice recovery is not enabled'})}
  // A configured recovery-only credential supersedes the provider callback
  // credential here. It is never accepted by webhook or live tool routes.
  if(!authenticated(req.headers,process.env.CALLERCORE_VOICE_MAINTENANCE_SECRET||process.env.CALLERCORE_VOICE_WEBHOOK_SECRET))return res.status(401).json({error:'Authentication required'});
  if(Object.keys(req.query||{}).length||req.body&&(typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).length))return res.status(400).json({error:'This recovery endpoint does not accept workspace selectors'});
  try{
    const {rateLimit}=require('../lib/rate-limit');
    if((await rateLimit({scope:'voice-maintenance',identifier:'isolated-resources',limit:2,windowSeconds:60,failClosed:true})).limited)return res.status(429).json({error:'Recovery is already being checked. Please wait a moment.'});
    return res.status(200).json(await require('../lib/voice-recovery').maintenance(require('../lib/kv').kv));
  }catch{console.error('CallerCore voice recovery unavailable','VOICE_RECOVERY_UNCONFIRMED');return res.status(503).json({error:'Recovery could not be confirmed. Pending call details are preserved.'})}
};
