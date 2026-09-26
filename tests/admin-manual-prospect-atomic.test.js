const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const start=api.indexOf('async function adminProspectSave('),end=api.indexOf('async function adminMarketingCampaigns(',start);
assert.ok(start>=0&&end>start);

function fixture(body,{error=null,auto=true}={}){
 let calls=0,payload,status,result,sets=0;
 const ctx=vm.createContext({
   req:{body},res:{status(n){status=n;return this},json(x){result=x;return x}},
   requireAdmin:async()=>({email:'admin@example.test'}),
   kv:{get:async()=>({autoScheduleFirstFollowup:auto,leadFollowupHours:24,defaultSalesOwner:'Admin sales'}),
      set:async()=>{sets++;throw Error('Admin follow-ups must not be a second write')}},
   upsertWebsiteProspect:async data=>{calls++;payload=data;if(error)throw error;return {id:'lead-1',...data}},
   clampInt:(v,min,max,d)=>Number(v)||d,console:{error(){}},safeError:()=> 'redacted',
   Number,String,Array,Error
 });
 vm.runInContext(api.slice(start,end),ctx);
 return {run:async()=>{await vm.runInContext('adminProspectSave(req,res)',ctx);return {calls,payload,status,result,sets}}};
}
test('manual lead submits all follow-up fields in a single atomic helper call',async()=>{
 const r=await fixture({name:'Prospect',email:'lead@example.test',owner:'Tj',stage:'qualified',
   notes:'Call after lunch',tags:['priority'],nextFollowUpAt:null,monthlyValue:500}).run();
 assert.equal(r.status,200);assert.equal(r.calls,1);assert.equal(r.sets,0);
 assert.equal(r.payload.nextFollowUpAt,null);assert.equal(r.payload.autoFollowupHours,24);
 assert.equal(r.payload.owner,'Tj');assert.equal(r.payload.notes,'Call after lunch');
 assert.equal(r.payload.updatedBy,'admin@example.test');
 assert.equal(r.payload.monthlyValue,500);
});
test('failed prospect publication never reports success or performs a separate patch',async()=>{
 const r=await fixture({name:'Prospect',email:'lead@example.test'},
   {error:new Error('provider unavailable')}).run();
 assert.equal(r.status,503);assert.equal(r.calls,1);assert.equal(r.sets,0);
 assert.match(r.result.error,/Could not confirm/);
});
test('manual prospect rejects malformed email before touching storage',async()=>{
 const r=await fixture({name:'Prospect',email:'invalid email'}).run();
 assert.equal(r.status,400);assert.equal(r.calls,0);assert.equal(r.sets,0);
});
