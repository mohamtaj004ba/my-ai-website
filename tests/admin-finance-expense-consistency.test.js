const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const apiSource=fs.readFileSync('api/account.js','utf8');
const dashboardSource=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function apiFunctions(context){
  const cleanStart=apiSource.indexOf('function cleanFinanceExpense('),cleanEnd=apiSource.indexOf('\nasync function loadAdminWorkspaces(',cleanStart);
  vm.runInContext(apiSource.slice(cleanStart,cleanEnd),context);
  const saveStart=apiSource.indexOf('async function adminFinanceExpenseSave('),saveEnd=apiSource.indexOf('\nasync function adminSummary(',saveStart);
  vm.runInContext(apiSource.slice(saveStart,saveEnd),context);
}
async function backend(action,{raw=[{id:'expense-1',name:'Hosting',amount:10,frequency:'monthly',status:'active',createdAt:1,updatedAt:10}],body={},transaction=true}={}){
  let updates,status=0,result;
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.com'}),Date,Number,String,Array,Set,
    crypto:{randomUUID:()=> 'expense-new'},safeError:()=>'',console:{error(){}},
    kv:{get:async()=>raw,set:()=>assert.fail('Expense mutations must use the atomic transaction')},
    compareAndSetConfig:async(_,next)=>{updates=next;if(transaction==='error')throw Error('network');return transaction},
    req:{body},res:{status(value){status=value;return this},json(value){result=value}}
  });
  apiFunctions(context);await vm.runInContext(action+'(req,res)',context);return {updates,status,result};
}

test('expense edits and deletes use revision-checked atomic array updates',async()=>{
  const edit=await backend('adminFinanceExpenseSave',{body:{id:'expense-1',name:'Hosting Plus',amount:20,frequency:'monthly',status:'active',expectedUpdatedAt:10}});
  assert.equal(edit.status,200);assert.equal(edit.updates.length,1);assert.equal(edit.updates[0].after[0].name,'Hosting Plus');assert.ok(edit.result.expense.updatedAt>10);
  const remove=await backend('adminFinanceExpenseDelete',{body:{id:'expense-1',expectedUpdatedAt:10}});
  assert.equal(remove.status,200);assert.equal(remove.updates[0].after.length,0);assert.equal(remove.result.deleted.id,'expense-1');
});

test('missing, stale, malformed and concurrent expense mutations fail closed',async()=>{
  let r=await backend('adminFinanceExpenseSave',{body:{id:'missing',name:'Gone',amount:1,expectedUpdatedAt:0}});assert.equal(r.status,404);assert.equal(r.updates,undefined);
  r=await backend('adminFinanceExpenseSave',{body:{id:'expense-1',name:'Stale',amount:1,expectedUpdatedAt:9}});assert.equal(r.status,409);assert.equal(r.updates,undefined);
  r=await backend('adminFinanceExpenseDelete',{body:{id:'expense-1',expectedUpdatedAt:9}});assert.equal(r.status,409);assert.equal(r.updates,undefined);
  r=await backend('adminFinanceExpenseSave',{raw:{bad:true},body:{name:'Bad',amount:1}});assert.equal(r.status,503);assert.equal(r.updates,undefined);
  r=await backend('adminFinanceExpenseSave',{body:{id:'expense-1',name:'Conflict',amount:1,expectedUpdatedAt:10},transaction:false});assert.equal(r.status,409);
  r=await backend('adminFinanceExpenseDelete',{body:{id:'expense-1',expectedUpdatedAt:10},transaction:'error'});assert.equal(r.status,503);
});

function frontendFixture(response){
  const nodes=new Map(),node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,dataset:{},className:'',classList:{add(){},remove(){}},setAttribute(name,value){this[name]=value}});
    return nodes.get(id);
  };
  Object.assign(node('expenseModal').dataset,{editId:'expense-1',expectedUpdatedAt:'10'});node('expenseNameInput').value='Hosting Plus';node('expenseAmountInput').value='20';node('expenseVendorInput').value='Vendor';node('expenseCategoryInput').value='Software';node('expenseFrequencyInput').value='monthly';node('expenseDateInput').value='2026-09-25';node('expenseStatusInput').value='active';node('expenseNotesInput').value='Updated';
  const pending=deferred(),alerts=[],requests=[];
  const context=vm.createContext({
    adminExpenseSaving:false,adminExpenseDeletePending:new Set(),adminFinanceData:{expenses:[{id:'expense-1',name:'Hosting',updatedAt:10}]},
    document:{getElementById:node},String,Number,JSON,fetch:(url,options)=>{requests.push({url,options});return pending.promise},alert:value=>alerts.push(value),refreshAdminView:async()=>{},renderAdminFinance(){},confirm:()=>true
  });
  const start=dashboardSource.indexOf('function closeExpenseModal('),end=dashboardSource.indexOf('\nfunction updateAdminRefreshStamp(',start);
  vm.runInContext(dashboardSource.slice(start,end),context);
  return {context,node,pending,alerts,requests,response};
}

test('expense save locks the modal, ignores duplicates and applies the server revision',async()=>{
  const f=frontendFixture(),first=vm.runInContext('saveExpense()',f.context),ignored=vm.runInContext('saveExpense()',f.context);
  assert.equal(f.context.adminExpenseSaving,true);assert.equal(f.node('closeExpenseModal').disabled,true);assert.equal(f.node('saveExpenseButton').textContent,'Saving…');
  f.pending.resolve({ok:true,json:async()=>({expense:{id:'expense-1',name:'Hosting Plus',updatedAt:20}})});await Promise.all([first,ignored]);
  assert.equal(f.context.adminExpenseSaving,false);assert.equal(f.context.adminFinanceData.expenses[0].updatedAt,20);assert.equal(f.node('expenseModal')['aria-hidden'],'true');
});

test('failed expense save unlocks the modal without replacing the draft',async()=>{
  const f=frontendFixture(),saving=vm.runInContext('saveExpense()',f.context);f.pending.resolve({ok:false,json:async()=>({error:'Expense changed'})});await saving;
  assert.equal(f.context.adminExpenseSaving,false);assert.equal(f.node('expenseNameInput').value,'Hosting Plus');assert.equal(f.node('expenseFormStatus').textContent,'Expense changed');
});

test('expense deletion sends its revision and suppresses a duplicate action',async()=>{
  const f=frontendFixture(),first=vm.runInContext("deleteExpense('expense-1')",f.context),ignored=vm.runInContext("deleteExpense('expense-1')",f.context);
  assert.equal(f.requests.length,1);assert.equal(JSON.parse(f.requests[0].options.body).expectedUpdatedAt,10);
  f.pending.resolve({ok:true,json:async()=>({deleted:{id:'expense-1',updatedAt:10}})});await Promise.all([first,ignored]);
  assert.equal(f.context.adminFinanceData.expenses.length,0);assert.equal(f.context.adminExpenseDeletePending.size,0);
});


test('opening the expense editor leaves phone form validation intact',()=>{
  const f=frontendFixture();
  f.node('phoneFormStatus').textContent='A phone number is required.';
  f.node('phoneFormStatus').className='form-status-line error';
  f.context.settingsFieldError=()=>assert.fail('Expense editor must not reset phone field errors');
  const start=dashboardSource.indexOf('function openExpenseModal('),end=dashboardSource.indexOf('\\nfunction closeExpenseModal(',start);
  assert.ok(start>=0&&end>start);
  vm.runInContext(dashboardSource.slice(start,end),f.context);
  vm.runInContext("openExpenseModal('expense-1')",f.context);
  assert.equal(f.node('phoneFormStatus').textContent,'A phone number is required.');
  assert.equal(f.node('phoneFormStatus').className,'form-status-line error');
  assert.equal(f.node('expenseModalTitle').textContent,'Edit expense');
  assert.equal(f.node('expenseModal')['aria-hidden'],'false');
});
