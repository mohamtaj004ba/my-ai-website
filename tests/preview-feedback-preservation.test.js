const test=require('node:test');
const assert=require('node:assert/strict');
const {replacePreviewFeedbackSeed,GLOBAL_LIMIT,WORKSPACE_LIMIT}=require('../lib/preview-feedback-seed');
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));

function fixture(ids=[],{workspaceIds={},malformed=false,conflict=false,fail=false}={}){
  const entries=new Map();
  entries.set('ai-feedback:index',malformed?{broken:true}:ids.slice());
  ids.forEach(id=>entries.set('ai-feedback:'+id,{id,workspaceId:'real-workspace',message:'existing '+id}));
  for(const [id,index] of Object.entries(workspaceIds))entries.set('ai-feedback:workspace:'+id,clone(index));
  let compares=0,writes=0;const deleted=[];
  const kv={
    get:async key=>clone(entries.get(key)??null),
    set:async()=>assert.fail('Feedback fixtures cannot write outside the atomic transaction'),
    del:async key=>{deleted.push(key);entries.delete(key)}
  };
  const compare=async(_kv,updates)=>{
    compares++;
    if(fail)throw Error('KV unavailable');
    if(conflict&&compares===1){
      entries.get('ai-feedback:index').unshift('customer-concurrent');
      entries.set('ai-feedback:customer-concurrent',{id:'customer-concurrent'});
      return false;
    }
    for(const x of updates)if(JSON.stringify(entries.get(x.key)??null)!==JSON.stringify(x.before??null))return false;
    updates.forEach(x=>entries.set(x.key,clone(x.after)));writes++;return true;
  };
  return {kv,entries,compare,deleted,compares:()=>compares,writes:()=>writes};
}
const seed=(name,workspaceId='seed_workspace_one')=>({id:'seed_feedback_seed_'+name,workspaceId,message:'Preview feedback '+name});

test('Preview feedback reseed keeps non-fixture index entries beyond former 1500 slice without modifying them',async()=>{
  const ids=Array.from({length:1498},(_,i)=>'real-'+i),f=fixture(ids);
  const result=await replacePreviewFeedbackSeed(f.kv,[seed('a'),seed('b')],{compare:f.compare});
  assert.equal(result.retained,1498);assert.equal(result.seeded,2);
  assert.equal(f.entries.get('ai-feedback:index').length,GLOBAL_LIMIT);
  assert.equal(f.entries.get('ai-feedback:index')[1499],'real-1497');
  assert.equal(f.entries.get('ai-feedback:real-1497').message,'existing real-1497');
  assert.equal(f.writes(),1);assert.equal(f.deleted.length,0);
});
test('concurrent customer feedback insertion is retained after transaction retry',async()=>{
  const f=fixture(['customer-earlier'],{conflict:true});
  await replacePreviewFeedbackSeed(f.kv,[seed('a')],{compare:f.compare});
  assert.equal(f.compares(),2);
  assert.deepEqual(f.entries.get('ai-feedback:index'),['seed_feedback_seed_a','customer-concurrent','customer-earlier']);
});
test('atomic reseeding refreshes fixture indexes per workspace without erasing nonfixture records',async()=>{
  const old='seed_feedback_seed_old',f=fixture([old,'real-item'],{
    workspaceIds:{seed_workspace_one:[old,'custom-feedback-id'],seed_workspace_two:['workspace-two-real']}
  });
  const result=await replacePreviewFeedbackSeed(f.kv,[seed('new'),seed('other','seed_workspace_two')],{compare:f.compare});
  assert.equal(result.retained,1);
  assert.deepEqual(f.entries.get('ai-feedback:index'),['seed_feedback_seed_new','seed_feedback_seed_other','real-item']);
  assert.deepEqual(f.entries.get('ai-feedback:workspace:seed_workspace_one'),['seed_feedback_seed_new','custom-feedback-id']);
  assert.deepEqual(f.entries.get('ai-feedback:workspace:seed_workspace_two'),['seed_feedback_seed_other','workspace-two-real']);
  assert.equal(f.entries.has('ai-feedback:'+old),false);
  assert.equal(f.entries.get('ai-feedback:real-item').id,'real-item');
  assert.deepEqual(f.deleted,['ai-feedback:'+old]);
});
test('malformed index, capacity or invalid fake ID fail before changing any feedback records',async()=>{
  const cases=[
    {f:fixture(['customer'],{malformed:true}),tickets:[seed('one')]},
    {f:fixture(Array.from({length:GLOBAL_LIMIT},(_,i)=>'real-'+i)),tickets:[seed('one')]},
    {f:fixture(['real'],{workspaceIds:{seed_workspace_one:Array.from({length:WORKSPACE_LIMIT},(_,i)=>'real-local-'+i)}}),tickets:[seed('one')]},
    {f:fixture(['real']),tickets:[{id:'real-faked',workspaceId:'seed_workspace_one'}]},
    {f:fixture(['real']),tickets:[seed('one'),seed('one')]},
    {f:fixture(['real']),tickets:[seed('one','real-workspace')]}
  ];
  for(const {f,tickets} of cases){
    const snapshot=clone([...f.entries]);
    await assert.rejects(replacePreviewFeedbackSeed(f.kv,tickets,{compare:f.compare}));
    assert.deepEqual([...f.entries],snapshot);
    assert.equal(f.writes(),0);assert.equal(f.deleted.length,0);
  }
});
test('failed feedback transaction leaves old fake records and live index untouched',async()=>{
  const old='seed_feedback_seed_old',f=fixture([old,'real'],{fail:true});
  await assert.rejects(replacePreviewFeedbackSeed(f.kv,[seed('new')],{compare:f.compare}));
  assert.deepEqual(f.entries.get('ai-feedback:index'),[old,'real']);
  assert.equal(f.entries.has('ai-feedback:seed_feedback_seed_new'),false);
  assert.equal(f.entries.has('ai-feedback:'+old),true);
  assert.equal(f.deleted.length,0);
});
test('repeat Preview feedback seeding is idempotent and does not duplicate IDs',async()=>{
  const id='seed_feedback_seed_one',f=fixture([id,'real'],{workspaceIds:{seed_workspace_one:[id]}});
  await replacePreviewFeedbackSeed(f.kv,[seed('one')],{compare:f.compare});
  assert.deepEqual(f.entries.get('ai-feedback:index'),[id,'real']);
  assert.deepEqual(f.entries.get('ai-feedback:workspace:seed_workspace_one'),[id]);
  assert.equal(f.deleted.length,0);
});
