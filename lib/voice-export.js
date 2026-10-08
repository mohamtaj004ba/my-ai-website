// Read-only recovery data. Importing this bundle must never activate answering.
const CALL_ID=/^voice_[a-f0-9]{24}$/;
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function validateVoiceExport(bundle,workspaceId){
  if(!object(bundle)||bundle.version!==1||bundle.workspaceId!==workspaceId||bundle.requiresProviderReconciliation!==true)throw new Error('Voice export identity unavailable');
  if(bundle.configuration!==null&&!object(bundle.configuration))throw new Error('Voice configuration unavailable');
  if(!Array.isArray(bundle.contacts)||bundle.contacts.some(x=>!object(x)||typeof x.id!=='string'||!x.id)||new Set(bundle.contacts.map(x=>x.id)).size!==bundle.contacts.length)throw new Error('Voice contacts unavailable');
  if(!object(bundle.usage)||!object(bundle.usage.calls)||bundle.usage.overageEnabled!==false)throw new Error('Voice usage unavailable');
  if(!object(bundle.pending)||!object(bundle.journals)||!object(bundle.followups)||!Array.isArray(bundle.calls))throw new Error('Voice recovery state unavailable');
  const ids=new Set(),byId=new Map();
  for(const call of bundle.calls){
    if(!object(call)||!CALL_ID.test(call.id)||call.workspaceId!==workspaceId||ids.has(call.id)||!['internal','demo'].includes(call.purpose))throw new Error('Voice call association unavailable');
    ids.add(call.id);
    byId.set(call.id,call);
    if(!object(bundle.journals[call.id]))throw new Error('Voice call journal unavailable');
  }
  if(Object.keys(bundle.journals).some(id=>!ids.has(id)))throw new Error('Voice journal association unavailable');
  for(const [id,value] of Object.entries(bundle.pending))if(!ids.has(id)||value!==true)throw new Error('Voice pending association unavailable');
  for(const [id,value] of Object.entries(bundle.usage.calls)){
    const call=byId.get(id);
    if(!call||!object(value)||!Number.isFinite(value.seconds)||value.seconds<0||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month)||value.purpose!==call.purpose||call.durationVerified!==true||value.seconds!==call.durationSeconds)throw new Error('Voice usage association unavailable');
  }
  return bundle;
}
async function buildVoiceExport(kv,workspaceId,views){
  const keys=['voice:config:','voice:contacts:','voice:usage:','voice:pending:','followup:state:'].map(prefix=>prefix+workspaceId);
  const before=await Promise.all(keys.map(key=>kv.get(key)));
  const ids=views.filter(x=>x.source==='phone'||x.source==='demo_phone').map(x=>x.id);
  if(ids.length>10000||ids.some(id=>!CALL_ID.test(id))||new Set(ids).size!==ids.length)throw new Error('Voice call directory unavailable');
  const calls=[],journals={};
  // Bounded read batches avoid one promise per retained call at once.
  for(let offset=0;offset<ids.length;offset+=8){
    const rows=await Promise.all(ids.slice(offset,offset+8).map(async id=>({id,values:await Promise.all([kv.get('voice:call:'+id),kv.get('voice:journal:'+id)])})));
    for(const {id,values} of rows){
      if(!object(values[0])||values[0].id!==id||values[0].workspaceId!==workspaceId||!object(values[1]))throw new Error('Voice call recovery source unavailable');
      calls.push(values[0]);journals[id]=values[1];
    }
  }
  const after=await Promise.all(keys.map(key=>kv.get(key)));
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Voice state changed during export; retry');
  return validateVoiceExport({version:1,workspaceId,configuration:before[0]??null,contacts:before[1]??[],usage:before[2]??{calls:{},overageEnabled:false},pending:before[3]??{},followups:before[4]??{},calls,journals,requiresProviderReconciliation:true},workspaceId);
}
module.exports={buildVoiceExport,validateVoiceExport};
