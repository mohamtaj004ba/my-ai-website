'use strict';
// Trusted parent only. The stage DTO/request has no credential, broker token, or assessor authority.
const model=require('./agent-operations-organization-model'),{SPEC,hash}=require('./agent-operations-organization'),{PROJECT,workerCredential}=require('./agent-operations-project'),{approval}=require('./agent-operations-organization-approval'),diagnostics=require('./agent-operations-diagnostics');
async function execute(dto,{env,broker,executionId,images=[],context,fetchImpl=fetch,signal}={}){
 const a=approval(env,dto.scope);if(dto.mode!=='pilot'||!a||!broker||!/^exec_[A-Za-z0-9_-]{1,80}$/.test(executionId))throw Error('Paid provider dispatch disabled');
 const controller=new AbortController(),start=Date.now(),timeout=Math.min((SPEC[dto.stage]?.timeout||1)-Math.max(0,start-(dto.stageStarted||start)),dto.deadline-start);let built,key;
 let current=dto,queue=Promise.resolve(),attempted=false,facts={phase:'construction',requestAttempted:false,clientRequestId:executionId,startedAt:start};
 const checkpoint=(type,fields={})=>{const job=queue.then(async()=>{current=await broker.command({type,expectedRevision:current.revision,fence:current.fence,...fields});return current;});queue=job.catch(()=>{});return job;};
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,Math.max(1,timeout));let heartbeat;
 try{
  if(timeout<=0)throw Error('Workflow deadline elapsed');const release=require('./agent-operations-contracts').assertRelease();if(dto.contractHash!==release.digest||dto.contractVersion!==release.version)throw Error('Task contract preflight stale');built=model.request(dto,{images,context});require('./agent-operations-contracts').assertRequest(dto.stage,built.body);key=workerCredential(env);
  await checkpoint('dispatch',{executionId,requestHash:hash(built.body),...(built.chiefContext?{chiefContext:built.chiefContext}:{})});if(signal?.aborted||controller.signal.aborted)throw Error('Cancelled before dispatch');
  heartbeat=setInterval(()=>checkpoint('heartbeat').catch(abort),10000);
  attempted=true;facts={...facts,phase:'provider_fetch',requestAttempted:true};const response=await fetchImpl(built.endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'OpenAI-Project':PROJECT.projectId,'OpenAI-Organization':PROJECT.organizationId,'Content-Type':'application/json','X-Client-Request-Id':executionId},body:JSON.stringify(built.body),signal:controller.signal});
  facts={...facts,phase:'provider_http',httpStatus:response.status,requestId:response.headers.get('x-request-id'),providerElapsedMs:Date.now()-start};
  facts={...facts,phase:'provider_json'};const data=await response.json();if(!response.ok){facts={...facts,phase:'provider_http',...diagnostics.providerError(data?.error,{retainMessage:true,secrets:[key]})};throw Error('Provider HTTP rejection');}
  const u=data?.usage,output=JSON.stringify(data?.output||[]);facts={...facts,phase:'provider_usage',responseId:data?.id,providerStatus:data?.status,serviceTier:data?.service_tier,inputTokens:u?.input_tokens,outputTokens:u?.output_tokens,reasoningTokens:u?.output_tokens_details?.reasoning_tokens,cachedInputTokens:u?.input_tokens_details?.cached_tokens,cacheWriteTokens:u?.input_tokens_details?.cache_write_tokens,incompleteReason:data?.incomplete_details?.reason,refusalDetected:(data?.output||[]).some(o=>o.content?.some(c=>c.type==='refusal')),outputCharacters:output.length,outputHash:require('node:crypto').createHash('sha256').update(output).digest('hex'),usageValidated:false};
  // Preserve bounded unvalidated usage before parsing; no raw provider payload enters storage/logs.
  await checkpoint('evidence',{diagnostic:diagnostics.taskDiagnostic({...facts,elapsedMs:Date.now()-start},{profile:'hybrid-visual-qa'})});
  const parsed=model.receipt(dto,data,{context,executionBinding:current.executionBinding});facts={...facts,phase:'provider_output',usageValidated:true};
  await checkpoint('evidence',{diagnostic:diagnostics.taskDiagnostic({...facts,elapsedMs:Date.now()-start},{profile:'hybrid-visual-qa'})});
  if(dto.stage==='inspect')parsed.result={...parsed.result,artifacts:dto.capture.images,geometry:dto.capture.geometry};
  return await checkpoint('finish',{executionId,...parsed});
 }catch(error){facts={...facts,requestAttempted:attempted,elapsedMs:Date.now()-start,errorType:diagnostics.errorType(facts,error),contractCode:error?.contractCode};try{await checkpoint('fail',{requestAttempted:attempted,diagnostic:diagnostics.taskDiagnostic(facts,{profile:'hybrid-visual-qa'})});}catch{}throw Object.assign(Error('Organization stage failed; retained sanitized diagnostic and uncertain reservation where storage confirmed'),{diagnostic:diagnostics.taskDiagnostic(facts,{profile:'hybrid-visual-qa'})});
 }finally{clearTimeout(timer);clearInterval(heartbeat);signal?.removeEventListener('abort',abort);controller.abort();}
}
module.exports={execute};
