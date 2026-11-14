'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const evaluation=require('../lib/agent-operations-quality-evaluation'),dataset=require('../docs/qa-evaluation/phase-a-cases.json');
const perfect=()=>dataset.cases.map(c=>({caseId:c.id,decision:c.gold.decision,observations:[...c.gold.observations],evidence:[{imageId:c.imageId,region:[...c.gold.regions[0]]}],uncertainty:c.gold.decision==='insufficient'?'The available visual evidence does not establish this claim.':''}));
test('twenty bounded atomic cases bind immutable original Pina evidence and retain all three truth classes',()=>{
 assert.equal(evaluation.validateDataset(dataset).cases,20);assert.equal(dataset.reference.workflowId,'wf_66960665244af030469b00672dead78e');
 assert.equal(dataset.reference.evidenceHash,'b4c4fedbba574a5cadf659efe21e1a5d45b135b6126b52f36ce57391e36e1ba8');
 assert.deepEqual([...new Set(dataset.cases.map(c=>c.gold.decision))].sort(),['contradicted','insufficient','supported']);
});
test('blind projection exposes original evidence references but no claims, private gold or expected decisions',()=>{
 const changed=structuredClone(dataset);changed.privateExpected='DO_NOT_LEAK_GOLD';changed.cases[0].gold.secret='DO_NOT_LEAK_GOLD';changed.cases[0].expectedVerdict='DO_NOT_LEAK_GOLD';changed.reference.images[0].privateGold='DO_NOT_LEAK_GOLD';
 const view=evaluation.publicCase(changed,'E01',{stage:'observe'}),serialized=JSON.stringify(view);
 assert(!serialized.includes('DO_NOT_LEAK_GOLD'));assert(!serialized.includes(changed.cases[0].statement));assert(!Object.hasOwn(view,'claim'));assert(!serialized.includes('rationale'));assert(!serialized.includes('gold'));assert.deepEqual(Object.keys(view.evidence),['workflowId','evidenceHash','observationHash','images']);
});
test('adjudication projection exposes only the independent claim and original evidence, never gold labels',()=>{
 for(const c of dataset.cases){const view=evaluation.publicCase(dataset,c.id);assert.deepEqual(view.claim,{statement:c.statement,imageId:c.imageId,region:c.region});assert(!JSON.stringify(view).includes(c.gold.rationale));assert(!Object.hasOwn(view,'gold'));assert(/^E\d{2}$/.test(view.caseId));}
 assert.throws(()=>evaluation.publicCase(dataset,'unknown'));assert.throws(()=>evaluation.publicCase(dataset,'E01',{stage:'owner-acceptance'}));
});
test('perfect deterministic fixture scores exact completion and evidence while never establishing live accuracy or permissions',()=>{
 const r=evaluation.evaluate(dataset,perfect());assert.equal(r.counts.completed,20);assert.equal(r.counts.invalidPredictions,0);assert.equal(r.metrics.decisionAccuracy,1);assert.equal(r.metrics.evidenceGroundedAccuracy,1);assert.equal(r.metrics.citationPrecision,1);assert.equal(r.metrics.falseApprovalRate,0);assert.equal(r.metrics.falseContradictionRate,0);assert.equal(r.metrics.unnecessaryAbstentionRate,0);assert.equal(r.metrics.insufficientRecall,1);assert.equal(r.metrics.supportedRetention,1);
 for(const k of ['liveAccuracyVerified','acceptanceAuthority','paidPermission','writePermission'])assert.equal(r[k],false);assert.equal(r.calibration.verified,false);
});
test('false approval, false contradiction and unnecessary abstention remain distinct measurable errors',()=>{
 const p=perfect();p.find(x=>x.caseId==='E03').decision='supported';p.find(x=>x.caseId==='E11').decision='supported';p.find(x=>x.caseId==='E01').decision='contradicted';p.find(x=>x.caseId==='E07').decision='insufficient';p.find(x=>x.caseId==='E07').uncertainty='Conservative abstention despite readable size evidence.';
 const r=evaluation.evaluate(dataset,p);assert.equal(r.counts.falseApprovals,2);assert.equal(r.counts.falseContradictions,1);assert.equal(r.counts.unnecessaryAbstentions,1);assert.equal(r.counts.correctDecisions,16);assert.equal(r.counts.supportedRetained,6);assert.equal(r.metrics.falseApprovalRate,2/12);assert.equal(r.metrics.falseContradictionRate,1/8);assert.equal(r.metrics.unnecessaryAbstentionRate,1/8);
});
test('same decision with unrelated observation, wrong image or whole-image region fails evidence-grounded accuracy',()=>{
 for(const change of [p=>p.observations=['O1'],p=>p.evidence[0].imageId='I1',p=>p.evidence[0].region=[0,0,1,1]]){
  const p=perfect();change(p.find(x=>x.caseId==='E10'));const r=evaluation.evaluate(dataset,p);assert.equal(r.metrics.decisionAccuracy,1);assert(r.metrics.citationPrecision<1);assert.equal(r.metrics.evidenceGroundedAccuracy,19/20);assert.equal(r.results.find(x=>x.caseId==='E10').evidenceRelevant,false);
 }
});
test('missing, duplicate, invented and malformed results cannot create a complete evaluation',()=>{
 const p=perfect();p.pop();p.push(structuredClone(p[0]));p.push({...p[1],caseId:'E99'});p.find(x=>x.caseId==='E03').uncertainty='';const r=evaluation.evaluate(dataset,p);
 assert.equal(r.counts.completed,17);assert.equal(r.counts.missing,3);assert(r.counts.invalidPredictions>=4);assert.equal(r.metrics.completionRate,17/20);assert.equal(r.metrics.decisionAccuracy,17/20);
});
test('empty outcomes expose missing work and undefined citation precision, never a zero-error success',()=>{
 const r=evaluation.evaluate(dataset,[]);assert.equal(r.counts.completed,0);assert.equal(r.counts.missing,20);assert.equal(r.metrics.decisionAccuracy,0);assert.equal(r.metrics.citationPrecision,null);assert.equal(r.metrics.supportedRetention,0);
});
test('recorded-response replay requires exact historical bindings and remains explicitly non-live evidence',()=>{
 assert.throws(()=>evaluation.evaluate(dataset,perfect(),{source:'frozen-response-replay'}));
 const replayBinding=Object.fromEntries(['workflowId','evidenceHash','observationHash','historicalQaHash'].map(k=>[k,dataset.reference[k]]));
 const r=evaluation.evaluate(dataset,perfect(),{source:'frozen-response-replay',replayBinding});assert.equal(r.liveAccuracyVerified,false);assert.match(r.referenceBinding,/not a provider attestation/);
 for(const k of Object.keys(replayBinding))assert.throws(()=>evaluation.evaluate(dataset,perfect(),{source:'frozen-response-replay',replayBinding:{...replayBinding,[k]:'mismatch'}}));
 assert.throws(()=>evaluation.evaluate(dataset,perfect(),{source:'live-model'}));
});
test('private gold corruption, duplicate IDs, malformed evidence and unbounded predictions fail closed',()=>{
 for(const mutate of [d=>d.cases[0].gold.decision='accept',d=>d.cases[1].id=d.cases[0].id,d=>d.cases[0].region=[0,0,0,1],d=>d.reference.images[0].sha256='bad',d=>d.cases[0].gold.observations=['unknown'],d=>d.cases=d.cases.slice(0,15)]){const d=structuredClone(dataset);mutate(d);assert.throws(()=>evaluation.validateDataset(d));}
 assert.throws(()=>evaluation.evaluate(dataset,Array.from({length:129},()=>perfect()[0])));
});
test('evaluation and projection do not mutate historical references, cases or predictions',()=>{
 const before=JSON.stringify(dataset),p=perfect(),predictionsBefore=JSON.stringify(p);evaluation.evaluate(dataset,p);const view=evaluation.publicCase(dataset,'E01');view.evidence.images[0].sha256='changed';view.claim.region[0]=.5;assert.equal(JSON.stringify(dataset),before);assert.equal(JSON.stringify(p),predictionsBefore);
});
test('pure evaluator contains no network, secret-reading, process execution or permission-grant implementation',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../lib/agent-operations-quality-evaluation.js'),'utf8');assert(!/require\(['"](?:node:)?(?:fs|http|https|net|child_process)['"]\)|\bfetch\s*\(|process\.env|OPENAI_API_KEY/.test(source));
});
