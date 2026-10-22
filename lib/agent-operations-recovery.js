'use strict';
// Pure planning/simulation foundation. Not imported by any executor or broker.
const {createHash}=require('node:crypto');
const VERSION='recovery-plan-v1';
const STATES=Object.freeze(['Investigating','Remediation in Progress','Awaiting Independent QA','Blocked — Owner Approval Required','Resolved','Escalated','Cancelled']);
const HIGH_RISKS=new Set(['security','permissions','billing','customer-data','telephony','production','destructive','irreversible','legal','financially-significant']);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const check=(v,m)=>{if(!v)throw Error(m);};
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const token=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(s);
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const copy=v=>structuredClone(v);
function classify(failure){
 check(failure&&token(failure.id)&&digest(failure.evidenceHash)&&token(failure.rootCauseCode)&&['low','medium','high','critical'].includes(failure.severity)&&['routine',...HIGH_RISKS,'unknown'].includes(failure.backendRisk)&&['recoverable','unknown','permanent'].includes(failure.recoverability)&&['none','minor','material','unknown'].includes(failure.businessImpact)&&integer(failure.estimatedCostMicros)&&Array.isArray(failure.requiredPermissions)&&failure.requiredPermissions.every(token),'Invalid trusted failure classification');
 // The caller must supply a backend assessment. Model proposals cannot alter these fields.
 const ownerRequired=failure.backendRisk!=='routine'||['high','critical'].includes(failure.severity)||['material','unknown'].includes(failure.businessImpact)||failure.recoverability!=='recoverable';
 return{failureId:failure.id,evidenceHash:failure.evidenceHash,severity:failure.severity,rootCauseCode:failure.rootCauseCode,recoverability:failure.recoverability,backendRisk:failure.backendRisk,businessImpact:failure.businessImpact,estimatedCostMicros:failure.estimatedCostMicros,requiredPermissions:[...new Set(failure.requiredPermissions)].sort(),ownerRequired};
}
function audit(s,type,at,details={}){
 const entry={sequence:s.audit.length+1,type,at,originalTaskId:s.original.taskId,failureId:s.classification.failureId,attempt:s.attempts,...details,previousHash:s.audit.at(-1)?.hash||null};entry.hash=hash(entry);s.audit.push(entry);
}
function create({task,failure,limits,now}={}){
 check(task&&token(task.id)&&integer(task.revision)&&digest(task.evidenceHash)&&digest(task.findingsHash)&&digest(task.qaHash)&&integer(task.pendingMicros)&&integer(now,0,Number.MAX_SAFE_INTEGER-600000),'Invalid original task binding');
 check(limits&&integer(limits.maxAttempts,1,3)&&integer(limits.maxDurationMs,1,600000)&&integer(limits.maxRepeatedFailures,1,3)&&integer(limits.maxConcurrent,1,2)&&integer(limits.budgetMicros)&&integer(limits.cumulativeLimitMicros,1)&&integer(limits.retainedMicros),'Invalid recovery bounds');
 const classification=classify(failure);
 check(classification.evidenceHash===task.evidenceHash,'Failure evidence binding mismatch');
 const s={version:VERSION,revision:0,enabled:false,paidEnabled:false,writesEnabled:false,original:{taskId:task.id,revision:task.revision,evidenceHash:task.evidenceHash,findingsHash:task.findingsHash,qaHash:task.qaHash,pendingMicros:task.pendingMicros},classification,limits:copy(limits),createdAt:now,deadline:now+limits.maxDurationMs,state:classification.ownerRequired?'Blocked — Owner Approval Required':'Investigating',attempts:0,repeatedFailures:0,estimatedMicros:0,acceptedWork:false,checkpoint:null,qa:null,events:[],audit:[]};
 audit(s,'recovery_plan_created',now);return s;
}
function transition(current,event,{now,task,activeAttempts=0,approvedPermissions=[]}={}){
 check(current?.version===VERSION&&current.enabled===false&&current.paidEnabled===false&&current.writesEnabled===false,'Recovery foundation disabled');
 check(event&&token(event.id)&&token(event.type)&&integer(event.expectedRevision)&&integer(now)&&integer(activeAttempts)&&Array.isArray(approvedPermissions)&&approvedPermissions.every(token),'Invalid recovery event');
 const eventHash=hash(event),old=current.events.find(e=>e.id===event.id);
 if(old){check(old.hash===eventHash,'Recovery replay payload mismatch');return copy(current);}
 check(event.expectedRevision===current.revision,'Recovery revision stale');
 check(task&&task.id===current.original.taskId&&task.revision===current.original.revision&&task.evidenceHash===current.original.evidenceHash&&task.findingsHash===current.original.findingsHash&&task.qaHash===current.original.qaHash&&task.pendingMicros===current.original.pendingMicros,'Original task changed');
 check(!['Resolved','Escalated','Cancelled'].includes(current.state),'Recovery terminal');
 check(now>=current.createdAt&&now>=current.audit.at(-1).at,'Recovery clock moved backwards');
 const s=copy(current);
 if(event.type==='cancel'||task.cancelled){s.state='Cancelled';s.acceptedWork=false;s.checkpoint=null;s.qa=null;}
 else if(event.type==='escalate'){s.state='Escalated';s.acceptedWork=false;s.checkpoint=null;}
 else{
  check(now<s.deadline,'Recovery deadline exceeded');
  check(!s.classification.ownerRequired&&s.state!=='Blocked — Owner Approval Required','Owner approval required');
  if(event.type==='begin_attempt'){
   check(s.state==='Investigating'&&s.attempts<s.limits.maxAttempts&&s.repeatedFailures<s.limits.maxRepeatedFailures&&activeAttempts<s.limits.maxConcurrent,'Recovery attempt bound');
   check(s.classification.requiredPermissions.every(p=>approvedPermissions.includes(p))&&s.classification.requiredPermissions.every(p=>['mock_investigation','mock_correction'].includes(p)),'Recovery permission unavailable');
   check(event.mode==='offline'&&event.reserveMicros===0&&event.modelCalls===0&&event.externalActions===0,'Only non-billable offline simulation supported');
   const cost=s.classification.estimatedCostMicros;check(require('./agent-operations-budget').withinEstimate(s.estimatedMicros+cost,s.limits.budgetMicros)&&require('./agent-operations-budget').withinEstimate(s.limits.retainedMicros+s.estimatedMicros+cost,s.limits.cumulativeLimitMicros),'Recovery estimated budget exhausted');
   check(token(event.specialistId),'Specialist binding missing');
   s.attempts++;s.estimatedMicros+=cost;s.state='Remediation in Progress';s.specialistId=event.specialistId;s.qa=null;s.checkpoint=null;s.candidate=null;
  }else if(event.type==='submit_for_qa'){
   check(s.state==='Remediation in Progress'&&digest(event.artifactHash)&&token(event.implementationExecutionId),'Remediation artifact required');
   s.candidate={artifactHash:event.artifactHash,implementationExecutionId:event.implementationExecutionId};s.state='Awaiting Independent QA';
  }else if(event.type==='qa_result'){
   check(s.state==='Awaiting Independent QA'&&event.qa&&token(event.qa.id)&&token(event.qa.executionId)&&token(event.qa.reviewerId)&&event.qa.executionId!==s.candidate.implementationExecutionId&&event.qa.reviewerId!==s.specialistId&&event.qa.artifactHash===s.candidate.artifactHash&&event.qa.taskId===s.original.taskId&&event.qa.taskRevision===s.original.revision&&['passed','failed','uncertain'].includes(event.qa.outcome),'Independent QA binding denied');
   // This is an offline fixture receipt, not a trusted signature or a change to original QA.
   check(event.qa.fixtureOnly===true&&Object.keys(event.qa).sort().join(',')==='artifactHash,executionId,finalAcceptance,fixtureOnly,id,integrity,outcome,reviewerId,structural,substantive,taskId,taskRevision','Trusted durable QA attestation not implemented');s.qa=copy(event.qa);
   if(event.qa.outcome==='passed'){
    check(event.qa.structural==='passed'&&event.qa.integrity==='passed'&&event.qa.substantive==='passed'&&event.qa.finalAcceptance==='passed','QA acceptance incomplete');
    s.state='Resolved';s.checkpoint={taskId:s.original.taskId,originalRevision:s.original.revision,artifactHash:s.candidate.artifactHash,qaId:s.qa.id,requiresFreshBinding:true,executable:false};
   }else{s.repeatedFailures++;s.state=s.repeatedFailures>=s.limits.maxRepeatedFailures||s.attempts>=s.limits.maxAttempts?'Escalated':'Investigating';s.checkpoint=null;}
  }else if(event.type==='attempt_failed'){
   check(s.state==='Remediation in Progress'&&token(event.failureId)&&digest(event.evidenceHash),'Attempt failure evidence required');
   s.repeatedFailures++;s.state=s.repeatedFailures>=s.limits.maxRepeatedFailures||s.attempts>=s.limits.maxAttempts?'Escalated':'Investigating';s.checkpoint=null;
  }else throw Error('Unsupported recovery transition');
 }
 // Resolution is an offline plan state. Original acceptedWork remains untouched and false here.
 s.acceptedWork=false;s.events.push({id:event.id,hash:eventHash});s.revision++;audit(s,event.type,now,{state:s.state,qaId:s.qa?.id||null,candidateHash:s.candidate?.artifactHash||null,...(event.failureId?{attemptFailureId:event.failureId,evidenceHash:event.evidenceHash}:{})});return s;
}
module.exports={VERSION,STATES,classify,create,transition};
