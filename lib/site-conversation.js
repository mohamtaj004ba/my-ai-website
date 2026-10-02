// One atomic append avoids losing a concurrently submitted website inquiry.
// Preserve the existing 200-message retained-history contract while recording
// explicit coverage metadata so the Inbox never presents a truncated thread as complete.
const SITE_CONVERSATION_APPEND=`
local raw=redis.call('GET',KEYS[1])
local history={}
if raw then
  if string.sub(raw,1,1)~='[' then return -1 end
  local ok,decoded=pcall(cjson.decode,raw)
  if not ok or type(decoded)~='table' then return -1 end
  history=decoded
  for i=1,#history do
    local row=history[i]
    if type(row)~='table' or type(row.id)~='string' or row.id=='' or type(row.direction)~='string' or row.direction=='' or type(row.body)~='string' then return -1 end
  end
end
local total=#history
local baselineVerified=#history<200
local metaRaw=redis.call('GET',KEYS[2])
if metaRaw then
  local ok,meta=pcall(cjson.decode,metaRaw)
  if not ok or type(meta)~='table' then return -3 end
  local recorded=tonumber(meta.totalMessages)
  local retained=tonumber(meta.retainedMessages)
  if not recorded or recorded<#history or (retained and retained~=#history) or (meta.truncated==true and recorded<=#history) then return -3 end
  total=recorded
  baselineVerified=meta.baselineVerified~=false
end
local ok,message=pcall(cjson.decode,ARGV[1])
if not ok or type(message)~='table' or type(message.id)~='string' or message.id=='' or type(message.direction)~='string' or message.direction=='' or type(message.body)~='string' then return -2 end
table.insert(history,message)
total=total+1
while #history>200 do table.remove(history,1) end
local encoded=cjson.encode(history)
local meta=cjson.encode({totalMessages=total,retainedMessages=#history,truncated=total>#history,baselineVerified=baselineVerified,updatedAt=tonumber(ARGV[2]) or 0})
redis.call('SET',KEYS[1],encoded)
redis.call('SET',KEYS[2],meta)
return #history
`;
async function appendSiteConversation(kv,prospectId,message){
  if(!prospectId||typeof message?.id!=='string'||!message.id.trim()||typeof message?.direction!=='string'||!message.direction.trim()||typeof message?.body!=='string'||!message.body.trim())throw new Error('Valid inquiry required');
  const result=Number(await kv.eval(SITE_CONVERSATION_APPEND,['site:conversation:'+prospectId,'site:conversation:meta:'+prospectId],[JSON.stringify(message),String(Date.now())]));
  if(result===-1)throw new Error('Website conversation history is malformed');
  if(result===-3)throw new Error('Website conversation coverage metadata is malformed');
  if(result===-2||!Number.isInteger(result)||result<1||result>200)throw new Error('Website conversation append could not be confirmed');
  return result;
}
module.exports={appendSiteConversation,SITE_CONVERSATION_APPEND};
