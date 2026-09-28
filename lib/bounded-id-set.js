const MERGE_BOUNDED_IDS=`
local raw=redis.call('GET',KEYS[1])
local items={}
local seen={}
if raw then
  local ok,decoded=pcall(cjson.decode,raw)
  if not ok or type(decoded)~='table' then return -1 end
  local count=0
  for k,v in pairs(decoded) do
    count=count+1
    if type(k)~='number' or k<1 or k%1~=0 then return -1 end
  end
  if count~=#decoded then return -1 end
  items=decoded
  for i=1,#items do
    local id=items[i]
    if type(id)~='string' or id=='' or seen[id] then return -2 end
    seen[id]=true
  end
end
local limit=tonumber(ARGV[1])
local ttl=tonumber(ARGV[2])
if not limit or limit<1 or limit>10000 or not ttl or ttl<0 then return -3 end
for i=3,#ARGV do
  local id=ARGV[i]
  if id~='' and not seen[id] then
    table.insert(items,id)
    seen[id]=true
  end
end
while #items>limit do
  local removed=table.remove(items,1)
  seen[removed]=nil
end
redis.call('SET',KEYS[1],cjson.encode(items))
if ttl>0 then redis.call('EXPIRE',KEYS[1],ttl) end
return #items
`;

function cleanIds(ids,limit){
  if(!Array.isArray(ids))throw new Error('IDs must be an array');
  const seen=new Set(),clean=[];
  for(const value of ids){
    const id=String(value||'').trim();
    if(!id)continue;
    if(id.length>220)throw new Error('ID is too long');
    if(!seen.has(id)){seen.add(id);clean.push(id)}
  }
  return clean.slice(-limit);
}

async function addBoundedIds(kv,key,ids,{limit=2000,ttlSeconds=0}={}){
  const boundedLimit=Number(limit),ttl=Number(ttlSeconds);
  if(!key||!Number.isInteger(boundedLimit)||boundedLimit<1||boundedLimit>10000||!Number.isInteger(ttl)||ttl<0)throw new Error('Invalid bounded ID set options');
  const clean=cleanIds(ids,boundedLimit);
  if(!clean.length)return 0;
  const result=Number(await kv.eval(MERGE_BOUNDED_IDS,[key],[String(boundedLimit),String(ttl),...clean]));
  if(result===-1)throw new Error('Stored ID history is malformed');
  if(result===-2)throw new Error('Stored ID history contains invalid entries');
  if(result===-3)throw new Error('Bounded ID set options were rejected');
  if(!Number.isInteger(result)||result<0||result>boundedLimit)throw new Error('Bounded ID set write could not be confirmed');
  return result;
}

module.exports={addBoundedIds,MERGE_BOUNDED_IDS};
