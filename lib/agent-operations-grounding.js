'use strict';
// Deterministic admission checks, not proof of semantic truth. Independent image review remains required.
const VERSION='hybrid-grounding-v2';
const hardened=t=>t?.profile==='hybrid-visual-qa'&&t.modelConfig?.schemaVersion===VERSION;
function outsideVisualEvidence(text){
 return /\b(contextually appropriate|directly relevant|suitability|industry[- ]appropriate|confidential|secure(?:ly)?|no correction|correction not required|narrative|keyboard focus|accessible modal|DOM|CSS pixels)\b/i.test(text);
}
function intersects(a,b){
 const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 const smaller=Math.min((a[2]-a[0])*(a[3]-a[1]),(b[2]-b[0])*(b[3]-b[1]));
 return smaller>0&&intersection/smaller>=.1;
}
function validAtom(a,claim,t){
 const facts=t.results.qaObservation.result.facts,refs=a.observations.map(id=>facts.find(o=>o.id===id));
 // Every reference AND every direct region must be anchored; one valid reference cannot mask an unrelated one.
 if(refs.some(o=>!o||o.imageId!==claim.imageId||!a.evidence.some(e=>e.imageId===o.imageId&&intersects(e.region,o.region))))return false;
 if(a.evidence.some(e=>!refs.some(o=>o&&e.imageId===o.imageId&&intersects(e.region,o.region))))return false;
 const original=claim.atoms.find(x=>x.id===a.id);
 // No functional inspection or independently approved suitability criteria exist in this static-image profile.
 if(outsideVisualEvidence(original?.text||'')&&a.support!=='insufficient')return false;
 return true;
}
const instructions=' Grounding contract: cite only sealed observations relevant to the specific claim and direct image region. Every cited observation must overlap a cited region on the same image, and every region must be anchored to a cited observation; never pad references with unrelated facts. If no relevant sealed observation exists, do not invent one or borrow a nearby fact. Static-image presence, nearby industry copy or narrative fit does not establish industry suitability, contextual appropriateness, confidentiality, security, behavior, accessibility, exact DOM/CSS measurements, or blanket no-correction conclusions. Mark such entire mixed atoms insufficient, probability<=0.5, with explicit uncertainty; preserve directly visible subfacts in the reason without accepting the unsupported conclusion. Reject a finding containing any insufficient or contradicted atom. No criteria or functional evidence is authorized in this profile. Spatial checks are screening only; semantic relevance and final acceptance still require independent review.';
module.exports={VERSION,hardened,outsideVisualEvidence,intersects,validAtom,instructions};
