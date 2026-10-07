const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const code=source.slice(source.indexOf('function sanitizeAdminOverride('),source.indexOf('async function adminSendOnboardingInvite('));

test('configuration recovery round trip preserves other tenants and rejects stale restoration',async()=>{
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const original={name:'Original',transferNumber:'5095550100',updatedAt:10};
  const records={
    'workspace:rehearsal':{id:'rehearsal',name:'Rehearsal',stripeCustomerId:'unchanged',status:'active'},
    'agent:rehearsal':clone(original),
    'phone:index':[{id:'p1',workspaceId:'rehearsal',transferNumber:original.transferNumber},{id:'p2',workspaceId:'other',transferNumber:'5095550111'}],
    'routing-request:rehearsal':{transferNumber:original.transferNumber},
    'agent:other':{name:'Other tenant'},'audit:rehearsal':[]
  };
  const protectedWorkspace=clone(records['workspace:rehearsal']);
  const protectedAgent=clone(records['agent:other']);
  const protectedPhone=clone(records['phone:index'][1]);
  let sequence=0;
  const context=vm.createContext({
    requireAdmin:async()=>({email:'operator@example.com'}),cleanEmail:x=>String(x||'').toLowerCase(),
    configKey:(section,id)=>({workspace:'workspace:',settings:'settings:',agent:'agent:',automations:'automations:',integrations:'integrations:',locations:'locations:'}[section]||'')+id,
    kv:{get:async key=>clone(records[key])},crypto:{randomUUID:()=>`rehearsal-${++sequence}`},Date,
    // Stateful transaction double: compare every record before committing any write.
    // Redis execution is covered separately by configuration transaction tests.
    compareAndAuditBatch:async(_,updates,auditKey,event)=>{
      if(updates.some(x=>JSON.stringify(records[x.key])!==JSON.stringify(x.before)))return false;
      for(const x of updates)records[x.key]=clone(x.after);
      records[auditKey]=[clone(event),...(records[auditKey]||[])];return true;
    },safeError:()=>'',console:{error:()=>{}}
  });
  vm.runInContext(code,context);
  async function invoke(name,body){
    let status=200,result;
    context.req={body};context.res={status(n){status=n;return this},json(value){result=clone(value)}};
    await vm.runInContext(`${name}(req,res)`,context);return {status,result};
  }
  const edited=await invoke('adminOverrideConfig',{id:'rehearsal',section:'agent',expectedBefore:original,value:{name:'Edited',transferNumber:'5095550199'}});
  assert.equal(edited.status,200);
  assert.equal(records['phone:index'][0].transferNumber,'5095550199');
  const snapshot=clone(records['agent:rehearsal']);
  const restored=await invoke('adminRestoreAudit',{id:'rehearsal',auditId:'rehearsal-1',expectedCurrent:snapshot});
  assert.equal(restored.status,200);
  assert.equal(records['agent:rehearsal'].name,original.name);
  assert.equal(records['phone:index'][0].transferNumber,original.transferNumber);
  assert.equal(records['routing-request:rehearsal'].transferNumber,original.transferNumber);
  assert.deepEqual(records['workspace:rehearsal'],protectedWorkspace);
  assert.deepEqual(records['agent:other'],protectedAgent);
  assert.deepEqual(records['phone:index'][1],protectedPhone);
  assert.deepEqual(records['audit:rehearsal'].map(x=>x.action),['restore_snapshot','admin_override']);
  const beforeRetry=clone(records);
  const stale=await invoke('adminRestoreAudit',{id:'rehearsal',auditId:'rehearsal-1',expectedCurrent:snapshot});
  assert.equal(stale.status,409);assert.deepEqual(records,beforeRetry);
});
