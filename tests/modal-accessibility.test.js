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


test('dynamic operational status text uses polite live regions across client and admin surfaces',()=>{
  const client=fs.readFileSync(path.join(__dirname,'..','dashboard.html'),'utf8');
  const admin=fs.readFileSync(path.join(__dirname,'..','admin-dashboard.html'),'utf8');
  assert.match(client,/id="callsReadCoverage" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(admin,/id="growthCoverageNote" class="muted" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(admin,/id="adminAiStatus" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(admin,/id="adminAuditCoverage" role="status" aria-live="polite" aria-atomic="true"/);
});


test('dashboard navigation exposes current page and mobile menu expansion state',()=>{
  const dashboard=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  assert.match(dashboard,/setAttribute\('aria-current','page'\)/);
  assert.match(dashboard,/removeAttribute\('aria-current'\)/);
  assert.match(dashboard,/menu\.setAttribute\('aria-expanded','false'\)/);
  assert.match(dashboard,/e\.currentTarget\.setAttribute\('aria-expanded',String\(open\)\)/);
});


test('client and admin mobile navigation triggers declare the controlled sidebar and initial state',()=>{
  for(const file of ['dashboard.html','admin-dashboard.html']){
    const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    assert.match(html,/id="dashboardSidebar"/);
    assert.match(html,/class="mobile-menu" type="button" aria-label="Toggle navigation" aria-controls="dashboardSidebar" aria-expanded="false"/);
    assert.match(html,/class="nav-item active" data-view="overview" aria-current="page"/);
  }
});


test('popover triggers identify their controlled panels and Escape restores trigger focus',()=>{
  const client=fs.readFileSync(path.join(__dirname,'..','dashboard.html'),'utf8');
  const admin=fs.readFileSync(path.join(__dirname,'..','admin-dashboard.html'),'utf8');
  assert.match(client,/id="helpButton"[^>]*aria-controls="helpPanel"/);
  for(const html of [client,admin]){
    assert.match(html,/id="notificationBell"[^>]*aria-controls="notificationPanel"/);
    assert.match(html,/id="accountButton"[^>]*aria-controls="accountPanel"/);
  }
  const dashboard=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  assert.match(dashboard,/Escape'&&!panel\.hidden[\s\S]*button\.focus\(\)/);
  assert.match(dashboard,/helpWasOpen[\s\S]*helpButton\?\.focus\(\)/);
  assert.match(dashboard,/nb\?\.focus\(\)/);
});


test('remaining admin asynchronous status text uses polite live regions',()=>{
  const admin=fs.readFileSync(path.join(__dirname,'..','admin-dashboard.html'),'utf8');
  assert.match(admin,/id="inboxThreadCoverage" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(admin,/id="inboxReplyStatus" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(admin,/id="financeReconciliationStatus" role="status" aria-live="polite" aria-atomic="true"/);
});


test('platform settings section navigation exposes current state',()=>{
  const dashboard=fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8');
  assert.match(dashboard,/data-settings-jump[\s\S]*setAttribute\('aria-current',selected\?'true':'false'\)/);
});
