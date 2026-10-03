const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('let companyDocumentMutationPending=false;');
const end=source.indexOf('\nasync function loadAdminInbox(',start);
assert.ok(start>=0&&end>start,'company document handlers must be present');

function fixture({response,hold=false}={}){
  const fields={},controls=[];
  for(const id of ['companyDocumentName','companyDocumentType','companyDocumentStatus','companyDocumentUrl','companyDocumentEffective','companyDocumentExpires','companyDocumentNotes','saveCompanyDocument','deleteCompanyDocument','companyDocumentStatusLine','companyDocumentModalTitle','closeCompanyDocumentModal']){
    fields[id]={value:'',textContent:'',disabled:false,hidden:false,className:'',dataset:{},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},focus(){this.focused=true}};
    controls.push(fields[id]);
  }
  const modal={dataset:{},attributes:{},classList:{add(){modal.open=true},remove(){modal.open=false}},setAttribute(k,v){this.attributes[k]=v},querySelectorAll(){return controls}};
  fields.companyDocumentModal=modal;
  let pendingResolve,requests=[],renderCount=0,confirmCount=0;
  const record={id:'doc-1',name:'Old record',type:'Legal',status:'active',updatedAt:10,createdAt:1};
  const ctx=vm.createContext({
    adminDocumentsData:{company:[record]},companyDocumentMutationPending:false,
    document:{getElementById:id=>fields[id]||null},
    fetch:async(url,options)=>{requests.push({url,options});if(hold)await new Promise(resolve=>pendingResolve=resolve);return response||{ok:true,json:async()=>({ok:true,document:{...record,name:'New record',updatedAt:11},deleted:{id:'doc-1'}})}},
    renderDocuments:()=>{renderCount++},confirm:()=>{confirmCount++;return true},
    Number,String,Error
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,fields,modal,requests,release:()=>pendingResolve?.(),renders:()=>renderCount,confirms:()=>confirmCount,run:(fn,...args)=>vm.runInContext(fn+'('+args.map(JSON.stringify).join(',')+')',ctx)};
}
function flush(){return new Promise(resolve=>setImmediate(resolve))}

test('stale company-record edit IDs fail closed with visible refresh guidance',()=>{
  const block=source.slice(source.indexOf('function openCompanyDocumentModal('),source.indexOf('function closeCompanyDocumentModal('));
  assert.match(block,/if\(id&&!x\).*setAdminSyncState\('error','This company record is no longer available\. Refresh Documents before editing\.'\).*return false/);
  assert.ok(block.indexOf('if(id&&!x)')<block.indexOf("classList.add('open')"));
});

test('company document edit sends displayed revision, locks controls and applies confirmed response',async()=>{
  const f=fixture({hold:true});f.run('openCompanyDocumentModal','doc-1');
  f.fields.companyDocumentName.value='New record';
  const request=f.run('saveCompanyDocument');await flush();
  assert.equal(f.requests.length,1);
  assert.equal(JSON.parse(f.requests[0].options.body).expectedUpdatedAt,10);
  assert.equal(f.fields.closeCompanyDocumentModal.disabled,true);
  assert.equal(f.modal.attributes['aria-busy'],'true');
  f.run('closeCompanyDocumentModal');assert.equal(f.modal.open,true);
  f.run('saveCompanyDocument');assert.equal(f.requests.length,1);
  f.release();await request;
  assert.equal(f.ctx.adminDocumentsData.company[0].name,'New record');
  assert.equal(f.modal.open,false);assert.equal(f.fields.saveCompanyDocument.disabled,false);
  assert.equal(f.renders(),1);
});

test('failed save retains company document draft and unlocks for retry',async()=>{
  const f=fixture({response:{ok:false,json:async()=>({error:'Stale revision'})}});
  f.run('openCompanyDocumentModal','doc-1');f.fields.companyDocumentName.value='Draft survives';
  await f.run('saveCompanyDocument');
  assert.equal(f.modal.open,true);assert.equal(f.fields.companyDocumentName.value,'Draft survives');
  assert.match(f.fields.companyDocumentStatusLine.textContent,/Stale revision/);
  assert.equal(f.fields.saveCompanyDocument.disabled,false);
});

test('company document delete submits revision and keeps confirmed deletion locally',async()=>{
  const f=fixture();f.run('openCompanyDocumentModal','doc-1');
  await f.run('deleteCompanyDocument');
  assert.equal(JSON.parse(f.requests[0].options.body).expectedUpdatedAt,10);
  assert.equal(f.ctx.adminDocumentsData.company.length,0);
  assert.equal(f.modal.open,false);assert.equal(f.renders(),1);
});

test('company document warns about reversed dates before sending a request',async()=>{
  const f=fixture();f.run('openCompanyDocumentModal','doc-1');
  f.fields.companyDocumentEffective.value='2026-09-25';
  f.fields.companyDocumentExpires.value='2026-09-24';
  await f.run('saveCompanyDocument');
  assert.equal(f.requests.length,0);
  assert.match(f.fields.companyDocumentStatusLine.textContent,/cannot precede/);
  assert.equal(f.fields.companyDocumentExpires['aria-invalid'],'true');
  assert.equal(f.fields.companyDocumentExpires.focused,true);
  assert.equal(f.fields.saveCompanyDocument.disabled,false);
  assert.equal(f.modal.open,true);
});


test('company document blank-name validation marks the field before any request',async()=>{
  const f=fixture();f.run('openCompanyDocumentModal','doc-1');
  const name=f.fields.companyDocumentName;name.value='   ';name.setAttribute=function(k,v){this[k]=v};name.removeAttribute=function(k){delete this[k]};name.focus=function(){this.focused=true};
  await f.run('saveCompanyDocument');
  assert.equal(f.requests.length,0);
  assert.equal(name['aria-invalid'],'true');
  assert.equal(name.focused,true);
  assert.match(f.fields.companyDocumentStatusLine.textContent,/required/);
});
