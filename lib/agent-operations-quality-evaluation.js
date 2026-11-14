'use strict';
// Pure offline scoring. Gold labels are never included in model-facing projections.
// This module cannot dispatch models, authorize work, or establish live accuracy.
const VERSION='quality-evaluation-v1',DECISIONS=new Set(['supported','contradicted','insufficient']);
const text=(v,n=1000)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const box=v=>Array.isArray(v)&&v.length===4&&v.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&v[0]<v[2]&&v[1]<v[3];
// A whole-image citation must not score as precise merely by intersecting a tiny
// target. Gold regions are explicit evaluation labels, never model input hints.
const relevantRegion=(a,b)=>{const width=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),height=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));return width*height/((a[2]-a[0])*(a[3]-a[1]))>=0.5;};
const ratio=(n,d)=>d?n/d:null;
function validateDataset(dataset){
 if(dataset?.version!==VERSION||dataset.purpose!=='offline-quality-evaluation'||!/^wf_[a-f0-9]{32}$/.test(dataset.reference?.workflowId||'')||!/^[a-f0-9]{40}$/.test(dataset.reference?.sourceCommit||'')||['evidenceHash','observationHash','historicalQaHash'].some(k=>!/^[a-f0-9]{64}$/.test(dataset.reference?.[k]||''))||!Array.isArray(dataset.reference?.images)||dataset.reference.images.length!==4||dataset.reference.images.some((im,i)=>im.id!=='I'+(i+1)||!/^[a-f0-9]{64}$/.test(im.sha256||'')))throw Error('Immutable evaluation reference required');
 if(!Array.isArray(dataset.cases)||dataset.cases.length<16||dataset.cases.length>64||new Set(dataset.cases.map(c=>c.id)).size!==dataset.cases.length)throw Error('Bounded unique evaluation cases required');
 for(const c of dataset.cases){
  if(!/^E[0-9]{2}$/.test(c.id||'')||!text(c.statement)||!dataset.reference.images.some(im=>im.id===c.imageId)||!box(c.region)||!DECISIONS.has(c.gold?.decision)||!text(c.gold?.rationale)||!Array.isArray(c.gold?.observations)||!c.gold.observations.length||new Set(c.gold.observations).size!==c.gold.observations.length||c.gold.observations.some(id=>!/^O[1-9][0-9]?$/.test(id))||!Array.isArray(c.gold?.regions)||!c.gold.regions.length||c.gold.regions.some(b=>!box(b)))throw Error('Evaluation case or private gold invalid');
 }
 return{valid:true,version:VERSION,cases:dataset.cases.length,liveAccuracyVerified:false};
}
function publicCase(dataset,id,{stage='adjudicate'}={}){
 validateDataset(dataset);if(!['observe','adjudicate'].includes(stage))throw Error('Evaluation projection stage denied');
 const c=dataset.cases.find(c=>c.id===id);if(!c)throw Error('Unknown evaluation case');
 // Allowlisted construction, never object spread or removal of known gold keys.
 const result={version:VERSION,caseId:c.id,stage,evidence:{workflowId:dataset.reference.workflowId,evidenceHash:dataset.reference.evidenceHash,observationHash:dataset.reference.observationHash,images:dataset.reference.images.map(im=>({id:im.id,sha256:im.sha256}))}};
 if(stage==='adjudicate')result.claim={statement:c.statement,imageId:c.imageId,region:[...c.region]};
 return result;
}
function validPrediction(p){return p&&/^E[0-9]{2}$/.test(p.caseId||'')&&DECISIONS.has(p.decision)&&Array.isArray(p.observations)&&p.observations.length>=1&&p.observations.length<=12&&new Set(p.observations).size===p.observations.length&&p.observations.every(id=>/^O[1-9][0-9]?$/.test(id))&&Array.isArray(p.evidence)&&p.evidence.length>=1&&p.evidence.length<=2&&p.evidence.every(e=>/^I[1-4]$/.test(e.imageId||'')&&box(e.region))&&(p.decision!=='insufficient'||text(p.uncertainty,200));}
function evaluate(dataset,predictions,{source='deterministic-fixture',replayBinding}={}){
 validateDataset(dataset);if(!['deterministic-fixture','frozen-response-replay'].includes(source)||!Array.isArray(predictions)||predictions.length>128)throw Error('Offline bounded evaluation only');
 if(source==='frozen-response-replay'&&['workflowId','evidenceHash','observationHash','historicalQaHash'].some(k=>replayBinding?.[k]!==dataset.reference[k]))throw Error('Recorded-response reference mismatch');
 const grouped=new Map(),ids=new Set(dataset.cases.map(c=>c.id));let invalid=0;
 for(const p of predictions){if(!ids.has(p?.caseId)){invalid++;continue;}const group=grouped.get(p.caseId)||[];group.push(p);grouped.set(p.caseId,group);}
 const counts={cases:dataset.cases.length,completed:0,missing:0,invalidPredictions:invalid,supportedGold:0,contradictedGold:0,insufficientGold:0,falseApprovals:0,falseContradictions:0,unnecessaryAbstentions:0,correctDecisions:0,insufficientRecognized:0,supportedRetained:0,citationReferences:0,relevantReferences:0,evidenceGroundedCorrect:0};const results=[];
 for(const c of dataset.cases){
  counts[c.gold.decision+'Gold']++;const group=grouped.get(c.id)||[],p=group[0];
  if(group.length!==1||!validPrediction(p)){counts.missing++;counts.invalidPredictions+=group.length;results.push({caseId:c.id,status:'invalid-or-missing'});continue;}
  counts.completed++;const correct=p.decision===c.gold.decision;
  if(correct)counts.correctDecisions++;
  if(p.decision==='supported'&&c.gold.decision!=='supported')counts.falseApprovals++;
  if(p.decision==='contradicted'&&c.gold.decision==='supported')counts.falseContradictions++;
  if(p.decision==='insufficient'&&c.gold.decision==='supported')counts.unnecessaryAbstentions++;
  if(c.gold.decision==='insufficient'&&p.decision==='insufficient')counts.insufficientRecognized++;
  if(c.gold.decision==='supported'&&p.decision==='supported')counts.supportedRetained++;
  const relevant=p.observations.filter(id=>c.gold.observations.includes(id)).length+p.evidence.filter(e=>e.imageId===c.imageId&&c.gold.regions.some(b=>relevantRegion(e.region,b))).length,total=p.observations.length+p.evidence.length;
  counts.citationReferences+=total;counts.relevantReferences+=relevant;
  if(correct&&relevant===total)counts.evidenceGroundedCorrect++;
  results.push({caseId:c.id,status:'scored',decisionCorrect:correct,evidenceRelevant:relevant===total});
 }
 const nonSupported=counts.contradictedGold+counts.insufficientGold;
 return{version:VERSION,source,referenceBinding:source==='frozen-response-replay'?'matched historical references; not a provider attestation':'deterministic fixture only',counts,metrics:{completionRate:ratio(counts.completed,counts.cases),falseApprovalRate:ratio(counts.falseApprovals,nonSupported),falseContradictionRate:ratio(counts.falseContradictions,counts.supportedGold),unnecessaryAbstentionRate:ratio(counts.unnecessaryAbstentions,counts.supportedGold),insufficientRecall:ratio(counts.insufficientRecognized,counts.insufficientGold),supportedRetention:ratio(counts.supportedRetained,counts.supportedGold),citationPrecision:ratio(counts.relevantReferences,counts.citationReferences),decisionAccuracy:ratio(counts.correctDecisions,counts.cases),evidenceGroundedAccuracy:ratio(counts.evidenceGroundedCorrect,counts.cases)},results,calibration:{verified:false,reason:'No empirical probability calibration is established by offline fixtures or contract thresholds.'},scope:'Deterministic fixture or recorded-response scoring only; not new live-model performance.',liveAccuracyVerified:false,acceptanceAuthority:false,paidPermission:false,writePermission:false};
}
module.exports={VERSION,validateDataset,publicCase,evaluate};
