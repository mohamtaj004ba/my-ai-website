const {VoiceError}=require('./voice-provider');
const {processMessage}=require('./voice-service');
// Drain a bounded part of the durable queue. One slow provider must not turn
// an administrator refresh into an unbounded function invocation.
async function reconcile(kv,workspaceId,{process=processMessage,now=Date.now}={}){
  const workspace=await kv.get('workspace:'+workspaceId);
  if(!workspace?.voiceTestWorkspace||workspace.stripeCustomerId||workspace.stripeSubscriptionId||workspace.deletedAt||workspace.status==='deleted')throw new VoiceError('VOICE_WORKSPACE_INVALID');
  const pending=await kv.get('voice:pending:'+workspaceId)||{};
  if(typeof pending!=='object'||Array.isArray(pending))throw new VoiceError('VOICE_STATE_INVALID');
  let checked=0,failed=0;const started=now();
  for(const id of Object.keys(pending).slice(0,5)){
    if(now()-started>=20000)break;
    const record=await kv.get('voice:call:'+id);
    if(!record||record.workspaceId!==workspaceId){failed++;continue}
    try{await process(kv,{type:'end-of-call-report',call:{id:record.providerCallId}});checked++}catch{failed++}
  }
  const remaining=await kv.get('voice:pending:'+workspaceId)||{};
  if(typeof remaining!=='object'||Array.isArray(remaining))throw new VoiceError('VOICE_STATE_INVALID');
  return {checked,failed,pending:Object.keys(remaining).length};
}
module.exports={reconcile};
