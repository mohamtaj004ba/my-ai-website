const crypto=require('crypto');
const {legacyKey,indexKey,detailKey,readAllConversations,publishNormalizedConversations,deleteNormalizedConversations}=require('./conversation-store');
const {verifyDetailFidelity}=require('./conversation-migration');
const {compareAndSetWithDelete}=require('./config-transaction');

const REHEARSAL_MAX_CONVERSATIONS=250;

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object'){
    const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;
  }
  return value;
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}
function shadowWorkspaceId(sourceWorkspaceId,token){
  return 'qa_migration_'+crypto.createHash('sha256').update(String(sourceWorkspaceId)+'\n'+String(token)).digest('hex').slice(0,28);
}
async function snapshotNormalized(kv,workspaceId){
  const index=await kv.get(indexKey(workspaceId));
  if(index==null)return {index:null,details:[]};
  if(!index||typeof index!=='object'||Array.isArray(index)||!Array.isArray(index.conversations)||index.conversations.length>REHEARSAL_MAX_CONVERSATIONS)
    throw new Error('Rehearsal normalized index is invalid or exceeds capacity');
  const details=[];
  for(let offset=0;offset<index.conversations.length;offset+=50){
    const batch=index.conversations.slice(offset,offset+50),values=await Promise.all(batch.map(item=>kv.get(detailKey(workspaceId,item.id))));
    for(let i=0;i<batch.length;i++){
      if(values[i]==null)throw new Error('Rehearsal normalized detail is missing');
      details.push({key:detailKey(workspaceId,batch[i].id),value:values[i]});
    }
  }
  return {index,details};
}
async function rollbackNormalizedSnapshot(kv,workspaceId,snapshot){
  if(!snapshot||!snapshot.index||!Array.isArray(snapshot.details))throw new Error('Rehearsal rollback snapshot is invalid');
  const updates=[
    {key:indexKey(workspaceId),before:snapshot.index,after:null},
    ...snapshot.details.map(item=>({key:item.key,before:item.value,after:null}))
  ],deleteKeys=updates.map(item=>item.key);
  return compareAndSetWithDelete(kv,updates,{deleteKeys});
}
async function normalizedKeysAbsent(kv,workspaceId,snapshot){
  const values=await Promise.all([kv.get(indexKey(workspaceId)),...(snapshot?.details||[]).map(item=>kv.get(item.key))]);
  return values.every(value=>value==null);
}
async function runConversationMigrationRehearsal(kv,sourceWorkspaceId,{token=crypto.randomUUID(),now=Date.now()}={}){
  if(!kv||typeof kv.get!=='function'||typeof kv.set!=='function'||typeof kv.del!=='function'||typeof kv.eval!=='function')
    throw new Error('Conversation migration rehearsal storage is unavailable');
  const sourceId=String(sourceWorkspaceId||'').trim();
  if(!sourceId||sourceId.length>80)throw new Error('Conversation migration rehearsal workspace is invalid');
  const sourceKey=legacyKey(sourceId),sourceBefore=await kv.get(sourceKey);
  if(!Array.isArray(sourceBefore))throw new Error('Conversation migration rehearsal requires a legacy source');
  if(sourceBefore.length<1)throw new Error('Conversation migration rehearsal requires at least one conversation');
  if(sourceBefore.length>REHEARSAL_MAX_CONVERSATIONS)throw new Error('Conversation migration rehearsal source exceeds capacity');
  const sourceDigest=digest(sourceBefore),shadowId=shadowWorkspaceId(sourceId,token),shadowLegacyKey=legacyKey(shadowId),
    shadowIndexKey=indexKey(shadowId);
  const [existingLegacy,existingIndex]=await Promise.all([kv.get(shadowLegacyKey),kv.get(shadowIndexKey)]);
  if(existingLegacy!=null||existingIndex!=null)throw new Error('Conversation migration rehearsal namespace is already in use');

  let mainSnapshot=null,conflictSnapshot=null,rollbackApplied=false,rollbackReadEquivalent=false,conflictBlocked=false,
    conflictStatePreserved=false,detailFidelityComplete=false,publishReadEquivalent=false,shadowCleaned=false;
  try{
    await kv.set(shadowLegacyKey,sourceBefore);
    const beforeRead=await readAllConversations(kv,shadowId);
    if(digest(beforeRead)!==sourceDigest)throw new Error('Legacy rehearsal read is not equivalent to the source');

    await publishNormalizedConversations(kv,shadowId,sourceBefore,{now});
    const [shadowLegacy,publishedIndex,afterRead]=await Promise.all([
      kv.get(shadowLegacyKey),kv.get(shadowIndexKey),readAllConversations(kv,shadowId)
    ]);
    if(digest(shadowLegacy)!==sourceDigest)throw new Error('Normalized publication changed the rehearsal legacy source');
    publishReadEquivalent=digest(afterRead)===sourceDigest;
    if(!publishReadEquivalent)throw new Error('Normalized rehearsal read is not equivalent to the legacy source');
    const fidelity=await verifyDetailFidelity(kv,shadowId,shadowLegacy,publishedIndex);
    detailFidelityComplete=fidelity.checked===true&&fidelity.complete===true&&fidelity.matched===sourceBefore.length;
    if(!detailFidelityComplete)throw new Error('Normalized rehearsal detail fidelity could not be confirmed');

    mainSnapshot=await snapshotNormalized(kv,shadowId);
    rollbackApplied=await rollbackNormalizedSnapshot(kv,shadowId,mainSnapshot);
    if(!rollbackApplied)throw new Error('Rehearsal rollback encountered an unexpected concurrent change');
    const rolledBackRead=await readAllConversations(kv,shadowId);
    rollbackReadEquivalent=digest(rolledBackRead)===sourceDigest&&await normalizedKeysAbsent(kv,shadowId,mainSnapshot);
    if(!rollbackReadEquivalent)throw new Error('Rehearsal rollback did not restore legacy-only reads');

    await publishNormalizedConversations(kv,shadowId,sourceBefore,{now:Number(now)+1});
    conflictSnapshot=await snapshotNormalized(kv,shadowId);
    const target=conflictSnapshot.details[0];
    const concurrent={...target.value,__qaMigrationConcurrentMarker:true};
    await kv.set(target.key,concurrent);
    conflictBlocked=!(await rollbackNormalizedSnapshot(kv,shadowId,conflictSnapshot));
    const [indexAfterConflict,detailAfterConflict]=await Promise.all([kv.get(shadowIndexKey),kv.get(target.key)]);
    conflictStatePreserved=conflictBlocked&&digest(indexAfterConflict)===digest(conflictSnapshot.index)&&
      detailAfterConflict&&detailAfterConflict.__qaMigrationConcurrentMarker===true;
    if(!conflictStatePreserved)throw new Error('Rehearsal rollback did not fail closed on a concurrent normalized change');

    await deleteNormalizedConversations(kv,shadowId);
    await kv.del(shadowLegacyKey);
    shadowCleaned=(await kv.get(shadowLegacyKey))==null&&(await kv.get(shadowIndexKey))==null;
    if(!shadowCleaned)throw new Error('Conversation migration rehearsal shadow data was not cleaned');

    const sourceAfter=await kv.get(sourceKey),sourcePreserved=digest(sourceAfter)===sourceDigest;
    if(!sourcePreserved)throw new Error('Conversation migration rehearsal changed the source legacy data');
    return {
      mode:'preview_rehearsal',writeScope:'shadow_only',productionExecutorReachable:false,migrationExecutorReachable:false,
      conversationCount:sourceBefore.length,legacySourcePreserved:true,publishReadEquivalent,detailFidelityComplete,
      rollbackApplied,rollbackReadEquivalent,concurrentChangeBlocked:conflictBlocked,concurrentStatePreserved:conflictStatePreserved,
      shadowCleaned,complete:true
    };
  }finally{
    if(!shadowCleaned){
      try{await deleteNormalizedConversations(kv,shadowId)}catch(_){}
      try{await kv.del(shadowLegacyKey)}catch(_){}
    }
  }
}

module.exports={REHEARSAL_MAX_CONVERSATIONS,shadowWorkspaceId,snapshotNormalized,rollbackNormalizedSnapshot,runConversationMigrationRehearsal};
