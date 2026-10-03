const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8');
const overrideStart=api.indexOf('async function adminOverrideConfig(');
const restoreStart=api.indexOf('async function adminRestoreAudit(',overrideStart);
const restoreEnd=api.indexOf('\n\n\nasync function adminSendOnboardingInvite(',restoreStart);
assert.ok(overrideStart>=0&&restoreStart>overrideStart&&restoreEnd>restoreStart);
const overrideSource=api.slice(overrideStart,restoreStart);
const restoreSource=api.slice(restoreStart,restoreEnd);

function response(){
  let code=0,data=null;
  return {res:{status(n){code=n;return this},json(x){data=x;return x}},read:()=>({code,data})};
}

function overrideFixture(expectedBefore,{stored={name:'Current',updatedAt:10}}={}){
  const r=response(),commits=[];
  const ctx=vm.createContext({
    req:{body:{id:'client-1',section:'settings',value:{name:'Edited'},expectedBefore}},
    res:r.res,
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>key==='workspace:client-1'?{id:'client-1',name:'Client'}:key==='settings:client-1'?stored:null},
    configKey:(section,id)=>section==='settings'?'settings:'+id:null,
    sanitizeAdminOverride:(_section,value)=>value,
    configTransactionUpdates:async(_id,_section,key,before,after)=>[{key,before,after}],
    compareAndAuditBatch:async(_kv,updates,auditKey,audit)=>{commits.push({updates,auditKey,audit});return true},
    crypto:{randomUUID:()=> 'audit-1'},safeError:()=>'',console:{error(){}},Date,JSON,Object,Array,String
  });
  vm.runInContext(overrideSource,ctx);
  return {run:async()=>{await vm.runInContext('adminOverrideConfig(req,res)',ctx);return r.read()},commits};
}

test('admin override rejects missing or stale displayed snapshot before any write',async()=>{
  for(const expected of [undefined,{name:'Older',updatedAt:9}]){
    const f=overrideFixture(expected);
    if(expected===undefined)delete f.run; // replaced below to explicitly remove property
  }
  const missing=response(),commits=[];
  const ctx=vm.createContext({
    req:{body:{id:'client-1',section:'settings',value:{name:'Edited'}}},res:missing.res,
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>key==='workspace:client-1'?{id:'client-1'}:{name:'Current',updatedAt:10}},
    configKey:(section,id)=>'settings:'+id,sanitizeAdminOverride:(_s,v)=>v,configTransactionUpdates:async()=>[],
    compareAndAuditBatch:async()=>{commits.push(true);return true},crypto:{randomUUID:()=> 'audit'},safeError:()=>'',console:{error(){}},Date,JSON,Object,Array,String
  });
  vm.runInContext(overrideSource,ctx);await vm.runInContext('adminOverrideConfig(req,res)',ctx);
  assert.equal(missing.read().code,409);assert.equal(commits.length,0);
  const stale=overrideFixture({name:'Older',updatedAt:9}),out=await stale.run();
  assert.equal(out.code,409);assert.match(out.data.error,/changed after the editor was opened/i);assert.equal(stale.commits.length,0);
});

test('admin override accepts an exact displayed snapshot and reaches audited transaction',async()=>{
  const expected={name:'Current',updatedAt:10},f=overrideFixture(expected),out=await f.run();
  assert.equal(out.code,200);assert.equal(out.data.ok,true);assert.equal(f.commits.length,1);
  assert.equal(f.commits[0].audit.action,'admin_override');
});

function restoreFixture(expectedCurrent,{current={name:'Current',updatedAt:20}}={}){
  const r=response(),commits=[],entry={id:'audit-old',section:'settings',before:{name:'Older',updatedAt:10}};
  const ctx=vm.createContext({
    req:{body:{id:'client-1',auditId:'audit-old',expectedCurrent}},res:r.res,
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>{
      if(key==='audit:client-1')return [entry];
      if(key==='settings:client-1')return current;
      if(key==='workspace:client-1')return {id:'client-1'};
      return null;
    }},
    configKey:(section,id)=>section==='settings'?'settings:'+id:null,
    sanitizeAdminOverride:(_section,value)=>value,
    configTransactionUpdates:async(_id,_section,key,before,after)=>[{key,before,after}],
    compareAndAuditBatch:async(_kv,updates,auditKey,audit)=>{commits.push({updates,auditKey,audit});return true},
    crypto:{randomUUID:()=> 'audit-restore'},safeError:()=>'',console:{error(){}},Date,JSON,Object,Array,String
  });
  vm.runInContext(restoreSource,ctx);
  return {run:async()=>{await vm.runInContext('adminRestoreAudit(req,res)',ctx);return r.read()},commits};
}

test('audit restore rejects stale history snapshot before applying an older configuration',async()=>{
  const f=restoreFixture({name:'Different',updatedAt:19}),out=await f.run();
  assert.equal(out.code,409);assert.match(out.data.error,/changed after the history view was loaded/i);assert.equal(f.commits.length,0);
});

test('audit restore accepts exact current snapshot and records rollback transaction',async()=>{
  const current={name:'Current',updatedAt:20},f=restoreFixture(current,{current}),out=await f.run();
  assert.equal(out.code,200);assert.equal(out.data.ok,true);assert.equal(f.commits.length,1);
  assert.equal(f.commits[0].audit.action,'restore_snapshot');
});
