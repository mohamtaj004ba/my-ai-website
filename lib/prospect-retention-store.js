const crypto=require('crypto');
const {compareAndSetWithDelete}=require('./config-transaction');
const {staleUnconvertedProspectEligible,deidentifyProspectForAnalytics}=require('./prospect-retention');

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

module.exports={prospectEmailLookupKey,applyStaleProspectDeidentification};
