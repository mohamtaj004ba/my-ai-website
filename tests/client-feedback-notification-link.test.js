const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('async function navigateNotification('),end=source.indexOf('\nasync function openNotification(',start);
assert.ok(start>=0&&end>start);
function fixture({feedback=[],updated=feedback,active=true,visibleLimit=8}={}){
  const calls=[],history={open:false},targets=new Map(),agentView={classList:{contains:name=>name==='active'&&active}};
  const ctx=vm.createContext({
    document:{body:{dataset:{dashboard:'client'}},getElementById:id=>id==='view-agent'?agentView:id==='agentFeedbackHistoryDetails'?history:targets.get(id)||null},
    clientFeedbackData:feedback,clientFeedbackVisibleLimit:visibleLimit,
    showView:tab=>calls.push('view:'+tab),
    loadClientFeedback:async()=>{calls.push('load');ctx.clientFeedbackData=updated},
    renderClientFeedback:()=>{calls.push('render');targets.clear();ctx.clientFeedbackData.slice(0,ctx.clientFeedbackVisibleLimit).forEach(item=>targets.set('client-feedback-'+item.id,{scrollIntoView:()=>calls.push('scroll:'+item.id)}))},
    openCall:async id=>calls.push('wrong-call:'+id),
    String,Math,Array,Promise
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,calls,history,run:()=>vm.runInContext('navigateNotification({view:"agent",meta:{feedbackId:"fb-9",callId:"call-4"}})',ctx)};
}
test('reviewed feedback notification opens exact record instead of unrelated call',async()=>{
  const f=fixture({feedback:[{id:'fb-9'}]});
  assert.equal(await f.run(),true);
  assert.equal(f.history.open,true);
  assert.deepEqual(f.calls,['view:agent','load','render','scroll:fb-9']);
});
test('older reviewed feedback becomes visible even when beyond first eight records',async()=>{
  const list=Array.from({length:20},(_,i)=>({id:'fb-'+i}));
  const f=fixture({feedback:list});
  assert.equal(await f.run(),true);
  assert.equal(f.ctx.clientFeedbackVisibleLimit,10);
  assert.deepEqual(f.calls,['view:agent','load','render','scroll:fb-9']);
});
test('deleted feedback does not mark notification read or open a different record',async()=>{
  const f=fixture({feedback:[{id:'other'}]});
  assert.equal(await f.run(),false);
  assert.deepEqual(f.calls,['view:agent','load']);
  assert.equal(f.history.open,false);
});
test('blocked agent navigation cannot mark feedback as opened',async()=>{
  const f=fixture({feedback:[{id:'fb-9'}],active:false});
  assert.equal(await f.run(),false);
  assert.deepEqual(f.calls,['view:agent']);
});
const loaderStart=source.indexOf('async function loadClientFeedback(');
const loaderEnd=source.indexOf('\nasync function submitAiFeedback(',loaderStart);
assert.ok(loaderStart>=0&&loaderEnd>loaderStart);
test('newer client feedback response wins against an older in-flight response',async()=>{
  let resolveOld;const updates=[],ctx=vm.createContext({
    demoMode:false,clientFeedbackLoadRequest:0,clientFeedbackData:[{id:'prior'}],
    document:{getElementById:id=>id==='clientFeedbackList'?{innerHTML:''}:null},
    fetch:async()=>new Promise(ok=>{if(!resolveOld)resolveOld=ok;else ok({ok:true,json:async()=>({feedback:[{id:'new'}]})})}),
    renderClientFeedback:()=>updates.push(ctx.clientFeedbackData[0]?.id),
    console:{error:()=>{}},Array
  });
  vm.runInContext(source.slice(loaderStart,loaderEnd),ctx);
  const older=vm.runInContext('loadClientFeedback()',ctx);
  await vm.runInContext('loadClientFeedback()',ctx);
  resolveOld({ok:true,json:async()=>({feedback:[{id:'obsolete'}]})});
  await older;
  assert.equal(ctx.clientFeedbackData[0].id,'new');
  assert.deepEqual(updates,['new']);
});
