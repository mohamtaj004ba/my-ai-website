const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');
const {compareAndSetWithDelete,CONFIG_COMPARE_AND_SET_WITH_DELETE}=require('../lib/config-transaction');
const base={id:'campaign-1',name:'Old campaign',budget:5,status:'draft',createdAt:1,updatedAt:10};

function fixture(action,{existing=base,ids=['campaign-1'],expectedUpdatedAt=10,commit=true,budget=12,clock=20}={}){
  let code=0,result,calls=0,updates,deleted=[],setCalls=0;
  const rawIndex=ids;
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>key==='marketing:campaign:index'?rawIndex:key==='marketing:campaign:'+String(action==='create'?'':base.id)?existing:null,
      set:()=>{setCalls++;throw Error('Campaign writes must be atomic')},
      del:()=>{setCalls++;throw Error('Campaign deletes must be atomic')}},
    compareAndSetConfig:async(_kv,records)=>{calls++;updates=records;if(commit==='error')throw Error('network');return commit},
    compareAndSetWithDelete:async(_kv,records,opts)=>{calls++;updates=records;deleted=opts.deleteKeys;if(commit==='error')throw Error('network');return commit},
    crypto:{randomUUID:()=> 'created-campaign'},Date:{now:()=>clock},Math,Number,String,Promise,
    safeError:()=>'',console:{error(){}},
    req:{body:action==='delete'?{id:'campaign-1',expectedUpdatedAt}:action==='create'?{name:'New campaign',budget}:{id:'campaign-1',name:'Updated campaign',budget,expectedUpdatedAt}},
    res:{status(n){code=n;return this},json(x){result=x;return x}}
  });
  // Campaign ID for a new campaign is generated in-handler; override KV
  // responses to represent the missing new key rather than an existing edit.
  context.kv.get=async key=>key==='marketing:campaign:index'?rawIndex:key==='marketing:campaign:campaign-1'?existing:null;
  const start=api.indexOf('async function adminMarketingCampaigns('),end=api.indexOf('\nasync function adminDocuments(',start);
  assert.ok(start>=0&&end>start);
  vm.runInContext(api.slice(start,end),context);
  const fn=action==='delete'?'adminMarketingCampaignDelete':'adminMarketingCampaignSave';
  return {run:async()=>{await vm.runInContext(fn+'(req,res)',context);return {code,result,calls,updates,deleted,setCalls}}};
}

test('campaign creates index and campaign atomically without silent truncation',async()=>{
  const r=await fixture('create').run();
  assert.equal(r.code,201);
  assert.equal(r.calls,1);
  assert.equal(r.updates[0].key,'marketing:campaign:created-campaign');
  assert.equal(r.updates[0].before,null);
  assert.equal(r.updates[1].key,'marketing:campaign:index');
  assert.equal(r.updates[1].after[0],'created-campaign');
  assert.equal(r.updates[1].after[1],'campaign-1');
  assert.equal(r.setCalls,0);
});

test('campaign edits reject stale and competing saves, including same-millisecond revisions',async()=>{
  for(const opts of [{expectedUpdatedAt:9},{commit:false},{commit:'error'}]){
    const r=await fixture('edit',opts).run();
    assert.equal(r.code,opts.commit==='error'?503:409);
    if(opts.expectedUpdatedAt===9)assert.equal(r.calls,0);
  }
  const r=await fixture('edit',{clock:10}).run();
  assert.equal(r.code,200);
  assert.equal(r.updates[0].after.updatedAt,11);
  assert.equal(r.updates[0].after.budget,12);
});

test('campaign deletes remove record and index together or change neither',async()=>{
  const r=await fixture('delete').run();
  assert.equal(r.code,200);
  assert.deepEqual(r.deleted,['marketing:campaign:campaign-1']);
  assert.equal(r.updates[1].after.length,0);
  assert.equal(r.setCalls,0);
  assert.equal((await fixture('delete',{expectedUpdatedAt:9}).run()).code,409);
  assert.equal((await fixture('delete',{commit:false}).run()).code,409);
});

test('campaign mutations fail closed for index corruption and directory capacity',async()=>{
  const bad=await fixture('create',{ids:{bad:true}}).run();
  assert.equal(bad.code,503);
  const full=await fixture('create',{ids:Array.from({length:500},(_,i)=>'campaign-'+i)}).run();
  assert.equal(full.code,409);
  const budget=await fixture('edit',{budget:-1}).run();
  assert.equal(budget.code,400);
});

test('atomic delete script compares snapshots before removing either key',async()=>{
  const kv={eval:async(script,keys,args)=>{
    assert.equal(script,CONFIG_COMPARE_AND_SET_WITH_DELETE);
    assert.deepEqual(keys,['marketing:campaign:campaign-1','marketing:campaign:index']);
    assert.equal(args[0],'2');assert.equal(args[2],'__CALLERCORE_DELETE__');
    assert.equal(args[4],JSON.stringify(['campaign-1']));
    return 1;
  }};
  assert.equal(await compareAndSetWithDelete(kv,[{key:'marketing:campaign:campaign-1',before:base,after:null},{key:'marketing:campaign:index',before:['campaign-1'],after:['campaign-1']}],{deleteKeys:['marketing:campaign:campaign-1']}),true);
  assert.ok(CONFIG_COMPARE_AND_SET_WITH_DELETE.indexOf("current~=ARGV")<CONFIG_COMPARE_AND_SET_WITH_DELETE.indexOf("redis.call('DEL'"));
});

test('campaign form submits snapshot revisions and keeps confirmed saves after refresh failure',()=>{
  const start=dashboard.indexOf('async function deleteCampaign('),end=dashboard.indexOf('\nfunction renderDocuments(',start);
  assert.ok(start>=0&&end>start);
  const text=dashboard.slice(start,end);
  assert.match(text,/expectedUpdatedAt:Number\(c\?\.updatedAt\|\|c\?\.createdAt\|\|0\)/);
  assert.match(text,/expectedUpdatedAt:editing\?Number\(editing.updatedAt\|\|editing.createdAt\|\|0\):undefined/);
  assert.match(text,/adminCampaignData=\[data.campaign/);
});
