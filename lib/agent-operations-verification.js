'use strict';
const objectives=Object.freeze({happy:'MOCK verification: delegated Legal/Growth inspection with independent QA; synthetic evidence only.',cancel:'MOCK verification: cancel an active synthetic inspection; no model or external action.'});
function configuration(env,now=Date.now()){
  const nonce=env.CALLERCORE_AGENTOPS_VERIFICATION_ID,start=Number(env.CALLERCORE_AGENTOPS_VERIFICATION_START),end=Number(env.CALLERCORE_AGENTOPS_VERIFICATION_END);
  if(env.VERCEL_ENV!=='preview'||env.CALLERCORE_AGENTOPS_ENABLED!=='true'||env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='false'||!/^[a-f0-9]{24}$/.test(nonce||'')||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>now||end<=now||end<=start||end-start>7200000||env.CALLERCORE_AGENTOPS_VERIFICATION_SECRET===env.CALLERCORE_AGENTOPS_WORKER_SECRET)throw new Error('Mock verification unavailable');
  return {nonce,principal:'mock-verifier:'+nonce};
}
async function handleVerification({env,store,req,res,rateLimit,runtime}){
  let config;try{config=configuration(env);}catch{return res.status(403).json({error:'Mock verification unavailable'});}
  if(Object.keys(req.query||{}).length)return res.status(403).json({error:'Verification selectors denied'});
  if((await rateLimit({scope:'agentops-verification',identifier:config.nonce,limit:60,windowSeconds:60,failClosed:true})).limited)return res.status(429).json({error:'Verification rate limited'});
  if(await store.verificationRevoked(config.nonce))return res.status(403).json({error:'Mock verification closed'});
  const state=await store.read(),tasks=state.tasks.filter(t=>t.principal===config.principal&&t.mode==='mock');
  if(req.method==='GET')return res.status(200).json({mode:'mock',paidExecution:false,runtime,scope:store.scope,tasks:tasks.map(({principal,requestHash,payloadHash,...t})=>t),reservations:state.reservations.filter(r=>tasks.some(t=>t.id===r.taskId))});
  const b=req.body;
  if(!b||typeof b!=='object'||Array.isArray(b)||Buffer.byteLength(JSON.stringify(b))>1000)return res.status(403).json({error:'Verification action denied'});
  if(b.action==='close-verification'&&Object.keys(b).length===1){await store.revokeVerification(config.nonce);return res.status(200).json({closed:true});}
  if(b.action==='create-fixture'&&Object.keys(b).length===2&&Object.hasOwn(objectives,b.fixture)){
    const t=await store.create({principal:config.principal,idempotencyKey:'verify_'+config.nonce+'_'+b.fixture,objective:objectives[b.fixture],mode:'mock'});
    const {principal,requestHash,payloadHash,...task}=t;return res.status(201).json({task});
  }
  if(b.action==='cancel-fixture'&&Object.keys(b).length===3&&Number.isSafeInteger(b.expectedRevision)&&tasks.some(t=>t.id===b.id)){
    const t=await store.command(b.id,{type:'cancel',expectedRevision:b.expectedRevision});const {principal,requestHash,payloadHash,...task}=t;return res.status(200).json({task});
  }
  return res.status(403).json({error:'Verification action denied'});
}
module.exports={configuration,handleVerification};
