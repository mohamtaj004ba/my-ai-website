const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('dashboard.js','utf8');
const prelude=src.slice(0,src.indexOf('const params=new URLSearchParams('));
const feature=src.slice(src.indexOf('function featureStage('),src.indexOf('\nfunction renderStages(){',src.indexOf('function featureStage(')));
function context(){
  const state=vm.createContext({Object,String,Number});
  vm.runInContext(prelude,state);
  return state;
}
test('only own tier names qualify as plans, never inherited prototype keys',()=>{
  const c=context();
  for(const invalid of ['__proto__','constructor','toString','valueOf','',null,'starter']){
    assert.equal(vm.runInContext('knownPlan('+JSON.stringify(invalid)+')',c),false,String(invalid));
  }
  for(const valid of ['Starter','Growth','Pro']){
    assert.equal(vm.runInContext('knownPlan('+JSON.stringify(valid)+')',c),true,valid);
  }
  assert.match(src,/currentPlan=knownPlan\(data\.workspace\.plan\)\?data\.workspace\.plan:'Growth'/);
  assert.match(src,/currentPlan=knownPlan\(sessionWorkspace\.plan\)\?sessionWorkspace\.plan:currentPlan/);
  assert.match(src,/function setPlan\(plan\)\{if\(!knownPlan\(plan\)\)return/);
});
test('feature card rejects inherited keys and HTML-escapes content',()=>{
  const c=context();c.currentPlan='Growth';c.demoMode=true;c.has=()=>false;c.featureDeferred=()=>false;
  c.esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  vm.runInContext(feature,c);
  const invalid={innerHTML:'unchanged',replaceChildren(){this.innerHTML='';}};
  c.featureStage(invalid,'constructor');
  assert.equal(invalid.innerHTML,'');
  vm.runInContext("FEATURE_INFO.automations.copy='<img src=x onerror=alert(1)>'",c);
  const card={innerHTML:''};
  c.featureStage(card,'automations');
  assert.match(card.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(card.innerHTML,/<img src=x/);
});

test('usage updates target only fixed own-plan objects and never inherited properties',()=>{
  const c=context();
  const initial=vm.runInContext('PLAN_DATA.Growth.used',c);
  c.currentPlan='__proto__';
  vm.runInContext('updatePlanUsage(999)',c);
  assert.equal(vm.runInContext('PLAN_DATA.Growth.used',c),initial);
  assert.equal(Object.prototype.used,undefined);
  c.currentPlan='Growth';
  vm.runInContext('updatePlanUsage(321)',c);
  assert.equal(vm.runInContext('PLAN_DATA.Growth.used',c),321);
  vm.runInContext('updatePlanUsage(Infinity)',c);
  assert.equal(vm.runInContext('PLAN_DATA.Growth.used',c),321);
  assert.doesNotMatch(src,/PLAN_DATA\[currentPlan\]\.used\s*=/);
});
