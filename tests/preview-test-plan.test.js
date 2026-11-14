const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const previewSeed=require('../lib/preview-seed');
const api=fs.readFileSync('api/account.js','utf8');
const source=api.slice(api.indexOf('async function adminUpdateClient('),api.indexOf('\nasync function adminDeleteClient('));
const req={headers:{host:'test-preview.vercel.app'}};
const workspace={...previewSeed.adminWorkspace('a602e6c2',0,100),ownerEmail:'preview-owner@example-client.test'};
test('Preview test plans require the exact seeded fixture and Preview host',()=>{
 assert.equal(previewSeed.testPlanEditable(req,workspace,'preview'),true);
 for(const environment of ['production','development','',null])assert.equal(previewSeed.testPlanEditable(req,workspace,environment),false);
 for(const patch of [{id:'real-workspace'},{stripeSubscriptionId:'sub_real'},{stripeCustomerId:'cus_real'},{stripeSubscriptionId:'seed_sub_2'},{previewScenario:'unknown'}])assert.equal(previewSeed.testPlanEditable(req,{...workspace,...patch},'preview'),false);
 assert.equal(previewSeed.testPlanEditable({headers:{host:'callercore.com'}},workspace,'preview'),false);
});
async function save({environment='preview',patch={},expected=workspace.updatedAt,admin=true,transaction=true}={}){
 let code,result,event,writes=0;
 const ctx=vm.createContext({previewSeed:{testPlanEditable:(r,w)=>previewSeed.testPlanEditable(r,w,environment)},requireAdmin:async()=>admin?{email:'support@callercore.com'}:null,kv:{get:async()=>({...workspace,...patch})},compareAndAudit:async(_,change,key,audit)=>{writes++;event=audit;assert.equal(change.before.stripeSubscriptionId,change.after.stripeSubscriptionId);assert.equal(change.before.stripeCustomerId,change.after.stripeCustomerId);return transaction},crypto:{randomUUID:()=> 'event-1'},safeError:()=>'',console:{error(){}},req:{...req,body:{id:workspace.id,plan:'Pro',expectedUpdatedAt:expected}},res:{status(n){code=n;return this},json(value){result=value}}});
 vm.runInContext(source,ctx);await vm.runInContext('adminUpdateClient(req,res)',ctx);return {code,result,event,writes};
}
test('authorized seeded Preview Pro update preserves provider links and audits atomically',async()=>{
 const result=await save();assert.equal(result.code,200);assert.equal(result.result.client.plan,'Pro');assert.equal(result.event.before.plan,'Growth');assert.equal(result.event.after.ownerEmail,workspace.ownerEmail);assert.equal(result.event.action,'workspace_update');assert.equal(result.writes,1);
});
test('production, real subscriptions, stale state, nonadmins and transaction conflicts cannot update test plans',async()=>{
 for(const options of [{environment:'production'},{patch:{stripeSubscriptionId:'sub_real'}},{expected:1}]){const r=await save(options);assert.equal(r.code,409);assert.equal(r.writes,0)}
 const denied=await save({admin:false});assert.equal(denied.writes,0);
 const conflict=await save({transaction:false});assert.equal(conflict.code,409);
});


