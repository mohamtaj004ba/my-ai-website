const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const begin=source.indexOf('async function bootstrapPreview(req,res){');
const end=source.indexOf('\nasync function seedPreviewData(',begin);
assert.ok(begin>=0&&end>begin);
const handler=source.slice(begin,end);
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function fixture(index,{conflict='',fail=false,member=null,allowed=true}={}){
  const values=new Map(),reads=[],writes=[];
  if(index!==undefined)values.set('workspace:index',clone(index));
  if(member)values.set('user:email:qa@example.test',clone(member));
  let compares=0,serial=0;
  const kv={
    get:async key=>{reads.push(key);return clone(values.get(key)??null)},
    set:async()=>assert.fail('Preview bootstrap must not use independent KV writes')
  };
  const compare=async(_kv,updates)=>{
    compares++;
    if(fail)throw Error('KV failed');
    if(compares===1&&conflict==='directory'){
      values.set('workspace:index',['new-concurrent-client',...(values.get('workspace:index')||[])]);
      return false;
    }
    if(compares===1&&conflict==='same-email'){
      values.set('user:email:qa@example.test',{workspaceId:'other-qa',role:'owner',email:'qa@example.test'});
      values.set('workspace:other-qa',{id:'other-qa',plan:'Growth',previewQa:true});
      return false;
    }
    for(const item of updates)if(JSON.stringify(values.get(item.key)??null)!==JSON.stringify(item.before??null))return false;
    updates.forEach(item=>{values.set(item.key,clone(item.after));writes.push(item.key)});
    return true;
  };
  let code=null,payload=null;
  const ctx=vm.createContext({
    kv,crypto:{randomUUID:()=> 'created-qa-'+(++serial)},
    compareAndSetConfig:compare,previewQaRequestAllowed:()=>allowed,
    cleanEmail:x=>String(x||'').trim().toLowerCase(),
    entitlementsFor:p=>({plan:p}),
    safeError:()=> 'Unavailable',console:{error(){}},
    req:{body:{email:'QA@Example.Test',businessName:'Isolated Preview test',plan:'Growth'}},
    res:{status(n){code=n;return this},json(x){payload=x;return x}},
    Promise,Array,String,Number,Object,Set,Date
  });
  vm.runInContext(handler,ctx);
  return {values,reads,writes,compares:()=>compares,run:async()=>{await vm.runInContext('bootstrapPreview(req,res)',ctx);return {code,payload}}};
}
test('Preview QA bootstrap atomically creates workspace, owner and complete index',async()=>{
  const originals=Array.from({length:300},(_,i)=>'real-'+i),f=fixture(originals);
  const r=await f.run();
  assert.equal(r.code,201);
  assert.equal(r.payload.workspaceId,'created-qa-1');
  assert.equal(f.values.get('workspace:index').length,301);
  assert.equal(f.values.get('workspace:index').at(-1),'created-qa-1');
  assert.equal(f.values.get('workspace:created-qa-1').previewQa,true);
  assert.equal(f.values.get('user:email:qa@example.test').workspaceId,'created-qa-1');
  assert.deepEqual(f.writes,['workspace:created-qa-1','user:email:qa@example.test','workspace:index']);
});
test('concurrent workspace signup does not disappear from Preview account directory',async()=>{
  const f=fixture(['old-qa'],{conflict:'directory'}),r=await f.run();
  assert.equal(r.code,201);assert.equal(f.compares(),2);
  assert.deepEqual(f.values.get('workspace:index'),['new-concurrent-client','old-qa','created-qa-1']);
  assert.ok(f.values.get('workspace:created-qa-1'));
});
test('concurrent same-email bootstrap safely reuses other verified QA workspace',async()=>{
  const f=fixture(['old-qa'],{conflict:'same-email'}),r=await f.run();
  assert.equal(r.code,200);
  assert.equal(r.payload.reused,true);
  assert.equal(r.payload.workspaceId,'other-qa');
  assert.equal(r.payload.plan,'Growth');
  assert.equal(f.values.has('workspace:created-qa-1'),false);
  assert.deepEqual(f.values.get('workspace:index'),['old-qa']);
});
test('existing Preview workspace is reused without index or account writes',async()=>{
  const f=fixture(['old-qa'],{member:{workspaceId:'old-qa',role:'owner',email:'qa@example.test'}});
  f.values.set('workspace:old-qa',{id:'old-qa',plan:'Pro',previewQa:true});
  const r=await f.run();
  assert.equal(r.code,200);assert.equal(r.payload.plan,'Pro');
  assert.equal(f.compares(),0);assert.equal(f.writes.length,0);
});
test('foreign and malformed email records are never replaced by QA bootstrap',async()=>{
  for(const member of [{workspaceId:'real-customer',role:'owner'}, {email:'qa@example.test'}]){
    const f=fixture(['real-customer'],{member});
    if(member.workspaceId)f.values.set('workspace:real-customer',{id:'real-customer',previewQa:false});
    const r=await f.run();
    assert.equal(r.code,409);assert.equal(f.compares(),0);
    assert.deepEqual(f.values.get('user:email:qa@example.test'),member);
  }
});
test('malformed, duplicate and capacity-exhausted directories fail without orphan records',async()=>{
  const cases=[{bad:true},['real-1','real-1'],['real-1',null],Array.from({length:2000},(_,i)=>'real-'+i)];
  for(const raw of cases){
    const f=fixture(raw),r=await f.run();
    assert.ok([409,503].includes(r.code));
    assert.equal(f.compares(),0);assert.equal(f.values.has('workspace:created-qa-1'),false);
    assert.equal(f.values.has('user:email:qa@example.test'),false);
    assert.deepEqual(f.values.get('workspace:index'),raw);
  }
});
test('uncertain storage failure never reports successful account creation',async()=>{
  const f=fixture(['real-1'],{fail:true}),r=await f.run();
  assert.equal(r.code,503);assert.match(r.payload.error,/Could not confirm/);
  assert.equal(f.writes.length,0);assert.equal(f.values.has('workspace:created-qa-1'),false);
});
test('unauthorized Preview bootstrap reads no user or workspace records',async()=>{
  const f=fixture(['real-1'],{allowed:false}),r=await f.run();
  assert.equal(r.code,404);assert.equal(f.reads.length,0);assert.equal(f.compares(),0);
});
