'use strict';
const {timingSafeEqual,createHash}=require('node:crypto');
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
    if(!matchesProject(a)||a.authorized!==true||!/^pilot_[a-zA-Z0-9_-]{8,60}$/.test(a.id)||!Number.isSafeInteger(a.expiresAt)||a.expiresAt<=Date.now()||a.scopeHash!==hash(scope)||a.profile!==undefined&&!profile||a.maxMicros!==(profile?profile.maxMicros:LIMITS.taskMicros)||profile&&(a.maxCalls!==profile.calls||a.expiresAt>Date.now()+LIMITS.durationMs)||(vm.isHybrid(a)?!vm.approvalIdentity(a)||env.CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED!=='true'||env.CALLERCORE_AGENTOPS_SOL_VISION_ESTIMATE_ACCEPTED!=='true':a.model!==MODEL||a.pricingVersion!==PRICING.version))return null;
    if(specialist&&(!specialistScope(scope)||a.maxCalls!==SPECIALIST.calls||a.maxMicros!==SPECIALIST.maxMicros||a.expiresAt>Date.now()+LIMITS.durationMs))return null;
    if(qa&&(!specialistScope(scope)||a.sourceTaskId!==QA.sourceTaskId||a.findingsHash!==QA.findingsHash||a.evidenceHash!==QA.evidenceHash))return null;
    if(isEF(a)&&a.evaluationHash!==EF.evaluationHash)return null;
    return a;
  }catch{return null;}
}
function secretMatches(value,expected){if(typeof expected!=='string'||expected.length<32)return false;const a=Buffer.from(String(value||'')),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
function createHandler({env,store,organization,trustedReview,operations,lifecycleVerification,transportVerification,organizationalRehearsal,getSession,getMember,getWorkspace,rateLimit}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(env.VERCEL_ENV!=='preview'||env.CALLERCORE_AGENTOPS_ENABLED!=='true')return res.status(503).json({error:'Agent Operations is disabled outside authorized Preview.'});
    if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
    try{
      const bearer=String(req.headers.authorization||'').replace(/^Bearer /,'');
      const runtime={environment:env.VERCEL_ENV,commit:env.VERCEL_GIT_COMMIT_SHA,origin:env.VERCEL_URL?'https://'+env.VERCEL_URL:undefined};
      if(secretMatches(bearer,env.CALLERCORE_AGENTOPS_VERIFICATION_SECRET))return await require('./agent-operations-verification').handleVerification({env,store,organization,req,res,rateLimit,runtime});
      const worker=secretMatches(bearer,env.CALLERCORE_AGENTOPS_WORKER_SECRET);
      let principal,ownerActor,ownerWorkspaceId;
      if(!worker){
        const s=await getSession(req);
        if(!s)return res.status(401).json({error:'Authentication required'});
        const m=await getMember(s.email);
        if(s.adminView||!m||m.disabled||m.role!=='admin'||s.workspaceId!==m.workspaceId||String(m.email||s.email).toLowerCase()!==String(s.email).toLowerCase())return res.status(403).json({error:'Internal administrator access required'});
        principal=String(s.email).toLowerCase();
        if(getWorkspace){const ws=await getWorkspace(s.workspaceId);if(ws&&String(ws.ownerEmail||'').trim().toLowerCase()===principal){ownerActor={kind:'owner',id:principal,verifiedOwner:true,workspaceId:s.workspaceId};ownerWorkspaceId=s.workspaceId;}}
        if(req.method==='POST'){
          let same=false;try{same=new URL(req.headers.origin).host===req.headers.host;}catch{}
          if(!same)return res.status(403).json({error:'Same-origin request required'});
        }
      }
      if((await rateLimit({scope:'agentops',identifier:worker?'worker':principal,limit:worker?120:30,windowSeconds:60,failClosed:true})).limited)return res.status(429).json({error:'Please wait before retrying.'});
      if(Object.keys(req.query||{}).length)return res.status(400).json({error:'Query selectors are not supported'});
      if(req.method==='GET'&&String(req.headers.accept||'').includes('text/html')&&env.CALLERCORE_AGENTOPS_PAID_ENABLED==='true'){const a=require('./agent-operations-organization-approval').approval(env,store.scope);if(!ownerActor||!a||createHash('sha256').update(ownerActor.id).digest('hex')!==a.ownerHash)return res.status(403).json({error:'Configured owner approval required'});res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");return res.status(200).send(require('./agent-operations-node-page').html());}
      if(req.method==='GET'&&String(req.headers.accept||'').includes('text/html')){if(!ownerActor||env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='false'||!(Number(env.CALLERCORE_AGENTOPS_LIFECYCLE_VERIFY_UNTIL)>Date.now()))return res.status(403).json({error:'Owner lifecycle verification unavailable'});res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; worker-src blob:; connect-src 'self'; style-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");return res.status(200).send(require('./agent-operations-lifecycle-page').html());}
      if(req.method==='GET'){
        const state=await store.read();
        let approval=organization?null:trustedApproval(env,store.scope);const pilot=approval?state.tasks.find(t=>t.approvalId===approval.id):null;
        // A consumed smoke approval cannot advertise or initialize more paid work.
        if((isSmoke(approval)||isSpecialist(approval)||isQA(approval)||isEF(approval))&&terminal(pilot))approval=null;
        let organizationState=organization&&(worker||ownerActor)?await organization.summary():null;
        if(organizationState&&!worker)organizationState=require('./agent-operations-monitoring').scopedSummary(organizationState,state,ownerActor);
        const visibleTasks=worker?state.tasks:state.tasks.filter(t=>t.principal===principal&&(!t.workspaceId||t.workspaceId===ownerWorkspaceId));
        const visibleIds=new Set(visibleTasks.map(t=>t.id));
        let operatingSystem=null;if(ownerActor&&!worker&&operations){try{operatingSystem=await operations.read(ownerActor);}catch{operatingSystem={version:'internal-operations-v1',status:'unavailable',code:'OPS_STORAGE_UNCONFIRMED',paidExecution:false,authority:false};}}
        return res.status(200).json({mode:'mock',paidExecution:!!approval||organizationState?.paidExecution===true,runtime,scope:store.scope,revision:state.revision,acceptedWorkTaskIds:visibleTasks.filter(acceptedWork).map(t=>t.id),operatingSystem,
          ...(organizationState?{organization:organizationState}:{}),
          ownerVerification:!worker&&ownerActor&&lifecycleVerification?.availability?lifecycleVerification.availability(ownerActor):null,
          trustedReview:!worker&&ownerActor&&trustedReview?{available:true,kind:'owner-evidence-review-v1',acceptanceAuthority:false,paidPermission:false}:null,
          ownerPilotControl:!worker&&ownerActor&&organization?.ownerPilotControl?await organization.ownerPilotControl(ownerActor):null,
          chiefSmoke:{profile:SMOKE.profile,maxCalls:SMOKE.calls,reservationMicros:SMOKE.maxMicros,maxOutputTokens:SMOKE.outputTokens,requestTimeoutMs:SMOKE.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,enabled:!!approval&&isSmoke(approval)},
          independentQA:{profile:QA.profile,maxCalls:QA.calls,reservationMicros:QA.maxMicros,maxOutputTokens:QA.outputTokens,requestTimeoutMs:QA.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,sourceTaskId:QA.sourceTaskId,findingsHash:QA.findingsHash,evidenceHash:QA.evidenceHash,enabled:!!approval&&isQA(approval)},
          chiefArchitecture:{...require('./agent-operations-chief-model').CONFIG,preferredModel:'gpt-6.1-sol',fallbackModel:MODEL,contextVersion:'chief-context-v1',autonomy:require('./agent-operations-autonomy').POLICY,liveInitializerAvailable:false},
          hybridVisualQA:{profile:vm.HYBRID.profile,preferredCandidate:true,preferredModel:true,model:vm.HYBRID.model,reasoningEffort:vm.HYBRID.reasoningEffort,serviceTier:vm.HYBRID.serviceTier,cacheMode:vm.HYBRID.cacheMode,schemaVersion:vm.HYBRID.schemaVersion,pricingVersion:vm.HYBRID.pricingVersion,modelAccessVerified:env.CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED==='true',visionBoundVerified:false,visionEstimateAccepted:env.CALLERCORE_AGENTOPS_SOL_VISION_ESTIMATE_ACCEPTED==='true',budgetVersion:vm.HYBRID.budgetVersion,inputTokenPlanningLimit:vm.HYBRID.maxInputTokens,imageSizing:'conservative-estimate',residualUncertainty:true,maxCalls:2,reservationMicros:vm.HYBRID.maxMicros,callReservationMicros:vm.HYBRID.callMicros,outputTokens:{observe:vm.HYBRID.observeOutputTokens,adjudicate:vm.HYBRID.adjudicateOutputTokens},requestTimeoutMs:vm.HYBRID.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,evaluationHash:EF.evaluationHash,enabled:!!approval&&vm.isHybrid(approval),finalAcceptance:'requires-independent-image-review'},
          evidenceFirstQA:{profile:EF.profile,evaluationHash:EF.evaluationHash,originalFindings:4,positiveControls:2,maxCalls:EF.calls,reservationMicros:EF.maxMicros,maxOutputTokens:EF.outputTokens,requestTimeoutMs:EF.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,sourceTaskId:EF.sourceTaskId,findingsHash:EF.findingsHash,evidenceHash:EF.evidenceHash,enabled:!!approval&&isEF(approval)&&!vm.isHybrid(approval),finalAcceptance:'requires-independent-label-review'},
          chiefSpecialist:{profile:SPECIALIST.profile,maxCalls:SPECIALIST.calls,reservationMicros:SPECIALIST.maxMicros,maxOutputTokens:SPECIALIST.outputTokens,requestTimeoutMs:SPECIALIST.requestTimeoutMs,taskDurationMs:LIMITS.durationMs,enabled:!!approval&&isSpecialist(approval)},
          ...(worker&&approval&&pilot?{pilotApproval:{...approval,taskId:pilot.id}}:{}),
          agents:ROLES.map(role=>({role,tools:TOOLS[role],preferredModel:role==='independent-qa'||role==='chief-of-staff'?vm.HYBRID.model:MODEL,preferredReasoning:role==='independent-qa'||role==='chief-of-staff'?'medium':null,fallbackModel:role==='chief-of-staff'?MODEL:null,model:approval?(vm.isHybrid(approval)?role==='independent-qa'?approval.model+' (approved evaluation only); mock by default':'mock — no stage authorized in this evaluation':MODEL+' (approved pilot only); mock by default'):'mock — no API usage',version:1})),
          tasks:visibleTasks.map(({principal,requestHash,payloadHash,...t})=>t),reservations:worker?state.reservations:state.reservations.filter(r=>visibleIds.has(r.taskId))});
      }
      const b=req.body;
      if(!b||typeof b!=='object'||Array.isArray(b)||Buffer.byteLength(JSON.stringify(b))>(worker&&b.action==='organization-rehearsal-worker'&&b.input?.body?.action==='organization-command'&&b.input?.body?.command?.type==='finish'?34000:worker&&((b.action==='command'||b.action==='organization-command')&&b.command?.type==='finish')?32000:16000))return res.status(400).json({error:'Invalid request'});
      if(typeof b.action==='string'&&b.action.startsWith('operations-')){
        if(worker||!ownerActor||!operations||Object.keys(b).length!==2)return res.status(403).json({error:'Verified workspace owner required'});
        const actions={'operations-read':()=>operations.read(ownerActor),'operations-create':()=>operations.create(ownerActor,b.input),'operations-run':()=>operations.run(ownerActor,b.input),'operations-cancel':()=>operations.cancel(ownerActor,b.input),'operations-recover':()=>operations.recover(ownerActor,b.input),'operations-synchronize':()=>operations.synchronize(ownerActor,b.input),'operations-incident':()=>operations.incident(ownerActor,b.input),'operations-emergency-stop':()=>operations.emergencyStop(ownerActor,b.input)};
        if(!Object.hasOwn(actions,b.action))return res.status(403).json({error:'Operation denied'});
        if(b.action==='operations-read'&&(b.input===null||typeof b.input!=='object'||Array.isArray(b.input)||Object.keys(b.input).length))return res.status(400).json({error:'Exact read request required'});
        return res.status(200).json({operatingSystem:await actions[b.action]()});
      }
      if(b.action==='organization-rehearsal-worker'){
        if(!worker||!organizationalRehearsal||Object.keys(b).length!==2)return res.status(403).json({error:'Restricted rehearsal worker required'});
        return res.status(200).json({rehearsal:await organizationalRehearsal.worker(b.input)});
      }
      if(b.action==='organization-rehearsal-readback'){
        if(!ownerActor||worker||!organizationalRehearsal||Object.keys(b).length!==2)return res.status(403).json({error:'Verified workspace owner required'});
        return res.status(200).json({rehearsal:await organizationalRehearsal.inspect(ownerActor,b.input)});
      }
      if(b.action==='organization-rehearsal-controller'){
        if(!ownerActor||worker||!organizationalRehearsal||Object.keys(b).length!==2)return res.status(403).json({error:'Verified workspace owner required'});
        const stopped=new AbortController(),abort=()=>stopped.abort(),closed=()=>{if(!res.writableEnded)abort();};req.once?.('aborted',abort);res.once?.('close',closed);
        const authorize=async()=>{const s=await getSession(req);if(!s||s.adminView||s.workspaceId!==ownerWorkspaceId||String(s.email).toLowerCase()!==ownerActor.id)return false;const m=await getMember(s.email),w=await getWorkspace(s.workspaceId);return !!(m&&!m.disabled&&m.role==='admin'&&m.workspaceId===s.workspaceId&&String(m.email||s.email).toLowerCase()===ownerActor.id&&String(w?.ownerEmail||'').trim().toLowerCase()===ownerActor.id);};
        res.setHeader('Content-Type','application/x-ndjson');const send=v=>{if(res.destroyed){abort();return;}res.write(JSON.stringify(v)+'\n');};send({phase:'nonbillable-rehearsal-controller-started',nonce:b.input?.nonce,providerRequests:0});
        try{send({controller:await organizationalRehearsal.start(ownerActor,b.input,{authorize,signal:stopped.signal,onEvent:event=>send({event})})});}catch(error){send({code:'REHEARSAL_STOPPED',controller:error.controllerEvidence||{completed:false,shutdownUnconfirmed:true}});}finally{req.removeListener?.('aborted',abort);res.removeListener?.('close',closed);}return res.end();
      }
      if(['organization-review-read','organization-review-attest'].includes(b.action)){if(worker||!ownerActor||!trustedReview||Object.keys(b).length!==2)return res.status(403).json({error:'Verified workspace owner required for evidence review'});const review=b.action==='organization-review-read'?await trustedReview.readBundle(ownerActor,b.input):await trustedReview.attest(ownerActor,b.input);return res.status(200).json({review});}
      if(b.action==='organization-pilot-stop'){if(!ownerActor||worker||!organization||Object.keys(b).length!==2)return res.status(403).json({error:'Verified workspace owner required'});return res.status(200).json({approval:await organization.stopOwnerPilot(ownerActor,b.input)});}
      if(b.action==='organization-transport-readback'){if(!ownerActor||worker||!transportVerification||Object.keys(b).length!==2)return res.status(403).json({error:'Verified workspace owner required'});return res.status(200).json({verification:await transportVerification.inspect(ownerActor,b.input)});}
      if(b.action==='organization-lifecycle-verification'){if(!ownerActor||worker||!lifecycleVerification||Object.keys(b).length!==2)return res.status(403).json({error:'Verified workspace owner required'});return res.status(200).json({verification:await lifecycleVerification.execute(ownerActor,b.input)});}
      if(['organization-node-controller-verification','organization-pilot-controller','organization-supervisor-verification'].includes(b.action)){
        if(!ownerActor||worker||!lifecycleVerification||Object.keys(b).length!==2)return res.status(403).json({error:'Verified workspace owner required'});
        const transport=b.action==='organization-supervisor-verification';if(transport&&!transportVerification)return res.status(403).json({error:'Transport verification unavailable'});const pilot=b.action==='organization-pilot-controller',configured=pilot?require('./agent-operations-organization-approval').approval(env,store.scope):null;if(pilot&&(!organization||!configured||!require('./agent-operations-pilot-binding').matches(b.input,configured,runtime)||createHash('sha256').update(ownerActor.id).digest('hex')!==configured.ownerHash))return res.status(403).json({error:'Configured exact owner pilot required'});
        const stopped=new AbortController(),abort=()=>stopped.abort();req.once?.('aborted',abort);const closed=()=>{if(!res.writableEnded)abort();};res.once?.('close',closed);
        const authorize=async()=>{const s=await getSession(req);if(!s||s.adminView||s.workspaceId!==ownerWorkspaceId||String(s.email).toLowerCase()!==ownerActor.id)return false;const m=await getMember(s.email),w=await getWorkspace(s.workspaceId);return !!(m&&!m.disabled&&m.role==='admin'&&m.workspaceId===s.workspaceId&&String(m.email||s.email).toLowerCase()===ownerActor.id&&String(w?.ownerEmail||'').trim().toLowerCase()===ownerActor.id);};
        const stream=pilot&&String(req.headers.accept||'').includes('application/x-ndjson');const send=value=>{if(res.destroyed){stopped.abort();return;}res.write(JSON.stringify(value)+'\n');};if(stream){res.setHeader('Content-Type','application/x-ndjson');send({phase:'controller-request-started'});}
        try{const controller=pilot?await require('./agent-operations-node-controller').supervisePilot({organization,owner:ownerActor,approval:configured,runtime:{origin:runtime.origin,commit:runtime.commit},release:require('./agent-operations-contracts').assertRelease(),env,authorize,signal:stopped.signal,...(stream?{onEvent:event=>send({event})}:{})}):transport?await transportVerification.start(ownerActor,b.input,{signal:stopped.signal,authorize}):await lifecycleVerification.controller(ownerActor,b.input,{signal:stopped.signal,authorize});if(stream){send({controller});return res.end();}return res.status(200).json({controller});}catch(error){if(!stream)throw error;send({code:'NODE_CONTROLLER_STOPPED',controller:error.controllerEvidence||{completed:false,shutdownUnconfirmed:true}});return res.end();}finally{req.removeListener?.('aborted',abort);res.removeListener?.('close',closed);}
      }
      if(worker){
        if(b.action==='organization-transport-worker'&&transportVerification&&Object.keys(b).length===2)return res.status(200).json({transport:await transportVerification.worker(b.input)});
        if(organization&&b.action==='organization-initialize'&&Object.keys(b).length===1){
          if(!await organization.liveApprovalValid(require('./agent-operations-organization-approval').approval(env,store.scope)))return res.status(403).json({error:'Organization pilot is not authorized'});
          return res.status(201).json({organization:await organization.initializePilot()});
        }
        if(organization&&b.action==='organization-approval-revoke'&&Object.keys(b).length===2){return res.status(200).json({organization:await organization.controlApproval(null,{...b.input,type:'revoke'})});}
        if(organization&&b.action?.startsWith('organization-')){
          const actor={workflowId:b.id,token:b.token},actions={
            'organization-diagnostic':()=>organization.recordDiagnostic(actor,b.id,b.input),
            'organization-read':()=>organization.readWorkflow(actor,b.id),
            'organization-chief-context':()=>organization.chiefContext(actor,b.id),
            'organization-command':()=>organization.command(actor,b.id,b.command),
            'organization-capture':()=>organization.registerEvidence(actor,b.id,b.input),
            'organization-assessment-read':()=>organization.readAssessment(actor,b.id),
            'organization-assess':()=>organization.assess(actor,b.id,b.input),
            'organization-assessment-fail':()=>organization.abortAssessment(actor,b.id,b.input)
          };
          if(!Object.hasOwn(actions,b.action))return res.status(403).json({error:'Worker organization action denied'});
          return res.status(200).json({organization:await actions[b.action]()});
        }
        if(organization&&(['initialize-pilot','initialize-smoke','initialize-specialist','initialize-qa','initialize-evidence-first','initialize-hybrid-qa'].includes(b.action)||(b.action==='command'&&(await store.read()).tasks.find(t=>t.id===b.id)?.mode==='pilot')))return res.status(403).json({error:'Legacy paid approvals retired'});
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
      if(organization&&b.action?.startsWith('organization-')){
        if(!ownerActor)return res.status(403).json({error:'Verified workspace owner required'});
        const ownerActions={'organization-approval-prepare':()=>organization.prepareApproval(ownerActor),'organization-approval-activate':()=>organization.activateApproval(ownerActor,b.input),'organization-approval-control':()=>organization.controlApproval(ownerActor,b.input),'organization-grant':()=>organization.issueGrant(ownerActor,b.input),'organization-revoke':()=>organization.revoke(ownerActor,b.input),'organization-create':()=>organization.create(ownerActor,{...b.input,mode:'mock'}),'organization-cancel':()=>organization.cancel(ownerActor,b.input),'organization-escalation-decision':()=>organization.resolveEscalation(ownerActor,b.input)};
        if(Object.keys(b).length!==2||!Object.hasOwn(ownerActions,b.action))return res.status(403).json({error:'Organization action denied'});
        return res.status(200).json({organization:await ownerActions[b.action]()});
      }
      if(b.action==='create'&&Object.keys(b).every(k=>['action','objective','idempotencyKey'].includes(k)))return res.status(201).json({task:await store.create({principal,objective:b.objective,idempotencyKey:b.idempotencyKey,mode:'mock'})});
      if(b.action==='cancel'&&Object.keys(b).every(k=>['action','id','expectedRevision'].includes(k))&&Number.isSafeInteger(b.expectedRevision)){const task=(await store.read()).tasks.find(t=>t.id===b.id);if(!task||task.principal!==principal||task.workspaceId&&task.workspaceId!==ownerWorkspaceId)return res.status(403).json({error:'Owned task required'});return res.status(200).json({task:await store.command(b.id,{type:'cancel',expectedRevision:b.expectedRevision})});}
      return res.status(403).json({error:'Action not permitted'});
    }catch(error){
      if(/^OPS_[A-Z_]+$/.test(error?.message||''))return res.status(/STORAGE|SOURCE_UNAVAILABLE/.test(error.message)?503:409).json({code:error.message,error:'Internal operation was not confirmed. Refresh authoritative state before deciding what to do next.'});
      if(error?.controllerEvidence?.version==='node-owner-controller-v1')return res.status(409).json({code:'NODE_CONTROLLER_STOPPED',controller:error.controllerEvidence});
      const budget=new Set(['Task budget exhausted','Daily budget exhausted','Monthly budget exhausted','Cumulative budget exhausted','Call limit reached']);
      const state=new Set(['Task is terminal','Execution no longer authorized','Execution deadline reached','Task not queued','Lease still active','Stale task revision','Execution receipt missing','Execution already reserved']);
      const code=budget.has(error?.message)?'BROKER_BUDGET_EXHAUSTED':state.has(error?.message)?'BROKER_STATE_DENIED':'BROKER_STORAGE_UNCONFIRMED';
      // Do not expose database/provider text, credentials or external content.
      return res.status(409).json({code,error:'Operation could not be confirmed. Refresh task state before retrying.'});
    }
  };
}
module.exports={createHandler,secretMatches,trustedApproval};
