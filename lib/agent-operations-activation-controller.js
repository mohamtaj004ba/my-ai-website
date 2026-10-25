'use strict';
// Opaque, invocation-local coverage. Only this owner controller can mint it;
// transport may verify it but clients, model output and child processes cannot.
const managedStages=new WeakMap();
function managedStageMatches(token,{broker,actor,stage,context,approval,signal}){
 const record=token&&typeof token==='object'?managedStages.get(token):null;
 if(!record||record.signal!==signal||signal?.aborted||record.broker!==broker)return false;
 const hash=require('./agent-operations-engineering-provider-v2').hash;
 return record.stage===stage&&record.actorHash===hash(actor)&&record.contextHash===hash(context)&&record.approvalHash===hash(approval);
}

// Trusted owner controller orchestration, not a worker tool or retry executor.
// Callbacks must use authenticated, exact-release Preview endpoints. No default transport.
async function withActivation({prepare,activate,run,revoke,readback,renew,signal,durationMs=600000,renewMs=10000,renewTimeoutMs,leaseMs=30000,deadlineAt,leaseUntil,authorityExpiresAt}={}){
 if(![prepare,activate,run,revoke,readback,renew].every(f=>typeof f==='function')||!Number.isSafeInteger(durationMs)||durationMs<1||durationMs>600000||!Number.isSafeInteger(renewMs)||renewMs<1||renewMs>10000)throw Error('Activation control dependencies required');
 if(deadlineAt!==undefined&&(!Number.isSafeInteger(deadlineAt)||deadlineAt<=Date.now()||deadlineAt>Date.now()+600000))throw Error('Absolute cleanup deadline required');
 if(![30000,60000].includes(leaseMs))throw Error('Approved lease duration required');
 // I/O allowance is not authority: the last acknowledged lease and immutable
 // task/operation deadlines still bound every renewal below. Preserve legacy30s.
 const renewalIoLimit=leaseMs===60000?45000:25000;
 if(renewTimeoutMs===undefined)renewTimeoutMs=renewalIoLimit;
 if(!Number.isSafeInteger(renewTimeoutMs)||renewTimeoutMs<1||renewTimeoutMs>renewalIoLimit)throw Error('Renewal deadline required');
 const leaseAware=authorityExpiresAt!==undefined||leaseUntil!==undefined,operationEnd=Date.now()+durationMs;
 if(leaseAware&&!Number.isSafeInteger(authorityExpiresAt))throw Error('Immutable authority expiry required');
 // Match the broker coalescing threshold; legacy leases retain their30s policy.
 // A larger I/O allowance must not create a hot loop of early no-op renewals.
 const renewalLeadMs=Math.min(renewTimeoutMs+1000,leaseMs-10000,leaseMs-renewMs);
 let acknowledgedLease=leaseUntil;
 function acknowledge(value){const now=Date.now();if(!Number.isSafeInteger(value)||value<=now||value>authorityExpiresAt||value>now+leaseMs)throw Error('Renewal lease acknowledgment denied');acknowledgedLease=value;}
 let prepared,result,error,shutdown,heartbeat,renewing=false,renewalsEnded=false,closed=false,stop,pendingRun,pendingRunFailure,renewalTrace;
 const stopCodes={'external-signal':'ENG_ACTIVATION_CANCELLED','operation-timeout':'ENG_ACTIVATION_TIMEOUT','renewal-timeout':'ENG_ACTIVATION_RENEW_TIMEOUT','renewal-error':'ENG_ACTIVATION_RENEW_FAILED'};
 const controller=new AbortController(),cancelled=new Promise((_,reject)=>stop=reject),abort=(origin,reason)=>{if(controller.signal.aborted)return;const timing=origin.startsWith('renewal-')?renewalTrace?.snapshot():null,diagnostic=Object.freeze({version:'engineering-activation-stop-v1',origin,code:stopCodes[origin],...(timing?{renewal:timing}:{})});controller.abort(diagnostic);stop(Object.assign(Error('Activation cancelled or timed out'),reason instanceof Error?{cause:reason}:{name:'AbortError'}));},externalAbort=()=>abort('external-signal');
 cancelled.catch(()=>{});signal?.addEventListener('abort',externalAbort,{once:true});const timer=setTimeout(()=>abort('operation-timeout',Object.assign(Error('Activation cancelled or timed out'),{name:'TimeoutError'})),durationMs);
 const bounded=callback=>Promise.race([Promise.resolve().then(()=>{if(controller.signal.aborted)throw Error('Activation cancelled or timed out');return callback(prepared,{signal:controller.signal});}),cancelled]);
 async function renewOnce(){
  if(closed||renewing||controller.signal.aborted)throw Error('Renewal stopped');
  renewing=true;renewalTrace=require('./agent-operations-renewal-diagnostic').trace();const currentTrace=renewalTrace,now=Date.now(),end=Math.min(now+renewTimeoutMs,operationEnd,deadlineAt??Infinity,leaseAware?acknowledgedLease-1000:Infinity);
  if(end<=now){renewing=false;abort('renewal-timeout');throw Error('Renewal deadline');}
  const leaseSignal=AbortSignal.any([controller.signal,AbortSignal.timeout(end-now)]);
  try{
   const receipt=await Promise.race([Promise.resolve().then(()=>{if(closed||leaseSignal.aborted)throw Error('Renewal stopped');return renew(prepared,{signal:leaseSignal,deadlineAt:end,onPhase:phase=>{if(!closed&&!leaseSignal.aborted&&renewalTrace===currentTrace)currentTrace.report(phase);}});}),new Promise((_,reject)=>leaseSignal.addEventListener('abort',()=>reject(Object.assign(Error('Renewal deadline'),{name:'TimeoutError'})),{once:true}))]);
   if(closed||leaseSignal.aborted||Date.now()>=end)throw Error('Late renewal acknowledgment');
   // Only trusted controller callbacks can return this terminal observation;
   // the Node port first verifies the exact authoritative completed workflow.
   if(leaseAware&&receipt?.authorityEnded===true&&Object.keys(receipt).length===1)renewalsEnded=true;
   else if(leaseAware)acknowledge(receipt?.leaseUntil);
  }catch(error){abort((leaseSignal.aborted||Date.now()>=end)&&!controller.signal.aborted?'renewal-timeout':'renewal-error',error);throw error;}
  finally{renewing=false;}
 }
 function scheduleRenewal(){
  if(closed||renewalsEnded||controller.signal.aborted)return;
  const delay=leaseAware?Math.min(renewMs,Math.max(0,acknowledgedLease-Date.now()-renewalLeadMs)):renewMs;
  heartbeat=setTimeout(()=>{renewOnce().then(scheduleRenewal,()=>{});},delay);
 }
 try{if(signal?.aborted)externalAbort();if(leaseAware){if(authorityExpiresAt<=Date.now()||authorityExpiresAt>Date.now()+600000)throw Error('Immutable authority expiry required');if(leaseUntil!==undefined)acknowledge(leaseUntil);}prepared=await bounded(prepare);const activated=await bounded(activate);if(leaseAware){acknowledge(activated?.leaseUntil??acknowledgedLease);if(acknowledgedLease-Date.now()<renewalLeadMs)await bounded(()=>renewOnce());}scheduleRenewal();result=await bounded((value,options)=>{pendingRun=Promise.resolve().then(()=>run(value,options));pendingRun.catch(e=>{pendingRunFailure=e;});return pendingRun;});}
 catch(e){error=e;}
 finally{
  // prepare must assign an owner-selected ID before any request; revoke uses that ID
  // even when the prepare response is lost and no scoped token was received.
  closed=true;clearTimeout(heartbeat);clearTimeout(timer);signal?.removeEventListener('abort',externalAbort);controller.abort();
  // Keep the deadline referenced until physical shutdown settles. An unref'ed
  // AbortSignal.timeout can let Node exit with cleanup promises still pending.
  const cleanupRemaining=deadlineAt===undefined?15000:Math.max(0,Math.min(15000,deadlineAt-Date.now())),cleanupController=new AbortController(),cleanupSignal=cleanupController.signal;
  const cleanupTimer=cleanupRemaining?setTimeout(()=>cleanupController.abort(),cleanupRemaining):undefined;if(!cleanupRemaining)cleanupController.abort();
  const cleanup=callback=>cleanupSignal.aborted?Promise.reject(Error('Shutdown timeout')):Promise.race([Promise.resolve().then(()=>callback(prepared,{signal:cleanupSignal})),new Promise((_,reject)=>cleanupSignal.addEventListener('abort',()=>reject(Error('Shutdown timeout')),{once:true}))]);
  try{await cleanup(revoke);if(pendingRun)await cleanup(()=>pendingRun.then(()=>true,()=>true));if(pendingRunFailure?.cleanupConfirmed===false||pendingRunFailure?.workspaceCleanupConfirmed===false)throw Error('Workspace cleanup unconfirmed');shutdown=await cleanup(readback);if(shutdown?.paidExecution!==false||shutdown?.replacementPaidExecution!==false)throw Error('Authoritative shutdown unconfirmed');}
  catch(e){throw Object.assign(Error('Activation shutdown failed; owner intervention required'),{cause:e,executionError:error});}
  finally{clearTimeout(cleanupTimer);}
 }
 if(error)throw error;return {result,shutdown};
}
// Owner control plane over the existing organization approval lifecycle. This
// does not reinterpret historical fixture journals or expose a paid run action.
function createEngineeringOwnerControl({operations,organization,runtime,env={},assertOwner,clock=Date.now}={}){
 const {isDeepStrictEqual:equal}=require('node:util'),p=require('./agent-operations-engineering-provider-v2'),inference=require('./agent-operations-engineering-inference'),helper=require('./agent-operations-engineering-rehearsal');
 const isDevelopmentTrial=()=>p.activeDevelopment(p.selectedTrial(env)),isStarterTrial=()=>p.selectedTrial(env)===p.STARTER_TRIAL||isDevelopmentTrial(),usesExpandedBudget=()=>isExpandedTrial()||isStarterTrial();
 const isExpandedTrial=()=>!!p.EXPANDED_TRIAL&&p.selectedTrial(env)===p.EXPANDED_TRIAL,isSequenceTrial=()=>p.selectedTrial(env)===p.SEQUENCE_TRIAL||isExpandedTrial()||isDevelopmentTrial();
 const check=(v,c)=>{if(!v)throw Error(c);},exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&equal(Object.keys(v).sort(),k.slice().sort());
 check(operations&&organization&&typeof assertOwner==='function','ENG_CONTROL_CONFIGURATION');
 function ownerShape(actor){check(actor?.kind==='owner'&&actor.verifiedOwner===true,'ENG_CONTROL_OWNER');check(runtime?.environment==='preview'&&runtime.branch==='feature/callercore-dashboards'&&/^dpl_[A-Za-z0-9]+$/.test(runtime.deploymentId||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(runtime.origin||'')&&/^[a-f0-9]{40}$/.test(runtime.commit||''),'ENG_CONTROL_PREVIEW');}
 async function owner(actor){ownerShape(actor);check(await assertOwner(actor)===true,'ENG_CONTROL_OWNER');}
 function release(){return require('./agent-operations-contracts').assertRelease();}
 async function subject(actor,input,{approval=null,configurationIntent=null,configurationStep=null,onAuthorityPhase}={}){
  ownerShape(actor);check(typeof input?.planId==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(input.planId),'ENG_CONTROL_SCOPE');
  const proofRequest={},view=await (typeof operations.readAuthority==='function'?operations.readAuthority(actor,{proofRequest,onPhase:onAuthorityPhase}):operations.read(actor));
  // Reuse only this exact invocation's proven fresh check; injected/fallback
  // readers cannot manufacture the module-private proof and reauthenticate.
  if(!require('./agent-operations-operating-system').consumeAuthorityReadProof(view,actor,runtime,operations,proofRequest))await owner(actor);
  const plan=view.plans.find(x=>x.id===input.planId);
  check(plan&&[helper.PROFILE,require('./agent-operations-implementation').PROFILE].includes(plan.engineeringProfile)&&plan.tasks.length===5&&plan.tasks.every((t,i)=>t.id===plan.id+'_task'+(i+1)&&t.template===helper.templates[i]),'ENG_CONTROL_SCOPE');
  check(plan.revision===input.expectedRevision&&plan.status==='queued'&&(plan.deadline>clock()||configurationIntent!==null)&&plan.tasks.every(t=>t.attempts.length===0)&&equal(plan.runtime,{origin:runtime.origin,sourceCommit:runtime.commit,branch:runtime.branch,deploymentId:runtime.deploymentId,release:release()}),'ENG_CONTROL_STALE');
  const task=plan.tasks[0],context=helper.context(task.template,{engineeringProfile:plan.engineeringProfile,assignment:plan.objective,planId:plan.id,taskId:task.id,executionId:'approval_'+plan.id,fence:task.fence,authorizationRevision:task.revision,ownerHash:view.scopeIdentity.ownerHash,workspaceHash:view.scopeIdentity.workspaceHash,runtime:plan.runtime,dependencies:[]});
  if(configurationIntent!==null)require('./agent-operations-engineering-configuration').assertStepLease(configurationIntent,context,plan,clock());
  if(p.uncertainCount(approval))check(p.uncertainReadiness(context,p.trialFor(approval))===env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256,'ENG_CONTROL_OWNER_TRIAL_PIN');
  const consent=structuredClone(approval),policyAtAdmission=policyHash(),broker=organization.engineering(async(b,phase,{onPhase}={})=>{
   const configurationPhase=['configuration-claim','configuration-step','configuration-complete'].includes(phase);check(['source-test-authorize','source-test-run','configuration-claim','configuration-step','configuration-complete','sequence-register','sequence-enroll','approval-prepare','approval-activate','approval-renew','model-access','admit','dispatch','count','finish'].includes(phase),'ENG_CONTROL_PHASE');
   if(['sequence-register','sequence-enroll'].includes(phase))check(isSequenceTrial()&&blockers().length===0&&policyHash()===policyAtAdmission,'ENG_CONTROL_ACTIVATION_BLOCKED');else if(phase!=='model-access'&&!configurationPhase)check(consent&&blockers(consent).length===0&&policyHash()===policyAtAdmission,'ENG_CONTROL_ACTIVATION_BLOCKED');
   const fresh=await subject(actor,{planId:plan.id,expectedRevision:plan.revision},{approval:consent,onAuthorityPhase:onPhase,...(phase==='configuration-step'&&configurationIntent!==null?{configurationIntent,configurationStep}: {})}),index=plan.tasks.findIndex(t=>t.id===b.taskId);
   if(phase==='configuration-claim'||phase==='configuration-step'&&configurationStep?.phase==='dispatch'&&!require('./agent-operations-engineering-configuration').FLAGS.some(k=>configurationStep.step==='reset:'+k))require('./agent-operations-operating-system').assertRefreshCapacity(fresh.capacity);
   if(['sequence-register','sequence-enroll'].includes(phase))check(p.uncertainReadiness(fresh.context,p.selectedTrial(env))===env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256,'ENG_CONTROL_OWNER_TRIAL_PIN');
   const expected=index<0?null:{...fresh.context.binding,taskId:plan.tasks[index].id,executionId:consent?.id+'_'+inference.STAGES[index],fence:plan.tasks[index].fence,authorizationRevision:plan.tasks[index].revision};
   if(['sequence-register','sequence-enroll'].includes(phase))check(isSequenceTrial()&&blockers().length===0&&policyHash()===policyAtAdmission,'ENG_CONTROL_ACTIVATION_BLOCKED');else if(phase!=='model-access'&&!configurationPhase)check(consent&&blockers(consent).length===0&&policyHash()===policyAtAdmission,'ENG_CONTROL_ACTIVATION_BLOCKED');
   check(equal(b,fresh.context.binding)||index>=0&&equal(b,expected),'ENG_CONTROL_STALE');return true;
  });
  return{plan,context,broker,capacity:view.capacity};
 }
 function policyHash(){return p.hash(['CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_JSON','CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_SHA256','CALLERCORE_AGENTOPS_ENGINEERING_TRIAL_AUTHORIZATION_ID','CALLERCORE_AGENTOPS_ENGINEERING_MODEL_ACCESS_VERIFIED','CALLERCORE_AGENTOPS_ENGINEERING_COUNT_PRICING_SHA256','CALLERCORE_AGENTOPS_ENGINEERING_COUNT_UNCERTAINTY_SHA256','CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256','CALLERCORE_AGENTOPS_PAID_ENABLED','CALLERCORE_AGENTOPS_ENGINEERING_PAID_ENABLED','CALLERCORE_AGENTOPS_ENGINEERING_COUNT_ENABLED'].map(k=>[k,env[k]??null]));}
 function reviewedRelease(){if(!usesExpandedBudget())return null;let r;try{r=JSON.parse(env.CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_JSON||'null');}catch{}check(exact(r,['workQaHash','workAuditorHash','sourceCommit','releaseHash'])&&/^[a-f0-9]{64}$/.test(r.workQaHash||'')&&/^[a-f0-9]{64}$/.test(r.workAuditorHash||'')&&r.workQaHash!==r.workAuditorHash&&r.sourceCommit===runtime.commit&&r.releaseHash===release().digest&&p.hash(r)===env.CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_SHA256,'ENG_CONTROL_RELEASE_REVIEW');return structuredClone(r);}
 function blockers(a){const reasons=[];if(isStarterTrial()&&!require("./agent-operations-implementation").availability({assignment:p.selectedTrial(env)?.objective}).freshAssignmentAllowed)reasons.push("starter-assignment-resolved-or-source-changed");if(usesExpandedBudget())try{reviewedRelease();}catch{reasons.push('reviewed-release-manifest-unverified');}
  if(env.CALLERCORE_AGENTOPS_ENGINEERING_MODEL_ACCESS_VERIFIED!=='true')reasons.push('current-project-model-access-unverified');
  if(!/^[a-f0-9]{64}$/.test(env.CALLERCORE_AGENTOPS_ENGINEERING_COUNT_PRICING_SHA256||'')&&(!p.selectedTrial(env)||env.CALLERCORE_AGENTOPS_ENGINEERING_COUNT_UNCERTAINTY_SHA256!==p.hash(p.selectedTrial(env))))reasons.push('account-specific-count-pricing-unverified');
  if(a&&(!p.countPolicyPinned(a,env)))reasons.push('owner-count-price-binding-mismatch');
  if(!/^[a-f0-9]{64}$/.test(env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256||'')||a&&a.providerReadinessHash!==env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256)reasons.push('reviewed-provider-access-pricing-and-exposure-not-pinned');
  if(env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='true'||env.CALLERCORE_AGENTOPS_ENGINEERING_PAID_ENABLED!=='true'||env.CALLERCORE_AGENTOPS_ENGINEERING_COUNT_ENABLED!=='true')reasons.push('paid-execution-disabled');
  return reasons;
 }
 async function readiness(actor,input){await owner(actor);check(exact(input,[]),'ENG_CONTROL_INPUT');const observed=await operations.read(actor),operationsCapacity=observed.capacity||{status:'not-reported',executionAuthorized:false};const state=await organization.read(),engineeringAuthority=require('./agent-operations-monitoring').engineeringAuthority(state.operations,{...runtime,sourceCommit:runtime.commit,release:release()},clock(),{ownerHash:require('./agent-operations-monitoring').identity(actor.id),workspaceHash:require('./agent-operations-monitoring').identity(actor.workspaceId)});return{operationsCapacity,organizationCapacity:require('./agent-operations-capacity').projection(state),cleanupStatus:require('./agent-operations-organization').cleanupReadback(state.operations||{},actor,clock()),uncertainTrialScopeHash:isStarterTrial()&&!require("./agent-operations-implementation").availability({assignment:p.selectedTrial(env)?.objective}).freshAssignmentAllowed?null:p.uncertainReadiness({binding:{ownerHash:require('./agent-operations-monitoring').identity(actor.id),workspaceHash:require('./agent-operations-monitoring').identity(actor.workspaceId),runtime:{sourceCommit:runtime.commit,release:release()}},assignment:(p.selectedTrial(env)||p.UNCERTAIN_TRIAL).objective,evidence:isStarterTrial()?require('./agent-operations-implementation').sourceEvidence({assignment:p.selectedTrial(env)?.objective}):helper.sourceEvidence()},p.selectedTrial(env)||p.UNCERTAIN_TRIAL),...(isDevelopmentTrial()?{developmentPolicy:{authorizationId:p.selectedTrial(env).authorizationId,maxAttempts:p.selectedTrial(env)===p.CALL_ROW_TRIAL?1:null,recordedMaxAttempts:10,attemptPolicy:require('./agent-operations-engineering-sequence').ATTEMPT_POLICY,cumulativeNewMicros:4000000,authorizationBudgetId:p.DEVELOPMENT_TRIAL.budgetId,configurationIntentRequired:true}}:{}),...(isExpandedTrial()&&blockers().length===0?{expandedReleaseReview:reviewedRelease(),expandedPolicy:{maxAttempts:20,cumulativeMicros:5000000,authorizationBudgetId:require('./agent-operations-budget').EXPANDED_AUTHORIZATION.id}}:{}),expandedBudget:require('./agent-operations-budget').accountingFor(state,require('./agent-operations-budget').EXPANDED_AUTHORIZATION.id),historicalBudget:require('./agent-operations-budget').accounting(state),budgetReconciliation:{expanded:require('./agent-operations-budget').reconciliationFor(state,require('./agent-operations-budget').EXPANDED_AUTHORIZATION.id),historical:require('./agent-operations-budget').reconciliationFor(state)},version:'engineering-owner-control-v1',financialPolicy:require('./agent-operations-budget').FINANCIAL_POLICY,runtime:{...runtime,release:release()},model:inference.CONFIG.model,reasoning:'medium',limits:{calls:5,countRequests:5,inputTokens:60000,outputTokens:require("./agent-operations-implementation").totalOutputLimit({assignment:p.selectedTrial(env)?.objective}),perCallInputTokens:12000,perCallOutputTokens:require("./agent-operations-implementation").stageOutputLimit("specialist",{assignment:p.selectedTrial(env)?.objective}),...(p.selectedTrial(env)?.objective===require("./agent-operations-implementation").OBJECTIVE?{stageOutputTokens:{"chief-plan":4000,specialist:8000,qa:4000,auditor:4000,"chief-final":4000}}:{}),reservationMicros:1000000,stageMs:150000,durationMs:600000},blockers:blockers(),configurationGatesSatisfied:blockers().length===0,requiresTaskSpecificValidation:true,requiresFreshTaskSpecificOwnerConsent:true,liveTransportVerified:false,engineeringAuthority,paidExecution:engineeringAuthority.outstanding,acceptance:false,publication:false,generatedCodeExecution:false,qualification:'Readiness grants no execution authority. Historical five-stage live completion is preserved; live reasoning on this release remains unverified. Paid execution requires current release, task and review gates. Internal dollar limits are disabled by owner direction; OpenAI billing is authoritative, with estimates and unknown charges retained separately. Model metadata is not price proof or independent acceptance.'};}
 async function headroom(){const state=await organization.read(),b=require('./agent-operations-budget');require('./agent-operations-capacity').auditHeadroom(state.operations||{},require('./agent-operations-capacity').LIMITS.admissionReserve,'ENG_CONTROL_AUDIT_HEADROOM');require('./agent-operations-capacity').trialSlots(state);b.accountingFor(state,usesExpandedBudget()?b.EXPANDED_AUTHORIZATION.id:undefined);}
 async function trialManifest(actor,input){
  const sequenced=isSequenceTrial();check(exact(input,sequenced?['planId','expectedRevision','sequenceId']:['planId','expectedRevision']),'ENG_CONTROL_INPUT');const {plan,context}=await subject(actor,input);check(p.selectedTrial(env)&&plan.objective===p.selectedTrial(env).objective&&env.CALLERCORE_AGENTOPS_ENGINEERING_COUNT_UNCERTAINTY_SHA256===p.hash(p.selectedTrial(env)),'ENG_CONTROL_TRIAL_SCOPE');await headroom();
  const id=require('node:crypto').randomBytes(16).toString('hex'),b={planId:context.binding.planId,ownerHash:context.binding.ownerHash,workspaceHash:context.binding.workspaceHash,runtime:context.binding.runtime,assignmentHash:p.hash(context.assignment),evidenceHash:p.hash(context.evidence)};
  const seq=sequenced?await organization.engineering(async()=>true).sequenceStatus(actor,context,input.sequenceId):null;if(sequenced)check(seq.status==='open'&&seq.expiresAt>clock()&&require('./agent-operations-engineering-sequence').hasAttemptRoom(seq),'ENG_CONTROL_SEQUENCE');
  const approval={...(sequenced?{sequence:{id:seq.id,attempt:seq.attempts.length+1}}:{}),id:'pilot_'+id,workflowId:'wf_'+id,profile:p.PROFILE,lifecycleVersion:'durable-approval-v1',sourceCommit:runtime.commit,deploymentOrigin:runtime.origin,contractHash:release().digest,contractVersion:release().version,ownerHash:context.binding.ownerHash,scopeHash:p.hash(b),maxCalls:5,maxTokenCountRequests:5,tokenCountingAuthorized:true,tokenCountCostIncluded:true,countPricing:{kind:p.selectedTrial(env).kind,authorizationId:p.selectedTrial(env).authorizationId,evidenceHash:p.hash(p.selectedTrial(env)),uncertaintyAccepted:true,providerHardCap:false},providerReadinessHash:env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256,maxMicros:1000000,maxInputTokens:60000,maxOutputTokens:require('./agent-operations-implementation').totalOutputLimit(context),model:'gpt-6.1-sol',reasoning:'medium',proposalOnly:true,servicePrincipalConsent:true,ownerAcceptance:false,publicationAuthorized:false,expiresAt:Math.min(clock()+600000,plan.deadline)};
  check(blockers(approval).length===0&&p.uncertainReadiness(context,p.selectedTrial(env))===env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256,'ENG_CONTROL_ACTIVATION_BLOCKED');return{planId:plan.id,expectedRevision:plan.revision,approval,executionAuthorized:false};
 }
 async function sequenceRegister(actor,input){check(exact(input,['planId','expectedRevision','sequenceId','expiresAt',...(isDevelopmentTrial()?['configurationIntentId']:[])]),'ENG_CONTROL_INPUT');check(isSequenceTrial()&&blockers().length===0,'ENG_CONTROL_ACTIVATION_BLOCKED');const {context,broker}=await subject(actor,input);check(p.uncertainReadiness(context,p.selectedTrial(env))===env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256,'ENG_CONTROL_OWNER_TRIAL_PIN');return broker.registerSequence(actor,context,{id:input.sequenceId,expiresAt:input.expiresAt,...(isExpandedTrial()||isDevelopmentTrial()?{review:reviewedRelease()}:{}),...(isDevelopmentTrial()?{configurationIntentId:input.configurationIntentId}:{})});}
 async function sequenceEnroll(actor,input){check(exact(input,['planId','expectedRevision','sequenceId',...(isDevelopmentTrial()?['configurationIntentId']:[])]),'ENG_CONTROL_INPUT');check((isExpandedTrial()||isDevelopmentTrial())&&blockers().length===0,'ENG_CONTROL_ACTIVATION_BLOCKED');const {context,broker}=await subject(actor,input);check(p.uncertainReadiness(context,p.selectedTrial(env))===env.CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256,'ENG_CONTROL_OWNER_TRIAL_PIN');return broker.enrollSequence(actor,context,input.sequenceId,reviewedRelease(),input.configurationIntentId);}
 async function sequenceStatus(actor,input){check(exact(input,['planId','expectedRevision','sequenceId']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input);return broker.sequenceStatus(actor,context,input.sequenceId);}
 async function sequenceStop(actor,input){await owner(actor);check(exact(input,['sequenceId'])&&/^sequence_[a-f0-9]{32}$/.test(input.sequenceId),'ENG_CONTROL_INPUT');return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).stopSequenceById(actor,input.sequenceId);}
 async function prepare(actor,input){input=structuredClone(input);check(exact(input,['planId','expectedRevision','approval']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input,{approval:input.approval});check(blockers(input.approval).length===0,'ENG_CONTROL_ACTIVATION_BLOCKED');await headroom();return broker.prepareApproval(actor,context,input.approval);}
 async function sourceTestMetadata(actor,input){await owner(actor);check(exact(input,[]),'ENG_CONTROL_INPUT');return organization.engineering(()=>{throw Error('ENG_TEST_PERMISSION');}).sourceTestMetadata(actor);}
 async function authorizeSourceTests(actor,input){input=structuredClone(input);check(exact(input,['planId','expectedRevision','approval','expectedApprovalRevision']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input,{approval:input.approval});return broker.authorizeSourceTests(actor,context,input.approval,input.expectedApprovalRevision);}
 async function activate(actor,input){input=structuredClone(input);check(exact(input,['planId','expectedRevision','approval','expectedApprovalRevision']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input,{approval:input.approval});check(blockers(input.approval).length===0&&Number.isSafeInteger(input.expectedApprovalRevision),'ENG_CONTROL_ACTIVATION_BLOCKED');return broker.activateApproval(actor,context,input.approval,input.expectedApprovalRevision);}
 async function status(actor,input){await owner(actor);check(exact(input,['planId','approvalId','approvalHash']),'ENG_CONTROL_INPUT');return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).approvalStatusById(actor,input);}
 async function revoke(actor,input){await owner(actor);check(exact(input,['planId','approvalId','approvalHash']),'ENG_CONTROL_INPUT');return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).revokeApprovalById(actor,input);}
 async function verifyModel(actor,input,{signal}={}){
  check(exact(input,['planId','expectedRevision']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input),{PROJECT,workerCredential}=require('./agent-operations-project'),controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  const failures=require('./agent-operations-engineering-failure'),started=clock(),facts={probeId:'metadata_'+require('node:crypto').randomBytes(16).toString('hex'),phase:'credential-preflight',dispatched:false};
  let listener,providerTimer;const timer=setTimeout(()=>controller.abort(),30000),cancelled=new Promise((_,reject)=>{listener=()=>reject(Error('ENG_CONTROL_METADATA_UNCONFIRMED'));if(combined.aborted)listener();else combined.addEventListener('abort',listener,{once:true});});
  try{return await Promise.race([(async()=>{
   const key=workerCredential(env);facts.phase='owner-preflight';check(!combined.aborted,'ENG_CONTROL_METADATA_UNCONFIRMED');await subject(actor,input);check(!combined.aborted,'ENG_CONTROL_METADATA_UNCONFIRMED');
   facts.phase='provider-request';facts.dispatched=true;providerTimer=setTimeout(()=>controller.abort(),10000);
   const response=await fetch('https://api.openai.com/v1/models/gpt-6.1-sol',{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+key,'OpenAI-Project':PROJECT.projectId,'OpenAI-Organization':PROJECT.organizationId,Accept:'application/json'},signal:combined});
   facts.httpStatus=response.status;const requestId=response.headers?.get('x-request-id');facts.requestId=typeof requestId==='string'&&!requestId.includes(key)&&!/(?:sk-|bearer|authorization)/i.test(requestId)?requestId:null;facts.code='provider-http';check(!combined.aborted&&response.ok&&response.status===200&&!response.redirected,'ENG_CONTROL_METADATA_UNCONFIRMED');
   facts.phase='provider-body';facts.code='provider-body';const raw=await require('./agent-operations-engineering-transport').boundedJson(response,key);clearTimeout(providerTimer);facts.phase='provider-shape';facts.code='provider-shape';check(!combined.aborted&&raw.object==='model'&&raw.id==='gpt-6.1-sol','ENG_CONTROL_METADATA_UNCONFIRMED');
   facts.phase='owner-revalidation';facts.code='authority';await subject(actor,input);check(!combined.aborted,'ENG_CONTROL_METADATA_UNCONFIRMED');
   const access={model:raw.id,projectId:PROJECT.projectId,httpStatus:200,observedAt:clock()};facts.phase='audit-commit';facts.code='persistence';await broker.recordModelAccess(actor,context,access);facts.phase='after-audit';facts.code='authority';check(!combined.aborted,'ENG_CONTROL_METADATA_UNCONFIRMED');return{model:raw.id,projectId:PROJECT.projectId,observedAt:access.observedAt,sourceCommit:runtime.commit,releaseFingerprint:release().digest,deploymentId:runtime.deploymentId,origin:runtime.origin,taskId:input.planId,metadataAccessVerified:true,responsesAccessVerified:false,pricingVerified:false,countAccessVerified:false,paidExecution:false};
  })(),cancelled]);}catch{
   const phase=facts.phase;facts.code=signal?.aborted?'cancelled':controller.signal.aborted?'timeout':phase==='credential-preflight'?'credential-configuration':phase==='owner-preflight'?'authority':facts.code||'provider-network';facts.elapsedMs=clock()-started;
   const diagnostic=failures.metadataDiagnostic(context,facts,clock());let saved;const confirmed=await require('./agent-operations-engineering-transport').boundedCleanup(async()=>{saved=await broker.recordModelMetadataFailure(actor,context,diagnostic);return saved?.confirmed===true;},2000);
   throw failures.metadataError(diagnostic,{confirmed,auditHash:confirmed?saved.auditHash:null});
  }finally{clearTimeout(providerTimer);clearTimeout(timer);combined.removeEventListener('abort',listener);controller.abort();}
 }
 async function run(actor,input,{signal}={}){
  check(exact(input,['planId','expectedRevision','approval','expectedApprovalRevision']),'ENG_CONTROL_INPUT');
  const captured=structuredClone(input),ap=captured.approval,frame=await subject(actor,captured,{approval:ap});
  check(blockers(ap).length===0,'ENG_CONTROL_ACTIVATION_BLOCKED');
  const recovery={planId:captured.planId,approvalId:ap.id,approvalHash:p.hash(ap)};
  try{
  await headroom();
  const active=await frame.broker.approvalStatusById(actor,recovery);check(active.status==='active'&&active.revision===captured.expectedApprovalRevision&&active.leaseUntil>clock(),'ENG_CONTROL_APPROVAL_NOT_ACTIVE');
  const remainingMs=Math.min(600000,ap.expiresAt-clock(),frame.plan.deadline-clock());if(isStarterTrial())check(remainingMs>15000,'ENG_CONTROL_DEADLINE');
  const result=await withActivation({signal,leaseMs:require('./agent-operations-approval-lifecycle').ENGINEERING_LEASE_MS,leaseUntil:active.leaseUntil,authorityExpiresAt:Math.min(ap.expiresAt,frame.plan.deadline),durationMs:Math.max(1,remainingMs-(isStarterTrial()?15000:0)),...(isStarterTrial()?{deadlineAt:Date.now()+remainingMs}:{}),
   prepare:async()=>frame,
   activate:async()=>{await subject(actor,captured);return{leaseUntil:active.leaseUntil};},
   renew:async(_,{signal:renewSignal,onPhase,deadlineAt})=>frame.broker.renewApproval(actor,frame.context,ap,{signal:renewSignal,onPhase,deadlineAt}),
   run:async(_,{signal:runSignal})=>{
    const receipts=[];
    for(const [i,stage]of inference.STAGES.entries()){
     const task=frame.plan.tasks[i],context={...structuredClone(frame.context),binding:{...structuredClone(frame.context.binding),taskId:task.id,executionId:ap.id+'_'+stage,fence:task.fence,authorizationRevision:task.revision},priorReceipts:structuredClone(receipts)};
     // Only pre-transport checks belong here. execute owns any dispatched-stage
     // diagnostic; the journal independently rejects admission-only receipts
     // if an attempt already exists. Earlier stages retain their actual usage.
     try{
      check(!runSignal.aborted,'ENG_CONTROL_CANCELLED');await subject(actor,captured,{approval:ap});check(!runSignal.aborted,'ENG_CONTROL_CANCELLED');check(blockers(ap).length===0,'ENG_CONTROL_ACTIVATION_BLOCKED');
     }catch(error){
      const diagnostic=require('./agent-operations-engineering-failure').failure(error,{stage,phase:'admission',stopReason:runSignal.aborted?'cancelled':'authority',authorityReason:runSignal.reason,providerStarted:false,countStarted:false,mode:'pilot'});
      await require('./agent-operations-engineering-transport').boundedCleanup(()=>frame.broker.recordAdmissionFailure(actor,stage,context,diagnostic));
      throw error;
     }
     const managedLiveness=Object.freeze({});
     managedStages.set(managedLiveness,{broker:frame.broker,signal:runSignal,stage,actorHash:p.hash(actor),contextHash:p.hash(context),approvalHash:p.hash(ap)});
     try{const executed=await require('./agent-operations-engineering-transport').execute({broker:frame.broker,actor,stage,context,mode:'pilot',approval:ap,env,signal:runSignal,managedLiveness,timeoutMs:isStarterTrial()?135000:150000});receipts.push(executed.receipt);}
     finally{managedStages.delete(managedLiveness);}
    }
    return{mode:'live-proposal-only',workflowId:ap.workflowId,planId:captured.planId,receipts,artifact:require('./agent-operations-implementation').enabled(frame.context)?receipts[1].implementationArtifact:{kind:'inert-copy-proposal',proposal:receipts[1].response.proposal,sourceCommit:runtime.commit,proposalHash:p.hash(receipts[1].response.proposal),sourceExecuted:false,publicationAuthorized:false},acceptedWork:false,independentlyAuthenticatedAcceptance:false,automatedTechnicalReviewsOnly:true,qualification:'Existing operations plan is the frozen admission manifest; actual model roles, usage and results are in the linked organization workflow. Its historical fixture task records are not relabelled as live execution.'};
   },
   revoke:async()=>frame.broker.revokeApprovalById(actor,recovery),
   readback:async()=>{
    await owner(actor);const status=await frame.broker.approvalStatusById(actor,recovery),state=await organization.read(),o=state.operations,w=o?.workflows.find(w=>w.id===ap.workflowId&&w.profile===p.PROFILE),grants=o?.grants.filter(g=>g.approvalId===ap.id)||[];
    check(status.status==='revoked'&&status.leaseUntil===0&&grants.every(g=>g.revoked)&&(!w||w.leaseUntil===0&&w.attempts.every(a=>a.closed)),'ENG_CONTROL_SHUTDOWN_UNCONFIRMED');
    check(!(o?.approvals||[]).some(a=>a.id!==ap.id&&a.engineeringScope?.binding.ownerHash===frame.context.binding.ownerHash&&a.engineeringScope?.binding.workspaceHash===frame.context.binding.workspaceHash&&['active','consumed'].includes(a.status)&&a.leaseUntil>clock()),'ENG_CONTROL_REPLACEMENT_AUTHORITY_UNCONFIRMED');
    return{paidExecution:false,replacementPaidExecution:false,approvalId:ap.id,status:'revoked',leaseUntil:0,activeGrants:0,activeAttempts:0,credential:'existing-server-credential-not-issued-to-model-or-child',acceptedWork:false};
   }
  });return result;
  }finally{const closed=await require('./agent-operations-engineering-transport').boundedCleanup(async()=>{const r=await frame.broker.revokeApprovalById(actor,recovery);return r.status==='revoked'&&r.leaseUntil===0;});check(closed,'ENG_CONTROL_SHUTDOWN_UNCONFIRMED');}
 }

 async function cleanupReconcile(actor,input){await owner(actor);check(require('./agent-operations-engineering-configuration').FLAGS.every(k=>env[k]==='false'),'ENG_CLEANUP_SHUTDOWN');const review=reviewedRelease();check(review&&equal(input?.review,review),'ENG_CLEANUP_REVIEW');return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).cleanupReconcile(actor,input,{...runtime,release:release()});}
 async function configurationClaim(actor,input){check(exact(input,['planId','expectedRevision','intent']),'ENG_CONTROL_INPUT');const {context,broker,plan}=await subject(actor,input);return broker.configurationClaim(actor,context,input.intent,{planRevision:plan.revision,taskDeadline:plan.deadline});}
 async function configurationStep(actor,input){check(exact(input,['planId','expectedRevision','intent']),'ENG_CONTROL_INPUT');const record=await configurationStatus(actor,{id:input.intent?.id});const {context,broker,plan}=await subject(actor,input,record.configurationLease?{configurationIntent:record,configurationStep:input.intent}:{configurationStep:input.intent});return broker.configurationStep(actor,context,input.intent,plan);}
 async function configurationStatus(actor,input){await owner(actor);check(exact(input,['id']),'ENG_CONTROL_INPUT');return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).configurationStatus(actor,input.id);}
 async function configurationComplete(actor,input){check(exact(input,['planId','expectedRevision','intent']),'ENG_CONTROL_INPUT');const {context,broker}=await subject(actor,input);return broker.configurationComplete(actor,context,input.intent,env);}
 async function configurationCancel(actor,input){await owner(actor);check(exact(input,['id','intentHash','providerMetadataHash']),'ENG_CONTROL_INPUT');const cfg=require('./agent-operations-engineering-configuration'),shutdown={runtime:{...runtime,release:release()},flags:Object.fromEntries(cfg.FLAGS.map(k=>[k,env[k]]))};return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).configurationCancel(actor,input,shutdown);}
 async function configurationRejectionReconcile(actor,input){await owner(actor);const cfg=require('./agent-operations-engineering-configuration');check(cfg.FLAGS.every(k=>env[k]==='false'),'ENG_CONFIG_SHUTDOWN');const review=reviewedRelease();check(review&&equal(input?.review,review),'ENG_CONFIG_REVIEW');return organization.engineering(async()=>{throw Error('ENG_CONTROL_RECOVERY_ONLY');}).configurationRejectionReconcile(actor,input,{...runtime,release:release()});}

 return Object.freeze({sourceTestMetadata,authorizeSourceTests,cleanupReconcile,configurationClaim,configurationStep,configurationStatus,configurationComplete,configurationCancel,configurationRejectionReconcile,sequenceEnroll,sequenceRegister,sequenceStatus,sequenceStop,trialManifest,readiness,prepare,activate,status,revoke,verifyModel,run});
}
module.exports={withActivation,createEngineeringOwnerControl,managedStageMatches};
