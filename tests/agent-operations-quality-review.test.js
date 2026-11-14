'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const tasks=require('../lib/agent-operations-implementation-tasks'),impl=require('../lib/agent-operations-implementation'),inf=require('../lib/agent-operations-engineering-inference'),report=require('../lib/agent-operations-engineering-report'),p=require('../lib/agent-operations-engineering-provider-v2');
// Existing actual controller, CAS journal and data-only disposable worker. Every
// provider response/count is replaced locally; no generated source is executed.
const header=fs.readFileSync(require.resolve('./agent-operations-review-handoff.test'),'utf8').split('\ntest(')[0]
 .replaceAll('tasks.REVIEW_OBJECTIVE','tasks.QUALITY_OBJECTIVE')
 .replace("if(badQa&&stage==='qa')value.decisions[0].reason='The patch still needs verification with.';","if(modify)modify(stage,value,c,body);");
const createRun=modify=>new Function('require','__dirname','modify',header+'\nreturn run;')(require,__dirname,modify);
function closed(r){a.equal(r.result.shutdown.paidExecution,false);a.equal(r.result.result.artifact.workspace.cleanup.destroyed,true);a.equal(r.result.result.artifact.sourceExecuted,false);a(r.f.state().operations.grants.every(g=>g.revoked));a.equal(r.result.result.receipts.length,5);}
function completed(r){if(r.error)throw Error(JSON.stringify({error:r.error.message,stages:r.frames.map(x=>x.stage),failures:r.f.state().operations.workflows.at(-1)?.attempts.map(x=>x.failure?.diagnostic).filter(Boolean)}));closed(r);}

test('ordinary prose quality reaches all critics as immutable advisory evidence with independent review choice',async()=>{
 const r=await createRun((stage,value)=>{if(stage==='specialist')value.proposal.verification=['Identify the field this label applies to.','Check timestamp edge cases'];})();
 completed(r);a.equal(r.calls.length,10);
 const receipt=r.result.result.receipts[1];a.deepEqual(receipt.reportQuality.issues,[{location:'$.proposal.verification[0]',code:'terminal-word-heuristic'},{location:'$.proposal.verification[1]',code:'missing-terminal-punctuation'}]);
 for(const stage of ['qa','auditor','chief-final']){const f=r.frames.find(f=>f.stage===stage),q=f.frame.implementationScope.qualityReview;a.equal(q.unresolved,false);a.equal(q.advisoryIssuesPresent,true);a.equal(q.semanticQualityVerified,false);a.equal(q.assessments[0].receiptHash,receipt.hash);a.deepEqual(q.assessments[0].issues,receipt.reportQuality.issues);a.deepEqual(r.result.result.receipts[inf.STAGES.indexOf(stage)].response.qualityReviewRefs,q.requiredReviewRefs);a(Buffer.byteLength(JSON.stringify(f.body))<=32768);}
 const auditor=r.frames.find(f=>f.stage==='auditor');a(auditor.body.text.format.schema.properties.decision.enum.includes('pass'));a(auditor.body.text.format.schema.properties.decision.enum.includes('fail'));
 const final=r.result.result.receipts[4];a.equal(final.response.auditDecision,'fail');a.equal(final.response.acceptedWork,false);a.equal(final.reportQuality.priorReviewRefs.length,1);
 const auditValue=structuredClone(r.result.result.receipts[3].response);auditValue.decision='pass';a.doesNotThrow(()=>report.validate('auditor',auditValue,auditor.c));
 const qa=r.frames.find(f=>f.stage==='qa'),bad=structuredClone(r.result.result.receipts[2].response);bad.qualityReviewRefs=['f'.repeat(64)];a.throws(()=>report.validate('qa',bad,qa.c),e=>e.validationIssue?.mismatch==='quality-review-reference');
 for(const mutate of [c=>c.priorReceipts[1].reportQuality.issues.splice(0),c=>c.priorReceipts[1].binding.workspaceHash='f'.repeat(64),c=>c.binding.runtime.sourceCommit='f'.repeat(40)]){const c=structuredClone(qa.c);mutate(c);a.throws(()=>report.qualityReview(c),e=>e.validationIssue?.mismatch==='quality-review-provenance');}
 const specialist=r.frames.find(f=>f.stage==='specialist'),base=impl.fixture('specialist',specialist.c);
 for(const mutate of [v=>v.proposal.edits[0].afterText='process.exit()',v=>v.proposal.beforeSha256='f'.repeat(64),v=>v.findings[0].evidenceIds=['foreign-evidence'],v=>delete v.qualityReviewRefs,v=>v.rootCause.analysis='x'.repeat(501)]){const v=structuredClone(base);mutate(v);a.throws(()=>inf.parseResponse('specialist',v,specialist.c));}
});

test('all five stages preserve quality observations without hiding upstream issues',async()=>{
 const r=await createRun((stage,v)=>{if(stage==='chief-plan')v.reason='Determine which account the call is for.';if(stage==='specialist')v.proposal.verification=['Coverage remains incomplete...'];if(stage==='qa')v.decisions[0].reason='The patch needs verification with.';if(stage==='auditor')v.reason='Record the account the call came from.';if(stage==='chief-final')v.summary='Review still needs attention';})();
 completed(r);a.equal(r.calls.length,10);
 const receipts=r.result.result.receipts;for(const [i,r]of receipts.entries()){a.equal(r.reportQuality.issues.length,1);a.equal(r.reportQuality.priorReviewRefs.length,i);a.equal(r.response.qualityReviewRefs.length,i);a.equal(r.usage.inputTokens,12000);a.equal(r.usage.outputTokens,500);}
 a.equal(receipts[4].reportQuality.issues[0].location,'$.summary');a.equal(receipts[4].response.auditDecision,'fail');a.equal(receipts[4].response.acceptedWork,false);
 a.equal(r.result.result.reportQuality.unresolved,false);a.equal(r.result.result.reportQuality.advisoryIssuesPresent,true);a.equal(r.result.result.reportQuality.technicalReviewPassed,false);a.equal(r.result.result.reportQuality.assessmentHashes.length,5);a.deepEqual(r.f.state().operations.workflows.at(-1).outcomes.reportQuality,r.result.result.reportQuality);
 // Even dense prior review text remains within the existing wire bound. This
 // is a byte fixture, not a measurement of actual provider token counts.
 for(const {body}of r.frames){a(Buffer.byteLength(JSON.stringify(body))<=32768);const stress=structuredClone(body),frame=JSON.parse(stress.input[0].content[0].text);for(const row of frame.priorResults){if(row.stage==='qa'){row.response.uncertainty='Q'.repeat(399)+'.';row.response.decisions.forEach(d=>d.reason='Q'.repeat(599)+'.');}if(row.stage==='auditor'){row.response.reason='A'.repeat(599)+'.';row.response.risks=Array.from({length:4},()=> 'R'.repeat(399)+'.');}}stress.input[0].content[0].text=JSON.stringify(frame);a(Buffer.byteLength(JSON.stringify(stress))<=32768);}
});

test('a final-only style observation remains visible without overturning the actual technical review decision',async()=>{
 const r=await createRun((stage,v)=>{if(stage==='auditor')v.decision='pass';if(stage==='chief-final')v.summary='Final review still needs coverage';})();completed(r);
 a.equal(r.result.result.receipts[4].response.auditDecision,'pass');a.equal(r.result.result.receipts[4].response.acceptedWork,false);
 a.equal(r.result.result.reportQuality.unresolved,false);a.equal(r.result.result.reportQuality.advisoryIssuesPresent,true);a.equal(r.result.result.reportQuality.assessmentHashes.length,1);a.equal(r.result.result.reportQuality.technicalReviewPassed,true);a.equal(r.result.result.reportQuality.independentlyAccepted,false);
});

test('clean automated technical pass grants no independent acceptance and ordinary fixture consolidation stays non-billable',async()=>{
 const r=await createRun((stage,v)=>{if(stage==='auditor')v.decision='pass';})();completed(r);a.equal(r.result.result.reportQuality.unresolved,false);a.equal(r.result.result.reportQuality.technicalReviewPassed,true);a.equal(r.result.result.acceptedWork,false);a.equal(r.result.result.independentlyAuthenticatedAcceptance,false);a.equal(r.result.result.reportQuality.independentlyAccepted,false);
 const helper=require('./helpers/bounded-implementation-workflow.cjs'),f=helper.setup();f.input.objective=tasks.QUALITY_OBJECTIVE;f.input.idempotencyKey='quality_review_full_fixture';const before=fs.readFileSync('dashboard.js','utf8'),plan=await helper.run(f);a.equal(plan.status,'completed');a.equal(plan.modelCalls,0);a.equal(plan.report.engineering.mode,'fixture-not-model-judgment');a.equal(plan.report.engineering.acceptedWork,false);a.equal(plan.report.engineering.artifact.sourceExecuted,false);a.equal(fs.readFileSync('dashboard.js','utf8'),before);
});

test('new quality policy cannot revive old consent and exact counting still denies before Responses',async()=>{
 a.equal(p.developmentFor({assignment:tasks.QUALITY_OBJECTIVE}),p.QUALITY_REVIEW_TRIAL);a.notEqual(p.hash(p.QUALITY_REVIEW_TRIAL),p.hash(p.REVIEW_HANDOFF_TRIAL));
 const r=await createRun()({count:12001});a(r.error);a.equal(r.calls.filter(x=>!x.endsWith('/input_tokens')).length,0);a(r.f.state().operations.grants.every(g=>g.revoked));
});

test('legacy Chief criterion no/not observations remain immutable warning facts only in the new contract',()=>{
 const c={...structuredClone(require('./fixtures/engineering-call-row-v3-request-hashes.json').v1.baseContext),assignment:tasks.QUALITY_OBJECTIVE,priorReceipts:[]},v=impl.fixture('chief-plan',c);v.completionCriteria=['The label must not.','There are no.'];
 a.doesNotThrow(()=>inf.parseResponse('chief-plan',v,c));a.deepEqual(report.qualityIssues('chief-plan',v).filter(x=>x.location.startsWith('$.completionCriteria[')),[{location:'$.completionCriteria[0]',code:'terminal-word-heuristic'},{location:'$.completionCriteria[1]',code:'terminal-word-heuristic'}]);
 const old={...c,assignment:tasks.REVIEW_OBJECTIVE},legacy=impl.fixture('chief-plan',old);legacy.completionCriteria=v.completionCriteria;a.throws(()=>inf.parseResponse('chief-plan',legacy,old),e=>e.validationIssue?.mismatch==='incomplete-criterion');
});
