'use strict';
const prefix=value=>typeof value==='string'&&value.startsWith('agw_');
function usesWorkspaceFlow(query){return prefix(query?.state)||Array.isArray(query?.state)&&query.state.some(prefix);}
function createHandler({env,createRuntime,rateLimit,timeoutMs=40000}){if(!Number.isSafeInteger(timeoutMs)||timeoutMs<50||timeoutMs>40000)throw Error('GW_CALLBACK_CONFIGURATION');return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='feature/callercore-dashboards'||env.CALLERCORE_AGENTOPS_ENABLED!=='true')return res.status(503).send('Workspace connection unavailable outside authorized Preview.');
 if(req.method!=='GET')return res.status(405).send('Method not allowed.');
 const query=req.query||{};
 // Reject duplicate raw parameters even when an HTTP query parser keeps only one.
 if(typeof req.url==='string'){let raw;try{raw=new URL(req.url,'https://callback.invalid').searchParams;}catch{return res.status(400).send('Invalid Workspace connection response.');}if([...new Set(raw.keys())].some(k=>raw.getAll(k).length!==1))return res.status(400).send('Invalid Workspace connection response.');}
 if(String(req.headers?.host||'')!==new URL(require('./agent-operations-google-workspace-oauth').REDIRECT).host||Object.keys(query).some(k=>!['state','iss','code','error','error_description','scope','authuser','prompt','hd'].includes(k))||Object.values(query).some(v=>typeof v!=='string'||v.length>6000)||(Object.hasOwn(query,'iss')&&query.iss!=='https://accounts.google.com')||!/^agw_[a-f0-9]{48}$/.test(query.state||''))return res.status(400).send('Invalid Workspace connection response.');
 const controller=new AbortController();let timer;
 try{const result=await Promise.race([(async()=>{const runtime=createRuntime(req),actor=await runtime.owner();if(controller.signal.aborted)throw Error('GW_CALLBACK_TIMEOUT');if((await rateLimit({scope:'agentops-google-workspace-oauth',identifier:actor.id,limit:10,windowSeconds:60,failClosed:true})).limited)return'limited';if(controller.signal.aborted)throw Error('GW_CALLBACK_TIMEOUT');await runtime.connection.callback(actor,query,{signal:controller.signal});if(controller.signal.aborted)throw Error('GW_CALLBACK_TIMEOUT');return'recorded';})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('GW_CALLBACK_TIMEOUT'));},timeoutMs);})]);
  return result==='limited'?res.status(429).send('Please wait before restarting connection.'):res.redirect('/admin-dashboard?workspace=verification-required');
 }catch(error){const detail=require('./agent-operations-google-workspace-oauth').failureFor(error);return res.status(409).send((detail?.cleanup==='unconfirmed'||controller.signal.aborted)?'Workspace connection unconfirmed; cleanup may be incomplete. Return to Agent Operations and inspect the saved unconfirmed record. Agent access remains disabled. Do not replay this response.':'Workspace connection unconfirmed. Return to Agent Operations and inspect status. Agent access remains disabled. Do not replay this response.');}
 finally{clearTimeout(timer);controller.abort();}
};}
module.exports={usesWorkspaceFlow,createHandler};
