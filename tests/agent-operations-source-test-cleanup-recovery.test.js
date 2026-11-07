'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('../lib/agent-operations-engineering-cleanup'),p=require('../lib/agent-operations-engineering-provider-v2'),d=require('../lib/agent-operations-source-test-dispatch');
const identity=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(){
 const actor={kind:'owner',verifiedOwner:true,id:'owner@example.test',workspaceId:'workspace'},runtime={environment:'preview',branch:'feature/callercore-dashboards',commit:'a'.repeat(40),origin:'https://my-ai-website-test-mohamtaj004bas-projects.vercel.app',deploymentId:'dpl_test',release:{version:'organization-contracts-v4',digest:'b'.repeat(64)}};
 const binding={planId:'plan_test',ownerHash:identity(actor.id),workspaceHash:identity(actor.workspaceId),runtime:{sourceCommit:runtime.commit,branch:runtime.branch,origin:runtime.origin,deploymentId:runtime.deploymentId,release:runtime.release}};
 const manifest={version:d.PROFILE,binding:{ownerHash:binding.ownerHash,workspaceHash:binding.workspaceHash,planId:binding.planId,taskId:'plan_test_task2_source_test',executionId:'exec_specialist_source_test',sourceCommit:runtime.commit,releaseHash:runtime.release.digest,deploymentId:runtime.deploymentId},proposalHash:'c'.repeat(64)};manifest.hash=p.hash(manifest);
 const run={version:d.PROFILE,status:'cleanup-unconfirmed',permit:{id:'1'.repeat(32),manifestHash:manifest.hash,expiresAt:200},manifest,sessionId:'sbx_Test',receipt:{failure:'ENG_TEST_SHUTDOWN',stopConfirmed:false,result:null},completedAt:250};
 const attempt={stage:'specialist',executionId:'exec_specialist',closed:true,contextHash:'d'.repeat(64),diagnostic:{workspaceCleanupConfirmed:false},sourceTestRun:run,workspacePreparation:{status:'destroyed',contextHash:'d'.repeat(64),proposalHash:'c'.repeat(64),at:50,completedAt:100}};attempt.workspacePreparation.hash=p.hash(attempt.workspacePreparation);
 const w={id:'wf_test',profile:p.PROFILE,mode:'pilot',status:'failed',leaseUntil:0,binding,workspaceId:actor.workspaceId,approvalId:'approval_test',approvalHash:'e'.repeat(64),grantId:'grant_test',attempts:[attempt]};
 const approval={id:w.approvalId,workflowId:w.id,status:'revoked',leaseUntil:0,approvalHash:w.approvalHash,ownerHash:binding.ownerHash,ownerWorkspaceId:actor.workspaceId,engineeringScope:{binding:structuredClone(binding)}};
 const grant={id:w.grantId,mode:'pilot',revoked:true,approvalId:approval.id,workspaceId:actor.workspaceId,scope:structuredClone(binding)};
 let state={operations:{workflows:[w],approvals:[approval],grants:[grant],audit:[],reservations:[{status:'pending',countCostStatus:'unknown'}]}},tail=Promise.resolve(),status='running',paid=false,now=300;
 const calls=[],session=()=>({id:'sbx_Test',name:'callercore-test-'+run.permit.id,projectId:d.PROJECT,status});
 const provider={find:async()=>{calls.push('find');return session();},read:async()=>{calls.push('read');return session();},stop:()=>assert.fail('Recovery must never mutate provider'),create:()=>assert.fail('No new VM'),run:()=>assert.fail('No generated code')};
 const input={kind:'source-test',step:'inspect',workflowId:w.id,executionId:attempt.executionId,bindingHash:c.testBinding(w,attempt),review:{workQaHash:'2'.repeat(64),workAuditorHash:'3'.repeat(64),sourceCommit:runtime.commit,releaseHash:runtime.release.digest}};
 const args={actor,input,runtime,read:async()=>structuredClone(state),owner:a=>assert.equal(a.kind,'owner'),paidEnabled:()=>paid,provider,audit:(o,a,type,data,at)=>o.audit.push({type,data,at}),tx:fn=>{const next=tail.then(()=>{const copy=structuredClone(state),result=fn(copy,copy.operations,now++);state=copy;return result;});tail=next.catch(()=>{});return next;}};
 return{actor,runtime,input,args,calls,provider,state:()=>state,run:()=>state.operations.workflows[0].attempts[0].sourceTestRun,workflow:()=>state.operations.workflows[0],status:v=>status=v,paid:v=>paid=v,recover:(step='inspect')=>c.recoverSourceTest({...args,input:{...input,step}})};
}
test('interrupted shutdown recovers through two bounded reads without changing original receipt or finance',async()=>{
 const f=fixture(),before=structuredClone(f.state()),config=require('../lib/agent-operations-engineering-configuration');assert.equal(config.physicalWorkflowClean(f.workflow()),false);
 await f.recover();assert.equal(c.sourceTestReconciled(f.workflow(),f.workflow().attempts[0]),false);
 await assert.rejects(f.recover('confirm'),/ENG_TEST_SHUTDOWN/);f.status('stopped');await f.recover('confirm');
 const {cleanupRecovery,...original}=f.run();assert.deepEqual(original,before.operations.workflows[0].attempts[0].sourceTestRun);assert.deepEqual(f.state().operations.reservations,before.operations.reservations);
 assert.equal(config.physicalWorkflowClean(f.workflow()),true);assert.equal(f.run().status,'cleanup-unconfirmed');assert.equal(f.run().receipt.stopConfirmed,false);
 assert.deepEqual(cleanupRecovery.events.map(e=>e.type),['located','confirmed']);assert(cleanupRecovery.events.every(e=>e.executionAuthorized===false&&e.publicationAuthorized===false));
 const saved=structuredClone(f.state());await f.recover('confirm');assert.deepEqual(f.state(),saved);assert.deepEqual(f.calls,['find','read','read']);
});
test('concurrent inspections append once; terminal provider observation is independently sufficient',async()=>{
 const f=fixture();f.status('stopped');const results=await Promise.all([f.recover(),f.recover()]);assert.equal(results.filter(r=>r.created).length,1);assert.equal(f.run().cleanupRecovery.events.length,1);assert.equal(f.state().operations.audit.length,1);assert(c.sourceTestReconciled(f.workflow(),f.workflow().attempts[0]));
});
test('host death before original close leaves original running record intact after terminal confirmation',async()=>{
 const f=fixture();delete f.run().receipt;delete f.run().completedAt;f.run().status='running';f.status('stopped');const original=structuredClone(f.run());await f.recover();const{cleanupRecovery,...after}=f.run();assert.deepEqual(after,original);assert(c.sourceTestReconciled(f.workflow(),f.workflow().attempts[0]));
});
for(const [name,change]of Object.entries({foreignOwner:f=>f.actor.id='other',foreignWorkspace:f=>f.actor.workspaceId='other',service:f=>f.actor.kind='service',unverified:f=>f.actor.verifiedOwner=false,paid:f=>f.paid(true),activeGrant:f=>f.state().operations.grants[0].revoked=false,activeApproval:f=>f.state().operations.approvals[0].status='active',lease:f=>f.workflow().leaseUntil=5,openAttempt:f=>f.workflow().attempts[0].closed=false,wrongBinding:f=>f.input.bindingHash='0'.repeat(64),forgedManifest:f=>f.run().manifest.binding.sourceCommit='0'.repeat(40),wrongReview:f=>f.input.review.sourceCommit='0'.repeat(40)}))test('source-test recovery rejects '+name+' before provider access',async()=>{const f=fixture();change(f);const before=structuredClone(f.state());await assert.rejects(f.recover());assert.deepEqual(f.state(),before);assert.deepEqual(f.calls,[]);});
for(const [name,observation]of Object.entries({missing:null,foreignProject:{projectId:'prj_other'},foreignName:{name:'callercore-test-'+'9'.repeat(32)},wrongSession:{id:'sbx_Other'}}))test('provider '+name+' cannot confirm shutdown',async()=>{const f=fixture(),original=f.provider.find;f.provider.find=async()=>observation===null?null:{...await original(),...observation};const before=structuredClone(f.state());await assert.rejects(f.recover());assert.deepEqual(f.state(),before);});
test('failed or interrupted provider read persists no false proof and may be read again',async()=>{const f=fixture(),original=f.provider.find;f.provider.find=async()=>{throw Error('simulated timeout');};await assert.rejects(f.recover());assert.equal(f.run().cleanupRecovery,undefined);f.provider.find=original;f.status('stopped');await f.recover();assert(c.sourceTestReconciled(f.workflow(),f.workflow().attempts[0]));});
test('late original closure is retained separately and cannot forge recovered session',async()=>{const f=fixture();await f.recover();f.run().receipt={failure:'ENG_TEST_SHUTDOWN',stopConfirmed:false,result:null,late:true};f.status('stopped');await f.recover('confirm');assert.equal(f.run().receipt.late,true);f.run().sessionId='sbx_Foreign';assert.equal(c.sourceTestReconciled(f.workflow(),f.workflow().attempts[0]),false);});
test('reconciliation never conceals failed local workspace destruction',async()=>{const f=fixture();f.status('stopped');await f.recover();const prep=f.workflow().attempts[0].workspacePreparation;prep.status='started';prep.hash=p.hash({...prep,hash:undefined});assert.equal(require('../lib/agent-operations-engineering-configuration').physicalWorkflowClean(f.workflow()),false);});
test('provider stop operation is not exposed by recovery',async()=>{const f=fixture();await assert.rejects(f.recover('stop'),/ENG_CLEANUP_INPUT/);assert.deepEqual(f.calls,[]);});
test('snapshot hashes record a legitimate late closure without attesting its test result',async()=>{const f=fixture(),before=structuredClone(f.run());await f.recover();f.run().receipt={failure:'ENG_TEST_SHUTDOWN',stopConfirmed:false,result:null,late:true};const {cleanupRecovery,...late}=f.run();f.status('stopped');await f.recover('confirm');const r=f.run().cleanupRecovery;assert.equal(r.inspectedRecordHash,p.hash(before));assert.equal(r.events[0].observedRecordHash,p.hash(before));assert.equal(r.events[1].observedRecordHash,p.hash(late));assert.notEqual(r.events[0].observedRecordHash,r.events[1].observedRecordHash);assert.equal(f.run().receipt.result,null);assert.equal(f.run().receipt.stopConfirmed,false);});
for(const [name,change]of Object.entries({manifestTask:f=>f.run().manifest.binding.taskId='other',proposal:f=>f.run().manifest.proposalHash='0'.repeat(64),permit:f=>f.run().permit.id='0'.repeat(32),version:f=>f.run().version='foreign',inspectedHash:f=>f.run().cleanupRecovery.inspectedRecordHash='0'.repeat(64),eventSnapshot:f=>f.run().cleanupRecovery.events[0].observedRecordHash='0'.repeat(64)}))test('cleanup proof rejects tampered '+name,async()=>{const f=fixture();f.status('stopped');await f.recover();change(f);assert.equal(c.sourceTestReconciled(f.workflow(),f.workflow().attempts[0]),false);});

test('actual owner controller and organization CAS recover a failed isolated-test fixture with no extra inference or VM',async()=>{
 const helper=require('./helpers/engineering-provider-fixtures.cjs'),sandbox=helper.sandboxFixture({cleanupFailure:true}),f=await helper.setup(sandbox),input=await helper.authorize(f),model=helper.installProvider(f);
 try{
  await assert.rejects(f.control.run(helper.owner,input));
  const before=f.state(),w=before.operations.workflows[0],attempt=w.attempts.find(a=>a.sourceTestRun);assert(attempt,'fixture must reach isolated tests');
  const calls=model.calls.length,counts=sandbox.counts();
  for(const key of require('../lib/agent-operations-engineering-configuration').FLAGS)f.env[key]='false';
  const review={workQaHash:'1'.repeat(64),workAuditorHash:'2'.repeat(64),sourceCommit:f.runtime.commit,releaseHash:f.release.digest};
  // Revoked or absent task consent cannot authorize execution. Maintenance uses
  // owner authentication and exact current review references, not a new grant.
  delete f.env.CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_JSON;
  delete f.env.CALLERCORE_AGENTOPS_ENGINEERING_RELEASE_REVIEW_SHA256;
  const original=sandbox.find;sandbox.find=async name=>({...await original(name),status:'stopped'});
  const recoveryInput={kind:'source-test',step:'inspect',workflowId:w.id,executionId:attempt.executionId,bindingHash:c.testBinding(w,attempt),review};
  const recoveries=await Promise.all([f.baseControl.cleanupReconcile(helper.owner,recoveryInput),f.baseControl.cleanupReconcile(helper.owner,recoveryInput)]);
  assert.equal(recoveries.filter(r=>r.created).length,1);const after=f.state(),updated=after.operations.workflows[0];assert(c.sourceTestReconciled(updated,updated.attempts.find(a=>a.sourceTestRun)));
  assert.equal(require('../lib/agent-operations-engineering-configuration').physicalWorkflowClean(updated),true);
  assert.deepEqual(after.operations.reservations,before.operations.reservations);assert.deepEqual(after.operations.approvals,before.operations.approvals);assert.deepEqual(after.operations.grants,before.operations.grants);
  assert.deepEqual(updated.attempts.find(a=>a.sourceTestRun).sourceTestRun.receipt,attempt.sourceTestRun.receipt);
  assert.equal(model.calls.length,calls);assert.deepEqual(sandbox.counts(),counts);
 }finally{model.restore();}
});
