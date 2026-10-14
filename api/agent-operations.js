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
    const organization=require('../lib/agent-operations-organization').createOrganization(adapter,{workerRevocationToken:approval=>require('../lib/agent-operations-worker-revocation').derive({workerSecret:process.env.CALLERCORE_AGENTOPS_WORKER_SECRET,approval,runtime:{origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA}}),scope:store.scope,runtime:{origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA},paidEnabled:()=>process.env.CALLERCORE_AGENTOPS_PAID_ENABLED==='true',liveApproval:()=>require('../lib/agent-operations-organization-approval').approval({...process.env,CALLERCORE_AGENTOPS_PAID_ENABLED:'true'},store.scope)});
    const trustedReview=require('../lib/agent-operations-trusted-review').createTrustedReview(adapter,{runtime:{environment:process.env.VERCEL_ENV,origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA},assertReviewer:require('../lib/agent-operations-trusted-review').createOwnerReviewPolicy({getSession,getMember:email=>kv.get('user:email:'+email),getWorkspace:id=>kv.get('workspace:'+id),request:req})});
    const ownerPolicy=require('../lib/agent-operations-trusted-review').createOwnerReviewPolicy({getSession,getMember:email=>kv.get('user:email:'+email),getWorkspace:id=>kv.get('workspace:'+id),request:req});
    const operations=require('../lib/agent-operations-operating-system').createOperations({kv,ledgerAdapter:adapter,runtime:{branch:process.env.VERCEL_GIT_COMMIT_REF,environment:process.env.VERCEL_ENV,origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA},assertOwner:async actor=>{await ownerPolicy(actor,null,'read',{ownerHash:require('../lib/agent-operations-monitoring').identity(actor.id),originalWorkspaceId:actor.workspaceId});return true;}});
    return require('../lib/agent-operations-api').createHandler({env:process.env,store,organization,trustedReview,operations,organizationalRehearsal:require('../lib/agent-operations-organizational-rehearsal').createRehearsal({kv,env:process.env,runtime:{origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA},scope:store.scope}),transportVerification:require('../lib/agent-operations-transport-verification').createTransportVerification({kv,env:process.env,runtime:{origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA}}),lifecycleVerification:require('../lib/agent-operations-lifecycle-verification').createVerification({kv,env:process.env,runtime:{origin:'https://'+process.env.VERCEL_URL,commit:process.env.VERCEL_GIT_COMMIT_SHA}}),getSession,getWorkspace:id=>kv.get('workspace:'+id),getMember:email=>kv.get('user:email:'+String(email).trim().toLowerCase()),rateLimit})(req,res);
  }catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Agent Operations configuration is unavailable.'});}
};
