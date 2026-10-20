'use strict';
// Independent negative-path review of actual durable operational interfaces.
// All source state is synthetic; no transport, provider, credentials or disk mutations.
const {test}=require('node:test'),assert=require('node:assert/strict');
const ops=require('../lib/agent-operations-operating-system'),monitor=require('../lib/agent-operations-monitoring');
const owner={kind:'owner',id:'owner@example.test',workspaceId:'alpha',verifiedOwner:true};
function fixture(){
 let now=1000000,ledger={version:1,revision:7,tasks:[],reservations:[],operations:{workflows:[],grants:[],reservations:[],audit:[],approvals:[]}},reads=0,sourceHook=null,commitHook=null,unavailable=false;
 const rows=new Map(),runtime={environment:'preview',origin:'https://qa-preview.vercel.app',commit:'a'.repeat(40)};
 const kv={get:async key=>rows.get(key)??null,eval:async(_script,[key],[before,after])=>{if(unavailable)throw Error('Redis unavailable');if((rows.get(key)||'')!==before)return 0;rows.set(key,after);if(commitHook)await commitHook(JSON.parse(after));return 1;}};
 const ledgerAdapter={read:async()=>{reads++;if(sourceHook)await sourceHook(reads);return JSON.stringify(ledger);}};
 const service=ops.createOperations({kv,ledgerAdapter,runtime,clock:()=>now,assertOwner:async actor=>actor.id===owner.id&&['alpha','beta'].includes(actor.workspaceId)});
 return{service,rows,runtime,ledger:()=>ledger,clock:n=>now=n,advance:n=>now+=n,sourceHook:f=>{reads=0;sourceHook=f;},commitHook:f=>commitHook=f,storageDown:v=>unavailable=v,mutate:f=>f(ledger),journal:()=>JSON.parse([...rows.values()][0])};
}
const assignment=(key='qa_assignment_001')=>({idempotencyKey:key,objective:'Read owned operational state only.',priority:'normal',durationMs:600000,subtasks:[{key:'budget',template:'budget-audit',dependsOn:[]},{key:'report',template:'contract-readiness',dependsOn:['budget']}]});
const command=p=>({planId:p.id,expectedRevision:p.revision});
function fillAudit(f,count){
 // Explicit capacity fault injection, preserving the journal's real hash-chain format.
 const [key,raw]=[...f.rows.entries()][0],s=JSON.parse(raw);
 while(s.audit.length<count){const e={sequence:s.audit.length+1,at:1000000,actorHash:monitor.identity(owner.id),type:'synthetic-prior-audit',previousHash:s.audit.at(-1)?.hash||null};e.hash=monitor.hash(e);s.audit.push(e);}
 f.rows.set(key,JSON.stringify(s));
}

test('actual durable route keeps tenants separate and rejects foreign plan identifiers',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment()),other={...owner,workspaceId:'beta'};
 assert.equal((await f.service.read(other)).plans.length,0);
 await assert.rejects(f.service.run(other,command(p)),/STALE/);
 await assert.rejects(f.service.cancel(other,command(p)),/STALE/);
 assert.equal((await f.service.read(owner)).plans[0].status,'queued');
 for(const actor of [{...owner,kind:'worker'},{...owner,verifiedOwner:false},{...owner,workspaceId:'foreign'},{...owner,id:'other@example.test'}])await assert.rejects(f.service.read(actor),/OWNER/);
});

test('routing rejects cycles, invented capabilities and permission-bearing metadata through actual create',async()=>{
 const f=fixture();
 for(const mutate of [x=>x.subtasks[0].dependsOn=['report'],x=>x.subtasks[0].dependsOn=['missing'],x=>x.subtasks[1].dependsOn=['budget','budget'],x=>x.subtasks[0].template='paid-model',x=>x.subtasks[0].department='finance-operations',x=>x.subtasks[0].permissions=['write_repo'],x=>x.paidEnabled=true]){
  const input=assignment();mutate(input);await assert.rejects(f.service.create(owner,input),/ROUTING|CYCLE|PLAN/);
 }
 assert.equal(f.rows.size,0);
});

test('durable dependency completes only after a separately verified internal report, never business acceptance',async()=>{
 const f=fixture(),source=JSON.stringify(f.ledger());let p=await f.service.create(owner,assignment());
 assert.equal(p.tasks[1].status,'waiting-dependencies');
 p=await f.service.run(owner,command(p));
 assert.equal(p.tasks[0].status,'completed');assert.equal(p.tasks[1].status,'queued');
 assert.equal(p.tasks[0].review.substantive,'not-assessed');assert.equal(p.tasks[0].review.operationalAuthority,false);
 p=await f.service.run(owner,command(p));assert.equal(p.status,'completed');
 assert.equal(p.internalVerified,true);assert.equal(p.acceptedWork,false);assert.equal(p.report.businessAcceptance,'not-granted');
 assert.equal(p.tasks.every(t=>t.acceptedWork===false&&t.review.acceptedWork===false),true);
 assert.equal(JSON.stringify(f.ledger()),source,'operational reports must not mutate execution or accounting ledger');
 assert.equal((await f.service.read(owner)).plans[0].id,p.id);
});

test('duplicate concurrent creates persist one plan and changed idempotency payload is rejected',async()=>{
 const f=fixture(),input=assignment(),[a,b]=await Promise.all([f.service.create(owner,input),f.service.create(owner,input)]);
 assert.equal(a.id,b.id);assert.equal((await f.service.read(owner)).plans.length,1);
 await assert.rejects(f.service.create(owner,{...input,objective:'Altered request'}),/REPLAY/);
});

test('concurrent Run and stale replay cannot execute the next dependency or duplicate an attempt',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment()),results=await Promise.allSettled([f.service.run(owner,command(p)),f.service.run(owner,command(p))]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const stored=(await f.service.read(owner)).plans[0];assert.equal(stored.tasks[0].attempts.length,1);assert.equal(stored.tasks[1].attempts.length,0);
 await assert.rejects(f.service.run(owner,command(p)),/STALE/);
});

test('cancellation racing actual source read wins over report publication and new dependent work',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment());
 f.sourceHook(async count=>{if(count===1){const active=f.journal().plans[0];await f.service.cancel(owner,command(active));}});
 await assert.rejects(f.service.run(owner,command(p)),/REVOKED/);f.sourceHook(null);
 const stored=(await f.service.read(owner)).plans[0];assert.equal(stored.status,'cancelled');assert.equal(stored.tasks.every(t=>t.status==='cancelled'&&t.result===null&&t.leaseUntil===0),true);
 await assert.rejects(f.service.recover(owner,{...command(stored),taskId:stored.tasks[0].id}),/RECOVERY/);
});

test('source movement between report and finalization blocks publication, preserves pending uncertainty, then allows one explicit retry',async()=>{
 const f=fixture();f.mutate(s=>s.reservations.push({taskId:'unknown',mode:'pilot',ceilingMicros:300000,status:'pending'}));
 const p=await f.service.create(owner,assignment());
 f.sourceHook(count=>{if(count===2)f.mutate(s=>{s.revision++;s.reservations.push({taskId:'another',mode:'pilot',ceilingMicros:300000,status:'pending'});});});
 await assert.rejects(f.service.run(owner,command(p)),/SOURCE_CHANGED/);f.sourceHook(null);
 let stored=(await f.service.read(owner)).plans[0];assert.equal(stored.tasks[0].status,'blocked');assert.equal(stored.tasks[0].result,null);
 assert.equal(f.ledger().reservations.every(r=>r.status==='pending'),true);
 stored=await f.service.recover(owner,{...command(stored),taskId:stored.tasks[0].id});
 stored=await f.service.run(owner,command(stored));assert.equal(stored.tasks[0].attempts.length,2);assert.equal(stored.tasks[0].internalVerified,true);
 assert.equal(stored.tasks[1].status,'queued','recovered prerequisite must unblock its untouched dependent');
 stored=await f.service.run(owner,command(stored));assert.equal(stored.status,'completed');
 assert.equal(f.ledger().reservations.every(r=>r.status==='pending'),true);
});

test('lost committed claim leaves an observable lease, bounded owner recovery and fenced old execution',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment());
 f.commitHook(s=>{if(s.audit.at(-1)?.type==='internal-task-claimed')throw Error('Lost committed claim response');});
 await assert.rejects(f.service.run(owner,command(p)),/Lost committed/);f.commitHook(null);
 let stored=(await f.service.read(owner)).plans[0],oldFence=stored.tasks[0].fence;
 await assert.rejects(f.service.recover(owner,{...command(stored),taskId:stored.tasks[0].id}),/RECOVERY/);
 f.advance(30001);stored=(await f.service.read(owner)).plans[0];assert.equal(stored.tasks[0].observedStatus,'lease-expired');assert.equal(stored.tasks[0].recoveryEligible,true);
 stored=await f.service.recover(owner,{...command(stored),taskId:stored.tasks[0].id});assert(stored.tasks[0].fence>oldFence);
 f.commitHook(s=>{if(s.audit.at(-1)?.type==='internal-task-claimed')throw Error('Second interrupted claim');});
 await assert.rejects(f.service.run(owner,command(stored)),/Second interrupted/);f.commitHook(null);f.advance(30001);
 stored=(await f.service.read(owner)).plans[0];await assert.rejects(f.service.recover(owner,{...command(stored),taskId:stored.tasks[0].id}),/RECOVERY/);
 assert.equal(stored.tasks[0].attempts.length,2);assert.equal(stored.acceptedWork,false);
});

test('stale release denies execution and recovery but still permits cancellation cleanup',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment());f.runtime.commit='b'.repeat(40);
 await assert.rejects(f.service.run(owner,command(p)),/STALE/);
 await assert.rejects(f.service.recover(owner,{...command(p),taskId:p.tasks[0].id}),/RECOVERY/);
 const cancelled=await f.service.cancel(owner,command(p));assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.acceptedWork,false);
});

test('Redis CAS failure cannot invent successful task completion or bypass cleanup confirmation',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment());f.storageDown(true);
 await assert.rejects(f.service.run(owner,command(p)),/Redis unavailable/);
 await assert.rejects(f.service.emergencyStop(owner,{expectedRevision:f.journal().revision}),/Redis unavailable/);
 f.storageDown(false);assert.equal((await f.service.read(owner)).plans[0].status,'queued');
});

test('backend verifier rejects acceptance, authority or report-field fabrication',()=>{
 const snapshot={sourceHash:'c'.repeat(64),sourceRevision:7,at:1000,runtime:{release:{digest:'d'.repeat(64)}},budget:{pendingMicros:2200000},attribution:[]},task={template:'budget-audit',role:'finance-cost-control'},report=ops.internalReport(task.template,snapshot);
 for(const alter of [x=>x.acceptedWork=true,x=>x.costMicros=1,x=>x.body.budget.pendingMicros=0,x=>x.operationalAuthority=true,x=>x.body.qualification='All costs settled.']){const bad=structuredClone(report);alter(bad);assert.throws(()=>ops.verifyReport(task,bad,snapshot,'execution_one'),/REVIEW/);}
 const review=ops.verifyReport(task,report,snapshot,'execution_one');assert.equal(review.acceptedWork,false);assert.equal(review.substantive,'not-assessed');assert.match(review.independence,/not-human-or-model/);
});

test('monitor does not infer provider availability, human independence or permission from persisted healthy state',async()=>{
 const f=fixture(),state=await f.service.read(owner);assert.equal(state.monitoring.dependencies.provider.status,'unknown');assert.equal(state.monitoring.dependencies.browser.status,'not-observed');assert.equal(state.reviewPolicy.humanIndependence,'unavailable-no-new-reviewer-grant');assert.equal(state.permissions.paidExecution,false);assert.equal(state.permissions.writesEnabled,false);assert.equal(state.monitoring.acceptanceAuthority,false);
});

test('consumed approval with expired owner lease is monitored even between model stages',()=>{
 const f=fixture();f.mutate(s=>s.operations.approvals.push({id:'pilot_consumed',workflowId:'wf_waiting',ownerHash:monitor.identity(owner.id),ownerWorkspaceId:owner.workspaceId,status:'consumed',leaseUntil:999999,expiresAt:1600000,contractHash:'e'.repeat(64)}));
 const snapshot=monitor.snapshot(f.ledger(),owner,{release:{digest:'e'.repeat(64)}},1000000);
 assert(snapshot.alerts.some(a=>a.code==='approval-authority-expired'),'a consumed authorization remains consequential between stages and needs an expired-lease alert');
});

test('incident acknowledgement, clearance and recurrence preserve original evidence and owner history',async()=>{
 const f=fixture();f.mutate(s=>s.tasks.push({id:'legacy_owned',principal:owner.id,workspaceId:owner.workspaceId,status:'running',stage:'chief',updatedAt:990000,leaseUntil:999999,deadline:1600000,revision:1,outcomes:{acceptedWork:false}}));
 let out=await f.service.synchronize(owner,{}),incident=out.incidents.find(i=>i.code==='execution-lease-expired');assert(incident);
 const original=structuredClone(incident.originalEvidence),evidenceHash=incident.evidenceHash;
 incident=await f.service.incident(owner,{id:incident.id,expectedRevision:incident.revision,operation:'acknowledge',reason:'Investigating retained execution evidence.'});
 await assert.rejects(f.service.incident(owner,{id:incident.id,expectedRevision:1,operation:'escalate',reason:'Stale duplicate'}),/STALE/);
 f.mutate(s=>{s.tasks[0].status='cancelled';s.tasks[0].revision++;});
 out=await f.service.synchronize(owner,{});assert.equal(out.incidents.find(i=>i.id===incident.id).status,'resolved');
 f.mutate(s=>{s.tasks[0].status='running';s.tasks[0].revision++;s.tasks[0].leaseUntil=999998;});
 out=await f.service.synchronize(owner,{});incident=out.incidents.find(i=>i.id===incident.id);
 assert.equal(incident.status,'open');assert.deepEqual(incident.originalEvidence,original);assert.equal(incident.evidenceHash,evidenceHash);assert.equal(incident.history.length,1);assert.notDeepEqual(incident.latestEvidence,original);
 assert.equal(f.ledger().tasks[0].outcomes.acceptedWork,false);
});

test('same owner in two workspaces cannot receive foreign entity audit events through actor-only matching',()=>{
 const f=fixture(),ownerHash=monitor.identity(owner.id);f.mutate(s=>{s.operations.grants.push({id:'grant_own',issuerHash:ownerHash,workspaceId:'alpha'},{id:'grant_foreign',issuerHash:ownerHash,workspaceId:'beta'});s.operations.workflows.push({id:'wf_own',grantId:'grant_own',workspaceId:'alpha'},{id:'wf_foreign',grantId:'grant_foreign',workspaceId:'beta'});s.operations.audit.push({actorHash:ownerHash,type:'workflow-created',workflowId:'wf_own'},{actorHash:ownerHash,type:'workflow-created',workflowId:'wf_foreign',grantId:'grant_foreign'});});
 const o=f.ledger().operations,out=monitor.scopedSummary({grants:o.grants,workflows:o.workflows,approvals:[],reservations:[],audit:o.audit,agents:[]},f.ledger(),owner);
 assert.equal(out.workflows.length,1);assert.equal(out.audit.length,1);assert.equal(out.audit[0].workflowId,'wf_own');assert.equal(JSON.stringify(out).includes('foreign'),false);
});

test('normal admission preserves reserved shutdown audit space and cannot strand an unstarted task at capacity',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment());fillAudit(f,ops.LIMITS.admissionAudit-1);
 await assert.rejects(f.service.run(owner,command(p)),/CAPACITY/);
 assert.equal(f.journal().plans[0].tasks[0].attempts.length,0);
 const cancelled=await f.service.cancel(owner,command(p));assert.equal(cancelled.status,'cancelled');assert.equal(f.journal().audit.length,ops.LIMITS.admissionAudit);
 await assert.rejects(f.service.create(owner,assignment('another_assignment_002')),/CAPACITY/);
 assert.equal(f.journal().plans.length,1);
});

test('Cancel and emergency stop can consume final reserved audit slot; repeated empty emergency needs no slot',async()=>{
 for(const action of ['cancel','emergencyStop']){
  const f=fixture(),p=await f.service.create(owner,assignment()),source=JSON.stringify(f.ledger());fillAudit(f,ops.LIMITS.audit-1);
  if(action==='cancel')await f.service.cancel(owner,command(p));else await f.service.emergencyStop(owner,{expectedRevision:f.journal().revision});
  let s=f.journal();assert.equal(s.audit.length,ops.LIMITS.audit);assert.equal(s.plans[0].status,'cancelled');assert.equal(s.plans[0].tasks.every(t=>t.leaseUntil===0&&t.status==='cancelled'),true);
  const again=await f.service.emergencyStop(owner,{expectedRevision:s.revision});assert.equal(again.idempotent,true);s=f.journal();assert.equal(s.audit.length,ops.LIMITS.audit);assert.equal(JSON.stringify(f.ledger()),source);
 }
});

test('expired queued assignment is visibly non-runnable, records a qualified incident, and remains cancellable',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment());f.advance(600001);
 const observed=(await f.service.read(owner)).plans[0];assert.equal(observed.observedStatus,'deadline-expired');assert.equal(observed.recoveryEligible,false);
 await assert.rejects(f.service.run(owner,command(p)),/STALE/);
 const synced=await f.service.synchronize(owner,{}),i=synced.incidents.find(i=>i.code==='internal-assignment-expired');assert(i);assert.equal(i.taskId,p.id);assert.equal(i.originalEvidence.deadline,p.deadline);assert.match(i.action,/cannot extend/);
 assert.equal(f.journal().plans[0].tasks.every(t=>t.attempts.length===0),true);
 assert.equal((await f.service.cancel(owner,command(p))).status,'cancelled');
});

test('incident creation, update and resolution retain exact source-snapshot provenance without current-health claims',async()=>{
 const f=fixture();f.mutate(s=>s.tasks.push({id:'legacy_provenance',principal:owner.id,workspaceId:owner.workspaceId,status:'blocked',stage:'chief',updatedAt:990000,leaseUntil:0,deadline:1600000,revision:1,outcomes:{acceptedWork:false}}));
 let out=await f.service.synchronize(owner,{}),i=out.incidents.find(x=>x.taskId==='legacy_provenance');assert(i);const original=structuredClone(i.originalObservation);
 assert.equal(original.sourceRevision,7);assert.equal(original.observedAt,1000000);assert.equal(original.operationsRevision,0);assert.match(original.sourceHash,/^[a-f0-9]{64}$/);
 f.advance(10);f.mutate(s=>{s.revision=8;s.tasks[0].revision++;s.tasks[0].status='failed';});out=await f.service.synchronize(owner,{});i=out.incidents.find(x=>x.id===i.id);
 assert.deepEqual(i.originalObservation,original);assert.equal(i.latestObservation.sourceRevision,8);assert.equal(i.latestObservation.observedAt,1000010);assert.notEqual(i.latestObservation.sourceHash,original.sourceHash);
 f.advance(10);f.mutate(s=>{s.revision=9;s.tasks[0].revision++;s.tasks[0].status='cancelled';});out=await f.service.synchronize(owner,{});i=out.incidents.find(x=>x.id===i.id);
 assert.equal(i.status,'resolved');assert.equal(i.resolutionObservation.sourceRevision,9);assert.equal(i.resolutionObservation.observedAt,1000020);assert.match(i.resolutionQualification,/not an atomic current-health guarantee/);assert.deepEqual(i.originalObservation,original);
});

test('foreign top-level rehearsal and control metadata cannot escape scoped organizational summary',()=>{
 const f=fixture();f.mutate(s=>s.operations.approvals.push({id:'foreign_rehearsal',ownerHash:monitor.identity('other@example.test'),ownerWorkspaceId:'foreign',status:'active'}));
 const summary={rehearsal:{id:'foreign_rehearsal',nonce:'private_foreign_nonce'},controlAuthority:true,maxCalls:5,maxMicros:3600000,paidExecution:true,grants:[],workflows:[],approvals:f.ledger().operations.approvals,reservations:[],audit:[],agents:[]};
 const out=monitor.scopedSummary(summary,f.ledger(),owner);for(const key of ['rehearsal','controlAuthority','maxCalls','maxMicros'])assert.equal(Object.hasOwn(out,key),false);
 assert.equal(out.paidExecution,false);assert.equal(JSON.stringify(out).includes('foreign'),false);
});

test('persisted privilege, accounting, task identity and verification tampering fail closed on actual read',async()=>{
 const f=fixture(),p=await f.service.create(owner,assignment());await f.service.run(owner,command(p));
 const [key,raw]=[...f.rows.entries()][0];
 for(const [index,alter] of [s=>s.plans[0].acceptedWork=true,s=>s.plans[0].modelCalls=1,s=>s.plans[0].reservationMicros=1,s=>s.plans[0].tasks[0].acceptedWork=true,s=>s.plans[0].tasks[0].role='chief-of-staff',s=>s.plans[0].tasks[0].fence=-1,s=>s.plans[0].tasks[0].attempts[0].modelCalls=1,s=>s.plans[0].tasks[0].result.acceptedWork=true,s=>s.plans[0].tasks[0].result.body.budget.pendingMicros=1,s=>s.plans[0].tasks[0].review.operationalAuthority=true,s=>s.plans[0].tasks[0].review.reviewExecutionId=s.plans[0].tasks[0].review.implementationExecutionId,s=>s.plans[0].tasks[1].result={invented:true},s=>s.plans[0].status='completed',s=>s.plans[0].tasks[0].dependsOn=['report']].entries()){
  const corrupt=JSON.parse(raw);alter(corrupt);const poisoned=JSON.stringify(corrupt);assert.notEqual(poisoned,raw,'tamper '+index+' must change the original payload');f.rows.set(key,poisoned);
  await assert.rejects(f.service.read(owner),/OPS_STATE_INVALID/,'tamper '+index+' must be rejected');assert.equal(f.rows.get(key),poisoned,'invalid state must not be silently repaired');
 }
 f.rows.set(key,raw);
});

test('valid rehashed chain with an invalid global audit sequence is rejected',async()=>{
 const f=fixture();await f.service.create(owner,assignment());const [key,raw]=[...f.rows.entries()][0],s=JSON.parse(raw);s.audit[0].sequence=2;
 let previous=null;for(const e of s.audit){e.previousHash=previous;const {hash:old,...body}=e;e.hash=monitor.hash(body);previous=e.hash;}
 f.rows.set(key,JSON.stringify(s));await assert.rejects(f.service.read(owner),/OPS_AUDIT_INVALID/);
});

test('maximum unfinished plans near normal byte capacity retain bounded serial and emergency cancellation headroom',async()=>{
 const original=fixture();
 for(let i=0;i<ops.LIMITS.plans;i++)await original.service.create(owner,{...assignment('capacity_assignment_'+String(i).padStart(3,'0')),objective:'界'.repeat(1000),subtasks:Array.from({length:8},(_,j)=>({key:('task_'+j+'_').padEnd(80,'x'),template:j%2?'runtime-health':'budget-audit',dependsOn:j?[('task_'+(j-1)+'_').padEnd(80,'x')]:[]}))});
 const [key,raw]=[...original.rows.entries()][0],s=JSON.parse(raw),target=ops.LIMITS.bytes-50;
 // Bounded legitimate incident/history records simulate a long-lived journal.
 // They do not inject execution results, acceptance, permissions or paid receipts.
 outer:for(let i=0;i<ops.LIMITS.incidents;i++){
  const evidence={taskId:'synthetic_capacity_task_'+i,revision:1},observation={sourceHash:'e'.repeat(64),sourceRevision:7,observedAt:1000000,operationsRevision:s.revision};
  const incident={id:'incident_capacity_'+i,conditionId:'condition_capacity_'+i,code:'assignment-blocked',severity:'medium',owner:'workspace-owner',taskId:evidence.taskId,evidenceHash:monitor.hash(evidence),originalEvidence:evidence,originalObservation:observation,latestObservation:observation,firstSeen:1000000,lastSeen:1000000,status:'acknowledged',revision:1,rechecks:0,history:[]};s.incidents.push(incident);
  if(Buffer.byteLength(JSON.stringify(s))>target){s.incidents.pop();break;}
  for(let j=0;j<10;j++){
   const h={at:1000000,operation:'acknowledge',reason:'界'.repeat(500),ownerHash:monitor.identity(owner.id)};incident.history.push(h);incident.revision++;
   const excess=Buffer.byteLength(JSON.stringify(s))-target;
   if(excess>0){const remaining=500-Math.ceil(excess/3);if(remaining<1){incident.history.pop();incident.revision--;}else h.reason='界'.repeat(remaining);break outer;}
  }
 }
 const bounded=JSON.stringify(s),before=Buffer.byteLength(bounded);assert(before>ops.LIMITS.bytes-2000);assert(before<=ops.LIMITS.bytes);
 for(const mode of ['serial','emergency']){
  const f=fixture();f.rows.set(key,bounded);const source=JSON.stringify(f.ledger());
  if(mode==='serial')for(const p of s.plans)await f.service.cancel(owner,command(p));else await f.service.emergencyStop(owner,{expectedRevision:s.revision});
  const final=f.journal(),after=Buffer.byteLength(JSON.stringify(final));assert.equal(final.plans.length,ops.LIMITS.plans);assert.equal(final.plans.every(p=>p.status==='cancelled'&&p.acceptedWork===false&&p.tasks.every(t=>t.status==='cancelled'&&t.leaseUntil===0)),true);
  if(mode==='serial')assert(after>ops.LIMITS.bytes,'serial cleanup must use its separately reserved byte headroom');assert(after<=ops.LIMITS.bytes+ops.LIMITS.cleanupBytes);assert(after-before<ops.LIMITS.cleanupBytes);assert.equal(JSON.stringify(f.ledger()),source);
  assert.equal((await f.service.read(owner)).plans.length,ops.LIMITS.plans);
 }
});


test('bounded retention preserves all25 historical plans and denies overflow without audit loss',async()=>{
 const f=fixture();for(let i=0;i<25;i++){const p=await f.service.create(owner,assignment('historical_plan_'+i));await f.service.cancel(owner,command(p));}
 const before=f.journal(),source=JSON.stringify(f.ledger()),p=await f.service.create(owner,assignment('one_extra_admission'));const admitted=f.journal();
 assert.equal(ops.LIMITS.plans,50);assert.equal(admitted.plans.length,26);assert.deepEqual(admitted.plans.slice(0,25),before.plans);assert.deepEqual(admitted.audit.slice(0,before.audit.length),before.audit);assert.equal(admitted.audit.length,before.audit.length+1);
 for(let i=26;i<ops.LIMITS.plans;i++)await f.service.create(owner,assignment('retained_plan_'+i));const raw=JSON.stringify(f.journal());await assert.rejects(f.service.create(owner,assignment('denied_plan_overflow')),/OPS_CAPACITY/);assert.equal(JSON.stringify(f.journal()),raw);
 assert.equal((await f.service.create(owner,assignment('one_extra_admission'))).id,p.id);assert.deepEqual(f.journal().plans.slice(0,26),admitted.plans);
 assert.equal((await f.service.cancel(owner,command(p))).status,'cancelled');assert.equal(JSON.stringify(f.ledger()),source);assert.equal(f.journal().plans.length,ops.LIMITS.plans);
});
test('concurrent final-slot admissions have one CAS winner and preserve historical prefix',async()=>{
 const f=fixture();for(let i=0;i<ops.LIMITS.plans-1;i++)await f.service.create(owner,assignment('existing_plan_'+i));const before=f.journal();
 const results=await Promise.allSettled(['one','two'].map(k=>f.service.create(owner,assignment('capacity_race_'+k))));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&/OPS_CAPACITY/.test(x.reason.message)).length,1);
 const after=f.journal();assert.equal(after.plans.length,ops.LIMITS.plans);assert.deepEqual(after.plans.slice(0,-1),before.plans);assert.deepEqual(after.audit.slice(0,before.audit.length),before.audit);assert.equal(after.audit.length,before.audit.length+1);
});

test('owner utilization is read-only and measures exact stored bytes; foreign state stays isolated',async()=>{const f=fixture();await f.service.create(owner,assignment('capacity_read_only'));const before=[...f.rows.values()][0],v=await f.service.read(owner);assert.equal(v.capacity.bytes,Buffer.byteLength(before));assert.equal(v.capacity.plans,1);assert.equal(v.capacity.audit,1);assert.equal(v.capacity.executionAuthorized,false);assert.equal([...f.rows.values()][0],before);const other=await f.service.read({...owner,workspaceId:'beta'});assert.equal(other.capacity.plans,0);assert.equal(other.capacity.audit,0);await assert.rejects(f.service.read({...owner,id:'foreign@example.test'}),/OWNER/);assert.equal([...f.rows.values()][0],before);});
for(const [dimension,value,code]of [['plans',50,'OPS_CAPACITY_PLANS'],['audit',388,'OPS_CAPACITY_ADMISSION_AUDIT'],['bytes',require('../lib/agent-operations-operating-system').LIMITS.bytes-23999,'OPS_CAPACITY_BYTES']])test('configuration headroom denies '+dimension+' without rewriting history',()=>{const c={version:'operations-capacity-v1',plans:1,audit:1,bytes:10000,[dimension]:value},before=JSON.stringify(c);assert.throws(()=>ops.assertRefreshCapacity(c),new RegExp(code));assert.equal(JSON.stringify(c),before);});
test('configuration headroom is conservative observation, not a new capacity limit or permission',()=>{assert.equal(ops.LIMITS.plans,50);assert.equal(ops.LIMITS.admissionAudit,400);assert.equal(ops.LIMITS.audit,500);assert.equal(ops.LIMITS.bytes,1000000);ops.assertRefreshCapacity({version:'operations-capacity-v1',plans:49,audit:387,bytes:ops.LIMITS.bytes-24000});for(const c of [null,{}, {version:'operations-capacity-v1',plans:1,audit:1,bytes:NaN}])assert.throws(()=>ops.assertRefreshCapacity(c),/OPS_CAPACITY_UNCONFIRMED/);});
test('capacity denial names admission audit dimension and leaves original CAS document intact',async()=>{const f=fixture();await f.service.create(owner,assignment('capacity_original'));fillAudit(f,400);const before=[...f.rows.values()][0];await assert.rejects(f.service.create(owner,assignment('capacity_denied')),/OPS_CAPACITY_ADMISSION_AUDIT/);assert.equal([...f.rows.values()][0],before);});

test('bounded extension appends above old byte ceiling without rewriting preserved assignment or audit prefix',async()=>{const f=fixture(),p=await f.service.create(owner,assignment('byte_extension_original')),s=f.journal(),key=[...f.rows.keys()][0];for(let i=0;i<50&&Buffer.byteLength(JSON.stringify(s))<730000;i++){const evidence={taskId:'bounded_history_'+i},o={sourceHash:'e'.repeat(64),sourceRevision:1,observedAt:1000000,operationsRevision:s.revision};s.incidents.push({id:'incident_history_'+i,conditionId:'condition_history_'+i,code:'assignment-blocked',severity:'medium',owner:'workspace-owner',taskId:evidence.taskId,evidenceHash:monitor.hash(evidence),originalEvidence:evidence,originalObservation:o,latestObservation:o,firstSeen:1000000,lastSeen:1000000,status:'acknowledged',revision:11,rechecks:0,history:Array.from({length:10},()=>({at:1000000,operation:'acknowledge',reason:'界'.repeat(500),ownerHash:monitor.identity(owner.id)}))});}const prior=JSON.stringify(s);assert(Buffer.byteLength(prior)>700000);assert(Buffer.byteLength(prior)<ops.LIMITS.bytes-24000);f.rows.set(key,prior);const next=await f.service.create(owner,assignment('byte_extension_new_task'));const after=f.journal();assert.deepEqual(after.plans[0],p);assert.deepEqual(after.audit.slice(0,s.audit.length),s.audit);assert.deepEqual(after.incidents,s.incidents);assert.equal(after.plans.length,2);assert.equal(next.acceptedWork,false);assert.equal(next.modelCalls,0);assert(Buffer.byteLength(JSON.stringify(after))<=ops.LIMITS.bytes);});
test('worst escaped bounded CAS fits documented provider10MB request limit without new commands or keys',()=>{const max=ops.LIMITS.bytes+ops.LIMITS.cleanupBytes,raw=JSON.stringify({padding:'\\'.repeat(Math.floor((max-32)/2))});assert(Buffer.byteLength(raw)<=max);const wire=JSON.stringify(['EVAL',require('../lib/agent-operations-store').CAS,1,'agentops:{preview}:operations:v1:fixture',raw,raw]);assert(Buffer.byteLength(wire)<10000000);assert.equal(ops.LIMITS.cleanupBytes,100000);assert.equal(ops.LIMITS.plans,50);assert.equal(ops.LIMITS.audit,500);assert.equal(ops.LIMITS.admissionAudit,400);});
