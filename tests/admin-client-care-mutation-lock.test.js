const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function loadFunction(context,name,next){const start=source.indexOf('async function '+name+'('),end=source.indexOf('\n'+next,start);vm.runInContext(source.slice(start,end),context)}

test('feedback status updates serialize each record and allow a later save',async()=>{
  const pending=[],item={id:'feedback-1',status:'submitted',createdAt:1,updatedAt:10},actionStatus={textContent:'',className:''},context=vm.createContext({adminFeedbackData:[item],adminFeedbackStatusPending:new Set(),Date,JSON,String,document:{getElementById:id=>id==='adminFeedbackActionStatus'?actionStatus:null},fetch:()=>{const d=deferred();pending.push(d);return d.promise},renderAdminFeedback(){},loadNotifications(){},alert(){}});loadFunction(context,'updateAdminFeedback','function renderWebsiteTrafficChart');
  const first=vm.runInContext("updateAdminFeedback('feedback-1','reviewed')",context),ignored=vm.runInContext("updateAdminFeedback('feedback-1','applied')",context);assert.equal(pending.length,1);assert.equal(item.status,'reviewed');
  pending[0].resolve({ok:true,json:async()=>({ok:true,feedback:{id:'feedback-1',status:'reviewed',updatedAt:11}})});await Promise.all([first,ignored]);
  const second=vm.runInContext("updateAdminFeedback('feedback-1','applied')",context);assert.equal(pending.length,2);pending[1].resolve({ok:true,json:async()=>({ok:true,feedback:{id:'feedback-1',status:'applied',updatedAt:12}})});await second;assert.equal(item.status,'applied');
});

test('support status failures roll back, unlock and allow retry',async()=>{
  const pending=[],alerts=[],messages=[],item={id:'ticket-1',status:'open'},context=vm.createContext({adminSupportData:[item],adminSupportStatusPending:new Set(),JSON,String,fetch:()=>{const d=deferred();pending.push(d);return d.promise},renderAdminSupport(){},setAdminSupportReplyStatus:(_id,message)=>messages.push(message),alert:value=>alerts.push(value)});loadFunction(context,'updateSupportStatus','function setPlatformSettingsDirty');
  const first=vm.runInContext("updateSupportStatus('ticket-1','resolved')",context),ignored=vm.runInContext("updateSupportStatus('ticket-1','in_progress')",context);assert.equal(pending.length,1);assert.equal(item.status,'resolved');
  pending[0].resolve({ok:false,json:async()=>({error:'Save failed'})});await Promise.all([first,ignored]);assert.equal(item.status,'open');assert.deepEqual(alerts,[]);assert.equal(messages.at(-1),'Save failed');
  const retry=vm.runInContext("updateSupportStatus('ticket-1','in_progress')",context);assert.equal(pending.length,2);pending[1].resolve({ok:true,json:async()=>({ok:true,ticket:{id:'ticket-1',status:'in_progress'}})});await retry;assert.equal(item.status,'in_progress');
});
