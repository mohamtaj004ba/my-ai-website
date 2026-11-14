'use strict';
// Offline domain scaffold only. No provider, storage, routes, or credentials.
// The future broker must authenticate callers and transact these decisions.
const {randomUUID}=require('node:crypto');
const ROLES=Object.freeze(['chief-of-staff','website-visual-qa','independent-qa']);
const TOOLS=Object.freeze({
  'chief-of-staff':Object.freeze(['delegate_inspection','request_review','report']),
  'website-visual-qa':Object.freeze(['inspect_preview','record_finding']),
  'independent-qa':Object.freeze(['inspect_preview','review_evidence'])
});
function permit({environment,enabled,role,tool}){
  // Approval prose never expands this allowlist. Red tools do not exist here.
  return environment==='preview'&&enabled===true&&ROLES.includes(role)&&TOOLS[role].includes(tool);
}
function integer(value,min,max,name){
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error('Invalid '+name);
  return value;
}
function createTask({objective,startingCommit,maxAttempts=2},now=Date.now()){
  if(typeof objective!=='string'||!objective.trim()||objective.length>2000)throw new Error('Invalid objective');
  if(typeof startingCommit!=='string'||!/^[a-f0-9]{40}$/.test(startingCommit))throw new Error('Invalid starting commit');
  integer(now,0,Number.MAX_SAFE_INTEGER,'time');integer(maxAttempts,1,3,'attempt limit');
  return {id:randomUUID(),objective:objective.trim(),startingCommit,status:'assigned',revision:0,
    maxAttempts,attempts:0,fence:0,lease:null,implementation:null,verification:null,
    events:[{type:'assigned',at:now,revision:0}]};
}
function step(task,command,now=Date.now()){
  integer(now,0,Number.MAX_SAFE_INTEGER,'time');
  if(!command||command.expectedRevision!==task.revision)throw new Error('Stale task revision');
  if(['cancelled','failed','verified'].includes(task.status))throw new Error('Terminal scaffold state');
  const next=structuredClone(task);
  const active=()=>{
    if(!next.lease||command.fence!==next.fence||now>=next.lease.expiresAt)throw new Error('Invalid execution lease');
  };
  switch(command.type){
    case 'claim':
      if(!['assigned','verification_failed'].includes(next.status))throw new Error('Task not claimable');
      if(next.attempts>=next.maxAttempts)throw new Error('Attempt limit reached');
      integer(command.leaseMs,1000,60000,'lease');
      next.attempts++;next.fence++;next.status='running';
      next.implementation=null;next.verification=null;
      next.lease={expiresAt:now+command.leaseMs};break;
    case 'heartbeat':
      if(next.status!=='running')throw new Error('Task not running');active();
      integer(command.leaseMs,1000,60000,'lease');next.lease.expiresAt=now+command.leaseMs;break;
    case 'implementation_complete':
      if(next.status!=='running')throw new Error('Task not running');active();
      if(typeof command.executionId!=='string'||!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(command.executionId))throw new Error('Invalid execution identity');
      if(typeof command.artifactSha256!=='string'||!/^[a-f0-9]{64}$/.test(command.artifactSha256))throw new Error('Missing artifact digest');
      next.implementation={executionId:command.executionId,artifactSha256:command.artifactSha256};
      next.status='verification_pending';next.lease=null;break;
    case 'review':
      if(next.status!=='verification_pending')throw new Error('Review not pending');
      if(command.role!=='independent-qa'||typeof command.executionId!=='string'||!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(command.executionId)||command.executionId===next.implementation.executionId)throw new Error('Independent execution required');
      if(command.artifactSha256!==next.implementation.artifactSha256||typeof command.accepted!=='boolean')throw new Error('Invalid review evidence');
      next.verification={executionId:command.executionId,accepted:command.accepted,artifactSha256:command.artifactSha256};
      next.status=command.accepted?'verified':next.attempts>=next.maxAttempts?'failed':'verification_failed';break;
    case 'expire':
      if(next.status!=='running'||now<next.lease.expiresAt)throw new Error('Lease has not expired');
      // Outcome may be unknown. Recovery must reconcile before any retry.
      next.status='blocked';next.lease=null;break;
    case 'cancel':next.status='cancelled';next.lease=null;break;
    default:throw new Error('Unsupported transition');
  }
  next.revision++;next.events.push({type:command.type,at:now,revision:next.revision,fence:next.fence});
  return next;
}
module.exports={ROLES,TOOLS,permit,createTask,step};
