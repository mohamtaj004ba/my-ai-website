'use strict';
// Retain classifications and digests, never guest output or exception messages.
const {createHash}=require('node:crypto'),errors=new WeakMap();
const digest=s=>createHash('sha256').update(s).digest('hex');
const PHASES=new Set(['provider-stream','provider-result','private-mounts','minimal-jail','trusted-inputs','child-qualification','exit-classification','timeout','starter','visible-time']);
const SOURCE_CODES=new Set(['SOURCE_ISOLATION_QUALIFICATION_FAILED','SOURCE_TEST_EXIT_CLASSIFICATION_FAILED','SOURCE_TEST_TIMEOUT_FAILED','SOURCE_TEST_DESCENDANT_CLEANUP_FAILED','SOURCE_TEST_PROCESS_STATE_UNCONFIRMED','SOURCE_TEST_HASH_FAILED','SOURCE_STARTER_TESTS_FAILED','SOURCE_VISIBLE_TIME_TESTS_FAILED','SOURCE_TEST_PROTECTED_INTEGRITY_FAILED','SOURCE_ISOLATION_SETUP_FAILED','SOURCE_GUEST_CLEANUP_FAILED']);
const CLASSES=new Set(['permission-denied','not-found','syntax-error','runtime-reference','setup-failure','unknown','none']);
function sanitize(value){
 const out={version:'source-test-diagnostic-v1',phase:PHASES.has(value?.phase)?value.phase:'provider-result'};
 for(const k of ['stdoutBytes','stderrBytes'])if(Number.isSafeInteger(value?.[k])&&value[k]>=0&&value[k]<=128000)out[k]=value[k];
 for(const k of ['stdoutHash','stderrHash'])if(/^[a-f0-9]{64}$/.test(value?.[k]||''))out[k]=value[k];
 if(Number.isInteger(value?.exitCode)&&value.exitCode>=-255&&value.exitCode<=255)out.exitCode=value.exitCode;
 if(/^cmd_[a-f0-9]{1,100}$/.test(value?.commandId||''))out.commandId=value.commandId;
 if(CLASSES.has(value?.stderrClass))out.stderrClass=value.stderrClass;
 if(SOURCE_CODES.has(value?.sourceCode))out.sourceCode=value.sourceCode;
 if(Number.isInteger(value?.setupStatus)&&value.setupStatus>=0&&value.setupStatus<=255)out.setupStatus=value.setupStatus;
 if(typeof value?.guestCleanupConfirmed==='boolean')out.guestCleanupConfirmed=value.guestCleanupConfirmed;
 return out;
}
function fromOutcome(job,result){
 const text=typeof result?.stdout==='string'?result.stdout:'';
 const base=sanitize(result?.diagnostic);
 delete base.sourceCode;delete base.setupStatus;delete base.guestCleanupConfirmed;
 const out={...base,phase:'provider-result',exitCode:result?.exitCode,stdoutBytes:Buffer.byteLength(text),stdoutHash:digest(text)};
 try{if(Buffer.byteLength(text)>16000)return sanitize(out);const dispatch=require('./agent-operations-source-test-dispatch'),visible=job.manifest.version===dispatch.VISIBLE_PROFILE,r=JSON.parse(visible?dispatch.decodeResult(text,{version:dispatch.VISIBLE_PROFILE}):text);if(r.version==='source-isolated-runner-result-v1'&&r.mode===(visible?'visible-time':'starter')&&r.programSha256===job.manifest.commandHash){
  if(PHASES.has(r.phase))out.phase=r.phase;
  out.sourceCode=r.code;out.setupStatus=r.setupStatus;out.guestCleanupConfirmed=r.cleanupConfirmed;
 }}catch{}
 return sanitize(out);
}
function attach(error,value){errors.set(error,sanitize(value));return error;}
function forError(error){const d=errors.get(error);return d?structuredClone(d):null;}
module.exports={sanitize,fromOutcome,attach,forError};
