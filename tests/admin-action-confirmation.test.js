const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const helper=fs.readFileSync('admin-confirmation.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
const start=ui.indexOf('async function repairClientAccess(){'),end=ui.indexOf("\ndocument.getElementById('adminConfigSection')",start);
function fixture(fetch=async()=>({ok:true,json:async()=>({ok:true,email:'new@example.test',sessionVersion:2})})){
  const nodes=new Map(),requests=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,attrs:{},classes:new Set(),
    setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},focus(){},addEventListener(){},
    classList:{add(c){node(id).classes.add(c)},remove(c){node(id).classes.delete(c)},toggle(){}}});return nodes.get(id)};
  node('adminRepairEmail').value='new@example.test';node('adminConfigSection').value='settings';node('adminConfigEditor').value='{"name":"Edited"}';
  const ctx=vm.createContext({document:{getElementById:node},currentAdminClient:{id:'ws',name:'Target workspace',ownerEmail:'old@example.test'},
    currentAdminTech:{diagnostics:{ownerEmail:'old@example.test'},config:{settings:{name:'Current'}},audit:[{id:'audit',section:'settings',at:10,before:{name:'Before'}}]},
    adminClientOpenRequest:1,adminClientSaving:false,adminTechSaving:false,
    setAdminTechMutationState(value){ctx.adminTechSaving=value},adminTechMessage(message){node('adminTechStatus').textContent=message},
    renderAdminConfigEditor(){},renderAdminTechSupport(){},refreshAdminCore:async()=>{},loadAdminOps:async()=>{},loadAdminTechSupport:async()=>{},
    fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return fetch(url,options)}});
  ctx.adminPhoneData=[{id:'phone',number:'+15095550100',workspaceId:'ws',workspaceName:'Target workspace',updatedAt:10}];ctx.adminPhoneDeletePending=new Set();
  ctx.renderPhones=()=>{};ctx.setAdminSyncState=(_state,message)=>node('adminLastRefresh').textContent=message;ctx.refreshAdminView=async()=>{};
  ctx.adminInboxData={gmailStatus:{connected:true,gmailEmail:'admin@example.test'},gmail:{threads:[{id:'mail'}]},aliases:[{}],lastSync:1};ctx.currentInboxItem={id:'mail'};
  ctx.adminSearchInboxRequest=0;ctx.adminSearchInboxCacheLoaded=false;ctx.adminSearchInboxLoading=false;ctx.adminSearchInboxCacheError=false;
  ctx.renderInboxThread=()=>{};ctx.renderAdminInbox=()=>{};ctx.renderAdminGlobalSearch=()=>{};ctx.loadAdminInbox=async()=>{};
  ctx.setAdminInboxActionStatus=message=>node('inboxActionStatus').textContent=message;
  const phones=ui.slice(ui.indexOf('async function deletePhone('),ui.indexOf('\nfunction openPhoneModal('));
  const gmail=ui.slice(ui.indexOf('let gmailConnectionMutationPending=false;'),ui.indexOf("\ndocument.getElementById('inboxRefreshButton')"));
  vm.runInContext(helper+'\n'+ui.slice(start,end)+'\n'+phones+'\n'+gmail,ctx);
  return {ctx,node,requests,run:code=>vm.runInContext(code,ctx)};
}
test('consequential repair/configuration actions open named confirmations and cancellation sends no request',async()=>{
  for(const command of ['repairClientAccess()','applyAdminConfigOverride()',"restoreAdminAudit('audit')"]){
    const f=fixture();assert.equal(await f.run(command),true);assert.equal(f.requests.length,0);
    assert.match(f.node('adminActionConfirmationCopy').textContent,/Target workspace.*ws/);
    assert.equal(f.run('closeAdminActionConfirmation()'),true);assert.equal(await f.run('submitAdminActionConfirmation()'),false);
    assert.equal(f.requests.length,0);
  }
});
test('repair confirmation refuses changed email, owner, workspace or drawer generation',async()=>{
  for(const change of ["document.getElementById('adminRepairEmail').value='other@example.test'","currentAdminTech.diagnostics.ownerEmail='other@example.test'","currentAdminClient.id='other'",'adminClientOpenRequest++']){
    const f=fixture();await f.run('repairClientAccess()');f.run(change);
    assert.equal(await f.run('submitAdminActionConfirmation()'),false);assert.equal(f.requests.length,0);
    assert.match(f.node('adminActionConfirmationStatus').textContent,/changed/);
  }
});
test('override rejects changed draft, section and in-place loaded snapshot before mutation',async()=>{
  for(const change of ["document.getElementById('adminConfigEditor').value='{}'","document.getElementById('adminConfigSection').value='agent'","currentAdminTech.config.settings.name='New current'"]){
    const f=fixture();await f.run('applyAdminConfigOverride()');f.run(change);
    assert.equal(await f.run('submitAdminActionConfirmation()'),false);assert.equal(f.requests.length,0);
  }
});
test('rollback rejects changed history or current configuration and requires a matching section receipt',async()=>{
  for(const change of ["currentAdminTech.audit=[]","currentAdminTech.audit[0].before.name='Changed'","currentAdminTech.config.settings.name='Changed'"]){
    const f=fixture();await f.run("restoreAdminAudit('audit')");f.run(change);assert.equal(await f.run('submitAdminActionConfirmation()'),false);assert.equal(f.requests.length,0);
  }
  const f=fixture(async()=>({ok:true,json:async()=>({ok:true,section:'agent',value:{name:'Wrong section'}})}));
  await f.run("restoreAdminAudit('audit')");assert.equal(await f.run('submitAdminActionConfirmation()'),false);
  assert.equal(f.ctx.currentAdminTech.config.settings.name,'Current');assert.match(f.node('adminActionConfirmationStatus').textContent,/incomplete/);
});
test('pending confirmation blocks dismissal and duplicate submit, then preserves an error for retry',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve),f=fixture(async()=>pending);
  await f.run('repairClientAccess()');const first=f.run('submitAdminActionConfirmation()');
  assert.equal(f.run('closeAdminActionConfirmation()'),false);assert.equal(await f.run('submitAdminActionConfirmation()'),false);
  assert.equal(f.node('submitAdminActionConfirmation').disabled,true);assert.equal(f.requests.length,1);
  release({ok:false,json:async()=>({error:'Mapping changed'})});assert.equal(await first,false);
  assert.equal(f.node('adminActionConfirmationModal').attrs['aria-hidden'],'false');assert.equal(f.node('submitAdminActionConfirmation').disabled,false);
  assert.equal(f.node('adminActionConfirmationStatus').textContent,'Mapping changed');
});
test('configuration mutations submit captured snapshots and stay confirmed when refresh fails',async()=>{
  for(const command of ['applyAdminConfigOverride()',"restoreAdminAudit('audit')"]){
    const f=fixture(async()=>({ok:true,json:async()=>({ok:true,section:'settings',value:{name:'Confirmed'}})}));
    f.ctx.refreshAdminCore=async()=>{throw Error('offline')};await f.run(command);
    assert.equal(await f.run('submitAdminActionConfirmation()'),true);
    assert.equal(f.node('adminActionConfirmationModal').attrs['aria-hidden'],'true');assert.equal(f.ctx.adminTechSaving,false);
    assert.equal(f.requests[0].body.id,'ws');assert.equal((f.requests[0].body.expectedBefore||f.requests[0].body.expectedCurrent).name,'Current');
    assert.equal(f.ctx.currentAdminTech.config.settings.name,'Confirmed');assert.match(f.node('adminTechStatus').textContent,/was (applied|restored).*could not be verified/);
  }
});
test('confirmed access repair closes the confirmation even when diagnostics refresh fails',async()=>{
  const f=fixture();f.ctx.loadAdminTechSupport=async()=>{throw Error('offline')};await f.run('repairClientAccess()');
  assert.equal(await f.run('submitAdminActionConfirmation()'),true);assert.equal(f.ctx.currentAdminClient.ownerEmail,'new@example.test');
  assert.match(f.node('adminTechStatus').textContent,/was repaired, but diagnostics could not refresh/);
});

test('phone removal is cancellable, rejects stale routing and submits the captured record revision',async()=>{
  const f=fixture(async()=>({ok:true,json:async()=>({ok:true,deleted:{id:'phone'}})}));
  await f.run("deletePhone('phone')");assert.match(f.node('adminActionConfirmationConsequences').textContent,/does not release a provider-owned number/);
  f.run('closeAdminActionConfirmation()');assert.equal(f.requests.length,0);
  await f.run("deletePhone('phone')");f.ctx.adminPhoneData[0].updatedAt=11;
  assert.equal(await f.run('submitAdminActionConfirmation()'),false);assert.equal(f.requests.length,0);
  f.run('closeAdminActionConfirmation()');await f.run("deletePhone('phone')");
  assert.equal(await f.run('submitAdminActionConfirmation()'),true);assert.equal(f.requests[0].body.expectedUpdatedAt,11);assert.equal(f.ctx.adminPhoneData.length,0);
});
test('phone removal refuses missing revisions and preserves inventory after a failed confirmation',async()=>{
  const f=fixture(async()=>({ok:false,json:async()=>({error:'Routing changed'})}));f.ctx.adminPhoneData[0].updatedAt=0;
  assert.equal(await f.run("deletePhone('phone')"),false);assert.equal(f.requests.length,0);
  f.ctx.adminPhoneData[0].updatedAt=10;await f.run("deletePhone('phone')");assert.equal(await f.run('submitAdminActionConfirmation()'),false);
  assert.equal(f.ctx.adminPhoneData.length,1);assert.equal(f.node('adminActionConfirmationStatus').textContent,'Routing changed');
});
test('Gmail confirmation rejects a changed connection and cancellation preserves cached inbox',async()=>{
  const f=fixture();await f.run('disconnectGmailAdmin()');assert.match(f.node('adminActionConfirmationCopy').textContent,/admin@example.test/);
  f.run('closeAdminActionConfirmation()');assert.equal(f.requests.length,0);assert.equal(f.ctx.adminInboxData.gmail.threads.length,1);
  await f.run('disconnectGmailAdmin()');f.ctx.adminInboxData.gmailStatus.gmailEmail='other@example.test';
  assert.equal(await f.run('submitAdminActionConfirmation()'),false);assert.equal(f.requests.length,0);
});
test('confirmed Gmail disconnect remains successful after refresh failure',async()=>{
  const f=fixture(async()=>({ok:true,json:async()=>({ok:true})}));
  let submitted;
  f.ctx.fetch=async(_url,options)=>{submitted=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true})}};f.ctx.loadAdminInbox=async()=>{throw Error('offline')};
  await f.run('disconnectGmailAdmin()');assert.equal(await f.run('submitAdminActionConfirmation()'),true);
  assert.equal(f.ctx.adminInboxData.gmailStatus.connected,false);assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.deepEqual(submitted,{expectedGmailEmail:'admin@example.test'});
  assert.match(f.node('inboxActionStatus').textContent,/was disconnected.*could not be verified/);
});

test('Gmail connection mutation is blocked when the latest connection status cannot be verified',async()=>{
  const f=fixture();f.ctx.adminInboxData.connectionStatusError='Connection unverified';
  assert.equal(await f.run('disconnectGmailAdmin()'),false);assert.equal(await f.run('connectGmail()'),false);
  assert.equal(f.requests.length,0);assert.equal(f.node('inboxActionStatus').textContent,'Connection unverified');
});
