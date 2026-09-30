const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const begin=api.indexOf('async function createSupportTicket(req,res){');
const end=api.indexOf('\nasync function supportTickets(req,res){',begin);
assert.ok(begin>=0&&end>begin,'support ticket create handler found');

function fixture({initial=null,onCompare=null,failEval=false}={}){
  const values=new Map([['workspace:client-1',{name:'Customer'}]]);
  if(initial!==null)values.set('support:index',initial);
  let status=0,response,attempts=0,mails=0;
  const compareAndSetConfig=async(_kv,updates)=>{
    attempts++;
    if(failEval)throw Error('Redis unavailable');
    if(onCompare?.({attempts,updates,values})===false)return false;
    for(const update of updates){
      if(JSON.stringify(values.get(update.key)??null)!==JSON.stringify(update.before??null))return false;
    }
    for(const update of updates)values.set(update.key,update.after);
    return true;
  };
  let seq=0;
  const ctx=vm.createContext({
    requireWritableSession:async()=>({workspaceId:'client-1',email:''}),
    kv:{get:async key=>values.get(key)??null},
    compareAndSetConfig,
    crypto:{randomUUID:()=>String(++seq)},
    Date:{now:()=>123456},Promise,Array,process:{env:{}},
    req:{body:{subject:'Need help',message:'A detailed support request',priority:'normal'}},
    res:{status(code){status=code;return this},json(payload){response=payload;return payload}},
    console:{error:()=>{}},safeError:()=>({}),
    sendMail:async()=>{mails++},
    requestOrigin:()=>'',lifecycleEmail:()=>({})
  });
  vm.runInContext(api.slice(begin,end),ctx);
  return {ctx,values,run:async()=>{await vm.runInContext('createSupportTicket(req,res)',ctx);return {status,response,attempts,mails}}};
}
test('support create atomically stores ticket and index with no orphan',async()=>{
  const f=fixture({initial:['existing']});
  const r=await f.run();
  assert.equal(r.status,201);
  assert.equal(r.response.ok,true);
  assert.deepEqual(Array.from(f.values.get('support:index')),['1','existing']);
  assert.equal(f.values.get('support:1').subject,'Need help');
});
test('concurrent support index edit retries without losing the other request',async()=>{
  const f=fixture({initial:['prior'],onCompare:({attempts,values})=>{
    if(attempts===1){values.set('support:index',['concurrent','prior']);return false}
  }});
  const r=await f.run();
  assert.equal(r.status,201);
  assert.equal(r.attempts,2);
  assert.deepEqual(Array.from(f.values.get('support:index')),['1','concurrent','prior']);
});
test('500 existing requests are retained instead of silently truncated on new submit',async()=>{
  const f=fixture({initial:Array.from({length:500},(_,i)=>'old-'+i)});
  const r=await f.run();
  assert.equal(r.status,201);
  assert.equal(f.values.get('support:index').length,501);
  assert.equal(f.values.get('support:index')[500],'old-499');
});
test('malformed and capacity-exhausted index fail closed without orphan ticket',async()=>{
  for(const initial of [{unexpected:true},Array.from({length:2000},(_,i)=>'old-'+i)]){
    const f=fixture({initial});
    const r=await f.run();
    assert.ok([409,503].includes(r.status));
    assert.match(r.response.error,/has not been submitted/);
    assert.equal(r.attempts,0);
    assert.equal(f.values.has('support:1'),false);
  }
});
test('uncertain store error and repeated conflicts never claim request was sent',async()=>{
  for(const config of [{failEval:true},{initial:[],onCompare:()=>false}]){
    const f=fixture(config),r=await f.run();
    assert.ok([409,503].includes(r.status));
    assert.equal(f.values.has('support:1'),false);
    assert.equal(r.mails,0);
    assert.match(r.response.error,/request history/);
  }
});

test('new support tickets establish verified message-history coverage metadata',async()=>{
  const f=fixture({initial:[]}),r=await f.run(),ticket=r.response.ticket;
  assert.equal(ticket.messageCount,1);assert.equal(ticket.messageHistoryVerified,true);assert.equal(ticket.messagesTruncated,false);
});
