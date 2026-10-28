'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const tasks=require('../lib/agent-operations-implementation-tasks'),impl=require('../lib/agent-operations-implementation'),inf=require('../lib/agent-operations-engineering-inference'),p=require('../lib/agent-operations-engineering-provider-v2');
const header=fs.readFileSync(require.resolve('./agent-operations-review-handoff.test'),'utf8').split('\ntest(')[0].replaceAll('tasks.REVIEW_OBJECTIVE','tasks.CONCISE_OBJECTIVE').replace("if(badQa&&stage==='qa')value.decisions[0].reason='The patch still needs verification with.';","if(modify)modify(stage,value,c,body);");
const run=modify=>new Function('require','__dirname','modify',header+'\nreturn run;')(require,__dirname,modify);
test('concise final guidance is exact-task and final-stage only without changing limits',()=>{
 const c={assignment:tasks.CONCISE_OBJECTIVE},old={assignment:tasks.QUALITY_OBJECTIVE};
 a.equal(tasks.descriptor(c).id,'call-row-accessible-time-v5');a(tasks.reviewQuality(c));a(tasks.requiresProviderCount(c));
 a.equal(p.developmentFor(c),p.CONCISE_FINAL_TRIAL);a.equal(p.selectedTrial({CALLERCORE_AGENTOPS_ENGINEERING_TRIAL_AUTHORIZATION_ID:p.CONCISE_FINAL_TRIAL.authorizationId}),p.CONCISE_FINAL_TRIAL);a(p.activeDevelopment(p.CONCISE_FINAL_TRIAL));a(p.isDevelopmentPolicy(p.CONCISE_FINAL_TRIAL));
 a.equal(p.CONCISE_FINAL_TRIAL.maxOutput,p.QUALITY_REVIEW_TRIAL.maxOutput);a.equal(impl.stageOutputLimit('chief-final',c),4000);
 for(const stage of inf.STAGES){const v=impl.providerInstructions(stage,c,'BASE'),before=impl.providerInstructions(stage,old,'BASE');if(stage==='chief-final'){a.match(v,/emit one JSON object/);a.match(v,/Copy each required QA decision, reason and evidence once/);a.match(v,/Preserve every rejection/);a(!before.includes('Final report output discipline'));}else a.equal(v,before);}
 const forged={assignment:tasks.CONCISE_OBJECTIVE+' altered'};a.equal(tasks.conciseFinal(forged),false);a.equal(p.developmentFor(forged),null);
});
test('real five-stage controller fixture preserves warnings and rejection with concise final',async()=>{
 const r=await run((stage,value)=>{if(stage==='specialist')value.proposal.verification=['Check timestamp cases'];})();
 if(r.error)throw r.error;a.equal(r.calls.length,10);a.equal(r.result.result.receipts.length,5);a.equal(r.result.result.receipts[4].response.auditDecision,'fail');a.equal(r.result.result.receipts[4].response.acceptedWork,false);a.equal(r.result.result.artifact.sourceExecuted,false);a.equal(r.result.result.artifact.workspace.cleanup.destroyed,true);a.equal(r.result.shutdown.paidExecution,false);a(r.f.state().operations.grants.every(g=>g.revoked));
 const final=r.frames.at(-1);a.match(final.body.instructions,/Final report output discipline/);a.equal(final.body.max_output_tokens,4000);a.deepEqual(r.result.result.receipts[4].response.qualityReviewRefs,final.frame.implementationScope.qualityReview.requiredReviewRefs);a(Buffer.byteLength(JSON.stringify(r.result.result.receipts[4].response))<4000);
});
test('concise guidance cannot turn forged final acceptance into successful workflow',async()=>{
 const r=await run((stage,value)=>{if(stage==='chief-final')value.acceptedWork=true;})();a(r.error);const w=r.f.state().operations.workflows.at(-1);a.equal(w.results.length,4);a.equal(w.calls,5);a.equal(w.countCalls,5);a(w.attempts.at(-1).diagnostic.outputTokens>0);a(w.attempts.at(-1).failure);a(r.f.state().operations.grants.every(g=>g.revoked));
});

