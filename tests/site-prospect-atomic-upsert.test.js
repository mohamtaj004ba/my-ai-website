const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('lib/site-analytics.js','utf8');

function fixture({injectConflict=false}={}){
  const values=new Map(),index=[],operations=[];
  let conflicts=0,uuids=0;
  const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
  const kv={
    get:async key=>clone(values.get(key)??null),
    eval:async(script,keys,args)=>{
      operations.push({script,keys:[...keys],args:[...args]});
      if(injectConflict&&conflicts++===0)return 0;
      const before=values.has(keys[0])?JSON.stringify(values.get(keys[0])):'';
      if(before!==args[0])return 0;
      if(args[4]==='1'&&(values.get(keys[2])||'')!==args[2])return 0;
      const prev=args[4]==='1'?3:2;
      if(args[5]==='1'&&(values.get(keys[prev])||'')!==args[3])return 0;
      values.set(keys[0],JSON.parse(args[1]));
      if(args[4]==='1')values.set(keys[2],args[8]);
      if(args[5]==='1'&&args[6]==='1')values.delete(keys[prev]);
      if(args[7]==='1'){index.unshift(args[8]);index.splice(2000)}
      return 1;
    },
    set:()=>{throw Error('prospect must not write with plain SET')},
    lpush:()=>{throw Error('prospect index must be atomic')},
    ltrim:()=>{throw Error('prospect index trim must be atomic')}
  };
  const module={exports:{}};
  vm.runInNewContext(source,{
    module,exports:module.exports,require:name=>name==='crypto'?{...crypto,randomUUID:()=> 'test-id-'+(++uuids)}:name==='./kv'?{kv}:require(name),
    Date,Math,Number,String,Promise,Set,Error
  });
  return {upsert:module.exports.upsertWebsiteProspect,values,index,operations,kv,emailKey:module.exports.emailKey};
}
test('new prospect publishes record, email match and directory atomically',async()=>{
  const f=fixture();
  const p=await f.upsert({email:'  LEAD@example.test ',name:'First',source:'contact',utmCampaign:'spring'});
  assert.equal(p.id,'test-id-1');
  assert.equal(f.index.length,1);
  assert.equal(f.values.get('site:prospect:email:'+f.emailKey('lead@example.test')),p.id);
  assert.equal(f.values.get('site:prospect:'+p.id).name,'First');
  assert.equal(f.operations.length,1);
  const script=f.operations[0].script;
  assert.ok(script.indexOf("redis.call('GET',KEYS[1])")<script.indexOf("redis.call('SET',KEYS[1]"));
  assert.ok(script.indexOf("redis.call('SET',KEYS[1]")<script.indexOf("redis.call('LPUSH',KEYS[2]"));
});
test('same email reuses prospect and preserves first attribution without indexing twice',async()=>{
  const f=fixture();
  const first=await f.upsert({email:'lead@example.test',name:'First',source:'contact',utmCampaign:'spring'});
  const second=await f.upsert({email:'lead@example.test',name:'Second',source:'get_started',stage:'checkout_started',utmCampaign:'fall'});
  assert.equal(second.id,first.id);
  assert.equal(second.firstSource,'contact');
  assert.equal(second.firstUtmCampaign,'spring');
  assert.equal(second.utmCampaign,'fall');
  assert.equal(f.index.length,1);
});
test('snapshot conflict re-reads ownership rather than publishing duplicate lead',async()=>{
  const f=fixture({injectConflict:true});
  const item=await f.upsert({email:'lead@example.test',name:'Lead'});
  assert.equal(f.operations.length,2);
  assert.equal(f.index.length,1);
  assert.equal(f.values.get('site:prospect:email:'+f.emailKey('lead@example.test')),item.id);
});
test('email move removes only owned former lookup within the record transaction',async()=>{
  const f=fixture();
  const first=await f.upsert({email:'old@example.test',name:'Lead'});
  await f.upsert({id:first.id,email:'new@example.test',name:'New'});
  assert.equal(f.values.has('site:prospect:email:'+f.emailKey('old@example.test')),false);
  assert.equal(f.values.get('site:prospect:email:'+f.emailKey('new@example.test')),first.id);
  assert.equal(f.index.length,1);
});
test('collision and orphaned email mappings fail closed with no extra records',async()=>{
  const f=fixture();
  const existing=await f.upsert({email:'taken@example.test'});
  await assert.rejects(()=>f.upsert({id:'other',email:'taken@example.test'}),/another record/);
  assert.equal(f.values.has('site:prospect:other'),false);
  f.values.set('site:prospect:email:'+f.emailKey('orphan@example.test'),'missing-id');
  await assert.rejects(()=>f.upsert({email:'orphan@example.test'}),/missing record/);
  assert.equal(f.index.length,1);
  assert.equal(f.index[0],existing.id);
});
test('transaction errors never commit partial client index or email lookup writes',async()=>{
  const f=fixture();
  const original=f.kv.eval;f.kv.eval=async()=>{throw Error('upstream down')};
  await assert.rejects(()=>f.upsert({email:'failed@example.test'}),/upstream down/);
  assert.equal(f.index.length,0);
  assert.equal(f.values.size,0);
  f.kv.eval=original;
});
