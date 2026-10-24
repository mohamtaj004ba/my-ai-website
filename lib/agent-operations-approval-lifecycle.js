'use strict';
// Pure ledger operations. Call only inside the shared authorization/spending CAS.
const {createHash,randomBytes,timingSafeEqual}=require('node:crypto');
const VERSION='durable-approval-v1',LEASE_MS=30000,ENGINEERING_LEASE_MS=60000;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const digest=v=>createHash('sha256').update(String(v)).digest('hex');
const check=(v,m)=>{if(!v)throw Error(m);};
// A pending Starter implementation is a serial paid boundary, never a retry pool.
function assertStarterSerial(o,approvalId,starter=false){
 const activeStarter=records(o).filter(r=>r.id!==approvalId&&['owner-starter-disposable-patch-once-v1','owner-phase-d-engineering-4usd-v1'].includes(r.engineeringScope?.uncertainAuthorizationId)&&['prepared','active','consumed'].includes(r.status));
 check(!(o.workflows||[]).some(w=>w.mode==="pilot"&&!require("./agent-operations-engineering-configuration").physicalWorkflowClean(w)),"ENG_IMPLEMENTATION_CLEANUP");
 if(!starter&&!activeStarter.length)return true;
 check(!activeStarter.length,'ENG_IMPLEMENTATION_SERIAL');
 check(!records(o).some(r=>r.id!==approvalId&&['active','consumed'].includes(r.status)),'ENG_IMPLEMENTATION_SERIAL');
 check(!(o.grants||[]).some(g=>g.mode==='pilot'&&g.approvalId!==approvalId&&!g.revoked),'ENG_IMPLEMENTATION_SERIAL');
 check(!(o.workflows||[]).some(w=>w.mode==='pilot'&&w.approvalId!==approvalId&&(w.leaseUntil!==0||(w.attempts||[]).some(a=>!a.closed)||['running','assigned'].includes(w.status))),'ENG_IMPLEMENTATION_SERIAL');
 return true;
}
function shape(a){return a?.lifecycleVersion===VERSION&&/^wf_[a-f0-9]{32}$/.test(a.workflowId||'')&&/^[a-f0-9]{40}$/.test(a.sourceCommit||'');}
function records(o){check(o.approvals===undefined||Array.isArray(o.approvals),'Approval registry malformed');return o.approvals||[];}
function find(o,a){return records(o).find(r=>r.id===a?.id);}
function verified(o,a,runtime,now,{initializing=false}={}){
 const r=find(o,a);return !!(shape(a)&&r&&r.approvalHash===hash(a)&&r.workflowId===a.workflowId&&r.status===(initializing?'active':'consumed')&&r.expiresAt>now&&r.leaseUntil>now&&runtime?.origin===r.deploymentOrigin&&runtime?.commit===r.sourceCommit&&r.contractHash===a.contractHash&&r.contractVersion===a.contractVersion);
}
function prepare(o,a,actor,now,{capacity=32}={}){
 check(capacity===32||capacity===52&&(['owner-expanded-engineering-5usd-v1','owner-phase-d-engineering-4usd-v1'].includes(a?.countPricing?.authorizationId)&&a.sequence||require('./agent-operations-engineering-provider-v2').trialFor(a)===require('./agent-operations-engineering-provider-v2').STARTER_TRIAL&&!a.sequence),'Approval registry capacity authority');
 check(shape(a)&&actor?.kind==='owner'&&actor.verifiedOwner===true&&digest(actor.id)===a.ownerHash,'Approval owner required');
 check(!find(o,a),'Approval id already used');check(!records(o).some(r=>r.workflowId===a.workflowId)&&!o.workflows.some(w=>w.id===a.workflowId),'Task id already used');
 const token=randomBytes(32).toString('hex'),r={id:a.id,version:VERSION,workflowId:a.workflowId,approvalHash:hash(a),ownerHash:a.ownerHash,contractHash:a.contractHash,contractVersion:a.contractVersion,expiresAt:a.expiresAt,status:'prepared',revision:1,leaseUntil:0,revokeHash:digest(token),events:[{type:'prepared',at:now}]};
 o.approvals??=[];o.approvals.push(r);return {record:publicRecord(r),revocationToken:token};
}
function publicRecord(r){const {revokeHash,ownerHash,...rest}=r;return structuredClone(rest);}
function owner(r,actor){check(actor?.kind==='owner'&&actor.verifiedOwner===true&&digest(actor.id)===r.ownerHash,'Approval owner required');}
function leaseDuration(a){return a?.profile==='engineering-proposal-only-v2'||a?.engineeringScope?.profile==='engineering-proposal-only-v2'?ENGINEERING_LEASE_MS:LEASE_MS;}
function activate(o,a,actor,runtime,now,expectedRevision){assertStarterSerial(o,a.id,['owner-starter-disposable-patch-once-v1','owner-phase-d-engineering-4usd-v1'].includes(a.countPricing?.authorizationId));const r=find(o,a);check(r,'Approval not prepared');owner(r,actor);check(shape(a)&&r.approvalHash===hash(a)&&r.status==='prepared'&&r.revision===expectedRevision&&r.expiresAt>now,'Approval activation denied');check(/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(runtime?.origin||'')&&runtime?.commit===a.sourceCommit,'Deployment identity required');r.deploymentOrigin=runtime.origin;r.sourceCommit=runtime.commit;r.status='active';r.leaseUntil=Math.min(now+leaseDuration(a),r.expiresAt);r.revision++;r.events.push({type:'activated',at:now});return publicRecord(r);}
function control(o,id,actor,now,{type,token}={}){let r=records(o).find(r=>r.id===id);if(!r){check(type==='revoke'&&!token&&actor?.kind==='owner'&&actor.verifiedOwner===true&&/^pilot_[A-Za-z0-9_-]{8,60}$/.test(id),'Approval missing');o.approvals??=[];r={id,version:VERSION,ownerHash:digest(actor.id),status:'prepared',revision:0,expiresAt:0,leaseUntil:0,revokeHash:digest(randomBytes(32).toString('hex')),events:[]};o.approvals.push(r);}if(type==='revoke'&&typeof token==='string'){check(/^[a-f0-9]{64}$/.test(token)&&timingSafeEqual(Buffer.from(digest(token)),Buffer.from(r.revokeHash)),'Revocation capability denied');}else owner(r,actor);
 if(type==='renew'){check(['active','consumed'].includes(r.status)&&r.expiresAt>now&&r.leaseUntil>now,'Approval renewal denied');r.leaseUntil=Math.min(now+leaseDuration(r),r.expiresAt);r.revision++;return publicRecord(r);}
 check(type==='revoke','Approval control denied');return retire(o,id,now);
}
function retire(o,id,now){const r=records(o).find(r=>r.id===id);if(!r)return null;const alreadyRevoked=r.status==='revoked';let changed=r.leaseUntil!==0,grants=0,workflows=0;
 if(!alreadyRevoked){r.status='revoked';r.revision++;r.events.push({type:'revoked',at:now});}r.leaseUntil=0;
 // Revocation remains a downscope operation even after an earlier acknowledgment.
 // Never rewrite terminal findings, financial evidence or physical-cleanup facts.
 for(const g of o.grants.filter(g=>g.approvalId===id))if(g.revoked!==true){g.revoked=true;g.revision++;grants++;changed=true;}
 for(const w of o.workflows.filter(w=>w.approvalId===id)){let dirty=w.leaseUntil!==0;
  if(!['verified','rejected','failed','blocked','cancelled'].includes(w.status)){w.status='cancelled';w.outcomes.acceptedWork=false;w.outcomes.finalAcceptance='cancelled';dirty=true;}
  w.leaseUntil=0;
  if(w.profile==='engineering-proposal-only-v2'&&Array.isArray(w.attempts))for(const attempt of w.attempts)if(attempt.closed!==true){attempt.closed=true;attempt.cancelledAt=now;dirty=true;}
  if(dirty){w.revision++;workflows++;changed=true;}
 }
 if(alreadyRevoked&&changed){r.revision++;r.events.push({type:'revocation-reconciled',at:now,grants,workflows});}
 return publicRecord(r);
}
function consume(o,a,runtime,now){check(verified(o,a,runtime,now,{initializing:true}),'Durable approval unavailable');const r=find(o,a);r.status='consumed';r.revision++;r.events.push({type:'initialized',at:now});}
module.exports={assertStarterSerial,VERSION,LEASE_MS,ENGINEERING_LEASE_MS,shape,records,find,verified,prepare,activate,control,consume,retire,publicRecord};
