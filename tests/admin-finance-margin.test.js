const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('admin finance operating margin includes this month one-time company costs',async()=>{
  const source=fs.readFileSync('api/account.js','utf8');
  const start=source.indexOf('async function adminFinance(req,res)');
  const end=source.indexOf('\nasync function adminFinanceExpenseSave(',start);
  assert.ok(start>=0&&end>start);
  let response,historyCalls=0;
  const records=[
    {name:'Hosting',amount:10,frequency:'monthly',status:'active'},
    {name:'Equipment',amount:50,frequency:'one_time',status:'active',date:'2026-09-25'}
  ];
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    loadAdminWorkspaces:async()=>[{id:'client',plan:'Starter',status:'active',subscriptionStatus:'active'}],
    kv:{get:async key=>key==='finance:expenses'?records:[]},
    financeMonthKey:()=> '2026-09',
    expenseMonthlyEquivalent:x=>x.frequency==='monthly'?x.amount:0,
    currentBillableWorkspaces:ws=>ws,
    recordFinanceSnapshot:async(kv,initial,snapshot)=>{historyCalls++;return [snapshot]},
    process:{env:{VERCEL_ENV:'production'}},Date,Number,Math,
    req:{},res:{status(code){this.code=code;return this},json(data){response=data;return data}}
  });
  vm.runInContext(source.slice(start,end),context);
  await vm.runInContext('adminFinance(req,res)',context);
  assert.equal(context.res.code,200);
  assert.equal(historyCalls,1);
  assert.equal(response.finance.mrr,349);
  assert.equal(response.finance.recurringExpenses,10);
  assert.equal(response.finance.currentMonthExpenses,60);
  assert.equal(response.finance.netRecurring,339);
  assert.equal(response.finance.margin,Math.round(((349-60)/349)*1000)/10);
  assert.equal(response.finance.history[0].expenses,60);
});
