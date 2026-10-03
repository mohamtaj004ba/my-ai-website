const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('async function openInboxItem('),end=source.indexOf('\nfunction inboxContactParts(',start);
assert.ok(start>=0&&end>start,'inbox item opener exists');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function fixture(){
  const pending=deferred(),renders=[];
  const original={id:'gmail-one',unread:true,messages:[{direction:'inbound',body:'Hello'}]};
  const ctx=vm.createContext({
    adminInboxOpenRequest:0,currentInboxItem:null,
    adminInboxData:{gmailStatus:{connected:true},gmail:{threads:[original],analytics:{unread:1}},readError:'',aliasError:''},
    fetch:()=>pending.promise,JSON,String,Error,
    setAdminInboxActionStatus:()=>{},
    renderInboxThread:()=>renders.push('thread'),renderAdminInbox:()=>renders.push('inbox')
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,pending,renders,open:()=>vm.runInContext("openInboxItem('gmail','gmail-one')",ctx)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('failed Gmail read sync does not double-count unread after a newer inbox snapshot arrives',async()=>{
  const f=fixture();await f.open();
  f.ctx.adminInboxData.gmail={threads:[{id:'gmail-one',unread:true,messages:[]}],analytics:{unread:1}};
  f.pending.resolve({ok:false,json:async()=>({error:'failed'})});await tick();
  assert.equal(f.ctx.adminInboxData.gmail.analytics.unread,1);
  assert.equal(f.ctx.adminInboxData.gmail.threads[0].unread,true);
  assert.match(f.ctx.adminInboxData.readError,/remains unread/);
});

test('successful Gmail read sync applies to the current thread snapshot, not an obsolete object',async()=>{
  const f=fixture();await f.open();
  const replacement={id:'gmail-one',unread:true,messages:[]};
  f.ctx.adminInboxData.gmail={threads:[replacement,{id:'other',unread:true}],analytics:{unread:2}};
  f.pending.resolve({ok:true,json:async()=>({ok:true})});await tick();
  assert.equal(replacement.unread,false);
  assert.equal(f.ctx.adminInboxData.gmail.analytics.unread,1);
  assert.equal(f.ctx.adminInboxData.readError,'');
});

test('late Gmail read response after disconnect cannot mutate disconnected inbox state',async()=>{
  const f=fixture();await f.open();
  f.ctx.adminInboxData.gmailStatus={connected:false};f.ctx.adminInboxData.gmail={threads:[],analytics:{unread:0}};f.ctx.adminInboxData.readError='';
  f.pending.resolve({ok:false,json:async()=>({error:'failed'})});await tick();
  assert.equal(f.ctx.adminInboxData.gmail.threads.length,0);
  assert.equal(f.ctx.adminInboxData.gmail.analytics.unread,0);
  assert.equal(f.ctx.adminInboxData.readError,'');
});

test('live Gmail refresh always revalidates sender aliases and surfaces stale alias fallback',()=>{
  assert.match(source,/fetch\('\/api\/account\?action=admin-gmail-aliases'/);
  assert.match(source,/aliasPayload\.stale===true\?'Gmail sender aliases could not refresh/);
  assert.match(source,/previously loaded From addresses are shown/);
});
