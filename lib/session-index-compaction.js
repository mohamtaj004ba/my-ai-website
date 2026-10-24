const {SITE_SESSION_RETENTION_SECONDS}=require('./analytics-retention-policy');

const SESSION_INDEX_KEY='site:session:index';
const SESSION_INDEX_LIMIT=2000;
const REPLACE_SESSION_INDEX=`
local kind=redis.call('TYPE',KEYS[1]).ok
if kind~='none' and kind~='list' then return -1 end
local oldCount=tonumber(ARGV[1])
local nextCount=tonumber(ARGV[2])
if not oldCount or oldCount<0 or oldCount>2000 or not nextCount or nextCount<0 or nextCount>2000 then return -2 end
local current=redis.call('LRANGE',KEYS[1],0,-1)
if #current~=oldCount then return 0 end
for i=1,oldCount do
  if current[i]~=ARGV[2+i] then return 0 end
end
redis.call('DEL',KEYS[1])
for i=1,nextCount do
  redis.call('RPUSH',KEYS[1],ARGV[2+oldCount+i])
end
return 1
`;

function validTime(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0}
async function planSessionIndexCompaction(kv,now=Date.now()){
  if(!kv||typeof kv.lrange!=='function'||typeof kv.get!=='function')throw new Error('Session compaction storage is unavailable');
  const at=validTime(now);if(!at)throw new Error('Session compaction time is invalid');
  const raw=await kv.lrange(SESSION_INDEX_KEY,0,SESSION_INDEX_LIMIT);
  if(!Array.isArray(raw)||raw.length>SESSION_INDEX_LIMIT)throw new Error('Session index is unavailable or exceeds capacity');
  const original=raw.map(id=>String(id||'').trim());
  if(original.some(id=>!id))throw new Error('Session index contains a blank id');
  const unique=[],seen=new Set(),duplicateCount=original.length-new Set(original).size;
  for(const id of original)if(!seen.has(id)){seen.add(id);unique.push(id)}
  const cutoff=at-SITE_SESSION_RETENTION_SECONDS*1000,next=[],missing=[],expired=[];
  for(let offset=0;offset<unique.length;offset+=100){
    const ids=unique.slice(offset,offset+100),batch=await Promise.all(ids.map(id=>kv.get('site:session:'+id)));
    for(let i=0;i<ids.length;i++){
      const id=ids[i],record=batch[i];
      if(record==null){missing.push(id);continue}
      if(!record||typeof record!=='object'||Array.isArray(record)||String(record.id||'')!==id)throw new Error('Session index references a malformed record');
      const firstAt=validTime(record.firstAt),lastAt=validTime(record.lastAt||record.firstAt);
      if(!firstAt||!lastAt||lastAt<firstAt)throw new Error('Session index references an invalid timestamp');
      if(lastAt<cutoff){expired.push(id);continue}
      next.push(id);
    }
  }
  return {
    checkedAt:at,retentionCutoff:cutoff,original,next,
    indexed:original.length,retained:next.length,duplicateCount,
    missingCount:missing.length,expiredCount:expired.length,
    removeCount:original.length-next.length,changed:original.length!==next.length||original.some((id,i)=>next[i]!==id)
  };
}
async function applySessionIndexCompaction(kv,plan){
  if(!kv||typeof kv.eval!=='function'||!plan||!Array.isArray(plan.original)||!Array.isArray(plan.next))throw new Error('Session compaction plan is invalid');
  if(plan.original.length>SESSION_INDEX_LIMIT||plan.next.length>SESSION_INDEX_LIMIT)throw new Error('Session compaction plan exceeds capacity');
  if(plan.original.some(id=>!String(id||'').trim())||plan.next.some(id=>!String(id||'').trim()))throw new Error('Session compaction plan contains an invalid id');
  if(!plan.changed)return {applied:false,changed:false,conflict:false,retained:plan.next.length};
  const args=[String(plan.original.length),String(plan.next.length),...plan.original.map(String),...plan.next.map(String)],
    result=Number(await kv.eval(REPLACE_SESSION_INDEX,[SESSION_INDEX_KEY],args));
  if(result===-1)throw new Error('Session index storage type is invalid');
  if(result===-2||![0,1].includes(result))throw new Error('Session index compaction could not be confirmed');
  return {applied:result===1,changed:true,conflict:result===0,retained:plan.next.length};
}

module.exports={SESSION_INDEX_KEY,SESSION_INDEX_LIMIT,REPLACE_SESSION_INDEX,planSessionIndexCompaction,applySessionIndexCompaction};
