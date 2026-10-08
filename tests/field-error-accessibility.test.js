const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf("function settingsFieldError(");
const end=source.indexOf("\nfunction normalizePhone(",start);
assert.ok(start>=0&&end>start);

function fixture(initialDescribed=''){
  const noteHost={children:[],querySelector(selector){return selector==='.field-error'?this.children.find(x=>x.className==='field-error')||null:null},appendChild(node){this.children.push(node)}};
  const input={
    attrs:{},classList:{toggle(name,on){this[name]=on}},
    closest(){return noteHost},parentElement:noteHost,
    setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]||''},removeAttribute(k){delete this.attrs[k]}
  };
  if(initialDescribed)input.attrs['aria-describedby']=initialDescribed;
  const document={getElementById:id=>id==='settingsPrimaryEmail'?input:null,createElement:()=>({className:'',id:'',textContent:'',hidden:false})};
  const ctx=vm.createContext({document,Set,String});
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,input,noteHost};
}

test('field errors create an owned description and mark the control invalid',()=>{
  const f=fixture();
  vm.runInContext("settingsFieldError('settingsPrimaryEmail','Enter a valid email.')",f.ctx);
  assert.equal(f.input.attrs['aria-invalid'],'true');
  assert.equal(f.input.attrs['aria-describedby'],'settingsPrimaryEmailError');
  assert.equal(f.noteHost.children.length,1);
  assert.equal(f.noteHost.children[0].id,'settingsPrimaryEmailError');
  assert.equal(f.noteHost.children[0].textContent,'Enter a valid email.');
});

test('field errors preserve existing descriptions and remove only their own id when cleared',()=>{
  const f=fixture('settingsFormStatus');
  vm.runInContext("settingsFieldError('settingsPrimaryEmail','Enter a valid email.')",f.ctx);
  assert.equal(f.input.attrs['aria-describedby'],'settingsFormStatus settingsPrimaryEmailError');
  vm.runInContext("settingsFieldError('settingsPrimaryEmail','')",f.ctx);
  assert.equal(f.input.attrs['aria-invalid'],'false');
  assert.equal(f.input.attrs['aria-describedby'],'settingsFormStatus');
  assert.equal(f.noteHost.children[0].hidden,true);
});
