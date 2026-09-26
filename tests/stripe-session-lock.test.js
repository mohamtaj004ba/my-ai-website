const test=require('node:test');
const assert=require('node:assert/strict');
const {claimCheckoutSession,releaseCheckoutSession,CLAIM_CHECKOUT_SESSION,RELEASE_CHECKOUT_SESSION}=require('../lib/stripe-session-lock');

function fixture(){
  const locks=new Map(),calls=[];
  const kv={eval:async(script,keys,args)=>{
    calls.push({script,keys,args});
    const key=keys[0];
    if(script===CLAIM_CHECKOUT_SESSION){
      if(locks.has(key))return 0;
      locks.set(key,args[0]);return 1;
    }
    if(script===RELEASE_CHECKOUT_SESSION){
      if(locks.get(key)!==args[0])return 0;
      locks.delete(key);return 1;
    }
    throw Error('Unexpected Redis script');
  }};
  return {kv,locks,calls};
}
test('distinct Stripe events cannot concurrently acquire one checkout',async()=>{
  const f=fixture();
  const [first,second]=await Promise.all([
    claimCheckoutSession(f.kv,'cs_123'),claimCheckoutSession(f.kv,'cs_123')
  ]);
  assert.ok(first);
  assert.equal(second,null);
  assert.equal(f.locks.size,1);
  assert.equal(first.key,'stripe:checkout:lock:cs_123');
  assert.equal(f.calls[0].args[1],'600');
  assert.match(CLAIM_CHECKOUT_SESSION,/redis\.call\('EXISTS',KEYS\[1\]\)/);
  assert.match(CLAIM_CHECKOUT_SESSION,/redis\.call\('SET',KEYS\[1\],ARGV\[1\],'EX',ARGV\[2\]\)/);
  assert.equal(await releaseCheckoutSession(f.kv,first),true);
  assert.ok(await claimCheckoutSession(f.kv,'cs_123'));
});
test('stale worker cannot clear another worker claim after expiry',async()=>{
  const f=fixture();
  const original=await claimCheckoutSession(f.kv,'cs_123');
  f.locks.set(original.key,'replacement-token');
  assert.equal(await releaseCheckoutSession(f.kv,original),false);
  assert.equal(f.locks.get(original.key),'replacement-token');
  assert.match(RELEASE_CHECKOUT_SESSION,/redis\.call\('GET',KEYS\[1\]\)~=ARGV\[1\]/);
  assert.ok(RELEASE_CHECKOUT_SESSION.indexOf("redis.call('GET'")<RELEASE_CHECKOUT_SESSION.indexOf("redis.call('DEL'"));
});
test('missing checkout id and unconfirmed Redis result fail closed',async()=>{
  const f=fixture();
  await assert.rejects(()=>claimCheckoutSession(f.kv,''),/checkout session ID required/);
  assert.equal(f.calls.length,0);
  await assert.rejects(()=>claimCheckoutSession({eval:async()=>2},'cs_123'),/could not be confirmed/);
  await assert.rejects(()=>releaseCheckoutSession({eval:async()=>2},{key:'lock',token:'token'}),/could not be confirmed/);
  await assert.rejects(()=>releaseCheckoutSession(f.kv,null),/Valid checkout session claim required/);
});
