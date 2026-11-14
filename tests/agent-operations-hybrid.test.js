'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const hybrid=require('../lib/agent-operations-hybrid'),ef=require('../lib/agent-operations-evidence-first');
const dataset=require('../docs/qa-evaluation/seed-cases.json'),record=require('../data/agent-operations-reproduction-geometry.json');
const source=require('./fixtures/agent-operations-qa-source.json'),binding=ef.binding(require('../lib/agent-operations-qa').sourceFor(source));
const observation=()=>({stage:'observe',facts:binding.images.map((im,i)=>({id:'O'+(i+1),imageId:im.id,region:[.01,.01,.99,.99],observed:'Offline interface visible',readability:'limited',uncertainty:'Offline fixture, not a model quality result'})),note:'Offline synthetic observations'});
const predictions=()=>dataset.cases.filter(c=>c.gold.support!=='integrity').map(c=>({id:c.id,decision:c.gold.decision,support:c.gold.support,probability:c.gold.support==='supported'?.95:.05,reason:'Offline expected classification; not model evidence',evidence:[{imageId:c.imageId,region:[.1,.1,.9,.9]}],uncertainty:c.gold.support==='insufficient'?'Static image cannot establish the claim':''}));
const fixture=()=>({dataset,predictions:predictions(),binding,observation:observation(),geometryRecord:record,scope:source.scope,execution:{attemptedRequests:2,completedResponses:2,retries:0,timedOut:false}});
test('hybrid preserves full 16-case baseline and admits only 15 genuine visual cases; no gold reaches public claims',()=>{
 const before=JSON.stringify(dataset),a=hybrid.admitCases(binding,dataset),claims=hybrid.publicCases(dataset);
 assert.equal(a.status,'passed');assert.equal(a.visual.length,15);assert.equal(a.integrity.length,1);assert.equal(a.integrity[0].id,'C16');assert.equal(a.integrity[0].decision,'reject');
 assert.deepEqual(claims,a.visual);assert(claims.every(c=>Object.keys(c).sort().join(',')==='claim,id,imageId'));assert(!JSON.stringify(claims).includes('gold'));assert(!JSON.stringify(claims).includes('evidenceOverride'));assert.equal(JSON.stringify(dataset),before);
});
test('model cannot substitute evaluation labels or evidence identities',()=>{
 const changed=structuredClone(dataset);changed.cases[0].gold.support='insufficient';assert.throws(()=>hybrid.publicCases(changed),/reference mismatch/);
 const b=structuredClone(binding);b.images[0].sha256='0'.repeat(64);const a=hybrid.admitCases(b,dataset);assert.equal(a.status,'failed');assert.equal(a.visual.length,0);
 assert.equal(hybrid.assessEvaluation({...fixture(),binding:b}).evidenceIntegrity,'failed');
});
test('trusted deterministic geometry pins complete record and source, records heading/price relation without inventing capture evidence',()=>{
 const g=hybrid.trustedGeometry(record,source.scope);assert.equal(g.status,'measured');assert.equal(g.provenance,'reproduction-only');assert.equal(g.originalCaptureGeometry,'unavailable');assert.equal(g.acceptedWork,false);
 assert.deepEqual(g.results.map(r=>r.heading.intersectionHeight),[24,21.6875]);assert(g.results.every(r=>r.heading.overlapCandidate&&!r.price.overlapCandidate&&!r.price.provenPaintedOcclusion));
 for(const r of [null,{...structuredClone(record),observedAt:'forged'},structuredClone(record)]){if(r?.results)r.results[0].price.box.y=0;assert.equal(hybrid.trustedGeometry(r,source.scope).status,'unknown');}
 assert.equal(hybrid.trustedGeometry(record,{...source.scope,commit:'different'}).status,'unknown');
});
test('coarse cited regions cannot masquerade as meaningful object localization or visual acceptance',()=>{
 const r=hybrid.observationAssessment(observation(),binding,record,source.scope);assert.equal(r.structural,'passed');assert.equal(r.measurableQuality.coarseRegions,4);assert.equal(r.measurableQuality.reproductionObjectsLocalized,0);assert.equal(r.measurableQuality.reproductionObjects,6);assert.equal(r.localizationScreening,'needs-focused-independent-review');assert.equal(r.visualAccuracy,'requires-independent-image-review');assert.equal(r.acceptedWork,false);
 const obs=observation();obs.facts[0].observed='The dashboard proves confidentiality and securely saves matters';assert(hybrid.observationAssessment(obs,binding,record,source.scope).warnings.some(w=>w.kind==='inference-in-observation'));
});
test('focused reproduction coordinates are screening aids and cannot certify original image truth',()=>{
 const obs=observation();for(const [i,raw]of record.results.entries()){const r=raw.badge.box;obs.facts[i+2].region=[r.x/raw.viewport.width,r.y/1000,r.right/raw.viewport.width,r.bottom/1000];}
 const r=hybrid.observationAssessment(obs,binding,record,source.scope);assert(r.localization.some(l=>l.localizedCandidate));assert(r.localization.every(l=>l.visualTruth==='unconfirmed'&&l.provenance==='reproduction-only'));assert.equal(r.finalAcceptance,'pending-independent-image-review');assert.equal(r.acceptedWork,false);
});
test('historical mobile coarse region and desktop incorrect Growth location are exposed by localization screening',()=>{
 const obs=observation();obs.facts[2].region=[.57,.34,.85,.57];obs.facts[2].observed='Growth features described outside this region';obs.facts[3].region=[.04,.13,.96,.68];
 const r=hybrid.observationAssessment(obs,binding,record,source.scope);assert.equal(r.localization.find(l=>l.imageId==='I3'&&l.object==='heading').localizedCandidate,false);assert.equal(r.localization.find(l=>l.imageId==='I4'&&l.object==='heading').localizedCandidate,false);assert.equal(r.localizationScreening,'needs-focused-independent-review');
});
test('complete correct mock classifications remain pending independent accuracy review, never accepted work',()=>{
 const r=hybrid.assessEvaluation(fixture());assert.equal(r.execution,'completed');assert.equal(r.structural,'passed');assert.equal(r.evidenceIntegrity,'passed');assert.equal(r.substantive,'passed');assert.equal(r.completion.totalCases,16);assert.equal(r.completion.visualRate,1);assert.equal(r.metrics.falseApprovals,0);assert.equal(r.metrics.falseRejections,0);assert.equal(r.finalAcceptance,'pending-independent-image-review');assert.equal(r.acceptedWork,false);
});
test('agreement-biased classifications record nine false approvals, five uncertainty failures and substantive rejection',()=>{
 const f=fixture();f.predictions=f.predictions.map(p=>({...p,support:'supported',decision:'accept',probability:1,uncertainty:''}));const r=hybrid.assessEvaluation(f);assert.equal(r.structural,'passed');assert.equal(r.metrics.falseApprovals,9);assert.equal(r.metrics.uncertaintyErrors,5);assert.equal(r.substantive,'failed');assert.equal(r.finalAcceptance,'rejected');
});
test('reject-all reviewer records six false rejections; uncertainty labels alone cannot pass the methodology',()=>{
 const f=fixture();f.predictions=f.predictions.map(p=>({...p,support:'insufficient',decision:'reject',probability:0,uncertainty:'Not established'}));const r=hybrid.assessEvaluation(f);assert.equal(r.metrics.falseRejections,6);assert.equal(r.metrics.supportMismatches,10);assert.equal(r.substantive,'failed');assert.equal(r.acceptedWork,false);
});
test('empty, partial, duplicate, unrelated and inconsistent verdicts remain incomplete; no fabricated benchmark score',()=>{
 for(const mutate of [f=>f.predictions=[],f=>f.predictions.pop(),f=>f.predictions[1]={...f.predictions[0]},f=>f.predictions.push({...f.predictions[0],id:'UNKNOWN'}),f=>f.predictions[0].decision='reject']){const f=fixture();mutate(f);const r=hybrid.assessEvaluation(f);assert.equal(r.structural,'failed');assert.equal(r.substantive,'unassessed');assert.equal(r.metrics,null);assert.equal(r.finalAcceptance,'rejected');assert.equal(r.acceptedWork,false);}
});
test('wrong image, nonfinite region, omitted uncertainty and empty reasoning rejected independently of correct labels',()=>{
 for(const mutate of [p=>p.evidence[0].imageId='I2',p=>p.evidence[0].region=[0,0,Infinity,1],p=>p.reason='',p=>{p.support='insufficient';p.decision='reject';p.probability=.2;p.uncertainty='';}]){const f=fixture();mutate(f.predictions[0]);assert.equal(hybrid.assessEvaluation(f).structural,'failed');}
});
test('execution failures, timeouts and retries remain distinct from correct model classifications and fail final acceptance',()=>{
 for(const change of [{completedResponses:1},{attemptedRequests:3,retries:1},{timedOut:true}]){const f=fixture();Object.assign(f.execution,change);const r=hybrid.assessEvaluation(f);assert.equal(r.structural,'passed');assert.equal(r.substantive,'passed');assert.equal(r.execution,'incomplete');assert.equal(r.finalAcceptance,'rejected');assert.equal(r.acceptedWork,false);}
});
test('region coverage is finite, bounded and sensitive to incorrect location; invalid observations fail closed',()=>{
 assert.equal(hybrid.covers([0,0,.5,.5],[0,0,.5,.5]),1);assert.equal(hybrid.covers([.6,.6,1,1],[0,0,.5,.5]),0);assert.equal(hybrid.covers([0,0,Infinity,1],[0,0,.5,.5]),0);
 const obs=observation();obs.facts.pop();assert.equal(hybrid.observationAssessment(obs,binding,record,source.scope).structural,'failed');
});

