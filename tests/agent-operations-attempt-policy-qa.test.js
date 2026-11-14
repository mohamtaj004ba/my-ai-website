'use strict';
// Independent native owner-controller admission only. No provider or model I/O.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const p=require('../lib/agent-operations-engineering-provider-v2'),cfg=require('../lib/agent-operations-engineering-configuration'),seq=require('../lib/agent-operations-engineering-sequence');
function harness(){const source=fs.readFileSync(path.join(__dirname,'agent-operations-implementation-live-qa.test.js'),'utf8');return new Function('require','__dirname',source.slice(0,source.indexOf("test('"))+'\nreturn {setup,owner};')(require,__dirname);}
test('native owner manifest admits twelfth fresh development attempt without reviving eleven revoked approvals',async()=>{
 const {setup,owner}=harness(),f=await setup(),state=await f.organization.read(),o=state.operations??={version:1,policyVersion:require('../lib/agent-operations-organization').POLICY,grants:[],workflows:[],reservations:[],audit:[]};
 const now=Date.now(),sequenceId='sequence_'+'3'.repeat(32),intentId='refresh_'+'4'.repeat(32),review=JSON.parse(f.env.CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_JSON),before=structuredClone(f.context);
 before.binding.runtime={...before.binding.runtime,deploymentId:'dpl_beforeAttemptPolicy',origin:'https://my-ai-website-beforeattemptpolicy-mohamtaj004bas-projects.vercel.app'};
 const values=cfg.expected(before,review);cfg.claim(o,before,{id:intentId,sequenceIntentId:sequenceId,scope:{...cfg.SCOPE},review,values},now-200);
 for(const [i,step]of cfg.STEPS.entries()){cfg.step(o,before,{id:intentId,step,phase:'dispatch'},now-199+i*2);cfg.step(o,before,{id:intentId,step,phase:'acknowledged'},now-198+i*2);}
 cfg.complete(o,f.context,{id:intentId,providerMetadataHash:'5'.repeat(64)},now-100,values);seq.registerDevelopment(o,f.context,{id:sequenceId,configurationIntentId:intentId,review,expiresAt:now+3600000},now-50);f.set(state);Object.assign(f.env,values);
 const configuration=JSON.stringify(f.state().operations.engineeringConfigurationIntents),enrollment=JSON.stringify(f.state().operations.engineeringSequences[0].enrollments),oldFetch=global.fetch;let requests=0,first,firstRecord;
 global.fetch=async()=>{requests++;throw Error('No provider request allowed');};
 try{
  for(let i=1;i<=12;i++){
   f.plan.id='op_attempt_policy_'+i;f.plan.tasks.forEach((t,j)=>t.id=f.plan.id+'_task'+(j+1));
   const manifest=await f.control.trialManifest(owner,{planId:f.plan.id,expectedRevision:1,sequenceId});a.equal(manifest.approval.sequence.attempt,i);a.equal(manifest.approval.sourceCommit,f.runtime.commit);a.equal(manifest.approval.contractHash,f.release.digest);a.equal(manifest.executionAuthorized,false);
   const input={planId:f.plan.id,expectedRevision:1,approval:manifest.approval},prepared=await f.control.prepare(owner,input);
   await f.control.revoke(owner,{planId:f.plan.id,approvalId:input.approval.id,approvalHash:p.hash(input.approval)});
   if(i===1){first={input,prepared};firstRecord=JSON.stringify(f.state().operations.approvals[0]);}else a.equal(JSON.stringify(f.state().operations.approvals[0]),firstRecord);
  }
  const current=f.state(),record=current.operations.engineeringSequences[0];a.equal(record.attempts.length,12);a.equal(record.maxAttempts,10,'Original metadata remains unchanged');a.equal(new Set(record.attempts.map(x=>x.approvalId)).size,12);a.equal(new Set(record.attempts.map(x=>x.workflowId)).size,12);
  const status=await f.control.sequenceStatus(owner,{planId:f.plan.id,expectedRevision:1,sequenceId});a.deepEqual(status.attemptPolicy,seq.ATTEMPT_POLICY);a.equal(status.attemptPolicy.maxAttempts,null);a.equal(status.attemptPolicy.limitEnforced,false);
  const ready=await f.control.readiness(owner,{});a.deepEqual(ready.developmentPolicy.attemptPolicy,seq.ATTEMPT_POLICY);a.equal(ready.paidExecution,false);a.equal(ready.generatedCodeExecution,false);a.equal(ready.acceptance,false);a.equal(ready.publication,false);
  const originalPlan=f.plan.id;f.plan.id=first.input.planId;f.plan.tasks.forEach((t,j)=>t.id=f.plan.id+'_task'+(j+1));await a.rejects(f.control.activate(owner,{...first.input,expectedApprovalRevision:first.prepared.record.revision}));f.plan.id=originalPlan;f.plan.tasks.forEach((t,j)=>t.id=f.plan.id+'_task'+(j+1));
  const commit=f.plan.runtime.sourceCommit;f.plan.runtime.sourceCommit='f'.repeat(40);await a.rejects(f.control.trialManifest(owner,{planId:f.plan.id,expectedRevision:1,sequenceId}));f.plan.runtime.sourceCommit=commit;
  await a.rejects(f.control.trialManifest({...owner,workspaceId:'foreign'},{planId:f.plan.id,expectedRevision:1,sequenceId}));
  a.equal(JSON.stringify(f.state().operations.engineeringConfigurationIntents),configuration);a.equal(JSON.stringify(f.state().operations.engineeringSequences[0].enrollments),enrollment);a.equal(requests,0);a.equal(current.operations.grants.length,0);a.equal(current.operations.workflows.length,0);a.equal(current.operations.reservations.length,0);a(current.operations.approvals.every(x=>x.status==='revoked'&&x.leaseUntil===0));
 }finally{global.fetch=oldFetch;}
});
