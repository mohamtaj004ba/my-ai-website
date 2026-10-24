const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function navigateNotification(');
const end=source.indexOf('\nasync function openNotification(',begin);
assert.ok(begin>=0&&end>begin,'notification navigation exists');
function fixture({kind='support',initial=false,remote=true,fail=false}={}){
  const events=[],ticket={tagName:'DETAILS',open:false},feedback={id:'feedback-fb-1'};
  const ctx=vm.createContext({
    document:{
      body:{dataset:{dashboard:'admin'}},
      querySelector:selector=>selector.includes('support-ticket-id')&&((initial||ctx.adminSupportData.some(t=>t.id==='ticket-1')))?ticket:null,
      getElementById:id=>id==='feedback-fb-1'&&((initial||ctx.adminFeedbackData.some(f=>f.id==='fb-1')))?feedback:id==='view-client-care'?{}:null
    },
    adminSupportData:initial?[{id:'ticket-1'}]:[{id:'older-ticket'}],
    adminFeedbackData:initial?[{id:'fb-1'}]:[{id:'older-feedback'}],
    adminSupportFilter:'urgent',adminSupportSearch:'old filter',
    adminFeedbackFilter:'applied',adminFeedbackSearch:'old filter',
    CSS:{escape:x=>x},
    openClientCare:tab=>events.push('tab:'+tab),
    showView:view=>events.push('view:'+view),
    fetchJsonRetry:async(url,options)=>{
      events.push('fetch:'+url);
      assert.equal(options.attempts,1);
      if(fail)throw Error('Provider unavailable');
      return url.includes('admin-support')?{tickets:remote?[{id:'ticket-1'}]:[{id:'other'}]}:{feedback:remote?[{id:'fb-1'}]:[{id:'other'}]};
    },
    renderAdminSupport:()=>events.push('render:support'),
    renderAdminFeedback:()=>events.push('render:feedback'),
    flashAdminSearchTarget:target=>events.push('flash:'+(target===ticket?'ticket':'feedback')),
    setTimeout:fn=>fn(),
    console:{warn:()=>events.push('warn')},
    Promise,String,Array
  });
  vm.runInContext(source.slice(begin,end),ctx);
  return {ctx,ticket,events,run:()=>vm.runInContext('navigateNotification({view:"client-care",meta:'+JSON.stringify(kind==='support'?{ticketId:'ticket-1',careTab:'support'}:{feedbackId:'fb-1',careTab:'feedback'})+'})',ctx)};
}
test('loaded admin support notification opens exact ticket without refetch',async()=>{
  const f=fixture({kind:'support',initial:true});
  assert.equal(await f.run(),true);
  assert.equal(f.ticket.open,true);
  assert.deepEqual(f.events,['tab:support','flash:ticket']);
});
test('missing admin support target reloads and locates specific ticket',async()=>{
  const f=fixture({kind:'support'});
  assert.equal(await f.run(),true);
  assert.equal(f.ticket.open,true);
  assert.deepEqual(f.events,['tab:support','fetch:/api/account?action=admin-support','render:support','flash:ticket']);
  assert.equal(f.ctx.adminSupportFilter,'all');
  assert.equal(f.ctx.adminSupportSearch,'');
});
test('unavailable admin support ticket is not marked as successfully navigated',async()=>{
  const f=fixture({kind:'support',remote:false});
  assert.equal(await f.run(),false);
  assert.equal(f.ticket.open,false);
  assert.equal(f.events.includes('flash:ticket'),false);
});
test('missing admin AI feedback notification resolves exact feedback card',async()=>{
  const f=fixture({kind:'feedback'});
  assert.equal(await f.run(),true);
  assert.deepEqual(f.events,['tab:feedback','fetch:/api/account?action=admin-ai-feedback','render:feedback','flash:feedback']);
  assert.equal(f.ctx.adminFeedbackFilter,'all');
  assert.equal(f.ctx.adminFeedbackSearch,'');
});
test('failed admin feedback fetch leaves last good snapshot and notification unread',async()=>{
  const f=fixture({kind:'feedback',fail:true});
  assert.equal(await f.run(),false);
  assert.equal(f.ctx.adminFeedbackData[0].id,'older-feedback');
  assert.equal(f.events.includes('flash:feedback'),false);
  assert.ok(f.events.includes('warn'));
});
