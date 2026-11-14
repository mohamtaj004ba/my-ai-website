'use strict';
// Policy kernel only. No current action handler executes these future capabilities.
const {createHash}=require('node:crypto');
const POLICY=Object.freeze({version:'preview-autonomy-v1',enabled:false,paidEnabled:false,levels:Object.freeze(['observe','coordinate','inspect-and-test','engineering-preview']),approvalRequired:Object.freeze(['production','customer-impact','legal-sensitive','financially-significant','destructive','irreversible']),futureCapabilities:Object.freeze({observe:['read_state'],coordinate:['plan','prioritize','delegate','monitor','report'], 'inspect-and-test':['inspect_preview','run_tests','commission_qa'], 'engineering-preview':['fix_minor_bug','commit_feature','coordinate_followup']})});
const DENIED=new Set(['change_policy','grant_permissions','increase_budget','accept_failed_qa','production_deploy','merge_main','customer_mutation']);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
function authorize({enabled=false,grant,action,scope,task,ledger,qa,now=Date.now()}={}){
 const deny=reason=>({allowed:false,escalate:true,reason});
 if(!enabled||!grant||grant.enabled!==true)return deny('Autonomy disabled');
 if(DENIED.has(action?.type))return deny('Action never delegated by this policy');
 if(!integer(grant.revision)||grant.revision!==action?.expectedGrantRevision||grant.cancelled||!integer(grant.expiresAt)||grant.expiresAt<=now||task?.cancelled||!['assigned','running'].includes(task?.status)||!integer(task?.revision)||!integer(task?.deadline)||task.deadline<=now||task.revision!==action?.expectedRevision)return deny('Grant or task stale/cancelled');
 if(!integer(grant.maxActions)||grant.maxActions<1||grant.maxActions>100||!integer(grant.actionsUsed)||grant.actionsUsed>=grant.maxActions)return deny('Grant action quota exhausted or unverified');
 if(scope?.environment!=='preview'||scope.projectId!==grant.projectId||scope.branch!=='feature/callercore-dashboards'||scope.branch!==grant.branch||scope.commit!==grant.commit)return deny('Outside pinned Preview scope');
 if(!Array.isArray(grant.actions)||!grant.actions.includes(action?.type)||!Array.isArray(grant.paths)||!grant.paths.includes(action?.path))return deny('Capability or path not granted');
 const rank=POLICY.levels.indexOf(grant.level),need=Object.entries(POLICY.futureCapabilities).find(([,a])=>a.includes(action.type));if(!need||rank<POLICY.levels.indexOf(need[0]))return deny('Authority level insufficient');
 // Risk comes from a trusted backend classifier/approved grant, never a model's self-description.
 if(task.risk!=='routine'||grant.routineRiskVerified!==true)return deny('Owner approval required for consequential or unclassified work');
 if(typeof action.path!=='string'||action.path.length>240||/[\x00-\x1f:%\\]|\.\.|\/\/|(^|\/)\.\//.test(action.path)||/(^|\/)[^/]*[. ](\/|$)|(^|\/)(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|\/|$)/i.test(action.path)||/(^|\/)(\.git|\.env[^/]*|\.github|\.vercel|\.codex|\.agents)(\/|$)/i.test(action.path)||/^(lib|api|scripts)\/agent-operations-|(^|\/)(AGENTS\.md|SKILL\.md|package[^/]*\.json|[^/]*lock[^/]*|vercel\.json|[^/]*config\.[^/]*)$/i.test(action.path))return deny('Protected policy, credential or control-plane path');
 if(['fix_minor_bug','commit_feature'].includes(action.type)&&!require('node:path').posix.isAbsolute(action.path)&&require('node:path').posix.normalize(action.path)!==action.path)return deny('Noncanonical engineering path');
 if(['fix_minor_bug','commit_feature'].includes(action.type)&&action.path.startsWith('/'))return deny('Absolute engineering path');
 if(!integer(action.reserveMicros)||!integer(ledger?.retainedMicros)||!integer(ledger?.limitMicros)||!integer(grant.budgetMicros)||!integer(grant.retainedMicros)||!require('./agent-operations-budget').withinEstimate(action.reserveMicros+ledger.retainedMicros,ledger.limitMicros)||!require('./agent-operations-budget').withinEstimate(action.reserveMicros+grant.retainedMicros,grant.budgetMicros))return deny('Reservation headroom insufficient or unverified');
 if(action.reserveMicros>0&&(grant.paidEnabled!==true||!grant.models?.includes(action.model)))return deny('Paid model not explicitly granted');
 if(action.type==='commit_feature'&&(!qa||qa.taskId!==task.id||!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(qa.executionId||'')||!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(qa.implementationExecutionId||'')||!(/^[a-f0-9]{64}$/.test(task.artifactHash||''))||qa.artifactHash!==task.artifactHash||qa.acceptedWork!==true||qa.structural!=='passed'||qa.integrity!=='passed'||qa.substantive!=='passed'||qa.finalAcceptance!=='passed'||qa.executionId===qa.implementationExecutionId||qa.taskRevision!==task.revision||qa.commit!==scope.commit))return deny('Independent verified QA required');
 const audit={policyVersion:POLICY.version,grantId:grant.id,grantRevision:grant.revision,taskId:task.id,taskRevision:task.revision,action:action.type,path:action.path,scope:{...scope},reserveMicros:action.reserveMicros,at:now};
 return{allowed:true,escalate:false,audit,decisionHash:createHash('sha256').update(JSON.stringify(audit)).digest('hex'),requiresAtomicReservationAndAudit:true,rollbackRequired:['fix_minor_bug','commit_feature'].includes(action.type)};
}
module.exports={POLICY,authorize};
