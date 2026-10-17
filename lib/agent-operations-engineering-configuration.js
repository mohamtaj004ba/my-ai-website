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
function collection(o){check(o.engineeringConfigurationIntents===undefined||Array.isArray(o.engineeringConfigurationIntents),'ENG_CONFIG_STORAGE');return o.engineeringConfigurationIntents||[];}
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
function intentBody(r){return{id:r.id,identity:r.identity,sequenceIntentId:r.sequenceIntentId,scope:r.scope,sourceCommit:r.sourceCommit,release:r.release,assignmentHash:r.assignmentHash,evidenceHash:r.evidenceHash,policyHash:r.policyHash,review:r.review,values:r.values,refreshKey:r.refreshKey,taskId:r.taskId,originalRuntime:r.originalRuntime,configurationHash:r.configurationHash,createdAt:r.createdAt,expiresAt:r.expiresAt};}
function stored(r){check(r.version===VERSION&&equal(r.scope,SCOPE)&&exact(r.values,KEYS)&&r.configurationHash===p.hash(r.values)&&r.intentHash===p.hash(intentBody(r))&&r.expiresAt===r.createdAt+86400000,'ENG_CONFIG_STORAGE');eventChain(r);}
function publicView(r){stored(r);return structuredClone({...r,executionAuthorized:false});}
function physicalWorkflowClean(w){return(w?.attempts||[]).every(a=>{
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
 const problems=[],rows={};for(const name of ['approvals','grants','workflows']){const value=o?.[name];if(value!==undefined&&(!Array.isArray(value)||value.length>CLEANUP_RECORD_LIMIT)){problems.push({category:'invalid-records',recordType:name,recordId:null,field:name});return problems;}rows[name]=value||[];}
 for(const a of rows.approvals){if(!a||typeof a!=='object'||Array.isArray(a))problems.push({category:'invalid-records',recordType:'approval',recordId:null,field:'approval'});else if(['active','consumed'].includes(a.status))problems.push({category:'active-approval',recordType:'approval',recordId:typeof a.id==='string'?a.id:null,field:'status'});}
 for(const g of rows.grants){if(!g||typeof g!=='object'||Array.isArray(g))problems.push({category:'invalid-records',recordType:'grant',recordId:null,field:'grant'});else if(g.mode==='pilot'&&g.revoked!==true)problems.push({category:'unrevoked-pilot-grant',recordType:'grant',recordId:typeof g.id==='string'?g.id:null,field:'revoked'});}
 for(const w of rows.workflows)problems.push(...workflowCleanupProblems(w,rows));return problems;
}
function clean(o){check(cleanupProblems(o).length===0,'ENG_CONFIG_CLEANUP');}
function claim(o,c,input,now){
 check(exact(input,['id','sequenceIntentId','scope','values','review'])&&/^refresh_[a-f0-9]{32}$/.test(input.id||'')&&/^sequence_[a-f0-9]{32}$/.test(input.sequenceIntentId||'')&&equal(input.scope,SCOPE),'ENG_CONFIG_INPUT');
 check(require('./agent-operations-implementation').enabled(c)&&c.assignment===p.DEVELOPMENT_TRIAL.objective&&c.binding.runtime.branch===SCOPE.branch,'ENG_CONFIG_TASK');
 check(exact(input.values,KEYS)&&equal(input.values,expected(c,input.review)),'ENG_CONFIG_VALUES');clean(o);
 const raw={identity:identity(c),sequenceIntentId:input.sequenceIntentId,scope:SCOPE,sourceCommit:c.binding.runtime.sourceCommit,release:structuredClone(c.binding.runtime.release),assignmentHash:p.hash(c.assignment),evidenceHash:p.hash(c.evidence),policyHash:p.hash(p.DEVELOPMENT_TRIAL),review:reviewFor(c,input.review),values:structuredClone(input.values)};
 // Caller-chosen IDs or a new review receipt cannot bypass an earlier dispatch.
 const refreshKey=p.hash({identity:raw.identity,scope:SCOPE,sourceCommit:raw.sourceCommit,release:raw.release,assignmentHash:raw.assignmentHash,evidenceHash:raw.evidenceHash,authorizationId:p.DEVELOPMENT_TRIAL.authorizationId});
 check(collection(o).length<20&&!collection(o).some(r=>r.id===input.id||r.refreshKey===refreshKey||equal(r.identity,raw.identity)&&['claimed','unconfirmed'].includes(r.status)),'ENG_CONFIG_DUPLICATE');
 check(require('./agent-operations-budget').accountingFor({operations:o},p.DEVELOPMENT_TRIAL.budgetId).remainingMicros>=1000000,'ENG_CONFIG_BUDGET');
 const r={version:VERSION,id:input.id,...raw,refreshKey,taskId:c.binding.planId,originalRuntime:structuredClone(c.binding.runtime),configurationHash:p.hash(input.values),status:'claimed',createdAt:now,expiresAt:now+86400000,events:[]};r.intentHash=p.hash(intentBody(r));o.engineeringConfigurationIntents??=[];o.engineeringConfigurationIntents.push(r);return publicView(r);
}
function status(o,c,id){return publicView(owned(o,c,id));}
function step(o,c,input,now){
 check(exact(input,['id','step','phase'])&&STEPS.includes(input.step)&&['dispatch','acknowledged','unknown'].includes(input.phase),'ENG_CONFIG_STEP');const r=owned(o,c,input.id);check(r.status==='claimed'&&r.expiresAt>now&&r.events.length<40,'ENG_CONFIG_STATE');
 stored(r);check(c.binding.planId===r.taskId&&equal(c.binding.runtime,r.originalRuntime)&&p.hash(c.assignment)===r.assignmentHash&&p.hash(c.evidence)===r.evidenceHash,'ENG_CONFIG_TASK');
 const previous=r.events.filter(e=>e.phase==='acknowledged'),pending=r.events.at(-1);
 if(input.phase==='dispatch'){check((!pending||pending.phase==='acknowledged')&&input.step===STEPS[previous.length],'ENG_CONFIG_DUPLICATE');}
 else check(pending?.phase==='dispatch'&&pending.step===input.step,'ENG_CONFIG_ACK');
 const raw={step:input.step,phase:input.phase,at:now,previousHash:pending?.hash||null};r.events.push({...raw,hash:p.hash(raw)});if(input.phase==='unknown')r.status='unconfirmed';return publicView(r);
}
function complete(o,c,input,now,env){
 check(exact(input,['id','providerMetadataHash'])&&digest(input.providerMetadataHash),'ENG_CONFIG_PROOF');const r=owned(o,c,input.id);clean(o);
 stored(r);eventChain(r,true);check(r.status==='claimed'&&r.expiresAt>now,'ENG_CONFIG_UNCONFIRMED');
 check(c.binding.runtime.sourceCommit===r.sourceCommit&&equal(c.binding.runtime.release,r.release)&&c.binding.runtime.branch===SCOPE.branch&&c.binding.runtime.deploymentId!==r.originalRuntime.deploymentId&&c.assignment===p.DEVELOPMENT_TRIAL.objective&&p.hash(c.evidence)===r.evidenceHash,'ENG_CONFIG_DEPLOYMENT');
 check(equal(r.values,expected(c,r.review))&&equal(Object.fromEntries(KEYS.map(k=>[k,env[k]])),r.values),'ENG_CONFIG_DEPLOYED_VALUES');
 r.status='verified';r.completedAt=now;r.deployment=structuredClone(c.binding.runtime);r.providerMetadataHash=input.providerMetadataHash;r.futurePaidFlagsDisabled=true;
 r.completionHash=p.hash({refreshKey:r.refreshKey,deployment:r.deployment,configurationHash:r.configurationHash,providerMetadataHash:r.providerMetadataHash,lastStepHash:r.events.at(-1).hash});return publicView(r);
}
function validateCompletedRecord(r){stored(r);eventChain(r,true);check(r.status==='verified'&&r.futurePaidFlagsDisabled===true&&digest(r.providerMetadataHash)&&r.deployment?.sourceCommit===r.sourceCommit&&equal(r.deployment.release,r.release)&&r.deployment.branch===SCOPE.branch&&r.deployment.deploymentId!==r.originalRuntime.deploymentId&&r.completionHash===p.hash({refreshKey:r.refreshKey,deployment:r.deployment,configurationHash:r.configurationHash,providerMetadataHash:r.providerMetadataHash,lastStepHash:r.events.at(-1)?.hash}),'ENG_CONFIG_UNVERIFIED');return true;}
function assertCompleted(o,c,id,sequenceIntentId){const r=owned(o,c,id);validateCompletedRecord(r);check(r.sequenceIntentId===sequenceIntentId&&equal(r.deployment,c.binding.runtime)&&r.assignmentHash===p.hash(c.assignment)&&r.evidenceHash===p.hash(c.evidence)&&r.policyHash===p.hash(p.DEVELOPMENT_TRIAL),'ENG_CONFIG_UNVERIFIED');return r;}
module.exports={VERSION,SCOPE,FLAGS,POLICY_KEYS,KEYS,STEPS,expected,claim,status,step,complete,assertCompleted,validateCompletedRecord,physicalWorkflowClean,CLEANUP_RECORD_LIMIT,legacyOwnerProject,workflowCleanupProblems,cleanupProblems,clean};
