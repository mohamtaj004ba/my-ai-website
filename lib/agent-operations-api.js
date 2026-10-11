'use strict';
const {timingSafeEqual}=require('node:crypto');
const {ROLES,TOOLS}=require('./agent-operations-policy');
const {hash,LIMITS}=require('./agent-operations-store');
const {MODEL,PRICING,approvalCheck}=require('./agent-operations-pilot');
function trustedApproval(env,scope){
  if(env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='true')return null;
  try{const a=JSON.parse(env.CALLERCORE_AGENTOPS_PILOT_APPROVAL);
    if(a.authorized!==true||!/^pilot_[a-zA-Z0-9_-]{8,60}$/.test(a.id)||a.expiresAt<=Date.now()||a.scopeHash!==hash(scope)||a.maxMicros!==LIMITS.taskMicros||a.model!==MODEL||a.pricingVersion!==PRICING.version)return null;
    return a;
  }catch{return null;}
}
function secretMatches(value,expected){if(typeof expected!=='string'||expected.length<32)return false;const a=Buffer.from(String(value||'')),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
function createHandler({env,store,getSession,getMember,rateLimit}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(env.VERCEL_ENV!=='preview'||env.CALLERCORE_AGENTOPS_ENABLED!=='true')return res.status(503).json({error:'Agent Operations is disabled outside authorized Preview.'});
    if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
    try{
      const bearer=String(req.headers.authorization||'').replace(/^Bearer /,'');
      const worker=secretMatches(bearer,env.CALLERCORE_AGENTOPS_WORKER_SECRET);
      let principal;
      if(!worker){
        const s=await getSession(req);
        if(!s)return res.status(401).json({error:'Authentication required'});
        const m=await getMember(s.email);
        if(s.adminView||!m||m.disabled||m.role!=='admin'||s.workspaceId!==m.workspaceId||String(m.email||s.email).toLowerCase()!==String(s.email).toLowerCase())return res.status(403).json({error:'Internal administrator access required'});
        principal=String(s.email).toLowerCase();
        if(req.method==='POST'){
          let same=false;try{same=new URL(req.headers.origin).host===req.headers.host;}catch{}
          if(!same)return res.status(403).json({error:'Same-origin request required'});
        }
      }
      if((await rateLimit({scope:'agentops',identifier:worker?'worker':principal,limit:worker?120:30,windowSeconds:60,failClosed:true})).limited)return res.status(429).json({error:'Please wait before retrying.'});
      if(Object.keys(req.query||{}).length)return res.status(400).json({error:'Query selectors are not supported'});
      if(req.method==='GET'){
        const state=await store.read();
        const approval=trustedApproval(env,store.scope),pilot=approval?state.tasks.find(t=>t.approvalId===approval.id):null;
        return res.status(200).json({mode:'mock',paidExecution:!!approval,scope:store.scope,revision:state.revision,
          ...(worker&&approval&&pilot?{pilotApproval:{...approval,taskId:pilot.id}}:{}),
          agents:ROLES.map(role=>({role,tools:TOOLS[role],model:approval?MODEL+' (approved pilot only); mock by default':'mock — no API usage',version:1})),
          tasks:state.tasks.map(({principal,requestHash,payloadHash,...t})=>t),reservations:state.reservations});
      }
      const b=req.body;
      if(!b||typeof b!=='object'||Array.isArray(b)||Buffer.byteLength(JSON.stringify(b))>16000)return res.status(400).json({error:'Invalid request'});
      if(worker){
        if(b.action==='initialize-pilot'&&Object.keys(b).length===1){
          const approval=trustedApproval(env,store.scope);
          if(!approval)return res.status(403).json({error:'Paid pilot is not authorized'});
          return res.status(201).json({task:await store.create({principal:'owner-approved-pilot',idempotencyKey:approval.id,objective:'Inspect Legal dashboard imagery relevance and Growth pricing badge spacing on the pinned Preview. Read-only findings and independent QA; no code changes.',mode:'pilot',approval})});
        }
        if(b.action!=='command'||!['claim','reserve','finish','heartbeat','recover','fail'].includes(b.command?.type))return res.status(403).json({error:'Worker action not permitted'});
        const t=(await store.read()).tasks.find(t=>t.id===b.id);
        if(!t)return res.status(403).json({error:'Task is not authorized'});
        if(t.mode==='pilot'){
          const approval=trustedApproval(env,store.scope);
          try{approvalCheck(approval?{...approval,taskId:t.id}:null,t);}catch{return res.status(403).json({error:'Paid execution has not been authorized'});}
        }
        return res.status(200).json({task:await store.command(b.id,b.command)});
      }
      if(b.action==='create'&&Object.keys(b).every(k=>['action','objective','idempotencyKey'].includes(k)))return res.status(201).json({task:await store.create({principal,objective:b.objective,idempotencyKey:b.idempotencyKey,mode:'mock'})});
      if(b.action==='cancel'&&Object.keys(b).every(k=>['action','id','expectedRevision'].includes(k))&&Number.isSafeInteger(b.expectedRevision))return res.status(200).json({task:await store.command(b.id,{type:'cancel',expectedRevision:b.expectedRevision})});
      return res.status(403).json({error:'Action not permitted'});
    }catch{
      // Do not expose database/provider text, credentials or external content.
      return res.status(409).json({error:'Operation could not be confirmed. Refresh task state before retrying.'});
    }
  };
}
module.exports={createHandler,secretMatches,trustedApproval};
