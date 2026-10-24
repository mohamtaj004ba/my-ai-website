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
        if(key.startsWith('support:'))return {id:key.slice('support:'.length),workspaceId:'workspace-1',status:'resolved',subject:'Resolved ticket',createdAt:1,updatedAt:2};
        if(key.startsWith('ai-feedback:'))return {id:key.slice('ai-feedback:'.length),workspaceId:'workspace-1',source:'receptionist',status:'reviewed',message:'Reviewed feedback',createdAt:1,updatedAt:2};
        if(key.startsWith('site:prospect:'))return {id:key.slice('site:prospect:'.length),privacyState:'deidentified',stage:'converted',createdAt:1,updatedAt:2};
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
      async lrange(){return {broken:true}}
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


test('absent notification indexes are treated as empty rather than unavailable',async()=>{
  const ctx=vm.createContext({
    kv:{async get(key){return key==='platform:settings'?{}:null},async lrange(){return []}},
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

test('missing or malformed indexed notification records mark their source unavailable',()=>{
  assert.match(builder,/feedbackRecordUnavailable=true/);
  assert.match(builder,/supportRecordUnavailable=true/);
  assert.match(builder,/workspaceRecordUnavailable=true/);
  assert.match(builder,/growthRecordUnavailable=true/);
  assert.match(builder,/onboardingRecordUnavailable=true/);
  assert.match(builder,/gmailSummaryUnavailable=true/);
  assert.match(builder,/gmail_unavailable/);
});


test('connected Gmail with missing or malformed summary is disclosed as unavailable rather than zero unread',async()=>{
  for(const summary of [null,{analytics:'broken',syncedAt:1},{analytics:{unread:'NaN'},syncedAt:1},{analytics:{unread:2},syncedAt:0}]){
    const ctx=vm.createContext({
      kv:{
        async get(key){
          if(key==='platform:settings')return {};
          if(key==='support:index'||key==='workspace:index'||key==='ai-feedback:index')return [];
          if(key.startsWith('gmail:summary:'))return summary;
          return null;
        },
        async lrange(){return []}
      },
      getGmailConnection:async()=>({gmailEmail:'admin@example.test'}),
      entitlementsFor:()=>({minutes:0}),
      notificationItem:(id,body)=>({id,...body}),
      safeError:()=>'',console:{error(){}},
      crypto:require('crypto'),Date,Number,String,Array,Math,Promise
    });
    vm.runInContext(builder,ctx);
    const result=await vm.runInContext('buildAdminNotifications({email:"admin@example.test"})',ctx);
    assert.equal(result.items.some(item=>item.id==='gmail:unread'),false);
    assert.equal(result.coverage.limited,true);
    assert.ok(Array.from(result.coverage.sources).includes('gmail_unavailable'));
  }
});

test('verified Gmail summary can emit unread notification without incomplete coverage',async()=>{
  const ctx=vm.createContext({
    kv:{
      async get(key){
        if(key==='platform:settings')return {};
        if(key==='support:index'||key==='workspace:index'||key==='ai-feedback:index')return [];
        if(key.startsWith('gmail:summary:'))return {analytics:{unread:2},syncedAt:123};
        return null;
      },
      async lrange(){return []}
    },
    getGmailConnection:async()=>({gmailEmail:'admin@example.test'}),
    entitlementsFor:()=>({minutes:0}),
    notificationItem:(id,body)=>({id,...body}),
    safeError:()=>'',console:{error(){}},
    crypto:require('crypto'),Date,Number,String,Array,Math,Promise
  });
  vm.runInContext(builder,ctx);
  const result=await vm.runInContext('buildAdminNotifications({email:"admin@example.test"})',ctx);
  assert.equal(result.items.find(item=>item.id==='gmail:unread').meta.count,2);
  assert.equal(result.coverage.sources.includes('gmail_unavailable'),false);
});
