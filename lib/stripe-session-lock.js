const crypto=require('crypto');

// A checkout session must not provision in parallel across Stripe event IDs.
// Returning a non-2xx response when busy lets Stripe retry rather than
// acknowledging an event before the other request has persisted onboarding.
const CLAIM_CHECKOUT_SESSION=`
if redis.call('EXISTS',KEYS[1])==1 then return 0 end
redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2])
return 1
`;
const RELEASE_CHECKOUT_SESSION=`
if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
redis.call('DEL',KEYS[1])
return 1
`;
async function claimCheckoutSession(kv,sessionId){
  if(!sessionId||typeof sessionId!=='string'||sessionId.length>200)throw new Error('Stripe checkout session ID required');
  const key='stripe:checkout:lock:'+sessionId,token=crypto.randomUUID();
  const result=Number(await kv.eval(CLAIM_CHECKOUT_SESSION,[key],[token,'600']));
  if(result!==0&&result!==1)throw new Error('Checkout session lock could not be confirmed');
  return result===1?{key,token}:null;
}
async function releaseCheckoutSession(kv,claim){
  if(!claim?.key||!claim?.token)throw new Error('Valid checkout session claim required');
  const result=Number(await kv.eval(RELEASE_CHECKOUT_SESSION,[claim.key],[claim.token]));
  if(result!==0&&result!==1)throw new Error('Checkout session lock release could not be confirmed');
  return result===1;
}
module.exports={claimCheckoutSession,releaseCheckoutSession,CLAIM_CHECKOUT_SESSION,RELEASE_CHECKOUT_SESSION};
