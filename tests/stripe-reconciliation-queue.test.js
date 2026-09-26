const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {recordCheckoutReconciliation,RECONCILIATION_RECORD}=require('../lib/stripe-reconciliation');

function fixture({malformed=false}={}){
 const values=new Map(),index=[],calls=[];
 const kv={
   eval:async(script,keys,args)=>{
     calls.push({script,keys,args});
     if(malformed)return -1;
     if(values.has(keys[0]))return 0;
     values.set(keys[0],JSON.parse(args[0]));
     index.unshift(args[1]);index.splice(200);
     return 1;
   },get:async key=>values.get(key)||null,lrange:async()=>[...index]
 };
 return {kv,values,index,calls};
}
test('paid checkout exception records one bounded, sanitized item for admin review',async()=>{
 const f=fixture();
 const item=await recordCheckoutReconciliation(f.kv,{sessionId:'cs_123',eventId:'evt_456',email:'Buyer@Example.test',reason:'email_mismatch'});
 assert.equal(item.id,'cs_123');
 assert.equal(item.reason,'email_mismatch');
 assert.equal(item.status,'open');
 assert.equal(item.emailFingerprint.length,64);
 assert.ok(!JSON.stringify(item).includes('Buyer@Example.test'));
 assert.deepEqual(f.index,['cs_123']);
 assert.equal(f.calls[0].args.length,2);
 assert.match(RECONCILIATION_RECORD,/redis\.call\('TYPE',KEYS\[2\]\)/);
 assert.ok(RECONCILIATION_RECORD.indexOf("redis.call('TYPE',KEYS[2])")<RECONCILIATION_RECORD.indexOf("redis.call('SET',KEYS[1]"));
 assert.match(RECONCILIATION_RECORD,/'EX',7776000/);
 await recordCheckoutReconciliation(f.kv,{sessionId:'cs_123',eventId:'evt_retry',email:'Buyer@Example.test',reason:'email_mismatch'});
 assert.equal(f.index.length,1);
 assert.equal(f.values.get('stripe:reconciliation:cs_123').eventId,'evt_456');
});
test('malformed directory and unsupported reasons fail closed without creating queue items',async()=>{
 const broken=fixture({malformed:true});
 await assert.rejects(()=>recordCheckoutReconciliation(broken.kv,{sessionId:'cs_123',reason:'account_mapping_conflict'}),/directory is malformed/);
 assert.equal(broken.values.size,0);
 assert.equal(broken.index.length,0);
 const f=fixture();
 await assert.rejects(()=>recordCheckoutReconciliation(f.kv,{sessionId:'cs_123',reason:'arbitrary injection'}),/Valid reconciliation category/);
 assert.equal(f.calls.length,0);
});
test('admin finance exposes unresolved cases without customer email or payment reassignment controls',async()=>{
 const source=fs.readFileSync('api/account.js','utf8');
 const start=source.indexOf('async function adminFinance(req,res)'),end=source.indexOf('\nasync function adminFinanceExpenseSave(',start);
 assert.ok(start>=0&&end>start);
 const f=fixture();
 await recordCheckoutReconciliation(f.kv,{sessionId:'cs_123',eventId:'evt_456',email:'buyer@example.test',reason:'workspace_owner_mismatch'});
 const ctx=vm.createContext({
   requireAdmin:async()=>({email:'admin@example.test'}),
   loadAdminWorkspaces:async()=>[],
   kv:{lrange:f.kv.lrange,get:async key=>key.startsWith('stripe:reconciliation:')?f.kv.get(key):[]},
   financeMonthKey:()=> '2026-09',expenseMonthlyEquivalent:()=>0,currentBillableWorkspaces:()=>[],
   recordFinanceSnapshot:async(_kv,_old,one)=>[one],
   process:{env:{VERCEL_ENV:'production'}},Date,Number,Math,Set,Promise,
   console:{error(){}},safeError:()=> 'redacted',
   req:{},res:{status(n){this.code=n;return this},json(x){this.body=x;return x}}
 });
 vm.runInContext(source.slice(start,end),ctx);
 await vm.runInContext('adminFinance(req,res)',ctx);
 assert.equal(ctx.res.code,200);
 assert.equal(ctx.res.body.finance.reconciliation.length,1);
 const visible=ctx.res.body.finance.reconciliation[0];
 assert.equal(visible.reason,'workspace_owner_mismatch');
 assert.equal(visible.sessionId,'cs_123');
 assert.equal(visible.emailFingerprint,undefined);
 assert.ok(!JSON.stringify(ctx.res.body).includes('buyer@example.test'));
 const html=fs.readFileSync('admin-dashboard.html','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
 assert.match(html,/id="financeReconciliationList"/);
 assert.match(ui,/d\.reconciliation/);
 assert.match(ui,/Review in Stripe/);
 assert.doesNotMatch(ui,/data-reconcile-payments=|resolveStripeMapping/);
});
