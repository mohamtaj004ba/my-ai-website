const {previewGate,createProvider,normalizedCall,identifier,VoiceError,agentMatches}=require('./voice-provider');
const {validatePolicy,revision,hoursAt,E164}=require('./voice-policy');
const {redact}=require('./voice-privacy');
const {profile,argumentsFor}=require('./voice-tools');
const {mutateCall,ingest}=require('./voice-store');
const {compareAndAuditBatch}=require('./config-transaction');
function safeStatus(record,env=process.env){
  if(env.VERCEL_ENV!=='preview'||env.CALLERCORE_VOICE_PREVIEW_ENABLED!=='true')return {state:'launch_gated',label:'Voice testing is not enabled',operational:false,controlsAvailable:false};
  if(!record)return {state:'unconfigured',label:'Voice setup is needed',operational:false,controlsAvailable:false};
  const fresh=record.verifiedAt&&Date.now()-record.verifiedAt<5*60000;
  const configured=record.state==='ready'||record.state==='paused';
  return {state:configured&&!fresh?'verification_needed':record.state,label:configured&&!fresh?'Check the current answering state':record.state==='ready'?'Internal test answering enabled':record.state==='paused'?'Internal test answering paused':record.state==='error'?'Voice connection needs attention':'Voice setup in progress',operational:record.state==='ready'&&!!fresh,controlsAvailable:configured&&!!fresh,purpose:record.purpose||'internal',revision:record.revision||0,verifiedAt:record.verifiedAt||null,publicDemoAvailable:false,recordingEnabled:false,legalReviewComplete:false};
}
async function context(kv,message,provider){
  const supplied=message.call||{};identifier(supplied.id);
  // Authenticate resource ownership through a provider read, not caller metadata.
  const call=await provider.retrieveCall(supplied.id);if(call.id!==supplied.id)throw new VoiceError('VOICE_ASSOCIATION_INVALID');const canonical=normalizedCall(call);
  const binding=await kv.get('voice:binding:'+canonical.assistantId);
  if(!binding||!['internal','demo'].includes(binding.purpose)||binding.numberId!==canonical.numberId||binding.disabled||binding.provider!=='vapi')throw new VoiceError('VOICE_ASSOCIATION_INVALID');
  const config=await kv.get('voice:config:'+binding.workspaceId),workspace=await kv.get('workspace:'+binding.workspaceId),agent=await kv.get('agent:'+binding.workspaceId);
  if(!workspace?.voiceTestWorkspace||workspace.stripeCustomerId||workspace.stripeSubscriptionId)throw new VoiceError('VOICE_ASSOCIATION_INVALID');
  if(!config||config.assistantId!==canonical.assistantId||!workspace||workspace.deletedAt||workspace.status==='deleted')throw new VoiceError('VOICE_ASSOCIATION_INVALID');
  if(binding.purpose==='demo'&&config.purpose!=='demo')throw new VoiceError('VOICE_ASSOCIATION_INVALID');
  return {call,canonical,binding,workspace,agent:agent||{},config,policy:validatePolicy(config.policy)};
}
async function tool(kv,ctx,item,provider){
  const id=identifier(item.id),name=item.function?.name,input=argumentsFor(name,item.function?.arguments||{}),op='tool:'+id;
  const journal=await kv.get('voice:journal:'+ctx.canonical.id);if(journal&&Object.hasOwn(journal,op))return journal[op];
  if(ctx.canonical.status==='ended')throw new VoiceError('VOICE_CALL_ENDED');
  if(Number(ctx.agent.updatedAt||0)!==ctx.config.agentRevision)throw new VoiceError('VOICE_CONFIG_OUT_OF_SYNC');
  if(ctx.config.state!=='ready')throw new VoiceError('VOICE_ANSWERING_UNAVAILABLE');
  if(name==='get_business_profile')return profile(ctx.workspace,ctx.agent,ctx.policy,Date.now());
  if(name==='check_after_hours_policy')return hoursAt(ctx.policy);
  if(name==='save_call_request'){
    if(!input.confirmed)throw new VoiceError('VOICE_CONFIRMATION_REQUIRED');
    const request=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,typeof v==='string'?redact(v):v]));delete request.confirmed;
    return mutateCall(kv,ctx.binding,ctx.canonical,op,record=>{record.request=request;return {status:'captured',callId:record.id,request,appointmentConfirmed:false,customerContacted:false}});
  }
  if(name==='complete_call'){
    return mutateCall(kv,ctx.binding,ctx.canonical,op,record=>{if(['message_taken','request_captured'].includes(input.disposition)&&!record.request)throw new VoiceError('VOICE_REQUEST_REQUIRED');record.disposition=input.disposition;record.summary=redact(input.summary);return {status:'recorded',disposition:input.disposition}});
  }
  if(name==='transfer_call'){
    if(!input.confirmed)throw new VoiceError('VOICE_CONFIRMATION_REQUIRED');
    const hours=hoursAt(ctx.policy),destination=ctx.policy.transferNumber;
    if(ctx.binding.purpose==='demo'||!E164.test(destination||'')||!hours.open&&ctx.policy.afterHours!=='transfer')throw new VoiceError('VOICE_TRANSFER_UNAVAILABLE');
    // Claim exactly once before external action. A timeout is unknown, never a
    // retry with a second transfer. Each call can have only one transfer attempt.
    const claim=await mutateCall(kv,ctx.binding,ctx.canonical,'transfer:claim',record=>{record.transfer={state:'pending',toolId:id,connected:false};return {toolId:id,state:'pending',connected:false}});
    if(claim.toolId!==id)return {state:'already_requested',connected:false};
    const before=await kv.get('voice:call:'+ctx.canonical.id);
    if(before?.transfer?.state!=='pending')return before.transfer;
    const lock=await kv.set('voice:transfer-lock:'+ctx.canonical.id,'claimed',{nx:true,ex:86400});
    if(!lock)return {state:'pending',connected:false};
    let result;try{result=await provider.transfer(ctx.call,destination)}catch(e){result={state:e.code==='VOICE_TRANSFER_UNKNOWN'?'unknown':'failed',connected:false,callbackSuggested:true}}
    return mutateCall(kv,ctx.binding,ctx.canonical,op,record=>{record.transfer=result;return result});
  }
  throw new VoiceError('VOICE_TOOL_UNAVAILABLE');
}
async function processMessage(kv,message,{provider=createProvider()}={}){
  if(!message||typeof message!=='object'||Array.isArray(message))throw new VoiceError('VOICE_EVENT_INVALID');
  if(!['status-update','end-of-call-report','tool-calls'].includes(message.type))return {ignored:true};
  const ctx=await context(kv,message,provider);
  await ingest(kv,ctx.binding,ctx.canonical);
  if(message.type!=='tool-calls')return {ok:true};
  if(!Array.isArray(message.toolCallList)||message.toolCallList.length>8)throw new VoiceError('VOICE_TOOL_BATCH_INVALID');
  const results=[];
  for(const item of message.toolCallList){
    try{const result=await tool(kv,ctx,item,provider);results.push({toolCallId:item.id,result:JSON.stringify(result)})}
    catch(e){results.push({toolCallId:typeof item?.id==='string'?item.id.slice(0,100):'invalid',error:JSON.stringify({code:e instanceof VoiceError?e.code:'VOICE_TOOL_UNAVAILABLE',message:'The request could not be confirmed. Do not claim it completed. Offer a callback if appropriate.'})})}
  }
  return {results};
}
async function configure(kv,workspaceId,body,actor,{env=process.env,provider=createProvider({env})}={}){
  previewGate(env);identifier(workspaceId);
  if(!body||Object.keys(body).some(k=>!['policy','expectedRevision','purpose','numberId','assistantId'].includes(k)))throw new VoiceError('VOICE_CONFIG_INVALID');
  const policy=validatePolicy(body.policy),purpose=body.purpose||'internal';if(!['internal','demo'].includes(purpose))throw new VoiceError('VOICE_PURPOSE_INVALID');
  const key='voice:config:'+workspaceId,previous=await kv.get(key),workspace=await kv.get('workspace:'+workspaceId),agent=await kv.get('agent:'+workspaceId)||{};
  if(!workspace||!workspace.voiceTestWorkspace||workspace.stripeCustomerId||workspace.stripeSubscriptionId||workspace.deletedAt||workspace.status==='deleted')throw new VoiceError('VOICE_WORKSPACE_INVALID');
  if(!Number.isInteger(body.expectedRevision)||body.expectedRevision!==(previous?.revision||0))throw new VoiceError('VOICE_CONFIG_CONFLICT');
  const numberId=identifier(body.numberId||previous?.numberId||env[purpose==='demo'?'VAPI_DEMO_NUMBER_ID':'VAPI_INTERNAL_NUMBER_ID']),assistantId=body.assistantId||previous?.assistantId||env[purpose==='demo'?'VAPI_DEMO_ASSISTANT_ID':'VAPI_INTERNAL_ASSISTANT_ID']||null;
  if(env[purpose==='demo'?'VAPI_DEMO_NUMBER_ID':'VAPI_INTERNAL_NUMBER_ID']!==numberId||env[purpose==='demo'?'VAPI_DEMO_ASSISTANT_ID':'VAPI_INTERNAL_ASSISTANT_ID']!==assistantId)throw new VoiceError('VOICE_TEST_RESOURCE_REQUIRED');
  if(previous&&(previous.numberId!==numberId||previous.assistantId!==assistantId))throw new VoiceError('VOICE_RESOURCE_REASSIGNMENT_BLOCKED');
  if(previous&&previous.purpose!==purpose)throw new VoiceError('VOICE_PURPOSE_IMMUTABLE');
  if(purpose==='demo'&&(!workspace.demoVoiceWorkspace||workspace.stripeCustomerId||workspace.stripeSubscriptionId))throw new VoiceError('VOICE_DEMO_ISOLATION_REQUIRED');
  // Existing provider resources only: unknown assistant creation can leave an
  // orphan after a timeout. Onboarding new resources uses the CLI dry-run below.
  if(!assistantId)throw new VoiceError('VOICE_ASSISTANT_REQUIRED');identifier(assistantId);
  const occupied=await kv.get('voice:binding:'+assistantId),numberBinding=await kv.get('voice:number:'+numberId);
  if(occupied&&occupied.workspaceId!==workspaceId||numberBinding&&numberBinding.workspaceId!==workspaceId)throw new VoiceError('VOICE_RESOURCE_IN_USE');
  const number=await provider.retrieveNumber(numberId);
  if(number.assistantId&&number.assistantId!==assistantId)throw new VoiceError('VOICE_NUMBER_ALREADY_ROUTED');
  const desired=provider.assistantConfig(workspace,agent,policy,{demo:purpose==='demo'}),next={policy,purpose,numberId,assistantId,desiredHash:revision(desired),state:'syncing',revision:(previous?.revision||0)+1,updatedAt:Date.now(),agentRevision:Number(agent.updatedAt||0),verifiedAt:null};
  const audit={id:'voice_config_'+revision(next),workspaceId,actorEmail:actor.email,actorRole:actor.role,action:'voice_configuration_sync',section:'voice',at:Date.now(),meta:{revision:next.revision,purpose}};
  const binding={workspaceId,purpose,numberId,provider:'vapi',agentName:agent.name||'CallerCore',disabled:false};
  if(!await compareAndAuditBatch(kv,[{key,before:previous,after:next},{key:'voice:binding:'+assistantId,before:occupied,after:binding},{key:'voice:number:'+numberId,before:numberBinding,after:binding}],'audit:'+workspaceId,audit))throw new VoiceError('VOICE_CONFIG_CONFLICT');
  try{
    await provider.configureAgent(assistantId,desired);
    const saved=await provider.retrieveAgent(assistantId);
    if(!agentMatches(saved,desired))throw new VoiceError('VOICE_SYNC_UNVERIFIED');
    await provider.connectNumber(numberId,assistantId);
    const readback=await provider.retrieveNumber(numberId);if(readback.assistantId!==assistantId)throw new VoiceError('VOICE_SYNC_UNVERIFIED');
    const latestAgent=await kv.get('agent:'+workspaceId)||{};
    if(Number(latestAgent.updatedAt||0)!==next.agentRevision)throw new VoiceError('VOICE_CONFIG_CONFLICT');
    const ready={...next,state:'ready',verifiedAt:Date.now()};
    if(!await compareAndAuditBatch(kv,[{key,before:next,after:ready}],'audit:'+workspaceId,{...audit,id:audit.id+'_verified',action:'voice_configuration_verified',at:Date.now()}))throw new VoiceError('VOICE_CONFIG_CONFLICT');
    return safeStatus(ready,env);
  }catch(e){
    await compareAndAuditBatch(kv,[{key,before:next,after:{...next,state:'error',errorCode:e.code||'VOICE_SYNC_FAILED'}}],'audit:'+workspaceId,{...audit,id:audit.id+'_failed',action:'voice_configuration_failed',at:Date.now()});
    throw new VoiceError(e.code||'VOICE_SYNC_FAILED');
  }
}
async function control(kv,workspaceId,{paused,expectedRevision,fallbackNumber},actor,{env=process.env,provider=createProvider({env})}={}){
  previewGate(env);const key='voice:config:'+workspaceId,previous=await kv.get(key);
  if(!previous||!['ready','paused'].includes(previous.state)||!Number.isInteger(expectedRevision)||expectedRevision!==previous.revision||typeof paused!=='boolean')throw new VoiceError('VOICE_CONTROL_UNAVAILABLE');
  if(paused&&!E164.test(fallbackNumber||''))throw new VoiceError('VOICE_FALLBACK_REQUIRED');
  const number=await provider.retrieveNumber(previous.numberId);
  if(previous.state==='ready'&&number.assistantId!==previous.assistantId||previous.state==='paused'&&(number.assistantId||number.fallbackDestination?.number!==previous.fallbackNumber))throw new VoiceError('VOICE_STALE_PROVIDER_STATE');
  const pending={...previous,state:'syncing',revision:previous.revision+1,verifiedAt:null,updatedAt:Date.now()};
  const audit={id:'voice_control_'+revision(pending),workspaceId,actorEmail:actor.email,actorRole:actor.role,action:'voice_answering_change',section:'voice',at:Date.now(),meta:{paused,purpose:previous.purpose}};
  if(!await compareAndAuditBatch(kv,[{key,before:previous,after:pending}],'audit:'+workspaceId,audit))throw new VoiceError('VOICE_CONFIG_CONFLICT');
  try{
    if(paused)await provider.pauseNumber(previous.numberId,fallbackNumber);else await provider.resumeNumber(previous.numberId,previous.assistantId);
    const saved=await provider.retrieveNumber(previous.numberId);
    if(paused?!!saved.assistantId||saved.fallbackDestination?.number!==fallbackNumber:saved.assistantId!==previous.assistantId)throw new VoiceError('VOICE_SYNC_UNVERIFIED');
    const after={...pending,state:paused?'paused':'ready',fallbackNumber:paused?fallbackNumber:'',verifiedAt:Date.now()};
    if(!await compareAndAuditBatch(kv,[{key,before:pending,after}],'audit:'+workspaceId,{...audit,id:audit.id+'_verified',action:'voice_answering_verified'}))throw new VoiceError('VOICE_CONFIG_CONFLICT');return safeStatus(after,env);
  }catch(e){await compareAndAuditBatch(kv,[{key,before:pending,after:{...pending,state:'error',errorCode:e.code||'VOICE_CONTROL_FAILED'}}],'audit:'+workspaceId,{...audit,id:audit.id+'_failed',action:'voice_answering_failed'});throw new VoiceError(e.code||'VOICE_CONTROL_FAILED')}
}
module.exports={safeStatus,processMessage,configure,control,context,tool};
