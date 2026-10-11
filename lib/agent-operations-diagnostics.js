'use strict';
// Persist only bounded structured facts, never exception messages, bodies or headers.
const PHASES=new Set(['approval','capture','construction','approval_recheck','provider_fetch','provider_http','provider_json','provider_usage','provider_output','orchestrator','reserve','finish_read','finish','monitor','worker']);
const CODES=new Set(['invalid_api_key','insufficient_permissions','model_not_found','invalid_request_error','rate_limit_exceeded','insufficient_quota','server_error','ECONNRESET','ECONNREFUSED','ENOTFOUND','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','ERR_ACCESS_DENIED']);
const TYPES=new Set(['AuthenticationError','PermissionError','ModelAccessError','RequestFormatError','RateLimitError','QuotaError','ProviderError','NetworkError','TimeoutError','CancelledError','ValidationError','ApprovalError','StorageError','WorkerInterrupted','UnknownError']);
function errorType(facts,error){
  if(error?.name==='AbortError')return 'CancelledError';
  if(error?.name==='TimeoutError'||/TIMEOUT|TIMEDOUT/.test(facts.code||''))return 'TimeoutError';
  if(facts.httpStatus===401)return 'AuthenticationError';
  if(facts.httpStatus===403)return 'PermissionError';
  if(facts.code==='model_not_found')return 'ModelAccessError';
  if(facts.code==='insufficient_quota')return 'QuotaError';
  if(facts.httpStatus===429)return 'RateLimitError';
  if([400,404,422].includes(facts.httpStatus))return 'RequestFormatError';
  if(facts.httpStatus>=500)return 'ProviderError';
  if(facts.phase==='provider_fetch')return 'NetworkError';
  if(facts.phase?.startsWith('approval'))return 'ApprovalError';
  if(['construction','capture','provider_json','provider_usage','provider_output'].includes(facts.phase))return 'ValidationError';
  return 'UnknownError';
}
function diagnostic(value){
  const out={phase:PHASES.has(value?.phase)?value.phase:'orchestrator',requestAttempted:typeof value?.requestAttempted==='boolean'?value.requestAttempted:null};
  if(Number.isSafeInteger(value?.httpStatus)&&value.httpStatus>=100&&value.httpStatus<=599)out.httpStatus=value.httpStatus;
  if(typeof value?.requestId==='string'&&/^req_[a-zA-Z0-9_-]{1,100}$/.test(value.requestId))out.requestId=value.requestId;
  if(CODES.has(value?.code))out.code=value.code;
  if(['completed','incomplete','failed','cancelled','queued','in_progress'].includes(value?.providerStatus))out.providerStatus=value.providerStatus;
  if(Number.isSafeInteger(value?.inputTokens)&&value.inputTokens>=0&&value.inputTokens<=100000&&Number.isSafeInteger(value?.outputTokens)&&value.outputTokens>=0&&value.outputTokens<=1500){out.inputTokens=value.inputTokens;out.outputTokens=value.outputTokens;}
  if(TYPES.has(value?.errorType))out.errorType=value.errorType;
  for(const key of ['startedAt','elapsedMs','providerElapsedMs'])if(Number.isSafeInteger(value?.[key])&&value[key]>=0&&value[key]<=(key==='startedAt'?8640000000000000:600000))out[key]=value[key];
  if(typeof value?.clientRequestId==='string'&&/^exec_[a-zA-Z0-9_-]{1,80}$/.test(value.clientRequestId))out.clientRequestId=value.clientRequestId;
  if(typeof value?.responseId==='string'&&/^resp_[a-zA-Z0-9_-]{1,100}$/.test(value.responseId))out.responseId=value.responseId;
  if(typeof value?.usageValidated==='boolean')out.usageValidated=value.usageValidated;
  return out;
}
module.exports={diagnostic,errorType};
