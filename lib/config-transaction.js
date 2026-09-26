// Compare every snapshot before writing any record. All arguments are prepared
// before EVAL so concurrent edits fail closed without rolling back newer data.
const CONFIG_COMPARE_AND_SET=`
for i = 1, #KEYS do
  local current = redis.call('GET', KEYS[i]) or ''
  if current ~= ARGV[(i - 1) * 2 + 1] then return 0 end
end
for i = 1, #KEYS do
  redis.call('SET', KEYS[i], ARGV[(i - 1) * 2 + 2])
end
return 1
`;
async function compareAndSetConfig(kv,updates){
  if(!updates.length)return true;
  if(new Set(updates.map(x=>x.key)).size!==updates.length)throw new Error('Duplicate configuration key');
  const args=updates.flatMap(x=>[x.before==null?'':JSON.stringify(x.before),JSON.stringify(x.after)]);
  return Number(await kv.eval(CONFIG_COMPARE_AND_SET,updates.map(x=>x.key),args))===1;
}
module.exports={compareAndSetConfig,CONFIG_COMPARE_AND_SET};

const CONFIG_COMPARE_AND_AUDIT=`
local current=redis.call('GET',KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
local raw=redis.call('GET',KEYS[2])
local events={}
if raw then
  local ok,decoded=pcall(cjson.decode,raw)
  if not ok or type(decoded)~='table' then return -1 end
  events=decoded
end
local ok,event=pcall(cjson.decode,ARGV[3])
if not ok or type(event)~='table' then return -2 end
table.insert(events,1,event)
while #events>200 do table.remove(events) end
local history=cjson.encode(events)
redis.call('SET',KEYS[1],ARGV[2])
redis.call('SET',KEYS[2],history)
return 1
`;
async function compareAndAudit(kv,update,auditKey,event){
  if(!update?.key||!auditKey||update.key===auditKey||!event)throw new Error('Valid workspace and audit keys required');
  const result=Number(await kv.eval(CONFIG_COMPARE_AND_AUDIT,[update.key,auditKey],[update.before==null?'':JSON.stringify(update.before),JSON.stringify(update.after),JSON.stringify(event)]));
  if(result===-1)throw new Error('Audit history is malformed');
  if(result===-2)throw new Error('Audit event could not be serialized');
  if(result!==0&&result!==1)throw new Error('Workspace and audit transaction could not be confirmed');
  return result===1;
}
module.exports.compareAndAudit=compareAndAudit;
module.exports.CONFIG_COMPARE_AND_AUDIT=CONFIG_COMPARE_AND_AUDIT;

const CONFIG_COMPARE_AND_SET_WITH_DELETE=`
local count=tonumber(ARGV[1])
for i=1,count do
  local current=redis.call('GET',KEYS[i]) or ''
  if current~=ARGV[(i-1)*2+2] then return 0 end
end
for i=1,count do
  local nextValue=ARGV[(i-1)*2+3]
  if nextValue=='__CALLERCORE_DELETE__' then redis.call('DEL',KEYS[i])
  else redis.call('SET',KEYS[i],nextValue) end
end
return 1
`;
async function compareAndSetWithDelete(kv,updates,{deleteKeys=[]}={}){
  if(!updates.length)return true;
  const keys=updates.map(x=>x.key);
  if(new Set(keys).size!==keys.length||deleteKeys.some(key=>!keys.includes(key)))throw new Error('Invalid configuration deletion keys');
  const args=[String(updates.length),...updates.flatMap(x=>[x.before==null?'':JSON.stringify(x.before),deleteKeys.includes(x.key)?'__CALLERCORE_DELETE__':JSON.stringify(x.after)])];
  return Number(await kv.eval(CONFIG_COMPARE_AND_SET_WITH_DELETE,keys,args))===1;
}
module.exports.compareAndSetWithDelete=compareAndSetWithDelete;
module.exports.CONFIG_COMPARE_AND_SET_WITH_DELETE=CONFIG_COMPARE_AND_SET_WITH_DELETE;

const CONFIG_COMPARE_AND_AUDIT_BATCH=`
local count=tonumber(ARGV[1])
if not count or count<1 or #KEYS~=count+1 then return -3 end
for i=1,count do
  local current=redis.call('GET',KEYS[i]) or ''
  if current~=ARGV[(i-1)*2+2] then return 0 end
end
local raw=redis.call('GET',KEYS[count+1])
local history={}
if raw then
  local ok,decoded=pcall(cjson.decode,raw)
  if not ok or type(decoded)~='table' then return -1 end
  history=decoded
end
local ok,event=pcall(cjson.decode,ARGV[count*2+2])
if not ok or type(event)~='table' then return -2 end
table.insert(history,1,event)
while #history>200 do table.remove(history) end
local encoded=cjson.encode(history)
for i=1,count do
  local nextValue=ARGV[(i-1)*2+3]
  if nextValue=='__CALLERCORE_DELETE__' then redis.call('DEL',KEYS[i])
  else redis.call('SET',KEYS[i],nextValue) end
end
redis.call('SET',KEYS[count+1],encoded)
return 1
`;
async function compareAndAuditBatch(kv,updates,auditKey,event,{deleteKeys=[]}={}){
  if(!updates.length||!auditKey||!event)throw new Error('Configuration updates and audit event are required');
  const keys=updates.map(x=>x.key);
  if(new Set([...keys,auditKey]).size!==keys.length+1||deleteKeys.some(key=>!keys.includes(key)))throw new Error('Invalid audited transaction keys');
  const args=[String(updates.length),...updates.flatMap(x=>[x.before==null?'':JSON.stringify(x.before),deleteKeys.includes(x.key)?'__CALLERCORE_DELETE__':JSON.stringify(x.after)]),JSON.stringify(event)];
  const result=Number(await kv.eval(CONFIG_COMPARE_AND_AUDIT_BATCH,[...keys,auditKey],args));
  if(result===-1)throw new Error('Audit history is malformed');
  if(result===-2)throw new Error('Audit event could not be serialized');
  if(result!==0&&result!==1)throw new Error('Audited configuration transaction could not be confirmed');
  return result===1;
}
module.exports.compareAndAuditBatch=compareAndAuditBatch;
module.exports.CONFIG_COMPARE_AND_AUDIT_BATCH=CONFIG_COMPARE_AND_AUDIT_BATCH;
