const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');

function fixture(which,{commit=true,now=10,status='open'}={}){
  const ticket={id:'ticket-1',workspaceId:'workspace-1',status,updatedAt:10,createdAt:1,messages:[{id:'old',direction:'client',body:'Initial request'}],email:''};
  let code=0,result,changed,changedAudit,notifications=0;
  const context=vm.createContext({
    requireWritableSession:async()=>({workspaceId:'workspace-1',email:'owner@example.test'}),
    requireAdmin:async()=>({email:'admin@example.test'}),
    req:{body:{id:'ticket-1',message:'Please follow up'}},
    res:{status(n){code=n;return this},json(x){result=x;return x}},
    kv:{get:async key=>key==='support:ticket-1'?ticket:null,set:()=>assert.fail('Support reply must not overwrite a ticket without a revision check')},
    compareAndSetConfig:async(_,updates)=>{changed=updates[0];if(commit==='error')throw Error('network');return commit},
    compareAndAudit:async(_,update,auditKey,event)=>{changed=update;changedAudit={auditKey,event};if(commit==='error')throw Error('network');return commit},
    crypto:{randomUUID:()=> 'reply-1'},Date:{now:()=>now},Math,Number,String,
    process:{env:{}},sendMail:async()=>{notifications++},safeError:()=>'',console:{error(){}}
  });
  const fn=which==='admin'?'adminSupportReply':'replySupportTicket';
  const start=source.indexOf('async function '+fn+'('),end=source.indexOf('\nasync function ',start+1);
  assert.ok(start>=0&&end>start);
  vm.runInContext(source.slice(start,end),context);
  return {ticket,run:async()=>{await vm.runInContext(fn+'(req,res)',context);return {code,result,changed,changedAudit,notifications,ticket}}};
}

for(const which of ['client','admin']){
  test(which+' support reply commits a single revision-checked ticket retaining the old thread',async()=>{
    const r=await fixture(which).run();
    assert.equal(r.code,200);
    assert.equal(r.changed.key,'support:ticket-1');
    assert.equal(r.changed.before.messages.length,1);
    assert.equal(r.changed.after.messages.length,2);
    assert.equal(r.changed.after.messages[1].body,'Please follow up');
    assert.equal(r.changed.after.updatedAt,11);
    assert.equal(r.ticket.messages.length,1,'the original object must not be edited before transaction');
    assert.equal(r.result.ticket.messages.length,2);
    if(which==='admin'){
      assert.equal(r.changedAudit.auditKey,'audit:workspace-1');
      assert.equal(r.changedAudit.event.action,'support_reply');
      assert.equal(r.changedAudit.event.meta.ticketId,'ticket-1');
    }else assert.equal(r.changedAudit,undefined);
  });
  test(which+' support reply fails closed on concurrent write or ambiguous storage response',async()=>{
    for(const commit of [false,'error']){
      const r=await fixture(which,{commit}).run();
      assert.equal(r.code,commit==='error'?503:409);
      assert.equal(r.ticket.messages.length,1);
      assert.equal(r.notifications,0);
      assert.match(r.result.error,/Refresh/);
    }
  });
}
