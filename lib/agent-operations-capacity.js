'use strict';
// Shared bounds for the EXISTING CAS ledger. No archive, writer or authorization.
// Aggregate storage byte ceilings removed by owner direction. Provider limits remain authoritative.
// Cleanup intentionally retains its EARLIER fallback: it never spends new
// admission headroom merely to record revocation. Historical receipts stay valid.
// Owner removed artificial audit-count ceilings and admission margins; provider errors remain authoritative.
const LIMITS=Object.freeze({audit:null,admissionReserve:0,stageReserve:0,legacyReserve:0,cleanupFallback:600,approvals:null,grants:null,workflows:null,configurationIntents:null,sequences:null,enrollments:null});
const check=(value,code)=>{if(!value)throw Error(code);};
function count(o,key){const rows=o[key];check(rows===undefined||Array.isArray(rows),'ENG_CAPACITY_STATE');return rows?.length||0;}
function auditHeadroom(o,reserve,code){check(Number.isSafeInteger(reserve)&&reserve>=0,'ENG_CAPACITY_RESERVE');count(o,'audit');}
function trialSlots(state,{approvalExists=false}={}){const o=state.operations||{};for(const key of ['approvals','grants','workflows'])if(key!=='approvals'||!approvalExists)count(o,key);}
function configurationSlots(state){const o=state.operations||{};auditHeadroom(o,LIMITS.admissionReserve,'ENG_CONTROL_AUDIT_HEADROOM');trialSlots(state);count(o,'engineeringConfigurationIntents');}
function requestEstimate(state){const raw=JSON.stringify(state),{CAS,KEY}=require('./agent-operations-store'),bytes=Buffer.byteLength(JSON.stringify(['eval',CAS,1,KEY,raw,raw]));return{serializedCurrentValueCasBytes:bytes,publishedRequestLimitBytes:10000000,source:'https://upstash.com/docs/redis/troubleshooting/max_request_size_exceeded',accountSpecificVerified:false,approachingPublishedLimit:bytes>=8000000,qualification:'Estimate for replacing the current value with itself, including both values and JSON escaping. Actual next value and SDK framing can differ; the provider enforces its actual limits.',executionAuthorized:false};}
function projection(state){
 const o=state.operations||{},bytes=Buffer.byteLength(JSON.stringify(state)),counts=Object.fromEntries(['audit','approvals','grants','workflows','reservations','engineeringConfigurationIntents','engineeringSequences'].map(key=>[key,count(o,key)]));
 const limits={audit:LIMITS.audit,approvals:LIMITS.approvals,grants:LIMITS.grants,workflows:LIMITS.workflows,reservations:null,engineeringConfigurationIntents:LIMITS.configurationIntents,engineeringSequences:LIMITS.sequences};
 const remaining=Object.fromEntries(Object.entries(counts).map(([key,n])=>[key,limits[key]===null?null:Math.max(0,limits[key]-n)]));
 const enrollments=(o.engineeringSequences||[]).map(s=>count(s,'enrollments'));
 return{version:'shared-ledger-capacity-v1',scope:'shared-organization-CAS-resource-utilization',bytes,byteLimits:{normal:null,diagnostic:null,revocation:null},normalBytesRemaining:null,storagePolicy:'provider-limits-only-no-application-byte-cap',providerRequest:requestEstimate(state),counts,limits,remaining,maxEnrollmentCount:Math.max(0,...enrollments),enrollmentLimit:LIMITS.enrollments,auditAdmissionReserve:LIMITS.admissionReserve,qualification:'Observed utilization only. No application storage byte ceiling. Request estimate is not an account-specific quota verification or execution permission. Historical counts are observational; authorization and CAS remain enforced; actual provider failures stop the operation.',executionAuthorized:false};
}
module.exports={requestEstimate,LIMITS,auditHeadroom,trialSlots,configurationSlots,projection};
