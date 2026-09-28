const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
function segment(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'segment exists: '+start);return source.slice(a,b);
}
const backend=segment(api,'async function adminDeleteClient(req,res){','\nasync function adminPurgeClient(req,res){');
const frontend=[
  segment(ui,'function setAdminClientMutationState(','\nasync function loadAdminTechSupport('),
  segment(ui,'async function deleteAdminClient(){','\nasync function viewAdminClient(){')
].join('\n');
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function resultBox(){let code=0,data=null;return {res:{status(n){code=n;return this},json(x){data=x;return x}},read:()=>({code,data})}}
function cleanEmail(x){return String(x||'').trim().toLowerCase()}

function backendFixture({
  action='delete',workspace,member,expectedUpdatedAt=20,transaction=true,gmail='ok',denied=false,adminWorkspace='admin-home'
}={}){
  const base=workspace||(
    action==='restore'
      ?{id:'client-1',name:'Client',ownerEmail:'owner@example.test',status:'pending_deletion',preDeletionStatus:'active',updatedAt:20,purgeEligibleAt:999999,deletionRequestedAt:10,deletionRequestedBy:'admin@example.test',deletionReason:'test'}
      :{id:'client-1',name:'Client',ownerEmail:'owner@example.test',status:'active',subscriptionStatus:'canceled',updatedAt:20}
  );
  const access=member===undefined?{workspaceId:'client-1',role:'owner',email:'owner@example.test',sessionVersion:4,disabled:action==='restore'}:member;
  const box=resultBox(),calls=[],reads=[],gmailCalls=[],sequence=[];
  const ctx=vm.createContext({
    requireAdmin:async()=>denied?null:{email:'admin@example.test',workspaceId:adminWorkspace},
    kv:{get:async key=>{
      reads.push(key);
      if(key==='workspace:client-1')return clone(base);
      if(key==='user:email:owner@example.test')return clone(access);
      return null;
    },set:()=>assert.fail('schedule/restore must not use independent set'),del:()=>assert.fail('schedule/restore must not use independent delete')},
    compareAndAuditBatch:async(_kv,updates,auditKey,event,options)=>{
      sequence.push('transaction');calls.push({updates:clone(updates),auditKey,event:clone(event),options:clone(options)});
      if(transaction==='error')throw Error('uncertain');
      return transaction!==false;
    },
    disconnectGmail:async email=>{sequence.push('gmail');gmailCalls.push(email);if(gmail==='error')throw Error('provider unavailable')},
    cleanEmail,purgeJournalKey:id=>'purge:workspace:'+id,validPurgeJournal:value=>!!value&&value.version===1,
    crypto:{randomUUID:()=> 'audit-1'},safeError:()=>'',console:{error(){}},
    Date:{now:()=>1000},Number,Array,String,Promise,Set,
    req:{body:{id:'client-1',expectedUpdatedAt}},res:box.res
  });
  vm.runInContext(backend,ctx);
  return {ctx,calls,reads,gmailCalls,sequence,run:async()=>{
    const name=action==='restore'?'adminRestoreDeletedClient':'adminDeleteClient';
    await vm.runInContext(name+'(req,res)',ctx);return box.read();
  }};
}

test('deletion scheduling atomically changes workspace, revokes owner sessions and writes audit before provider cleanup',async()=>{
  const f=backendFixture(),r=await f.run();
  assert.equal(r.code,200);assert.equal(r.data.pendingDeletion,true);assert.equal(f.calls.length,1);
  const call=f.calls[0],byKey=Object.fromEntries(call.updates.map(x=>[x.key,x]));
  assert.equal(byKey['workspace:client-1'].after.status,'pending_deletion');
  assert.equal(byKey['workspace:client-1'].after.updatedAt,1000);
  assert.equal(byKey['user:email:owner@example.test'].after.disabled,true);
  assert.equal(byKey['user:email:owner@example.test'].after.sessionVersion,5);
  assert.equal(call.auditKey,'audit:client-1');assert.equal(call.event.action,'deletion_scheduled');
  assert.deepEqual(f.sequence,['transaction','gmail']);
  assert.deepEqual(f.gmailCalls,['owner@example.test']);
});

test('stale deletion, transaction conflict and uncertain persistence never reach Gmail cleanup',async()=>{
  const stale=backendFixture({expectedUpdatedAt:19}),a=await stale.run();
  assert.equal(a.code,409);assert.equal(stale.calls.length,0);assert.equal(stale.gmailCalls.length,0);
  const conflict=backendFixture({transaction:false}),b=await conflict.run();
  assert.equal(b.code,409);assert.equal(conflict.gmailCalls.length,0);
  const uncertain=backendFixture({transaction:'error'}),d=await uncertain.run();
  assert.equal(d.code,503);assert.equal(uncertain.gmailCalls.length,0);
});

test('confirmed deletion remains confirmed when Gmail disconnect later fails',async()=>{
  const f=backendFixture({gmail:'error'}),r=await f.run();
  assert.equal(r.code,200);assert.equal(f.calls.length,1);assert.equal(f.gmailCalls.length,1);
  assert.match(r.data.warning,/could not be disconnected/i);
});

test('foreign owner mapping is never disabled or disconnected during workspace deletion',async()=>{
  const f=backendFixture({member:{workspaceId:'other-client',sessionVersion:9,email:'owner@example.test'}}),r=await f.run();
  assert.equal(r.code,200);assert.equal(f.calls[0].updates.length,1);
  assert.equal(f.calls[0].updates[0].key,'workspace:client-1');
  assert.equal(f.gmailCalls.length,0);assert.match(r.data.warning,/maps to another workspace/i);
});

test('unsafe owner session revision blocks a deletion schedule before any writes',async()=>{
  const f=backendFixture({member:{workspaceId:'client-1',sessionVersion:-1,email:'owner@example.test'}}),r=await f.run();
  assert.equal(r.code,503);assert.equal(f.calls.length,0);assert.equal(f.gmailCalls.length,0);
});

test('already pending deletion is idempotent and does not repeat access or provider mutations',async()=>{
  const f=backendFixture({workspace:{id:'client-1',ownerEmail:'owner@example.test',status:'pending_deletion',updatedAt:31,purgeEligibleAt:5000}}),r=await f.run();
  assert.equal(r.code,200);assert.equal(r.data.client.updatedAt,31);
  assert.equal(f.calls.length,0);assert.equal(f.gmailCalls.length,0);
});

test('active Stripe subscription and current admin workspace remain protected from deletion schedule',async()=>{
  const stripe=backendFixture({workspace:{id:'client-1',ownerEmail:'owner@example.test',status:'active',subscriptionStatus:'active',stripeSubscriptionId:'sub_live',updatedAt:20}}),a=await stripe.run();
  assert.equal(a.code,409);assert.equal(stripe.calls.length,0);
  const own=backendFixture({adminWorkspace:'client-1'}),b=await own.run();
  assert.equal(b.code,409);assert.equal(own.calls.length,0);
});

test('restoration atomically clears deletion state, re-enables matching owner and increments session revision',async()=>{
  const f=backendFixture({action:'restore'}),r=await f.run();
  assert.equal(r.code,200);assert.equal(r.data.status,'active');assert.equal(r.data.accessNeedsRepair,false);
  const call=f.calls[0],byKey=Object.fromEntries(call.updates.map(x=>[x.key,x]));
  const ws=byKey['workspace:client-1'].after,member=byKey['user:email:owner@example.test'].after;
  assert.equal(ws.status,'active');assert.equal(ws.deletionRequestedAt,undefined);assert.equal(ws.purgeEligibleAt,undefined);assert.equal(ws.preDeletionStatus,undefined);
  assert.equal(member.disabled,false);assert.equal(member.sessionVersion,5);
  assert.equal(call.event.action,'deletion_restored');assert.equal(f.gmailCalls.length,0);
});

test('restoration does not hijack missing or foreign owner mappings and returns repair guidance',async()=>{
  for(const member of [null,{workspaceId:'other-client',sessionVersion:2,email:'owner@example.test'}]){
    const f=backendFixture({action:'restore',member}),r=await f.run();
    assert.equal(r.code,200);assert.equal(r.data.accessNeedsRepair,true);assert.match(r.data.warning,/Repair access mapping/);
    assert.equal(f.calls[0].updates.length,1);assert.equal(f.calls[0].updates[0].key,'workspace:client-1');
  }
});

test('stale, conflicting and unsafe restoration attempts fail closed',async()=>{
  const stale=backendFixture({action:'restore',expectedUpdatedAt:19}),a=await stale.run();assert.equal(a.code,409);assert.equal(stale.calls.length,0);
  const unsafe=backendFixture({action:'restore',member:{workspaceId:'client-1',sessionVersion:Number.MAX_SAFE_INTEGER}}),b=await unsafe.run();assert.equal(b.code,503);assert.equal(unsafe.calls.length,0);
  const conflict=backendFixture({action:'restore',transaction:false}),d=await conflict.run();assert.equal(d.code,409);
  const uncertain=backendFixture({action:'restore',transaction:'error'}),e=await uncertain.run();assert.equal(e.code,503);
});

test('unauthorized deletion and restoration do not read client records',async()=>{
  for(const action of ['delete','restore']){
    const f=backendFixture({action,denied:true});await f.run();assert.equal(f.reads.length,0);assert.equal(f.calls.length,0);
  }
});

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function uiFixture(fetch){
  const nodes=new Map(),alerts=[],closed=[],refreshes=[];
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=String(v)}});
    return nodes.get(id);
  };
  const ctx=vm.createContext({
    currentAdminClient:{id:'client-1',name:'Client One',plan:'Starter',status:'active',updatedAt:20,stripe:{}},
    adminClientSaving:false,adminTechSaving:false,
    document:{getElementById:node,querySelectorAll:()=>[]},
    confirm:()=>true,prompt:()=> 'DELETE',fetch,alert:x=>alerts.push(String(x)),
    closeAdminClient:()=>closed.push('closed'),
    refreshAdminCore:async()=>refreshes.push('core'),loadAdminOps:async()=>refreshes.push('ops'),
    Date,Number,String,JSON
  });
  vm.runInContext(frontend,ctx);
  return {ctx,node,alerts,closed,refreshes,run:cmd=>vm.runInContext(cmd,ctx)};
}

test('deletion UI sends displayed revision, locks drawer and suppresses duplicate submissions',async()=>{
  const pending=deferred(),requests=[];
  const f=uiFixture(async(_url,options)=>{requests.push(JSON.parse(options.body));return pending.promise});
  const first=f.run('deleteAdminClient()'),duplicate=f.run('deleteAdminClient()');
  assert.equal(requests.length,1);assert.deepEqual(requests[0],{id:'client-1',expectedUpdatedAt:20});
  assert.equal(f.ctx.adminClientSaving,true);assert.equal(f.node('adminDeleteClientButton').disabled,true);
  assert.equal(f.node('adminDeleteClientButton').textContent,'Scheduling…');
  assert.equal(f.node('adminSaveClientButton').textContent,'Save changes');
  assert.equal(f.node('closeAdminClient').disabled,true);assert.equal(f.node('adminClientDrawer').attrs['aria-busy'],'true');
  pending.resolve({ok:true,json:async()=>({ok:true,pendingDeletion:true,purgeEligibleAt:9000,client:{id:'client-1',status:'pending_deletion',updatedAt:30,purgeEligibleAt:9000}})});
  await Promise.all([first,duplicate]);
  assert.equal(f.ctx.adminClientSaving,false);assert.equal(f.node('adminDeleteClientButton').textContent,'Delete workspace');
  assert.deepEqual(f.closed,['closed']);assert.equal(f.ctx.currentAdminClient,null);assert.deepEqual(f.refreshes,['core','ops']);
  assert.match(f.alerts[0],/pending deletion/);
});

test('failed deletion scheduling unlocks controls and keeps the same client open for retry',async()=>{
  const f=uiFixture(async()=>({ok:false,json:async()=>({error:'Workspace changed'})}));
  await f.run('deleteAdminClient()');
  assert.equal(f.ctx.adminClientSaving,false);assert.equal(f.ctx.currentAdminClient.id,'client-1');
  assert.equal(f.closed.length,0);assert.deepEqual(f.refreshes,[]);assert.deepEqual(f.alerts,['Workspace changed']);
  assert.equal(f.node('adminDeleteClientButton').disabled,false);
});

test('confirmed deletion is not misreported as failed when the directory refresh later fails',async()=>{
  const f=uiFixture(async()=>({ok:true,json:async()=>({ok:true,pendingDeletion:true,purgeEligibleAt:9000,warning:'Provider cleanup needs review.',client:{id:'client-1',status:'pending_deletion',updatedAt:30}})}));
  f.ctx.refreshAdminCore=async()=>{throw Error('offline')};
  await f.run('deleteAdminClient()');
  assert.equal(f.closed.length,1);assert.equal(f.ctx.currentAdminClient,null);
  assert.match(f.alerts[0],/Provider cleanup needs review/);
  assert.match(f.alerts.at(-1),/Deletion was scheduled, but the admin directory could not refresh/);
  assert.doesNotMatch(f.alerts.at(-1),/Could not schedule/);
});
