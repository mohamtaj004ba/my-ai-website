const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
  return {promise,resolve,reject};
}
function fixture({existing=true,confirmDelete=true}={}){
  const elements=new Map(),controls=['input','select','textarea','button'].map(()=>({disabled:false}));
  function el(id){
    if(!elements.has(id))elements.set(id,{value:'',disabled:false,textContent:'',className:'',hidden:false,dataset:{},classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v}});
    return elements.get(id);
  }
  const modal=el('campaignModal');modal.dataset.editId=existing?'campaign-1':'';
  modal.querySelectorAll=()=>controls;
  el('campaignNameInput').value='Campaign edited';
  const calls=[],requests=[],alerts=[],context=vm.createContext({
    document:{getElementById:el},CSS:{escape:x=>x},Date,Number,String,
    adminCampaignData:existing?[{id:'campaign-1',name:'Original campaign',updatedAt:10,createdAt:1}]:[],
    renderGrowth:()=>calls.push('render'),confirm:()=>confirmDelete,alert:x=>alerts.push(x),
    fetch:(url,options)=>{const task=deferred();requests.push({url,options,task});return task.promise}
  });
  const start=source.indexOf('let adminCampaignMutationPending=false;'),end=source.indexOf('\nfunction renderDocuments(',start);
  assert.ok(start>=0&&end>start);
  vm.runInContext(source.slice(start,end),context);
  return {context,modal,controls,el,requests,alerts,calls};
}

test('saving a campaign locks duplicate actions and modal dismissal until success',async()=>{
  const f=fixture();
  const saving=vm.runInContext('saveCampaign()',f.context);
  assert.equal(f.requests.length,1);
  assert.ok(f.controls.every(el=>el.disabled));
  assert.equal(f.el('saveCampaignButton').textContent,'Saving…');
  vm.runInContext('closeCampaignModal()',f.context);
  assert.notEqual(f.modal['aria-hidden'],'true');
  await vm.runInContext('saveCampaign()',f.context);
  await vm.runInContext('deleteCampaign()',f.context);
  assert.equal(f.requests.length,1,'no concurrent mutation');
  f.requests[0].task.resolve({ok:true,json:async()=>({campaign:{id:'campaign-1',name:'Campaign edited',updatedAt:20}})});
  await saving;
  assert.equal(f.requests.length,1,'confirmed campaign is applied locally without a stale follow-up list request');
  assert.equal(f.modal['aria-hidden'],'true');
  assert.equal(f.context.adminCampaignData[0].updatedAt,20);
  assert.ok(f.controls.every(el=>!el.disabled));
  assert.equal(vm.runInContext('adminCampaignMutationPending',f.context),false);
});

test('failed campaign save preserves draft, allows retry and never closes modal',async()=>{
  const f=fixture();
  const saving=vm.runInContext('saveCampaign()',f.context);
  f.requests[0].task.resolve({ok:false,json:async()=>({error:'Campaign changed; reload before retrying.'})});
  await saving;
  assert.equal(f.el('campaignNameInput').value,'Campaign edited');
  assert.notEqual(f.modal['aria-hidden'],'true');
  assert.match(f.el('campaignFormStatus').textContent,/Campaign changed/);
  assert.ok(f.controls.every(el=>!el.disabled));
  assert.equal(vm.runInContext('adminCampaignMutationPending',f.context),false);
  const retry=vm.runInContext('saveCampaign()',f.context);
  assert.equal(f.requests.length,2);
  f.requests[1].task.resolve({ok:false,json:async()=>({error:'Still stale'})});
  await retry;
});

test('campaign delete holds the lock and retains draft on server error',async()=>{
  const f=fixture();
  const deleting=vm.runInContext('deleteCampaign()',f.context);
  assert.equal(f.requests.length,1);
  assert.ok(f.controls.every(el=>el.disabled));
  assert.equal(f.el('deleteCampaignButton').textContent,'Deleting…');
  await vm.runInContext('saveCampaign()',f.context);
  vm.runInContext('closeCampaignModal()',f.context);
  assert.equal(f.requests.length,1);
  f.requests[0].task.resolve({ok:false,json:async()=>({error:'Campaign changed'})});
  await deleting;
  assert.notEqual(f.modal['aria-hidden'],'true');
  assert.match(f.el('campaignFormStatus').textContent,/Campaign changed/);
  assert.ok(f.controls.every(el=>!el.disabled));
});
