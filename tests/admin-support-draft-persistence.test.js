const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const uiStart=source.indexOf('const adminSupportThreadUi=new Map(),adminSupportReplyPending=new Set();');
const uiEnd=source.indexOf('function renderAdminSupport(',uiStart);
assert.ok(uiStart>=0&&uiEnd>uiStart,'admin support UI state helpers exist');
function thread(id,{draft='',open=false,status='',start=0,end=start}={}){
  const input={value:draft,selectionStart:start,selectionEnd:end,
    focus(){this.focused=true},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b}},
    feedback={textContent:status},button={disabled:false,textContent:'Send reply'};
  return {input,feedback,button,node:{open,dataset:{supportTicketId:id},
    querySelector:q=>q==='[data-support-admin-input]'?input:q==='[data-support-admin-status]'?feedback:q==='[data-support-admin-reply]'?button:null}};
}
function uiFixture(){
  const ctx=vm.createContext({Map,Set,String,Math});
  vm.runInContext(source.slice(uiStart,uiEnd),ctx);
  const wrap={children:[],querySelectorAll:()=>wrap.children.map(x=>x.node)};
  ctx.wrap=wrap;
  return {ctx,wrap,capture:()=>vm.runInContext('rememberAdminSupportThreadUi(wrap)',ctx),
    restore:(focused='')=>{ctx.focused=focused;vm.runInContext('restoreAdminSupportThreadUi(wrap,focused)',ctx)},
    clear:id=>{ctx.id=id;vm.runInContext('adminSupportThreadUi.delete(id)',ctx)}};
}
test('admin ticket search/status refresh retains reply draft expanded state and selection',()=>{
  const h=uiFixture(),old=thread('ticket-1',{draft:'Please send updated invoice',status:'Retry after reviewing',open:true,start:7,end:16});
  h.wrap.children=[old];h.capture();
  const fresh=thread('ticket-1');h.wrap.children=[fresh];h.restore('ticket-1');
  assert.equal(fresh.input.value,'Please send updated invoice');
  assert.equal(fresh.feedback.textContent,'Retry after reviewing');
  assert.equal(fresh.node.open,true);
  assert.equal(fresh.input.focused,true);
  assert.deepEqual([fresh.input.selectionStart,fresh.input.selectionEnd],[7,16]);
});
test('admin ticket draft survives temporary filtering out and subsequent return',()=>{
  const h=uiFixture(),old=thread('ticket-hidden',{draft:'Investigating this case',open:true});
  h.wrap.children=[old];h.capture();h.wrap.children=[];h.capture();
  const restored=thread('ticket-hidden');h.wrap.children=[restored];h.restore();
  assert.equal(restored.input.value,'Investigating this case');
  assert.equal(restored.node.open,true);
});
test('admin pending reply stays visibly locked after rerender and sent draft alone clears',()=>{
  const h=uiFixture(),a=thread('ticket-1',{draft:'Reply being sent',open:true}),b=thread('ticket-2',{draft:'Other unsent reply',open:true});
  h.wrap.children=[a,b];h.capture();vm.runInContext("adminSupportReplyPending.add('ticket-1')",h.ctx);
  h.clear('ticket-1');
  const updatedA=thread('ticket-1'),updatedB=thread('ticket-2');h.wrap.children=[updatedA,updatedB];h.restore();
  assert.equal(updatedA.input.value,'');
  assert.equal(updatedA.button.disabled,true);
  assert.equal(updatedA.button.textContent,'Sending…');
  assert.equal(updatedA.input.readOnly,true);
  assert.equal(updatedB.input.value,'Other unsent reply');
});
test('admin render harvests drafts and reply handler clears only confirmed ticket',()=>{
  assert.match(source,/rememberAdminSupportThreadUi\(wrap\)/);
  assert.match(source,/restoreAdminSupportThreadUi\(wrap,focusedReplyId\)/);
  assert.match(source,/renderAdminSupport\(\{clearDraftId:key\}\)/);
  assert.match(source,/if\(!r\.ok\)\{setAdminSupportReplyStatus\(key,/);
  assert.match(source,/adminSupportReplyPending\.delete\(key\);\s*finishAdminSupportReply\(key,button\)/);
  assert.match(source,/data-support-admin-status/);
});
