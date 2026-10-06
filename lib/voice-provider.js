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
function agentMatches(saved,desired){
  return !!saved&&saved.model?.provider===desired.model?.provider&&saved.model?.model===desired.model?.model&&saved.model?.speaker?.instructions===desired.model?.speaker?.instructions&&saved.model?.reasoner?.provider===desired.model?.reasoner?.provider&&saved.model?.reasoner?.model===desired.model?.reasoner?.model&&saved.model?.reasoner?.instructions===desired.model?.reasoner?.instructions&&saved.server?.credentialId===desired.server?.credentialId&&saved.server?.url===desired.server?.url&&saved.artifactPlan?.recordingEnabled===false&&saved.voice?.provider===desired.voice?.provider&&saved.voice?.voiceId===desired.voice?.voiceId&&revision(saved.model?.tools)===revision(desired.model?.tools)&&saved.maxDurationSeconds===desired.maxDurationSeconds&&saved.firstMessageMode===desired.firstMessageMode&&saved.firstMessage===desired.firstMessage;
}
function createProvider({env=process.env,fetchImpl=global.fetch}={}){
  const key=env.VAPI_PRIVATE_KEY||env.VAPI_API_KEY;
  async function request(path,{method='GET',body}={}){
    previewGate(env);if(!key)throw new VoiceError('VOICE_CREDENTIALS_MISSING');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetchImpl('https://api.vapi.ai'+path,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:'error'});
      if(!response.ok)throw new VoiceError(response.status===401||response.status===403?'VOICE_ACCESS_REQUIRED':'VOICE_PROVIDER_UNAVAILABLE');
      if(response.status===204)return {deleted:true};
      const data=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))throw new VoiceError('VOICE_RESPONSE_INVALID');return data;
    }catch(e){if(e instanceof VoiceError)throw e;throw new VoiceError(e.name==='AbortError'?'VOICE_PROVIDER_TIMEOUT':'VOICE_PROVIDER_UNAVAILABLE')}finally{clearTimeout(timer)}
  }
  function assistantConfig(workspace,agent,policy,{demo=false}={}){
    previewGate(env);
    if(!env.VAPI_SERVER_CREDENTIAL_ID||!env.CALLERCORE_VOICE_WEBHOOK_SECRET||env.CALLERCORE_VOICE_WEBHOOK_SECRET.length<32)throw new VoiceError('VOICE_WEBHOOK_CREDENTIAL_MISSING');
    const url=new URL(env.CALLERCORE_VOICE_CALLBACK_URL||'');
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/voice-webhook'||!url.hostname.endsWith('.vercel.app'))throw new VoiceError('VOICE_CALLBACK_INVALID');
    const p=prompts(workspace,agent,policy,{demo});
    return {name:'CallerCore '+(demo?'demo':'internal')+' '+String(workspace.id).slice(0,36),model:{provider:'openai',model:'gpt-live-1',speaker:{instructions:p.speaker},reasoner:{provider:'openai',model:'gpt-5.6-terra',reasoningEffort:'low',instructions:p.reasoner},tools:[
      ...require('./voice-tools').definitions().map(fn=>({type:'function',function:fn,server:{url:url.href,credentialId:env.VAPI_SERVER_CREDENTIAL_ID}})),{type:'endCall'}
    ]},voice:{provider:'openai',voiceId:policy.voice},firstMessageMode:'assistant-speaks-first',firstMessage:agent.openingMessage||'Thank you for calling. How can I help?',maxDurationSeconds:demo?Math.min(policy.maxDurationSeconds,300):policy.maxDurationSeconds,artifactPlan:{recordingEnabled:false},server:{url:url.href,credentialId:env.VAPI_SERVER_CREDENTIAL_ID},serverMessages:['status-update','end-of-call-report','tool-calls']};
  }
  return {
    kind:'vapi',capabilities:{model:'gpt-live-1',fullDuplex:true,blindTransfer:true,warmTransfer:false,recordingConsent:false},assistantConfig,
    configureAgent:async(id,config)=>request(id?'/assistant/'+identifier(id):'/assistant',{method:id?'PATCH':'POST',body:config}),
    retrieveAgent:async id=>request('/assistant/'+identifier(id)),
    retrieveNumber:async id=>request('/phone-number/'+identifier(id)),
    retrieveCall:async id=>request('/call/'+identifier(id)),
    connectNumber:async(numberId,assistantId)=>request('/phone-number/'+identifier(numberId),{method:'PATCH',body:{assistantId:identifier(assistantId)}}),
    // Pause detaches the assistant and uses a separately approved fallback. No
    // assumptions about default/org assistants; read-back is verified by service.
    pauseNumber:async(numberId,fallback)=>{if(!E164.test(fallback||''))throw new VoiceError('VOICE_FALLBACK_REQUIRED');return request('/phone-number/'+identifier(numberId),{method:'PATCH',body:{assistantId:null,fallbackDestination:{type:'number',number:fallback}}})},
    resumeNumber:async(numberId,assistantId)=>request('/phone-number/'+identifier(numberId),{method:'PATCH',body:{assistantId:identifier(assistantId),fallbackDestination:null}}),
    deleteAgent:async id=>request('/assistant/'+identifier(id),{method:'DELETE'}),
    transfer:async(call,destination)=>{
      previewGate(env);if(!key)throw new VoiceError('VOICE_CREDENTIALS_MISSING');if(!['twilio','vapi'].includes(call.phoneCallProvider)||!['inboundPhoneCall','outboundPhoneCall'].includes(call.type))throw new VoiceError('VOICE_TRANSFER_TRANSPORT_UNSUPPORTED');if(!E164.test(destination||''))throw new VoiceError('VOICE_DESTINATION_INVALID');
      const url=new URL(call.monitor?.controlUrl||'');
      if(url.protocol!=='https:'||!(url.hostname==='api.vapi.ai'||/^[a-z0-9-]+-phone-call-websocket\.vapi\.ai$/.test(url.hostname))||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/'+identifier(call.id)+'/control')throw new VoiceError('VOICE_CONTROL_INVALID');
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
  const transcript=messages.filter(m=>['user','assistant'].includes(m?.role)&&typeof m.message==='string').slice(0,1000).map(m=>({speaker:m.role==='user'?'Caller':'CallerCore',text:redact(m.message).slice(0,8000)}));
  return {id:'voice_'+revision(call.id).slice(0,24),providerCallId:call.id,assistantId:call.assistantId,numberId:call.phoneNumberId,status:final?'ended':call.status==='in-progress'?'active':'connecting',startedAt:Number.isFinite(start)?start:null,endedAt:final&&Number.isFinite(end)?end:null,durationVerified,durationSeconds,calledNumber:E164.test(call.phoneNumber?.number||'')?call.phoneNumber.number:'',callerNumber:E164.test(call.customer?.number||'')?call.customer.number:'',endedReason:redact(call.endedReason).slice(0,160),transcript,transcriptState:transcript.length?'available':'pending',summary:typeof call.analysis?.summary==='string'?redact(call.analysis.summary).slice(0,4000):'',recordingAvailable:!!artifacts.recordingUrl};
}
module.exports={VoiceError,previewGate,authenticated,createProvider,normalizedCall,identifier,agentMatches};
