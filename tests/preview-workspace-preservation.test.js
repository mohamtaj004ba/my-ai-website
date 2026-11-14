const test=require('node:test');
const assert=require('node:assert/strict');
const {replacePreviewWorkspaceIndex,MAX_WORKSPACES}=require('../lib/preview-workspace-seed');
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function fixture(index,{conflict=false,fail=false}={}){
  const values=new Map();
  if(index!==undefined)values.set('workspace:index',clone(index));
  let compares=0;const writes=[];
  const kv={get:async key=>clone(values.get(key)??null),set:async()=>assert.fail('Preview directory must use atomic index transaction')};
  const compare=async(_kv,updates)=>{
    compares++;
    if(fail)throw Error('KV unavailable');
    if(conflict&&compares===1){values.set('workspace:index',['concurrent-client',...(values.get('workspace:index')||[])]);return false}
    for(const x of updates)if(JSON.stringify(values.get(x.key)??null)!==JSON.stringify(x.before??null))return false;
    updates.forEach(x=>{values.set(x.key,clone(x.after));writes.push(x.key)});return true;
  };
  return {kv,values,compare,compares:()=>compares,writes};
}
const preview='preview-customer',admins=['seed_qa_a','seed_qa_b'];
test('Preview reset retains real client accounts beyond former 250-workspace cutoff',async()=>{
  const originals=Array.from({length:300},(_,i)=>'real-customer-'+i),f=fixture(originals);
  const result=await replacePreviewWorkspaceIndex(f.kv,preview,admins,{compare:f.compare});
  assert.equal(result.retained,300);
  assert.equal(result.seeded,3);
  assert.equal(f.values.get('workspace:index').length,303);
  assert.equal(f.values.get('workspace:index')[302],'real-customer-299');
  assert.deepEqual(f.writes,['workspace:index']);
});
test('Preview reseed refreshes only generated accounts and avoids duplicate primary workspace',async()=>{
  const f=fixture(['seed_old',preview,'real-1','seed_old2','real-2']);
  await replacePreviewWorkspaceIndex(f.kv,preview,admins,{compare:f.compare});
  assert.deepEqual(f.values.get('workspace:index'),[preview,...admins,'real-1','real-2']);
});
test('concurrently registered client workspace survives compare-and-set retry',async()=>{
  const f=fixture(['real-1'],{conflict:true});
  await replacePreviewWorkspaceIndex(f.kv,preview,admins,{compare:f.compare});
  assert.equal(f.compares(),2);
  assert.deepEqual(f.values.get('workspace:index'),[preview,...admins,'concurrent-client','real-1']);
});
test('malformed, duplicated, over-capacity and spoofed fake fixture fail without writes',async()=>{
  const cases=[
    {existing:{wrong:true},ids:admins},
    {existing:['real','real'],ids:admins},
    {existing:['real',null],ids:admins},
    {existing:Array.from({length:MAX_WORKSPACES},(_,i)=>'real-'+i),ids:admins},
    {existing:['real'],ids:['real-user']},
    {existing:['real'],ids:['seed_one','seed_one']}
  ];
  for(const {existing,ids} of cases){
    const f=fixture(existing),before=clone([...f.values]);
    await assert.rejects(replacePreviewWorkspaceIndex(f.kv,preview,ids,{compare:f.compare}));
    assert.deepEqual([...f.values],before);assert.equal(f.compares(),0);
  }
});
test('failed Preview directory transaction leaves all registered accounts indexed',async()=>{
  const f=fixture(['real-1','seed_old'],{fail:true});
  await assert.rejects(replacePreviewWorkspaceIndex(f.kv,preview,admins,{compare:f.compare}));
  assert.deepEqual(f.values.get('workspace:index'),['real-1','seed_old']);
  assert.equal(f.writes.length,0);
});
test('repeat Preview workspace reset is idempotent',async()=>{
  const f=fixture([preview,...admins,'real-1']);
  await replacePreviewWorkspaceIndex(f.kv,preview,admins,{compare:f.compare});
  assert.deepEqual(f.values.get('workspace:index'),[preview,...admins,'real-1']);
});
