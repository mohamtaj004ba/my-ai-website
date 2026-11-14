'use strict';
require('./helpers/historical-starter-fixture.cjs'); // Explicit pre-fix offline task replay.
// Independent adversarial journal tests; all configuration ACKs are fixtures.
const {test}=require('node:test'),a=require('node:assert/strict'),p=require('../lib/agent-operations-engineering-provider-v2'),config=require('../lib/agent-operations-engineering-configuration'),seq=require('../lib/agent-operations-engineering-sequence');
function fixture(){
 const now=1800000000000,c={binding:{planId:'audit_plan',taskId:'audit_task',ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),runtime:{sourceCommit:'c'.repeat(40),deploymentId:'dpl_before',origin:'https://my-ai-website-before-mohamtaj004bas-projects.vercel.app',branch:config.SCOPE.branch,release:{version:'organization-contracts-v4',digest:'d'.repeat(64)}}},assignment:p.DEVELOPMENT_TRIAL.objective,evidence:require('../lib/agent-operations-implementation').snapshot().evidence},review={workQaHash:'1'.repeat(64),workAuditorHash:'2'.repeat(64),sourceCommit:c.binding.runtime.sourceCommit,releaseHash:c.binding.runtime.release.digest},o={approvals:[],grants:[],workflows:[],reservations:[]},id='sequence_'+'3'.repeat(32),intent='refresh_'+'4'.repeat(32),values=config.expected(c,review);
 config.claim(o,c,{id:intent,sequenceIntentId:id,scope:{...config.SCOPE},values,review},now);
 for(const [i,step]of config.STEPS.entries()){config.step(o,c,{id:intent,step,phase:'dispatch'},now+i*2+1);config.step(o,c,{id:intent,step,phase:'acknowledged'},now+i*2+2);}
 c.binding.runtime={...c.binding.runtime,deploymentId:'dpl_after',origin:'https://my-ai-website-after-mohamtaj004bas-projects.vercel.app'};
 config.complete(o,c,{id:intent,providerMetadataHash:'5'.repeat(64)},now+100,values);
 seq.registerDevelopment(o,c,{id,configurationIntentId:intent,review,expiresAt:now+3600000},now+200);
 const approval={id:'pilot_'+'6'.repeat(32),workflowId:'wf_'+'7'.repeat(32),maxMicros:1000000,countPricing:{authorizationId:p.DEVELOPMENT_TRIAL.authorizationId,evidenceHash:p.hash(p.DEVELOPMENT_TRIAL)},sequence:{id,attempt:1}};
 return{o,c,id,now,approval};
}
function corrupt(f){const entry=f.o.engineeringSequences[0].enrollments[0];entry.configurationHash='f'.repeat(64);const {hash,...raw}=entry;entry.hash=p.hash(raw);return entry;}
test('rehashed enrollment cannot substitute configuration completion before approval claim',()=>{const f=fixture();corrupt(f);seq.valid(f.o.engineeringSequences[0]);a.throws(()=>seq.claim(f.o,f.c,f.approval,f.now+300),/ENG_CONFIG_|ENG_SEQUENCE_/);a.equal(f.o.engineeringSequences[0].attempts.length,0);a.equal(f.o.reservations.length,0);});
test('rehashed enrollment and matching attempt reference cannot authorize provider dispatch',()=>{const f=fixture();seq.claim(f.o,f.c,f.approval,f.now+300);const entry=corrupt(f);f.o.engineeringSequences[0].attempts[0].enrollmentHash=entry.hash;seq.valid(f.o.engineeringSequences[0]);a.throws(()=>seq.assert(f.o,f.c,f.approval,f.now+301),/ENG_CONFIG_|ENG_SEQUENCE_/);a.equal(f.o.reservations.length,0);});

function completeReview(f,decision){
 seq.claim(f.o,f.c,f.approval,f.now+300);
 const stages=['chief-plan','specialist','qa','auditor','chief-final'];
 const results=stages.map(stage=>{const body={stage,response:{stage,...(stage==='auditor'?{decision}:{}),...(stage==='chief-final'?{auditDecision:decision,acceptedWork:false}:{})},acceptedWork:false,publicationAuthorized:false};return{...body,hash:p.hash(body)};});
 const w={id:f.approval.workflowId,profile:p.PROFILE,mode:'pilot',status:'verified',leaseUntil:0,outcomes:{execution:'completed',acceptedWork:false},results,attempts:results.map(r=>({stage:r.stage,closed:true,resultHash:r.hash}))};
 f.o.workflows.push(w);f.o.approvals.push({id:f.approval.id,status:'revoked',leaseUntil:0});
 f.c.binding.planId='fresh_plan_after_review';
 return{w,next:{...f.approval,id:'pilot_'+'8'.repeat(32),workflowId:'wf_'+'9'.repeat(32),sequence:{id:f.id,attempt:2}}};
}
for(const decision of ['fail','unresolved'])test('completed '+decision+' technical review permits a fresh scoped v3 attempt without rewriting history',()=>{
 const f=fixture(),{w,next}=completeReview(f,decision),historical=JSON.stringify(w);
 a.equal(seq.configurationAdmission(f.o,f.c,f.id,f.now+400,{operations:f.o}),true);
 seq.claim(f.o,f.c,next,f.now+401);a.equal(f.o.engineeringSequences[0].attempts.length,2);a.equal(JSON.stringify(w),historical);a.equal(f.o.reservations.length,0);
 a.throws(()=>seq.claim(f.o,f.c,{...next,sequence:{id:f.id,attempt:3}},f.now+402),/CLEANUP|REPLAY/);
});
for(const change of [()=>{},w=>{w.results[3].response.decision='fail';},w=>{w.attempts[3].resultHash='0'.repeat(64);},w=>{w.results.pop();},w=>{w.results[4].response.auditDecision='fail';},w=>{w.outcomes.execution='pending';}])test('successful or inconsistent completion evidence cannot bypass the existing same-objective stop',()=>{
 const f=fixture(),{w,next}=completeReview(f,'pass');change(w);const before=JSON.stringify(f.o);
 a.throws(()=>seq.claim(f.o,f.c,next,f.now+401),/SUCCEEDED/);a.equal(JSON.stringify(f.o),before);
});
test('rejected completion never bypasses physical cleanup, active authority or stale release checks',()=>{
 for(const change of [f=>{f.o.workflows[0].attempts[1].closed=false;},f=>{f.o.approvals[0].status='active';},f=>{f.c.binding.runtime.sourceCommit='f'.repeat(40);}]){
  const f=fixture(),{next}=completeReview(f,'fail');change(f);const before=JSON.stringify(f.o);
  a.throws(()=>seq.claim(f.o,f.c,next,f.now+401),/CLEANUP|SCOPE/);a.equal(JSON.stringify(f.o),before);
 }
});

function rehashSpecialist(w){const {hash,...body}=w.results[1];w.results[1]={...body,hash:p.hash(body)};w.attempts[1].resultHash=w.results[1].hash;}
function sourceTestFailure(f,w){
 const impl=require('../lib/agent-operations-implementation'),d=require('../lib/agent-operations-source-test-dispatch'),binding={...structuredClone(f.c.binding),planId:'audit_plan',executionId:'audit_specialist'},context={...f.c,binding,priorReceipts:[{stage:'chief-plan',response:{completionCriteria:['Preserve source scope.']}}]},proposal=impl.fixture('specialist',context).proposal,baseline=impl.snapshot().text,edit=proposal.edits[0];
 const j=d.prepare({binding:{ownerHash:binding.ownerHash,workspaceHash:binding.workspaceHash,planId:binding.planId,taskId:binding.taskId+'_source_test',executionId:binding.executionId+'_source_test',sourceCommit:binding.runtime.sourceCommit,releaseHash:binding.runtime.release.digest,deploymentId:binding.runtime.deploymentId},baseline,patched:baseline.replace(edit.beforeText,edit.afterText),proposalHash:p.hash(proposal)});
 const body={version:j.manifest.version,manifestHash:j.manifest.hash,permitId:'e'.repeat(32),sessionId:'sbx_OfflineContinuation',status:'completed',failure:null,result:{sourceExecuted:true,checksPassed:d.CHECKS.length,cleanupConfirmed:true,publicationAuthorized:false,independentlyAccepted:false,reportHash:'f'.repeat(64),tests:d.TESTS.map((id,i)=>({id,passed:i!==0})),testsPassed:false,reviewDisposition:'behavioral-failure'},stopConfirmed:true,publicationAuthorized:false,independentlyAccepted:false},e={manifest:j.manifest,receipt:{...body,hash:p.hash(body)}};
 w.results[1].binding=binding;w.results[1].response.proposal=proposal;w.results[1].sourceTestEvidence=e;
 w.attempts[1].sourceTestRun={version:body.version,status:'completed',permit:{id:body.permitId,manifestHash:body.manifestHash,expiresAt:f.now+300000},manifest:structuredClone(e.manifest),sessionId:body.sessionId,receipt:structuredClone(e.receipt),completedAt:f.now+350};
 rehashSpecialist(w);a.equal(d.validateEvidence(e,binding,proposal),true);return e;
}
test('safe failed behavioral tests permit another scoped attempt even when the model Auditor says pass',()=>{
 const f=fixture(),{w,next}=completeReview(f,'pass');sourceTestFailure(f,w);const history=JSON.stringify(w);
 // Deliberately absent outcome summaries: the receipt and closed run are proof.
 a.equal(w.outcomes.knownTestFailure,undefined);a.equal(seq.configurationAdmission(f.o,f.c,f.id,f.now+400,{operations:f.o}),true);
 seq.claim(f.o,f.c,next,f.now+401);a.equal(f.o.engineeringSequences[0].attempts.length,2);a.equal(JSON.stringify(w),history);a.equal(f.o.reservations.length,0);
});
test('a failed-test summary alone cannot reopen a completed passing objective',()=>{
 const f=fixture(),{w,next}=completeReview(f,'pass');w.outcomes.reportQuality={knownTestFailure:true,technicalReviewPassed:false};const history=JSON.stringify(f.o);
 a.throws(()=>seq.claim(f.o,f.c,next,f.now+401),/SUCCEEDED/);a.equal(JSON.stringify(f.o),history);
});
for(const [name,change]of [
 ['missing evidence',w=>{delete w.results[1].sourceTestEvidence;}],
 ['missing stored run',w=>{delete w.attempts[1].sourceTestRun;}],
 ['missing stored manifest',w=>{delete w.attempts[1].sourceTestRun.manifest;}],
 ['mismatched stored receipt',w=>{w.attempts[1].sourceTestRun.receipt.hash='0'.repeat(64);} ],
 ['wrong permit',w=>{w.attempts[1].sourceTestRun.permit.id='0'.repeat(32);} ],
 ['wrong source identity',w=>{w.results[1].binding.runtime.sourceCommit='0'.repeat(40);} ],
 ['changed proposal',w=>{w.results[1].response.proposal.edits[0].afterText+=' ';} ],
 ['failed receipt hash',w=>{const e=w.results[1].sourceTestEvidence;e.receipt.hash='0'.repeat(64);w.attempts[1].sourceTestRun.receipt=structuredClone(e.receipt);} ],
 ['unconfirmed cleanup',w=>{const e=w.results[1].sourceTestEvidence;e.receipt.stopConfirmed=false;const {hash,...body}=e.receipt;e.receipt.hash=p.hash(body);w.attempts[1].sourceTestRun.receipt=structuredClone(e.receipt);} ],
 ['forged failure flag',w=>{const e=w.results[1].sourceTestEvidence;e.receipt.result.tests=e.receipt.result.tests.map(t=>({...t,passed:true}));const {hash,...body}=e.receipt;e.receipt.hash=p.hash(body);w.attempts[1].sourceTestRun.receipt=structuredClone(e.receipt);} ],
 ['true passing tests',w=>{const e=w.results[1].sourceTestEvidence;e.receipt.result.tests=e.receipt.result.tests.map(t=>({...t,passed:true}));delete e.receipt.result.testsPassed;delete e.receipt.result.reviewDisposition;const {hash,...body}=e.receipt;e.receipt.hash=p.hash(body);w.attempts[1].sourceTestRun.receipt=structuredClone(e.receipt);} ]
])test(name+' cannot bypass the same-objective completion stop',()=>{
 const f=fixture(),{w,next}=completeReview(f,'pass');sourceTestFailure(f,w);change(w);rehashSpecialist(w);const history=JSON.stringify(f.o);
 a.throws(()=>seq.claim(f.o,f.c,next,f.now+401),/SUCCEEDED/);a.equal(JSON.stringify(f.o),history);
});
