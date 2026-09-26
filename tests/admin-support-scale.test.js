const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
function fixture(count,{indexMalformed=false,missing=[]}={}){
  const index=indexMalformed?{bad:true}:Array.from({length:count},(_,i)=>'ticket-'+i),gone=new Set(missing),reads=[];
  let status=0,result;
  const context=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>{
      reads.push(key);
      if(key==='support:index')return index;
      if(key.startsWith('support:'))return gone.has(key.slice('support:'.length))?null:{id:key.slice('support:'.length),status:'open'};
      throw Error('Unexpected key '+key);
    }},
    res:{status(n){status=n;return this},json(x){result=x;return x}},req:{},Promise,Array
  });
  const start=source.indexOf('async function adminSupport(req,res)'),end=source.indexOf('\nasync function adminSupportReply(',start);
  assert.ok(start>=0&&end>start);
  vm.runInContext(source.slice(start,end),context);
  return {reads,run:async()=>{await vm.runInContext('adminSupport(req,res)',context);return {status,result}}};
}
test('support inbox includes tickets after the former 250 item cutoff',async()=>{
  const f=fixture(251),r=await f.run();
  assert.equal(r.status,200);
  assert.equal(r.result.tickets.length,251);
  assert.equal(r.result.tickets[250].id,'ticket-250');
  assert.equal(f.reads.filter(key=>key==='support:ticket-250').length,1);
});
test('missing ticket records do not suppress later results',async()=>{
  const r=await fixture(251,{missing:['ticket-14']}).run();
  assert.equal(r.status,200);
  assert.equal(r.result.tickets.length,250);
  assert.ok(r.result.tickets.some(t=>t.id==='ticket-250'));
});
test('malformed and over-capacity indexes fail instead of returning partial support lists',async()=>{
  for(const f of [fixture(1,{indexMalformed:true}),fixture(2001)]){
    const r=await f.run();
    assert.equal(r.status,503);
    assert.match(r.result.error,/No partial ticket list/);
    assert.equal(f.reads.filter(key=>key.startsWith('support:ticket-')).length,0);
  }
});
