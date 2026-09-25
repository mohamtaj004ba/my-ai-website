const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no});return {promise,resolve,reject}}
function fixture(fetch){
  const nodes=new Map(),restoreButton={disabled:false,dataset:{restoreAudit:'audit-1'},addEventListener:()=>{}};
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},classList:{toggle:()=>{},remove:()=>{}},setAttribute:()=>{},addEventListener:()=>{},querySelectorAll:()=>[]});
    return nodes.get(id);
  };
  node('adminConfigSection').value='settings';node('adminConfigEditor').value=JSON.stringify({businessName:'New name'});
  const ctx=vm.createContext({
    currentAdminClient:{id:'ws-1'},currentAdminTech:{config:{settings:{businessName:'Old name'}},diagnostics:{},audit:[]},adminTechSaving:false,adminTechMutationTarget:'',
    fetch,confirm:()=>true,refreshAdminCore:async()=>{},loadAdminOps:async()=>{},esc:value=>String(value??''),console,
    document:{getElementById:node,querySelectorAll:selector=>selector==='[data-restore-audit]'?[restoreButton]:[]}
  });
  const start=source.indexOf('function adminTechMessage('),end=source.indexOf('\nlet adminSearchActiveIndex',start);
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,node,restoreButton};
}

test('admin override locks repair controls, blocks duplicate writes and applies the confirmed value before refresh',async()=>{
  const pending=deferred(),requests=[];
  const {ctx,node,restoreButton}=fixture(async url=>{
    requests.push(url);
    if(url.includes('admin-config-override'))return pending.promise;
    return {ok:true,json:async()=>({config:{settings:{businessName:'Saved name'}},diagnostics:{},audit:[]})};
  });
  const first=vm.runInContext('applyAdminConfigOverride()',ctx),duplicate=vm.runInContext('applyAdminConfigOverride()',ctx);
  assert.equal(ctx.adminTechSaving,true);assert.equal(node('adminConfigEditor').disabled,true);assert.equal(node('adminApplyOverrideButton').textContent,'Applying…');assert.equal(restoreButton.disabled,true);
  assert.equal(requests.filter(url=>url.includes('admin-config-override')).length,1);
  pending.resolve({ok:true,json:async()=>({section:'settings',value:{businessName:'Saved name'}})});await Promise.all([first,duplicate]);
  assert.equal(ctx.adminTechSaving,false);assert.equal(node('adminConfigEditor').disabled,false);assert.equal(node('adminApplyOverrideButton').textContent,'Apply admin override');assert.equal(ctx.currentAdminTech.config.settings.businessName,'Saved name');
});

test('failed admin override unlocks the drawer and preserves the editable JSON for retry',async()=>{
  const {ctx,node}=fixture(async()=>{throw new Error('Network unavailable')});
  const draft=node('adminConfigEditor').value;await vm.runInContext('applyAdminConfigOverride()',ctx);
  assert.equal(ctx.adminTechSaving,false);assert.equal(node('adminConfigEditor').disabled,false);assert.equal(node('adminConfigEditor').value,draft);assert.equal(node('adminTechStatus').textContent,'Network unavailable');
});

test('audit restoration locks dismissal and exposes the returned snapshot immediately',async()=>{
  const pending=deferred(),{ctx,node}=fixture(async url=>{
    if(url.includes('admin-audit-restore'))return pending.promise;
    return {ok:true,json:async()=>({config:{settings:{businessName:'Restored'}},diagnostics:{},audit:[]})};
  });
  ctx.currentAdminTech.audit=[{id:'audit-1',at:Date.now(),actorRole:'admin',actorEmail:'admin@example.com',action:'admin_override',section:'settings',before:{businessName:'Restored'},after:{businessName:'New'}}];
  const restore=vm.runInContext("restoreAdminAudit('audit-1')",ctx);vm.runInContext('closeAdminClient()',ctx);
  assert.equal(ctx.adminTechSaving,true);assert.equal(node('closeAdminClient').disabled,true);
  pending.resolve({ok:true,json:async()=>({section:'settings',value:{businessName:'Restored'}})});await restore;
  assert.equal(ctx.adminTechSaving,false);assert.equal(ctx.currentAdminTech.config.settings.businessName,'Restored');assert.equal(node('closeAdminClient').disabled,false);
});
