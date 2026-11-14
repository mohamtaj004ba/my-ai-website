const AUDIT_PREPEND=`
local raw = redis.call('GET', KEYS[1])
local list = {}
if raw then
  local ok, decoded = pcall(cjson.decode, raw)
  if not ok or type(decoded) ~= 'table' then return -1 end
  list = decoded
end
local ok, event = pcall(cjson.decode, ARGV[1])
if not ok or type(event) ~= 'table' then return -2 end
table.insert(list, 1, event)
local limit = tonumber(ARGV[2]) or 200
while #list > limit do table.remove(list) end
redis.call('SET', KEYS[1], cjson.encode(list))
return #list
`;

async function prependAuditEvent(kv,key,event,limit=200){
  const result=Number(await kv.eval(AUDIT_PREPEND,[key],[JSON.stringify(event),String(limit)]));
  if(result<0)throw new Error(result===-1?'Audit history is malformed':'Audit event could not be serialized');
  return result;
}

module.exports={prependAuditEvent,AUDIT_PREPEND};
