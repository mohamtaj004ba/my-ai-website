const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('api/account.js','utf8');
const code=source.slice(source.indexOf('function sanitizeAdminOverride('),source.indexOf('async function adminSendOnboardingInvite('));

async function run(functionName,body,{transaction=true}={}){
  const currentAgent={name:'Current',transferNumber:'5095550100',updatedAt:20};
  const oldAgent={name:'Prior',transferNumber:'5095550199',updatedAt:10};
  const records={
    'workspace:tenant':{id:'tenant',name:'Workspace',ownerEmail:'owner@example.com',phone:'5095550101',plan:'Growth',status:'active'},
    'agent:tenant':currentAgent,
    'phone:index':[{id:'p',workspaceId:'tenant',transferNumber:'5095550100',updatedAt:20}],
    'routing-request:tenant':{transferNumber:'5095550100',updatedAt:20},
    'audit:tenant':[{id:'audit-1',section:'agent',before:oldAgent}]
  };
  let status=200,result,updates,audits=0;
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.com'}),cleanEmail:x=>String(x||'').toLowerCase(),
    configKey:(section,id)=>({workspace:'workspace:',settings:'settings:',agent:'agent:',automations:'automations:',integrations:'integrations:',locations:'locations:'}[section]||'')+id,
    kv:{get:async key=>records[key],set:()=>assert.fail('Configuration writers must use the atomic transaction')},
    compareAndSetConfig:async(_,next)=>{updates=next;return transaction},appendAudit:async()=>audits++,safeError:()=>'',console:{error:()=>{}},
    req:{body},res:{status(n){status=n;return this},json(x){result=x}}
  });
  vm.runInContext(code,context);await vm.runInContext(`${functionName}(req,res)`,context);
  return {status,result,updates,audits};
}

test('admin agent override stages configuration and both routing derivatives atomically',async()=>{
  const r=await run('adminOverrideConfig',{id:'tenant',section:'agent',value:{name:'Updated',transferNumber:'5095550199'}});
  assert.equal(r.status,200);assert.deepEqual(Array.from(r.updates,x=>x.key),['agent:tenant','phone:index','routing-request:tenant']);
  assert.equal(r.updates[1].after[0].transferNumber,'5095550199');assert.equal(r.updates[2].after.transferNumber,'5095550199');assert.equal(r.audits,1);
});

test('admin restore sanitizes the snapshot and stages derived routing in the same transaction',async()=>{
  const r=await run('adminRestoreAudit',{id:'tenant',auditId:'audit-1'});
  assert.equal(r.status,200);assert.equal(r.result.value.name,'Prior');assert.ok(r.result.value.updatedAt>10);
  assert.deepEqual(Array.from(r.updates,x=>x.key),['agent:tenant','phone:index','routing-request:tenant']);assert.equal(r.audits,1);
});

test('admin override and restore fail closed on a concurrent configuration change',async()=>{
  for(const [name,body] of [['adminOverrideConfig',{id:'tenant',section:'agent',value:{transferNumber:'5095550199'}}],['adminRestoreAudit',{id:'tenant',auditId:'audit-1'}]]){
    const r=await run(name,body,{transaction:false});assert.equal(r.status,409);assert.equal(r.audits,0);
  }
});

test('admin agent overrides still reject invalid transfer destinations before writing',async()=>{
  const r=await run('adminOverrideConfig',{id:'tenant',section:'agent',value:{transferNumber:'bad'}});assert.equal(r.status,400);assert.equal(r.updates,undefined);
});
