const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('function setAdminSupportReplyStatus(id,message){'),end=source.indexOf('async function updateSupportStatus(',start);
assert.ok(start>=0&&end>start,'admin support reply actions found');
function harness(fetcher){
  const input={value:'Unsent admin response',readOnly:false},feedback={textContent:''},button={disabled:false,textContent:'Send reply'},thread={open:false};
  const records=[{id:'ticket-1',subject:'Support issue'}];let renders=0;
  const context=vm.createContext({
    document:{querySelector:q=>q.includes('[data-support-admin-input')?input:q.includes('[data-support-admin-status')?feedback:q.includes('[data-support-admin-reply')?button:q.includes('[data-support-ticket-id')?thread:null},
    CSS:{escape:x=>x},adminSupportReplyPending:new Set(),adminSupportData:records,
    fetch:fetcher,renderAdminSupport:()=>{renders++},loadNotifications:async()=>{},
    Promise,String,JSON,Error
  });
  context.button=button;vm.runInContext(source.slice(start,end),context);
  return {context,input,feedback,button,thread,records,rendered:()=>renders,send:()=>vm.runInContext("replyAdminSupportTicket('ticket-1',button)",context)};
}
function response(ticket,status=200){return {ok:status<400,json:async()=>({ok:status<400,ticket})}}
test('admin send locks draft and suppresses concurrent duplicate POSTs',async()=>{
  let release,count=0;
  const pending=new Promise(resolve=>{release=resolve});
  const h=harness(async()=>{count++;return pending});
  const first=h.send(),second=h.send();await second;
  assert.equal(count,1);assert.equal(h.input.readOnly,true);assert.equal(h.button.disabled,true);
  release(response({id:'ticket-1',messages:[{body:'saved'}]}));await first;
  assert.equal(h.input.readOnly,false);assert.equal(h.button.disabled,false);
  assert.equal(h.records[0].messages[0].body,'saved');
  assert.equal(h.thread.open,true);
  assert.equal(h.rendered(),1);
});
test('failed admin reply restores current control and keeps the unsent draft',async()=>{
  const h=harness(async()=>{throw Error('network')});
  await h.send();
  assert.equal(h.input.value,'Unsent admin response');
  assert.equal(h.input.readOnly,false);
  assert.equal(h.button.disabled,false);
  assert.match(h.feedback.textContent,/Check ticket history before retrying/);
  assert.equal(h.rendered(),0);
});
test('mismatched admin reply payload cannot silently change another ticket',async()=>{
  const h=harness(async()=>response({id:'different-ticket'}));
  await h.send();
  assert.equal(h.records[0].subject,'Support issue');
  assert.match(h.feedback.textContent,/Could not confirm the reply/);
  assert.equal(h.input.readOnly,false);
  assert.equal(h.button.disabled,false);
});
