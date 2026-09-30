const crypto=require('crypto');
const {STORE_VERSION,legacyKey,indexKey,indexConversation}=require('./conversation-store');

const WORKSPACE_LIMIT=2000;
const DEFAULT_BATCH=50;
const MAX_BATCH=100;

function cleanWorkspaceIds(value){
  if(value==null)return [];
  if(!Array.isArray(value)||value.length>WORKSPACE_LIMIT)throw new Error('Conversation migration workspace index is invalid or exceeds capacity');
  const ids=value.map(id=>String(id||'').trim());
  if(ids.some(id=>!id||id.length>80)||new Set(ids).size!==ids.length)throw new Error('Conversation migration workspace index is malformed');
  return ids;
}
function cleanLegacy(value){
  if(value==null)return {present:false,items:[]};
  if(!Array.isArray(value))throw new Error('Legacy conversation source is malformed');
  const ids=new Set();
  for(const item of value){
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Legacy conversation record is malformed');
    const id=String(item.id||'');
    if(!id||id.length>120||ids.has(id))throw new Error('Legacy conversation ids are malformed');
    ids.add(id);
  }
  return {present:true,items:value};
}
function cleanIndex(value){
  if(value==null)return {present:false,items:[]};
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==STORE_VERSION||!Array.isArray(value.conversations))
    throw new Error('Normalized conversation index is malformed');
  const ids=new Set();
  for(const item of value.conversations){
    const id=String(item&&item.id||'');
    if(!item||typeof item!=='object'||Array.isArray(item)||!id||id.length>120||ids.has(id))
      throw new Error('Normalized conversation summaries are malformed');
    ids.add(id);
  }
  return {present:true,items:value.conversations};
}
function text(value){return value==null?'':String(value)}
function number(value){const n=Number(value);return Number.isFinite(n)?n:null}
function summaryShape(value={}){
  return {
    id:text(value.id),name:text(value.name),phone:text(value.phone),address:text(value.address),status:text(value.status),
    last:text(value.last),time:text(value.time),createdAt:number(value.createdAt),updatedAt:number(value.updatedAt),
    messageCount:Number.isSafeInteger(Number(value.messageCount))&&Number(value.messageCount)>=0?Number(value.messageCount):0,
    activityAt:number(value.activityAt),contactKey:text(value.contactKey)
  };
}
function summariesAligned(legacy,index){
  if(legacy.length!==index.length)return false;
  const byId=new Map(index.map(item=>[String(item.id),summaryShape(item)]));
  if(byId.size!==index.length)return false;
  return legacy.every(item=>{
    const expected=summaryShape(indexConversation(item)),actual=byId.get(String(item.id));
    return !!actual&&JSON.stringify(actual)===JSON.stringify(expected);
  });
}
function workspaceStatus(legacyRaw,indexRaw){
  const legacy=cleanLegacy(legacyRaw),normalized=cleanIndex(indexRaw);
  if(!legacy.present&&!normalized.present)return {status:'empty_uninitialized',legacyCount:0,normalizedCount:0};
  if(!legacy.present&&normalized.present)return {status:'rollback_source_missing',legacyCount:0,normalizedCount:normalized.items.length};
  if(legacy.present&&!normalized.present)return {status:'legacy_only',legacyCount:legacy.items.length,normalizedCount:0};
  return {
    status:summariesAligned(legacy.items,normalized.items)?'aligned':'drifted',
    legacyCount:legacy.items.length,normalizedCount:normalized.items.length
  };
}
function cursorSignature(ids){
  return crypto.createHash('sha256').update(ids.join('\n')).digest('base64url').slice(0,16);
}
function encodeCursor(offset,signature){return Buffer.from(JSON.stringify({o:offset,s:signature})).toString('base64url')}
function decodeCursor(raw,signature,total){
  if(!raw)return 0;
  try{
    const value=String(raw);if(value.length>512)throw new Error('invalid');
    const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    if(!Number.isSafeInteger(parsed.o)||parsed.o<0||parsed.o>total||parsed.s!==signature)throw new Error('invalid');
    return parsed.o;
  }catch(_){const err=new Error('Invalid or expired conversation migration cursor');err.code='INVALID_CURSOR';throw err}
}
async function scanConversationMigrationWorkspace(kv,workspaceId){
  if(!kv||typeof kv.get!=='function')throw new Error('Conversation migration storage is unavailable');
  const id=String(workspaceId||'').trim();
  if(!id||id.length>80)throw new Error('Conversation migration workspace is invalid');
  const ids=cleanWorkspaceIds(await kv.get('workspace:index'));
  if(!ids.includes(id)){const err=new Error('Conversation migration workspace was not found');err.code='WORKSPACE_NOT_FOUND';throw err}
  try{
    const [legacy,index]=await Promise.all([kv.get(legacyKey(id)),kv.get(indexKey(id))]),row=workspaceStatus(legacy,index);
    return {
      mode:'dry_run',writeActionsEnabled:false,migrationExecutorReachable:false,legacyPreserved:true,detailFidelityChecked:false,
      workspaceState:row.status,legacyConversations:Number(row.legacyCount||0),normalizedConversations:Number(row.normalizedCount||0),
      aligned:row.status==='aligned',migrationCandidate:row.status==='legacy_only',
      blocking:['drifted','rollback_source_missing','malformed'].includes(row.status)
    };
  }catch(err){
    if(err&&err.code)throw err;
    return {
      mode:'dry_run',writeActionsEnabled:false,migrationExecutorReachable:false,legacyPreserved:true,detailFidelityChecked:false,
      workspaceState:'malformed',legacyConversations:0,normalizedConversations:0,aligned:false,migrationCandidate:false,blocking:true
    };
  }
}

async function scanConversationMigrationBatch(kv,{cursor='',limit=DEFAULT_BATCH}={}){
  if(!kv||typeof kv.get!=='function')throw new Error('Conversation migration storage is unavailable');
  const ids=cleanWorkspaceIds(await kv.get('workspace:index')),signature=cursorSignature(ids),offset=decodeCursor(cursor,signature,ids.length),
    size=Math.max(1,Math.min(MAX_BATCH,Number.parseInt(limit,10)||DEFAULT_BATCH)),selected=ids.slice(offset,offset+size);
  const counts={aligned:0,legacyOnly:0,drifted:0,rollbackSourceMissing:0,emptyUninitialized:0,malformed:0};
  let legacyConversations=0,normalizedConversations=0;
  for(let start=0;start<selected.length;start+=25){
    const slice=selected.slice(start,start+25),rows=await Promise.all(slice.map(async id=>{
      try{
        const [legacy,index]=await Promise.all([kv.get(legacyKey(id)),kv.get(indexKey(id))]);
        return workspaceStatus(legacy,index);
      }catch(_){return {status:'malformed',legacyCount:0,normalizedCount:0}}
    }));
    for(const row of rows){
      legacyConversations+=Number(row.legacyCount||0);normalizedConversations+=Number(row.normalizedCount||0);
      if(row.status==='aligned')counts.aligned++;
      else if(row.status==='legacy_only')counts.legacyOnly++;
      else if(row.status==='drifted')counts.drifted++;
      else if(row.status==='rollback_source_missing')counts.rollbackSourceMissing++;
      else if(row.status==='empty_uninitialized')counts.emptyUninitialized++;
      else counts.malformed++;
    }
  }
  const nextOffset=offset+selected.length,nextCursor=nextOffset<ids.length?encodeCursor(nextOffset,signature):null,
    blocking=counts.drifted+counts.rollbackSourceMissing+counts.malformed;
  return {
    mode:'dry_run',writeActionsEnabled:false,migrationExecutorReachable:false,legacyPreserved:true,detailFidelityChecked:false,
    scanned:selected.length,totalWorkspaces:ids.length,complete:nextCursor===null,nextCursor,
    migrationCandidates:counts.legacyOnly,blockingWorkspaces:blocking,legacyConversations,normalizedConversations,counts,
    status:blocking?'error':counts.legacyOnly?'warning':'ok'
  };
}

module.exports={WORKSPACE_LIMIT,DEFAULT_BATCH,MAX_BATCH,workspaceStatus,scanConversationMigrationWorkspace,scanConversationMigrationBatch};
