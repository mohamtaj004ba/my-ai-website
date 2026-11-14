'use strict';
// Callback code and provider credentials never enter application logs or responses.
module.exports=async(req,res)=>{
 const env=process.env;
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='feature/callercore-dashboards'||env.CALLERCORE_AGENTOPS_ENABLED!=='true'){res.setHeader('Cache-Control','no-store');return res.status(503).send('Connection unavailable outside authorized Preview.');}
 const {kv}=require('../lib/kv'),{getSession}=require('../lib/auth'),{rateLimit}=require('../lib/rate-limit');
 return require('../lib/agent-operations-vercel-callback').createHandler({env,rateLimit,createRuntime:request=>require('../lib/agent-operations-vercel-runtime').createRuntime({kv,getSession,request,env})})(req,res);
};
