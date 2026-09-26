const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('api/account.js','utf8');
const code=source.slice(source.indexOf('async function adminSavePhoneNumber('),source.indexOf('async function adminDeletePhoneNumber('));
async function rejected(current,body){
  let result,status=200;
  const ctx=vm.createContext({requireAdmin:async()=>({email:'qa@test.invalid'}),crypto:{randomUUID:()=> 'new'},process:{env:{}},kv:{get:async()=>current,set:()=>assert.fail('Rejected edit must not write')},req:{body:{number:'5095550999',...body}},res:{status(n){status=n;return this},json(x){result=x}}});
  vm.runInContext(code,ctx);await vm.runInContext('adminSavePhoneNumber(req,res)',ctx);return {result,status};
}
test('phone edit rejects a deleted record instead of recreating it',async()=>{assert.equal((await rejected([],{id:'missing'})).status,404)});
test('full phone inventory refuses new records without truncating existing ones',async()=>{assert.equal((await rejected(Array.from({length:500},(_,i)=>({id:String(i)})),{})).status,409)});
test('malformed inventory and stale revisions fail closed',async()=>{
  assert.equal((await rejected({broken:true},{})).status,503);
  assert.equal((await rejected([{id:'p',updatedAt:10}],{id:'p',expectedUpdatedAt:9})).status,409);
});
test('phone inventory renders batches and searches formatted phone numbers',()=>{
  const js=fs.readFileSync('dashboard.js','utf8'),nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,querySelectorAll:()=>[],querySelector:()=>null});return nodes.get(id)};
  const ctx=vm.createContext({phoneVisibleLimit:50,phoneFilterSignature:'',adminPhoneData:Array.from({length:125},(_,i)=>({id:String(i),number:'(509) 555-'+String(i).padStart(4,'0'),workspaceId:i%2?'ws':'',workspaceName:'Customer '+i})),esc:x=>String(x??''),document:{getElementById:node}});
  vm.runInContext(js.slice(js.indexOf('function renderPhones(){'),js.indexOf("document.getElementById('phoneSearch')?.addEventListener")),ctx);
  vm.runInContext('renderPhones()',ctx);assert.equal(node('phoneListCount').textContent,'Showing 50 of 125 numbers');
  ctx.phoneVisibleLimit=100;vm.runInContext('renderPhones()',ctx);assert.equal(node('phoneListCount').textContent,'Showing 100 of 125 numbers');
  node('phoneSearch').value='5095550124';vm.runInContext('renderPhones()',ctx);assert.equal(node('phoneListCount').textContent,'Showing 1 of 1 numbers matching filters');assert.equal(ctx.phoneVisibleLimit,50);
});
test('successful phone save updates local revision before allowing the modal to reopen',async()=>{
  const js=fs.readFileSync('dashboard.js','utf8'),nodes=new Map();
  for(const [id,value] of Object.entries({phoneNumberInput:'5095550100',phoneLabelInput:'New label',phoneProviderInput:'Vapi',phoneWorkspaceInput:'tenant',phoneTransferInput:'',phoneForwardingInput:'',phoneAfterHoursInput:'ai'}))nodes.set(id,{value});
  nodes.set('phoneModal',{dataset:{editId:'p',expectedUpdatedAt:'10'}});
  const record={id:'p',label:'New label',updatedAt:11};let closedWith,finishRefresh;
  const ctx=vm.createContext({phoneSaving:false,adminPhoneData:[{id:'p',label:'Old label',updatedAt:10}],document:{getElementById:id=>nodes.get(id)},validUsPhone:()=>true,settingsFieldError:()=>{},normalizePhone:x=>x,lockFormControls:()=>()=>{},fetch:async()=>({ok:true,json:async()=>({number:record})}),renderPhones:()=>{},closePhoneModal:()=>{closedWith={...ctx.adminPhoneData[0]}},refreshAdminView:()=>new Promise(resolve=>finishRefresh=resolve)});
  vm.runInContext(js.slice(js.indexOf('async function savePhone(){'),js.indexOf("document.getElementById('addPhoneButton')")),ctx);
  const pending=vm.runInContext('savePhone()',ctx);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closedWith.label,'New label');assert.equal(closedWith.updatedAt,11);assert.equal(ctx.phoneSaving,false);
  finishRefresh();await pending;
});
