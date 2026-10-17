'use strict';
// Server-only assessment. Never include these outputs or curated labels in model input.
const {createHash}=require('node:crypto');
const geometry=require('./agent-operations-geometry');
const evaluation=require('./agent-operations-evaluation');
const ef=require('./agent-operations-evidence-first');
const REPRODUCTION_HASH='8b01219634343fe1e5159e55990d5009e71d3d907d4eec5157ffa5657e940121';
const SOURCE='8133597ff2fc5b48e3de42336e9e06fa4191c2a8';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function validatedDataset(dataset){
 if(hash(dataset)!==ef.EF.evaluationHash)throw Error('Adversarial evaluation reference mismatch');
 return dataset;
}
function trustedGeometry(record,scope){
 // A caller-supplied commit alone is not sufficient to trust arbitrary measurements.
 if(scope?.commit!==SOURCE||!record||hash(record)!==REPRODUCTION_HASH)return{status:'unknown',provenance:'unverified',originalCaptureGeometry:'unavailable',acceptedWork:false};
 return{...geometry.reproduction(record,scope),recordHash:REPRODUCTION_HASH,acceptedWork:false};
}
const normalized=r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r.every(n=>n>=0&&n<=1)&&r[0]<r[2]&&r[1]<r[3];
const area=r=>(r[2]-r[0])*(r[3]-r[1]);
function covers(region,target){
 if(!normalized(region)||!normalized(target))return 0;
 return Math.max(0,Math.min(region[2],target[2])-Math.max(region[0],target[0]))*Math.max(0,Math.min(region[3],target[3])-Math.max(region[1],target[1]))/area(target);
}
function observationAssessment(observation,binding,record,scope){
 const structural=ef.validObservation(observation,binding),g=trustedGeometry(record,scope);
 const result={structural:structural?'passed':'failed',imageCoverage:[],localization:[],warnings:[],geometry:g,visualAccuracy:'requires-independent-image-review',finalAcceptance:'pending-independent-image-review',acceptedWork:false};
 if(!structural){result.finalAcceptance='rejected';return result;}
 result.imageCoverage=binding.images.map(im=>({imageId:im.id,facts:observation.facts.filter(f=>f.imageId===im.id).length}));
 for(const fact of observation.facts){
  if(area(fact.region)>.5)result.warnings.push({factId:fact.id,kind:'coarse-region',reason:'More than half the image is cited; specific object localization is unverified.'});
  if(/\b(proves?|securely|confidentiality|industry.suitab|contextually appropriate)\b/i.test(fact.observed))result.warnings.push({factId:fact.id,kind:'inference-in-observation',reason:'An apparent suitability/security inference needs separate assessment; static images do not establish behavior or suitability.'});
 }
 if(g.status==='measured')for(const raw of record.results){
  const im=binding.images.find(i=>['I3','I4'].includes(i.id)&&i.viewport===raw.viewport.width);
  if(!im)continue;
  for(const object of ['badge','heading','price']){
   const r=raw[object].box,target=[r.x/im.viewport,r.y/im.height,r.right/im.viewport,r.bottom/im.height];
   const candidates=observation.facts.filter(f=>f.imageId===im.id).map(f=>({factId:f.id,coverage:covers(f.region,target),regionArea:area(f.region)}));
   // This is only a geometric screening aid. Text, glyphs and original capture coordinates remain unverified.
   result.localization.push({imageId:im.id,object,provenance:'reproduction-only',originalCaptureGeometry:'unavailable',targetRegion:target,candidates,localizedCandidate:candidates.some(c=>c.coverage>=.8&&c.regionArea<=.25),visualTruth:'unconfirmed'});
  }
 }
 result.measurableQuality={allImagesCovered:result.imageCoverage.every(i=>i.facts>0),coarseRegions:result.warnings.filter(w=>w.kind==='coarse-region').length,inferenceWarnings:result.warnings.filter(w=>w.kind==='inference-in-observation').length,reproductionObjectsLocalized:result.localization.filter(l=>l.localizedCandidate).length,reproductionObjects:result.localization.length};
 result.localizationScreening=result.warnings.length||result.localization.some(l=>!l.localizedCandidate)?'needs-focused-independent-review':'candidate-only-not-visual-proof';
 // No absence or presence of a reproduction rectangle can decide original screenshot truth.
 return result;
}
function admitCases(binding,dataset){
 validatedDataset(dataset);
 if(!ef.validBinding(binding))return{status:'failed',visual:[],integrity:[{id:'SOURCE',decision:'reject',reason:'Original evidence binding mismatch'}]};
 const integrity=[],visual=[];
 for(const c of dataset.cases){
  const im=binding.images.find(i=>i.id===c.imageId);
  if(!im)throw Error('Evaluation image missing');
  const suppliedHash=c.evidenceOverride?.sha256||im.sha256;
  if(suppliedHash!==im.sha256)integrity.push({id:c.id,decision:'reject',reason:'Evidence identity mismatch before model dispatch',expectedHash:im.sha256,suppliedHash});
  else visual.push({id:c.id,imageId:c.imageId,claim:c.claim});
 }
 return{status:integrity.length===1&&integrity[0].id==='C16'?'passed':'failed',visual,integrity};
}
function publicCases(dataset){
 validatedDataset(dataset);
 // Only for the second, post-seal request; never expose adjudication claims in blind observation.
 return dataset.cases.filter(c=>!c.evidenceOverride).map(c=>({id:c.id,imageId:c.imageId,claim:c.claim}));
}
function assessEvaluation({dataset,predictions=[],binding,observation,geometryRecord,scope,execution={}}){
 validatedDataset(dataset);
 const admission=admitCases(binding,dataset),visual=dataset.cases.filter(c=>c.gold.support!=='integrity');
 const ids=new Set(),valid=[];let malformed=0;
 for(const p of predictions){
  if(!p||ids.has(p.id)||!visual.some(c=>c.id===p.id)||!['accept','reject'].includes(p.decision)||!['supported','contradicted','insufficient'].includes(p.support)||!Number.isFinite(p.probability)||p.probability<0||p.probability>1||p.decision!==(p.support==='supported'?'accept':'reject')||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>500||!Array.isArray(p.evidence)||!p.evidence.length||p.evidence.length>3||!p.evidence.every(e=>e.imageId===visual.find(c=>c.id===p.id).imageId&&normalized(e.region))||typeof p.uncertainty!=='string'||p.uncertainty.length>300||(p.support==='insufficient'&&(!p.uncertainty.trim()||p.probability>.5))){malformed++;continue;}
  ids.add(p.id);valid.push(p);
 }
 const complete=valid.length===visual.length&&malformed===0&&predictions.length===visual.length;
 const supportMismatches=valid.filter(p=>p.support!==visual.find(c=>c.id===p.id).gold.support).length;
 const metrics=complete?{...evaluation.score(dataset.cases,valid),supportMismatches}:null;
 const observed={returned:valid.length,falseApprovals:valid.filter(p=>p.decision==='accept'&&visual.find(c=>c.id===p.id).gold.decision==='reject').length,falseRejections:valid.filter(p=>p.decision==='reject'&&visual.find(c=>c.id===p.id).gold.decision==='accept').length,supportMismatches,basis:'returned-valid-cases-only-not-full-benchmark'};
 const executionPassed=execution.attemptedRequests===2&&execution.completedResponses===2&&execution.retries===0&&execution.timedOut===false;
 const substantive=complete&&metrics.seedGatePassed&&supportMismatches===0?'passed':complete?'failed':'unassessed';
 const independentObservation=observationAssessment(observation,binding,geometryRecord,scope);
 return{execution:executionPassed?'completed':'incomplete',structural:complete?'passed':'failed',evidenceIntegrity:admission.status,completion:{visualReturned:valid.length,visualExpected:15,visualRate:valid.length/15,integrityRejected:admission.integrity.filter(i=>i.id==='C16').length,totalCases:16,malformed,complete},substantive,metrics,observed,observation:independentObservation,integrityChecks:admission.integrity,finalAcceptance:!complete||admission.status!=='passed'||!executionPassed||substantive==='failed'||independentObservation.structural==='failed'?'rejected':'pending-independent-image-review',acceptedWork:false,limitations:['Curated labels are not independently adjudicated benchmark truth.','All cases reuse four images; claim holdout does not measure unseen-image generalization.','Matching labels cannot validate reasons, region localization, readable text or faithful blind observations.','Reproduction geometry is separate from unavailable original capture-time DOM evidence.'],referenceHash:ef.EF.evaluationHash};
}
module.exports={REPRODUCTION_HASH,SOURCE,trustedGeometry,observationAssessment,admitCases,publicCases,assessEvaluation,covers};

