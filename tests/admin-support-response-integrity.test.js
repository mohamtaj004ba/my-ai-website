const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function adminSupport('),end=source.indexOf('\nasync function adminSupportReply(',start);
assert.ok(start>=0&&end>start,'admin support reader exists');
const code=source.slice(start,end);

async function run({index=[],records={}}={}){
  let status=200,payload;
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv:{get:async key=>{
      if(key==='support:index')return index;
      if(key.startsWith('support:'))return records[key.slice('support:'.length)]??null;
      return null;
    }},
    req:{},res:{status(n){status=n;return this},json(x){payload=x;return x}},
    Array,Object,String,Set,Promise
  });
  vm.runInContext(code,ctx);
  await vm.runInContext('adminSupport(req,res)',ctx);
  return {status,payload};
}

test('admin support list omits malformed or mismatched indexed records and discloses incomplete coverage',async()=>{
  const out=await run({
    index:['good','missing','wrong','primitive'],
    records:{
      good:{id:'good',subject:'Healthy'},
      wrong:{id:'different',subject:'Wrong identity'},
      primitive:'broken'
    }
  });
  assert.equal(out.status,200);
  assert.deepEqual(Array.from(out.payload.tickets,t=>t.id),['good']);
  assert.equal(out.payload.coverage.verified,true);
  assert.equal(out.payload.coverage.indexedRecords,4);
  assert.equal(out.payload.coverage.loadedRecords,1);
  assert.equal(out.payload.coverage.missingRecords,3);
  assert.equal(out.payload.coverage.incomplete,true);
});

test('admin support list returns complete coverage only when every indexed identity verifies',async()=>{
  const out=await run({index:['a','b'],records:{a:{id:'a'},b:{id:'b'}}});
  assert.equal(out.status,200);
  assert.equal(out.payload.coverage.incomplete,false);
  assert.equal(out.payload.coverage.missingRecords,0);
});
