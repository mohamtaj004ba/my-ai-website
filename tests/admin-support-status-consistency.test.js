const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const apiSource=fs.readFileSync('api/account.js','utf8');
const dashboardSource=fs.readFileSync('dashboard.js','utf8');
function fixture({expectedUpdatedAt=10,write=true,status='resolved',now=20,previousStatus='open'}={}){
  let result,code=0,transaction,writes=0,emails=0;
  const ticket={id:'ticket-1',workspaceId:'client-1',status:previousStatus,createdAt:1,updatedAt:10,email:''};
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>key==='support:ticket-1'?ticket:null,set:()=>assert.fail('Ticket status should never be written outside audited transaction')},
    compareAndAudit:async(_kv,change,auditKey,event)=>{writes++;transaction={change,auditKey,event};if(write==='error')throw Error('network');return write},
    crypto:{randomUUID:()=> 'audit-1'},Date:{now:()=>now},Math,Number,String,
    safeError:()=> 'storage unavailable',console:{error(){}},
    sendMail:async()=>{emails++},
    req:{body:{id:'ticket-1',status,expectedUpdatedAt}},res:{status(value){code=value;return this},json(value){result=value;return value}}
  });
  const a=apiSource.indexOf('async function adminSupportUpdate('),b=apiSource.indexOf('\nasync function adminAiGuide(',a);
  assert.ok(a>=0&&b>a);
  vm.runInContext(apiSource.slice(a,b),context);
  return {run:async()=>{await vm.runInContext('adminSupportUpdate(req,res)',context);return {result,code,transaction,writes,emails,ticket}}};
}

test('support status and audit history commit in a single revision-checked operation',async()=>{
  const f=await fixture().run();
  assert.equal(f.code,200);assert.equal(f.writes,1);
  assert.equal(f.transaction.change.key,'support:ticket-1');
  assert.equal(f.transaction.change.before.status,'open');
  assert.equal(f.transaction.change.after.status,'resolved');
  assert.equal(f.transaction.change.after.updatedAt,20);
  assert.equal(f.transaction.auditKey,'audit:client-1');
  assert.equal(f.transaction.event.action,'support_status_update');
  assert.equal(f.transaction.event.meta.ticketId,'ticket-1');
  assert.equal(f.result.ticket.status,'resolved');
  assert.equal(f.emails,0);
});

test('stale and concurrent support status changes fail without sending notification',async()=>{
  for(const options of [{expectedUpdatedAt:9},{write:false},{write:'error'}]){
    const f=await fixture(options).run();
    assert.equal(f.code,options.write==='error'?503:409);
    assert.equal(f.emails,0);
    assert.equal(f.ticket.status,'open');
    if(options.expectedUpdatedAt===9)assert.equal(f.writes,0);
  }
});

test('repeated unchanged support status is a no-op and does not create audit or mail',async()=>{
  const f=await fixture({status:'open'}).run();
  assert.equal(f.code,200);assert.equal(f.result.unchanged,true);
  assert.equal(f.writes,0);assert.equal(f.emails,0);
});

test('support status revisions advance even within one millisecond',async()=>{
  const f=await fixture({now:10}).run();
  assert.equal(f.transaction.change.after.updatedAt,11);
});

test('admin status control sends currently displayed ticket revision',()=>{
  const a=dashboardSource.indexOf('async function updateSupportStatus('),b=dashboardSource.indexOf('\nfunction setPlatformSettingsDirty(',a);
  assert.ok(a>=0&&b>a);
  assert.match(dashboardSource.slice(a,b),/expectedUpdatedAt:Number\(t\.updatedAt\|\|t\.createdAt\|\|0\)/);
});
