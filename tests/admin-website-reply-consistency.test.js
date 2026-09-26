const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function adminWebsiteReply('),end=source.indexOf('async function adminWebsiteAnalytics(',start);
assert.ok(start>=0&&end>start);
function fixture({appendFails=false,conflicts=0,storageFails=false}={}){
  const original={id:'lead-1',email:'lead@example.test',stage:'new',notes:'Keep this',updatedAt:10};
  let emails=0,appends=0,commits=0,status,payload;
  const ctx=vm.createContext({
    req:{body:{id:'lead-1',message:'Hello from support'}},
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
  return {run:async()=>{await vm.runInContext('adminWebsiteReply(req,res)',ctx);return {emails,appends,commits,status,payload}}};
}
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
