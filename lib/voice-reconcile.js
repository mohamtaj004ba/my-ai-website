const crypto=require('crypto');
const {VoiceError}=require('./voice-provider');
const {processMessage}=require('./voice-service');
const {compareAndAuditBatch}=require('./config-transaction');
const RELEASE=`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`;
function object(value){if(value==null)return {};if(typeof value!=='object'||Array.isArray(value))throw new VoiceError('VOICE_STATE_INVALID');return value}
// Persist a fair cursor: one permanently missing transcript must not starve
// newer calls. All call/CRM writes still use the canonical idempotent processor.
async function reconcile(kv,workspaceId,{process=processMessage,now=Date.now,callId=null}={}){
  const workspace=await kv.get('workspace:'+workspaceId);
  if(!workspace?.voiceTestWorkspace||workspace.stripeCustomerId||workspace.stripeSubscriptionId||workspace.deletedAt||workspace.status==='deleted')throw new VoiceError('VOICE_WORKSPACE_INVALID');
  const lockKey='voice:reconcile-lock:'+workspaceId,token=crypto.randomUUID();
  if(!await kv.set(lockKey,token,{nx:true,ex:60}))return {checked:0,failed:0,pending:Object.keys(object(await kv.get('voice:pending:'+workspaceId))).length,busy:true};
  try{
    const pending=object(await kv.get('voice:pending:'+workspaceId)),key='voice:recovery:'+workspaceId,before=await kv.get(key),state=object(before);
    const ids=Object.keys(pending);let start=ids.indexOf(state.cursor)+1;if(start>=ids.length)start=0;
    const ordered=callId?(ids.includes(callId)?[callId]:[]):[...ids.slice(start),...ids.slice(0,start)].slice(0,5);
    let checked=0,failed=0,cursor=state.cursor||null;const started=now();
    for(const id of ordered){
      if(now()-started>=20000)break;
      cursor=id;
      const record=await kv.get('voice:call:'+id);
      if(!record||record.workspaceId!==workspaceId){failed++;continue}
      try{await process(kv,{type:'end-of-call-report',call:{id:record.providerCallId}});checked++}catch{failed++}
    }
    const remaining=object(await kv.get('voice:pending:'+workspaceId)),at=now(),count=Object.keys(remaining).length;
    const after={cursor:callId?state.cursor||null:cursor,lastRunAt:at,checked,failed,pending:count,state:failed?'attention':count?'waiting':'idle'};
    if(!await compareAndAuditBatch(kv,[{key,before,after}],'audit:'+workspaceId,{id:crypto.randomUUID(),workspaceId,actorRole:'voice_service',action:'voice_details_reconciled',section:'voice',at,meta:{checked,failed,pending:count}}))throw new VoiceError('VOICE_CONFIG_CONFLICT');
    return {checked,failed,pending:count,busy:false};
  }finally{await kv.eval(RELEASE,[lockKey],[token])}
}
module.exports={reconcile,RELEASE};
