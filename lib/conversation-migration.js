const crypto=require('crypto');
const {STORE_VERSION,legacyKey,indexKey,detailKey,indexConversation}=require('./conversation-store');

const WORKSPACE_LIMIT=2000;
const DEFAULT_BATCH=50;
const MAX_BATCH=100;
const MAX_DETAIL_BATCH=25;
const MAX_DETAILS_PER_WORKSPACE=1000;

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
function canonicalJson(value){
  const parsed=JSON.parse(JSON.stringify(value));
  const sort=node=>{
    if(Array.isArray(node))return node.map(sort);
    if(node&&typeof node==='object'){
      const out={};for(const key of Object.keys(node).sort())out[key]=sort(node[key]);return out;
    }
    return node;
  };
  return JSON.stringify(sort(parsed));
}
async function verifyDetailFidelity(kv,workspaceId,legacyRaw,indexRaw){
  const legacy=cleanLegacy(legacyRaw),normalized=cleanIndex(indexRaw);
  if(!legacy.present||!normalized.present)return {
    checked:false,complete:false,state:'not_applicable',expected:normalized.items.length,checkedRecords:0,
    matched:0,missing:0,malformed:0,mismatched:0,capacityExceeded:false
  };
  if(Math.max(legacy.items.length,normalized.items.length)>MAX_DETAILS_PER_WORKSPACE)return {
    checked:false,complete:false,state:'capacity_exceeded',expected:normalized.items.length,checkedRecords:0,
    matched:0,missing:0,malformed:0,mismatched:0,capacityExceeded:true
  };
  const legacyById=new Map(legacy.items.map(item=>[String(item.id),item]));
  let checkedRecords=0,matched=0,missing=0,malformed=0,mismatched=0;
  for(let offset=0;offset<normalized.items.length;offset+=50){
    const batch=normalized.items.slice(offset,offset+50),details=await Promise.all(batch.map(item=>kv.get(detailKey(workspaceId,item.id))));
    for(let i=0;i<batch.length;i++){
      const summary=batch[i],detail=details[i],id=String(summary.id);checkedRecords++;
      if(detail==null){missing++;continue}
      if(!detail||typeof detail!=='object'||Array.isArray(detail)||String(detail.id||'')!==id){malformed++;continue}
      const legacyItem=legacyById.get(id);
      if(!legacyItem||canonicalJson(detail)!==canonicalJson(legacyItem)){mismatched++;continue}
      matched++;
    }
  }
  const summaryAligned=summariesAligned(legacy.items,normalized.items),
    complete=summaryAligned&&legacy.items.length===normalized.items.length&&matched===legacy.items.length&&!missing&&!malformed&&!mismatched;
  return {
    checked:true,complete,state:complete?'aligned':'drifted',expected:normalized.items.length,checkedRecords,
    matched,missing,malformed,mismatched,capacityExceeded:false
  };
}
async function analyzeWorkspace(kv,workspaceId,{verifyDetails=false}={}){
  const [legacy,index]=await Promise.all([kv.get(legacyKey(workspaceId)),kv.get(indexKey(workspaceId))]),
    row=workspaceStatus(legacy,index),fidelity=verifyDetails?await verifyDetailFidelity(kv,workspaceId,legacy,index):null;
  const summaryBlocking=['drifted','rollback_source_missing','malformed'].includes(row.status),
    detailBlocking=!!fidelity&&(fidelity.capacityExceeded||(fidelity.checked&&!fidelity.complete));
  return {...row,blocking:summaryBlocking||detailBlocking,fidelity};
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
    const row=await analyzeWorkspace(kv,id,{verifyDetails:true}),f=row.fidelity||{};
    return {
      mode:'dry_run',writeActionsEnabled:false,migrationExecutorReachable:false,legacyPreserved:true,
      workspaceState:row.status,legacyConversations:Number(row.legacyCount||0),normalizedConversations:Number(row.normalizedCount||0),
      summaryAligned:row.status==='aligned',aligned:row.status==='aligned'&&f.complete===true,
      migrationCandidate:row.status==='legacy_only',blocking:row.blocking===true,
      detailFidelityChecked:f.checked===true,detailFidelityComplete:f.complete===true,detailState:String(f.state||'not_applicable'),
      detailRecordsExpected:Number(f.expected||0),detailRecordsChecked:Number(f.checkedRecords||0),detailRecordsMatched:Number(f.matched||0),
      detailMissing:Number(f.missing||0),detailMalformed:Number(f.malformed||0),detailMismatched:Number(f.mismatched||0),
      detailCapacityExceeded:f.capacityExceeded===true
    };
  }catch(err){
    if(err&&err.code)throw err;
    return {
      mode:'dry_run',writeActionsEnabled:false,migrationExecutorReachable:false,legacyPreserved:true,
      workspaceState:'malformed',legacyConversations:0,normalizedConversations:0,summaryAligned:false,aligned:false,
      migrationCandidate:false,blocking:true,detailFidelityChecked:false,detailFidelityComplete:false,detailState:'unavailable',
      detailRecordsExpected:0,detailRecordsChecked:0,detailRecordsMatched:0,detailMissing:0,detailMalformed:0,detailMismatched:0,
      detailCapacityExceeded:false
    };
  }
}

async function scanConversationMigrationBatch(kv,{cursor='',limit=DEFAULT_BATCH,verifyDetails=false}={}){
  if(!kv||typeof kv.get!=='function')throw new Error('Conversation migration storage is unavailable');
  const ids=cleanWorkspaceIds(await kv.get('workspace:index')),signature=cursorSignature(ids),offset=decodeCursor(cursor,signature,ids.length),
    requested=Math.max(1,Math.min(MAX_BATCH,Number.parseInt(limit,10)||DEFAULT_BATCH)),
    size=verifyDetails?Math.min(MAX_DETAIL_BATCH,requested):requested,selected=ids.slice(offset,offset+size);
  const counts={aligned:0,legacyOnly:0,drifted:0,rollbackSourceMissing:0,emptyUninitialized:0,malformed:0},
    detailCounts={checkedWorkspaces:0,alignedWorkspaces:0,driftedWorkspaces:0,capacityExceededWorkspaces:0,
      recordsExpected:0,recordsChecked:0,recordsMatched:0,missingRecords:0,malformedRecords:0,mismatchedRecords:0};
  let legacyConversations=0,normalizedConversations=0,blocking=0;
  for(let start=0;start<selected.length;start+=(verifyDetails?5:25)){
    const slice=selected.slice(start,start+(verifyDetails?5:25)),rows=await Promise.all(slice.map(async id=>{
      try{return await analyzeWorkspace(kv,id,{verifyDetails})}
      catch(_){return {status:'malformed',legacyCount:0,normalizedCount:0,blocking:true,fidelity:null}}
    }));
    for(const row of rows){
      legacyConversations+=Number(row.legacyCount||0);normalizedConversations+=Number(row.normalizedCount||0);
      if(row.status==='aligned')counts.aligned++;
      else if(row.status==='legacy_only')counts.legacyOnly++;
      else if(row.status==='drifted')counts.drifted++;
      else if(row.status==='rollback_source_missing')counts.rollbackSourceMissing++;
      else if(row.status==='empty_uninitialized')counts.emptyUninitialized++;
      else counts.malformed++;
      if(row.blocking)blocking++;
      const f=row.fidelity;
      if(f){
        if(f.checked)detailCounts.checkedWorkspaces++;
        if(f.complete)detailCounts.alignedWorkspaces++;
        else if(f.capacityExceeded)detailCounts.capacityExceededWorkspaces++;
        else if(f.checked)detailCounts.driftedWorkspaces++;
        detailCounts.recordsExpected+=Number(f.expected||0);detailCounts.recordsChecked+=Number(f.checkedRecords||0);
        detailCounts.recordsMatched+=Number(f.matched||0);detailCounts.missingRecords+=Number(f.missing||0);
        detailCounts.malformedRecords+=Number(f.malformed||0);detailCounts.mismatchedRecords+=Number(f.mismatched||0);
      }
    }
  }
  const nextOffset=offset+selected.length,nextCursor=nextOffset<ids.length?encodeCursor(nextOffset,signature):null,
    detailVerificationComplete=verifyDetails&&nextCursor===null&&detailCounts.capacityExceededWorkspaces===0,
    migrationReady=nextCursor===null&&!blocking&&!counts.legacyOnly&&(!verifyDetails||detailVerificationComplete);
  return {
    mode:'dry_run',writeActionsEnabled:false,migrationExecutorReachable:false,legacyPreserved:true,
    detailFidelityChecked:verifyDetails===true,detailVerificationComplete,migrationReady,
    scanned:selected.length,totalWorkspaces:ids.length,complete:nextCursor===null,nextCursor,
    migrationCandidates:counts.legacyOnly,blockingWorkspaces:blocking,legacyConversations,normalizedConversations,counts,detailCounts,
    status:blocking?'error':counts.legacyOnly||!migrationReady?'warning':'ok'
  };
}

module.exports={WORKSPACE_LIMIT,DEFAULT_BATCH,MAX_BATCH,MAX_DETAIL_BATCH,MAX_DETAILS_PER_WORKSPACE,workspaceStatus,verifyDetailFidelity,scanConversationMigrationWorkspace,scanConversationMigrationBatch};
