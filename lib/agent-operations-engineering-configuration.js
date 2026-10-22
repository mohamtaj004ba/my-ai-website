'use strict';
// Pure records in the EXISTING owner/workspace organization CAS journal. No I/O,
// credentials, deployment executor or inference authority lives in this module.
const p=require('./agent-operations-engineering-provider-v2'),{isDeepStrictEqual:equal}=require('node:util');
const VERSION='engineering-preview-configuration-intent-v1',check=(x,c)=>{if(!x)throw Error(c);};
const SCOPE=Object.freeze({projectId:'prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX',teamId:'team_6Rg3DdCrvOml6oEGwx6Ndf1I',environment:'preview',branch:'feature/callercore-dashboards'});
const FLAGS=Object.freeze(['CALLERCORE_AGENTOPS_PAID_ENABLED','CALLERCORE_AGENTOPS_ENGINEERING_PAID_ENABLED','CALLERCORE_AGENTOPS_ENGINEERING_COUNT_ENABLED']);
const POLICY_KEYS=Object.freeze(['CALLERCORE_AGENTOPS_ENGINEERING_TRIAL_AUTHORIZATION_ID','CALLERCORE_AGENTOPS_ENGINEERING_COUNT_UNCERTAINTY_SHA256','CALLERCORE_AGENTOPS_ENGINEERING_PROVIDER_READINESS_SHA256','CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_JSON','CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_SHA256']);
const KEYS=Object.freeze([...POLICY_KEYS,...FLAGS]),STEPS=Object.freeze([...KEYS.map(k=>'env:'+k),'deploy',...FLAGS.map(k=>'reset:'+k)]);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&equal(Object.keys(v).sort(),keys.slice().sort()),digest=x=>/^[a-f0-9]{64}$/.test(x||'');
function reviewFor(c,review){check(exact(review,['workQaHash','workAuditorHash','sourceCommit','releaseHash'])&&digest(review.workQaHash)&&digest(review.workAuditorHash)&&review.workQaHash!==review.workAuditorHash&&review.sourceCommit===c.binding.runtime.sourceCommit&&review.releaseHash===c.binding.runtime.release.digest,'ENG_CONFIG_REVIEW');return structuredClone(review);}
function expected(c,review){const r=reviewFor(c,review);return{[POLICY_KEYS[0]]:p.DEVELOPMENT_TRIAL.authorizationId,[POLICY_KEYS[1]]:p.hash(p.DEVELOPMENT_TRIAL),[POLICY_KEYS[2]]:p.uncertainReadiness(c,p.DEVELOPMENT_TRIAL),[POLICY_KEYS[3]]:JSON.stringify(r),[POLICY_KEYS[4]]:p.hash(r),...Object.fromEntries(FLAGS.map(k=>[k,'true']))};}
function collection(o){check(o.engineeringConfigurationIntents===undefined||Array.isArray(o.engineeringConfigurationIntents),'ENG_CONFIG_STORAGE');const rows=o.engineeringConfigurationIntents||[];for(const r of rows)if(r?.status==='cancelled')stored(r);return rows;}
function identity(c){return{ownerHash:c.binding.ownerHash,workspaceHash:c.binding.workspaceHash};}
function owned(o,c,id){const r=collection(o).find(r=>r.id===id);check(r&&r.version===VERSION&&equal(r.identity,identity(c)),'ENG_CONFIG_SCOPE');return r;}
function eventChain(r,complete=false){
 check(Array.isArray(r.events)&&r.events.length<=STEPS.length*2&&(!complete||r.events.length===STEPS.length*2),'ENG_CONFIG_EVENT_CHAIN');let previous=null,at=r.createdAt;
 for(const [i,e]of r.events.entries()){
  check(exact(e,['step','phase','at','previousHash','hash'])&&e.step===STEPS[Math.floor(i/2)]&&e.phase===(i%2===0?'dispatch':e.phase==='unknown'&&i===r.events.length-1?'unknown':'acknowledged')&&Number.isSafeInteger(e.at)&&e.at>=at&&e.previousHash===previous,'ENG_CONFIG_EVENT_CHAIN');
  const {hash,...raw}=e;check(hash===p.hash(raw),'ENG_CONFIG_EVENT_CHAIN');previous=hash;at=e.at;
 }
 if(complete)check(r.events.every((e,i)=>e.phase===(i%2?'acknowledged':'dispatch')),'ENG_CONFIG_UNCONFIRMED');
}
function intentBody(r){if(r.recovery!==undefined)validateRecovery(r);return{id:r.id,identity:r.identity,sequenceIntentId:r.sequenceIntentId,scope:r.scope,sourceCommit:r.sourceCommit,release:r.release,assignmentHash:r.assignmentHash,evidenceHash:r.evidenceHash,policyHash:r.policyHash,review:r.review,values:r.values,refreshKey:r.refreshKey,taskId:r.taskId,originalRuntime:r.originalRuntime,configurationHash:r.configurationHash,createdAt:r.createdAt,expiresAt:r.expiresAt,...(r.configurationLease?{configurationLease:r.configurationLease}:{}),...(r.recovery?{recovery:r.recovery}:{})};}
function refreshDomain(r){return p.hash({identity:r.identity,scope:SCOPE,sourceCommit:r.sourceCommit,release:r.release,assignmentHash:r.assignmentHash,evidenceHash:r.evidenceHash,authorizationId:p.DEVELOPMENT_TRIAL.authorizationId});}
function recoveryKey(recovery,taskId){return p.hash({recovery,taskId});}
function validateRecovery(r){const x=r.recovery,rejected=x?.version==='owner-attested-rejected-deploy-recovery-v1';check(exact(x,['version','baseRefreshKey','predecessorIntentId','predecessorCancellationHash',...(rejected?['reconciliationHash']:[])])&&(rejected?digest(x.reconciliationHash):x.version==='cancelled-predeploy-configuration-recovery-v1')&&x.baseRefreshKey===refreshDomain(r)&&/^refresh_[a-f0-9]{32}$/.test(x.predecessorIntentId||'')&&x.predecessorIntentId!==r.id&&digest(x.predecessorCancellationHash)&&r.refreshKey===recoveryKey(x,r.taskId),'ENG_CONFIG_RECOVERY');}
function stored(r){check(r.version===VERSION&&equal(r.scope,SCOPE)&&exact(r.values,KEYS)&&r.configurationHash===p.hash(r.values)&&r.intentHash===p.hash(intentBody(r))&&r.expiresAt===r.createdAt+86400000,'ENG_CONFIG_STORAGE');eventChain(r);if(r.rejectionReconciliation!==undefined)require('./agent-operations-configuration-rejection').validate(r,r.rejectionReconciliation);if(r.configurationLease){const l=r.configurationLease;check(exact(l,['version','planRevision','taskRevision','fence','taskDeadline'])&&l.version==='owner-configuration-lease-v1'&&[l.planRevision,l.taskRevision,l.fence,l.taskDeadline].every(Number.isSafeInteger)&&l.planRevision>=1&&l.taskRevision>=0&&l.fence>=0&&l.taskDeadline>r.createdAt&&l.taskDeadline<=r.createdAt+600000,'ENG_CONFIG_STORAGE');}if(r.status==='cancelled'){const x=r.cancellation,{hash,...body}=x||{};check(exact(x,['version','at','reason','intentHash','eventsHash','providerMetadataHash','shutdownRuntime','flags','executionAuthorized','fundingAuthority','hash'])&&x.version==='configuration-cancelled-unverified-v1'&&Number.isSafeInteger(x.at)&&x.at>=r.createdAt&&x.reason==='owner-stopped-unverified-preparation'&&x.intentHash===r.intentHash&&x.eventsHash===p.hash(r.events)&&digest(x.providerMetadataHash)&&equal(x.flags,Object.fromEntries(FLAGS.map(k=>[k,'false'])))&&x.executionAuthorized===false&&x.fundingAuthority===false&&hash===p.hash(body),'ENG_CONFIG_STORAGE');runtimeScope(x.shutdownRuntime);}else check(r.cancellation===undefined,'ENG_CONFIG_STORAGE');}
function runtimeScope(r){check(r?.environment==='preview'&&r.branch===SCOPE.branch&&/^[a-f0-9]{40}$/.test(r.commit||'')&&/^dpl_[A-Za-z0-9]+$/.test(r.deploymentId||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(r.origin||'')&&r.release?.version==='organization-contracts-v4'&&digest(r.release.digest),'ENG_CONFIG_SCOPE');}
function publicView(r){stored(r);return structuredClone({...r,executionAuthorized:false});}
function physicalWorkflowClean(w){if(require('./agent-operations-engineering-cleanup').reconciled(w))return true;return(w?.attempts||[]).every(a=>{
 const prep=a.workspacePreparation;if(prep){const {hash,...raw}=prep;if(hash!==p.hash(raw)||prep.contextHash!==a.contextHash||!digest(prep.proposalHash)||prep.status!=='destroyed')return false;}
 return a.diagnostic?.workspaceCleanupConfirmed!==false&&(!(a.failure?.diagnostic?.phase==='workspace-prepare')||a.diagnostic?.workspaceCleanupConfirmed===true||prep?.status==='destroyed');
});}
const CLEANUP_RECORD_LIMIT=128,cleanupTerminal=new Set(['verified','rejected','cancelled','blocked','failed']);
function legacyOwnerProject(w,o){
 if(!w||w.profile!=='organization-evidence-first-v1'||w.mode!=='pilot'||!Array.isArray(o?.approvals)||!Array.isArray(o?.grants))return null;
 const a=o.approvals.find(a=>a?.id===w.approvalId),g=o.grants.find(g=>g?.id===w.grantId),scope={origin:'https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app',commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',paths:['/industries/legal','/#pricing']};
 if(!a||!g||a.workflowId!==w.id||!digest(a.approvalHash)||w.approvalHash!==a.approvalHash||g.approvalHash!==a.approvalHash||g.mode!=='pilot'||g.level!=='inspect-and-test'||g.approvalId!==a.id||!digest(a.ownerHash)||g.issuerHash!==a.ownerHash||w.principal!=='owner-approved:'+a.id||!equal(g.scope,scope)||!equal(w.scope,scope)||w.contractHash!==a.contractHash||w.contractVersion!==a.contractVersion||!digest(a.contractHash)||typeof a.contractVersion!=='string'||!/^[a-f0-9]{40}$/.test(a.sourceCommit||'')||w.executionRuntime?.sourceCommit!==a.sourceCommit||w.executionRuntime?.origin!==a.deploymentOrigin||typeof a.deploymentOrigin!=='string')return null;
 if([a,g,w].some(r=>['engineeringScope','binding','workspacePreparation','implementationArtifact'].some(key=>r[key]!==undefined)))return null;
 const workspaces=[a.ownerWorkspaceId,g.workspaceId,w.workspaceId].filter(x=>x!==undefined);if(workspaces.some(x=>typeof x!=='string'||!x)||new Set(workspaces).size>1)return null;
 return{approvalId:a.id,grantId:g.id,workflowId:w.id,ownerHash:a.ownerHash,workspaceId:workspaces[0]||null};
}
function workflowCleanupProblems(w,o){
 const problems=[],add=(category,field)=>problems.push({category,recordType:'workflow',recordId:typeof w?.id==='string'?w.id:null,field});
 if(!w||typeof w!=='object'||Array.isArray(w)){add('invalid-records','workflow');return problems;}
 if(w.mode!=='pilot')return problems;
 if(w.leaseUntil!==0)add('workflow-lease','leaseUntil');
 if(w.profile===p.PROFILE){
  if(!cleanupTerminal.has(w.status))add('workflow-open-attempt','status');
  if(!Array.isArray(w.attempts)||w.attempts.length>CLEANUP_RECORD_LIMIT||w.attempts.some(a=>!a||typeof a!=='object'||Array.isArray(a)))add('native-attempts-invalid','attempts');
  else{if(w.attempts.some(a=>a.closed!==true))add('workflow-open-attempt','attempts.closed');if(!physicalWorkflowClean(w))add('native-physical-cleanup','attempts.workspacePreparation');}
 }else if(w.profile==='organization-evidence-first-v1'){
  const project=legacyOwnerProject(w,o),a=(o.approvals||[]).find(a=>a?.id===w.approvalId),g=(o.grants||[]).find(g=>g?.id===w.grantId);
  const valid=project&&cleanupTerminal.has(w.status)&&w.leaseUntil===0&&w.attempts===undefined&&a.status==='revoked'&&a.leaseUntil===0&&g.revoked===true;
  if(!valid&&!require('./agent-operations-legacy-maintenance').reconciled(w,o))add('legacy-unverified','legacyContract');
 }else add('unrecognized-profile','profile');
 return problems;
}
function cleanupProblems(o){
 const problems=[],rows={};for(const name of ['approvals','grants','workflows']){const value=o?.[name];if(value!==undefined&&!Array.isArray(value)){problems.push({category:'invalid-records',recordType:name,recordId:null,field:name});return problems;}rows[name]=value||[];}
 for(const a of rows.approvals){if(!a||typeof a!=='object'||Array.isArray(a))problems.push({category:'invalid-records',recordType:'approval',recordId:null,field:'approval'});else if(['active','consumed'].includes(a.status))problems.push({category:'active-approval',recordType:'approval',recordId:typeof a.id==='string'?a.id:null,field:'status'});}
 for(const g of rows.grants){if(!g||typeof g!=='object'||Array.isArray(g))problems.push({category:'invalid-records',recordType:'grant',recordId:null,field:'grant'});else if(g.mode==='pilot'&&g.revoked!==true)problems.push({category:'unrevoked-pilot-grant',recordType:'grant',recordId:typeof g.id==='string'?g.id:null,field:'revoked'});}
 // Receipt reconciliation needs the original audit chain and maintenance records,
 // alongside all historical arrays validated above. A projection loses that proof.
 const context={...o,...rows};for(const w of rows.workflows)problems.push(...workflowCleanupProblems(w,context));return problems;
}
function clean(o){check(cleanupProblems(o).length===0,'ENG_CONFIG_CLEANUP');}
function claim(o,c,input,now,planMetadata){
 check(exact(input,['id','sequenceIntentId','scope','values','review'])&&/^refresh_[a-f0-9]{32}$/.test(input.id||'')&&/^sequence_[a-f0-9]{32}$/.test(input.sequenceIntentId||'')&&equal(input.scope,SCOPE),'ENG_CONFIG_INPUT');
 check(require('./agent-operations-implementation').enabled(c)&&c.assignment===p.DEVELOPMENT_TRIAL.objective&&c.binding.runtime.branch===SCOPE.branch,'ENG_CONFIG_TASK');
 check(exact(input.values,KEYS)&&equal(input.values,expected(c,input.review)),'ENG_CONFIG_VALUES');clean(o);
 const raw={identity:identity(c),sequenceIntentId:input.sequenceIntentId,scope:SCOPE,sourceCommit:c.binding.runtime.sourceCommit,release:structuredClone(c.binding.runtime.release),assignmentHash:p.hash(c.assignment),evidenceHash:p.hash(c.evidence),policyHash:p.hash(p.DEVELOPMENT_TRIAL),review:reviewFor(c,input.review),values:structuredClone(input.values)};
 // Caller-chosen IDs or a new review receipt cannot bypass an earlier dispatch.
 const rows=collection(o),baseRefreshKey=refreshDomain(raw),prior=rows.filter(r=>refreshDomain(r)===baseRefreshKey);
 check(!rows.some(r=>r.id===input.id||equal(r.identity,raw.identity)&&['claimed','unconfirmed'].includes(r.status)),'ENG_CONFIG_DUPLICATE');
 let refreshKey=baseRefreshKey,recovery;
 if(prior.length){
  check(!rows.some(r=>r.taskId===c.binding.planId),'ENG_CONFIG_DUPLICATE');
  // Cancellation or a missing deployment alone never permits another attempt.
  // A separately reviewed owner-attested HTTP rejection is a narrow exception.
  let rejected;
  for(const r of prior){stored(r);check(r.status==='cancelled'&&r.taskId!==c.binding.planId,'ENG_CONFIG_DUPLICATE');
   if(r.events.some(e=>e.step==='deploy')){const x=r.rejectionReconciliation;check(x&&r===prior.at(-1)&&r.sequenceIntentId===input.sequenceIntentId&&!rows.some(n=>n.recovery?.reconciliationHash===x.hash),'ENG_CONFIG_DUPLICATE');require('./agent-operations-configuration-rejection').validate(r,x);const u=x.reviewRuntime;check(u.commit===c.binding.runtime.sourceCommit&&u.deploymentId===c.binding.runtime.deploymentId&&u.origin===c.binding.runtime.origin&&equal(u.release,c.binding.runtime.release)&&equal(x.review,raw.review),'ENG_CONFIG_RECOVERY');rejected=r;}
   else{check(r.sequenceIntentId!==input.sequenceIntentId,'ENG_CONFIG_DUPLICATE');check(r.events.length%2===0&&r.events.every((e,i)=>e.phase===(i%2?'acknowledged':'dispatch')),'ENG_CONFIG_RECOVERY');}
   const s=r.cancellation.shutdownRuntime;check(s.commit===c.binding.runtime.sourceCommit&&s.deploymentId===c.binding.runtime.deploymentId&&s.origin===c.binding.runtime.origin&&equal(s.release,c.binding.runtime.release),'ENG_CONFIG_RECOVERY');}
  const previous=prior.at(-1);recovery={version:rejected?'owner-attested-rejected-deploy-recovery-v1':'cancelled-predeploy-configuration-recovery-v1',baseRefreshKey,predecessorIntentId:previous.id,predecessorCancellationHash:previous.cancellation.hash,...(rejected?{reconciliationHash:rejected.rejectionReconciliation.hash}:{})};refreshKey=recoveryKey(recovery,c.binding.planId);
 }
 check(!rows.some(r=>r.refreshKey===refreshKey),'ENG_CONFIG_DUPLICATE');
 require('./agent-operations-budget').accountingFor({operations:o},p.DEVELOPMENT_TRIAL.budgetId);
 if(planMetadata!==undefined)check(exact(planMetadata,['planRevision','taskDeadline'])&&Number.isSafeInteger(planMetadata.planRevision)&&planMetadata.planRevision>=1&&Number.isSafeInteger(planMetadata.taskDeadline)&&planMetadata.taskDeadline>now&&planMetadata.taskDeadline<=now+600000,'ENG_CONFIG_TASK');
 const r={version:VERSION,id:input.id,...raw,refreshKey,taskId:c.binding.planId,originalRuntime:structuredClone(c.binding.runtime),configurationHash:p.hash(input.values),status:'claimed',createdAt:now,expiresAt:now+86400000,events:[],...(planMetadata?{configurationLease:{version:'owner-configuration-lease-v1',...planMetadata,taskRevision:c.binding.authorizationRevision,fence:c.binding.fence}}:{}),...(recovery?{recovery}:{})};r.intentHash=p.hash(intentBody(r));o.engineeringConfigurationIntents??=[];o.engineeringConfigurationIntents.push(r);return publicView(r);
}
function status(o,c,id){return publicView(owned(o,c,id));}
function assertStepLease(r,c,plan,now){stored(r);check(r.status==='claimed'&&r.expiresAt>now&&r.configurationLease&&equal(r.identity,identity(c))&&plan?.id===r.taskId&&plan.status==='queued'&&plan.revision===r.configurationLease.planRevision&&plan.deadline===r.configurationLease.taskDeadline&&equal(plan.runtime,r.originalRuntime)&&plan.objective===p.DEVELOPMENT_TRIAL.objective&&plan.engineeringProfile==='engineering-implementation-v1'&&Array.isArray(plan.tasks)&&plan.tasks.length===5&&plan.tasks.every(t=>Array.isArray(t.attempts)&&t.attempts.length===0)&&plan.tasks[0].revision===r.configurationLease.taskRevision&&plan.tasks[0].fence===r.configurationLease.fence&&c.binding.authorizationRevision===r.configurationLease.taskRevision&&c.binding.fence===r.configurationLease.fence,'ENG_CONFIG_TASK');return true;}
function step(o,c,input,now,plan){
 check(exact(input,['id','step','phase'])&&STEPS.includes(input.step)&&['dispatch','acknowledged','unknown'].includes(input.phase),'ENG_CONFIG_STEP');const r=owned(o,c,input.id);check(r.status==='claimed'&&r.expiresAt>now&&r.events.length<40,'ENG_CONFIG_STATE');
 stored(r);check(c.binding.planId===r.taskId&&equal(c.binding.runtime,r.originalRuntime)&&p.hash(c.assignment)===r.assignmentHash&&p.hash(c.evidence)===r.evidenceHash,'ENG_CONFIG_TASK');if(r.configurationLease)assertStepLease(r,c,plan,now);
 const previous=r.events.filter(e=>e.phase==='acknowledged'),pending=r.events.at(-1);
 if(input.phase==='dispatch'){check((!pending||pending.phase==='acknowledged')&&input.step===STEPS[previous.length],'ENG_CONFIG_DUPLICATE');}
 else check(pending?.phase==='dispatch'&&pending.step===input.step,'ENG_CONFIG_ACK');
 const raw={step:input.step,phase:input.phase,at:now,previousHash:pending?.hash||null};r.events.push({...raw,hash:p.hash(raw)});if(input.phase==='unknown')r.status='unconfirmed';return publicView(r);
}
function cancel(o,c,input,now,shutdown){check(exact(input,['id','intentHash','providerMetadataHash'])&&digest(input.intentHash)&&digest(input.providerMetadataHash),'ENG_CONFIG_INPUT');const r=owned(o,c,input.id);stored(r);check(input.intentHash===r.intentHash&&['claimed','unconfirmed','cancelled'].includes(r.status),'ENG_CONFIG_STATE');runtimeScope(shutdown.runtime);check(equal(shutdown.flags,Object.fromEntries(FLAGS.map(k=>[k,'false']))),'ENG_CONFIG_SHUTDOWN');clean(o);if(r.status==='cancelled'){check(r.cancellation.providerMetadataHash===input.providerMetadataHash,'ENG_CONFIG_STATE');return publicView(r);}const body={version:'configuration-cancelled-unverified-v1',at:now,reason:'owner-stopped-unverified-preparation',intentHash:r.intentHash,eventsHash:p.hash(r.events),providerMetadataHash:input.providerMetadataHash,shutdownRuntime:structuredClone(shutdown.runtime),flags:structuredClone(shutdown.flags),executionAuthorized:false,fundingAuthority:false};r.status='cancelled';r.cancellation={...body,hash:p.hash(body)};return publicView(r);}
function complete(o,c,input,now,env){
 check(exact(input,['id','providerMetadataHash'])&&digest(input.providerMetadataHash),'ENG_CONFIG_PROOF');const r=owned(o,c,input.id);clean(o);
 stored(r);eventChain(r,true);check(r.status==='claimed'&&r.expiresAt>now,'ENG_CONFIG_UNCONFIRMED');
 check(c.binding.runtime.sourceCommit===r.sourceCommit&&equal(c.binding.runtime.release,r.release)&&c.binding.runtime.branch===SCOPE.branch&&c.binding.runtime.deploymentId!==r.originalRuntime.deploymentId&&c.assignment===p.DEVELOPMENT_TRIAL.objective&&p.hash(c.evidence)===r.evidenceHash,'ENG_CONFIG_DEPLOYMENT');
 check(equal(r.values,expected(c,r.review))&&equal(Object.fromEntries(KEYS.map(k=>[k,env[k]])),r.values),'ENG_CONFIG_DEPLOYED_VALUES');
 r.status='verified';r.completedAt=now;r.deployment=structuredClone(c.binding.runtime);r.providerMetadataHash=input.providerMetadataHash;r.futurePaidFlagsDisabled=true;
 r.completionHash=p.hash({refreshKey:r.refreshKey,deployment:r.deployment,configurationHash:r.configurationHash,providerMetadataHash:r.providerMetadataHash,lastStepHash:r.events.at(-1).hash});return publicView(r);
}
function validateCompletedRecord(r){stored(r);eventChain(r,true);check(r.status==='verified'&&r.futurePaidFlagsDisabled===true&&digest(r.providerMetadataHash)&&r.deployment?.sourceCommit===r.sourceCommit&&equal(r.deployment.release,r.release)&&r.deployment.branch===SCOPE.branch&&r.deployment.deploymentId!==r.originalRuntime.deploymentId&&r.completionHash===p.hash({refreshKey:r.refreshKey,deployment:r.deployment,configurationHash:r.configurationHash,providerMetadataHash:r.providerMetadataHash,lastStepHash:r.events.at(-1)?.hash}),'ENG_CONFIG_UNVERIFIED');return true;}
function rejectionReconcile(o,c,input,now,runtime){const r=owned(o,c,input?.id);stored(r);clean(o);const result=require('./agent-operations-configuration-rejection').append(r,input,now,runtime);return{...result,executionAuthorized:false,fundingAuthority:false};}
function assertCompleted(o,c,id,sequenceIntentId){const r=owned(o,c,id);validateCompletedRecord(r);check(r.sequenceIntentId===sequenceIntentId&&equal(r.deployment,c.binding.runtime)&&r.assignmentHash===p.hash(c.assignment)&&r.evidenceHash===p.hash(c.evidence)&&r.policyHash===p.hash(p.DEVELOPMENT_TRIAL),'ENG_CONFIG_UNVERIFIED');return r;}
module.exports={VERSION,SCOPE,FLAGS,POLICY_KEYS,KEYS,STEPS,expected,claim,status,step,cancel,rejectionReconcile,assertStepLease,complete,assertCompleted,validateCompletedRecord,physicalWorkflowClean,CLEANUP_RECORD_LIMIT,legacyOwnerProject,workflowCleanupProblems,cleanupProblems,clean};
