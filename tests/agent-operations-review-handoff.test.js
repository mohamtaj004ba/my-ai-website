'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const p=require('../lib/agent-operations-engineering-provider-v2'),inf=require('../lib/agent-operations-engineering-inference'),impl=require('../lib/agent-operations-implementation'),tasks=require('../lib/agent-operations-implementation-tasks'),report=require('../lib/agent-operations-engineering-report');
const owner={kind:'owner',verifiedOwner:true,id:'current-task-fixture@example.test',workspaceId:'current-task-fixture'};
// Reuse the existing actual controller/CAS/configuration fixture with the new
// exact task objective. All provider traffic below is replaced locally.
const setupSource=fs.readFileSync(require.resolve('./agent-operations-call-row-syntax-controller.test'),'utf8').split('\ntest(')[0].replaceAll('tasks.CURRENT_OBJECTIVE','tasks.REVIEW_OBJECTIVE');
const setup=new Function('require','__dirname',setupSource+'\nreturn fixture;')(require,__dirname);
async function run({badQa=false,count=12000}={}){
 const f=await setup(),before=global.fetch,calls=[],frames=[];
 global.fetch=async(url,options)=>{
  a.match(url,/^https:\/\/api\.openai\.com\/v1\/responses(?:\/input_tokens)?$/);calls.push(url);
  if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:count});
  const w=f.state().operations.workflows.at(-1),i=w.results.length,stage=inf.STAGES[i],c={...f.context,binding:{...f.context.binding,taskId:f.plan.tasks[i].id,executionId:w.approval.id+'_'+stage},priorReceipts:w.results},body=JSON.parse(options.body),frame=JSON.parse(body.input[0].content[0].text),value=impl.fixture(stage,c);frames.push({stage,body,frame,c});
  if(badQa&&stage==='qa')value.decisions[0].reason='The patch still needs verification with.';
  return Response.json({id:'resp_review_fixture_'+i,status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:12000,output_tokens:500,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 };
 try{const m=await f.control.trialManifest(owner,{planId:f.plan.id,expectedRevision:1,sequenceId:f.sequenceId}),input={planId:f.plan.id,expectedRevision:1,approval:m.approval},prepared=await f.control.prepare(owner,input),active=await f.control.activate(owner,{...input,expectedApprovalRevision:prepared.record.revision});let result,error;try{result=await f.control.run(owner,{...input,expectedApprovalRevision:active.revision});}catch(e){error=e;}return{f,result,error,calls,frames};}finally{global.fetch=before;}
}
test('v3 actual five-stage controller supplies trusted review contract and complete final attribution',async()=>{
 const r=await run();if(r.error)throw r.error;a.equal(r.result.result.receipts.length,5);a.equal(r.calls.length,10);
 for(const {stage,body,frame}of r.frames){const d=tasks.descriptor({assignment:tasks.REVIEW_OBJECTIVE});a.deepEqual(frame.implementationScope.replacementSyntax,{version:'closed-replacement-syntax-v1',pattern:d.afterPattern,maxBytes:512});a.equal(frame.implementationScope.path,d.path);a.equal(frame.implementationScope.beforeSha256,d.sourceSha256);a.equal(Object.hasOwn(frame.implementationScope,'expectedBinding'),false);a.deepEqual(body.tools,[]);a(Buffer.byteLength(JSON.stringify(body))<=32768);if(['qa','auditor','chief-final'].includes(stage)){a.equal(frame.implementationScope.specialistAttribution.binding.taskId,r.f.plan.tasks[1].id);a.equal(frame.implementationScope.specialistAttribution.receiptHash,r.result.result.receipts[1].hash);}}
 for(const {frame}of r.frames){const support=frame.implementationScope.sourceSupport;a.deepEqual(support.map(e=>e.helper),['attribute-escaping','call-time-resolution']);const source=fs.readFileSync('dashboard.js','utf8');for(const e of support){a.equal(e.path,'dashboard.js');a.equal(e.sha256,tasks.descriptor({assignment:tasks.REVIEW_OBJECTIVE}).sourceSha256);a.equal(e.excerptHash,require('node:crypto').createHash('sha256').update(e.text).digest('hex'));a.equal(source.split('\n').slice(e.line-1,e.line-1+e.text.split('\n').length).join('\n'),e.text);}a.match(support[0].text,/&quot;/);a.match(support[1].text,/Date\.parse/);a.match(support[1].text,/Number\.isFinite\(d\)\?d:0/);}
 const final=r.result.result.receipts[4],audit=r.result.result.receipts[3];a.deepEqual(final.response.auditorReview,{receiptHash:audit.hash,decision:'fail',reasonHash:require('node:crypto').createHash('sha256').update(audit.response.reason).digest('hex')});a.equal(final.response.auditDecision,'fail');a.equal(final.response.acceptedWork,false);
 a(r.frames.at(-1).frame.priorResults.find(x=>x.stage==='specialist').response.proposal.edits.length===1);
 a.equal(r.result.result.artifact.workspace.cleanup.destroyed,true);a.equal(r.result.result.artifact.sourceExecuted,false);a.equal(r.result.shutdown.paidExecution,false);a(r.f.state().operations.grants.every(g=>g.revoked));
 const c=r.frames.at(-1).c;
 for(const key of ['receiptHash','reasonHash','decision']){const value=structuredClone(final.response);value.auditorReview[key]=key==='decision'?'pass':'f'.repeat(64);a.throws(()=>report.validate('chief-final',value,c),e=>e.validationIssue?.mismatch==='review-reference');}
 const value=structuredClone(final.response);value.uncertainty='The Auditor reason is preserved verbatim.';a.throws(()=>report.validate('chief-final',value,c),e=>e.validationIssue?.mismatch==='unsupported-verbatim-claim');
 const forged=structuredClone(c);forged.binding.workspaceHash='f'.repeat(64);a.throws(()=>report.auditReference(forged),e=>e.validationIssue?.mismatch==='review-provenance');
 for(const field of ['auditDecision','acceptedWork']){const altered=structuredClone(final.response);altered[field]=field==='auditDecision'?'pass':true;a.throws(()=>inf.parseResponse('chief-final',altered,c));}
 const missing=structuredClone(final.response);delete missing.auditorReview;a.throws(()=>inf.parseResponse('chief-final',missing,c));
 for(const mutate of [x=>x.priorReceipts.reverse(),x=>x.priorReceipts[3].response.reason='Altered original reason.',x=>x.binding.runtime.release.digest='f'.repeat(64)]){const altered=structuredClone(c);mutate(altered);a.throws(()=>p.request('chief-final',altered));}
 const observedClaim=structuredClone(final.response);observedClaim.uncertainty='Auditor rejection, preserved verbatim as supplied: the handoff is blocked.';a.throws(()=>report.validate('chief-final',observedClaim,c),e=>e.validationIssue?.mismatch==='unsupported-verbatim-claim');
 const qaClaim=structuredClone(final.response);qaClaim.uncertainty='The QA reason is preserved verbatim.';report.validate('chief-final',qaClaim,c);
 const discussion=structuredClone(final.response);discussion.uncertainty='The Auditor did not quote source text verbatim.';report.validate('chief-final',discussion,c);
 const qa=r.result.result.receipts[2],qc=r.frames[2].c,clipped=structuredClone(qa.response);clipped.uncertainty='Criterion 3 remains blocked in the QA-s';a.throws(()=>report.validate('qa',clipped,qc),e=>e.validationIssue?.location==='$.uncertainty'&&e.validationIssue.mismatch==='incomplete-statement');
 const labels=structuredClone(r.result.result.receipts[1].response);labels.affectedInterfaces=['Client Calls','https://example.test/dashboard'];report.validate('specialist',labels,r.frames[1].c);
 // Wire-only adversarial sizing; these modified frames are never admitted as
 // authenticated receipts or dispatched. Exact provider counts remain required.
 for(const {body}of r.frames){const sized=structuredClone(body),frame=JSON.parse(sized.input[0].content[0].text);for(const row of frame.priorResults){if(row.stage==='qa'){row.response.uncertainty='Q'.repeat(399)+'.';row.response.decisions.forEach(d=>d.reason='Q'.repeat(599)+'.');}if(row.stage==='auditor'){row.response.reason='A'.repeat(599)+'.';row.response.risks=Array.from({length:4},()=> 'R'.repeat(399)+'.');}}sized.input[0].content[0].text=JSON.stringify(frame);a(Buffer.byteLength(JSON.stringify(sized))<=32768);}
});
test('clipped QA narrative fails with exact diagnostic, retained usage and no downstream calls',async()=>{
 const r=await run({badQa:true});a(r.error);a.equal(r.calls.length,6);const state=r.f.state(),w=state.operations.workflows.at(-1),failed=w.attempts.at(-1);a.equal(w.results.length,2);a.equal(failed.stage,'qa');a.equal(failed.diagnostic.httpStatus,200);a.equal(failed.diagnostic.outputTokens,500);a.equal(failed.failure.diagnostic.location,'$.decisions[0].reason');a.equal(failed.failure.diagnostic.mismatch,'incomplete-statement');a(state.operations.approvals.every(x=>x.status==='revoked'&&x.leaseUntil===0));a(state.operations.grants.every(x=>x.revoked));
});
test('new handoff policy does not reinterpret old syntax grants',()=>{
 a.equal(p.developmentFor({assignment:tasks.REVIEW_OBJECTIVE}),p.REVIEW_HANDOFF_TRIAL);a.equal(p.selectedTrial({CALLERCORE_AGENTOPS_ENGINEERING_TRIAL_AUTHORIZATION_ID:p.REVIEW_HANDOFF_TRIAL.authorizationId}),p.REVIEW_HANDOFF_TRIAL);a.equal(p.trialFor({countPricing:{authorizationId:p.REVIEW_HANDOFF_TRIAL.authorizationId,evidenceHash:p.hash(p.CALL_ROW_SYNTAX_TRIAL)}}),undefined);
 const old=tasks.descriptor({assignment:tasks.CURRENT_OBJECTIVE}),next=tasks.descriptor({assignment:tasks.REVIEW_OBJECTIVE});for(const k of ['sourceSha256','beforeText','afterPattern','maxReplacementBytes','testProfile'])a.deepEqual(old[k],next[k]);a.notEqual(old.descriptorHash,next.descriptorHash);
});
test('v3 exact count12001 blocks all Responses and still revokes temporary authority',async()=>{const r=await run({count:12001});a(r.error);a.equal(r.calls.length,1);a.equal(r.frames.length,0);a(r.f.state().operations.approvals.every(x=>x.status==='revoked'&&x.leaseUntil===0));a(r.f.state().operations.grants.every(x=>x.revoked));});
