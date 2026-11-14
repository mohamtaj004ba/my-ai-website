const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function supportTickets(req,res){');
const end=source.indexOf('\nasync function replySupportTicket(req,res){',start);
assert.ok(start>=0&&end>start,'client support history handler found');

function fixture(count,{malformed=false,missing=[],workspaceAt=[],malformedMessages=[]}={}){
  const index=malformed?{unexpected:true}:Array.from({length:count},(_,i)=>'ticket-'+i);
  const gone=new Set(missing),owned=new Set(workspaceAt),badMessages=new Set(malformedMessages),reads=[];
  let status=0,payload;
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'workspace-client'}),
    kv:{get:async key=>{
      reads.push(key);
      if(key==='support:index')return index;
      if(!key.startsWith('support:'))throw Error('Unexpected key '+key);
      const id=key.slice('support:'.length);
      if(gone.has(id))return null;
      return badMessages.has(id)?{id,workspaceId:owned.has(id)?'workspace-client':'workspace-other',messages:[{id:'m1',direction:'client',body:'broken',at:0}],messageCount:1}:{id,workspaceId:owned.has(id)?'workspace-client':'workspace-other'};
    }},
    req:{},res:{status(code){status=code;return this},json(data){payload=data;return data}},Promise,Array
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {reads,run:async()=>{await vm.runInContext('supportTickets(req,res)',ctx);return {status,payload}}};
}
test('client support history finds own ticket beyond first 100 global tickets',async()=>{
  const f=fixture(251,{workspaceAt:['ticket-150','ticket-250']});
  const {status,payload}=await f.run();
  assert.equal(status,200);
  assert.deepEqual(Array.from(payload.tickets,t=>t.id),['ticket-150','ticket-250']);
  assert.equal(f.reads.filter(k=>k==='support:ticket-250').length,1);
});
test('missing support records do not suppress later owned records or expose another tenant',async()=>{
  const f=fixture(122,{missing:['ticket-101'],workspaceAt:['ticket-100','ticket-101','ticket-121']});
  const {status,payload}=await f.run();
  assert.equal(status,200);
  assert.deepEqual(Array.from(payload.tickets,t=>t.id),['ticket-100','ticket-121']);
});
test('malformed or over-capacity support index returns explicit failure without false partial history',async()=>{
  for(const f of [fixture(1,{malformed:true}),fixture(2001)]){
    const {status,payload}=await f.run();
    assert.equal(status,503);
    assert.match(payload.error,/No partial ticket list/);
    assert.equal(f.reads.filter(key=>key.startsWith('support:ticket-')).length,0);
  }
});
test('client history remains empty only when full indexed set contains no owned tickets',async()=>{
  const {status,payload}=await fixture(120).run();
  assert.equal(status,200);
  assert.equal(payload.tickets.length,0);
});

test('missing global support records are disclosed because client ownership cannot be verified',async()=>{
  const {status,payload}=await fixture(4,{missing:['ticket-2'],workspaceAt:['ticket-1']}).run();
  assert.equal(status,200);assert.equal(payload.coverage.verified,true);assert.equal(payload.coverage.incomplete,true);
});
test('duplicate or invalid support index fails closed rather than appearing complete',async()=>{
  for(const index of [['ticket-1','ticket-1'],['ticket-1',42]]){
    let status=0,payload;
    const ctx=vm.createContext({requireSession:async()=>({workspaceId:'workspace-client'}),kv:{get:async key=>key==='support:index'?index:null},req:{},res:{status(n){status=n;return this},json(x){payload=x;return x}},Array,Set,Promise,String});
    vm.runInContext(source.slice(start,end),ctx);await vm.runInContext('supportTickets(req,res)',ctx);
    assert.equal(status,503);assert.match(payload.error,/No partial ticket list/);
  }
});

test('malformed owned support message history is omitted and marks coverage incomplete',async()=>{
  const {status,payload}=await fixture(4,{workspaceAt:['ticket-1','ticket-2'],malformedMessages:['ticket-2']}).run();
  assert.equal(status,200);
  assert.deepEqual(Array.from(payload.tickets,t=>t.id),['ticket-1']);
  assert.equal(payload.coverage.incomplete,true);
});
