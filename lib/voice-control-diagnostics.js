const {identifier,VoiceError,controlHost}=require('./voice-provider');
function shape(call){
 let url;try{url=new URL(call.monitor?.controlUrl||'')}catch{return {issue:'missing_or_malformed'}}
 const hostname=/^[a-z0-9.-]+\.vapi\.ai$/.test(url.hostname)||url.hostname==='api.vapi.ai'?url.hostname:'unapproved_host';
 const expected='/'+identifier(call.id)+'/control';
 const allowedHost=controlHost(url.hostname);
 const issue=url.protocol!=='https:'?'protocol':url.username||url.password?'userinfo':url.port?'port':!allowedHost?'host':url.search?'query':url.hash?'fragment':url.pathname!==expected?'path':'none';
 return {issue,hostname,pathMatches:url.pathname===expected,hasQuery:!!url.search,hasFragment:!!url.hash,hasPort:!!url.port,hasUserInfo:!!(url.username||url.password)};
}
async function inspectControl(kv,workspaceId,callId,provider){
 identifier(workspaceId);identifier(callId);
 const workspace=await kv.get('workspace:'+workspaceId),call=await kv.get('voice:call:'+callId),config=await kv.get('voice:config:'+workspaceId);
 if(!workspace?.voiceTestWorkspace||workspace.stripeCustomerId||workspace.stripeSubscriptionId||workspace.deletedAt||workspace.status==='deleted')throw new VoiceError('VOICE_WORKSPACE_INVALID');
 if(!call||call.workspaceId!==workspaceId||!config||call.assistantId!==config.assistantId||call.numberId!==config.numberId)throw new VoiceError('VOICE_ASSOCIATION_INVALID');
 const current=await provider.retrieveCall(identifier(call.providerCallId),{interactive:true});
 if(current.id!==call.providerCallId||current.assistantId!==config.assistantId||current.phoneNumberId!==config.numberId)throw new VoiceError('VOICE_ASSOCIATION_INVALID');
 return shape(current);
}
module.exports={shape,inspectControl};
