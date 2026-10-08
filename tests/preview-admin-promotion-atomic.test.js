const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function promotePreviewAdmin(req,res){');
const end=source.indexOf('\nasync function previewQaSession(',start);
assert.ok(start>=0&&end>start);
const handler=source.slice(start,end);
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function fixture(index,{member={workspaceId:'qa-one',role:'owner',email:'qa@example.test',sessionVersion:1},workspace={id:'qa-one',previewQa:true},allowed=true,conflict='',fail=false}={}){
  const values=new Map(),reads=[],writes=[];let compares=0,code=null,payload=null;
  if(index!==undefined)values.set('workspace:index',clone(index));
  if(member)values.set('user:email:qa@example.test',clone(member));
  if(workspace)values.set('workspace:qa-one',clone(workspace));
  const kv={get:async key=>{reads.push(key);return clone(values.get(key)??null)},set:async()=>assert.fail('Preview promotion must use CAS, not separate KV writes')};
  async function compare(_kv,updates){
    compares++;
    if(fail)throw Error('KV unavailable');
    if(compares===1&&conflict){
      if(conflict==='directory')values.set('workspace:index',['concurrent-client',...(values.get('workspace:index')||[])]);
      if(conflict==='member')values.set('user:email:qa@example.test',{...values.get('user:email:qa@example.test'),sessionVersion:2});
      return false;
    }
    if(updates.some(u=>JSON.stringify(values.get(u.key)??null)!==JSON.stringify(u.before??null)))return false;
    updates.forEach(u=>{values.set(u.key,clone(u.after));writes.push(u.key)});
    return true;
  }
  const ctx=vm.createContext({
    kv,compareAndSetConfig:compare,previewQaRequestAllowed:()=>allowed,
    cleanEmail:x=>String(x||'').toLowerCase().trim(),safeError:()=> 'Unavailable',
    console:{error(){}},req:{body:{email:'QA@Example.Test'}},
    res:{status(n){code=n;return this},json(x){payload=x;return x}},
    Number,Array,String,Set,Promise
  });
  vm.runInContext(handler,ctx);
  return {values,writes,reads,compares:()=>compares,run:async()=>{await vm.runInContext('promotePreviewAdmin(req,res)',ctx);return {code,payload}}};
}
test('promotes existing indexed QA account and revokes old session version atomically',async()=>{
  const f=fixture(['qa-one','real-1']),r=await f.run();
  assert.equal(r.code,200);
  assert.equal(f.values.get('user:email:qa@example.test').role,'admin');
  assert.equal(f.values.get('user:email:qa@example.test').sessionVersion,2);
  assert.deepEqual(f.writes,['user:email:qa@example.test']);
  assert.deepEqual(f.values.get('workspace:index'),['qa-one','real-1']);
});
test('legacy missing QA index entry is restored without losing old or concurrent clients',async()=>{
  const f=fixture(['real-1'],{conflict:'directory'}),r=await f.run();
  assert.equal(r.code,200);assert.equal(f.compares(),2);
  assert.deepEqual(f.values.get('workspace:index'),['concurrent-client','real-1','qa-one']);
  assert.deepEqual(f.writes,['user:email:qa@example.test','workspace:index']);
});
test('concurrent role or session edit is not overwritten by stale promotion',async()=>{
  const f=fixture(['qa-one'],{conflict:'member'}),r=await f.run();
  assert.equal(r.code,200);assert.equal(f.compares(),2);
  assert.equal(f.values.get('user:email:qa@example.test').sessionVersion,3);
});
test('real Preview customers cannot be promoted by QA launcher',async()=>{
  const f=fixture(['qa-one'],{workspace:{id:'qa-one',previewQa:false}}),r=await f.run();
  assert.equal(r.code,409);assert.equal(f.compares(),0);
  assert.equal(f.values.get('user:email:qa@example.test').role,'owner');
});
test('missing member or missing workspace fails without creating admin',async()=>{
  for(const f of [fixture(['qa-one'],{member:null}),fixture(['qa-one'],{workspace:null})]){
    const r=await f.run();
    assert.ok([404,409].includes(r.code));assert.equal(f.writes.length,0);
  }
});
test('malformed or full index cannot hide an unindexed QA account',async()=>{
  for(const index of [{bad:true},['real-1','real-1'],Array.from({length:2000},(_,i)=>'real-'+i)]){
    const f=fixture(index),r=await f.run();
    assert.ok([409,503].includes(r.code));
    assert.equal(f.compares(),0);assert.equal(f.values.get('user:email:qa@example.test').role,'owner');
  }
});
test('already indexed QA user can be promoted even when directory is full',async()=>{
  const f=fixture(['qa-one',...Array.from({length:1999},(_,i)=>'real-'+i)]),r=await f.run();
  assert.equal(r.code,200);
  assert.deepEqual(f.writes,['user:email:qa@example.test']);
  assert.equal(f.values.get('workspace:index').length,2000);
});
test('uncertain promotion persistence does not claim admin access',async()=>{
  const f=fixture(['real-1'],{fail:true}),r=await f.run();
  assert.equal(r.code,503);
  assert.equal(f.values.get('user:email:qa@example.test').role,'owner');
  assert.deepEqual(f.values.get('workspace:index'),['real-1']);
});
test('unauthorized QA launcher never reads or promotes an account',async()=>{
  const f=fixture(['qa-one'],{allowed:false}),r=await f.run();
  assert.equal(r.code,404);assert.equal(f.reads.length,0);assert.equal(f.compares(),0);
});
