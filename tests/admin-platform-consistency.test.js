const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8'),dashboard=fs.readFileSync('dashboard.js','utf8');

function fixture({expectedUpdatedAt=10,now=20,write=true,stored={brandName:'CallerCore',updatedAt:10,launchGates:{voiceLifecycle:false}},launchGates={voiceLifecycle:true}}={}){
  let writes=0,transaction,status=200,result;
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test',workspaceId:'admin-ws'}),
    cleanEmail:x=>String(x||'').trim().toLowerCase(),
    launchGateState:x=>({voiceLifecycle:!!x?.voiceLifecycle}),
    LAUNCH_GATE_DEFS:[{key:'voiceLifecycle'}],
    clampInt:(val,min,max,fallback)=>Math.max(min,Math.min(max,Number(val)||fallback)),
    crypto:{randomUUID:()=> 'audit-1'},Date:{now:()=>now},Number,String,Math,
    kv:{get:async key=>{assert.equal(key,'platform:settings');return stored},set:()=>assert.fail('Platform settings must be audited atomically')},
    compareAndAudit:async(kv,change,key,event)=>{writes++;transaction={change,key,event};if(write==='error')throw Error('connection lost');return write},
    safeError:()=> 'storage unavailable',console:{error(){}},req:{body:{brandName:'CallerCore Pro',expectedUpdatedAt,launchGates}},res:{status(n){status=n;return this},json(x){result=x;return x}}
  });
  const start=source.indexOf('async function adminPlatformSettingsSave('),end=source.indexOf('\nasync function validatedGmailFrom(',start);
  assert.ok(start>=0&&end>start);
  vm.runInContext(source.slice(start,end),context);
  return {run:async()=>{await vm.runInContext('adminPlatformSettingsSave(req,res)',context);return {writes,transaction,status,result}}};
}

test('platform settings and launch gates share one revision-checked audited write',async()=>{
  const f=await fixture().run();
  assert.equal(f.status,200);assert.equal(f.writes,1);
  assert.equal(f.transaction.key,'audit:admin-ws');
  assert.equal(f.transaction.change.key,'platform:settings');
  assert.equal(f.transaction.change.before.updatedAt,10);
  assert.equal(f.transaction.change.after.updatedAt,20);
  assert.equal(f.transaction.event.action,'platform_settings_update');
  assert.equal(f.transaction.event.meta.changedGates.length,1);
  assert.equal(f.transaction.event.meta.changedGates[0].key,'voiceLifecycle');
  assert.equal(f.transaction.event.after.launchGates.voiceLifecycle,true);
});

test('stale platform form and simultaneous admin writes cannot overwrite launch gates',async()=>{
  const stale=await fixture({expectedUpdatedAt:9}).run();
  assert.equal(stale.status,409);assert.equal(stale.writes,0);
  const conflict=await fixture({write:false}).run();
  assert.equal(conflict.status,409);assert.equal(conflict.writes,1);
  const failure=await fixture({write:'error'}).run();
  assert.equal(failure.status,503);
  assert.match(failure.result.error,/settings and audit history/);
});

test('platform revision advances for two writes in the same millisecond',async()=>{
  const result=await fixture({now:10}).run();
  assert.equal(result.status,200);
  assert.equal(result.transaction.change.after.updatedAt,11);
  assert.equal(result.result.settings.updatedAt,11);
});

test('client sends the revision that admin platform settings initially rendered',()=>{
  const start=dashboard.indexOf('async function savePlatformSettings('),end=dashboard.indexOf("\ndocument.getElementById('savePlatformSettings')",start);
  assert.ok(start>=0&&end>start);
  const fn=dashboard.slice(start,end);
  assert.match(fn,/expectedUpdatedAt:Number\(adminPlatformData\?\.updatedAt\|\|0\)/);
  assert.match(fn,/Platform settings saved, but some dashboard data could not refresh/);
});
