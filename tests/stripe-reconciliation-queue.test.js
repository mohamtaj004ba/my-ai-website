const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {recordCheckoutReconciliation,resolveCheckoutReconciliation,RECONCILIATION_RECORD,RESOLVE_RECONCILIATION}=require('../lib/stripe-reconciliation');

function fixture({malformed=false}={}){
 const values=new Map(),index=[],calls=[];
 const kv={
   eval:async(script,keys,args)=>{
     calls.push({script,keys,args});
     if(malformed)return -1;
     if(script===RESOLVE_RECONCILIATION){
       const prior=values.get(keys[0]);
       if(!prior)return 0;
       if(prior.sessionId!==args[0])return -1;
       if(prior.status!=='open')return 0;
       values.set(keys[0],{...prior,status:'resolved',resolvedAt:Number(args[1])});
       for(let i=index.length-1;i>=0;i--)if(index[i]===args[0])index.splice(i,1);
       return 1;
     }
     if(script!==RECONCILIATION_RECORD)throw Error('Unexpected Redis script');
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

test('resolved checkout exception leaves audit context but disappears from open Finance queue',async()=>{
 const f=fixture();
 await recordCheckoutReconciliation(f.kv,{sessionId:'cs_paid',eventId:'evt_paid',email:'buyer@example.test',reason:'email_mismatch'});
 assert.equal(await resolveCheckoutReconciliation(f.kv,'cs_paid'),true);
 assert.equal(await resolveCheckoutReconciliation(f.kv,'cs_paid'),false);
 const saved=f.values.get('stripe:reconciliation:cs_paid');
 assert.equal(saved.status,'resolved');
 assert.equal(saved.reason,'email_mismatch');
 assert.equal(saved.eventId,'evt_paid');
 assert.ok(saved.resolvedAt>0);
 assert.deepEqual(f.index,[]);
 assert.match(RESOLVE_RECONCILIATION,/item.status='resolved'/);
 assert.ok(RESOLVE_RECONCILIATION.indexOf("item.status='resolved'")<RESOLVE_RECONCILIATION.indexOf("redis.call('SET'"));
});
test('malformed reconciliation storage never falsely indicates success',async()=>{
 const f=fixture({malformed:true});
 await assert.rejects(()=>resolveCheckoutReconciliation(f.kv,'cs_paid'),/record is malformed/);
 await assert.rejects(()=>resolveCheckoutReconciliation(f.kv,''),/Checkout session ID required/);
});

test('unresolved paid checkouts reach the admin priority queue and Finance navigation badge',()=>{
 const ui=fs.readFileSync('dashboard.js','utf8');
 const start=ui.indexOf('function adminAttentionItems(){'),end=ui.indexOf('\nfunction adminProvisioningFor(',start);
 assert.ok(start>=0&&end>start);
 const context=vm.createContext({
   adminWebsiteData:{prospects:[]},adminClientsData:[],adminSupportData:[],adminFeedbackData:[],
   adminReadinessData:{blockers:[]},adminPlatformData:{},adminFinanceData:{
     reconciliation:[{sessionId:'cs_unsafe',createdAt:120,reason:'account_mapping_conflict'}]
   },prospectDue:()=>false
 });
 vm.runInContext(ui.slice(start,end),context);
 const results=vm.runInContext('adminAttentionItems()',context);
 assert.equal(results.length,1);
 assert.equal(results[0].type,'checkout-reconciliation');
 assert.equal(results[0].category,'Payment operations');
 assert.equal(results[0].severity,'critical');
 assert.equal(results[0].view,'finance');
 assert.match(ui,/item.type==='checkout-reconciliation'/);
 assert.match(ui,/setAdminNavBadge\('navBadgeFinance',\(adminClientsData\|\|\[\]\)\.filter\(x=>x.subscriptionStatus==='past_due'\)\.length\+\(adminFinanceData\.reconciliation\|\|\[\]\)\.length\)/);
});

test('Finance payment exceptions disclose unverified and failed refreshes rather than showing an unqualified empty queue',()=>{
 const ui=fs.readFileSync('dashboard.js','utf8'),html=fs.readFileSync('admin-dashboard.html','utf8');
 assert.match(html,/id="financeReconciliationStatus" role="status"/);
 assert.match(ui,/adminFinanceLoadError='Finance has not yet been verified\.'/);
 assert.match(ui,/else adminFinanceLoadError='Finance could not refresh; previously loaded records may be outdated\.'/);
 assert.match(ui,/if\(key==='finance'\)adminFinanceLoadError='Finance could not refresh/);
 assert.equal(ui.split("adminFinanceLoadError=''").length-1,3);
 assert.match(ui,/reconciliationStatus\.textContent=\[adminFinanceLoadError,/);
});

test('Finance reads all 200 retained reconciliation IDs and reports missing records',async()=>{
 const source=fs.readFileSync('api/account.js','utf8');
 const start=source.indexOf('async function adminFinance(req,res)'),end=source.indexOf('\nasync function adminFinanceExpenseSave(',start);
 const f=fixture(),now=Date.now();
 for(let i=0;i<200;i++){
   const id='cs_'+i;
   f.index.push(id);
   if(i===100)continue;
   f.values.set('stripe:reconciliation:'+id,{id,sessionId:id,eventId:'evt_'+i,status:i<100?'resolved':'open',reason:'email_mismatch',createdAt:now+i});
 }
 let requestedEnd=null;
 const ctx=vm.createContext({
   requireAdmin:async()=>({email:'admin@example.test'}),loadAdminWorkspaces:async()=>[],
   kv:{lrange:async(key,a,b)=>{requestedEnd=b;return f.kv.lrange(key,a,b)},get:async key=>key.startsWith('stripe:reconciliation:')?f.kv.get(key):[]},
   financeMonthKey:()=> '2026-09',expenseMonthlyEquivalent:()=>0,currentBillableWorkspaces:()=>[],
   recordFinanceSnapshot:async(_kv,_old,one)=>[one],process:{env:{VERCEL_ENV:'production'}},
   Date,Number,Math,Set,Promise,console:{error(){}},safeError:()=> 'redacted',
   req:{},res:{status(n){this.code=n;return this},json(x){this.body=x;return x}}
 });
 vm.runInContext(source.slice(start,end),ctx);
 await vm.runInContext('adminFinance(req,res)',ctx);
 assert.equal(ctx.res.code,200);
 assert.equal(requestedEnd,199);
 const data=ctx.res.body.finance;
 assert.equal(data.reconciliation.length,99);
 assert.ok(data.reconciliation.some(x=>x.sessionId==='cs_199'));
 assert.equal(data.reconciliationCoverage.retainedCaseIds,200);
 assert.equal(data.reconciliationCoverage.unavailableCaseRecords,1);
 assert.equal(data.reconciliationCoverage.isRetentionCapped,true);
 assert.ok(!data.reconciliation.some(x=>x.status==='resolved'));
});
test('Finance warns about missing reconciliation records and bounded retention',()=>{
 const ui=fs.readFileSync('dashboard.js','utf8');
 assert.match(ui,/coverage\.unavailableCaseRecords/);
 assert.match(ui,/coverage\.isRetentionCapped/);
 assert.match(ui,/older cases may be outside the visible history/);
});

test('resolving a paid checkout leaves the bounded Finance queue available for new exceptions',async()=>{
 const f=fixture();
 for(let i=0;i<200;i++)await recordCheckoutReconciliation(f.kv,{sessionId:'cs_'+i,eventId:'evt_'+i,reason:'email_mismatch'});
 assert.equal(f.index.length,200);
 const older='cs_0';
 assert.equal(await resolveCheckoutReconciliation(f.kv,older),true);
 assert.equal(f.index.length,199);
 assert.ok(!f.index.includes(older));
 assert.equal(f.values.get('stripe:reconciliation:'+older).status,'resolved');
 await recordCheckoutReconciliation(f.kv,{sessionId:'cs_new',eventId:'evt_new',reason:'email_mismatch'});
 assert.equal(f.index.length,200);
 assert.ok(f.index.includes('cs_new'));
 assert.ok(f.index.includes('cs_1'));
 assert.match(RESOLVE_RECONCILIATION,/redis\.call\('LREM',KEYS\[2\],0,ARGV\[1\]\)/);
 assert.ok(RESOLVE_RECONCILIATION.indexOf("redis.call('TYPE',KEYS[2])")<RESOLVE_RECONCILIATION.indexOf("redis.call('SET',KEYS[1]"));
});
