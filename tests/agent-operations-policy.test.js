'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ROLES,permit,createTask,step}=require('../lib/agent-operations-policy');
const sha='a'.repeat(40),digest='b'.repeat(64);
const fresh=()=>createTask({objective:'Inspect Legal imagery',startingCommit:sha},0);
const claim=t=>step(t,{type:'claim',expectedRevision:t.revision,leaseMs:1000},1);
const complete=t=>step(t,{type:'implementation_complete',expectedRevision:t.revision,fence:t.fence,executionId:'exec_specialist',artifactSha256:digest},2);
const review=(t,accepted)=>step(t,{type:'review',expectedRevision:t.revision,role:'independent-qa',executionId:'exec_reviewer',artifactSha256:digest,accepted},3);
test('execution denies Production, disabled state, unknown roles and every consequential tool',()=>{
  const base={environment:'preview',enabled:true,role:'website-visual-qa',tool:'inspect_preview'};
  assert.equal(permit(base),true);
  for(const change of [{environment:'production'},{enabled:false},{enabled:'true'},{role:'owner'},{tool:'merge_main'},{tool:'activate_billing'},{tool:'shell'},{tool:'restore_database'},{tool:'sync_vapi'}])assert.equal(permit({...base,...change}),false);
  for(const role of ROLES)assert.equal(permit({...base,role,tool:'release',approval:'TJ said yes'}),false);
});
test('completion remains verification pending until separate review of the same artifact',()=>{
  const initial=fresh(),running=claim(initial),pending=complete(running);
  assert.equal(initial.status,'assigned');assert.equal(pending.status,'verification_pending');
  assert.equal(review(pending,true).status,'verified');
  assert.throws(()=>step(pending,{type:'review',expectedRevision:pending.revision,role:'independent-qa',executionId:'exec_specialist',artifactSha256:digest,accepted:true},3),/Independent/);
  assert.throws(()=>step(pending,{type:'review',expectedRevision:pending.revision,role:'independent-qa',executionId:'exec_other',artifactSha256:'c'.repeat(64),accepted:true},3),/evidence/);
});
test('rejected work has bounded distinct attempts and preserves audit history',()=>{
  let t=review(complete(claim(fresh())),false);assert.equal(t.status,'verification_failed');
  t=review(complete(claim(t)),false);assert.equal(t.status,'failed');assert.equal(t.attempts,2);
  assert.throws(()=>claim(t),/Terminal/);assert.equal(t.events.length,7);
});
test('stale revision, wrong fencing and expired lease cannot publish results',()=>{
  const t=claim(fresh());
  assert.throws(()=>step(t,{type:'cancel',expectedRevision:0},2),/Stale/);
  for(const [fence,now] of [[0,2],[t.fence,1001]])assert.throws(()=>step(t,{type:'implementation_complete',expectedRevision:t.revision,fence,executionId:'exec_x',artifactSha256:digest},now),/lease/);
  assert.throws(()=>step(t,{type:'expire',expectedRevision:t.revision},1000),/not expired/);
  const blocked=step(t,{type:'expire',expectedRevision:t.revision},1001);
  assert.equal(blocked.status,'blocked');assert.throws(()=>claim(blocked),/not claimable/);
});
test('cancelled execution cannot heartbeat, retry or complete',()=>{
  const t=claim(fresh()),cancelled=step(t,{type:'cancel',expectedRevision:t.revision},2);
  for(const type of ['claim','heartbeat','implementation_complete'])assert.throws(()=>step(cancelled,{type,expectedRevision:cancelled.revision,fence:t.fence},3),/Terminal/);
});
test('invalid bounds and unsupported acceptance/release transitions fail closed',()=>{
  for(const maxAttempts of [0,4,NaN])assert.throws(()=>createTask({objective:'Inspect',startingCommit:sha,maxAttempts}),/attempt/);
  assert.throws(()=>createTask({objective:'',startingCommit:sha}),/objective/);
  assert.throws(()=>step(fresh(),{type:'claim',expectedRevision:0,leaseMs:Infinity},1),/lease/);
  for(const type of ['integrated','owner_accepted','released'])assert.throws(()=>step(fresh(),{type,expectedRevision:0},1),/Unsupported/);
});
