const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function supportTickets(req,res){');
const end=source.indexOf('\nasync function replySupportTicket(req,res){',start);
assert.ok(start>=0&&end>start,'client support history handler found');

function fixture(count,{malformed=false,missing=[],workspaceAt=[]}={}){
  const index=malformed?{unexpected:true}:Array.from({length:count},(_,i)=>'ticket-'+i);
  const gone=new Set(missing),owned=new Set(workspaceAt),reads=[];
  let status=0,payload;
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'workspace-client'}),
    kv:{get:async key=>{
      reads.push(key);
      if(key==='support:index')return index;
      if(!key.startsWith('support:'))throw Error('Unexpected key '+key);
      const id=key.slice('support:'.length);
      if(gone.has(id))return null;
      return {id,workspaceId:owned.has(id)?'workspace-client':'workspace-other'};
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
