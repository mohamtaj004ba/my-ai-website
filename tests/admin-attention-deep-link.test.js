const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('dashboard.js','utf8');
const begin=source.indexOf('async function openAdminAttentionItem(');
const end=source.indexOf('\nfunction openAdminClientFilter(',begin);
assert.ok(begin>=0&&end>begin,'Command Center attention handler exists');
const handler=source.slice(begin,end);

function fixture(){
  const events=[],reconciliation={scrollIntoView:()=>events.push('scroll:reconciliation')},
    onboardingRow={id:'row'},reconciliationList={scrollIntoView:()=>events.push('scroll:list')};
  const ctx=vm.createContext({
    document:{
      querySelector:sel=>sel.includes('data-reconciliation-session')?reconciliation:sel.includes('onboarding-row')?onboardingRow:null,
      getElementById:id=>id==='financeReconciliationList'?reconciliationList:null
    },
    showView:view=>events.push('view:'+view),
    renderAdminFinance:()=>events.push('render:finance'),
    renderProvisioning:()=>events.push('render:onboarding'),
    openAdminClient:async id=>{events.push('client:'+id);return true},
    openProspectModal:id=>events.push('prospect:'+id),
    openOnboardingDrawer:(id,row)=>{assert.equal(row,onboardingRow);events.push('onboarding:'+id)},
    openClientCare:tab=>events.push('care:'+tab),
    flashAdminSearchTarget:target=>events.push(target===reconciliation?'flash:reconciliation':target===onboardingRow?'flash:onboarding':'flash:other'),
    CSS:{escape:value=>String(value)},setTimeout:fn=>fn(),String,Promise
  });
  vm.runInContext(handler,ctx);
  return {events,run:item=>vm.runInContext('openAdminAttentionItem('+JSON.stringify(item)+')',ctx)};
}

test('Command Center billing action preserves Finance context and opens exact client',async()=>{
  const f=fixture();
  await f.run({type:'billing',workspaceId:'client-1',view:'finance'});
  assert.deepEqual(f.events,['view:finance','client:client-1']);
});

test('Command Center suspended workspace action stays in Clients and opens exact client',async()=>{
  const f=fixture();
  await f.run({type:'workspace',workspaceId:'client-1',view:'clients'});
  assert.deepEqual(f.events,['view:clients','client:client-1']);
});

test('Command Center payment reconciliation highlights the exact Finance exception',async()=>{
  const f=fixture();
  await f.run({type:'checkout-reconciliation',sessionId:'cs_test_123',view:'finance'});
  assert.deepEqual(f.events,['view:finance','render:finance','scroll:reconciliation','flash:reconciliation']);
});

test('Command Center onboarding action opens the exact onboarding drawer',async()=>{
  const f=fixture();
  await f.run({type:'onboarding',workspaceId:'client-7',view:'onboarding'});
  assert.deepEqual(f.events,['view:onboarding','render:onboarding','onboarding:client-7','flash:onboarding']);
});
