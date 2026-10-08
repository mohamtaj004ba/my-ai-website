const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('api/account.js','utf8');
const code=source.slice(source.indexOf('function sanitizeAdminOverride('),source.indexOf('async function adminSendOnboardingInvite('));

async function run(functionName,body,{transaction=true}={}){
  const currentAgent={name:'Current',transferNumber:'5095550100',updatedAt:20};
  const oldAgent={name:'Prior',transferNumber:'5095550199',updatedAt:10};
  body={...body,...(functionName==='adminOverrideConfig'&&!Object.prototype.hasOwnProperty.call(body,'expectedBefore')?{expectedBefore:currentAgent}:{}),...(functionName==='adminRestoreAudit'&&!Object.prototype.hasOwnProperty.call(body,'expectedCurrent')?{expectedCurrent:currentAgent}:{})};
  const records={
    'workspace:tenant':{id:'tenant',name:'Workspace',ownerEmail:'owner@example.com',phone:'5095550101',plan:'Growth',status:'active'},
    'agent:tenant':currentAgent,
    'phone:index':[{id:'p',workspaceId:'tenant',transferNumber:'5095550100',updatedAt:20}],
    'routing-request:tenant':{transferNumber:'5095550100',updatedAt:20},
    'audit:tenant':[{id:'audit-1',section:'agent',before:oldAgent}]
  };
  let status=200,result,updates,auditCommitted=null,transactionCalls=0;
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.com'}),cleanEmail:x=>String(x||'').toLowerCase(),
    configKey:(section,id)=>({workspace:'workspace:',settings:'settings:',agent:'agent:',automations:'automations:',integrations:'integrations:',locations:'locations:'}[section]||'')+id,
    kv:{get:async key=>records[key],set:()=>assert.fail('Configuration writers must use the atomic transaction')},
    crypto:{randomUUID:()=> 'audit-new'},Date,
    compareAndAuditBatch:async(_,next,auditKey,event)=>{transactionCalls++;updates=next;if(transaction)auditCommitted={auditKey,event};return transaction},
    appendAudit:async()=>assert.fail('Configuration mutation audit must be part of the atomic transaction'),
    safeError:()=>'',console:{error:()=>{}},
    req:{body},res:{status(n){status=n;return this},json(x){result=x}}
  });
  vm.runInContext(code,context);await vm.runInContext(`${functionName}(req,res)`,context);
  return {status,result,updates,auditCommitted,transactionCalls};
}

test('admin agent override stages configuration and both routing derivatives atomically',async()=>{
  const r=await run('adminOverrideConfig',{id:'tenant',section:'agent',value:{name:'Updated',transferNumber:'5095550199'}});
  assert.equal(r.status,200);assert.deepEqual(Array.from(r.updates,x=>x.key),['agent:tenant','phone:index','routing-request:tenant']);
  assert.equal(r.updates[1].after[0].transferNumber,'5095550199');assert.equal(r.updates[2].after.transferNumber,'5095550199');
  assert.equal(r.auditCommitted.auditKey,'audit:tenant');assert.equal(r.auditCommitted.event.action,'admin_override');assert.equal(r.transactionCalls,1);
});

test('admin restore sanitizes the snapshot and stages derived routing in the same transaction',async()=>{
  const r=await run('adminRestoreAudit',{id:'tenant',auditId:'audit-1'});
  assert.equal(r.status,200);assert.equal(r.result.value.name,'Prior');assert.ok(r.result.value.updatedAt>10);
  assert.deepEqual(Array.from(r.updates,x=>x.key),['agent:tenant','phone:index','routing-request:tenant']);
  assert.equal(r.auditCommitted.auditKey,'audit:tenant');assert.equal(r.auditCommitted.event.action,'restore_snapshot');
  assert.equal(r.auditCommitted.event.meta.restoredFrom,'audit-1');assert.equal(r.transactionCalls,1);
});

test('admin override and restore fail closed on a concurrent configuration change',async()=>{
  for(const [name,body] of [['adminOverrideConfig',{id:'tenant',section:'agent',value:{transferNumber:'5095550199'}}],['adminRestoreAudit',{id:'tenant',auditId:'audit-1'}]]){
    const r=await run(name,body,{transaction:false});assert.equal(r.status,409);assert.equal(r.auditCommitted,null);assert.equal(r.transactionCalls,1);
  }
});

test('admin agent overrides still reject invalid transfer destinations before writing',async()=>{
  const r=await run('adminOverrideConfig',{id:'tenant',section:'agent',value:{transferNumber:'bad'}});assert.equal(r.status,400);assert.equal(r.updates,undefined);
});


test('admin config override and snapshot restore bind audit history to the same transaction',()=>{
  for(const name of ['adminOverrideConfig','adminRestoreAudit']){
    const start=source.indexOf('async function '+name+'('),end=source.indexOf('\nasync function ',start+1),body=source.slice(start,end);
    assert.match(body,/compareAndAuditBatch\(kv,updates,'audit:'\+id,audit\)/);
    assert.doesNotMatch(body,/appendAudit\(/);
  }
});
