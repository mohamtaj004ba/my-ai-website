const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const account=fs.readFileSync('api/account.js','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
const segment=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'source handler exists: '+start);return source.slice(a,b);
};
const handler=segment(account,'async function adminAiFeedbackUpdate(req,res){','\nasync function notifications(req,res){');
const front=segment(ui,'async function updateAdminFeedback(id,status){','\nfunction renderWebsiteTrafficChart(');
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
function fixture({denied=false,record,body,conflict=false,fail=false}={}){
  const original=record===undefined?{id:'feedback-1',workspaceId:'tenant-1',status:'submitted',createdAt:100,updatedAt:110,callId:'call-1'}:record;
  let saved=clone(original),audit=null,code=null,result=null,compares=0;
  const ctx=vm.createContext({
    requireAdmin:async()=>denied?null:{email:'admin@example.test',workspaceId:'admin-home'},
    kv:{get:async key=>{assert.equal(key,'ai-feedback:feedback-1');return clone(saved)},set:()=>assert.fail('Feedback and audit cannot write separately')},
    crypto:{randomUUID:()=> 'audit-event-1'},
    compareAndAudit:async(_kv,update,auditKey,event)=>{
      compares++;assert.equal(update.key,'ai-feedback:feedback-1');
      assert.equal(auditKey,'audit:tenant-1');
      if(fail)throw Error('Ambiguous KV error');
      if(conflict)return false;
      assert.deepEqual(clone(update.before),saved);
      saved=clone(update.after);audit=clone(event);return true;
    },safeError:()=> 'Unavailable',console:{error(){}},req:{body:body||{id:'feedback-1',status:'reviewed',expectedUpdatedAt:110}},
    res:{status(n){code=n;return this},json(data){result=data;return data}},cryptoRandomUUID:()=> 'audit-event-1',Date,Number,Array,String,Object,Set
  });
  vm.runInContext(handler,ctx);
  return {run:async()=>{await vm.runInContext('adminAiFeedbackUpdate(req,res)',ctx);return {code,result,saved,audit,compares}}};
}
test('review status and customer audit are saved in one guarded transaction',async()=>{
  const r=await fixture().run();
  assert.equal(r.code,200);assert.equal(r.saved.status,'reviewed');
  assert.equal(r.result.feedback.updatedAt,r.saved.updatedAt);
  assert.equal(r.audit.workspaceId,'tenant-1');assert.equal(r.audit.action,'ai_feedback_reviewed');
  assert.equal(r.audit.meta.callId,'call-1');assert.equal(r.compares,1);
});
test('stale or missing displayed revision cannot overwrite a newer review',async()=>{
  for(const body of [{id:'feedback-1',status:'applied',expectedUpdatedAt:109},{id:'feedback-1',status:'applied'}]){
    const r=await fixture({body}).run();
    assert.equal(r.code,409);assert.equal(r.saved.status,'submitted');assert.equal(r.audit,null);assert.equal(r.compares,0);
  }
});
test('a concurrent feedback review conflict never reports a saved audit or status',async()=>{
  const r=await fixture({conflict:true}).run();
  assert.equal(r.code,409);assert.equal(r.saved.status,'submitted');
  assert.equal(r.audit,null);assert.equal(r.compares,1);
});
test('uncertain audited write fails closed with a refresh instruction',async()=>{
  const r=await fixture({fail:true}).run();
  assert.equal(r.code,503);assert.match(r.result.error,/Refresh Client Care/);
  assert.equal(r.saved.status,'submitted');assert.equal(r.audit,null);
});
test('malformed feedback and missing customer audit scope cannot be altered',async()=>{
  for(const record of [null,{id:'wrong',workspaceId:'tenant-1',status:'submitted',updatedAt:110},{id:'feedback-1',status:'submitted',updatedAt:110}]){
    const r=await fixture({record}).run();
    assert.ok([404,503].includes(r.code));assert.equal(r.compares,0);
  }
});
test('unauthorized reviewer never reads or changes client feedback',async()=>{
  let called=false;
  const ctx=vm.createContext({
    requireAdmin:async()=>null,kv:{get:()=>{called=true;throw Error('Unauthorized read')}},
    req:{body:{id:'feedback-1',status:'reviewed',expectedUpdatedAt:110}},
    res:{status(){throw Error('Unauthorized handler should have returned')}},
    String
  });
  vm.runInContext(handler,ctx);
  await vm.runInContext('adminAiFeedbackUpdate(req,res)',ctx);
  assert.equal(called,false);
});
function frontend(){
  const item={id:'feedback-1',status:'submitted',createdAt:100,updatedAt:110},requests=[],alerts=[],renders=[];
  const ctx=vm.createContext({
    adminFeedbackData:[item],adminFeedbackStatusPending:new Set(),
    Date,Number,String,JSON,fetch:async(_url,options)=>{
      requests.push(JSON.parse(options.body));return {ok:false,json:async()=>({error:'Server conflict'})}
    },
    renderAdminFeedback:()=>renders.push(item.status),loadNotifications:()=>{},alert:x=>alerts.push(x)
  });
  vm.runInContext(front,ctx);
  return {item,requests,alerts,renders,ctx,run:cmd=>vm.runInContext(cmd,ctx)};
}
test('failed optimistic admin feedback review restores original status and revision',async()=>{
  const f=frontend();
  await f.run("updateAdminFeedback('feedback-1','applied')");
  assert.deepEqual(f.requests,[{id:'feedback-1',status:'applied',expectedUpdatedAt:110}]);
  assert.equal(f.item.status,'submitted');assert.equal(f.item.updatedAt,110);
  assert.deepEqual(f.alerts,['Server conflict']);assert.equal(f.ctx.adminFeedbackStatusPending.size,0);
});
test('confirmed review sends displayed revision and adopts confirmed server record',async()=>{
  const f=frontend();
  f.ctx.fetch=async(_url,options)=>{
    f.requests.push(JSON.parse(options.body));
    return {ok:true,json:async()=>({ok:true,feedback:{id:'feedback-1',status:'reviewed',updatedAt:500}})};
  };
  await f.run("updateAdminFeedback('feedback-1','reviewed')");
  assert.equal(f.requests[0].expectedUpdatedAt,110);
  assert.equal(f.item.status,'reviewed');assert.equal(f.item.updatedAt,500);
  assert.equal(f.ctx.adminFeedbackStatusPending.size,0);
});
