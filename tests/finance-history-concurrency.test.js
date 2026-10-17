const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {recordFinanceSnapshot}=require('../lib/finance-history');

const month='2026-09';
const snapshot={month,revenue:349,expenses:29,net:320,activeClients:1,recordedAt:20,source:'snapshot'};

test('monthly finance snapshot is revision checked, keeping existing months',async()=>{
  let writes=0;
  const previous=[{month:'2026-08',revenue:100,recordedAt:1}];
  const kv={eval:async(script,keys,args)=>{
    writes++;assert.match(script,/GET/);assert.match(script,/SET/);
    assert.deepEqual(keys,['finance:history']);
    assert.deepEqual(JSON.parse(args[0]),previous);
    const updated=JSON.parse(args[1]);assert.deepEqual(updated.map(x=>x.month),['2026-08',month]);
    return 1;
  }};
  const result=await recordFinanceSnapshot(kv,previous,snapshot);
  assert.equal(result.length,2);assert.equal(result[1].revenue,349);assert.equal(writes,1);
});

test('parallel refresh conflict retains a more recent same-month snapshot',async()=>{
  const latest={...snapshot,recordedAt:30,revenue:699};
  const kv={eval:async()=>{kv.writes++;return 0},get:async()=>[latest]};
  kv.writes=0;
  const result=await recordFinanceSnapshot(kv,[],snapshot);
  assert.equal(result[0].revenue,699);
  assert.equal(kv.writes,1,'a newer snapshot must not be replaced after a conflict');
});

test('retry merges a concurrently recorded previous month without losing it',async()=>{
  const prior={month:'2026-08',revenue:100,recordedAt:10};
  let calls=0;
  const kv={eval:async(script,keys,args)=>{
    calls++;const updated=JSON.parse(args[1]);
    if(calls===1)return 0;
    assert.deepEqual(updated.map(x=>x.month),['2026-08',month]);return 1;
  },get:async()=>[prior]};
  const result=await recordFinanceSnapshot(kv,[],snapshot);
  assert.deepEqual(result.map(x=>x.month),['2026-08',month]);assert.equal(calls,2);
});

test('Preview reconstructed months remain when the history key is absent',async()=>{
  const seed=[{month:'2026-08',revenue:0,source:'preview_reconstruction'}];
  const kv={eval:async(script,keys,args)=>{
    assert.equal(args[0],'');assert.equal(JSON.parse(args[1])[0].source,'preview_reconstruction');return 1;
  }};
  const result=await recordFinanceSnapshot(kv,null,snapshot,{seedHistory:seed});
  assert.equal(result.length,2);
  assert.equal(result[0].source,'preview_reconstruction');
});

test('malformed history and unresolved writers fail without claiming success',async()=>{
  await assert.rejects(recordFinanceSnapshot({eval:async()=>assert.fail('No writes')},{broken:true},snapshot),/malformed/);
  let writes=0;
  const kv={eval:async()=>{writes++;return 0},get:async()=>[]};
  await assert.rejects(recordFinanceSnapshot(kv,[],snapshot),/changed during refresh/);
  assert.equal(writes,3);
});

test('admin finance routes its history writes through the atomic helper',()=>{
  const source=fs.readFileSync('api/account.js','utf8');
  const start=source.indexOf('async function adminFinance(req,res)');
  const end=source.indexOf('\nasync function adminFinanceExpenseSave(',start);
  assert.ok(start>=0&&end>start);
  const handler=source.slice(start,end);
  assert.match(handler,/recordFinanceSnapshot\(kv,storedHistory,snapshot,\{seedHistory:history\}\)/);
  assert.doesNotMatch(handler,/kv\.set\('finance:history'/);
});
