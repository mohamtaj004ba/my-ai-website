const {revision}=require('./voice-policy');
const {previewGate,identifier}=require('./voice-provider');
const {reconcile}=require('./voice-reconcile');
// Request-lifetime recovery is opportunistic, not a durable scheduler. Missing
// work stays in Redis for the next event, maintenance run or admin check.
async function recoverAfterEvent(kv,providerCallId,{env=process.env,run=reconcile,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  previewGate(env);identifier(providerCallId);
  const id='voice_'+revision(providerCallId).slice(0,24),record=await kv.get('voice:call:'+id);
  if(!record||record.status!=='ended')return {scheduled:false};
  const ws=await kv.get('workspace:'+record.workspaceId);
  if(!ws?.voiceTestWorkspace||ws.stripeCustomerId||ws.stripeSubscriptionId||ws.deletedAt||ws.status==='deleted')return {scheduled:false};
  const pending=await kv.get('voice:pending:'+record.workspaceId);
  if(!pending||!Object.hasOwn(pending,id))return {scheduled:false};
  if(!await kv.set('voice:recovery-lock:'+id,'claimed',{nx:true,ex:90}))return {scheduled:false};
  let attempts=0;
  for(const delay of [2000,8000]){
    await sleep(delay);
    const latest=await kv.get('voice:pending:'+record.workspaceId);
    if(!latest||!Object.hasOwn(latest,id))break;
    await run(kv,record.workspaceId,{callId:id});attempts++;
  }
  return {scheduled:true,attempts};
}
async function maintenance(kv,{env=process.env,run=reconcile}={}){
  previewGate(env);
  const workspaces=new Set();
  for(const [assistant,number,purpose] of [[env.VAPI_INTERNAL_ASSISTANT_ID,env.VAPI_INTERNAL_NUMBER_ID,'internal'],[env.VAPI_DEMO_ASSISTANT_ID,env.VAPI_DEMO_NUMBER_ID,'demo']].filter(([assistant])=>assistant)){
    identifier(assistant);const binding=await kv.get('voice:binding:'+assistant);
    if(binding?.provider==='vapi'&&!binding.disabled&&binding.purpose===purpose&&binding.numberId===number&&number)workspaces.add(identifier(binding.workspaceId));
  }
  const results=[];
  for(const id of workspaces){try{results.push(await run(kv,id))}catch{results.push({checked:0,failed:1,pending:null,busy:false})}}
  return {workspaces:results.length,checked:results.reduce((n,r)=>n+r.checked,0),failed:results.reduce((n,r)=>n+r.failed,0),busy:results.some(r=>r.busy),pending:results.some(r=>r.pending==null)?null:results.reduce((n,r)=>n+r.pending,0)};
}
module.exports={recoverAfterEvent,maintenance};
