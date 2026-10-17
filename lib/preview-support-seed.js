const {compareAndSetConfig}=require('./config-transaction');

const SEED_PREFIX='seed_support_seed_';
const MAX_INDEXED_TICKETS=2000;

// Keep the Preview reset isolated to fictional support records. A request and its
// index entry must be committed together or a concurrent creation could vanish.
async function replacePreviewSupportSeed(kv,seedSupport,{compare=compareAndSetConfig,protectedWorkspaceIds=[]}={}){
  if(!Array.isArray(seedSupport)||seedSupport.some(t=>!t||!String(t.id||'').startsWith(SEED_PREFIX))||
    new Set(seedSupport.map(t=>t.id)).size!==seedSupport.length)
    throw new Error('Invalid Preview support fixture');
  for(let attempt=0;attempt<4;attempt++){
    const raw=await kv.get('support:index');
    if(raw!=null&&!Array.isArray(raw))throw new Error('Preview support history index is malformed; no support records changed');
    const index=raw||[];
    const protectedRecords=new Set();
    if(protectedWorkspaceIds.length)for(const id of index.filter(id=>String(id).startsWith(SEED_PREFIX))){
      const record=await kv.get('support:'+id);
      if(protectedWorkspaceIds.includes(record?.workspaceId))protectedRecords.add(id);
    }
    const oldSeedIds=index.filter(id=>String(id).startsWith(SEED_PREFIX)&&!protectedRecords.has(id)),
      retained=index.filter(id=>!String(id).startsWith(SEED_PREFIX)||protectedRecords.has(id)),
      next=[...seedSupport.map(t=>t.id),...retained];
    if(next.length>MAX_INDEXED_TICKETS)throw new Error('Preview support history reached its indexed capacity; no support records changed');
    const snapshots=await Promise.all(seedSupport.map(t=>kv.get('support:'+t.id)));
    const updates=[
      {key:'support:index',before:raw,after:next},
      ...seedSupport.map((ticket,i)=>({key:'support:'+ticket.id,before:snapshots[i],after:ticket}))
    ];
    if(await compare(kv,updates)){
      const seeded=new Set(seedSupport.map(t=>t.id));
      // Retired fictional records are unreachable once the index is committed.
      await Promise.allSettled(oldSeedIds.filter(id=>!seeded.has(id)).map(id=>kv.del('support:'+id)));
      return {seeded:seedSupport.length,retained:retained.length};
    }
  }
  throw new Error('Preview support history changed during reseeding; retry the Preview QA run');
}

module.exports={replacePreviewSupportSeed,SEED_PREFIX,MAX_INDEXED_TICKETS};
