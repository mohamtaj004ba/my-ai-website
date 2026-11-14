'use strict';
// Trusted parent transport only. Model timing includes admission. Isolated
// artifact/test work has its own phase budget under the same operation deadline.
const p=require('./agent-operations-engineering-provider-v2'),failure=require('./agent-operations-engineering-failure'),{workerCredential,PROJECT}=require('./agent-operations-project');
const timing=require('./agent-operations-engineering-timing');
async function boundedJson(response,secret,maxBytes=65536){const length=Number(response.headers?.get('content-length')||0);p.check(length<=maxBytes,'ENG_TRANSPORT_BODY');let text;if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;p.check(size<=maxBytes,'ENG_TRANSPORT_BODY');chunks.push(Buffer.from(value));}text=Buffer.concat(chunks).toString('utf8');}finally{try{await reader.cancel();}catch{}}}else{text=await response.text();p.check(Buffer.byteLength(text)<=maxBytes,'ENG_TRANSPORT_BODY');}p.check(!secret||!text.includes(secret),'ENG_TRANSPORT_SECRET_ECHO');return JSON.parse(text);}
async function boundedCleanup(action,timeoutMs=2000){if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)return false;let timer;try{return await Promise.race([Promise.resolve().then(action),new Promise(resolve=>timer=setTimeout(()=>resolve(false),timeoutMs))])===true;}catch{return false;}finally{clearTimeout(timer);}}
// The read and resumed dispatch share the admitted stage's deadline and grant.
async function resumeSourceStage({raw,broker,ticket,context,fetchImpl,signal,deadline,key,onPhase}){
 const output=raw?.output;
 if(!Array.isArray(output)||!output.some(item=>item?.type==='function_call'))return null;
 const calls=output.filter(item=>item?.type==='function_call');
 const call=calls[0];
 p.check(raw.status==='completed'&&!raw.error&&!raw.incomplete_details&&raw.model==='gpt-6.1-sol'&&
  calls.length===1&&output.every(item=>['reasoning','function_call'].includes(item?.type))&&
  call.name==='read_repository_source'&&/^call_[A-Za-z0-9_-]{1,80}$/.test(call.call_id??'')&&
  typeof call.arguments==='string'&&Buffer.byteLength(call.arguments)<=4096,'ENG_TRANSPORT_OUTPUT');
 let query;
 try{
  require('./agent-operations-implementation-patch').assertUnambiguousJSON(call.arguments);
  query=JSON.parse(call.arguments);
 }catch{throw Error('ENG_TRANSPORT_OUTPUT');}
 if(key){
  p.parseSourceToolUsage(ticket.stage,raw,context);
  await broker.recordSourceToolUsage(ticket,context);
 }
 const read=await broker.readStageSource(ticket,context,query,{signal});
 if(signal.aborted)throw Error('ENG_TRANSPORT_CANCELLED');
 await broker.verify(ticket,context,{signal});
 if(signal.aborted)throw Error('ENG_TRANSPORT_CANCELLED');
 const headers={'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key,'OpenAI-Project':PROJECT.projectId,'OpenAI-Organization':PROJECT.organizationId}:{})};
 onPhase('dispatch');
 const count=await broker.countFixtureSourceResume(ticket,context,read,{signal});
 if(signal.aborted)throw Error('ENG_TRANSPORT_CANCELLED');
 await broker.verify(ticket,context,{signal});
 if(signal.aborted)throw Error('ENG_TRANSPORT_CANCELLED');
 onPhase('count-fetch',count.requestHash);
 const counted=await fetchImpl(count.endpoint,{method:'POST',redirect:'error',headers:{...headers,
  'X-Client-Request-Id':context.binding.executionId+'_source_resume_count'},body:JSON.stringify(count.body),signal});
 onPhase('count-body');
 await broker.diagnostic(ticket,{sourceResumeCountFacts:{countHttpStatus:counted.status}});
 p.check(counted.ok,'ENG_TRANSPORT_COUNT_HTTP');
 const rawCount=await boundedJson(counted,key);
 await broker.diagnostic(ticket,{sourceResumeCountFacts:{countResponseHash:p.hash(rawCount),countInputTokens:rawCount?.input_tokens}});
 onPhase('count-validate');
 const proof=p.parseSourceResumeCount(ticket.stage,rawCount,context,read,Date.now(),deadline);
 onPhase('dispatch');
 const resumed=await broker.dispatchFixtureSourceResume(ticket,context,read,proof,{signal});
 await broker.verify(ticket,context,{signal});
 p.assertSourceResumeCount(ticket.stage,context,read,proof,Date.now());
 if(signal.aborted)throw Error('ENG_TRANSPORT_CANCELLED');
 onPhase('response-fetch');
 const response=await fetchImpl(resumed.endpoint,{method:'POST',redirect:'error',headers:{...headers,
  'X-Client-Request-Id':context.binding.executionId+'_source_resume'},body:JSON.stringify(resumed.body),signal});
 return {response,read};
}
async function execute({broker,actor,stage,context,mode='fixture',approval=null,env={},fetchImpl,signal,managedLiveness,rehearseDiscoveryContinuation=false,rehearseStageSource=false,operationDeadlineAt,timeoutMs=timing.MODEL_MS}){
 p.check(!rehearseStageSource||mode==='fixture'&&['specialist','qa','auditor'].includes(stage),'ENG_TRANSPORT_FIXTURE_REQUIRED');
 const consentPins=mode==='pilot'&&env.CALLERCORE_AGENTOPS_ENABLED==='true'?require('./agent-operations-activation-controller').managedConsentPolicy(managedLiveness,{broker,actor,stage,context,approval,signal}):null;
 const countEnv=consentPins?{...env,...consentPins}:env;
 p.check(broker&&['fixture','pilot'].includes(mode)&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=timing.MODEL_MS&&!signal?.aborted,'ENG_TRANSPORT_DENIED');if(mode==='fixture')p.check(typeof fetchImpl==='function','ENG_TRANSPORT_FIXTURE_REQUIRED');else p.check(env.VERCEL_ENV==='preview'&&(consentPins||env.CALLERCORE_AGENTOPS_ENGINEERING_PAID_ENABLED==='true'&&env.CALLERCORE_AGENTOPS_PAID_ENABLED==='true'&&env.CALLERCORE_AGENTOPS_ENGINEERING_COUNT_ENABLED==='true')&&p.countPolicyPinned(approval,countEnv)&&!fetchImpl,'ENG_TRANSPORT_PAID_DISABLED');
 const managed=managedLiveness!==undefined;
 if(managed)p.check(require('./agent-operations-activation-controller').managedStageMatches(managedLiveness,{broker,actor,stage,context,approval,signal}),'ENG_TRANSPORT_LIVENESS_SCOPE');
 context=structuredClone(context);actor=structuredClone(actor);approval=structuredClone(approval);const controller=new AbortController(),startedAt=Date.now();
 p.check(operationDeadlineAt===undefined||Number.isSafeInteger(operationDeadlineAt)&&operationDeadlineAt>startedAt&&operationDeadlineAt<=startedAt+timing.OPERATION_MS,'ENG_TRANSPORT_DEADLINE');
 let operationEnd=Math.min(operationDeadlineAt??startedAt+timing.OPERATION_MS,approval?.expiresAt??Infinity),phaseEnd=Math.min(startedAt+timeoutMs,operationEnd);
 let stopReject,key,inputCountProof,countStarted=false,providerStarted=false,completed=false,heartbeat,heartbeatBusy=false,ticket,phase='admission',resumeRequestHash,stopReason,artifactPreparation,observedFacts={};const stop=new Promise((_,reject)=>stopReject=reject),abort=(reason='cancelled')=>{stopReason??=reason;controller.abort();stopReject(Error('ENG_TRANSPORT_CANCELLED'));},cancel=()=>abort('cancelled');let timer;
 const arm=deadline=>{clearTimeout(timer);phaseEnd=deadline;timer=setTimeout(()=>abort('timeout'),Math.max(0,deadline-Date.now()));};
 const live=()=>{if(controller.signal.aborted||Date.now()>=phaseEnd){abort(stopReason||'timeout');throw Error('ENG_TRANSPORT_CANCELLED');}};
 arm(phaseEnd);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{
  const admitted=await Promise.race([broker.admit(actor,stage,context,{mode,approval,...(rehearseDiscoveryContinuation?{rehearseDiscoveryContinuation:true}:{}),...(rehearseStageSource?{rehearseStageSource:true}:{})}),stop]),{context:c,built}=admitted;ticket=admitted.ticket;if(mode==='pilot')p.check(admitted.approvalHash===p.hash(approval)&&admitted.countPricingEvidenceHash===approval.countPricing.evidenceHash&&p.countPolicyPinned(approval,countEnv),'ENG_TRANSPORT_COUNT_POLICY_CHANGED');
  if(Number.isFinite(admitted.remainingMs))operationEnd=Math.min(operationEnd,Date.now()+admitted.remainingMs);
  const originalCountDeadline=Math.min(startedAt+timeoutMs,operationEnd);arm(originalCountDeadline);live();
  if(!managed)heartbeat=setInterval(()=>{if(heartbeatBusy)return;heartbeatBusy=true;Promise.resolve(broker.verify(ticket,c,{renew:true,signal:controller.signal})).catch(()=>abort('authority')).finally(()=>heartbeatBusy=false);},5000);
  if(mode==='pilot')key=workerCredential(env);phase='authority';await Promise.race([broker.verify(ticket,c),stop]);
  if(mode==='pilot'){
   const q=p.countRequest(stage,c);phase='dispatch';await Promise.race([broker.dispatchCount(ticket,c),stop]);phase='authority';await Promise.race([broker.verify(ticket,c),stop]);p.check(!controller.signal.aborted,'ENG_TRANSPORT_CANCELLED');countStarted=true;phase='count-fetch';
   const countedResponse=await Promise.race([fetch(q.endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'OpenAI-Project':PROJECT.projectId,'OpenAI-Organization':PROJECT.organizationId,'X-Client-Request-Id':c.binding.executionId+'_input_count'},body:JSON.stringify(q.body),signal:controller.signal}),stop]);
   phase='count-body';await Promise.race([broker.diagnostic(ticket,{countHttpStatus:countedResponse.status}),stop]);const rawCount=await Promise.race([boundedJson(countedResponse,key),stop]);await Promise.race([broker.diagnostic(ticket,{countResponseHash:p.hash(rawCount),countInputTokens:rawCount?.input_tokens}),stop]);p.check(countedResponse.ok,'ENG_TRANSPORT_COUNT_HTTP');phase='count-validate';inputCountProof=p.parseCount(stage,rawCount,c,Date.now(),originalCountDeadline);phase='count-record';await Promise.race([broker.recordCount(ticket,c,inputCountProof),stop]);phase='authority';await Promise.race([broker.verify(ticket,c),stop]);
  }
  phase='dispatch';await Promise.race([broker.dispatch(ticket,c),stop]);phase='authority';await Promise.race([broker.verify(ticket,c),stop]);p.check(!controller.signal.aborted,'ENG_TRANSPORT_CANCELLED');
  // Admission freshness is checked after the final awaited authority read. It
  // does not retroactively expire a request already transmitted to the provider.
  if(mode==='pilot')p.assertCount(stage,c,inputCountProof,Date.now());
  providerStarted=true;phase='response-fetch';const response=await Promise.race([(mode==='fixture'?fetchImpl:fetch)(built.endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(mode==='pilot'?{Authorization:'Bearer '+key,'OpenAI-Project':PROJECT.projectId,'OpenAI-Organization':PROJECT.organizationId}:{}),'X-Client-Request-Id':c.binding.executionId},body:JSON.stringify(built.body),signal:controller.signal}),stop]);
  async function readResponse(response,{resumed=false}={}){
   const record=facts=>broker.diagnostic(ticket,resumed?{sourceResumeFacts:facts}:facts);
   phase='response-body';observedFacts=failure.safeFacts({httpStatus:response.status,providerRequestId:response.headers?.get('x-request-id')});await Promise.race([record(observedFacts),stop]);const raw=await Promise.race([boundedJson(response,key,require('./agent-operations-engineering-handoff').payloadLimits(c).providerBytes),stop]);observedFacts=failure.safeFacts({...observedFacts,...failure.responseFacts(raw),responseHash:p.hash(raw),inputTokens:raw?.usage?.input_tokens,outputTokens:raw?.usage?.output_tokens,reasoningTokens:raw?.usage?.output_tokens_details?.reasoning_tokens,cachedInputTokens:raw?.usage?.input_tokens_details?.cached_tokens,cacheWriteTokens:raw?.usage?.input_tokens_details?.cache_write_tokens,providerId:raw?.id});await Promise.race([record(observedFacts),stop]);p.check(response.ok,'ENG_TRANSPORT_HTTP');phase='response-validate';
   return raw;
  }
  let raw=await readResponse(response);
  let resumeRead;
  if(rehearseStageSource||mode==='pilot'&&p.trialFor(approval)===p.SOURCE_REVIEW_TRIAL&&p.sourceStage(stage)){
   const resumed=await Promise.race([resumeSourceStage({raw,broker,ticket,context:c,fetchImpl:mode==='pilot'?fetch:fetchImpl,signal:controller.signal,deadline:phaseEnd,key,onPhase:(next,hash)=>{phase=next;resumeRequestHash=hash??resumeRequestHash;}}),stop]);
   if(resumed){
    resumeRead=resumed.read;raw=await readResponse(resumed.response,{resumed:true});
    if(mode==='pilot')await Promise.race([broker.recordSourceResumeUsage(ticket,c),stop]);
   }
  }
  const parsed=resumeRead?p.parseSourceResume(stage,raw,c,resumeRead):p.parse(stage,raw,c);live();phase='authority';await Promise.race([broker.verify(ticket,c),stop]);live();
  if(stage==='specialist'&&require('./agent-operations-implementation').enabled(c)){
   // Only after validated model output and fresh authority, transition out of
   // inference timing. The original task/controller deadline cannot move.
   arm(timing.phaseDeadline(Date.now(),timing.SOURCE_TEST_MS,operationEnd));live();
   phase='workspace-prepare';artifactPreparation=broker.prepareArtifact(ticket,c,parsed,{signal:controller.signal});await Promise.race([artifactPreparation,stop]);live();phase='authority';await Promise.race([broker.verify(ticket,c),stop]);
  }
  live();phase='finish';const result=await Promise.race([broker.finish(ticket,c,parsed),stop]);completed=true;return{receipt:result,priorReceipts:c.priorReceipts};
 }catch(error){
  clearTimeout(timer);clearInterval(heartbeat);controller.abort();
  const diagnostic=failure.failure(error,{stage,phase,stopReason,authorityReason:signal?.reason,providerStarted,countStarted,mode});
  // Independent bounds: a broken diagnostic store must never prevent revocation.
  const [diagnosticRecorded,authorityCleanupConfirmed,workspaceCleanupConfirmed]=await Promise.all([ticket?boundedCleanup(()=>broker.diagnostic(ticket,{...observedFacts,failure:diagnostic,resumeRequestHash,elapsedMs:Date.now()-startedAt})):typeof broker.recordAdmissionFailure==='function'?boundedCleanup(()=>broker.recordAdmissionFailure(actor,stage,context,diagnostic)):Promise.resolve(false),boundedCleanup(()=>broker.abortAdmission(actor,context)),artifactPreparation?boundedCleanup(()=>Promise.resolve(artifactPreparation).then(()=>true,error=>error?.cleanupConfirmed===true),10000):Promise.resolve(true)]);const cleanupConfirmed=authorityCleanupConfirmed&&workspaceCleanupConfirmed;if(ticket&&artifactPreparation)await boundedCleanup(()=>broker.diagnostic(ticket,{workspaceCleanupConfirmed}));
  throw Object.assign(Error('ENG_TRANSPORT_FAILED'),{requestAttempted:providerStarted,countRequestAttempted:countStarted,uncertain:mode==='pilot'&&(providerStarted||countStarted),cleanupConfirmed,workspaceCleanupConfirmed,diagnosticRecorded,diagnostic,observedFacts});
 }
 finally{clearTimeout(timer);clearInterval(heartbeat);signal?.removeEventListener('abort',cancel);controller.abort();}
}
// Exercise the production transport and broker with an injected, non-billable
// provider. The broker reconstructs the continuation from its stored receipt.
async function rehearseDiscovery({broker,actor,context,fetchImpl,signal}){
 const discovery=require('./agent-operations-repository-discovery');
 p.check(discovery.enabled(context)&&typeof fetchImpl==='function','ENG_DISCOVERY_CONTINUATION_MODE');
 const operationDeadlineAt=Date.now()+timing.OPERATION_MS;
 const options={broker,actor,stage:'chief-plan',mode:'fixture',fetchImpl,signal,operationDeadlineAt,rehearseDiscoveryContinuation:true};
 const first=await execute({...options,context});
 if(first.receipt.response.decision!=='inspect')return [first.receipt];
 let second;
 try{
  const executionId='discovery_'+require('node:crypto').randomUUID().replaceAll('-','');
  const continuation=discovery.prepareContinuation(context,first.receipt,executionId);
  if(continuation.status!=='prepared'){
   p.check(await boundedCleanup(()=>broker.abortAdmission(actor,context)),'ENG_DISCOVERY_SHUTDOWN');
   return [first.receipt];
  }
  second=await execute({...options,context:{...context,binding:continuation.context.binding}});
 }catch(error){
  const cleanupConfirmed=await boundedCleanup(()=>broker.abortAdmission(actor,context));
  if(!cleanupConfirmed)throw Object.assign(Error('ENG_DISCOVERY_SHUTDOWN'),{cause:error,cleanupConfirmed:false});
  throw error;
 }
 return [first.receipt,second.receipt];
}
module.exports={execute,rehearseDiscovery,boundedJson,boundedCleanup};
