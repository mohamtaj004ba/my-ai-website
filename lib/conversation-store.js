const crypto=require('crypto');
const {conversationActivity,conversationContactKey,conversationSummary,paginateConversations}=require('./conversation-history');

const STORE_VERSION=2;

function workspacePart(workspaceId){
  const value=String(workspaceId||'').trim();
  if(!value||value.length>80)throw new Error('Invalid workspace ID');
  return value;
}

function legacyKey(workspaceId){return 'conversations:'+workspacePart(workspaceId)}
function indexKey(workspaceId){return 'conversations:v2:index:'+workspacePart(workspaceId)}
function detailKey(workspaceId,id){
  const value=String(id||'');
  if(!value||value.length>120)throw new Error('Invalid conversation ID');
  return 'conversations:v2:detail:'+workspacePart(workspaceId)+':'+crypto.createHash('sha256').update(value).digest('base64url');
}

function indexConversation(item){
  const summary=conversationSummary(item);
  return {...summary,contactKey:conversationContactKey(item)};
}

function validateItems(items){
  if(!Array.isArray(items))throw new Error('Conversation data is unavailable');
  const ids=new Set();
  for(const item of items){
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Conversation record is invalid');
    const id=String(item.id||'');
    if(!id||id.length>120||ids.has(id))throw new Error('Conversation ID is missing or duplicated');
    ids.add(id);
  }
  return items;
}

function validIndex(value){
  return !!value&&value.version===STORE_VERSION&&Array.isArray(value.conversations)&&value.conversations.every(item=>item&&typeof item==='object'&&!Array.isArray(item)&&String(item.id||''));
}

async function readIndex(kv,workspaceId){
  const value=await kv.get(indexKey(workspaceId));
  if(value===null||value===undefined)return null;
  if(!validIndex(value))throw new Error('Conversation index is unavailable');
  return value;
}

async function readLegacy(kv,workspaceId){
  const items=await kv.get(legacyKey(workspaceId));
  return validateItems(items===null||items===undefined?[]:items);
}

async function readConversationDirectory(kv,workspaceId){
  const index=await readIndex(kv,workspaceId);
  if(index)return {source:'normalized',conversations:index.conversations.map(conversationSummary)};
  const legacy=await readLegacy(kv,workspaceId);
  return {source:'legacy',conversations:legacy.map(conversationSummary)};
}

async function readConversationPage(kv,workspaceId,query={}){
  const index=await readIndex(kv,workspaceId);
  if(index&&String(query.q||'').trim())return paginateConversations(await readAllConversations(kv,workspaceId),query);
  if(index)return paginateConversations(index.conversations,query);
  return paginateConversations(await readLegacy(kv,workspaceId),query);
}

async function legacyById(kv,workspaceId,id){
  const items=await readLegacy(kv,workspaceId);
  return items.find(item=>String(item.id)===String(id))||null;
}

async function readConversation(kv,workspaceId,id){
  const index=await readIndex(kv,workspaceId);
  if(!index)return legacyById(kv,workspaceId,id);
  if(!index.conversations.some(item=>String(item.id)===String(id)))return null;
  const detail=await kv.get(detailKey(workspaceId,id));
  return detail&&typeof detail==='object'&&!Array.isArray(detail)?detail:legacyById(kv,workspaceId,id);
}

async function hydrateIndexedDetails(kv,workspaceId,indexItems){
  const rows=new Array(indexItems.length),missing=[];
  for(let offset=0;offset<indexItems.length;offset+=50){
    await Promise.all(indexItems.slice(offset,offset+50).map(async(item,batchIndex)=>{
      const position=offset+batchIndex,detail=await kv.get(detailKey(workspaceId,item.id));
      if(detail&&typeof detail==='object'&&!Array.isArray(detail))rows[position]=detail;
      else missing.push({position,id:String(item.id)});
    }));
  }
  if(missing.length){
    const legacy=new Map((await readLegacy(kv,workspaceId)).map(item=>[String(item.id),item]));
    for(const item of missing)rows[item.position]=legacy.get(item.id)||null;
  }
  return rows.filter(Boolean);
}

async function readContactConversations(kv,workspaceId,contactKey){
  const index=await readIndex(kv,workspaceId);
  if(!index)return (await readLegacy(kv,workspaceId)).filter(item=>conversationContactKey(item)===contactKey);
  const matches=index.conversations.filter(item=>String(item.contactKey||conversationContactKey(item))===contactKey);
  return hydrateIndexedDetails(kv,workspaceId,matches);
}

async function readAllConversations(kv,workspaceId){
  const index=await readIndex(kv,workspaceId);
  if(!index)return readLegacy(kv,workspaceId);
  return hydrateIndexedDetails(kv,workspaceId,index.conversations);
}

async function publishNormalizedConversations(kv,workspaceId,items,{now=Date.now()}={}){
  const conversations=validateItems(items),previous=await readIndex(kv,workspaceId),ids=new Set(conversations.map(item=>String(item.id)));
  for(let offset=0;offset<conversations.length;offset+=50){
    await Promise.all(conversations.slice(offset,offset+50).map(item=>kv.set(detailKey(workspaceId,item.id),item)));
  }
  const index={version:STORE_VERSION,updatedAt:Number(now)||Date.now(),conversations:conversations.map(indexConversation)};
  await kv.set(indexKey(workspaceId),index);
  if(previous){
    const obsolete=previous.conversations.filter(item=>!ids.has(String(item.id)));
    for(let offset=0;offset<obsolete.length;offset+=50)await Promise.all(obsolete.slice(offset,offset+50).map(item=>kv.del(detailKey(workspaceId,item.id))));
  }
  return index;
}

async function deleteNormalizedConversations(kv,workspaceId){
  const index=await readIndex(kv,workspaceId);
  if(index){
    for(let offset=0;offset<index.conversations.length;offset+=50)await Promise.all(index.conversations.slice(offset,offset+50).map(item=>kv.del(detailKey(workspaceId,item.id))));
  }
  await kv.del(indexKey(workspaceId));
}

module.exports={STORE_VERSION,legacyKey,indexKey,detailKey,indexConversation,readConversationDirectory,readConversationPage,readConversation,readContactConversations,readAllConversations,publishNormalizedConversations,deleteNormalizedConversations};
