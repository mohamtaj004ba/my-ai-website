// One atomic append avoids losing a concurrently submitted website inquiry.
// Preserve the existing 200-message conversation history contract.
const SITE_CONVERSATION_APPEND=`
local raw=redis.call('GET',KEYS[1])
local history={}
if raw then
  if string.sub(raw,1,1)~='[' then return -1 end
  local ok,decoded=pcall(cjson.decode,raw)
  if not ok or type(decoded)~='table' then return -1 end
  history=decoded
end
local ok,message=pcall(cjson.decode,ARGV[1])
if not ok or type(message)~='table' then return -2 end
table.insert(history,message)
while #history>200 do table.remove(history,1) end
local encoded=cjson.encode(history)
redis.call('SET',KEYS[1],encoded)
return #history
`;
async function appendSiteConversation(kv,prospectId,message){
  if(!prospectId||!message?.id||!message?.direction||!message?.body)throw new Error('Valid inquiry required');
  const result=Number(await kv.eval(SITE_CONVERSATION_APPEND,['site:conversation:'+prospectId],[JSON.stringify(message)]));
  if(result===-1)throw new Error('Website conversation history is malformed');
  if(result===-2||!Number.isInteger(result)||result<1||result>200)throw new Error('Website conversation append could not be confirmed');
  return result;
}
module.exports={appendSiteConversation,SITE_CONVERSATION_APPEND};
