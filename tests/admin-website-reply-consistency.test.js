const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function adminWebsiteReply('),end=source.indexOf('async function adminWebsiteAnalytics(',start);
assert.ok(start>=0&&end>start);
function fixture({appendFails=false,conflicts=0,storageFails=false,prospect}={}){
  const original=prospect===undefined?{id:'lead-1',email:'lead@example.test',stage:'new',notes:'Keep this',updatedAt:10}:prospect;
  let emails=0,appends=0,commits=0,status,payload;
  const ctx=vm.createContext({
    req:{body:{id:'lead-1',message:'Hello from support',expectedRecipientEmail:'lead@example.test'}},
    res:{status(n){status=n;return this},json(v){payload=v;return v}},
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async()=>({...original}),set:()=>{throw Error('Reply must not use an unsafe prospect SET')}},
    getGmailConnection:async()=>null,sendMail:async()=>{emails++},
    appendSiteConversation:async(_kv,id,item)=>{appends++;if(appendFails)throw Error('history failure');assert.equal(id,'lead-1');assert.equal(item.body,'Hello from support');return 1},
    compareAndSetConfig:async(_kv,updates)=>{commits++;assert.equal(updates[0].before.notes,'Keep this');if(storageFails)throw Error('storage failure');return commits>conflicts},
    crypto:{randomUUID:()=> 'reply-uuid'},Date:{now:()=>20},Number,String,Array,
    safeError:()=> 'redacted',console:{error(){}}
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,run:async()=>{await vm.runInContext('adminWebsiteReply(req,res)',ctx);return {emails,appends,commits,status,payload}}};
}

test('website Gmail replies bind alias validation and provider send to the same observed mailbox',async()=>{
  const f=fixture();let sends=0;
  f.ctx.cleanEmail=value=>String(value||'').trim().toLowerCase();
  f.ctx.getGmailConnection=async()=>({gmailEmail:'Observed@example.test'});
  f.ctx.validatedGmailFrom=async(_admin,_from,expected)=>{assert.equal(expected,'observed@example.test');return expected};
  f.ctx.sendGmailMessage=async(_admin,body)=>{sends++;assert.equal(body.expectedGmailEmail,'observed@example.test');return {id:'sent',threadId:'thread'}};
  const result=await f.run();assert.equal(result.status,200);assert.equal(result.payload.message.channel,'gmail');assert.equal(sends,1);assert.equal(result.emails,0);
});
test('website Gmail account change during sender validation blocks send and Mailgun fallback',async()=>{
  const f=fixture();
  f.ctx.cleanEmail=value=>String(value||'').trim().toLowerCase();f.ctx.getGmailConnection=async()=>({gmailEmail:'observed@example.test'});
  f.ctx.validatedGmailFrom=async()=>{throw Object.assign(Error('Gmail connection changed'),{code:'GMAIL_CONNECTION_CHANGED'})};
  f.ctx.sendGmailMessage=async()=>assert.fail('Changed account must not send');
  const result=await f.run();assert.equal(result.status,502);assert.equal(result.emails,0);assert.equal(result.appends,0);assert.equal(result.commits,0);
});
test('missing or changed displayed website recipient blocks every provider and history write',async()=>{
  for(const expectedRecipientEmail of [undefined,'','different@example.test']){
    const f=fixture();f.ctx.req.body.expectedRecipientEmail=expectedRecipientEmail;
    f.ctx.getGmailConnection=async()=>assert.fail('Unverified recipient must not resolve a delivery provider');
    const result=await f.run();assert.equal(result.status,409);assert.match(result.payload.error,/recipient changed or could not be verified/);
    assert.equal(result.emails,0);assert.equal(result.appends,0);assert.equal(result.commits,0);
  }
});
test('uncertain website provider delivery reports review scope without claiming send failure or saving invented history',async()=>{
  const f=fixture();f.ctx.sendMail=async()=>{throw Object.assign(Error('Acknowledgement lost'),{deliveryState:'uncertain'})};
  const result=await f.run();assert.equal(result.status,502);assert.equal(result.payload.retrySafe,false);assert.equal(result.payload.deliveryStatus,'uncertain');assert.match(result.payload.error,/Review the delivery provider.*duplicate mail/);assert.equal(result.appends,0);assert.equal(result.commits,0);
});
test('sent website reply appends to history and revises prospect without overwriting later edits',async()=>{
  const r=await fixture().run();
  assert.equal(r.emails,1);assert.equal(r.appends,1);assert.equal(r.commits,1);
  assert.equal(r.status,200);assert.equal(r.payload.ok,true);
  assert.equal(r.payload.prospect.notes,'Keep this');
  assert.equal(r.payload.prospect.stage,'follow_up');
  assert.equal(r.payload.prospect.updatedAt,20);
});
test('history failure after provider send returns a sent warning, not a misleading mail failure',async()=>{
  const r=await fixture({appendFails:true}).run();
  assert.equal(r.emails,1);assert.equal(r.appends,1);assert.equal(r.commits,0);
  assert.equal(r.status,200);assert.equal(r.payload.ok,true);
  assert.match(r.payload.warning,/Reply sent/);
});
test('concurrent status edits retry from fresh record, without resending the email',async()=>{
  const r=await fixture({conflicts:2}).run();
  assert.equal(r.status,200);assert.equal(r.emails,1);assert.equal(r.appends,1);
  assert.equal(r.commits,3);assert.equal(r.payload.prospect.stage,'follow_up');
});
test('uncertain prospect status after sending keeps confirmed reply and reports refresh warning',async()=>{
  const r=await fixture({storageFails:true}).run();
  assert.equal(r.status,200);assert.equal(r.emails,1);assert.equal(r.appends,1);
  assert.match(r.payload.warning,/Reply sent and saved/);
});

test('admin inbox shows a confirmed-send warning after rendering and retains lead details',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const start=ui.indexOf('async function sendInboxReply('),end=ui.indexOf('async function ',start+10);
  assert.ok(start>=0&&end>start);
  const handler=ui.slice(start,end);
  assert.match(handler,/deliveryWarning=data\.warning\|\|''/);
  assert.match(handler,/if\(data\.prospect\)replyItem\.prospect=data\.prospect/);
  assert.match(handler,/if\(p&&data\.prospect\)Object\.assign/);
  assert.ok(handler.indexOf('renderInboxThread();')<handler.indexOf("status.textContent=deliveryWarning||'Reply sent.'"));
});


test('malformed prospect identity blocks website reply before any provider send',async()=>{
  for(const prospect of ['broken',[],{id:'different',email:'lead@example.test'}]){
    const r=await fixture({prospect}).run();
    assert.equal(r.status,503);assert.equal(r.emails,0);assert.equal(r.appends,0);assert.equal(r.commits,0);
    assert.match(r.payload.error,/Prospect record is unavailable/);
  }
});


test('admin inbox reply serializes sends and requires canonical website/Gmail receipts',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const start=ui.indexOf('async function sendInboxReply('),end=ui.indexOf('\nlet gmailConnectionMutationPending=',start),handler=ui.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(handler,/adminInboxReplyPending/);
  assert.match(handler,/if\(!currentInboxItem\|\|adminInboxReplyPending\)return false/);
  assert.match(handler,/data\.ok!==true\|\|!data\.message/);
  assert.match(handler,/String\(data\.message\.body\|\|'\'\)!==message/);
  assert.match(handler,/data\.ok!==true\|\|!String\(data\.threadId\|\|'\'\)\.trim\(\)/);
  assert.match(handler,/finally\{adminInboxReplyPending=false/);
  assert.match(handler,/field\.readOnly=false/);
});
