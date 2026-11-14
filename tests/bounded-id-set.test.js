const test=require('node:test');
const assert=require('node:assert/strict');
const {addBoundedIds,MERGE_BOUNDED_IDS}=require('../lib/bounded-id-set');

test('bounded ID merge uses one Redis operation with unique additions and requested TTL',async()=>{
  let calls=0;
  const kv={eval:async(script,keys,args)=>{
    calls++;assert.equal(script,MERGE_BOUNDED_IDS);assert.deepEqual(keys,['reads:key']);
    assert.deepEqual(args,['2000','31536000','a','b']);return 2;
  }};
  assert.equal(await addBoundedIds(kv,'reads:key',['a','b','a'],{limit:2000,ttlSeconds:31536000}),2);
  assert.equal(calls,1);
});

test('bounded ID merge rejects malformed stored history instead of overwriting it',async()=>{
  for(const code of [-1,-2,-3,2001])await assert.rejects(()=>addBoundedIds({eval:async()=>code},'reads:key',['x'],{limit:2000}),/malformed|invalid|rejected|could not be confirmed/);
});

test('bounded ID merge validates caller input before reaching Redis',async()=>{
  let calls=0,kv={eval:async()=>{calls++;return 1}};
  await assert.rejects(()=>addBoundedIds(kv,'',['x']),/Invalid/);
  await assert.rejects(()=>addBoundedIds(kv,'k',['x'.repeat(221)]),/too long/);
  assert.equal(calls,0);
});

test('Lua merge validates JSON arrays and preserves bounded insertion order',()=>{
  assert.match(MERGE_BOUNDED_IDS,/type\(k\)~='number'/);
  assert.match(MERGE_BOUNDED_IDS,/if count~=#decoded then return -1 end/);
  assert.match(MERGE_BOUNDED_IDS,/if id~='' and not seen\[id\] then/);
  assert.match(MERGE_BOUNDED_IDS,/while #items>limit do/);
  assert.match(MERGE_BOUNDED_IDS,/redis\.call\('EXPIRE'/);
});
