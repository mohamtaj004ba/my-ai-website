const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function adminDocumentSave(');
const end=source.indexOf('\nasync function adminDocumentDelete(',start);
assert.ok(start>=0&&end>start,'admin document save handler must exist');

async function save(body){
  const writes=[],stored=[];
  const res={status(code){this.code=code;return this},json(data){this.data=data;return data}};
  const ctx=vm.createContext({
    requireAdmin:async()=>({email:'admin@example.test',workspaceId:'admin'}),
    kv:{get:async key=>{assert.equal(key,'admin:documents');return stored}},
    crypto:{randomUUID:()=> 'new-doc'},
    compareAndAudit:async(...args)=>{writes.push(args);return true},
    safeError:e=>String(e),
    console:{error(){}},
    req:{body},res
  });
  vm.runInContext(source.slice(start,end),ctx);
  await vm.runInContext('adminDocumentSave(req,res)',ctx);
  return {res,writes};
}

test('company document rejects impossible and malformed calendar dates without a write',async()=>{
  for(const value of ['2026-02-30','2026-13-01','2026-00-12','2026-04-31','2026-01-01junk','not-a-date','2026-1-01']){
    for(const field of ['effectiveDate','expiresAt']){
      const {res,writes}=await save({name:'Insurance policy',[field]:value});
      assert.equal(res.code,400,value+' '+field);
      assert.match(res.data.error,/valid calendar dates/);
      assert.equal(writes.length,0);
    }
  }
});

test('company document rejects expiration preceding its effective date',async()=>{
  const {res,writes}=await save({name:'Insurance policy',effectiveDate:'2026-09-25',expiresAt:'2026-09-24'});
  assert.equal(res.code,400);
  assert.match(res.data.error,/cannot precede/);
  assert.equal(writes.length,0);
});

test('company document saves legitimate leap day and equal-day dates with audit',async()=>{
  const {res,writes}=await save({name:'Insurance policy',effectiveDate:'2028-02-29',expiresAt:'2028-02-29'});
  assert.equal(res.code,201);
  assert.equal(res.data.document.effectiveDate,'2028-02-29');
  assert.equal(res.data.document.expiresAt,'2028-02-29');
  assert.equal(writes.length,1);
  assert.equal(writes[0][3].action,'company_document_create');
});

test('company document accepts missing optional dates without saving invented ones',async()=>{
  const {res,writes}=await save({name:'Insurance policy'});
  assert.equal(res.code,201);
  assert.equal(res.data.document.effectiveDate,'');
  assert.equal(res.data.document.expiresAt,'');
  assert.equal(writes.length,1);
});
