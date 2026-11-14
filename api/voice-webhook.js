const {previewGate,authenticated,VoiceError}=require('../lib/voice-provider');
const {processMessage}=require('../lib/voice-service');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{previewGate()}catch{return res.status(503).json({error:'Voice testing is not enabled'})}
  if(!authenticated(req.headers,process.env.CALLERCORE_VOICE_WEBHOOK_SECRET))return res.status(401).json({error:'Authentication required'});
  if(!req.body||Buffer.byteLength(JSON.stringify(req.body))>300000)return res.status(413).json({error:'Voice event too large'});
  try{
    const {kv}=require('../lib/kv'),{rateLimit}=require('../lib/rate-limit');
    const callId=req.body.message?.call?.id;
    const limit=await rateLimit({scope:'voice-webhook',identifier:String(callId||'invalid').slice(0,100),limit:100,windowSeconds:60,failClosed:true});
    if(limit.limited)return res.status(429).json({error:'Voice event limit reached'});
    const result=await processMessage(kv,req.body.message);
    if(['status-update','end-of-call-report'].includes(req.body.message?.type)){
      try{
        require('@vercel/functions').waitUntil(require('../lib/voice-recovery').recoverAfterEvent(kv,callId).catch(()=>{console.error('CallerCore voice recovery pending','VOICE_RECOVERY_UNCONFIRMED')}));
      }catch{console.error('CallerCore voice recovery pending','VOICE_RECOVERY_UNCONFIRMED')}
    }
    return res.status(200).json(result);
  }catch(e){
    const code=e instanceof VoiceError?e.code:'VOICE_EVENT_UNCONFIRMED';
    // Never print request bodies, provider response objects, credentials or transcripts.
    console.error('CallerCore voice event unavailable',code);
    const status=['VOICE_ASSOCIATION_INVALID','VOICE_RESOURCE_INVALID'].includes(code)?403:503;
    return res.status(status).json({error:'Call processing could not be confirmed',code});
  }
};
