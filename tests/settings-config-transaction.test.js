const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('api/account.js','utf8');
const handler=source.slice(source.indexOf('async function saveSettings('),source.indexOf('async function aiAnsweringControl('));
async function run({revision=10,transaction=true,missing=false,omitRevision=false}={}){
  const previous={businessName:'Original',updatedAt:10,aiAnsweringPaused:true},workspace={name:'Original',plan:'Growth',ownerName:'Owner'};
  let status=200,result,updates,auditCommitted=null;
  const ctx=vm.createContext({requireWritableSession:async()=>({workspaceId:'tenant',email:'qa@test.invalid'}),requireOperationalWorkspace:async()=>true,process:{env:{}},crypto:{randomUUID:()=> 'settings-audit'},Date,kv:{get:async key=>key.startsWith('settings:')?previous:missing?null:workspace,set:()=>assert.fail('Use atomic writes')},compareAndAuditBatch:async(_,u,auditKey,event)=>{updates=u;if(transaction==='error')throw Error('network');if(transaction)auditCommitted={auditKey,event};return transaction},appendAudit:async()=>assert.fail('Settings audit must be part of the atomic transaction'),req:{body:{businessName:'Updated',...(omitRevision?{}:{expectedUpdatedAt:revision})}},res:{status(n){status=n;return this},json(x){result=x}}});
  vm.runInContext(handler,ctx);await vm.runInContext('saveSettings(req,res)',ctx);return {status,result,updates,auditCommitted};
}
test('settings and shared workspace name are staged together without losing plan or owner',async()=>{
  const r=await run();assert.equal(r.status,200);assert.equal(r.updates.length,2);assert.equal(r.updates[0].after.businessName,'Updated');assert.equal(r.updates[1].after.name,'Updated');assert.equal(r.updates[1].after.plan,'Growth');assert.equal(r.updates[1].after.ownerName,'Owner');assert.equal(r.result.settings.aiAnsweringPaused,true);assert.equal(r.auditCommitted.auditKey,'audit:tenant');assert.equal(r.auditCommitted.event.action,'settings_save');
});
test('settings revision conflicts and missing workspaces do not start a write',async()=>{
  for(const options of [{revision:9},{missing:true}]){const r=await run(options);assert.equal(r.status,options.missing?404:409);assert.equal(r.updates,undefined);assert.equal(r.auditCommitted,null)}
});
test('concurrent settings changes and ambiguous storage failures never report success',async()=>{
  for(const transaction of [false,'error']){const r=await run({transaction});assert.equal(r.status,transaction===false?409:503);assert.equal(r.auditCommitted,null)}
});
test('both settings read paths expose the revision used by the save contract',async()=>{
  const saved={businessName:'Saved',updatedAt:123};let result;
  const ctx=vm.createContext({requireSession:async()=>({workspaceId:'tenant'}),kv:{get:async key=>key.startsWith('settings:')?saved:{}},process:{env:{}},req:{},res:{status(){return this},json(x){result=x}}});
  vm.runInContext(source.slice(source.indexOf('async function settings('),source.indexOf('async function saveSettings(')),ctx);
  await vm.runInContext('settings(req,res)',ctx);assert.equal(result.settings.updatedAt,123);
  const bundleStart=source.indexOf('const settings={',source.indexOf('const savedAgent=agentRaw'));
  const bundle=source.slice(bundleStart,source.indexOf('  const agent=',bundleStart));
  const bundleContext=vm.createContext({savedSettings:saved,ws:{},s:{},platform:{},smsLive:false});
  vm.runInContext(bundle,bundleContext);assert.equal(vm.runInContext('settings.updatedAt',bundleContext),123);
});

test('settings save rejects malformed saved settings and workspace records before atomic writes',async()=>{
  const block=source.slice(source.indexOf('async function saveSettings('),source.indexOf('async function aiAnsweringControl('));
  assert.match(block,/Business settings are unavailable\. No changes were made/);
  assert.match(block,/Workspace record is unavailable\. Settings were not changed/);
});


test('missing settings revision is rejected before any write',async()=>{
  const r=await run({omitRevision:true});assert.equal(r.status,409);assert.equal(r.updates,undefined);assert.equal(r.auditCommitted,null);
});
