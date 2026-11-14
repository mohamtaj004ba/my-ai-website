const crypto=require('crypto');
const {compareAndSetWithDelete}=require('./config-transaction');
const {staleUnconvertedProspectEligible,deidentifyProspectForAnalytics,planStaleProspectDeidentification}=require('./prospect-retention');

function cleanEmail(value){return String(value||'').trim().toLowerCase()}
function prospectEmailLookupKey(email){
  const value=cleanEmail(email);
  return value?'site:prospect:email:'+crypto.createHash('sha256').update(value).digest('hex'):'';
}

async function applyStaleProspectDeidentification(kv,prospect,now=Date.now(),{consentActive=false}={}){
  if(!kv||typeof kv.get!=='function'||typeof kv.eval!=='function')throw new Error('Retention storage is unavailable');
  if(!staleUnconvertedProspectEligible(prospect,now,{consentActive}))return {ok:false,eligible:false,conflict:false};
  const id=String(prospect.id),recordKey='site:prospect:'+id,current=await kv.get(recordKey);
  if(current==null)return {ok:false,eligible:true,conflict:true,reason:'missing'};
  if(!current||typeof current!=='object'||Array.isArray(current)||String(current.id||'')!==id)throw new Error('Stored prospect record is malformed');
  if(JSON.stringify(current)!==JSON.stringify(prospect))return {ok:false,eligible:true,conflict:true,reason:'changed'};
  if(!staleUnconvertedProspectEligible(current,now,{consentActive}))return {ok:false,eligible:false,conflict:false};
  const after=deidentifyProspectForAnalytics(current,now),updates=[{key:recordKey,before:current,after}],deleteKeys=[];
  const lookupKey=prospectEmailLookupKey(current.email);
  if(lookupKey){
    const owner=await kv.get(lookupKey);
    if(owner!=null&&String(owner)!==id)throw Object.assign(new Error('Prospect email lookup points to another record'),{code:'PROSPECT_EMAIL_LOOKUP_CONFLICT'});
    if(owner!=null){updates.push({key:lookupKey,before:owner,after:null});deleteKeys.push(lookupKey)}
  }
  const saved=await compareAndSetWithDelete(kv,updates,{deleteKeys});
  if(!saved)return {ok:false,eligible:true,conflict:true,reason:'changed'};
  return {ok:true,eligible:true,conflict:false,prospect:after,emailLookupRemoved:deleteKeys.length===1};
}


async function scanStaleProspectRetention(kv,now=Date.now(),{limit=25,consentIds=[]}={}){
  if(!kv||typeof kv.lrange!=='function'||typeof kv.get!=='function')throw new Error('Retention storage is unavailable');
  const rawIds=await kv.lrange('site:prospect:index',0,1999);
  if(!Array.isArray(rawIds)||rawIds.length>2000)throw new Error('Prospect retention index is unavailable or exceeds capacity');
  const ids=rawIds.map(id=>String(id||'').trim());
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw new Error('Prospect retention index is malformed');
  const records=[];
  for(let offset=0;offset<ids.length;offset+=100){
    const batchIds=ids.slice(offset,offset+100),batch=await Promise.all(batchIds.map(id=>kv.get('site:prospect:'+id)));
    for(let i=0;i<batch.length;i++){
      const record=batch[i];
      if(!record)throw new Error('Prospect retention index references a missing record');
      if(typeof record!=='object'||Array.isArray(record)||String(record.id||'')!==batchIds[i])throw new Error('Prospect retention index references a malformed record');
      records.push(record);
    }
  }
  const plan=planStaleProspectDeidentification(records,now,{limit,consentIds});
  return {...plan,indexed:ids.length};
}

module.exports={prospectEmailLookupKey,applyStaleProspectDeidentification,scanStaleProspectRetention};

