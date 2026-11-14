'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const tasks=require('../lib/agent-operations-implementation-tasks'),impl=require('../lib/agent-operations-implementation'),p=require('../lib/agent-operations-engineering-provider-v2'),inf=require('../lib/agent-operations-engineering-inference');
for(const interrupted of [false,true,'schema'])test('owner controller source review and shutdown: '+interrupted,async()=>{
 const setupText=fs.readFileSync(require.resolve('./agent-operations-call-row-syntax-controller.test'),'utf8').split('\ntest(')[0]
  .replaceAll('tasks.CURRENT_OBJECTIVE','tasks.SOURCE_REVIEW_OBJECTIVE')
  .replace(/^const restoreHistoricalSource=.*$/m,'')
  .replace("commit:'a'.repeat(40)","commit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()");
 const setup=new Function('require','__dirname',setupText+'\nreturn fixture;')(require,__dirname);
 a.equal(tasks.availability({assignment:tasks.SOURCE_REVIEW_OBJECTIVE}).freshAssignmentAllowed,true);
 const f=await setup(),owner={kind:'owner',verifiedOwner:true,id:'current-task-fixture@example.test',workspaceId:'current-task-fixture'},previous=global.fetch;
 const reader=require('../lib/agent-operations-repository-source'),calls=[];
 global.fetch=async(url,options)=>{
  const body=JSON.parse(options.body),frame=JSON.parse(body.input[0].content[0].text);
  calls.push(url);
  if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:1000});
  const w=f.state().operations.workflows.at(-1),stage=inf.STAGES[w.results.length],c={...f.context,binding:frame.binding,priorReceipts:w.results};
  const base={id:'resp_source_review_'+calls.length,status:'completed',model:'gpt-6.1-sol',service_tier:'default',
   usage:{input_tokens:1000,output_tokens:400,input_tokens_details:{cached_tokens:200,cache_write_tokens:100},output_tokens_details:{reasoning_tokens:50}}};
  a.match(body.instructions,/formatFullDateTime/);
  a.doesNotMatch(body.instructions,/aria-label replacement/);
  if(p.sourceStage(stage)&&!frame.requestedSource)return Response.json({...base,output:[{type:'function_call',name:'read_repository_source',call_id:'call_source_review',arguments:JSON.stringify({...reader.initial(),kind:'read',path:'dashboard.js',startLine:580,lineCount:4})}]});
  if(p.sourceStage(stage)){
   a.equal(frame.requestedSource.reference.stage,stage);
   a.match(frame.requestedSource.packet.body.evidence[0].text,/function formatFullDateTime/);
  }
  if(stage==='chief-final'){
   a.deepEqual(frame.priorSourceReads.map(read=>read.stage),['specialist','qa','auditor']);
   for(const read of frame.priorSourceReads)a.equal(read.binding.runtime.sourceCommit,f.runtime.commit);
  }
  if(interrupted===true&&stage==='qa')return Response.json({}, {status:503});
  return Response.json({...base,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(interrupted==='schema'&&stage==='qa'?{}:impl.fixture(stage,c))}]}]});
 };
 try{
  const manifest=await f.control.trialManifest(owner,{planId:f.plan.id,expectedRevision:1,sequenceId:f.sequenceId});
  a.equal(manifest.approval.maxCalls,8);
  const input={planId:f.plan.id,expectedRevision:1,approval:manifest.approval},prepared=await f.control.prepare(owner,input);
  const active=await f.control.activate(owner,{...input,expectedApprovalRevision:prepared.record.revision});
  if(interrupted){
   await a.rejects(f.control.run(owner,{...input,expectedApprovalRevision:active.revision}),error=>error.message==='ENG_TRANSPORT_FAILED'&&error.cleanupConfirmed===true);
   const state=f.state(),w=state.operations.workflows.at(-1),last=w.attempts.at(-1);
   a.deepEqual(w.results.map(r=>r.stage),['chief-plan','specialist']);
   a.equal(w.calls,5);a.equal(w.countCalls,5);
   a.equal(last.diagnostic.httpStatus,200);
   a.equal(last.sourceResume.diagnostic.httpStatus,interrupted===true?503:200);
   a.equal(last.failure.diagnostic.requestHash,last.sourceResume.requestHash);
   a.equal(last.failure.diagnostic.phase,interrupted===true?'response-body':'response-validate');
   const reservation=state.operations.reservations.find(row=>row.executionId===last.executionId);
   a.equal(reservation.countRequests,2);
   a.equal(reservation.responsesActualMicros,interrupted===true?5670:11340);
   a.equal(reservation.status,'pending');
   a.equal(w.leaseUntil,0);
   a(w.attempts.every(attempt=>attempt.closed));
   a(state.operations.grants.every(grant=>grant.revoked));
   a.equal(state.operations.approvals.at(-1).status,'revoked');
   a.equal(calls.length,10);
   return;
  }
  let result;
  try{result=await f.control.run(owner,{...input,expectedApprovalRevision:active.revision});}
  catch(error){throw Object.assign(Error(JSON.stringify(error.diagnostic??error.message)),{cause:error});}
  a.equal(calls.length,16);
  a.equal(result.result.receipts.length,5);
  a.equal(result.result.receipts.at(-1).response.auditDecision,'fail');
  a.equal(result.shutdown.paidExecution,false);
  const state=f.state(),w=state.operations.workflows.at(-1);
  a.equal(w.calls,8);a.equal(w.countCalls,8);
  const reservations=state.operations.reservations.filter(r=>r.workflowId===w.id);
  a.deepEqual(reservations.map(r=>r.countRequests),[1,2,2,2,1]);
  a.equal(reservations.reduce((total,r)=>total+r.responsesActualMicros,0),45360);
  a.deepEqual(reservations.map(r=>r.ceilingMicros),[70000,220000,140000,140000,70000]);
  a(state.operations.grants.every(g=>g.revoked));
 }finally{global.fetch=previous;}
});
