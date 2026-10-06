const crypto=require('crypto');
const {requireSession}=require('../lib/auth');
const {kv}=require('../lib/kv');
const {previewGate,VoiceError,createProvider,identifier}=require('../lib/voice-provider');
const {safeStatus,configure,control}=require('../lib/voice-service');
const {compareAndAuditBatch}=require('../lib/config-transaction');
function sameOrigin(req){
  try{const origin=new URL(req.headers.origin||''),host=String(req.headers.host||'');return origin.protocol==='https:'&&origin.host===host}catch{return false}
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  const session=await requireSession(req,res);if(!session)return;
  if(req.method==='POST'&&!sameOrigin(req))return res.status(403).json({error:'Refresh this page before trying again'});
  const admin=session.role==='admin'&&!session.adminView;
  let workspaceId=session.workspaceId;
  try{
    if(admin&&req.query.workspaceId)workspaceId=identifier(req.query.workspaceId);
    if(req.method==='GET'){
      const record=await kv.get('voice:config:'+workspaceId);
      return res.status(200).json({voice:safeStatus(record),policy:record?.policy||null,...(admin?{operations:{assistantAssigned:!!record?.assistantId,numberAssigned:!!record?.numberId,errorCode:record?.errorCode||null,realCallAcceptance:false,recordingReview:'pending'}}:{})});
    }
    previewGate();
    const {rateLimit}=require('../lib/rate-limit');const limit=await rateLimit({scope:'voice-operations',identifier:session.workspaceId+':'+session.email,limit:15,windowSeconds:60,failClosed:true});if(limit.limited)return res.status(429).json({error:'Please wait a moment before checking again'});
    const body=req.body||{},action=req.query.action||'';
    if(Buffer.byteLength(JSON.stringify(body))>30000)return res.status(413).json({error:'Voice settings are too large'});
    if(action==='create-test-workspace'){
      if(!admin)return res.status(403).json({error:'Administrator access required'});
      if(Object.keys(body).some(k=>!['name','purpose'].includes(k))||typeof body.name!=='string'||!body.name.trim()||body.name.length>200||!['internal','demo'].includes(body.purpose))throw new VoiceError('VOICE_CONFIG_INVALID');
      const id='voice_test_'+crypto.randomUUID().replaceAll('-',''),now=Date.now();
      const workspace={id,name:body.name.trim(),voiceTestWorkspace:true,demoVoiceWorkspace:body.purpose==='demo',status:'active',plan:'starter',usage:{minutes:0},createdAt:now,updatedAt:now};
      if(!await compareAndAuditBatch(kv,[{key:'workspace:'+id,before:null,after:workspace}],'audit:'+id,{id:crypto.randomUUID(),workspaceId:id,actorEmail:session.email,actorRole:'admin',action:'voice_test_workspace_create',section:'voice',at:now,meta:{purpose:body.purpose}}))throw new VoiceError('VOICE_CONFIG_CONFLICT');
      return res.status(201).json({workspaceId:id,purpose:body.purpose});
    }
    if(action==='reconcile'){
      if(!admin)return res.status(403).json({error:'Administrator access required'});
      const pending=await kv.get('voice:pending:'+workspaceId)||{};if(typeof pending!=='object'||Array.isArray(pending))throw new VoiceError('VOICE_STATE_INVALID');
      let checked=0,failed=0;const {processMessage}=require('../lib/voice-service');
      for(const id of Object.keys(pending).slice(0,25)){const record=await kv.get('voice:call:'+id);if(!record||record.workspaceId!==workspaceId){failed++;continue}try{await processMessage(kv,{type:'end-of-call-report',call:{id:record.providerCallId}});checked++}catch{failed++}}
      return res.status(200).json({checked,failed,pending:Object.keys(await kv.get('voice:pending:'+workspaceId)||{}).length});
    }
    if(action==='configure'){
      if(!admin)return res.status(403).json({error:'Administrator access required'});
      return res.status(200).json({voice:await configure(kv,workspaceId,body,session)});
    }
    if(action==='control'){
      if(session.adminView||!['owner','admin'].includes(session.role))return res.status(403).json({error:'Owner access required'});
      if(Object.keys(body).some(k=>!['paused','expectedRevision','fallbackNumber'].includes(k)))throw new VoiceError('VOICE_CONFIG_INVALID');
      return res.status(200).json({voice:await control(kv,workspaceId,body,session)});
    }
    if(action==='verify'){
      if(session.adminView||!['owner','admin'].includes(session.role))return res.status(403).json({error:'Owner access required'});
      const key='voice:config:'+workspaceId,record=await kv.get(key);
      if(!record)throw new VoiceError('VOICE_CONTROL_UNAVAILABLE');
      const provider=createProvider(),number=await provider.retrieveNumber(record.numberId),agent=await provider.retrieveAgent(record.assistantId);
      const savedAgent=await kv.get('agent:'+workspaceId)||{};
      if(Number(savedAgent.updatedAt||0)!==record.agentRevision)throw new VoiceError('VOICE_CONFIG_OUT_OF_SYNC');
      const match=record.state==='paused'?!number.assistantId&&number.fallbackDestination?.number===record.fallbackNumber:number.assistantId===record.assistantId;
      const desired=provider.assistantConfig(await kv.get('workspace:'+workspaceId),savedAgent,record.policy,{demo:record.purpose==='demo'});
      if(!match||agent.model?.model!=='gpt-live-1'||agent.artifactPlan?.recordingEnabled!==false||agent.model?.speaker?.instructions!==desired.model.speaker.instructions||agent.model?.reasoner?.instructions!==desired.model.reasoner.instructions||agent.server?.credentialId!==desired.server.credentialId||agent.server?.url!==desired.server.url)throw new VoiceError('VOICE_SYNC_UNVERIFIED');
      const next={...record,verifiedAt:Date.now()};
      if(!await compareAndAuditBatch(kv,[{key,before:record,after:next}],'audit:'+workspaceId,{id:crypto.randomUUID(),workspaceId,actorEmail:session.email,actorRole:session.role,action:'voice_state_verified',section:'voice',at:Date.now()}))throw new VoiceError('VOICE_CONFIG_CONFLICT');
      return res.status(200).json({voice:safeStatus(next)});
    }
    return res.status(404).json({error:'Voice action not found'});
  }catch(e){const code=e instanceof VoiceError?e.code:'VOICE_REQUEST_UNCONFIRMED';return res.status(code==='VOICE_CONFIG_CONFLICT'?409:503).json({error:'The voice change could not be confirmed. Your saved settings are preserved; check the current state before trying again.',code})}
};
