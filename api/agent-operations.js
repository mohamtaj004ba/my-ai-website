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
    const adapter=redisAdapter(kv),store=createStore(adapter,{scope:{origin:process.env.CALLERCORE_AGENTOPS_PREVIEW_ORIGIN,commit:process.env.CALLERCORE_AGENTOPS_COMMIT}});
    const organization=require('../lib/agent-operations-organization').createOrganization(adapter,{scope:store.scope,runtime:{origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA},paidEnabled:()=>process.env.CALLERCORE_AGENTOPS_PAID_ENABLED==='true',liveApproval:()=>require('../lib/agent-operations-organization-approval').approval({...process.env,CALLERCORE_AGENTOPS_PAID_ENABLED:'true'},store.scope)});
    return require('../lib/agent-operations-api').createHandler({env:process.env,store,organization,lifecycleVerification:require('../lib/agent-operations-lifecycle-verification').createVerification({kv,env:process.env,runtime:{origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA}}),getSession,getWorkspace:id=>kv.get('workspace:'+id),getMember:email=>kv.get('user:email:'+String(email).trim().toLowerCase()),rateLimit})(req,res);
  }catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Agent Operations configuration is unavailable.'});}
};
