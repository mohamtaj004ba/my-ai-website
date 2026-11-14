const test=require('node:test');
const assert=require('node:assert/strict');
const {SESSION_INDEX_KEY,SESSION_INDEX_LIMIT,planSessionIndexCompaction,applySessionIndexCompaction}=require('../lib/session-index-compaction');

function fixture(ids=[],records={}){
  let index=ids.slice(),evals=0;
  return {
    kv:{
      async lrange(key,start,end){assert.equal(key,SESSION_INDEX_KEY);return index.slice(start,end+1)},
      async get(key){return records[key]===undefined?null:JSON.parse(JSON.stringify(records[key]))},
      async eval(script,keys,args){
        evals++;
        const oldCount=Number(args[0]),nextCount=Number(args[1]),old=args.slice(2,2+oldCount),next=args.slice(2+oldCount,2+oldCount+nextCount);
        if(JSON.stringify(index)!==JSON.stringify(old))return 0;
        index=next.slice();return 1;
      }
    },
    index:()=>index.slice(),evals:()=>evals,setIndex:value=>{index=value.slice()}
  };
}

test('session compaction plan removes only duplicate, missing, and expired index entries',async()=>{
  const now=Date.UTC(2026,8,29),recent=now-10*86400000,expired=now-181*86400000;
  const f=fixture(['s-new','s-missing','s-old','s-new'],{
    'site:session:s-new':{id:'s-new',firstAt:recent,lastAt:recent},
    'site:session:s-old':{id:'s-old',firstAt:expired,lastAt:expired}
  });
  const plan=await planSessionIndexCompaction(f.kv,now);
  assert.deepEqual(plan.next,['s-new']);
  assert.equal(plan.indexed,4);assert.equal(plan.retained,1);
  assert.equal(plan.duplicateCount,1);assert.equal(plan.missingCount,1);assert.equal(plan.expiredCount,1);
  assert.equal(plan.removeCount,3);assert.equal(plan.changed,true);
  assert.equal(f.evals(),0);
});

test('session compaction fails closed on malformed live records and capacity overflow',async()=>{
  const now=Date.UTC(2026,8,29);
  const bad=fixture(['s-1'],{'site:session:s-1':{id:'other',firstAt:now,lastAt:now}});
  await assert.rejects(()=>planSessionIndexCompaction(bad.kv,now),/malformed record/);
  const over=fixture(Array.from({length:SESSION_INDEX_LIMIT+1},(_,i)=>'s-'+i),{});
  await assert.rejects(()=>planSessionIndexCompaction(over.kv,now),/exceeds capacity/);
});

test('session compaction applies only against the exact list snapshot and preserves order',async()=>{
  const now=Date.UTC(2026,8,29),recent=now-1000;
  const f=fixture(['a','missing','b'],{
    'site:session:a':{id:'a',firstAt:recent,lastAt:recent},
    'site:session:b':{id:'b',firstAt:recent,lastAt:recent}
  });
  const plan=await planSessionIndexCompaction(f.kv,now),result=await applySessionIndexCompaction(f.kv,plan);
  assert.equal(result.applied,true);assert.equal(result.conflict,false);
  assert.deepEqual(f.index(),['a','b']);
});

test('concurrent session-index change blocks compaction instead of overwriting newer entries',async()=>{
  const now=Date.UTC(2026,8,29),recent=now-1000;
  const f=fixture(['a','missing'],{'site:session:a':{id:'a',firstAt:recent,lastAt:recent}});
  const plan=await planSessionIndexCompaction(f.kv,now);
  f.setIndex(['newer','a','missing']);
  const result=await applySessionIndexCompaction(f.kv,plan);
  assert.equal(result.applied,false);assert.equal(result.conflict,true);
  assert.deepEqual(f.index(),['newer','a','missing']);
});

test('unchanged session index performs no write',async()=>{
  const now=Date.UTC(2026,8,29),recent=now-1000;
  const f=fixture(['a'],{'site:session:a':{id:'a',firstAt:recent,lastAt:recent}});
  const plan=await planSessionIndexCompaction(f.kv,now),result=await applySessionIndexCompaction(f.kv,plan);
  assert.equal(plan.changed,false);assert.equal(result.applied,false);assert.equal(f.evals(),0);
});
