const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','modal-accessibility.js'),'utf8');

function fixture(){
  let observerCallback,keydown,open=false,hidden='true';
  const trigger={isConnected:true,focus(){document.activeElement=this}},title={id:''};
  const close={hidden:false,isConnected:true,focus(){document.activeElement=this},closest(){return null},click(){open=false;hidden='true';observerCallback()}};
  const field={hidden:false,isConnected:true,focus(){document.activeElement=this},closest(){return null}};
  const modal={id:'testModal',tabIndex:0,attrs:{},classList:{contains:name=>name==='open'&&open},contains:value=>value===close||value===field||value===modal,
    setAttribute(key,value){this.attrs[key]=String(value)},getAttribute:key=>key==='aria-hidden'?hidden:modal.attrs[key],querySelector:q=>q==='h1,h2,h3'?title:q.includes('.modal-close')?close:null,
    querySelectorAll:()=>[close,field],addEventListener(type,fn){if(type==='keydown')keydown=fn},focus(){document.activeElement=this}};
  const document={activeElement:trigger,body:{},querySelectorAll:selector=>{assert.match(selector,/call-drawer/);assert.match(selector,/onboarding-detail-drawer/);return [modal]}};
  class MutationObserver{constructor(callback){observerCallback=callback}observe(){}}
  vm.runInNewContext(source,{document,MutationObserver,queueMicrotask:fn=>fn(),WeakMap});
  return {document,modal,trigger,close,field,open(){open=true;hidden='false';observerCallback()},keydown:event=>keydown({currentTarget:modal,preventDefault(){event.prevented=true},stopPropagation(){event.stopped=true},...event})};
}

test('shared client and admin modals expose dialog names and modal semantics',()=>{
  const f=fixture();assert.equal(f.modal.attrs.role,'dialog');assert.equal(f.modal.attrs['aria-modal'],'true');assert.equal(f.modal.attrs['aria-labelledby'],'testModal-title');assert.equal(f.modal.tabIndex,-1);
  for(const file of ['dashboard.html','admin-dashboard.html'])assert.match(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),/modal-accessibility\.js/);
});

test('opening focuses the first control and closing returns focus to the trigger',()=>{
  const f=fixture();f.open();assert.strictEqual(f.document.activeElement,f.close);f.close.click();assert.strictEqual(f.document.activeElement,f.trigger);
});

test('Tab is trapped inside an open modal and Escape uses its guarded close control',()=>{
  const f=fixture();f.open();f.document.activeElement=f.field;const tab={key:'Tab'};f.keydown(tab);assert.equal(tab.prevented,true);assert.strictEqual(f.document.activeElement,f.close);
  const escape={key:'Escape'};f.keydown(escape);assert.equal(escape.prevented,true);assert.equal(escape.stopped,true);assert.strictEqual(f.document.activeElement,f.trigger);
});
