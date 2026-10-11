'use strict';
// Lazy loading preserves disabled/Production behavior without reading storage.
module.exports=async(req,res)=>{
  if(process.env.VERCEL_ENV!=='preview'||process.env.CALLERCORE_AGENTOPS_ENABLED!=='true'){
    res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Agent Operations is disabled outside authorized Preview.'});
  }
  try{
    const {kv}=require('../lib/kv');
    const {getSession}=require('../lib/auth');
    const {rateLimit}=require('../lib/rate-limit');
    const {createStore,redisAdapter}=require('../lib/agent-operations-store');
    const store=createStore(redisAdapter(kv),{scope:{origin:process.env.CALLERCORE_AGENTOPS_PREVIEW_ORIGIN,commit:process.env.CALLERCORE_AGENTOPS_COMMIT}});
    return require('../lib/agent-operations-api').createHandler({env:process.env,store,getSession,getMember:email=>kv.get('user:email:'+String(email).trim().toLowerCase()),rateLimit})(req,res);
  }catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Agent Operations configuration is unavailable.'});}
};
