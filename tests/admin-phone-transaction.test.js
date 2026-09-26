const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {voiceStatus}=require('../lib/voice-status');
const source=fs.readFileSync('api/account.js','utf8');
const handler=source.slice(source.indexOf('async function adminSavePhoneNumber('),source.indexOf('async function adminDeletePhoneNumber('));
async function run({transaction=true,move=false,transfer='5095550123',label='Updated'}={}){
  const phone={id:'p',number:'5095550100',workspaceId:'old',transferNumber:'5095550123',label:'Original',updatedAt:10,providerId:'preserved'};
  const records={'phone:index':[phone],'workspace:old':{name:'Original',phone:phone.number},'workspace:new':{name:'New'},'onboarding:workspace:old':{checklist:{phoneAssigned:true,knowledgeApproved:true}},'onboarding:workspace:new':{checklist:{phoneAssigned:false}},'agent:old':{transferNumber:phone.transferNumber,updatedAt:10},'agent:new':{transferNumber:'',providerId:'keep',updatedAt:10},'routing-request:new':{transferNumber:''}};
  let status=200,result,updates,audits=0;
  const ctx=vm.createContext({voiceStatus,requireAdmin:async()=>({email:'qa@test.invalid'}),crypto:{randomUUID:()=> 'new'},process:{env:{}},kv:{get:async key=>records[key],set:()=>assert.fail('No independent writes or rollback allowed')},compareAndSetConfig:async(_,u)=>{updates=u;if(transaction==='error')throw Error('network');return transaction},appendAudit:async()=>audits++,safeError:()=>'',console:{error:()=>{}},req:{body:{id:'p',number:phone.number,workspaceId:move?'new':'old',transferNumber:transfer,label,expectedUpdatedAt:10}},res:{status(n){status=n;return this},json(x){result=x}}});
  vm.runInContext(handler,ctx);await vm.runInContext('adminSavePhoneNumber(req,res)',ctx);return {status,result,updates,audits};
}
test('admin reassignment stages both workspaces, onboarding, inventory and target routing atomically',async()=>{
  const r=await run({move:true});assert.equal(r.status,200);const byKey=Object.fromEntries(r.updates.map(x=>[x.key,x]));
  assert.equal(r.updates.length,7);assert.equal(byKey['workspace:old'].after.phone,'');assert.equal(byKey['workspace:new'].after.phone,'5095550100');
  assert.equal(byKey['onboarding:workspace:old'].after.checklist.phoneAssigned,false);assert.equal(byKey['onboarding:workspace:old'].after.checklist.knowledgeApproved,true);assert.equal(byKey['onboarding:workspace:new'].after.checklist.phoneAssigned,true);
  assert.equal(byKey['agent:new'].after.transferNumber,'5095550123');assert.equal(byKey['agent:new'].after.providerId,'keep');assert.equal(byKey['routing-request:new'].after.transferNumber,'5095550123');assert.equal(r.result.number.providerId,'preserved');
});
test('admin label-only save does not invalidate an unchanged receptionist draft',async()=>{
  const r=await run();assert.equal(r.status,200);assert.ok(!r.updates.some(x=>x.key==='agent:old'));assert.equal(r.result.number.label,'Updated');assert.equal(r.audits,1);
});
test('admin transaction conflicts and ambiguous failures do not attempt unsafe rollback',async()=>{
  for(const transaction of [false,'error']){const r=await run({transaction});assert.equal(r.status,transaction===false?409:503);assert.equal(r.audits,0);assert.ok(!r.result.ok)}
});
