'use strict';
// Pure operations: invoke only inside the existing organization ledger CAS.
const {createHash}=require('node:crypto');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
const VERSION='engineering-cumulative-sequence-v1',MAX_MICROS=1000000,ATTEMPT_MICROS=1000000;
function records(o){check(o.engineeringSequences===undefined||Array.isArray(o.engineeringSequences),'ENG_SEQUENCE_STORAGE');return o.engineeringSequences||[];}
function binding(c){const b=c.binding;return{ownerHash:b.ownerHash,workspaceHash:b.workspaceHash,runtime:b.runtime,assignmentHash:hash(c.assignment),evidenceHash:hash(c.evidence)};}
function find(o,id){return records(o).find(x=>x.id===id);}
function valid(r){check(r&&r.version===VERSION&&r.maxAttempts===3&&r.maxMicros===MAX_MICROS&&r.attemptMicros===ATTEMPT_MICROS&&['open','stopped'].includes(r.status)&&Number.isSafeInteger(r.createdAt)&&Number.isSafeInteger(r.expiresAt)&&r.expiresAt>r.createdAt&&r.expiresAt<=r.createdAt+3600000&&r.bindingHash===hash(r.binding)&&Array.isArray(r.attempts)&&r.attempts.length<=3&&r.attempts.every((a,i)=>a.attempt===i+1&&/^pilot_[a-f0-9]{32}$/.test(a.approvalId||'')&&/^wf_[a-f0-9]{32}$/.test(a.workflowId||'')&&/^[a-f0-9]{64}$/.test(a.approvalHash||'')&&typeof a.planId==='string'&&Number.isSafeInteger(a.claimedAt))&&new Set(r.attempts.map(a=>a.planId)).size===r.attempts.length&&new Set(r.attempts.map(a=>a.approvalId)).size===r.attempts.length&&new Set(r.attempts.map(a=>a.workflowId)).size===r.attempts.length,'ENG_SEQUENCE_STORAGE');}
function get(o,c,id){const r=find(o,id);valid(r);check(r.bindingHash===hash(binding(c)),'ENG_SEQUENCE_SCOPE');return r;}
function register(o,c,input,now){
 check(input&&Object.keys(input).sort().join(',')==='expiresAt,id'&&/^sequence_[a-f0-9]{32}$/.test(input.id||'')&&Number.isSafeInteger(input.expiresAt)&&input.expiresAt>now&&input.expiresAt<=now+3600000,'ENG_SEQUENCE_INPUT');
 check(!find(o,input.id)&&!records(o).some(r=>r.binding.ownerHash===c.binding.ownerHash&&r.binding.workspaceHash===c.binding.workspaceHash)&&records(o).length<8,'ENG_SEQUENCE_REPLAY_OR_CAPACITY');
 const r={version:VERSION,id:input.id,binding:binding(c),bindingHash:hash(binding(c)),maxAttempts:3,maxMicros:MAX_MICROS,attemptMicros:ATTEMPT_MICROS,expiresAt:input.expiresAt,status:'open',attempts:[],createdAt:now};o.engineeringSequences??=[];o.engineeringSequences.push(r);return view(o,r);
}
function exposure(o,r){const ids=new Set(r.attempts.map(a=>a.workflowId));const rows=o.reservations.filter(x=>ids.has(x.workflowId));check(rows.every(x=>Number.isSafeInteger(x.ceilingMicros)&&x.ceilingMicros>=0),'ENG_SEQUENCE_ACCOUNTING');const n=rows.reduce((n,x)=>n+x.ceilingMicros,0);check(Number.isSafeInteger(n)&&n<=r.maxMicros,'ENG_SEQUENCE_ACCOUNTING');return n;}
function clean(o,a){const approval=(o.approvals||[]).find(x=>x.id===a.approvalId),w=o.workflows.find(x=>x.id===a.workflowId);return approval?.status==='revoked'&&approval.leaseUntil===0&&o.grants.filter(x=>x.approvalId===a.approvalId).every(x=>x.revoked)&&(!w||w.leaseUntil===0&&w.attempts.every(x=>x.closed));}
function view(o,r){valid(r);const retainedMicros=exposure(o,r);return structuredClone({...r,retainedMicros,remainingMicros:r.maxMicros-retainedMicros,executionAuthorized:false,providerHardCap:false});}
function claim(o,c,a,now){const q=a.sequence;check(q&&Object.keys(q).sort().join(',')==='attempt,id','ENG_SEQUENCE_APPROVAL');const r=get(o,c,q.id);check(r.status==='open'&&r.expiresAt>now&&r.attempts.length<3&&q.attempt===r.attempts.length+1&&a.maxMicros===ATTEMPT_MICROS,'ENG_SEQUENCE_LIMIT');
 check(r.attempts.every(x=>clean(o,x)),'ENG_SEQUENCE_CLEANUP');
 check(!r.attempts.some(x=>o.workflows.some(w=>w.id===x.workflowId&&w.status==='verified')),'ENG_SEQUENCE_SUCCEEDED');
 check(r.maxMicros-exposure(o,r)>=ATTEMPT_MICROS,'ENG_SEQUENCE_EXPOSURE');
 check(!o.approvals?.some(x=>['active','consumed'].includes(x.status)&&x.leaseUntil>now),'ENG_SEQUENCE_CONCURRENCY');
 check(!r.attempts.some(x=>x.planId===c.binding.planId||x.approvalId===a.id||x.workflowId===a.workflowId),'ENG_SEQUENCE_REPLAY');
 r.attempts.push({attempt:q.attempt,planId:c.binding.planId,approvalId:a.id,workflowId:a.workflowId,approvalHash:hash(a),claimedAt:now});return view(o,r);
}
function assert(o,c,a,now){const r=get(o,c,a.sequence?.id),entry=r.attempts.find(x=>x.approvalId===a.id);check(r.status==='open'&&r.expiresAt>now&&entry?.approvalHash===hash(a)&&entry.attempt===a.sequence.attempt&&r.attempts.at(-1)===entry,'ENG_SEQUENCE_AUTHORITY');check(exposure(o,r)<=r.maxMicros,'ENG_SEQUENCE_EXPOSURE');return true;}
function stop(o,c,id,now){const r=get(o,c,id);check(r.attempts.every(x=>clean(o,x)),'ENG_SEQUENCE_CLEANUP');r.status='stopped';r.stoppedAt=now;return view(o,r);}
function stopOwned(o,id,ownerHash,workspaceHash,now){const r=find(o,id);valid(r);check(r.binding.ownerHash===ownerHash&&r.binding.workspaceHash===workspaceHash,'ENG_SEQUENCE_SCOPE');check(r.attempts.every(x=>clean(o,x)),'ENG_SEQUENCE_CLEANUP');if(r.status!=='stopped'){r.status='stopped';r.stoppedAt=now;}return view(o,r);}
module.exports={VERSION,MAX_MICROS,ATTEMPT_MICROS,register,get,view,claim,assert,stop,stopOwned,valid};
