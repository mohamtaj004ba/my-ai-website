const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
function fixture(readOnly=false){
  const nodes=new Map(),node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',inert:false,classList:{values:new Set(),add(v){this.values.add(v)},remove(v){this.values.delete(v)},contains(v){return this.values.has(v)}},setAttribute(k,v){this[k]=v}});
    return nodes.get(id);
  };
  const pending=new Set(),ctx=vm.createContext({document:{body:{classList:{contains:()=>readOnly}},getElementById:node,querySelectorAll:()=>[]},followupMutationPending:pending,pendingTeamStatusCallId:'',callsData:[{id:'one',caller:'Lucy Walker',reason:'Estimate follow-up'}],activeCallId:'one',syncDrawerTeamStatus(){},teamStatusForCall:()=> 'needs_action',persistTeamStatus(){throw Error('No save expected')},String});
  vm.runInContext(source.slice(source.indexOf('function requestTeamStatusChange('),source.indexOf('async function saveTeamStatusCompletion(')),ctx);
  node('callDrawer').classList.add('open');
  return {ctx,node,pending,open:()=>vm.runInContext("requestTeamStatusChange('one','completed')",ctx),close:()=>vm.runInContext('closeTeamStatusModal()',ctx)};
}
test('completion preserves the call drawer but makes it inert until cancel restores it',()=>{
  const f=fixture();f.open();
  assert.equal(f.node('callDrawer').inert,true);assert.equal(f.node('callDrawer').classList.contains('open'),true);
  assert.equal(f.node('teamStatusModal')['aria-hidden'],'false');assert.equal(f.node('teamStatusCallContext').textContent,'Lucy Walker · Estimate follow-up');
  assert.equal(f.close(),true);assert.equal(f.node('callDrawer').inert,false);assert.equal(f.node('callDrawer').classList.contains('open'),true);
});
test('pending completion cannot dismiss or unlock its underlying drawer',()=>{
  const f=fixture();f.open();f.pending.add('one');assert.equal(f.close(),false);assert.equal(f.node('callDrawer').inert,true);assert.equal(f.node('teamStatusModal').classList.contains('open'),true);
});
test('read-only client inspection cannot launch a completion mutation',()=>{
  const f=fixture(true);assert.equal(f.open(),false);assert.equal(f.node('teamStatusModal').classList.contains('open'),false);assert.equal(f.node('callDrawer').inert,false);
});
