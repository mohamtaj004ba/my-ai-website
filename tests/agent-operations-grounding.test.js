const {test}=require('node:test'),assert=require('node:assert/strict');
const g=require('../lib/agent-operations-grounding'),ef=require('../lib/agent-operations-evidence-first'),vm=require('../lib/agent-operations-visual-model');
const source=require('./fixtures/agent-operations-qa-source.json'),qa=require('../lib/agent-operations-qa');
function fixture(text='A dashboard is visible.'){
 const task={id:'offline',profile:vm.HYBRID.profile,modelConfig:vm.identity(),evidenceBinding:ef.binding(qa.sourceFor(source)),results:{},claims:[{code:'ONE',imageId:'I1',atoms:[{id:'A1',text}]}]};
 const o={stage:'observe',facts:[1,2,3,4].map(i=>({id:'O'+i,imageId:'I'+i,region:[.1,.1,.4,.4],observed:'A dashboard is visible',readability:'clear',uncertainty:''})),note:'Offline'};
 o.facts.push({id:'O5',imageId:'I1',region:[.7,.7,.9,.9],observed:'Unrelated footer',readability:'clear',uncertainty:''});task.results.qaObservation=ef.seal(o,task,'exec_offline');
 const atom={id:'A1',support:'supported',probability:.95,reason:'Visible dashboard',observations:['O1'],evidence:[{imageId:'I1',region:[.12,.12,.3,.3]}],uncertainty:''};
 return{task,atom,verdict:{stage:'adjudicate',findings:[{code:'ONE',decision:'accept',atoms:[atom]}],note:'Offline'}};
}
test('relevant image and sealed observation pass; each irrelevant reference fails even beside a valid one',()=>{
 const f=fixture();assert(ef.validAdjudication(f.verdict,f.task));f.atom.observations.push('O5');assert(!ef.validAdjudication(f.verdict,f.task));f.atom.observations=['O2'];assert(!ef.validAdjudication(f.verdict,f.task));
});
test('every direct region needs a relevant sealed anchor; touching/disjoint regions do not pass',()=>{
 const f=fixture();f.atom.evidence.push({imageId:'I1',region:[.7,.7,.9,.9]});assert(!ef.validAdjudication(f.verdict,f.task));assert(!g.intersects([0,0,.2,.2],[.2,.2,.4,.4]));
});
test('unsupported suitability and behavioral conclusions cannot hide in an otherwise visible mixed atom',()=>{
 for(const text of ['The image remains contextually appropriate, displaying a call list.','The visual message matches the legal narrative.','Confidential records are securely saved.','No correction needed.','An accessible modal has keyboard focus.','An exact DOM gap is 7 CSS pixels.']){
 const f=fixture(text);assert(!ef.validAdjudication(f.verdict,f.task),text);f.atom.support='insufficient';f.atom.probability=.3;f.atom.uncertainty='Static imagery cannot establish the conclusion';f.verdict.findings[0].decision='reject';assert(ef.validAdjudication(f.verdict,f.task),text);
 }
});
test('legacy results retain their historical validation semantics and are not rewritten',()=>{
 const f=fixture('The image is contextually appropriate.');f.task.modelConfig.schemaVersion='hybrid-v1';const before=structuredClone(f);assert(ef.validAdjudication(f.verdict,f.task));assert.deepEqual(f,before);assert(!g.hardened(f.task));assert.equal(vm.HYBRID.schemaVersion,g.VERSION);
});
test('blind projection exposes only contract version; model config extras and verdict claims remain absent',()=>{
 const f=fixture();f.task.stage='observe';f.task.modelConfig.private='PRIVATE';const p=ef.project(f.task);assert.deepEqual(p.modelConfig,{schemaVersion:g.VERSION});assert(!JSON.stringify(p).includes('PRIVATE'));assert.deepEqual(Object.keys(ef.input(p)),['images']);
});
