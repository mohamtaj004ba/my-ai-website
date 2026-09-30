const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const account=fs.readFileSync('api/account.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
function section(text,begin,end){
  const a=text.indexOf(begin),b=text.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,'source boundary: '+begin);return text.slice(a,b);
}
const backend=section(account,'function validProvisioningHistory(raw){','\nasync function adminPhoneNumbers(req,res){');
const client=section(ui,'function setProvisioningStageControls(id,pending){','\nlet phoneVisibleLimit=50,');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
function fixture({override=null,history=null,workspace={id:'client-1'},expectedUpdatedAt,stage='Review',conflict=false,fail=false,deny=false,eligible=true}={}){
  const db=new Map([['workspace:client-1',copy(workspace)]]);
  if(override!=null)db.set('provisioning:override:client-1',copy(override));
  if(history!=null)db.set('provisioning:history:client-1',copy(history));
  const calls=[];let code=0,payload=null;
  const read=async key=>copy(db.get(key)??null);
  const compare=async(_kv,updates,opts)=>{
    calls.push({updates:copy(updates),opts:copy(opts)});
    if(fail)throw Error('KV uncertain');
    if(conflict)return false;
    if(updates.some(u=>JSON.stringify(db.get(u.key)??null)!==JSON.stringify(u.before??null)))return false;
    for(const item of updates)if(opts?.deleteKeys?.includes(item.key))db.delete(item.key);else db.set(item.key,copy(item.after));
    return true;
  };
  const ctx=vm.createContext({
    kv:{get:read,set(){throw Error('Non-atomic set forbidden')},del(){throw Error('Non-atomic delete forbidden')}},
    requireAdmin:async()=>deny?null:{email:'admin@example.test'},
    compareAndSetConfig:compare,compareAndSetWithDelete:compare,
    ONBOARDING_STAGES:['Paid','Review','Ready','Live'],canManuallyMarkLive:()=>eligible,
    safeError:()=> 'unavailable',console:{error(){}},Number,Date,Set,Array,String,Promise,
    req:{body:{id:'client-1',stage,...(expectedUpdatedAt!==undefined?{expectedUpdatedAt}:{expectedUpdatedAt:Number(override?.updatedAt||0)})}},
    res:{status(n){code=n;return this},json(v){payload=v;return v}}
  });
  vm.runInContext(backend,ctx);
  return {ctx,db,calls,run:async(fn,body)=>{
    if(body)ctx.req.body=body;
    await vm.runInContext(fn+'(req,res)',ctx);return {code,payload};
  }};
}
test('manual stage writes override and bounded history together',async()=>{
  const f=fixture({history:[{stage:'Paid',at:1,by:'admin'}]});
  const r=await f.run('adminSaveProvisioningStage');
  assert.equal(r.code,200);assert.equal(r.payload.stage,'Review');
  assert.equal(f.db.get('provisioning:override:client-1').stage,'Review');
  assert.equal(f.db.get('provisioning:history:client-1').length,2);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].updates.length,2);
});
test('revision stale or omitted refuses stage mutation before any write',async()=>{
  for(const wrong of [5,undefined]){
    const f=fixture({override:{stage:'Paid',updatedAt:50,updatedBy:'prior'}});
    const b={id:'client-1',stage:'Review'};
    if(wrong!==undefined)b.expectedUpdatedAt=wrong;
    const r=await f.run('adminSaveProvisioningStage',b);
    assert.equal(r.code,409);assert.equal(f.calls.length,0);
    assert.equal(f.db.get('provisioning:override:client-1').stage,'Paid');
  }
});
test('concurrent stage save conflict and uncertain KV state never return success',async()=>{
  for(const opts of [{conflict:true},{fail:true}]){
    const f=fixture(opts),r=await f.run('adminSaveProvisioningStage');
    assert.equal(r.code,opts.fail?503:409);
    assert.equal(f.db.has('provisioning:override:client-1'),false);
    assert.equal(f.db.has('provisioning:history:client-1'),false);
  }
});
test('malformed stage or history refuses writes rather than silently resetting',async()=>{
  for(const opts of [
    {override:{stage:'Nonsense',updatedAt:5},expectedUpdatedAt:5},
    {history:{bad:true}},
    {history:Array.from({length:51},()=>({stage:'Paid',at:1,by:'admin'}))}
  ]){
    const f=fixture(opts),r=await f.run('adminSaveProvisioningStage');
    assert.equal(r.code,503);assert.equal(f.calls.length,0);
  }
});
test('Live manual label remains blocked without verified launch checklist',async()=>{
  const f=fixture({stage:'Live',eligible:false}),r=await f.run('adminSaveProvisioningStage');
  assert.equal(r.code,409);assert.match(r.payload.error,/verified launch checklist/);
  assert.equal(f.calls.length,0);
});
test('same manual stage is idempotent and does not append history',async()=>{
  const f=fixture({override:{stage:'Review',updatedAt:50},history:[{stage:'Review',at:50,by:'admin'}]}),r=await f.run('adminSaveProvisioningStage');
  assert.equal(r.code,200);assert.equal(r.payload.unchanged,true);assert.equal(f.calls.length,0);
});
test('clearing manual stage atomically deletes override and records automatic restoration',async()=>{
  const f=fixture({override:{stage:'Review',updatedAt:50},history:[{stage:'Review',at:50,by:'admin'}]});
  const r=await f.run('adminClearProvisioningStage');
  assert.equal(r.code,200);assert.equal(f.db.has('provisioning:override:client-1'),false);
  assert.equal(f.db.get('provisioning:history:client-1')[0].stage,'Automatic');
  assert.deepEqual(f.calls[0].opts.deleteKeys,['provisioning:override:client-1']);
});
test('clear prevents stale or concurrent loss of a newer manual override',async()=>{
  for(const opt of ['stale','conflict','fail']){
    const f=fixture({override:{stage:'Review',updatedAt:50},conflict:opt==='conflict',fail:opt==='fail'});
    const b={id:'client-1',expectedUpdatedAt:opt==='stale'?49:50};
    const r=await f.run('adminClearProvisioningStage',b);
    assert.equal(r.code,opt==='fail'?503:409);
    assert.equal(f.db.get('provisioning:override:client-1').stage,'Review');
  }
});
test('clearing an already automatic stage is harmless and no history is appended',async()=>{
  const f=fixture(),r=await f.run('adminClearProvisioningStage',{id:'client-1',expectedUpdatedAt:0});
  assert.equal(r.code,200);assert.equal(r.payload.unchanged,true);assert.equal(f.calls.length,0);
});
test('non-admin requests never read or mutate stage history',async()=>{
  const f=fixture({deny:true}),r=await f.run('adminSaveProvisioningStage');
  assert.equal(r.code,0);assert.equal(f.calls.length,0);
});
function uiFixture({reply,loadFail=false,initial={id:'client-1',stage:'Paid',autoStage:'Paid',manualOverride:false,stageUpdatedAt:null}}={}){
  const item={...initial},calls=[],alerts=[],refreshes=[],controls=[
    {dataset:{provisionStageSelect:'client-1'},disabled:false,setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}},
    {dataset:{autoStage:'client-1'},disabled:false,setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}}
  ];
  let complete;const request=reply||(()=>Promise.resolve({ok:true,json:async()=>({ok:true,stage:'Review',updatedAt:22})}));
  const ctx=vm.createContext({
    adminProvisioningData:[item],adminProvisioningStagePending:new Set(),
    document:{querySelectorAll:()=>controls},
    fetch:async(_url,options)=>{calls.push(JSON.parse(options.body));return request()},
    refreshAdminView:async()=>{refreshes.push(1);if(loadFail)throw Error('refresh failed')},
    renderProvisioning(){},alert:x=>alerts.push(x),Date,Number,JSON,String,Error
  });
  vm.runInContext(client,ctx);
  return {item,calls,alerts,controls,ctx,refreshes,run:x=>vm.runInContext(x,ctx)};
}
test('manual stage save sends displayed revision and applies server response',async()=>{
  const f=uiFixture();
  assert.equal(await f.run("moveProvisioningStage('client-1','Review')"),true);
  assert.equal(f.calls[0].expectedUpdatedAt,0);
  assert.equal(f.item.stage,'Review');assert.equal(f.item.manualOverride,true);assert.equal(f.item.stageUpdatedAt,22);
  assert.equal(f.ctx.adminProvisioningStagePending.size,0);
  assert.equal(f.controls.every(c=>c.disabled===false),true);
});
test('failed manual move never leaves false optimistic stage or revision behind',async()=>{
  const f=uiFixture({reply:()=>Promise.resolve({ok:false,json:async()=>({error:'Stale stage'})})});
  assert.equal(await f.run("moveProvisioningStage('client-1','Review')"),false);
  assert.equal(f.item.stage,'Paid');assert.equal(f.item.manualOverride,false);assert.equal(f.item.stageUpdatedAt,null);
  assert.deepEqual(f.alerts,['Stale stage']);
});
test('one pending manual stage request blocks a second action on same account',async()=>{
  let release;const f=uiFixture({reply:()=>new Promise(done=>release=done)});
  const pending=f.run("moveProvisioningStage('client-1','Review')");
  assert.equal(f.controls.every(c=>c.disabled),true);
  assert.equal(await f.run("moveProvisioningStage('client-1','Live')"),false);
  assert.equal(await f.run("clearProvisioningOverride('client-1')"),false);
  assert.equal(f.calls.length,1);
  release({ok:true,json:async()=>({ok:true,stage:'Review',updatedAt:24})});
  await pending;assert.equal(f.controls.every(c=>!c.disabled),true);
});
test('restoration sends revision, updates local stage and stays saved on refresh failure',async()=>{
  const f=uiFixture({loadFail:true,initial:{id:'client-1',stage:'Review',autoStage:'Paid',manualOverride:true,stageUpdatedAt:66},reply:()=>Promise.resolve({ok:true,json:async()=>({ok:true,clearedAt:70})})});
  assert.equal(await f.run("clearProvisioningOverride('client-1')"),true);
  assert.equal(f.calls[0].expectedUpdatedAt,66);
  assert.equal(f.item.stage,'Paid');assert.equal(f.item.manualOverride,false);assert.equal(f.item.stageUpdatedAt,null);
  assert.match(f.alerts[0],/restored, but onboarding could not refresh/);
});
test('failed restoration preserves manual label and permits retry',async()=>{
  const f=uiFixture({initial:{id:'client-1',stage:'Review',autoStage:'Paid',manualOverride:true,stageUpdatedAt:66},reply:()=>Promise.resolve({ok:false,json:async()=>({error:'Conflicting stage'})})});
  assert.equal(await f.run("clearProvisioningOverride('client-1')"),false);
  assert.equal(f.item.stage,'Review');assert.equal(f.item.manualOverride,true);assert.equal(f.item.stageUpdatedAt,66);
  assert.equal(f.ctx.adminProvisioningStagePending.size,0);
});

test('provisioning stage history limit is explicit instead of silently dropping the oldest entry',()=>{
  const save=account.slice(account.indexOf('async function adminSaveProvisioningStage('),account.indexOf('\nasync function adminClearProvisioningStage(',account.indexOf('async function adminSaveProvisioningStage(')));
  const clear=account.slice(account.indexOf('async function adminClearProvisioningStage('),account.indexOf('\nasync function adminPhoneNumbers(',account.indexOf('async function adminClearProvisioningStage(')));
  assert.match(save,/history\.length>=50/);assert.match(save,/50-entry safety limit/);assert.doesNotMatch(save,/nextHistory=\[[^\n]+\]\.slice\(0,50\)/);
  assert.match(clear,/history\.length>=50/);assert.match(clear,/50-entry safety limit/);
});
