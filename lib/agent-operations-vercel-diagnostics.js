'use strict';
// Private, finite observations of trusted code. Never accepts provider/error data
// as a diagnostic record or supplies authorization, return values or credentials.
const records=new WeakMap(),trustedErrors=new WeakMap();
const CODES=new Set(['VCO_PREVIEW_REQUIRED','VCO_OWNER_REQUIRED','VCO_STORE_INVALID','VCO_CONFIGURATION_REQUIRED','VCO_RESOURCE_DENIED','VCO_TASK_REQUIRED','VCO_CONNECTION_DENIED','VCO_CANCELLED','VCO_STALE','VCO_PROVIDER_SCOPE_DENIED','VCO_SCOPE_FORMAT_UNCONFIRMED','VCO_RESPONSE_INVALID','VCO_HTTP_401','VCO_HTTP_403','VCO_HTTP_429','VCO_HTTP_5XX','VCO_HTTP_OTHER','VC_CONFIGURATION_REQUIRED','VC_REQUEST_DENIED','VC_CANCELLED_OR_TIMEOUT','VC_AUTHORITY_DENIED','VC_CREDENTIAL_SCOPE_DENIED','VC_TRANSPORT_DENIED','INT_CONNECTION_UNAVAILABLE','INT_PERMISSION_DENIED','INT_TASK_STALE','INT_RECEIPT_REVOKED','INT_RECEIPT_BINDING']);
const PHASES=Object.freeze(['ops-authorize','connection-status','credential-broker','broker-owner','broker-record','broker-task','broker-recheck','credential-open','configuration-read','configuration-http','adapter-authorize','adapter-lease','deployment-read','deployment-http','final-connection','receipt-commit']);
function create(clock=Date.now,startedAt=clock()){const capability=Object.freeze({});records.set(capability,{clock,startedAt,active:[],events:[],failures:[],sealed:null});return capability;}
const elapsed=(r,at)=>Math.max(0,Math.min(30000,Math.trunc(r.clock()-at)||0));
async function span(capability,phase,operation){
 const r=records.get(capability);if(!r)return operation();if(!PHASES.includes(phase))throw Error('VC_DIAGNOSTIC_PHASE_INVALID');
 const item={phase,at:r.clock()};if(!r.sealed&&r.active.length<32)r.active.push(item);let outcome='unconfirmed';
 try{const result=await operation();outcome=result instanceof Response&&result.ok===false?([401,403,429].includes(result.status)?'http-'+result.status:result.status>=500&&result.status<=599?'http-5xx':'http-other'):'completed';return result;}
 finally{if(!r.sealed){const i=r.active.indexOf(item);if(i>=0)r.active.splice(i,1);if(r.events.length<64)r.events.push(Object.freeze({phase,elapsedMs:elapsed(r,item.at),outcome}));}}
}
function error(code){const value=Error(code);if(CODES.has(code))trustedErrors.set(value,code);return value;}
function recordError(capability,value){const r=records.get(capability);if(!r||r.sealed||r.failures.length>=4)return;const code=trustedErrors.get(value);r.failures.push(code||'VC_UNCLASSIFIED');}
function seal(capability){const r=records.get(capability);if(!r)return null;if(!r.sealed)r.sealed=Object.freeze({version:'vercel-phase-diagnostics-v1',adapterDeadlineMs:6000,admissionDeadlineMs:10000,totalElapsedMs:elapsed(r,r.startedAt),activePhases:Object.freeze(r.active.map(x=>x.phase).slice(0,16)),events:Object.freeze([...r.events]),failures:Object.freeze([...r.failures])});return r.sealed;}
module.exports={create,span,seal,error,recordError,PHASES};
