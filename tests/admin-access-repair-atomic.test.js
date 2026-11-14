const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8');
const ui=fs.readFileSync('dashboard.js','utf8');
function segment(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'source segment exists: '+start);
  return source.slice(a,b);
}
const backend=[
  segment(api,'async function adminForceLogout(req,res){','\nasync function adminRepairAccess('),
  segment(api,'async function adminRepairAccess(req,res){','\nfunction sanitizeAdminOverride(')
].join('\n');
const frontend=[
  segment(ui,'function adminTechMessage(','\nfunction setAdminTechMutationState('),
  segment(ui,'function setAdminTechMutationState(','\nfunction setAdminClientMutationState('),
  segment(ui,'let adminLogoutConfirmState=null;','\nasync function repairClientAccess(){'),
  segment(ui,'async function repairClientAccess(){','\nasync function applyAdminConfigOverride(){')
].join('\n');

const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function response(){
  let code=0,data=null;
  return {res:{status(n){code=n;return this},json(x){data=x;return x}},read:()=>({code,data})};
}
function cleanEmail(x){return String(x||'').trim().toLowerCase()}

function forceFixture({member={workspaceId:'client-1',role:'owner',email:'owner@example.test',sessionVersion:4},workspace={id:'client-1',ownerEmail:'owner@example.test'},transaction=true,denied=false}={}){
  const r=response(),calls=[],reads=[];
  const ctx=vm.createContext({
    requireAdmin:async()=>denied?null:{email:'admin@example.test'},
    kv:{get:async key=>{
      reads.push(key);
      if(key==='workspace:client-1')return clone(workspace);
      if(key==='user:email:owner@example.test')return clone(member);
      return null;
    },set:()=>assert.fail('force logout must not write member outside audited transaction')},
    cleanEmail,compareAndAuditBatch:async(_kv,updates,auditKey,event)=>{
      calls.push({update:clone(updates[1]),updates:clone(updates),auditKey,event:clone(event)});
      if(transaction==='error')throw Error('storage uncertain');
      return transaction!==false;
    },
    crypto:{randomUUID:()=> 'audit-logout'},safeError:()=>'',console:{error(){}},Date,Number,
    req:{body:{id:'client-1',expectedOwnerEmail:'owner@example.test'}},res:r.res
  });
  vm.runInContext(backend,ctx);
  return {ctx,calls,reads,run:async()=>{await vm.runInContext('adminForceLogout(req,res)',ctx);return r.read()}};
}

test('force sign-out increments session revision and workspace audit atomically',async()=>{
  const f=forceFixture(),out=await f.run();
  assert.equal(out.code,200);assert.equal(out.data.sessionVersion,5);assert.equal(f.calls.length,1);
  const call=f.calls[0];
  assert.equal(call.auditKey,'audit:client-1');
  assert.equal(call.update.key,'user:email:owner@example.test');
  assert.equal(call.update.before.sessionVersion,4);assert.equal(call.update.after.sessionVersion,5);
  assert.equal(call.event.action,'force_logout');assert.deepEqual(call.event.before,{sessionVersion:4});assert.deepEqual(call.event.after,{sessionVersion:5});
  assert.equal(call.updates[0].key,'workspace:client-1');assert.deepEqual(call.updates[0].before,call.updates[0].after);
});

test('force sign-out rejects stale or absent displayed owner before reading the user mapping',async()=>{
  for(const expected of [undefined,'other@example.test']){
    const f=forceFixture();if(expected===undefined)delete f.ctx.req.body.expectedOwnerEmail;else f.ctx.req.body.expectedOwnerEmail=expected;
    const out=await f.run();assert.equal(out.code,409);assert.equal(f.calls.length,0);assert.deepEqual(f.reads,['workspace:client-1']);
  }
});

test('force sign-out conflicts and uncertain persistence fail without success',async()=>{
  const conflict=forceFixture({transaction:false}),a=await conflict.run();
  assert.equal(a.code,409);assert.equal(conflict.calls.length,1);
  const uncertain=forceFixture({transaction:'error'}),b=await uncertain.run();
  assert.equal(b.code,503);assert.match(b.data.error,/Could not confirm/);
});

test('force sign-out rejects broken mapping and unsafe session revisions before transaction',async()=>{
  for(const member of [
    {workspaceId:'other',sessionVersion:1},
    {workspaceId:'client-1',sessionVersion:-1},
    {workspaceId:'client-1',sessionVersion:Number.MAX_SAFE_INTEGER},
    {workspaceId:'client-1',sessionVersion:'not-a-number'}
  ]){
    const f=forceFixture({member}),out=await f.run();
    assert.ok([409,503].includes(out.code));assert.equal(f.calls.length,0);
  }
});

function repairFixture({
  workspace={id:'client-1',ownerEmail:'old@example.test',updatedAt:20},
  oldMember={workspaceId:'client-1',role:'owner',email:'old@example.test',sessionVersion:5},
  existing=null,newEmail='new@example.test',transaction=true,denied=false
}={}){
  const r=response(),calls=[],reads=[];
  const oldEmail=cleanEmail(workspace?.ownerEmail||''),values={'workspace:client-1':workspace};
  if(oldEmail)values['user:email:'+oldEmail]=oldMember;
  if(newEmail!==oldEmail)values['user:email:'+newEmail]=existing;
  else if(existing!==null)values['user:email:'+newEmail]=existing;
  const ctx=vm.createContext({
    requireAdmin:async()=>denied?null:{email:'admin@example.test'},
    kv:{get:async key=>{reads.push(key);return clone(values[key]??null)},set:()=>assert.fail('access repair must not use independent writes'),del:()=>assert.fail('access repair must not delete outside transaction')},
    cleanEmail,
    compareAndAuditBatch:async(_kv,updates,auditKey,event,options)=>{
      calls.push({updates:clone(updates),auditKey,event:clone(event),options:clone(options)});
      if(transaction==='error')throw Error('storage uncertain');
      return transaction!==false;
    },
    crypto:{randomUUID:()=> 'audit-repair'},safeError:()=>'',console:{error(){}},Date,Number,Promise,Array,String,Set,
    req:{body:{id:'client-1',email:newEmail,expectedOwnerEmail:oldEmail}},res:r.res
  });
  vm.runInContext(backend,ctx);
  return {ctx,calls,reads,run:async()=>{await vm.runInContext('adminRepairAccess(req,res)',ctx);return r.read()}};
}

test('access repair atomically moves owner mapping, workspace email and audit',async()=>{
  const f=repairFixture(),out=await f.run();
  assert.equal(out.code,200);assert.equal(out.data.email,'new@example.test');assert.equal(out.data.sessionVersion,6);
  assert.equal(f.calls.length,1);
  const call=f.calls[0],byKey=Object.fromEntries(call.updates.map(x=>[x.key,x]));
  assert.deepEqual(call.options.deleteKeys,['user:email:old@example.test']);
  assert.equal(byKey['workspace:client-1'].before.ownerEmail,'old@example.test');
  assert.equal(byKey['workspace:client-1'].after.ownerEmail,'new@example.test');
  assert.equal(byKey['user:email:new@example.test'].before,null);
  assert.equal(byKey['user:email:new@example.test'].after.sessionVersion,6);
  assert.equal(byKey['user:email:old@example.test'].after,null);
  assert.equal(call.auditKey,'audit:client-1');assert.equal(call.event.action,'access_repair');
  assert.equal(call.event.meta.oldEmail,'old@example.test');assert.equal(call.event.meta.newEmail,'new@example.test');
});

test('access repair rejects stale owner diagnostics before mapping reads',async()=>{
  const f=repairFixture({workspace:{id:'client-1',ownerEmail:'newer@example.test',updatedAt:30},oldMember:null});
  f.ctx.req.body.expectedOwnerEmail='old@example.test';
  const out=await f.run();
  assert.equal(out.code,409);assert.match(out.data.error,/owner changed after diagnostics/i);
  assert.equal(f.calls.length,0);
  assert.deepEqual(f.reads,['workspace:client-1']);
});

test('same-email access repair revokes sessions without deleting its own mapping',async()=>{
  const current={workspaceId:'client-1',role:'owner',email:'old@example.test',sessionVersion:8};
  const f=repairFixture({existing:current,newEmail:'old@example.test'}),out=await f.run();
  assert.equal(out.code,200);assert.equal(out.data.sessionVersion,9);
  const call=f.calls[0];
  assert.deepEqual(call.options.deleteKeys,[]);
  assert.deepEqual(call.updates.map(x=>x.key),['workspace:client-1','user:email:old@example.test']);
  assert.equal(call.updates[1].after.sessionVersion,9);
});

test('access repair does not steal conflicting email mappings',async()=>{
  const foreignNew=repairFixture({existing:{workspaceId:'other-client',sessionVersion:1}}),a=await foreignNew.run();
  assert.equal(a.code,409);assert.equal(foreignNew.calls.length,0);
  const foreignOld=repairFixture({oldMember:{workspaceId:'other-client',sessionVersion:3}}),b=await foreignOld.run();
  assert.equal(b.code,409);assert.equal(foreignOld.calls.length,0);
});

test('access repair rejects invalid revisions and fails closed on conflict or ambiguous storage',async()=>{
  const invalid=repairFixture({oldMember:{workspaceId:'client-1',sessionVersion:-2}}),a=await invalid.run();
  assert.equal(a.code,503);assert.equal(invalid.calls.length,0);
  const conflict=repairFixture({transaction:false}),b=await conflict.run();
  assert.equal(b.code,409);assert.equal(conflict.calls.length,1);
  const uncertain=repairFixture({transaction:'error'}),d=await uncertain.run();
  assert.equal(d.code,503);assert.match(d.data.error,/Could not confirm/);
});

test('unauthorized access mutations never read client records',async()=>{
  for(const make of [()=>forceFixture({denied:true}),()=>repairFixture({denied:true})]){
    const f=make();await f.run();assert.equal(f.reads.length,0);assert.equal(f.calls.length,0);
  }
});

function deferred(){let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no});return {promise,resolve,reject}}
function uiFixture(fetch){
  const nodes=new Map(),alerts=[],diagnostics=[],refreshes=[];
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',disabled:false,attrs:{},focus(){this.focused=true},classList:{toggle(){},remove(){},add(){}},setAttribute(k,v){this.attrs[k]=String(v)}});
    return nodes.get(id);
  };
  node('adminRepairEmail').value='new@example.test';
  const ctx=vm.createContext({
    currentAdminClient:{id:'client-1',ownerEmail:'old@example.test'},currentAdminTech:{diagnostics:{ownerEmail:'old@example.test'}},adminTechSaving:false,adminTechMutationTarget:'',adminClientSaving:false,adminClientOpenRequest:7,
    document:{getElementById:node,querySelectorAll:()=>[]},fetch,confirm:()=>true,openAdminActionConfirmation:spec=>spec.run(),
    loadAdminTechSupport:async(id,request)=>diagnostics.push({id,request}),
    refreshAdminCore:async()=>refreshes.push('refresh'),String,JSON,console
  });
  vm.runInContext(frontend,ctx);
  return {ctx,node,alerts,diagnostics,refreshes,run:cmd=>vm.runInContext(cmd,ctx)};
}

test('force sign-out locks access tools and ignores duplicate clicks until confirmed',async()=>{
  const pending=deferred(),requests=[];
  const f=uiFixture(async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return pending.promise});
  f.run('openAdminLogout()');
  assert.equal(requests.length,0);
  const first=f.run('forceClientLogout()'),duplicate=f.run('forceClientLogout()');
  assert.equal(requests.length,1);assert.equal(f.ctx.adminTechSaving,true);
  assert.equal(requests[0].body.expectedOwnerEmail,'old@example.test');
  assert.equal(f.node('adminForceLogoutButton').disabled,true);assert.equal(f.node('adminForceLogoutButton').textContent,'Revoking…');
  assert.equal(f.node('adminRepairAccessButton').disabled,true);assert.equal(f.node('closeAdminClient').disabled,true);
  assert.equal(f.node('adminClientDrawer').attrs['aria-busy'],'true');
  assert.equal(f.node('confirmAdminLogout').disabled,true);assert.equal(f.run('closeAdminLogout()'),false);
  pending.resolve({ok:true,json:async()=>({ok:true,sessionVersion:6})});
  await Promise.all([first,duplicate]);
  assert.equal(f.ctx.adminTechSaving,false);assert.equal(f.node('adminForceLogoutButton').disabled,false);
  assert.equal(f.node('adminForceLogoutButton').textContent,'Force sign out');
  assert.deepEqual(f.diagnostics,[{id:'client-1',request:7}]);
  assert.equal(f.node('adminTechStatus').textContent,'All existing client sessions have been revoked.');
  assert.equal(f.node('adminForceLogoutButton').focused,true);
});

test('sign-out confirmation rejects changed workspace, owner and drawer request without mutation',async()=>{
  for(const change of ["currentAdminClient.id='client-2'","currentAdminClient.ownerEmail='different@example.test'","adminClientOpenRequest++"]){
    const f=uiFixture(async()=>assert.fail('stale confirmation must not mutate'));
    f.run('openAdminLogout()');f.run(change);
    assert.equal(await f.run('forceClientLogout()'),false);
    assert.match(f.node('adminLogoutStatus').textContent,/context changed/);
    assert.equal(f.ctx.adminTechSaving,false);
  }
});

test('sign-out cancellation prevents mutation and failed attempts preserve a retryable dialog',async()=>{
  let requests=0;const f=uiFixture(async()=>{requests++;return {ok:false,json:async()=>({error:'Access changed'})}});
  f.run('openAdminLogout()');assert.match(f.node('adminLogoutCopy').textContent,/client-1.*old@example.test/);
  f.run('closeAdminLogout()');assert.equal(await f.run('forceClientLogout()'),false);assert.equal(requests,0);
  f.run('openAdminLogout()');assert.equal(await f.run('forceClientLogout()'),false);
  assert.equal(requests,1);assert.equal(f.node('adminLogoutModal').attrs['aria-hidden'],'false');
  assert.equal(f.node('confirmAdminLogout').disabled,false);assert.equal(f.node('adminLogoutStatus').textContent,'Access changed');
});

test('confirmed sign-out stays truthful when its diagnostics refresh fails',async()=>{
  const f=uiFixture(async()=>({ok:true,json:async()=>({ok:true,sessionVersion:6})}));
  f.ctx.loadAdminTechSupport=async()=>{throw Error('offline')};f.run('openAdminLogout()');
  assert.equal(await f.run('forceClientLogout()'),true);
  assert.equal(f.node('adminLogoutModal').attrs['aria-hidden'],'true');
  assert.match(f.node('adminTechStatus').textContent,/sessions were revoked, but diagnostics could not refresh/);
  assert.equal(f.ctx.adminTechSaving,false);
});

test('failed access repair preserves entered email, unlocks controls and remains retryable',async()=>{
  const pending=deferred(),requests=[];
  const f=uiFixture(async(url,options)=>{requests.push(JSON.parse(options.body));return pending.promise});
  const first=f.run('repairClientAccess()'),duplicate=f.run('repairClientAccess()');
  assert.equal(requests.length,1);assert.equal(f.ctx.adminTechSaving,true);
  assert.equal(requests[0].expectedOwnerEmail,'old@example.test');
  assert.equal(f.node('adminRepairAccessButton').textContent,'Repairing…');
  pending.resolve({ok:false,json:async()=>({error:'Mapping changed'})});
  await Promise.all([first,duplicate]);
  assert.equal(f.ctx.adminTechSaving,false);assert.equal(f.node('adminRepairEmail').value,'new@example.test');
  assert.equal(f.node('adminTechStatus').textContent,'Mapping changed');
  assert.equal(f.ctx.currentAdminClient.ownerEmail,'old@example.test');
});

test('confirmed access repair is not reported as failed when directory refresh is unavailable',async()=>{
  const f=uiFixture(async()=>({ok:true,json:async()=>({ok:true,email:'new@example.test',sessionVersion:7})}));
  f.ctx.refreshAdminCore=async()=>{throw Error('refresh offline')};
  await f.run('repairClientAccess()');
  assert.equal(f.ctx.currentAdminClient.ownerEmail,'new@example.test');
  assert.match(f.node('adminTechStatus').textContent,/was repaired, but the client directory could not refresh/);
  assert.deepEqual(f.diagnostics,[{id:'client-1',request:7}]);
  assert.equal(f.ctx.adminTechSaving,false);assert.equal(f.node('closeAdminClient').disabled,false);
});
