'use strict';
// Closed vocabulary only: never retain exception messages, model text or arbitrary keys.
const VERSION='engineering-failure-v1';
const ACTIVATION_STOPS=Object.freeze({'external-signal':'ENG_ACTIVATION_CANCELLED','operation-timeout':'ENG_ACTIVATION_TIMEOUT','renewal-timeout':'ENG_ACTIVATION_RENEW_TIMEOUT','renewal-error':'ENG_ACTIVATION_RENEW_FAILED'});
function activationReason(value){if(!value||typeof value!=='object'||!['code,origin,version','code,origin,renewal,version'].includes(Object.keys(value).sort().join(','))||value.version!=='engineering-activation-stop-v1'||!Object.hasOwn(ACTIVATION_STOPS,value.origin)||value.code!==ACTIVATION_STOPS[value.origin])return null;const renewal=value.origin.startsWith('renewal-')?require('./agent-operations-renewal-diagnostic').sanitize(value.renewal):null;return{authorityOrigin:value.origin,authorityCode:value.code,...(renewal?{renewal}:{})};}
const PHASES=new Set(['admission','authority','count-fetch','count-body','count-validate','count-record','dispatch','response-fetch','response-body','response-validate','workspace-prepare','finish']);
const STAGES=new Set(['chief-plan','specialist','qa','auditor','chief-final']);
const CODES=new Set(('ENG_TRANSPORT_RESPONSE ENG_TRANSPORT_USAGE ENG_TRANSPORT_OUTPUT ENG_TRANSPORT_COST ENG_TRANSPORT_BODY ENG_TRANSPORT_SECRET_ECHO ENG_TRANSPORT_HTTP ENG_TRANSPORT_COUNT_HTTP ENG_TRANSPORT_COUNT ENG_TRANSPORT_COUNT_PROVENANCE ENG_TRANSPORT_COUNT_USAGE ENG_TRANSPORT_REVOKED ENG_TRANSPORT_PAID_DISABLED ENG_TRANSPORT_SCOPE ENG_TRANSPORT_SOURCE ENG_TRANSPORT_ORDER ENG_TRANSPORT_PRIOR ENG_TRANSPORT_PARSE_PROVENANCE ENG_TRANSPORT_RESERVATION ENG_TRANSPORT_CAPABILITY ENG_TRANSPORT_COUNT_POLICY_CHANGED ENG_AI_RESPONSE_SCHEMA ENG_AI_OUTPUT_LIMIT ENG_AI_EVIDENCE_REFERENCE ENG_AI_FINDING_IDS ENG_AI_PROPOSAL_PREIMAGE ENG_AI_PROPOSAL_DENIED ENG_AI_QA_COMPLETENESS ENG_AI_UNRELATED_EVIDENCE ENG_AI_FINAL_AUTHORITY ENG_AI_FINAL_QA_CHANGED').split(' '));
for(const code of ["IMPLEMENTATION_AMBIGUOUS_JSON","IMPLEMENTATION_BINDING","IMPLEMENTATION_BOUNDS","IMPLEMENTATION_CONTRACT","IMPLEMENTATION_CRITERIA","IMPLEMENTATION_EDITS","IMPLEMENTATION_EVIDENCE","IMPLEMENTATION_FORBIDDEN_SOURCE","IMPLEMENTATION_JSON","IMPLEMENTATION_NO_CHANGE","IMPLEMENTATION_REPLACEMENT_GRAMMAR","IMPLEMENTATION_REPORT","IMPLEMENTATION_SCOPE","IMPLEMENTATION_SOURCE","IMPLEMENTATION_TEXT","ENG_IMPLEMENTATION_SCOPE","ENG_IMPLEMENTATION_SOURCE","ENG_IMPLEMENTATION_ARTIFACT","ENG_IMPLEMENTATION_WORKSPACE","DRAFT_AUTHORITATIVE_SOURCE_CHANGED","DRAFT_AUTHORITY_DENIED","DRAFT_BOUNDS","DRAFT_CANCELLED","DRAFT_CHILD_DENIED","DRAFT_CLEANUP_FAILED","DRAFT_INPUT_DENIED","DRAFT_LIMITS","DRAFT_OUTPUT_BOUNDS","DRAFT_PROPOSAL_AUTHORITY_DENIED","DRAFT_PROPOSAL_AUTHORITY_REQUIRED","DRAFT_PROPOSAL_BINDING","DRAFT_PROPOSAL_DENIED","DRAFT_PROPOSAL_EDIT","DRAFT_RESULT_INVALID","DRAFT_SOURCE_BINDING","DRAFT_SOURCE_DRIFT","DRAFT_START_FAILED","DRAFT_TIMEOUT"])CODES.add(code);
for(const code of ['ENG_TEST_BINDING','ENG_TEST_PROPOSAL','ENG_TEST_MANIFEST','ENG_TEST_COMMAND','ENG_TEST_PERMISSION','ENG_TEST_UNAVAILABLE','ENG_TEST_CANCELLED','ENG_TEST_REVOKED','ENG_TEST_SERIAL','ENG_TEST_PROVIDER_AUTH','ENG_TEST_PROVIDER_HTTP','ENG_TEST_PROVIDER_RESULT','ENG_TEST_PROVIDER_SCOPE','ENG_TEST_RESULT_BINDING','ENG_TEST_RESULT_ORDER','ENG_TEST_ISOLATION','ENG_TEST_TERMINATION','ENG_TEST_FAILED','ENG_TEST_SHUTDOWN','ENG_TEST_PROVIDER_UNCONFIRMED','ENG_TEST_JOURNAL_UNCONFIRMED'])CODES.add(code);
CODES.add('ENG_IMPLEMENTATION_SERIAL');
CODES.add('DRAFT_AUTHORITY_TIMEOUT');
CODES.add('ENG_IMPLEMENTATION_CLEANUP_RECORD');
CODES.add('ENG_TRANSPORT_INPUT');
CODES.add('ENG_AI_RESPONSE_PLACEHOLDER');
CODES.add('ENG_AI_REPORT_QUALITY');
const CATEGORIES=new Set(['validation','provider-http','timeout','cancelled','authority','persistence','network','unknown']);
// Closed classifications only; no finding IDs, counts or rejected text are logged.
const MISMATCHES=new Set(['invalid-json','type','required-or-additional-property','enum','pattern','array-bounds','envelope','usage','output-shape','evidence-reference','evidence-duplicate','evidence-unknown','evidence-required','proposal-preimage','proposal-denied','placeholder','incomplete-criterion','criteria-coverage','numeric-bounds','unknown']);
MISMATCHES.add('incomplete-statement');
const COPY_RULES=Object.freeze({'proposal-markup':'proposal-copy-markup-v1','proposal-nul':'proposal-copy-nul-v1','proposal-url':'proposal-copy-url-v1','proposal-bearer':'proposal-copy-bearer-v1','proposal-key-prefix':'proposal-copy-key-prefix-v1','proposal-label-contract':'proposal-copy-label-v2'});
MISMATCHES.add('finding-count');MISMATCHES.add('finding-duplicate');MISMATCHES.add('evidence-unrelated');
const STATUS=new Set(['completed','incomplete','failed','cancelled','queued','in_progress']);
const REASONS=new Set(['max_output_tokens','content_filter','steered']);
// Paths are supplied by our schema, not by model-controlled property names.
function schemaIssue(schema,value,path='$',depth=0){
 if(depth>8)return{location:'$',mismatch:'unknown'};
 const type=Array.isArray(value)?'array':value===null?'null':typeof value;
 if(schema.type==='integer'?!Number.isSafeInteger(value):schema.type!==type)return{location:path,mismatch:'type'};
 if((schema.type==='integer'||schema.type==='number')&&(!Number.isFinite(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))return{location:path,mismatch:'numeric-bounds'};
 if(schema.enum&&!schema.enum.includes(value))return{location:path,mismatch:'enum'};
 if(type==='object'){
  if(Object.keys(value).length!==schema.required.length||schema.required.some(k=>!Object.hasOwn(value,k)))return{location:path,mismatch:'required-or-additional-property'};
  for(const k of schema.required){const issue=schemaIssue(schema.properties[k],value[k],path+'.'+k,depth+1);if(issue)return issue;}
 }
 if(type==='array'){
  if(value.length<(schema.minItems??0)||value.length>(schema.maxItems??Infinity))return{location:path,mismatch:'array-bounds'};
  for(let i=0;i<value.length;i++){const issue=schemaIssue(schema.items,value[i],path+'['+i+']',depth+1);if(issue)return issue;}
 }
 if(type==='string'&&schema.pattern&&!new RegExp(schema.pattern).test(value))return{location:path,mismatch:'pattern'};
 return null;
}
function artifactIssue(stage,text,c){
 let value;try{value=JSON.parse(text);}catch{return{location:'$',mismatch:'invalid-json'};}
 return schemaIssue(require('./agent-operations-proposal-copy').schema(stage,require('./agent-operations-engineering-inference').schema(stage),c),value)||{location:'$',mismatch:'unknown'};
}
function sanitize(value){
 const out={version:VERSION,stage:STAGES.has(value?.stage)?value.stage:'unknown',phase:PHASES.has(value?.phase)?value.phase:'admission',category:CATEGORIES.has(value?.category)?value.category:'unknown',code:CODES.has(value?.code)||['ENG_FAILURE_UNKNOWN','ENG_FAILURE_TIMEOUT','ENG_FAILURE_CANCELLED','ENG_FAILURE_AUTHORITY','ENG_FAILURE_BODY_JSON'].includes(value?.code)?value.code:'ENG_FAILURE_UNKNOWN'};
 if(Object.hasOwn(ACTIVATION_STOPS,value?.authorityOrigin)&&value.authorityCode===ACTIVATION_STOPS[value.authorityOrigin]){out.authorityOrigin=value.authorityOrigin;out.authorityCode=value.authorityCode;if(value.authorityOrigin.startsWith('renewal-')){const renewal=require('./agent-operations-renewal-diagnostic').sanitize(value.renewal);if(renewal)out.renewal=renewal;}}
 if(out.phase==='workspace-prepare'&&out.code.startsWith('ENG_TEST_')&&value?.sourceTest)out.sourceTest=require('./agent-operations-source-test-diagnostic').sanitize(value.sourceTest);
 // Schema-derived path grammar has only known field names and small indices.
 const fields='stage|objective|specialist|completionCriteria|reason|findings|id|claim|classification|evidenceIds|uncertainty|proposal|path|beforeText|afterText|decisions|findingId|decision|risks|summary|qaDecision|auditDecision|acceptedWork|problem|sourceEvidenceIds|intendedImpact|assessment|basis|scope|exclusions|deliverables|rootCause|analysis|expectedImpact|regressionRisks|affectedInterfaces|verificationStrategy|remainingUncertainty|version|profile|binding|ownerHash|workspaceHash|taskId|executionId|sourceCommit|deploymentId|origin|releaseHash|contextHash|beforeSha256|edits|expectedBehavior|verification|acceptanceMapping|criterion|status|explanation';
 if(typeof value?.location==='string'&&value.location.length<=200&&new RegExp('^\\$(?:\\.(?:'+fields+')|\\[[0-9]\\])*$').test(value.location))out.location=value.location;
 if(MISMATCHES.has(value?.mismatch))out.mismatch=value.mismatch;
 if(out.code.startsWith('IMPLEMENTATION_')&&value?.mismatch===out.code){out.mismatch='proposal-denied';out.ruleId=out.code.toLowerCase().replaceAll('_','-')+'-v1';out.classification='implementation-contract';}
 // Derive metadata from a closed rule map, never caller-supplied rule labels.
 if(out.code==='ENG_AI_PROPOSAL_DENIED'&&Object.hasOwn(COPY_RULES,value?.mismatch)&&out.stage==='specialist'&&out.phase==='response-validate'){
  out.location='$.proposal.afterText';out.mismatch=value.mismatch;out.ruleId=COPY_RULES[value.mismatch];out.classification='content-policy';
 }
 if(out.phase==='workspace-prepare'&&out.code.startsWith('DRAFT_')&&['before-authority','worker','after-authority','artifact-validation'].includes(value?.draftPhase))out.draftPhase=value.draftPhase;
 if(out.phase==='workspace-prepare'&&out.code==='ENG_IMPLEMENTATION_CLEANUP_RECORD'){out.draftPhase='cleanup-record';out.category='persistence';}
 for(const k of ['requestAttempted','countRequestAttempted','billingExposurePossible'])out[k]=value?.[k]===true;
 return out;
}
function failure(error,{stage,phase,stopReason,authorityReason,providerStarted,countStarted,mode}={}){
 const code=CODES.has(error?.message)?error.message:error instanceof SyntaxError&&['response-body','count-body'].includes(phase)?'ENG_FAILURE_BODY_JSON':stopReason==='timeout'?'ENG_FAILURE_TIMEOUT':stopReason==='authority'?'ENG_FAILURE_AUTHORITY':stopReason==='cancelled'?'ENG_FAILURE_CANCELLED':'ENG_FAILURE_UNKNOWN';
 const category=stopReason==='timeout'?'timeout':stopReason==='authority'?'authority':stopReason==='cancelled'?'cancelled':code.endsWith('_HTTP')?'provider-http':code==='ENG_TRANSPORT_INPUT'?'validation':phase==='finish'?'persistence':phase==='authority'?'authority':['response-fetch','count-fetch'].includes(phase)?'network':['response-validate','count-validate','response-body','count-body'].includes(phase)?'validation':'unknown';
 const mismatches={ENG_TRANSPORT_RESPONSE:'envelope',ENG_TRANSPORT_USAGE:'usage',ENG_TRANSPORT_OUTPUT:'output-shape',ENG_AI_EVIDENCE_REFERENCE:'evidence-reference',ENG_AI_PROPOSAL_PREIMAGE:'proposal-preimage',ENG_AI_PROPOSAL_DENIED:'proposal-denied',ENG_FAILURE_BODY_JSON:'invalid-json'};
 return sanitize({stage,phase,category:code==='DRAFT_AUTHORITY_TIMEOUT'||code==='DRAFT_TIMEOUT'?'timeout':code==='DRAFT_CANCELLED'?'cancelled':category,code,...(stopReason==='cancelled'?activationReason(authorityReason):null),sourceTest:require('./agent-operations-source-test-diagnostic').forError(error),draftPhase:error?.draftPhase,location:error?.validationIssue?.location,mismatch:error?.validationIssue?.mismatch||mismatches[code],requestAttempted:providerStarted,countRequestAttempted:countStarted,billingExposurePossible:mode==='pilot'&&(providerStarted||countStarted)});
}
function responseFacts(raw){
 const out={modelMatches:raw?.model==='gpt-6.1-sol',serviceTierMatches:raw?.service_tier==='default',errorPresent:raw?.error!=null};if(STATUS.has(raw?.status))out.responseStatus=raw.status;
 if(REASONS.has(raw?.incomplete_details?.reason))out.incompleteReason=raw.incomplete_details.reason;
 if(Array.isArray(raw?.output)&&raw.output.length<=10){out.outputItems=raw.output.length;out.messageItems=raw.output.filter(x=>x?.type==='message').length;out.reasoningItems=raw.output.filter(x=>x?.type==='reasoning').length;out.refusalDetected=raw.output.some(x=>Array.isArray(x?.content)&&x.content.some(c=>c?.type==='refusal'));}
 return out;
}
function safeFacts(facts){
 const out={};for(const k of ['httpStatus','countHttpStatus','countInputTokens','elapsedMs','inputTokens','outputTokens','reasoningTokens','cachedInputTokens','cacheWriteTokens'])if(Number.isSafeInteger(facts?.[k])&&facts[k]>=0)out[k]=facts[k];
 for(const k of ['responseHash','countResponseHash'])if(/^[a-f0-9]{64}$/.test(facts?.[k]||''))out[k]=facts[k];
 if(/^resp_[A-Za-z0-9_-]{1,160}$/.test(facts?.providerId||''))out.providerId=facts.providerId;
 if(/^req_[A-Za-z0-9_-]{1,100}$/.test(facts?.providerRequestId||''))out.providerRequestId=facts.providerRequestId;
 if(STATUS.has(facts?.responseStatus))out.responseStatus=facts.responseStatus;
 if(REASONS.has(facts?.incompleteReason))out.incompleteReason=facts.incompleteReason;
 for(const k of ['outputItems','messageItems','reasoningItems'])if(Number.isSafeInteger(facts?.[k])&&facts[k]>=0&&facts[k]<=10)out[k]=facts[k];
 for(const k of ['refusalDetected','modelMatches','serviceTierMatches','errorPresent'])if(typeof facts?.[k]==='boolean')out[k]=facts[k];
 if(typeof facts?.workspaceCleanupConfirmed==='boolean')out.workspaceCleanupConfirmed=facts.workspaceCleanupConfirmed;
 return out;
}
// Fixed metadata GET diagnostics share the existing failure vocabulary boundary.
// They are never Responses usage, a credential dump, or an execution grant.
const METADATA_VERSION='engineering-model-metadata-diagnostic-v1';
const METADATA_PHASES=new Set(['credential-preflight','owner-preflight','provider-request','provider-body','provider-shape','owner-revalidation','audit-commit','after-audit']);
const METADATA_CODES=new Set(['credential-configuration','provider-http','provider-network','provider-body','provider-shape','timeout','cancelled','authority','persistence','unconfirmed']);
const metadataErrors=new WeakMap(),metadataHash=x=>require('node:crypto').createHash('sha256').update(JSON.stringify(x)).digest('hex');
function metadataDiagnostic(c,facts,now){
 if(!/^metadata_[a-f0-9]{32}$/.test(facts.probeId||''))throw Error('ENG_CONTROL_METADATA_DIAGNOSTIC');
 const body={version:METADATA_VERSION,probeId:facts.probeId,stage:'model-metadata',phase:METADATA_PHASES.has(facts.phase)?facts.phase:'owner-preflight',code:METADATA_CODES.has(facts.code)?facts.code:'unconfirmed',model:'gpt-6.1-sol',taskId:c.binding.planId,ownerHash:c.binding.ownerHash,workspaceHash:c.binding.workspaceHash,sourceCommit:c.binding.runtime.sourceCommit,deploymentId:c.binding.runtime.deploymentId,releaseHash:c.binding.runtime.release.digest,bindingHash:metadataHash(c.binding),evidenceHash:metadataHash(c.evidence),at:now,elapsedMs:Number.isFinite(facts.elapsedMs)?Math.max(0,Math.min(150000,Math.floor(facts.elapsedMs))):0,provider:{dispatched:facts.dispatched===true,httpStatus:Number.isInteger(facts.httpStatus)&&facts.httpStatus>=100&&facts.httpStatus<=599?facts.httpStatus:null,requestId:/^req_[A-Za-z0-9_-]{1,100}$/.test(facts.requestId||'')?facts.requestId:null},paidExposure:false};
 return{...body,hash:metadataHash(body)};
}
function validateMetadata(d,c){
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
 const keys=['version','probeId','stage','phase','code','model','taskId','ownerHash','workspaceHash','sourceCommit','deploymentId','releaseHash','bindingHash','evidenceHash','at','elapsedMs','provider','paidExposure','hash'];
 if(!exact(d,keys)||d.version!==METADATA_VERSION||!/^metadata_[a-f0-9]{32}$/.test(d.probeId||'')||d.stage!=='model-metadata'||!METADATA_PHASES.has(d.phase)||!METADATA_CODES.has(d.code)||d.model!=='gpt-6.1-sol'||d.taskId!==c.binding.planId||d.ownerHash!==c.binding.ownerHash||d.workspaceHash!==c.binding.workspaceHash||d.sourceCommit!==c.binding.runtime.sourceCommit||d.deploymentId!==c.binding.runtime.deploymentId||d.releaseHash!==c.binding.runtime.release.digest||d.bindingHash!==metadataHash(c.binding)||d.evidenceHash!==metadataHash(c.evidence)||!Number.isSafeInteger(d.at)||d.at<0||!Number.isSafeInteger(d.elapsedMs)||d.elapsedMs<0||d.elapsedMs>150000||d.paidExposure!==false||!exact(d.provider,['dispatched','httpStatus','requestId'])||typeof d.provider.dispatched!=='boolean'||!(d.provider.httpStatus===null||Number.isInteger(d.provider.httpStatus)&&d.provider.httpStatus>=100&&d.provider.httpStatus<=599)||!(d.provider.requestId===null||/^req_[A-Za-z0-9_-]{1,100}$/.test(d.provider.requestId)))throw Error('ENG_CONTROL_METADATA_DIAGNOSTIC');
 const {hash,...raw}=d;if(hash!==metadataHash(raw))throw Error('ENG_CONTROL_METADATA_DIAGNOSTIC');return structuredClone(d);
}
function metadataError(d,recording){const error=Error('ENG_CONTROL_METADATA_UNCONFIRMED'),confirmed=recording?.confirmed===true&&/^[a-f0-9]{64}$/.test(recording.auditHash||'');metadataErrors.set(error,structuredClone({...d,recording:{status:confirmed?'confirmed':'unconfirmed',auditHash:confirmed?recording.auditHash:null}}));return error;}
function metadataFailureFor(error){const d=metadataErrors.get(error);return d?structuredClone(d):null;}
module.exports={VERSION,sanitize,failure,artifactIssue,responseFacts,safeFacts,STATUS,REASONS,METADATA_VERSION,metadataDiagnostic,validateMetadata,metadataError,metadataFailureFor};
