const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('function companyDocumentIsExpired(');
const end=source.indexOf('\nfunction renderDocuments(){',start);
assert.ok(start>=0&&end>start,'company document expiry helper must exist');
const ctx=vm.createContext({});
vm.runInContext(source.slice(start,end),ctx);
function expired(date,now){
  return vm.runInContext('companyDocumentIsExpired('+JSON.stringify({expiresAt:date})+','+now+')',ctx);
}
test('expiration date remains current through the entire local calendar day',()=>{
  const endOfDay=new Date('2028-02-29T23:59:59.999').getTime();
  assert.equal(expired('2028-02-29',new Date('2028-02-29T00:00:00').getTime()),false);
  assert.equal(expired('2028-02-29',new Date('2028-02-29T12:30:00').getTime()),false);
  assert.equal(expired('2028-02-29',endOfDay),false);
  assert.equal(expired('2028-02-29',endOfDay+1),true);
});
test('missing or malformed legacy document expiration never flags overdue',()=>{
  for(const date of ['',null,'2028-13-01','invalid'])assert.equal(expired(date,Date.now()),false);
});
test('documents table, review counts, and navigation badge use consistent expiry rule',()=>{
  assert.equal(source.split('companyDocumentNeedsReview(x)').length-1,2);
  const render=source.slice(source.indexOf('function renderDocuments(){'),source.indexOf('let companyDocumentMutationPending=',source.indexOf('function renderDocuments(){')));
  assert.match(render,/company\.filter\(x=>companyDocumentNeedsReview\(x\)/);
  assert.match(render,/const expired=x.status!=='archived'&&companyDocumentIsExpired\(x\)/);
  assert.doesNotMatch(render,/expiresAt\+'T12:00:00'/);
});

test('archived documents stay out of renewal counts after their expiration',()=>{
  const now=new Date('2028-03-01T12:00:00').getTime();
  const script='companyDocumentNeedsReview('+JSON.stringify({status:'archived',expiresAt:'2028-02-29'})+')';
  assert.equal(vm.runInContext(script,ctx),false);
  assert.equal(vm.runInContext('companyDocumentNeedsReview('+JSON.stringify({status:'active',expiresAt:'2028-02-29'})+')',ctx),true);
  assert.equal(vm.runInContext('companyDocumentNeedsReview('+JSON.stringify({status:'review',expiresAt:''})+')',ctx),true);
  assert.equal(vm.runInContext('companyDocumentNeedsReview('+JSON.stringify({status:'active',expiresAt:'2099-12-31'})+')',ctx),false);
});
