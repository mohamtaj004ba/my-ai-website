'use strict';
// Shared bounds for the EXISTING CAS ledger. No archive, writer or authorization.
// At most 424 additional audit rows, still inside the original byte ceilings.
// Cleanup intentionally retains its EARLIER fallback: it never spends new
// admission headroom merely to record revocation. Historical receipts stay valid.
const LIMITS=Object.freeze({audit:1024,admissionReserve:64,stageReserve:20,legacyReserve:2,cleanupFallback:600,normalBytes:990000,diagnosticBytes:1000000,revocationBytes:1010000,approvals:52,grants:52,workflows:36,configurationIntents:20,sequences:8,enrollments:10});
const check=(value,code)=>{if(!value)throw Error(code);};
function count(o,key){const rows=o[key];check(rows===undefined||Array.isArray(rows),'ENG_CAPACITY_STATE');return rows?.length||0;}
function auditHeadroom(o,reserve,code){check(Number.isSafeInteger(reserve)&&reserve>=0&&reserve<=LIMITS.audit,'ENG_CAPACITY_RESERVE');check(count(o,'audit')+reserve<=LIMITS.audit,code);}
function trialSlots(state,{approvalExists=false}={}){const o=state.operations||{};for(const key of ['approvals','grants','workflows'])if(key!=='approvals'||!approvalExists)check(count(o,key)<LIMITS[key],'ENG_CONTROL_REGISTRY_CAPACITY');check(Buffer.byteLength(JSON.stringify(state))<LIMITS.normalBytes,'ENG_CONTROL_LEDGER_CAPACITY');}
function configurationSlots(state){const o=state.operations||{};auditHeadroom(o,LIMITS.admissionReserve,'ENG_CONTROL_AUDIT_HEADROOM');trialSlots(state);check(count(o,'engineeringConfigurationIntents')<LIMITS.configurationIntents,'ENG_CONFIG_STORAGE');}
function projection(state){
 const o=state.operations||{},bytes=Buffer.byteLength(JSON.stringify(state)),counts=Object.fromEntries(['audit','approvals','grants','workflows','reservations','engineeringConfigurationIntents','engineeringSequences'].map(key=>[key,count(o,key)]));
 const limits={audit:LIMITS.audit,approvals:LIMITS.approvals,grants:LIMITS.grants,workflows:LIMITS.workflows,reservations:null,engineeringConfigurationIntents:LIMITS.configurationIntents,engineeringSequences:LIMITS.sequences};
 const remaining=Object.fromEntries(Object.entries(counts).map(([key,n])=>[key,limits[key]===null?null:Math.max(0,limits[key]-n)]));
 const enrollments=(o.engineeringSequences||[]).map(s=>count(s,'enrollments'));
 return{version:'shared-ledger-capacity-v1',scope:'shared-organization-CAS-resource-utilization',bytes,byteLimits:{normal:LIMITS.normalBytes,diagnostic:LIMITS.diagnosticBytes,revocation:LIMITS.revocationBytes},normalBytesRemaining:Math.max(0,LIMITS.normalBytes-bytes),counts,limits,remaining,maxEnrollmentCount:Math.max(0,...enrollments),enrollmentLimit:LIMITS.enrollments,auditAdmissionReserve:LIMITS.admissionReserve,qualification:'Observed utilization only, not reserved capacity or a worst-case artifact storage proof. Concurrent writes may invalidate it; every CAS retains its byte and count checks.',executionAuthorized:false};
}
module.exports={LIMITS,auditHeadroom,trialSlots,configurationSlots,projection};
