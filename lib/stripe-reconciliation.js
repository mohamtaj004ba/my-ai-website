// Save only sanitized checkout identifiers and a bounded reason category.
// An unresolved payment identity must be visible to admins without automatically
// reassigning an existing customer's workspace or billing mapping.
const crypto=require('crypto');
const RECONCILIATION_RECORD=`
local recordType=redis.call('TYPE',KEYS[1]).ok
local indexType=redis.call('TYPE',KEYS[2]).ok
if (recordType~='none' and recordType~='string') or (indexType~='none' and indexType~='list') then return -1 end
if redis.call('EXISTS',KEYS[1])==1 then return 0 end
redis.call('SET',KEYS[1],ARGV[1],'EX',7776000)
redis.call('LPUSH',KEYS[2],ARGV[2])
redis.call('LTRIM',KEYS[2],0,199)
return 1
`;
function safeId(value){return String(value||'').slice(0,200).replace(/[^a-zA-Z0-9_:-]/g,'')}
async function recordCheckoutReconciliation(kv,{sessionId,eventId,email,reason}){
  const id=safeId(sessionId),category=String(reason||'').slice(0,80);
  if(!id||!['email_mismatch','account_mapping_conflict','workspace_owner_mismatch','reserved_account'].includes(category))throw new Error('Valid reconciliation category and checkout ID required');
  const emailFingerprint=email?crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex'):'';
  const item={id,sessionId:id,eventId:safeId(eventId),emailFingerprint,reason:category,status:'open',createdAt:Date.now()};
  const result=Number(await kv.eval(RECONCILIATION_RECORD,['stripe:reconciliation:'+id,'stripe:reconciliation:index'],[JSON.stringify(item),id]));
  if(result===-1)throw new Error('Checkout reconciliation directory is malformed');
  if(result!==0&&result!==1)throw new Error('Checkout reconciliation save could not be confirmed');
  return item;
}
module.exports={recordCheckoutReconciliation,RECONCILIATION_RECORD};
