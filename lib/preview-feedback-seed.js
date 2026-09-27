const {compareAndSetConfig}=require('./config-transaction');

const SEED_PREFIX='seed_feedback_seed_';
const GLOBAL_LIMIT=1500;
const WORKSPACE_LIMIT=250;

function previewFeedbackWorkspaceKey(workspaceId){return 'ai-feedback:workspace:'+workspaceId}
function validIndex(raw,label){
  if(raw!=null&&(!Array.isArray(raw)||raw.some(id=>typeof id!=='string'||!id||!id.trim())||new Set(raw).size!==raw.length))
    throw new Error('Preview '+label+' index is malformed; no feedback records changed');
  return raw||[];
}

// Make the Preview reset atomic across the global index, each fake workspace
// index and all replacement records. Real client feedback is never pruned.
async function replacePreviewFeedbackSeed(kv,seedFeedback,{compare=compareAndSetConfig}={}){
  if(!Array.isArray(seedFeedback)||seedFeedback.some(item=>!item||typeof item.id!=='string'||
    !item.id.startsWith(SEED_PREFIX)||typeof item.workspaceId!=='string'||
    !item.workspaceId.startsWith('seed_'))||
    new Set(seedFeedback.map(item=>item.id)).size!==seedFeedback.length)
    throw new Error('Invalid Preview feedback fixture');
  const grouped=new Map();
  for(const item of seedFeedback){
    if(!grouped.has(item.workspaceId))grouped.set(item.workspaceId,[]);
    grouped.get(item.workspaceId).push(item);
  }
  for(let attempt=0;attempt<4;attempt++){
    const globalRaw=await kv.get('ai-feedback:index'),
      globalIds=validIndex(globalRaw,'feedback'),
      stale=globalIds.filter(id=>id.startsWith(SEED_PREFIX)),
      retained=globalIds.filter(id=>!id.startsWith(SEED_PREFIX)),
      nextGlobal=[...seedFeedback.map(item=>item.id),...retained];
    if(nextGlobal.length>GLOBAL_LIMIT)throw new Error('Preview feedback history reached indexed capacity; no feedback records changed');
    const snapshots=await Promise.all(seedFeedback.map(item=>kv.get('ai-feedback:'+item.id)));
    const updates=[{key:'ai-feedback:index',before:globalRaw,after:nextGlobal},
      ...seedFeedback.map((item,i)=>({key:'ai-feedback:'+item.id,before:snapshots[i],after:item}))];
    for(const [workspaceId,items] of grouped){
      const key=previewFeedbackWorkspaceKey(workspaceId),raw=await kv.get(key),
        old=validIndex(raw,'workspace feedback'),
        next=[...items.map(item=>item.id),...old.filter(id=>!id.startsWith(SEED_PREFIX))];
      if(next.length>WORKSPACE_LIMIT)throw new Error('Preview workspace feedback reached indexed capacity; no feedback records changed');
      updates.push({key,before:raw,after:next});
    }
    if(await compare(kv,updates)){
      const seeded=new Set(seedFeedback.map(item=>item.id));
      await Promise.allSettled(stale.filter(id=>!seeded.has(id)).map(id=>kv.del('ai-feedback:'+id)));
      return {seeded:seedFeedback.length,retained:retained.length};
    }
  }
  throw new Error('Preview feedback history changed during reseeding; retry the Preview QA run');
}

module.exports={replacePreviewFeedbackSeed,SEED_PREFIX,GLOBAL_LIMIT,WORKSPACE_LIMIT};
