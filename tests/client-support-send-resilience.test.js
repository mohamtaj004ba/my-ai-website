const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');
const start=source.indexOf('let clientSupportSubmitPending=false,clientSupportReplyPending=new Set();');
const end=source.indexOf("document.getElementById('submitSupportButton')?.addEventListener",start);
assert.ok(start>=0&&end>start,'support form actions found');
function fixture(fetcher){
  const fields={
    supportSubject:{value:'Need assistance'},
    supportMessage:{value:'Request details that should be preserved'},
    supportPriority:{value:'normal'},
    supportStatus:{textContent:''},
    submitSupportButton:{disabled:false,textContent:'Send support request'}
  };
  const input={value:'This reply should remain available'};
  const replyStatus={textContent:''},replyButton={disabled:false,textContent:'Send reply'},thread={open:false};
  let renders=0,invalidations=0;
  const ctx=vm.createContext({
    document:{
      getElementById:id=>fields[id]||null,
      querySelector:q=>q.includes('data-support-client-input')?input:q.includes('data-support-client-status')?replyStatus:q.includes('data-support-ticket-id')?thread:null
    },
    CSS:{escape:v=>v},supportTicketsData:[{id:'ticket-1',subject:'Prior message'}],
    invalidateClientSupportHistoryRequest:()=>{invalidations++},
    renderSupport:()=>{renders++},loadNotifications:async()=>{},
    fetch:fetcher,Promise,JSON,String,Set,Error
  });
  ctx.button=replyButton;
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,fields,input,replyStatus,replyButton,thread,submit:()=>vm.runInContext('submitSupportTicket()',ctx),reply:()=>vm.runInContext("replyClientSupportTicket('ticket-1',button)",ctx),renders:()=>renders,invalidations:()=>invalidations};
}
function ok(data,status=200){return {ok:status<400,json:async()=>data}}
test('network failure preserves new support request and re-enables button for retry',async()=>{
  let fail=true,fetches=0;
  const f=fixture(async()=>{fetches++;if(fail)throw Error('network down');return ok({ticket:{id:'new-ticket'}},201)});
  await f.submit();
  assert.equal(f.fields.submitSupportButton.disabled,false);
  assert.equal(f.fields.supportSubject.value,'Need assistance');
  assert.equal(f.fields.supportMessage.value,'Request details that should be preserved');
  assert.match(f.fields.supportStatus.textContent,/Check request history before retrying/);
  assert.equal(f.renders(),0);
  fail=false;
  await f.submit();
  assert.equal(fetches,2);
  assert.equal(f.fields.supportSubject.value,'');
  assert.equal(f.fields.supportMessage.value,'');
  assert.equal(f.ctx.supportTicketsData[0].id,'new-ticket');
  assert.equal(f.fields.supportStatus.textContent,'Support request sent.');
});
test('double submit during pending request sends only one POST',async()=>{
  let release,count=0;
  const pending=new Promise(resolve=>{release=resolve});
  const f=fixture(async()=>{count++;return pending});
  const a=f.submit(),b=f.submit();
  await b;
  assert.equal(count,1);
  release(ok({ticket:{id:'created'}},201));
  await a;
  assert.equal(f.fields.submitSupportButton.disabled,false);
  assert.equal(f.ctx.supportTicketsData.length,2);
});
test('reply network failure retains typed draft and retry succeeds',async()=>{
  let fail=true,count=0;
  const f=fixture(async()=>{count++;if(fail)throw Error('network down');return ok({ticket:{id:'ticket-1',messages:[{body:'This reply should remain available'}]}})});
  await f.reply();
  assert.equal(f.replyButton.disabled,false);
  assert.equal(f.input.value,'This reply should remain available');
  assert.match(f.replyStatus.textContent,/Check request history before retrying/);
  assert.equal(f.renders(),0);
  fail=false;
  await f.reply();
  assert.equal(count,2);
  assert.equal(f.ctx.supportTicketsData[0].messages.length,1);
  assert.equal(f.thread.open,true);
});
test('malformed successful reply never claims saved state',async()=>{
  const f=fixture(async()=>ok({ok:true}));
  await f.reply();
  assert.equal(f.ctx.supportTicketsData[0].subject,'Prior message');
  assert.match(f.replyStatus.textContent,/Could not confirm the reply/);
  assert.equal(f.replyButton.disabled,false);
});
test('support form and per-ticket reply statuses are accessible',()=>{
  assert.match(html,/id="supportStatus" role="status" aria-live="polite"/);
  assert.match(source,/data-support-client-status/);
});
