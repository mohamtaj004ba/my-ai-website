const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
const start=api.indexOf('async function adminGmailSend('),end=api.indexOf('async function adminWebsiteConversation(',start);
assert.ok(start>=0&&end>start);
function fixture({conflicts=0,fail=false,lookup='lead-1',stored}={}){
  let sends=0,updates=0,sets=0,code,data;
  const record={id:'lead-1',stage:'inquiry',email:'lead@example.test',notes:'Keep this',updatedAt:10};
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    req:{body:{to:'lead@example.test',subject:'Re: Inquiry',body:'Following up'}},
    res:{status(n){code=n;return this},json(x){data=x;return x}},
    getGmailConnection:async()=>({}),validatedGmailFrom:async()=> 'admin@example.test',
    sendGmailMessage:async()=>{sends++;return {id:'gmail-1',threadId:'thread-1'}},
    kv:{get:async key=>key.startsWith('site:prospect:email:')?lookup:key==='site:prospect:lead-1'?(stored===undefined?{...record}:stored):null,
      set:async()=>{sets++;throw Error('Must not overwrite prospect with plain SET')}},
    compareAndSetConfig:async(_kv,changes)=>{updates++;assert.equal(changes[0].before.notes,'Keep this');if(fail)throw Error('provider failure');return updates>conflicts},
    emailKey:s=>s,cleanEmail:s=>String(s||'').trim().toLowerCase(),crypto:{randomUUID:()=> 'id'},Date:{now:()=>20},
    String,Number,Array,Math,console:{error(){}},safeError:()=> 'redacted'
  });
  vm.runInContext(api.slice(start,end),ctx);
  return {run:async()=>{await vm.runInContext('adminGmailSend(req,res)',ctx);return {sends,updates,sets,code,data}}};
}
test('Gmail send reconciles prospect with revision checks without overwriting notes',async()=>{
  const r=await fixture().run();
  assert.equal(r.code,200);assert.equal(r.sends,1);assert.equal(r.updates,1);assert.equal(r.sets,0);
  assert.equal(r.data.warning,'');
});
test('Gmail follow-up conflicts retry without resending the original email',async()=>{
  const r=await fixture({conflicts:2}).run();
  assert.equal(r.code,200);assert.equal(r.sends,1);assert.equal(r.updates,3);
});
test('Gmail sent but follow-up persistence uncertain returns success plus warning',async()=>{
  const r=await fixture({fail:true}).run();
  assert.equal(r.code,200);assert.equal(r.sends,1);assert.equal(r.updates,1);
  assert.match(r.data.warning,/Gmail message sent/);
});
test('inbox renders provider-confirmed Gmail warning instead of clearing it',()=>{
  const segment=ui.slice(ui.indexOf('async function sendInboxReply('),ui.indexOf('async function ',ui.indexOf('async function sendInboxReply(')+10));
  assert.match(segment,/deliveryWarning=data\.warning\|\|''/);
  assert.ok(segment.indexOf('renderInboxThread();')<segment.indexOf("status.textContent=deliveryWarning||'Reply sent.'"));
});


test('Gmail send never treats a missing or mismatched Growth record as confirmed follow-up state',async()=>{
  for(const stored of [null,'broken',[],{id:'other',email:'lead@example.test',stage:'inquiry'},{id:'lead-1',email:'different@example.test',stage:'inquiry'}]){
    const r=await fixture({stored}).run();
    assert.equal(r.code,200);assert.equal(r.sends,1);assert.equal(r.updates,0);
    assert.match(r.data.warning,/Gmail message sent/);
  }
});

test('Gmail send warns when the email-to-prospect lookup itself is malformed',async()=>{
  for(const lookup of [{bad:true},[],42]){
    const r=await fixture({lookup}).run();
    assert.equal(r.code,200);assert.equal(r.sends,1);assert.equal(r.updates,0);
    assert.match(r.data.warning,/linked Growth record could not be verified/);
  }
});
