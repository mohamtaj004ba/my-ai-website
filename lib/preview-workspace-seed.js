const {compareAndSetConfig}=require('./config-transaction');

const MAX_WORKSPACES=2000;
const SEED_PREFIX='seed_';

// Rebuild the admin fixture directory while keeping every real workspace ID.
// The Preview dataset is not allowed to silently change admin coverage.
async function replacePreviewWorkspaceIndex(kv,workspaceId,adminIds,{compare=compareAndSetConfig,protectedWorkspaceIds=[]}={}){
  if(typeof workspaceId!=='string'||!workspaceId||workspaceId.startsWith(SEED_PREFIX)||
    !Array.isArray(adminIds)||adminIds.some(id=>typeof id!=='string'||!id.startsWith(SEED_PREFIX))||
    new Set(adminIds).size!==adminIds.length)
    throw new Error('Invalid Preview workspace fixture');
  for(let attempt=0;attempt<4;attempt++){
    const raw=await kv.get('workspace:index');
    if(raw!=null&&(!Array.isArray(raw)||raw.some(id=>typeof id!=='string'||!id||!id.trim())||
      new Set(raw).size!==raw.length))
      throw new Error('Preview workspace directory is malformed; no workspace index changes were made');
    const retained=(raw||[]).filter(id=>id!==workspaceId&&(!id.startsWith(SEED_PREFIX)||protectedWorkspaceIds.includes(id))&&!adminIds.includes(id)),
      next=[workspaceId,...adminIds,...retained];
    if(next.length>MAX_WORKSPACES)
      throw new Error('Preview workspace directory reached indexed capacity; no workspace index changes were made');
    if(await compare(kv,[{key:'workspace:index',before:raw,after:next}]))
      return {seeded:adminIds.length+1,retained:retained.length};
  }
  throw new Error('Preview workspace directory changed during reseeding; retry the Preview QA run');
}

module.exports={replacePreviewWorkspaceIndex,MAX_WORKSPACES,SEED_PREFIX};
