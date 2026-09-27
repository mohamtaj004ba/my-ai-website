const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('function snapshotClientSupportThreadUi(wrap){');
const end=source.indexOf('function renderSupport(',start);
assert.ok(start>=0&&end>start,'support UI snapshot and restore helpers exist');

function ticket(id,{draft='',status='',open=false,disabled=false,start=0,end=start}={}){
  const input={value:draft,selectionStart:start,selectionEnd:end,focused:false,
    focus(){this.focused=true;context.document.activeElement=this},
    setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b}};
  const feedback={textContent:status},button={disabled,textContent:disabled?'Sending…':'Send reply'};
  const node={dataset:{supportTicketId:id},open,
    querySelector:q=>q==='[data-support-client-input]'?input:q==='[data-support-client-status]'?feedback:q==='[data-support-client-reply]'?button:null};
  return {node,input,feedback,button};
}
let context;
function fixture({pending=[]}={}){
  context=vm.createContext({document:{activeElement:null},clientSupportReplyPending:new Set(pending),Map,String,Math});
  vm.runInContext(source.slice(start,end),context);
  const wrap={children:[],querySelectorAll:()=>wrap.children.map(x=>x.node)};
  const capture=()=>vm.runInContext('snapshotClientSupportThreadUi(wrap)',Object.assign(context,{wrap}));
  const restore=(snap,clearDraftId='')=>vm.runInContext('restoreClientSupportThreadUi(wrap,snap,{clearDraftId})',Object.assign(context,{wrap,snap,clearDraftId}));
  return {wrap,capture,restore,context};
}
test('history repaint preserves two drafts, expanded ticket, feedback and focused selection',()=>{
  const h=fixture(),first=ticket('ticket-one',{draft:'Draft awaiting response',open:true,status:'Delivery was uncertain',start:6,end:13}),second=ticket('ticket-two',{draft:'Unrelated open draft',open:false});
  h.wrap.children=[first,second];h.context.document.activeElement=first.input;
  const snap=h.capture();
  const newFirst=ticket('ticket-one'),newSecond=ticket('ticket-two');
  h.wrap.children=[newFirst,newSecond];h.restore(snap);
  assert.equal(newFirst.node.open,true);
  assert.equal(newFirst.input.value,'Draft awaiting response');
  assert.equal(newFirst.feedback.textContent,'Delivery was uncertain');
  assert.equal(newFirst.input.focused,true);
  assert.deepEqual([newFirst.input.selectionStart,newFirst.input.selectionEnd],[6,13]);
  assert.equal(newSecond.input.value,'Unrelated open draft');
  assert.equal(newSecond.node.open,false);
});
test('pending send stays visibly locked even when refresh replaces its button',()=>{
  const h=fixture({pending:['ticket-one']});
  h.wrap.children=[ticket('ticket-one',{draft:'Do not lose me',open:true})];
  const snap=h.capture(),newTicket=ticket('ticket-one');
  h.wrap.children=[newTicket];h.restore(snap);
  assert.equal(newTicket.button.disabled,true);
  assert.equal(newTicket.button.textContent,'Sending…');
  assert.equal(newTicket.input.value,'Do not lose me');
});
test('confirmed reply clears only sent draft while retaining other ticket draft',()=>{
  const h=fixture(),one=ticket('one',{draft:'Sent reply',open:true,status:'Earlier status'}),two=ticket('two',{draft:'Unsent reply',open:true,status:'Retry needed'});
  h.wrap.children=[one,two];const snap=h.capture();
  const afterOne=ticket('one'),afterTwo=ticket('two');h.wrap.children=[afterOne,afterTwo];
  h.restore(snap,'one');
  assert.equal(afterOne.input.value,'');
  assert.equal(afterOne.feedback.textContent,'Reply sent.');
  assert.equal(afterOne.node.open,true);
  assert.equal(afterTwo.input.value,'Unsent reply');
  assert.equal(afterTwo.feedback.textContent,'Retry needed');
});
test('render and reply handler use snapshot restore and current live controls',()=>{
  assert.match(source,/const snapshots=snapshotClientSupportThreadUi\(wrap\)/);
  assert.match(source,/restoreClientSupportThreadUi\(wrap,snapshots,\{clearDraftId\}\)/);
  assert.match(source,/renderSupport\(\{clearDraftId:id\}\)/);
  assert.match(source,/clientSupportReplyPending\.delete\(id\);\s*finishClientSupportReply\(id,button\)/);
  assert.match(source,/if\(!r\.ok\)\{setClientSupportReplyStatus\(id,/);
});
