const test=require('node:test');
const assert=require('node:assert/strict');
const {replacePreviewPhoneSeed,MAX_PHONE_RECORDS}=require('../lib/preview-phone-seed');
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const primary={id:'primary-preview-number',workspaceId:'preview-customer',number:'(509) 555-0137'};
const fake=(id,workspaceId='seed_workspace_one')=>({id,workspaceId,number:'(509) 555-0111'});
const live=i=>({id:'real-phone-'+i,workspaceId:'real-customer-'+i,number:'+1509555'+String(i).padStart(4,'0')});
function fixture(existing,{conflict=false,fail=false}={}){
  const values=new Map();
  if(existing!==undefined)values.set('phone:index',clone(existing));
  let compares=0;const writes=[];
  const kv={get:async key=>clone(values.get(key)??null),
    set:async()=>assert.fail('Preview phone seeder should not write outside transaction')};
  const compare=async(_kv,updates)=>{
    compares++;
    if(fail)throw Error('Redis unavailable');
    if(conflict&&compares===1){
      values.set('phone:index',[live('concurrent'),...(values.get('phone:index')||[])]);return false;
    }
    for(const u of updates)if(JSON.stringify(values.get(u.key)??null)!==JSON.stringify(u.before??null))return false;
    for(const u of updates){values.set(u.key,clone(u.after));writes.push(u.key)}
    return true;
  };
  return {kv,values,compares:()=>compares,writes,compare};
}
test('Preview phone reseed keeps every unrelated phone beyond former silent cap',async()=>{
  const f=fixture(Array.from({length:497},(_,i)=>live(i)));
  const result=await replacePreviewPhoneSeed(f.kv,primary.workspaceId,primary,[fake('seed-a'),fake('seed-b')],{compare:f.compare});
  assert.equal(result.retained,497);
  assert.equal(f.values.get('phone:index').length,MAX_PHONE_RECORDS);
  assert.equal(f.values.get('phone:index')[499].id,'real-phone-496');
  assert.deepEqual(f.writes,['phone:index']);
});
test('old fictional phones are replaced, Preview primary assignment refreshed, all real customers retained',async()=>{
  const old={...primary,number:'(509) 555-0199'},one=live(1),two=live(2),f=fixture([fake('stale'),one,old,two]);
  await replacePreviewPhoneSeed(f.kv,primary.workspaceId,primary,[fake('seed-new')],{compare:f.compare});
  assert.deepEqual(f.values.get('phone:index').map(x=>x.id),['primary-preview-number','seed-new','real-phone-1','real-phone-2']);
  assert.equal(f.values.get('phone:index')[0].number,'(509) 555-0137');
  assert.equal(one.number,live(1).number);
});
test('concurrent phone assignment during Preview reseed survives retry',async()=>{
  const f=fixture([live('previous')],{conflict:true});
  await replacePreviewPhoneSeed(f.kv,primary.workspaceId,primary,[fake('demo')],{compare:f.compare});
  assert.equal(f.compares(),2);
  assert.deepEqual(f.values.get('phone:index').map(x=>x.id),['primary-preview-number','demo','real-phone-concurrent','real-phone-previous']);
});
test('invalid inventory, duplicate ids, cap and fake identifiers fail before mutating inventory',async()=>{
  const cases=[
    {existing:{invalid:true},seed:[fake('demo')]},
    {existing:[{id:'broken'}],seed:[fake('demo')]},
    {existing:[live(1),live(1)],seed:[fake('demo')]},
    {existing:Array.from({length:MAX_PHONE_RECORDS},(_,i)=>live(i)),seed:[fake('demo')]},
    {existing:[live(1)],seed:[fake('demo'),fake('demo')]},
    {existing:[live(1)],seed:[{id:'not-demo',workspaceId:'actual-customer'}]}
  ];
  for(const {existing,seed} of cases){
    const f=fixture(existing),before=clone([...f.values]);
    await assert.rejects(replacePreviewPhoneSeed(f.kv,primary.workspaceId,primary,seed,{compare:f.compare}));
    assert.deepEqual([...f.values],before);
    assert.equal(f.compares(),0);
  }
});
test('failed atomic update leaves original assignment and existing primary intact',async()=>{
  const f=fixture([live('untouched'),{...primary,number:'old-number'}],{fail:true});
  await assert.rejects(replacePreviewPhoneSeed(f.kv,primary.workspaceId,primary,[fake('demo')],{compare:f.compare}));
  assert.equal(f.values.get('phone:index')[1].number,'old-number');
  assert.equal(f.values.get('phone:index').length,2);
  assert.equal(f.writes.length,0);
});
test('repeat Preview phone seeding remains idempotent',async()=>{
  const f=fixture([primary,fake('demo'),live('other')]);
  await replacePreviewPhoneSeed(f.kv,primary.workspaceId,primary,[fake('demo')],{compare:f.compare});
  assert.deepEqual(f.values.get('phone:index').map(x=>x.id),['primary-preview-number','demo','real-phone-other']);
});
