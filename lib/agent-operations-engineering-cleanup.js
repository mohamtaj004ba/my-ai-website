'use strict';
// Append-only reconciliation of an existing server-generated destruction proof.
// This is owner maintenance, never an agent tool or execution/acceptance grant.
const p=require('./agent-operations-engineering-provider-v2'),{isDeepStrictEqual:equal}=require('node:util');
const VERSION='engineering-workspace-cleanup-reconciliation-v1',sha=x=>/^[a-f0-9]{64}$/.test(x||''),check=(v,c='ENG_CLEANUP_PROOF')=>{if(!v)throw Error(c);},exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&equal(Object.keys(v).sort(),keys.slice().sort());
const projection=w=>{const {cleanupReconciliation,...original}=w;return original;};
function reviewed(runtime,review){check(exact(runtime,['environment','branch','commit','origin','deploymentId','release'])&&runtime.environment==='preview'&&runtime.branch==='feature/callercore-dashboards'&&/^[a-f0-9]{40}$/.test(runtime.commit||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(runtime.origin||'')&&/^dpl_[A-Za-z0-9]+$/.test(runtime.deploymentId||'')&&exact(runtime.release,['version','digest'])&&runtime.release.version==='organization-contracts-v4'&&sha(runtime.release.digest),'ENG_CLEANUP_RELEASE');check(exact(review,['workQaHash','workAuditorHash','sourceCommit','releaseHash'])&&sha(review.workQaHash)&&sha(review.workAuditorHash)&&review.workQaHash!==review.workAuditorHash&&review.sourceCommit===runtime.commit&&review.releaseHash===runtime.release.digest,'ENG_CLEANUP_REVIEW');}
function proof(w,executionId){
 check(w?.profile===p.PROFILE&&w.mode==='pilot'&&['blocked','failed','cancelled'].includes(w.status)&&w.leaseUntil===0&&Array.isArray(w.attempts)&&w.attempts.length>0&&w.attempts.length<=5&&w.attempts.every(a=>a.closed===true));
 check(w.binding?.runtime?.branch==='feature/callercore-dashboards'&&/^[a-f0-9]{40}$/.test(w.binding.runtime.sourceCommit||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(w.binding.runtime.origin||'')&&/^dpl_[A-Za-z0-9]+$/.test(w.binding.runtime.deploymentId||'')&&w.binding.runtime.release?.version==='organization-contracts-v4'&&sha(w.binding.runtime.release.digest)&&w.outcomes?.acceptedWork===false);
 const rows=w.attempts.filter(a=>a.executionId===executionId);check(rows.length===1);const a=rows[0],r=a.workspacePreparation,f=a.failure;
 check(a.stage==='specialist'&&a.diagnostic?.workspaceCleanupConfirmed===false&&sha(a.contextHash)&&sha(a.requestHash)&&f?.diagnostic?.phase==='workspace-prepare'&&['DRAFT_CANCELLED','DRAFT_TIMEOUT','DRAFT_AUTHORITY_TIMEOUT','ENG_IMPLEMENTATION_CLEANUP_RECORD'].includes(f.diagnostic.code)&&f.hash===p.hash(f.diagnostic)&&f.diagnostic.workflowId===w.id&&f.diagnostic.executionId===a.executionId&&f.diagnostic.requestHash===a.requestHash&&f.diagnostic.sourceCommit===w.binding?.runtime?.sourceCommit&&f.diagnostic.releaseHash===w.binding?.runtime?.release?.digest);
 check(exact(r,['status','at','contextHash','proposalHash','hash','completedAt'])&&r.status==='destroyed'&&r.contextHash===a.contextHash&&sha(r.proposalHash)&&Number.isSafeInteger(r.at)&&Number.isSafeInteger(r.completedAt)&&r.completedAt>=r.at&&r.completedAt<=f.at&&r.hash===p.hash({...r,hash:undefined}));
 // Every other native preparation must independently attest destruction too.
 for(const other of w.attempts)if(other!==a){check(other.diagnostic?.workspaceCleanupConfirmed!==false);if(other.failure?.diagnostic?.phase==='workspace-prepare')check(other.workspacePreparation?.status==='destroyed');if(other.workspacePreparation){const q=other.workspacePreparation;check(q.status==='destroyed'&&q.contextHash===other.contextHash&&q.hash===p.hash({...q,hash:undefined}));}}
 return a;
}
function reconciled(w){try{const r=w?.cleanupReconciliation;check(exact(r,['version','workflowId','executionId','originalRecordHash','failureHash','preparationHash','ownerHash','workspaceHash','runtime','review','at','executionAuthorized','fundingAuthority','acceptance','publication','hash'])&&r.version===VERSION&&r.workflowId===w.id&&r.originalRecordHash===p.hash(projection(w))&&r.ownerHash===w.binding?.ownerHash&&r.workspaceHash===w.binding?.workspaceHash&&r.executionAuthorized===false&&r.fundingAuthority===false&&r.acceptance===false&&r.publication===false&&r.hash===p.hash({...r,hash:undefined}));reviewed(r.runtime,r.review);const a=proof(w,r.executionId);check(r.failureHash===a.failure.hash&&r.preparationHash===a.workspacePreparation.hash&&Number.isSafeInteger(r.at)&&r.at>=a.failure.at);return true;}catch{return false;}}
function reconcile(o,actor,input,runtime,now){
 check(actor?.kind==='owner'&&actor.verifiedOwner===true,'ENG_CLEANUP_OWNER');
 check(exact(input,['workflowId','executionId','expectedRevision','originalRecordHash','failureHash','preparationHash','review'])&&[input.originalRecordHash,input.failureHash,input.preparationHash].every(sha),'ENG_CLEANUP_INPUT');
 const review=input.review;reviewed(runtime,review);
 const matches=o.workflows.filter(w=>w.id===input.workflowId);check(matches.length===1,'ENG_CLEANUP_SCOPE');const w=matches[0],a=proof(w,input.executionId),identity=x=>require('node:crypto').createHash('sha256').update(String(x)).digest('hex');
 check(w.binding.ownerHash===identity(actor.id)&&w.binding.workspaceHash===identity(actor.workspaceId)&&w.workspaceId===actor.workspaceId,'ENG_CLEANUP_SCOPE');
 check(w.revision===input.expectedRevision&&p.hash(projection(w))===input.originalRecordHash&&a.failure.hash===input.failureHash&&a.workspacePreparation.hash===input.preparationHash,'ENG_CLEANUP_STALE');
 const approvals=o.approvals.filter(x=>x.id===w.approvalId),grants=o.grants.filter(x=>x.id===w.grantId);check(approvals.length===1&&grants.length===1,'ENG_CLEANUP_AUTHORITY');const approval=approvals[0],grant=grants[0];
 check(approval.status==='revoked'&&approval.leaseUntil===0&&approval.workflowId===w.id&&approval.ownerHash===w.binding.ownerHash&&approval.ownerWorkspaceId===actor.workspaceId&&approval.approvalHash===w.approvalHash&&approval.engineeringScope?.version==='engineering-approval-scope-v1'&&approval.engineeringScope.profile===p.PROFILE&&approval.engineeringScope.approvalHash===w.approvalHash&&approval.engineeringScope.scopeHash===p.hash(w.binding)&&equal(approval.engineeringScope.binding,w.binding)&&grant.revoked===true&&grant.mode==='pilot'&&grant.level==='engineering-proposal-only'&&grant.writesEnabled===false&&grant.workspaceId===actor.workspaceId&&grant.approvalId===approval.id&&grant.issuerHash===w.binding.ownerHash&&equal(grant.scope,w.binding),'ENG_CLEANUP_AUTHORITY');
 check(!o.approvals.some(x=>x.status!=='revoked'||x.leaseUntil!==0)&&!o.grants.some(x=>x.mode==='pilot'&&x.revoked!==true)&&!o.workflows.some(x=>x.mode==='pilot'&&(x.leaseUntil!==0||x.attempts?.some(a=>a.closed!==true))),'ENG_CLEANUP_ACTIVE');
 if(w.cleanupReconciliation){check(reconciled(w)&&equal(w.cleanupReconciliation.review,review),'ENG_CLEANUP_DUPLICATE');return{receipt:structuredClone(w.cleanupReconciliation),created:false};}
 check(Number.isSafeInteger(now)&&now>=a.failure.at,'ENG_CLEANUP_TIME');
 const r={version:VERSION,workflowId:w.id,executionId:a.executionId,originalRecordHash:input.originalRecordHash,failureHash:a.failure.hash,preparationHash:a.workspacePreparation.hash,ownerHash:w.binding.ownerHash,workspaceHash:w.binding.workspaceHash,runtime:structuredClone(runtime),review:structuredClone(review),at:now,executionAuthorized:false,fundingAuthority:false,acceptance:false,publication:false};r.hash=p.hash(r);w.cleanupReconciliation=r;check(reconciled(w));return{receipt:structuredClone(r),created:true};
}
// Source-test recovery uses the existing attempt journal. Original failed test
// receipts remain untouched by recovery; the original worker may close late.
// Each event records a snapshot digest, not an invariant over later closure.
// Only immutable manifest/permit/session identity binds the stopped proof.
// Confirmed shutdown never validates the original result or makes tests pass.
const TEST_CLEANUP='engineering-source-test-cleanup-v1';
function testBinding(w,a){
 const r=a?.sourceTestRun,m=r?.manifest,b=m?.binding;
 check(r&&r.version===m?.version&&require('./agent-operations-implementation-tasks').testProfileByVersion(m?.version)&&/^[a-f0-9]{32}$/.test(r.permit?.id||'')&&sha(m?.hash)&&m.hash===p.hash({...m,hash:undefined})&&r.permit.manifestHash===m.hash,'ENG_CLEANUP_PROOF');
 check(b&&b.ownerHash===w.binding.ownerHash&&b.workspaceHash===w.binding.workspaceHash&&b.planId===w.binding.planId&&b.taskId===w.binding.planId+'_task2_source_test'&&b.executionId===a.executionId+'_source_test'&&b.sourceCommit===w.binding.runtime.sourceCommit&&b.releaseHash===w.binding.runtime.release.digest&&b.deploymentId===w.binding.runtime.deploymentId,'ENG_CLEANUP_SCOPE');
 return p.hash({workflowId:w.id,executionId:a.executionId,permit:r.permit,manifest:m});
}
function testRecovery(w,a){
 try{
  const r=a.sourceTestRun.cleanupRecovery;check(r?.version===TEST_CLEANUP&&r.bindingHash===testBinding(w,a)&&sha(r.inspectedRecordHash)&&Array.isArray(r.events)&&r.events.length>=1&&r.events.length<=2);
  let previous=null,sessionId=null;
  for(let i=0;i<r.events.length;i++){
   const e=r.events[i];check(exact(e,['type','at','sessionId','projectId','providerName','status','previousHash','observedRecordHash','runtime','review','executionAuthorized','publicationAuthorized','hash'])&&e.hash===p.hash({...e,hash:undefined})&&e.previousHash===previous&&sha(e.observedRecordHash)&&(i!==0||e.observedRecordHash===r.inspectedRecordHash)&&Number.isSafeInteger(e.at)&&e.executionAuthorized===false&&e.publicationAuthorized===false);
   reviewed(e.runtime,e.review);check(e.projectId===require('./agent-operations-source-test-dispatch').PROJECT&&e.providerName==='callercore-test-'+a.sourceTestRun.permit.id&&/^sbx_[A-Za-z0-9]+$/.test(e.sessionId||'')&&(!sessionId||sessionId===e.sessionId));
   check((i===0&&['located','confirmed'].includes(e.type))||(i>0&&r.events[i-1].type==='located'&&e.type==='confirmed'));
   check(e.type==='confirmed'?e.status==='stopped':['running','pending','starting','stopping'].includes(e.status));
   if(i)check(e.at>=r.events[i-1].at);previous=e.hash;sessionId=e.sessionId;
  }
  check(!a.sourceTestRun.sessionId||a.sourceTestRun.sessionId===sessionId);return r;
 }catch{return null;}
}
const sourceTestReconciled=(w,a)=>testRecovery(w,a)?.events.at(-1)?.type==='confirmed';
function testScope(o,actor,input){
 check(actor?.kind==='owner'&&actor.verifiedOwner===true,'ENG_CLEANUP_OWNER');
 check(exact(input,['kind','step','workflowId','executionId','bindingHash','review'])&&input.kind==='source-test'&&['inspect','confirm'].includes(input.step)&&sha(input.bindingHash),'ENG_CLEANUP_INPUT');
 const matches=o.workflows.filter(w=>w.id===input.workflowId);check(matches.length===1,'ENG_CLEANUP_SCOPE');const w=matches[0],rows=w.attempts?.filter(a=>a.executionId===input.executionId)||[];check(rows.length===1,'ENG_CLEANUP_SCOPE');const a=rows[0],identity=x=>require('node:crypto').createHash('sha256').update(String(x)).digest('hex');
 check(w.profile===p.PROFILE&&w.mode==='pilot'&&w.binding?.runtime?.branch==='feature/callercore-dashboards'&&w.workspaceId===actor.workspaceId&&w.binding.ownerHash===identity(actor.id)&&w.binding.workspaceHash===identity(actor.workspaceId)&&['blocked','failed','cancelled'].includes(w.status)&&w.leaseUntil===0&&w.attempts.every(a=>a.closed===true)&&a.stage==='specialist','ENG_CLEANUP_SCOPE');
 check(testBinding(w,a)===input.bindingHash,'ENG_CLEANUP_STALE');
 const approval=o.approvals.find(x=>x.id===w.approvalId),grant=o.grants.find(x=>x.id===w.grantId);
 check(approval?.status==='revoked'&&approval.leaseUntil===0&&approval.workflowId===w.id&&approval.approvalHash===w.approvalHash&&approval.ownerHash===w.binding.ownerHash&&approval.ownerWorkspaceId===actor.workspaceId&&equal(approval.engineeringScope?.binding,w.binding)&&grant?.revoked===true&&grant.approvalId===approval.id&&grant.workspaceId===actor.workspaceId&&equal(grant.scope,w.binding),'ENG_CLEANUP_AUTHORITY');
 check(!o.approvals.some(x=>x.status!=='revoked'||x.leaseUntil!==0)&&!o.grants.some(x=>x.mode==='pilot'&&x.revoked!==true)&&!o.workflows.some(x=>x.mode==='pilot'&&(x.leaseUntil!==0||x.attempts?.some(a=>a.closed!==true))),'ENG_CLEANUP_ACTIVE');
 if(a.sourceTestRun.cleanupRecovery)check(testRecovery(w,a),'ENG_CLEANUP_PROOF');return{w,a};
}
async function recoverSourceTest({actor,input,runtime,read,tx,owner,audit,provider,paidEnabled}){
 check(provider,'ENG_TEST_UNAVAILABLE');reviewed(runtime,input?.review);
 const guard=()=>{owner(actor);check(!paidEnabled(),'ENG_CLEANUP_SHUTDOWN');};guard();
 const get=async()=>{guard();const state=await read();return testScope(state.operations,actor,input);};
 const current=await get(),run=current.a.sourceTestRun,old=testRecovery(current.w,current.a),last=old?.events.at(-1);
 if(last?.type==='confirmed'||input.step==='inspect'&&last)return{recovery:structuredClone(old),created:false,executionAuthorized:false,qualification:'Provider shutdown observation only; review hashes are references, not authenticated independent acceptance or test acceptance.'};
 const observe=v=>{check(v&&v.projectId===require('./agent-operations-source-test-dispatch').PROJECT&&v.name==='callercore-test-'+run.permit.id&&/^sbx_[A-Za-z0-9]+$/.test(v.id||'')&&(!run.sessionId||run.sessionId===v.id)&&(!last||last.sessionId===v.id),'ENG_CLEANUP_PROOF');return v;};
 async function append(type,v){return tx((s,o,now)=>{guard();const {w,a}=testScope(o,actor,input),r=a.sourceTestRun,prior=testRecovery(w,a),tail=prior?.events.at(-1);
   if(tail?.type===type&&tail.sessionId===v.id)return{recovery:structuredClone(prior),created:false,executionAuthorized:false,qualification:'Provider shutdown observation only; review hashes are references, not authenticated independent acceptance or test acceptance.'};
   check((tail?.hash||null)===(last?.hash||null),'ENG_CLEANUP_STALE');
   if(!prior){const {cleanupRecovery,...original}=r;r.cleanupRecovery={version:TEST_CLEANUP,bindingHash:input.bindingHash,inspectedRecordHash:p.hash(original),events:[]};}
   const {cleanupRecovery,...observedRecord}=r;
   const event={type,at:now,sessionId:v.id,projectId:v.projectId,providerName:v.name,status:v.status,previousHash:tail?.hash||null,observedRecordHash:p.hash(observedRecord),runtime:structuredClone(runtime),review:structuredClone(input.review),executionAuthorized:false,publicationAuthorized:false};event.hash=p.hash(event);r.cleanupRecovery.events.push(event);check(testRecovery(w,a),'ENG_CLEANUP_PROOF');audit(o,actor,'engineering_source_test_cleanup_'+type,{workflowId:w.id,executionId:a.executionId,receiptHash:event.hash,executionAuthorized:false},now);return{recovery:structuredClone(r.cleanupRecovery),created:true,executionAuthorized:false,qualification:'Provider shutdown observation only; review hashes are references, not authenticated independent acceptance or test acceptance.'};},{revoking:true,maintenance:true});}
 if(input.step==='inspect'){const found=observe(await provider.find('callercore-test-'+run.permit.id));return append(found.status==='stopped'?'confirmed':'located',found);}
 check(last,'ENG_CLEANUP_PROOF');
 if(input.step==='confirm'){const terminal=observe(await provider.read(last.sessionId));check(terminal.status==='stopped','ENG_TEST_SHUTDOWN');return append('confirmed',terminal);}
 throw Error('ENG_CLEANUP_INPUT');
}
module.exports={VERSION,projection,proof,reconciled,reconcile,reviewed,testBinding,testRecovery,sourceTestReconciled,recoverSourceTest};
