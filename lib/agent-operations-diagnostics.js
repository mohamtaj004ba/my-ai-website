'use strict';
const {isSmoke}=require('./agent-operations-smoke');
// Persist bounded facts and canonical provider summaries, never raw text, bodies or headers.
const PHASES=new Set(['approval','capture','construction','approval_recheck','provider_fetch','provider_http','provider_json','provider_usage','provider_output','orchestrator','reserve','finish_read','finish','monitor','worker']);
const CODES=new Set(['invalid_api_key','insufficient_permissions','model_not_found','invalid_request_error','unsupported_parameter','unsupported_value','invalid_value','invalid_type','missing_required_parameter','rate_limit_exceeded','insufficient_quota','server_error','ECONNRESET','ECONNREFUSED','ENOTFOUND','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','ERR_ACCESS_DENIED','BROKER_BUDGET_EXHAUSTED','BROKER_STATE_DENIED','BROKER_STORAGE_UNCONFIRMED','BROKER_DENIED']);
const TYPES=new Set(['AuthenticationError','PermissionError','ModelAccessError','RequestFormatError','RateLimitError','QuotaError','ProviderError','NetworkError','TimeoutError','CancelledError','ValidationError','ApprovalError','StorageError','WorkerInterrupted','UnknownError','BudgetError','StateError']);

const PARAMS=new Set(['model','input','instructions','max_output_tokens','store','tools','text','text.format','text.format.type','metadata','reasoning','reasoning.effort','response_format','messages','temperature','top_p','tool_choice','parallel_tool_calls','previous_response_id','metadata.task_id','metadata.execution_id']);
const MESSAGES=new Set(['JSON mode requires an explicit JSON instruction in request context.','Unsupported request parameter.','Unsupported parameter value.','Invalid parameter type.','Missing required request parameter.','The provider rejected the request format.','The provider rejected authentication.','The provider denied access.','The requested model is unavailable.','The provider reported a rate limit.','The provider reported insufficient quota.','The provider reported an internal failure.','Provider error text omitted.']);
// Retain provider wording only for the fixed smoke payload. Unknown words/values
// are redacted, not guessed safe by regex. Storage and IPC rerun this sanitizer.
const WORDS=new Set(('a an and are as at be because been body boolean by can cannot check contain contains content context could current developer did do does empty endpoint error expected failed field fields for format found from function has have http if in include includes input inputs instructions integer invalid is it json key length limit maximum message messages method min minimum missing model must no not null number object of on only or output parameter parameters permission permissions please project provided request requests required response responses role schema server should specified status string supported supports system text that the their this to token tokens tool tools type unavailable unexpected unknown unsupported use used using valid validation value values was were when which with without you your authentication denied quota exceeded reasoning effort store metadata max_output_tokens json_object response_format messages input_text true false malformed unsupported_parameter invalid_request_error invalid_value invalid_type missing_required_parameter incomplete limit reached timeout timed out connection network envelope encoding rejected content_type application completed retry rate access organization authorized authorization credentials supplied recognized allowed').split(' '));
function providerWording(value){
  if(typeof value!=='string')return undefined;
  let text=value.slice(0,4096).replace(/\[REDACTED\]|\[TRUNCATED\]/g,m=>m==='[REDACTED]'?' redactionmarker ':' truncationmarker ')
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi,' redactionmarker ')
    .replace(/https?:\/\/\S+|\b[^\s@]+@[^\s@]+\b/gi,' redactionmarker ')
    .replace(/(['"`])[^\r\n]*?\1/g,' redactionmarker ')
    .replace(/\bsk-[A-Za-z0-9_-]+\b/gi,' redactionmarker ')
    .replace(/[^\x20-\x7e]/g,' ')
    .replace(/[^A-Za-z0-9_. ,:;()[\]-]/g,' redactionmarker ')
    .replace(/[.,:;()[\]-]{2,}/g,' redactionmarker ')
    .replace(/[A-Za-z0-9_]+(?:[.-][A-Za-z0-9_]+)*/g,word=>word==='redactionmarker'?'[REDACTED]':word==='truncationmarker'?'[TRUNCATED]':WORDS.has(word.toLowerCase())?word.toLowerCase():'[REDACTED]')
    .replace(/\s+/g,' ').trim();
  if(!text)text='[REDACTED]';
  const truncate=()=>text.slice(0,980).replace(/\s+\S*$/,'')+' [TRUNCATED]';
  if(text.length>1024)text=truncate();
  if(value.length>4096&&!text.endsWith('[TRUNCATED]'))text=truncate();
  return text;
}
function providerIdentifier(value){
  if(value===null)return null;
  return typeof value==='string'&&(CODES.has(value)||value.length<=64&&/^[a-z]+(?:_[a-z]+)*$/.test(value)&&value.split('_').every(word=>WORDS.has(word)))?value:'[REDACTED]';
}
function providerError(value,{retainMessage=false,secrets=[]}={}){
  // Provider error text can echo prompts, values or credentials. Never persist it verbatim.
  const out={},code=CODES.has(value?.code)?value.code:CODES.has(value?.type)?value.type:undefined;
  if(code)out.code=code;
  if(PARAMS.has(value?.param))out.providerParam=value.param;
  else if(typeof value?.param==='string'&&/^input\[[0-4]\](?:\.role|\.content(?:\[[0-4]\](?:\.type|\.text|\.image_url|\.detail))?)$/.test(value.param))out.providerParam=value.param;
  const message=typeof value?.message==='string'?value.message.slice(0,4096):'';
  out.providerMessage=/\b(?:messages|context)\b/i.test(message)&&/\bjson\b/i.test(message)&&/\b(?:contain|include|appear)\b/i.test(message)?'JSON mode requires an explicit JSON instruction in request context.':
    /unsupported parameter/i.test(message)||code==='unsupported_parameter'?'Unsupported request parameter.':
    /unsupported value/i.test(message)||code==='unsupported_value'?'Unsupported parameter value.':
    /invalid type/i.test(message)||code==='invalid_type'?'Invalid parameter type.':
    /missing required/i.test(message)||code==='missing_required_parameter'?'Missing required request parameter.':
    ({invalid_request_error:'The provider rejected the request format.',invalid_value:'The provider rejected the request format.',invalid_api_key:'The provider rejected authentication.',insufficient_permissions:'The provider denied access.',model_not_found:'The requested model is unavailable.',rate_limit_exceeded:'The provider reported a rate limit.',insufficient_quota:'The provider reported insufficient quota.',server_error:'The provider reported an internal failure.'}[code]||'Provider error text omitted.');
  if(retainMessage&&typeof value?.message==='string'){
    let wording=value.message.slice(0,4096);
    for(const secret of secrets)if(typeof secret==='string'&&secret.length)wording=wording.split(secret).join('[REDACTED]');
    out.providerErrorMessage=providerWording(wording);
    out.providerErrorMessageTruncated=value.message.length>4096||out.providerErrorMessage.includes('[TRUNCATED]');
  }
  if(retainMessage)for(const [key,field]of [['code','providerCode'],['type','providerType']])if(Object.hasOwn(value||{},key))out[field]=providerIdentifier(value[key]);
  return out;
}
function errorType(facts,error){
  if(facts.code==='BROKER_BUDGET_EXHAUSTED')return 'BudgetError';
  if(facts.code==='BROKER_STATE_DENIED')return 'StateError';
  if(['BROKER_STORAGE_UNCONFIRMED','BROKER_DENIED'].includes(facts.code))return 'StorageError';
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
function diagnostic(value,{hybrid=false}={}){
  const out={phase:PHASES.has(value?.phase)?value.phase:'orchestrator',requestAttempted:typeof value?.requestAttempted==='boolean'?value.requestAttempted:null};
  if(Number.isSafeInteger(value?.brokerStatus)&&value.brokerStatus>=100&&value.brokerStatus<=599)out.brokerStatus=value.brokerStatus;
  if(Number.isSafeInteger(value?.httpStatus)&&value.httpStatus>=100&&value.httpStatus<=599)out.httpStatus=value.httpStatus;
  if(typeof value?.requestId==='string'&&/^req_[a-zA-Z0-9_-]{1,100}$/.test(value.requestId))out.requestId=value.requestId;
  if(CODES.has(value?.code))out.code=value.code;
  const provider=providerError({param:value?.providerParam});
  if(provider.providerParam)out.providerParam=provider.providerParam;
  if(MESSAGES.has(value?.providerMessage))out.providerMessage=value.providerMessage;
  if(typeof value?.providerErrorMessage==='string'){
    out.providerErrorMessage=providerWording(value.providerErrorMessage);
    out.providerErrorMessageTruncated=value.providerErrorMessageTruncated===true||value.providerErrorMessage.length>4096||out.providerErrorMessage.includes('[TRUNCATED]');
  }
  for(const field of ['providerCode','providerType'])if(Object.hasOwn(value||{},field))out[field]=providerIdentifier(value[field]);
  if(['completed','incomplete','failed','cancelled','queued','in_progress'].includes(value?.providerStatus))out.providerStatus=value.providerStatus;
  if(Number.isSafeInteger(value?.inputTokens)&&value.inputTokens>=0&&value.inputTokens<=(hybrid?120000:100000)&&Number.isSafeInteger(value?.outputTokens)&&value.outputTokens>=0&&value.outputTokens<=(hybrid?25000:1500)){out.inputTokens=value.inputTokens;out.outputTokens=value.outputTokens;}
  if(hybrid){if(['max_output_tokens','content_filter'].includes(value?.incompleteReason))out.incompleteReason=value.incompleteReason;for(const [key,limit]of [['reasoningTokens',25000],['cachedInputTokens',120000],['outputCharacters',1000000]])if(Number.isSafeInteger(value?.[key])&&value[key]>=0&&value[key]<=limit)out[key]=value[key];if(['default','flex','priority','fast','ultrafast'].includes(value?.serviceTier))out.serviceTier=value.serviceTier;if(typeof value?.refusalDetected==='boolean')out.refusalDetected=value.refusalDetected;if(/^[a-f0-9]{64}$/.test(value?.outputHash||''))out.outputHash=value.outputHash;}
  if(TYPES.has(value?.errorType))out.errorType=value.errorType;
  for(const key of ['startedAt','elapsedMs','providerElapsedMs'])if(Number.isSafeInteger(value?.[key])&&value[key]>=0&&value[key]<=(key==='startedAt'?8640000000000000:600000))out[key]=value[key];
  if(typeof value?.clientRequestId==='string'&&/^exec_[a-zA-Z0-9_-]{1,80}$/.test(value.clientRequestId))out.clientRequestId=value.clientRequestId;
  if(typeof value?.responseId==='string'&&/^resp_[a-zA-Z0-9_-]{1,100}$/.test(value.responseId))out.responseId=value.responseId;
  if(typeof value?.usageValidated==='boolean')out.usageValidated=value.usageValidated;
  return out;
}
function taskDiagnostic(value,task){
  const hybrid=task?.profile==='hybrid-visual-qa';const out=diagnostic(value,{hybrid});
  if(!isSmoke(task)&&!hybrid)for(const field of ['providerErrorMessage','providerErrorMessageTruncated','providerCode','providerType'])delete out[field];
  return out;
}
module.exports={diagnostic,taskDiagnostic,errorType,providerError,providerWording};
