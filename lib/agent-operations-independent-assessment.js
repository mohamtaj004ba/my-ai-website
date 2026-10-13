'use strict';
// Conservative independent acceptance, not a second model vote. Only the narrowly
// specified, capture-time measurable relationship can be accepted automatically.
const qa=require('./agent-operations-organization-qa');
const PRICE_SPACING='The price is below the badge with positive vertical spacing.';
function assess({workflow:w,images,signal}={}){
 if(signal?.aborted)throw Error('Independent assessment cancelled');
 if(!w||w.stage!=='acceptance'||w.evidence?.hash!==qa.hash(w.evidence?.images)||w.results?.specialist?.findingsHash!==qa.hash(w.results?.specialist?.findings)||w.results?.observation?.hash!==qa.hash(w.results?.observation?.result)||w.results?.qa?.hash!==qa.hash(w.results?.qa?.result))throw Error('Independent assessment evidence binding denied');
 require('./agent-operations-organization-model').verifiedImages(w.evidence,images);
 const claims=qa.claims(w.results.specialist.findings);
 if(!qa.adjudication(w.results.qa.result,{...w,claims}))throw Error('Independent assessment verdict binding denied');
 const g=w.geometry;
 let accepted=false;
 if(g?.status==='measured'&&g.provenance==='capture-time'){
  const raw={workflowId:w.id,executionId:w.evidence.executionId,sourceCommit:w.scope.commit,provenance:g.provenance,results:g.results,measurements:g.measurements};
  if(qa.hash(raw)!==g.hash||qa.hash(qa.geometry({...w,claims},raw))!==qa.hash(g))throw Error('Independent assessment geometry binding denied');
  accepted=w.outcomes?.substantive==='candidate'&&claims.every(c=>c.text===PRICE_SPACING&&['I3','I4'].includes(c.imageId)&&g.results.some(r=>r.imageId===c.imageId&&!r.priceOverlap&&r.priceGap>0));
 }
 return{accepted,reason:accepted?'Independent capture-time geometry confirms every narrowly measurable price-spacing finding. This is not general visual or industry-suitability acceptance.':'Independent acceptance is withheld: rejected, uncertain, or non-measurable findings require a trusted substantive reviewer. Model agreement alone does not establish acceptance.'};
}
module.exports={assess,PRICE_SPACING};
