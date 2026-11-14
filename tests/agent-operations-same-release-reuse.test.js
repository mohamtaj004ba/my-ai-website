'use strict';
// Reuse the existing trusted offline controller harness; no network or model I/O.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const p=require('../lib/agent-operations-engineering-provider-v2'),cfg=require('../lib/agent-operations-engineering-configuration'),seq=require('../lib/agent-operations-engineering-sequence');
function harness(){const source=fs.readFileSync(path.join(__dirname,'agent-operations-implementation-live-qa.test.js'),'utf8');return new Function('require','__dirname',source.slice(0,source.indexOf("test('"))+'\nreturn {setup,owner};')(require,__dirname);}
test('two fresh native controller approvals reuse one exact verified configuration without a deployment, environment edit or provider request',async()=>{
 const {setup,owner}=harness(),f=await setup(),state=await f.organization.read(),o=state.operations??={version:1,policyVersion:require('../lib/agent-operations-organization').POLICY,grants:[],workflows:[],reservations:[],audit:[]};
 const now=Date.now(),sequenceId='sequence_'+'3'.repeat(32),intentId='refresh_'+'4'.repeat(32),review=JSON.parse(f.env.CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_JSON),before=structuredClone(f.context);
 before.binding.runtime={...before.binding.runtime,deploymentId:'dpl_beforeReuse',origin:'https://my-ai-website-beforereuse-mohamtaj004bas-projects.vercel.app'};
 const values=cfg.expected(before,review);cfg.claim(o,before,{id:intentId,sequenceIntentId:sequenceId,scope:{...cfg.SCOPE},review,values},now-200);
 for(const [i,step] of cfg.STEPS.entries()){cfg.step(o,before,{id:intentId,step,phase:'dispatch'},now-199+i*2);cfg.step(o,before,{id:intentId,step,phase:'acknowledged'},now-198+i*2);}
 cfg.complete(o,f.context,{id:intentId,providerMetadataHash:'5'.repeat(64)},now-100,values);
 seq.registerDevelopment(o,f.context,{id:sequenceId,configurationIntentId:intentId,review,expiresAt:now+3600000},now-50);f.set(state);Object.assign(f.env,values);
 const configuration=JSON.stringify(f.state().operations.engineeringConfigurationIntents),enrollment=JSON.stringify(f.state().operations.engineeringSequences[0].enrollments),oldFetch=global.fetch;let requests=0;
 global.fetch=async()=>{requests++;throw Error('No provider request permitted');};
 try{
  const approve=async()=>{const manifest=await f.control.trialManifest(owner,{planId:f.plan.id,expectedRevision:1,sequenceId});const input={planId:f.plan.id,expectedRevision:1,approval:manifest.approval};const prepared=await f.control.prepare(owner,input);return{input,prepared};};
  const first=await approve();await f.control.revoke(owner,{planId:f.plan.id,approvalId:first.input.approval.id,approvalHash:p.hash(first.input.approval)});
  const original=JSON.stringify(f.state().operations.approvals[0]);
  f.plan.id='op_same_release_second';f.plan.tasks.forEach((t,i)=>t.id=f.plan.id+'_task'+(i+1));
  const second=await approve();a.notEqual(first.input.approval.id,second.input.approval.id);a.notEqual(first.input.approval.workflowId,second.input.approval.workflowId);a.equal(second.input.approval.sequence.attempt,2);
  a.equal(JSON.stringify(f.state().operations.approvals[0]),original);a.equal(JSON.stringify(f.state().operations.engineeringConfigurationIntents),configuration);a.equal(JSON.stringify(f.state().operations.engineeringSequences[0].enrollments),enrollment);
  await a.rejects(f.control.activate(owner,{...first.input,expectedApprovalRevision:first.prepared.record.revision}));
  await f.control.revoke(owner,{planId:f.plan.id,approvalId:second.input.approval.id,approvalHash:p.hash(second.input.approval)});
  const saved=f.plan.runtime.sourceCommit;f.plan.runtime.sourceCommit='f'.repeat(40);await a.rejects(f.control.trialManifest(owner,{planId:f.plan.id,expectedRevision:1,sequenceId}));f.plan.runtime.sourceCommit=saved;
  await a.rejects(f.control.trialManifest({...owner,workspaceId:'foreign'},{planId:f.plan.id,expectedRevision:1,sequenceId}));
  a.equal(requests,0);a.equal(f.state().operations.workflows.length,0);a.equal(f.state().operations.grants.length,0);a.equal(f.state().operations.reservations.length,0);a(f.state().operations.approvals.every(x=>x.status==='revoked'&&x.leaseUntil===0));
 }finally{global.fetch=oldFetch;}
});
