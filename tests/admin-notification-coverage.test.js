const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('api/account.js','utf8');
const begin=source.indexOf('async function buildAdminNotifications(');
const end=source.indexOf('\nasync function followups(',begin);
assert.ok(begin>=0&&end>begin,'admin notification builder exists');
const builder=source.slice(begin,end);

test('admin notification builder discloses bounded support feedback and Growth scans',async()=>{
  const support=Array.from({length:101},(_,i)=>'support-'+i),
    feedback=Array.from({length:101},(_,i)=>'feedback-'+i),
    prospects=Array.from({length:101},(_,i)=>'prospect-'+i);
  const ctx=vm.createContext({
    kv:{
      async get(key){
        if(key==='platform:settings')return {};
        if(key==='support:index')return support;
        if(key==='workspace:index')return [];
        if(key==='ai-feedback:index')return feedback;
        return null;
      },
      async lrange(key,start,end){
        assert.equal(key,'site:prospect:index');assert.equal(start,0);assert.equal(end,100);
        return prospects;
      }
    },
    getGmailConnection:async()=>null,
    entitlementsFor:()=>({minutes:0}),
    notificationItem:(id,body)=>({id,...body}),
    safeError:()=>'',console:{error(){}},
    crypto:require('crypto'),Date,Number,String,Array,Math,Promise
  });
  vm.runInContext(builder,ctx);
  const result=await vm.runInContext('buildAdminNotifications({email:"admin@example.test"})',ctx);
  assert.ok(result&&Array.isArray(result.items));
  assert.equal(result.items.length,0);
  assert.equal(result.coverage.limited,true);
  assert.deepEqual(Array.from(result.coverage.sources),['support','ai_feedback','growth']);
});

test('admin notification builder reports complete coverage below scan boundaries',async()=>{
  const ctx=vm.createContext({
    kv:{
      async get(key){
        if(key==='platform:settings')return {};
        if(key==='support:index'||key==='workspace:index'||key==='ai-feedback:index')return [];
        return null;
      },
      async lrange(){return []}
    },
    getGmailConnection:async()=>null,
    entitlementsFor:()=>({minutes:0}),
    notificationItem:(id,body)=>({id,...body}),
    safeError:()=>'',console:{error(){}},
    crypto:require('crypto'),Date,Number,String,Array,Math,Promise
  });
  vm.runInContext(builder,ctx);
  const result=await vm.runInContext('buildAdminNotifications({email:"admin@example.test"})',ctx);
  assert.equal(result.coverage.limited,false);
  assert.deepEqual(Array.from(result.coverage.sources),[]);
});


test('admin notification builder marks malformed source indexes as incomplete instead of silently hiding alerts',async()=>{
  const ctx=vm.createContext({
    kv:{
      async get(key){
        if(key==='platform:settings')return {};
        if(key==='support:index')return {broken:true};
        if(key==='workspace:index')return {broken:true};
        if(key==='ai-feedback:index')return {broken:true};
        return null;
      },
      async lrange(){return null}
    },
    getGmailConnection:async()=>null,
    entitlementsFor:()=>({minutes:0}),
    notificationItem:(id,body)=>({id,...body}),
    safeError:()=>'',console:{error(){}},
    crypto:require('crypto'),Date,Number,String,Array,Math,Promise
  });
  vm.runInContext(builder,ctx);
  const result=await vm.runInContext('buildAdminNotifications({email:"admin@example.test"})',ctx);
  assert.equal(result.coverage.limited,true);
  assert.deepEqual(Array.from(result.coverage.sources),[
    'support_unavailable','ai_feedback_unavailable','growth_unavailable','clients_unavailable'
  ]);
});
