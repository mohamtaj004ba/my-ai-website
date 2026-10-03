const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('admin-dashboard.html','utf8');

function makeEl(){
  return {value:'',disabled:false,textContent:'',className:'',dataset:{},classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},focus(){this.focused=true},querySelectorAll(){return[]}};
}
function prospectFixture(){
  const elements=new Map();
  function el(id){if(!elements.has(id))elements.set(id,makeEl());return elements.get(id)}
  const modal=el('prospectModal');modal.dataset.editId='';
  el('prospectStageInput').value='new';el('prospectSourceInput').value='Website';
  const requests=[];
  const ctx=vm.createContext({
    document:{getElementById:el,createElement:()=>makeEl(),createTextNode:t=>({textContent:t})},
    adminWebsiteData:{prospects:[]},adminPlatformData:{},prospectModalPending:false,prospectStagePending:new Set(),
    setProspectModalPending:v=>{ctx.prospectModalPending=!!v},renderGrowth(){},renderWebsiteAnalytics(){},Date,Number,String,Array,
    fetch:(url,options)=>{requests.push({url,options});return Promise.resolve({ok:true,json:async()=>({ok:true,prospect:{id:'p1',stage:'new',updatedAt:1}})})}
  });
  const start=source.indexOf('async function saveProspect('),end=source.indexOf('\nlet adminCampaignMutationPending=false;',start);
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,el,requests};
}

test('prospect identity fields describe shared validation without falsely requiring Name',()=>{
  assert.doesNotMatch(html,/id="prospectNameInput"[^>]*\srequired(?:\s|>)/);
  for(const id of ['prospectNameInput','prospectBusinessInput','prospectEmailInput','prospectPhoneInput','prospectMrrInput'])assert.match(html,new RegExp('id="'+id+'"[^>]*aria-describedby="prospectFormStatus"'));
});

test('prospect save rejects a blank identity before any request and focuses Name',async()=>{
  const f=prospectFixture();
  assert.equal(await vm.runInContext('saveProspect()',f.ctx),false);
  assert.equal(f.requests.length,0);
  assert.equal(f.el('prospectNameInput')['aria-invalid'],'true');
  assert.equal(f.el('prospectBusinessInput')['aria-invalid'],'true');
  assert.equal(f.el('prospectEmailInput')['aria-invalid'],'true');
  assert.equal(f.el('prospectPhoneInput')['aria-invalid'],'true');
  assert.equal(f.el('prospectNameInput').focused,true);
  assert.match(f.el('prospectFormStatus').textContent,/name, business, email, or phone/i);
});

test('prospect save rejects malformed email and negative monthly value locally',async()=>{
  const f=prospectFixture();f.el('prospectNameInput').value='Lead';f.el('prospectEmailInput').value='not-an-email';
  assert.equal(await vm.runInContext('saveProspect()',f.ctx),false);assert.equal(f.requests.length,0);assert.equal(f.el('prospectEmailInput').focused,true);assert.match(f.el('prospectFormStatus').textContent,/valid email/i);
  f.el('prospectEmailInput').value='lead@example.test';f.el('prospectMrrInput').value='-50';f.el('prospectEmailInput').focused=false;
  assert.equal(await vm.runInContext('saveProspect()',f.ctx),false);assert.equal(f.requests.length,0);assert.equal(f.el('prospectMrrInput').focused,true);assert.match(f.el('prospectFormStatus').textContent,/cannot be negative/i);
});

function documentFixture(){
  const elements=new Map();
  function el(id){if(!elements.has(id))elements.set(id,makeEl());return elements.get(id)}
  const modal=el('companyDocumentModal');modal.dataset.editId='';el('companyDocumentName').value='Policy';el('companyDocumentType').value='Insurance';el('companyDocumentStatus').value='active';
  const requests=[],ctx=vm.createContext({
    document:{getElementById:el},companyDocumentMutationPending:false,adminDocumentsData:{company:[]},
    setCompanyDocumentMutationPending(){},companyDocumentFeedback:(message)=>{el('companyDocumentStatusLine').textContent=message},renderDocuments(){},
    fetch:(url,options)=>{requests.push({url,options});return Promise.resolve({ok:true,json:async()=>({ok:true,document:{id:'d1'}})})},
    Number,String,Array,Date
  });
  const start=source.indexOf('async function saveCompanyDocument('),end=source.indexOf('\nasync function deleteCompanyDocument(',start);
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,el,requests};
}

test('company document rejects malformed link locally and focuses the URL field',async()=>{
  const f=documentFixture();f.el('companyDocumentUrl').value='not a url';
  assert.equal(await vm.runInContext('saveCompanyDocument()',f.ctx),false);
  assert.equal(f.requests.length,0);
  assert.equal(f.el('companyDocumentUrl')['aria-invalid'],'true');
  assert.equal(f.el('companyDocumentUrl').focused,true);
  assert.match(f.el('companyDocumentStatusLine').textContent,/http\(s\) URL or CallerCore path/i);
});
