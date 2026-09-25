const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const handler=source.slice(source.indexOf('async function adminDeletePhoneNumber('),source.indexOf('async function adminFleet('));

async function run({expected=10,transaction=true,malformed=false}={}){
  const phone={id:'p',number:'5095550100',workspaceId:'tenant',updatedAt:10};
  const records={'phone:index':malformed?{broken:true}:[phone],'workspace:tenant':{phone:phone.number,name:'Client'},'onboarding:workspace:tenant':{checklist:{phoneAssigned:true,knowledgeApproved:true}}};
  let status=200,result,updates,audits=0;
  const context=vm.createContext({requireAdmin:async()=>({email:'admin@example.com'}),kv:{get:async key=>records[key],set:()=>assert.fail('Deletion must use one atomic transaction')},compareAndSetConfig:async(_,next)=>{updates=next;return transaction},appendAudit:async()=>audits++,safeError:()=>'',console:{error:()=>{}},req:{body:{id:'p',expectedUpdatedAt:expected}},res:{status(n){status=n;return this},json(x){result=x}}});
  vm.runInContext(handler,context);await vm.runInContext('adminDeletePhoneNumber(req,res)',context);return {status,result,updates,audits};
}

test('phone deletion stages inventory, workspace and onboarding changes atomically',async()=>{
  const r=await run();assert.equal(r.status,200);assert.deepEqual(Array.from(r.updates,x=>x.key),['phone:index','workspace:tenant','onboarding:workspace:tenant']);
  assert.equal(r.updates[0].after.length,0);assert.equal(r.updates[1].after.phone,'');assert.equal(r.updates[2].after.checklist.phoneAssigned,false);assert.equal(r.updates[2].after.checklist.knowledgeApproved,true);assert.equal(r.audits,1);
});

test('stale, concurrent and malformed phone deletions fail without writing an audit event',async()=>{
  for(const [options,want] of [[{expected:9},409],[{transaction:false},409],[{malformed:true},503]]){const r=await run(options);assert.equal(r.status,want);assert.equal(r.audits,0)}
});

test('client sends the phone revision and updates local inventory after confirmed deletion',()=>{
  const dashboard=fs.readFileSync('dashboard.js','utf8'),code=dashboard.slice(dashboard.indexOf('async function deletePhone('),dashboard.indexOf('function openPhoneModal('));
  assert.match(code,/expectedUpdatedAt:Number\(item\.updatedAt\|\|0\)/);assert.match(code,/adminPhoneData=adminPhoneData\.filter/);
});
