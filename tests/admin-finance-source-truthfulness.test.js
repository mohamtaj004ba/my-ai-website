const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function adminFinance(req,res)'),end=source.indexOf('\nasync function adminFinanceExpenseSave(',start),handler=source.slice(start,end);
assert.ok(start>=0&&end>start);

async function run({expenses=[],history=[],reconciliation=[],reconciliationRecords={}}={}){
  let status=0,payload,snapshots=0;
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),loadAdminWorkspaces:async()=>[],
    kv:{get:async key=>key==='finance:expenses'?expenses:key==='finance:history'?history:(key.startsWith('stripe:reconciliation:')?reconciliationRecords[key]||null:null),lrange:async()=>reconciliation},
    financeMonthKey:()=> '2026-09',financeMonthEnd:()=>Date.now(),financeRevenueForMonth:()=>0,financeExpenseForMonth:()=>0,
    expenseMonthlyEquivalent:()=>0,currentBillableWorkspaces:()=>[],recordFinanceSnapshot:async()=>{snapshots++;return []},
    process:{env:{VERCEL_ENV:'production'}},Date,Number,Math,Set,String,Array,Promise,
    req:{},res:{status(n){status=n;return this},json(x){payload=x;return x}},safeError:()=>'',console:{error(){}}
  });
  vm.runInContext(handler,ctx);await vm.runInContext('adminFinance(req,res)',ctx);return {status,payload,snapshots};
}
test('malformed expense storage cannot impersonate zero company costs',async()=>{
  const r=await run({expenses:{corrupt:true}});assert.equal(r.status,503);assert.match(r.payload.error,/expense records are unavailable/);assert.equal(r.snapshots,0);
});
test('malformed finance history cannot be replaced by a new apparently healthy snapshot',async()=>{
  const r=await run({history:{corrupt:true}});assert.equal(r.status,503);assert.match(r.payload.error,/Finance history is unavailable/);assert.equal(r.snapshots,0);
});
test('finance handler uses validated arrays after source checks',()=>{
  assert.match(handler,/storedExpenses!=null&&!Array\.isArray\(storedExpenses\)/);
  assert.match(handler,/storedHistory!=null&&!Array\.isArray\(storedHistory\)/);
  assert.match(handler,/const expenses=storedExpenses\|\|\[\],history=\(storedHistory\|\|\[\]\)\.slice\(\)/);
});

test('malformed individual expense rows fail closed before totals or history are recorded',async()=>{
  const r=await run({expenses:[{id:'exp_1',name:'Hosting',amount:'not-a-number',frequency:'monthly',status:'active'}]});
  assert.equal(r.status,503);assert.match(r.payload.error,/expense records are malformed/);assert.equal(r.snapshots,0);
});
test('malformed individual finance history rows fail closed before refresh',async()=>{
  const r=await run({history:[{month:'2026-09',revenue:100,expenses:20,net:'bad',activeClients:1}]});
  assert.equal(r.status,503);assert.match(r.payload.error,/history contains malformed records/);assert.equal(r.snapshots,0);
});
test('row-level source validation remains part of the finance handler',()=>{
  assert.match(handler,/storedExpenses\.some\(item=>/);
  assert.match(handler,/storedHistory\.some\(row=>/);
});

test('finance mutation handlers reject malformed sibling expense rows before editing or deleting',()=>{
  const saveStart=source.indexOf('async function adminFinanceExpenseSave('),saveEnd=source.indexOf('\nasync function adminFinanceExpenseDelete(',saveStart),saveBlock=source.slice(saveStart,saveEnd);
  const deleteStart=source.indexOf('async function adminFinanceExpenseDelete('),deleteEnd=source.indexOf('\nasync function ',deleteStart+1),deleteBlock=source.slice(deleteStart,deleteEnd);
  assert.match(saveBlock,/Company expense records contain unverifiable entries\. No changes were made/);
  assert.match(deleteBlock,/Company expense records contain unverifiable entries\. No changes were made/);
  assert.match(saveBlock,/list\.some\(item=>/);
  assert.match(deleteBlock,/list\.some\(item=>/);
});

test('malformed or duplicate reconciliation queue ids are disclosed as incomplete coverage',async()=>{
  const r=await run({reconciliation:['case-1','case-1','',42],reconciliationRecords:{'stripe:reconciliation:case-1':{id:'case-1',sessionId:'case-1',eventId:'evt-1',reason:'email_mismatch',createdAt:1,resolvedAt:2,status:'resolved'}}});
  assert.equal(r.status,200);
  assert.equal(r.payload.finance.reconciliationCoverage.retainedCaseIds,4);
  assert.equal(r.payload.finance.reconciliationCoverage.verifiedCaseIds,1);
  assert.equal(r.payload.finance.reconciliationCoverage.unavailableCaseRecords,3);
  assert.equal(r.payload.finance.reconciliationCoverage.isIncomplete,true);
});

test('malformed reconciliation records are excluded and disclosed as incomplete coverage',async()=>{
  const bad=[
    {id:'wrong',sessionId:'case-1',reason:'email_mismatch',createdAt:1,status:'open'},
    {id:'case-1',sessionId:'case-1',reason:'unknown',createdAt:1,status:'open'},
    {id:'case-1',sessionId:'case-1',reason:'email_mismatch',createdAt:0,status:'open'},
    {id:'case-1',sessionId:'case-1',reason:'email_mismatch',createdAt:2,resolvedAt:1,status:'resolved'}
  ];
  for(const record of bad){
    const r=await run({reconciliation:['case-1'],reconciliationRecords:{'stripe:reconciliation:case-1':record}});
    assert.equal(r.status,200);
    assert.equal(r.payload.finance.reconciliation.length,0);
    assert.equal(r.payload.finance.reconciliationCoverage.unavailableCaseRecords,1);
    assert.equal(r.payload.finance.reconciliationCoverage.isIncomplete,true);
  }
});
