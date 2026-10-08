const {prompts,E164,revision}=require('./voice-policy');
const crypto=require('crypto');
const {redact}=require('./voice-privacy');
class VoiceError extends Error{constructor(code){super(code);this.code=code}}
function previewGate(env=process.env){if(env.VERCEL_ENV!=='preview'||env.CALLERCORE_VOICE_PREVIEW_ENABLED!=='true')throw new VoiceError('VOICE_LAUNCH_GATED')}
function authenticated(headers,secret){
  if(typeof secret!=='string'||secret.length<32)return false;
  const value=String(headers?.authorization||'');const expected='Bearer '+secret;
  const a=Buffer.from(value),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function identifier(id){if(typeof id!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new VoiceError('VOICE_RESOURCE_INVALID');return id}
function ordered(value){return Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value}
// Exact current host verified from the bound isolated call's provider read.
// Keep legacy documented hosts; do not accept arbitrary vapi.ai subdomains.
function controlHost(host){return host==='api.vapi.ai'||host==='phone-call-websocket.aws-us-west-2-backend-production1.vapi.ai'||/^[a-z0-9-]+-phone-call-websocket\.vapi\.ai$/.test(host)}
function agentMatches(saved,desired){
  if(desired.model?.model==='gpt-4.1-mini'){
    if(saved?.model?.speaker||saved?.model?.reasoner)return false;
    for(const key of ['provider','model','language'])if(saved?.transcriber?.[key]!==desired.transcriber[key])return false;
    if(saved?.startSpeakingPlan?.smartEndpointingPlan)return false;
    if(saved?.startSpeakingPlan?.waitSeconds!==desired.startSpeakingPlan.waitSeconds)return false;
    for(const key of ['onPunctuationSeconds','onNoPunctuationSeconds','onNumberSeconds'])if(saved?.startSpeakingPlan?.transcriptionEndpointingPlan?.[key]!==desired.startSpeakingPlan.transcriptionEndpointingPlan[key])return false;
    for(const key of ['numWords','voiceSeconds','backoffSeconds'])if(saved?.stopSpeakingPlan?.[key]!==desired.stopSpeakingPlan[key])return false;
    if(revision(ordered(saved?.model?.messages))!==revision(ordered(desired.model.messages))||saved?.voice?.version!==desired.voice.version||saved?.silenceTimeoutSeconds!==desired.silenceTimeoutSeconds)return false;
  }
  if(revision(ordered(saved?.model?.speaker?.personalityPacks||[]))!==revision(ordered(desired.model?.speaker?.personalityPacks||[])))return false;
  if(saved?.model?.reasoner?.reasoningEffort!==desired.model?.reasoner?.reasoningEffort)return false;
  if(!Array.isArray(saved?.serverMessages)||!Array.isArray(desired.serverMessages)||!desired.serverMessages.every(type=>saved.serverMessages.includes(type)))return false;
  return !!saved&&saved.model?.provider===desired.model?.provider&&saved.model?.model===desired.model?.model&&saved.model?.speaker?.instructions===desired.model?.speaker?.instructions&&saved.model?.reasoner?.provider===desired.model?.reasoner?.provider&&saved.model?.reasoner?.model===desired.model?.reasoner?.model&&saved.model?.reasoner?.instructions===desired.model?.reasoner?.instructions&&saved.server?.credentialId===desired.server?.credentialId&&saved.server?.url===desired.server?.url&&saved.artifactPlan?.recordingEnabled===false&&saved.voice?.provider===desired.voice?.provider&&saved.voice?.voiceId===desired.voice?.voiceId&&revision(ordered(saved.model?.tools))===revision(ordered(desired.model?.tools))&&saved.backgroundSound===desired.backgroundSound&&saved.maxDurationSeconds===desired.maxDurationSeconds&&saved.firstMessageMode===desired.firstMessageMode&&saved.firstMessage===desired.firstMessage;
}
function createProvider({env=process.env,fetchImpl=global.fetch}={}){
  const key=env.VAPI_PRIVATE_KEY||env.VAPI_API_KEY;
  async function request(path,{method='GET',body,interactive=false}={}){
    previewGate(env);if(!key)throw new VoiceError('VOICE_CREDENTIALS_MISSING');
    // Live tool verification is a read, not a mutation. Bound it to two short
    // attempts so one stalled provider lookup cannot stall the caller for 8s.
    // Never retry uncertain writes, denied access, malformed data or rate limits.
    const liveRead=interactive&&method==='GET',attempts=liveRead?2:1;
    for(let attempt=0;attempt<attempts;attempt++){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),liveRead?1500:8000);
      try{
        const response=await fetchImpl('https://api.vapi.ai'+path,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:'error'});
        if(!response.ok){const error=new VoiceError(response.status===401||response.status===403?'VOICE_ACCESS_REQUIRED':'VOICE_PROVIDER_UNAVAILABLE');error.retryable=response.status>=500;throw error}
        if(response.status===204)return {deleted:true};
        let data;try{data=await response.json()}catch(e){if(e.name==='SyntaxError')throw new VoiceError('VOICE_RESPONSE_INVALID');throw e}
        if(!data||typeof data!=='object'||Array.isArray(data))throw new VoiceError('VOICE_RESPONSE_INVALID');return data;
      }catch(e){
        const error=e instanceof VoiceError?e:new VoiceError(e.name==='AbortError'?'VOICE_PROVIDER_TIMEOUT':'VOICE_PROVIDER_UNAVAILABLE');
        if(attempt+1<attempts&&(e.retryable||!(e instanceof VoiceError)))continue;
        throw error;
      }finally{clearTimeout(timer)}
    }
  }
  function assistantConfig(workspace,agent,policy,{demo=false,pipeline='gpt-live'}={}){
    previewGate(env);
    if(!env.VAPI_SERVER_CREDENTIAL_ID||!env.CALLERCORE_VOICE_WEBHOOK_SECRET||env.CALLERCORE_VOICE_WEBHOOK_SECRET.length<32)throw new VoiceError('VOICE_WEBHOOK_CREDENTIAL_MISSING');
    const url=new URL(env.CALLERCORE_VOICE_CALLBACK_URL||'');
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/voice-webhook'||!url.hostname.endsWith('.vercel.app'))throw new VoiceError('VOICE_CALLBACK_INVALID');
    if(!['gpt-live','classic-comparison'].includes(pipeline)||demo&&pipeline!=='gpt-live')throw new VoiceError('VOICE_PIPELINE_INVALID');
    const p=prompts(workspace,agent,policy,{demo});
    const config={name:('CallerCore '+(demo?'demo':'internal')+' '+String(workspace.id)).slice(0,40),model:{provider:'openai',model:'gpt-live-1',speaker:{instructions:p.speaker,personalityPacks:['unhurried']},reasoner:{provider:'openai',model:'gpt-5.6-terra',reasoningEffort:'low',instructions:p.reasoner},tools:[
      ...require('./voice-tools').definitions().map(fn=>({type:'function',function:fn,server:{url:url.href,credentialId:env.VAPI_SERVER_CREDENTIAL_ID}})),{type:'endCall'}
    ]},backgroundSound:'off',voice:{provider:'openai',voiceId:policy.voice.toLowerCase()},firstMessageMode:'assistant-speaks-first',firstMessage:[policy.disclosure,agent.openingMessage||('Thank you for calling '+workspace.name+'.'),'How can I help?'].filter(Boolean).join(' '),maxDurationSeconds:demo?Math.min(policy.maxDurationSeconds,300):policy.maxDurationSeconds,artifactPlan:{recordingEnabled:false},server:{url:url.href,credentialId:env.VAPI_SERVER_CREDENTIAL_ID},serverMessages:['status-update','end-of-call-report','tool-calls']};
    if(pipeline==='classic-comparison'){
      config.model={provider:'openai',model:'gpt-4.1-mini',messages:[{role:'system',content:require('./voice-classic').classicPrompt(workspace,agent,policy)}],tools:config.model.tools};
      config.transcriber={provider:'deepgram',model:'flux-general-en',language:'en'};
      config.voice={provider:'vapi',voiceId:'Elliot',version:2};
      config.startSpeakingPlan={waitSeconds:0.1,transcriptionEndpointingPlan:{onPunctuationSeconds:0.1,onNoPunctuationSeconds:1.5,onNumberSeconds:0.5}};
      config.stopSpeakingPlan={numWords:0,voiceSeconds:0.2,backoffSeconds:0.6};
      config.silenceTimeoutSeconds=26;
    }
    return config;
  }
  return {
    kind:'vapi',capabilities:{model:'gpt-live-1',fullDuplex:true,blindTransfer:true,warmTransfer:false,recordingConsent:false},assistantConfig,
    configureAgent:async(id,config)=>request(id?'/assistant/'+identifier(id):'/assistant',{method:id?'PATCH':'POST',body:config}),
    retrieveAgent:async id=>request('/assistant/'+identifier(id)),
    retrieveNumber:async id=>request('/phone-number/'+identifier(id)),
    retrieveCall:async(id,options={})=>request('/call/'+identifier(id),{interactive:options.interactive===true}),
    connectNumber:async(numberId,assistantId)=>request('/phone-number/'+identifier(numberId),{method:'PATCH',body:{assistantId:identifier(assistantId)}}),
    // Pause detaches the assistant and uses a separately approved fallback. No
    // assumptions about default/org assistants; read-back is verified by service.
    pauseNumber:async(numberId,fallback)=>{if(!E164.test(fallback||''))throw new VoiceError('VOICE_FALLBACK_REQUIRED');return request('/phone-number/'+identifier(numberId),{method:'PATCH',body:{assistantId:null,fallbackDestination:{type:'number',number:fallback}}})},
    resumeNumber:async(numberId,assistantId)=>request('/phone-number/'+identifier(numberId),{method:'PATCH',body:{assistantId:identifier(assistantId),fallbackDestination:null}}),
    deleteAgent:async id=>request('/assistant/'+identifier(id),{method:'DELETE'}),
    appendContext:async(call,content)=>{
      previewGate(env);if(!key)throw new VoiceError('VOICE_CREDENTIALS_MISSING');
      if(typeof content!=='string'||!content.trim()||content.length>16000)throw new VoiceError('VOICE_CONTEXT_INVALID');
      const url=new URL(call.monitor?.controlUrl||'');
      if(url.protocol!=='https:'||!controlHost(url.hostname)||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/'+identifier(call.id)+'/control')throw new VoiceError('VOICE_CONTROL_INVALID');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);
      try{const r=await fetchImpl(url.href,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({type:'append-context',kind:'thinking',content}),signal:controller.signal,redirect:'error'});if(r.status===401||r.status===403)throw new VoiceError('VOICE_ACCESS_REQUIRED');if(!r.ok||(await r.json()).status!=='ok')throw new VoiceError('VOICE_CONTEXT_UNCONFIRMED');return {submitted:true}}catch(e){throw e instanceof VoiceError?e:new VoiceError(e.name==='AbortError'?'VOICE_CONTEXT_TIMEOUT':'VOICE_CONTEXT_UNCONFIRMED')}finally{clearTimeout(timer)}
    },
    transfer:async(call,destination)=>{
      previewGate(env);if(!key)throw new VoiceError('VOICE_CREDENTIALS_MISSING');if(!['twilio','vapi'].includes(call.phoneCallProvider)||!['inboundPhoneCall','outboundPhoneCall'].includes(call.type))throw new VoiceError('VOICE_TRANSFER_TRANSPORT_UNSUPPORTED');if(!E164.test(destination||''))throw new VoiceError('VOICE_DESTINATION_INVALID');
      const url=new URL(call.monitor?.controlUrl||'');
      if(url.protocol!=='https:'||!controlHost(url.hostname)||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/'+identifier(call.id)+'/control')throw new VoiceError('VOICE_CONTROL_INVALID');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
      try{const r=await fetchImpl(url.href,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({type:'transfer',destination:{type:'number',number:destination,transferPlan:{mode:'blind-transfer'}}}),signal:controller.signal,redirect:'error'});if(!r.ok)throw new VoiceError('VOICE_TRANSFER_FAILED');return {state:'requested',connected:false}}catch(e){throw new VoiceError(e.name==='AbortError'?'VOICE_TRANSFER_UNKNOWN':'VOICE_TRANSFER_FAILED')}finally{clearTimeout(timer)}
    }
  };
}
function normalizedCall(call){
  if(!call||typeof call!=='object'||Array.isArray(call))throw new VoiceError('VOICE_CALL_INVALID');
  identifier(call.id);identifier(call.assistantId);identifier(call.phoneNumberId);
  const start=Date.parse(call.startedAt||''),end=Date.parse(call.endedAt||''),final=call.status==='ended';
  if(final&&Number.isFinite(start)&&Number.isFinite(end)&&(end<start||end-start>86400000))throw new VoiceError('VOICE_DURATION_INVALID');
  const durationVerified=final&&Number.isFinite(start)&&Number.isFinite(end),durationSeconds=durationVerified?Math.round((end-start)/1000):0;
  const artifacts=call.artifact||{},messages=Array.isArray(artifacts.messages)?artifacts.messages:[];
  const transcript=messages.filter(m=>['user','assistant','bot'].includes(m?.role)&&typeof m.message==='string').slice(0,1000).map(m=>({speaker:m.role==='user'?'Caller':'CallerCore',text:redact(m.message).slice(0,8000)}));
  return {id:'voice_'+revision(call.id).slice(0,24),providerCallId:call.id,assistantId:call.assistantId,numberId:call.phoneNumberId,status:final?'ended':call.status==='in-progress'?'active':'connecting',startedAt:Number.isFinite(start)?start:null,endedAt:final&&Number.isFinite(end)?end:null,durationVerified,durationSeconds,calledNumber:E164.test(call.phoneNumber?.number||'')?call.phoneNumber.number:'',callerNumber:E164.test(call.customer?.number||'')?call.customer.number:'',endedReason:redact(call.endedReason).slice(0,160),transcript,transcriptState:transcript.length?'available':'pending',summary:typeof call.analysis?.summary==='string'?redact(call.analysis.summary).slice(0,4000):'',recordingAvailable:!!artifacts.recordingUrl};
}
module.exports={VoiceError,previewGate,authenticated,createProvider,normalizedCall,identifier,agentMatches,controlHost};

