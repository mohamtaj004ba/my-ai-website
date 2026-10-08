const test=require('node:test');
const assert=require('node:assert/strict');
const {replacePreviewSupportSeed,MAX_INDEXED_TICKETS}=require('../lib/preview-support-seed');
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));

function fixture(ids=[],{malformed=false,conflict=false,fail=false}={}){
  const entries=new Map();
  entries.set('support:index',malformed?{bad:'index'}:ids.slice());
  ids.forEach(id=>entries.set('support:'+id,{id,body:'prior '+id}));
  let compares=0,writes=0,removed=[];
  const kv={
    get:async key=>clone(entries.get(key)??null),
    set:async()=>assert.fail('Preview support must not write ticket outside transaction'),
    del:async key=>{removed.push(key);entries.delete(key)}
  };
  const compare=async(_kv,updates)=>{
    compares++;
    if(fail)throw Error('KV not available');
    if(conflict&&compares===1){
      entries.get('support:index').unshift('concurrent-live');
      entries.set('support:concurrent-live',{id:'concurrent-live'});
      return false;
    }
    for(const u of updates)if(JSON.stringify(entries.get(u.key)??null)!==JSON.stringify(u.before??null))return false;
    updates.forEach(u=>entries.set(u.key,clone(u.after)));writes++;return true;
  };
  return {kv,entries,compare,removed,compares:()=>compares,writes:()=>writes};
}
const seed=id=>({id:'seed_support_seed_'+id,workspaceId:'seed_qa',subject:'Fictional ticket '+id});
test('Preview reseed preserves every non-fixture support ticket past old 500-record limit',async()=>{
  const ids=Array.from({length:601},(_,i)=>'customer-'+i),f=fixture(ids);
  const result=await replacePreviewSupportSeed(f.kv,[seed('one'),seed('two')],{compare:f.compare});
  assert.equal(result.seeded,2);assert.equal(result.retained,601);
  assert.equal(f.entries.get('support:index').length,603);
  assert.equal(f.entries.get('support:index')[602],'customer-600');
  assert.equal(f.entries.get('support:customer-600').body,'prior customer-600');
  assert.equal(f.writes(),1);
  assert.equal(f.removed.length,0);
});
test('concurrent live support creation triggers retry instead of lost index entry',async()=>{
  const f=fixture(['customer-old'],{conflict:true});
  await replacePreviewSupportSeed(f.kv,[seed('one')],{compare:f.compare});
  assert.equal(f.compares(),2);
  assert.deepEqual(f.entries.get('support:index'),['seed_support_seed_one','concurrent-live','customer-old']);
});
test('new fixture replaces stale fictitious keys without touching live client keys',async()=>{
  const old='seed_support_seed_old',live='customer-active',f=fixture([old,live]);
  const result=await replacePreviewSupportSeed(f.kv,[seed('new')],{compare:f.compare});
  assert.equal(result.retained,1);
  assert.deepEqual(f.entries.get('support:index'),['seed_support_seed_new',live]);
  assert.equal(f.entries.has('support:'+old),false);
  assert.equal(f.entries.get('support:'+live).id,live);
  assert.deepEqual(f.removed,['support:'+old]);
});
test('invalid fixture, malformed index, and capacity fail without any ticket mutations',async()=>{
  const inputs=[
    {f:fixture(['live'],{malformed:true}),tickets:[seed('one')]},
    {f:fixture(Array.from({length:MAX_INDEXED_TICKETS},(_,i)=>'live-'+i)),tickets:[seed('one')]},
    {f:fixture(['live']),tickets:[{id:'customer-disguised'}]},
    {f:fixture(['live']),tickets:[seed('one'),seed('one')]}
  ];
  for(const {f,tickets} of inputs){
    const before=clone([...f.entries]);
    await assert.rejects(replacePreviewSupportSeed(f.kv,tickets,{compare:f.compare}));
    assert.deepEqual([...f.entries],before);
    assert.equal(f.writes(),0);assert.equal(f.removed.length,0);
  }
});
test('failed atomic index write cannot create orphan ticket or delete old fixture',async()=>{
  const old='seed_support_seed_old',f=fixture([old,'customer'],{fail:true});
  await assert.rejects(replacePreviewSupportSeed(f.kv,[seed('one')],{compare:f.compare}));
  assert.equal(f.entries.has('support:seed_support_seed_one'),false);
  assert.equal(f.entries.has('support:'+old),true);
  assert.deepEqual(f.entries.get('support:index'),[old,'customer']);
  assert.equal(f.removed.length,0);
});
test('rerunning same fixture replaces its snapshot without duplicate IDs',async()=>{
  const old='seed_support_seed_one',f=fixture([old,'customer']);
  await replacePreviewSupportSeed(f.kv,[seed('one')],{compare:f.compare});
  assert.deepEqual(f.entries.get('support:index'),[old,'customer']);
  assert.equal(f.entries.get('support:'+old).subject,'Fictional ticket one');
  assert.equal(f.removed.length,0);
});
