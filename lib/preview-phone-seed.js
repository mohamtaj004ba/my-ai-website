const {compareAndSetConfig}=require('./config-transaction');

const MAX_PHONE_RECORDS=500;

// The Preview fixture may rebuild its own primary number and fictional demo
// numbers. It must never displace or mutate unrelated phone assignments.
async function replacePreviewPhoneSeed(kv,workspaceId,primaryPhone,seedPhones,{compare=compareAndSetConfig,protectedWorkspaceIds=[]}={}){
  if(typeof workspaceId!=='string'||!workspaceId||workspaceId.startsWith('seed_')||
    !primaryPhone||primaryPhone.workspaceId!==workspaceId||
    !Array.isArray(seedPhones)||seedPhones.some(phone=>!phone||typeof phone.id!=='string'||
      !phone.id||typeof phone.workspaceId!=='string'||!phone.workspaceId.startsWith('seed_')))
    throw new Error('Invalid Preview phone fixture');
  const seeded=[primaryPhone,...seedPhones];
  if(seeded.some(x=>typeof x.id!=='string'||!x.id)||new Set(seeded.map(x=>x.id)).size!==seeded.length)
    throw new Error('Duplicate Preview phone fixture');
  for(let attempt=0;attempt<4;attempt++){
    const raw=await kv.get('phone:index');
    if(raw!=null&&(!Array.isArray(raw)||raw.some(x=>!x||typeof x!=='object'||
      typeof x.id!=='string'||!x.id||typeof x.workspaceId!=='string'||!x.workspaceId)||
      new Set(raw.map(x=>x.id)).size!==raw.length))
      throw new Error('Preview phone inventory is malformed; no phone records changed');
    const retained=(raw||[]).filter(x=>x.workspaceId!==workspaceId&&(!x.workspaceId.startsWith('seed_')||protectedWorkspaceIds.includes(x.workspaceId))&&x.id!==primaryPhone.id);
    const next=[...seeded,...retained];
    if(next.length>MAX_PHONE_RECORDS)throw new Error('Preview phone inventory reached indexed capacity; no phone records changed');
    if(await compare(kv,[{key:'phone:index',before:raw,after:next}]))
      return {seeded:seeded.length,retained:retained.length};
  }
  throw new Error('Preview phone inventory changed while reseeding; retry the Preview QA run');
}

module.exports={replacePreviewPhoneSeed,MAX_PHONE_RECORDS};
