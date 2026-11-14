const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function navigateNotification(');
const end=source.indexOf('\nasync function openNotification(',begin);
assert.ok(begin>=0&&end>begin,'notification deep-link handler exists');
function fixture({calls=[],remote=[],fail=false}={}){
  const actions=[];
  const context=vm.createContext({
    document:{body:{dataset:{dashboard:'client'}}},callsData:calls,
    fetchJsonRetry:async(url,options)=>{
      actions.push('fetch:'+url);
      assert.equal(options.attempts,1);
      if(fail)throw Error('Calls temporarily offline');
      return {calls:remote};
    },
    showView:view=>actions.push('view:'+view),
    openCall:async id=>actions.push('open:'+id),
    renderCalls:()=>actions.push('render'),
    console:{warn:()=>actions.push('warn')},
    String,Array,Error
  });
  vm.runInContext(source.slice(begin,end),context);
  return {context,actions,run:id=>vm.runInContext('navigateNotification({view:"calls",meta:{callId:'+JSON.stringify(id)+'}})',context)};
}
test('notification opens specific already loaded call without redundant network request',async()=>{
  const f=fixture({calls:[{id:'known'}]});
  assert.equal(await f.run('known'),true);
  assert.deepEqual(f.actions,['view:calls','open:known']);
});
test('notification finds a missing call in authoritative feed and opens that exact call',async()=>{
  const f=fixture({calls:[{id:'previous'}],remote:[{id:'newly-loaded'},{id:'previous'}]});
  assert.equal(await f.run('newly-loaded'),true);
  assert.equal(f.context.callsData[0].id,'newly-loaded');
  assert.deepEqual(f.actions,['fetch:/api/account?action=calls','render','view:calls','open:newly-loaded']);
});
test('notification does not open a different call or replace good list when target has vanished',async()=>{
  const f=fixture({calls:[{id:'previous'}],remote:[{id:'other'}]});
  assert.equal(await f.run('missing'),false);
  assert.equal(f.context.callsData[0].id,'previous');
  assert.deepEqual(f.actions,['fetch:/api/account?action=calls']);
});
test('unavailable call feed retains last loaded data and keeps notification unread',async()=>{
  const f=fixture({calls:[{id:'previous'}],fail:true});
  assert.equal(await f.run('missing'),false);
  assert.equal(f.context.callsData[0].id,'previous');
  assert.deepEqual(f.actions,['fetch:/api/account?action=calls','warn']);
});
