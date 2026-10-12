'use strict';
const {timingSafeEqual}=require('node:crypto');
const {ROLES,TOOLS}=require('./agent-operations-policy');
const {hash,LIMITS}=require('./agent-operations-store');
const {matchesProject}=require('./agent-operations-project');
const {MODEL,PRICING,approvalCheck}=require('./agent-operations-pilot');
const {SMOKE,isSmoke}=require('./agent-operations-smoke');
const {SPECIALIST,isSpecialist,specialistScope}=require('./agent-operations-specialist');
const {QA,isQA}=require('./agent-operations-qa');
const {EF,isEF,profile:efProfile,acceptedWork}=require('./agent-operations-evidence-first');
const vm=require('./agent-operations-visual-model');
const terminal=task=>task&&['verified','failed','blocked','cancelled'].includes(task.status);
function trustedApproval(env,scope){
  if(env.VERCEL_ENV!=='preview'||env.CALLERCORE_AGENTOPS_ENABLED!=='true'||env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='true')return null;
  try{const a=JSON.parse(env.CALLERCORE_AGENTOPS_PILOT_APPROVAL);
    const smoke=isSmoke(a),specialist=isSpecialist(a),qa=isQA(a)||isEF(a),profile=isEF(a)?efProfile(a):smoke?SMOKE:specialist?SPECIALIST:qa?QA:null;
    if(!matchesProject(a)||a.authorized!==true||!/^pilot_[a-zA-Z0-9_-]{8,60}$/.test(a.id)||!Number.isSafeInteger(a.expiresAt)||a.expiresAt<=Date.now()||a.scopeHash!==hash(scope)||a.profile!==undefined&&!profile||a.maxMicros!==(profile?profile.maxMicros:LIMITS.taskMicros)||profile&&(a.maxCalls!==profile.calls||a.expiresAt>Date.now()+LIMITS.durationMs)||(vm.isHybrid(a)?!vm.approvalIdentity(a)||env.CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED!=='true'||env.CALLERCORE_AGENTOPS_SOL_VISION_BOUND_VERIFIED!=='true':a.model!==MODEL||a.pricingVersion!==PRICING.version))return null;
    if(specialist&&(!specialistScope(scope)||a.maxCalls!==SPECIALIST.calls||a.maxMicros!==SPECIALIST.maxMicros||a.expiresAt>Date.now()+LIMITS.durationMs))return null;
    if(qa&&(!specialistScope(scope)||a.sourceTaskId!==QA.sourceTaskId||a.findingsHash!==QA.findingsHash||a.evidenceHash!==QA.evidenceHash))return null;
    if(isEF(a)&&a.evaluationHash!==EF.evaluationHash)return null;
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
      const runtime={environment:env.VERCEL_ENV,commit:env.VERCEL_GIT_COMMIT_SHA,origin:env.VERCEL_URL?'https://'+env.VERCEL_URL:undefined};
      if(secretMatches(bearer,env.CALLERCORE_AGENTOPS_VERIFICATION_SECRET))return await require('./agent-operations-verification').handleVerification({env,store,req,res,rateLimit,runtime});
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
        let approval=trustedApproval(env,store.scope);const pilot=approval?state.tasks.find(t=>t.approvalId===approval.id):null;
        // A consumed smoke approval cannot advertise or initialize more paid work.
        if((isSmoke(approval)||isSpecialist(approval)||isQA(approval)||isEF(approval))&&terminal(pilot))approval=null;
        return res.status(200).json({mode:'mock',paidExecution:!!approval,runtime,scope:store.scope,revision:state.revision,acceptedWorkTaskIds:state.tasks.filter(acceptedWork).map(t=>t.id),
          chiefSmoke:{profile:SMOKE.profile,maxCalls:SMOKE.calls,reservationMicros:SMOKE.maxMicros,maxOutputTokens:SMOKE.outputTokens,requestTimeoutMs:SMOKE.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,enabled:!!approval&&isSmoke(approval)},
          independentQA:{profile:QA.profile,maxCalls:QA.calls,reservationMicros:QA.maxMicros,maxOutputTokens:QA.outputTokens,requestTimeoutMs:QA.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,sourceTaskId:QA.sourceTaskId,findingsHash:QA.findingsHash,evidenceHash:QA.evidenceHash,enabled:!!approval&&isQA(approval)},
          hybridVisualQA:{profile:vm.HYBRID.profile,preferredCandidate:true,model:vm.HYBRID.model,reasoningEffort:vm.HYBRID.reasoningEffort,serviceTier:vm.HYBRID.serviceTier,cacheMode:vm.HYBRID.cacheMode,schemaVersion:vm.HYBRID.schemaVersion,pricingVersion:vm.HYBRID.pricingVersion,modelAccessVerified:env.CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED==='true',visionBoundVerified:env.CALLERCORE_AGENTOPS_SOL_VISION_BOUND_VERIFIED==='true',maxCalls:2,reservationMicros:vm.HYBRID.maxMicros,callReservationMicros:vm.HYBRID.callMicros,outputTokens:{observe:vm.HYBRID.observeOutputTokens,adjudicate:vm.HYBRID.adjudicateOutputTokens},requestTimeoutMs:vm.HYBRID.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,evaluationHash:EF.evaluationHash,enabled:!!approval&&vm.isHybrid(approval),finalAcceptance:'requires-independent-image-review'},
          evidenceFirstQA:{profile:EF.profile,evaluationHash:EF.evaluationHash,originalFindings:4,positiveControls:2,maxCalls:EF.calls,reservationMicros:EF.maxMicros,maxOutputTokens:EF.outputTokens,requestTimeoutMs:EF.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,sourceTaskId:EF.sourceTaskId,findingsHash:EF.findingsHash,evidenceHash:EF.evidenceHash,enabled:!!approval&&isEF(approval)&&!vm.isHybrid(approval),finalAcceptance:'requires-independent-label-review'},
          chiefSpecialist:{profile:SPECIALIST.profile,maxCalls:SPECIALIST.calls,reservationMicros:SPECIALIST.maxMicros,maxOutputTokens:SPECIALIST.outputTokens,requestTimeoutMs:SPECIALIST.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,enabled:!!approval&&isSpecialist(approval)},
          ...(worker&&approval&&pilot?{pilotApproval:{...approval,taskId:pilot.id}}:{}),
          agents:ROLES.map(role=>({role,tools:TOOLS[role],model:approval?(vm.isHybrid(approval)?role==='independent-qa'?approval.model+' (approved evaluation only); mock by default':'mock — no stage authorized in this evaluation':MODEL+' (approved pilot only); mock by default'):'mock — no API usage',version:1})),
          tasks:state.tasks.map(({principal,requestHash,payloadHash,...t})=>t),reservations:state.reservations});
      }
      const b=req.body;
      if(!b||typeof b!=='object'||Array.isArray(b)||Buffer.byteLength(JSON.stringify(b))>(worker&&b.action==='command'&&b.command?.type==='finish'?32000:16000))return res.status(400).json({error:'Invalid request'});
      if(worker){
        if(['initialize-pilot','initialize-smoke','initialize-specialist','initialize-qa','initialize-evidence-first','initialize-hybrid-qa'].includes(b.action)&&Object.keys(b).length===1){
          const approval=trustedApproval(env,store.scope);
          if(!approval||isSmoke(approval)!==(b.action==='initialize-smoke')||isSpecialist(approval)!==(b.action==='initialize-specialist')||isQA(approval)!==(b.action==='initialize-qa')||isEF(approval)!==(['initialize-evidence-first','initialize-hybrid-qa'].includes(b.action))||vm.isHybrid(approval)!==(b.action==='initialize-hybrid-qa'))return res.status(403).json({error:'Paid pilot is not authorized'});
          if((isSmoke(approval)||isSpecialist(approval)||isQA(approval)||isEF(approval))&&terminal((await store.read()).tasks.find(t=>t.approvalId===approval.id)))return res.status(403).json({error:'Paid limited approval was consumed'});
          return res.status(201).json({task:await store.create({principal:'owner-approved-pilot',idempotencyKey:approval.id,objective:isEF(approval)?efProfile(approval).objective:isQA(approval)?QA.objective:isSmoke(approval)?SMOKE.objective:isSpecialist(approval)?SPECIALIST.objective:'Inspect Legal dashboard imagery relevance and Growth pricing badge spacing on the pinned Preview. Read-only findings and independent QA; no code changes.',mode:'pilot',approval})});
        }
        if(b.action!=='command'||!['claim','reserve','finish','heartbeat','recover','fail','evidence'].includes(b.command?.type))return res.status(403).json({error:'Worker action not permitted'});
        const t=(await store.read()).tasks.find(t=>t.id===b.id);
        if(!t)return res.status(403).json({error:'Task is not authorized'});if(!vm.isHybrid(t)&&Buffer.byteLength(JSON.stringify(b))>16000)return res.status(400).json({error:'Invalid request'});
        if(t.mode==='pilot'){
          const approval=trustedApproval(env,store.scope);
          try{approvalCheck(approval?{...approval,taskId:t.id}:null,t);}catch{return res.status(403).json({error:'Paid execution has not been authorized'});}
        }
        return res.status(200).json({task:await store.command(b.id,b.command)});
      }
      if(b.action==='create'&&Object.keys(b).every(k=>['action','objective','idempotencyKey'].includes(k)))return res.status(201).json({task:await store.create({principal,objective:b.objective,idempotencyKey:b.idempotencyKey,mode:'mock'})});
      if(b.action==='cancel'&&Object.keys(b).every(k=>['action','id','expectedRevision'].includes(k))&&Number.isSafeInteger(b.expectedRevision))return res.status(200).json({task:await store.command(b.id,{type:'cancel',expectedRevision:b.expectedRevision})});
      return res.status(403).json({error:'Action not permitted'});
    }catch(error){
      const budget=new Set(['Task budget exhausted','Daily budget exhausted','Monthly budget exhausted','Cumulative budget exhausted','Call limit reached']);
      const state=new Set(['Task is terminal','Execution no longer authorized','Execution deadline reached','Task not queued','Lease still active','Stale task revision','Execution receipt missing','Execution already reserved']);
      const code=budget.has(error?.message)?'BROKER_BUDGET_EXHAUSTED':state.has(error?.message)?'BROKER_STATE_DENIED':'BROKER_STORAGE_UNCONFIRMED';
      // Do not expose database/provider text, credentials or external content.
      return res.status(409).json({code,error:'Operation could not be confirmed. Refresh task state before retrying.'});
    }
  };
}
module.exports={createHandler,secretMatches,trustedApproval};
