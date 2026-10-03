const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
function segment(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'segment exists: '+start);return source.slice(a,b);
}

test('admin client detail exposes deletion recovery metadata for pending workspaces',async()=>{
  const body=segment(api,'async function adminClient(req,res){','\n\nfunction notificationReadKey(');
  let code=0,data=null;
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>{
      if(key==='workspace:client-1')return {id:'client-1',name:'Client',plan:'Starter',status:'pending_deletion',subscriptionStatus:'canceled',ownerEmail:'owner@example.test',createdAt:1,updatedAt:20,deletionRequestedAt:10,purgeEligibleAt:999,preDeletionStatus:'active'};
      if(key==='phone:index')return [];
      return null;
    }},
    entitlementsFor:p=>({plan:p}),voiceStatus:()=>({}),Array,Number,String,Promise,
    req:{query:{id:'client-1'}},res:{status(n){code=n;return this},json(x){data=x;return x}}
  });
  vm.runInContext(body,ctx);await vm.runInContext('adminClient(req,res)',ctx);
  assert.equal(code,200);assert.equal(data.client.status,'pending_deletion');
  assert.deepEqual(JSON.parse(JSON.stringify(data.client.deletion)),{requestedAt:10,purgeEligibleAt:999,preDeletionStatus:'active'});
});

test('ordinary admin workspace edits cannot bypass the pending-deletion recovery path',async()=>{
  const body=segment(api,'async function adminUpdateClient(req,res){','\nasync function adminDeleteClient(');
  let code=0,data=null,transactionCalls=0;
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async()=>({id:'client-1',plan:'Starter',status:'pending_deletion',createdAt:1,updatedAt:20})},
    compareAndAudit:async()=>{transactionCalls++;return true},
    req:{body:{id:'client-1',status:'active',plan:'Growth',expectedUpdatedAt:20}},
    res:{status(n){code=n;return this},json(x){data=x;return x}},String,Number
  });
  vm.runInContext(body,ctx);await vm.runInContext('adminUpdateClient(req,res)',ctx);
  assert.equal(code,409);assert.match(data.error,/recovery action/i);assert.equal(transactionCalls,0);
});

const frontend=[
  segment(ui,'function setAdminClientMutationState(','\nasync function loadAdminTechSupport('),
  segment(ui,'async function restoreAdminClient(){','\nasync function viewAdminClient(){')
].join('\n');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function fixture(fetch){
  const nodes=new Map(),alerts=[],statuses=[],reopens=[],refreshes=[];
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',disabled:false,hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=String(v)}});
    return nodes.get(id);
  };
  const current={id:'client-1',name:'Client One',plan:'Starter',status:'pending_deletion',createdAt:1,updatedAt:20,stripe:{},deletion:{requestedAt:10,purgeEligibleAt:999999,preDeletionStatus:'active'}};
  node('adminSaveClientButton').hidden=true;node('adminDeleteClientButton').hidden=true;node('adminRestoreClientButton').hidden=false;
  node('adminClientPlan').disabled=true;node('adminClientStatus').disabled=true;
  const ctx=vm.createContext({
    currentAdminClient:current,adminClientSaving:false,adminTechSaving:false,
    document:{getElementById:node,querySelectorAll:()=>[]},fetch,confirm:()=>true,
    alert:x=>alerts.push(String(x)),setAdminClientActionStatus:(message,tone='')=>statuses.push({message:String(message||''),tone:String(tone||'')}),refreshAdminCore:async()=>refreshes.push('core'),loadAdminOps:async()=>refreshes.push('ops'),
    openAdminClient:async(id,options)=>{reopens.push({id,options});return true},
    Date,Number,String,JSON
  });
  vm.runInContext(frontend,ctx);
  return {ctx,node,alerts,statuses,reopens,refreshes,run:cmd=>vm.runInContext(cmd,ctx)};
}

test('pending-deletion drawer wiring exposes recovery instead of ordinary status edits',()=>{
  const html=fs.readFileSync('admin-dashboard.html','utf8'),open=segment(ui,'async function openAdminClient(','\nfunction adminTechMessage(');
  assert.match(html,/id="adminRestoreClientButton" hidden>Restore workspace/);
  assert.match(html,/value="pending_deletion" disabled>Pending deletion/);
  assert.match(open,/pendingDeletion=x\.status==='pending_deletion'/);
  assert.match(open,/saveButton\.hidden=pendingDeletion/);
  assert.match(open,/deleteButton\.hidden=pendingDeletion/);
  assert.match(open,/restoreButton\.hidden=!pendingDeletion/);
  assert.match(open,/Use Restore workspace to recover access/);
  const restore=segment(ui,'async function restoreAdminClient(){','\nasync function viewAdminClient(){');
  assert.match(restore,/action=admin-client-delete-restore/);
  assert.doesNotMatch(restore,/action=admin-client-restore/);
});

test('restore action sends displayed revision, locks the drawer and suppresses duplicate recovery clicks',async()=>{
  const pending=deferred(),requests=[],f=fixture(async(_url,options)=>{requests.push(JSON.parse(options.body));return pending.promise});
  const first=f.run('restoreAdminClient()'),duplicate=f.run('restoreAdminClient()');
  assert.equal(await duplicate,false);
  assert.deepEqual(requests,[{id:'client-1',expectedUpdatedAt:20}]);
  assert.equal(f.ctx.adminClientSaving,true);
  assert.equal(f.node('adminRestoreClientButton').disabled,true);assert.equal(f.node('adminRestoreClientButton').textContent,'Restoring…');
  assert.equal(f.node('closeAdminClient').disabled,true);assert.equal(f.node('adminClientDrawer').attrs['aria-busy'],'true');
  pending.resolve({ok:true,json:async()=>({ok:true,status:'active',client:{id:'client-1',status:'active',updatedAt:30}})});
  assert.equal(await first,true);
  assert.equal(f.ctx.adminClientSaving,false);assert.equal(f.ctx.currentAdminClient.status,'active');assert.equal(f.ctx.currentAdminClient.deletion,null);
  assert.equal(f.node('adminRestoreClientButton').hidden,true);assert.equal(f.node('adminDeleteClientButton').hidden,false);assert.equal(f.node('adminSaveClientButton').hidden,false);
  assert.deepEqual(f.refreshes,['core','ops']);assert.equal(f.reopens.length,1);assert.equal(f.reopens[0].id,'client-1');assert.equal(f.reopens[0].options.allowLocked,true);
});

test('failed restore keeps pending state visible and fully unlocks the recovery controls',async()=>{
  const f=fixture(async()=>({ok:false,json:async()=>({error:'Workspace changed'})}));
  assert.equal(await f.run('restoreAdminClient()'),false);
  assert.equal(f.ctx.currentAdminClient.status,'pending_deletion');assert.notEqual(f.ctx.currentAdminClient.deletion,null);
  assert.equal(f.ctx.adminClientSaving,false);assert.equal(f.node('adminRestoreClientButton').hidden,false);assert.equal(f.node('adminRestoreClientButton').disabled,false);
  assert.deepEqual(f.alerts,[]);assert.ok(f.statuses.some(item=>item.tone==='error'&&item.message==='Workspace changed'));assert.deepEqual(f.reopens,[]);
});

test('confirmed restore stays confirmed if later admin refresh fails and surfaces access-repair warning',async()=>{
  const f=fixture(async()=>({ok:true,json:async()=>({ok:true,status:'suspended',warning:'Workspace restored, but no owner access mapping exists. Repair access mapping before sending a login link.',client:{id:'client-1',status:'suspended',updatedAt:31}})}));
  f.ctx.refreshAdminCore=async()=>{throw Error('offline')};
  assert.equal(await f.run('restoreAdminClient()'),true);
  assert.equal(f.ctx.currentAdminClient.status,'suspended');assert.equal(f.ctx.currentAdminClient.deletion,null);
  assert.equal(f.node('adminRestoreClientButton').hidden,true);assert.equal(f.node('adminDeleteClientButton').hidden,false);
  assert.deepEqual(f.alerts,[]);
  assert.ok(f.statuses.some(item=>/Repair access mapping/.test(item.message)));
  const finalStatus=f.statuses.at(-1);
  assert.equal(finalStatus.tone,'error');assert.match(finalStatus.message,/restoration was confirmed, but the admin view could not refresh/);
  assert.doesNotMatch(finalStatus.message,/Could not restore/);
});
