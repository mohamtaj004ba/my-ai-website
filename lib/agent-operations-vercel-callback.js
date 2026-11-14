'use strict';
function createHandler({env,createRuntime,rateLimit}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='feature/callercore-dashboards'||env.CALLERCORE_AGENTOPS_ENABLED!=='true')return res.status(503).send('Connection unavailable outside authorized Preview.');
 if(req.method!=='GET')return res.status(405).send('Method not allowed.');
 const q=req.query||{};if(Object.keys(q).some(k=>!['state','code','configurationId','teamId','source','next','error'].includes(k))||Object.values(q).some(v=>typeof v!=='string'||v.length>2048)||!/^[A-Za-z0-9_-]{43}$/.test(q.state||''))return res.status(400).send('Invalid connection response.');
 try{const runtime=createRuntime(req),actor=await runtime.owner();if((await rateLimit({scope:'agentops-vercel-oauth',identifier:actor.id,limit:10,windowSeconds:60,failClosed:true})).limited)return res.status(429).send('Please wait before restarting connection.');await runtime.connection.callback(actor,q);return res.redirect('/admin-dashboard?vercel=connected');}
 catch{return res.status(409).send('Vercel connection unconfirmed. Return to Agent Operations and inspect connection status. Do not replay this response.');}
};}
module.exports={createHandler};
