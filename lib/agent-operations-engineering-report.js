'use strict';
// Opt-in artifact quality only. This marker grants no task, tool or spending authority.
const MARKER=' Use engineering-report-v1: complete assignments and impact-qualified inert proposals.';
const enabled=c=>typeof c?.assignment==='string'&&c.assignment.endsWith(MARKER);
const str=n=>({type:'string',pattern:'^[\\s\\S]{1,'+n+'}$'}),list=(items,min=1,max=4)=>({type:'array',items,minItems:min,maxItems:max}),object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const refs=()=>list(str(80),1,4),impact=()=>object({assessment:str(350),basis:{type:'string',enum:['source-supported','hypothesis','unverified']},uncertainty:str(350)});
function schema(stage,original,c){
 if(!enabled(c))return original;
 const s=structuredClone(original),p=s.properties;
 if(stage==='chief-plan'){
  p.problem=str(400);p.sourceEvidenceIds=refs();p.intendedImpact=impact();p.scope=list(str(180));p.exclusions=list(str(180));p.uncertainty=str(350);p.deliverables=list(str(180));
  p.completionCriteria.items={type:'string',pattern:'^[\\s\\S]{1,159}[.!?]$'};
 }
 if(stage==='specialist'){
  p.rootCause=object({analysis:str(500),evidenceIds:refs(),uncertainty:str(350)});p.expectedImpact=impact();p.regressionRisks=list(str(220));p.affectedInterfaces=list(str(180));p.verificationStrategy=list(str(220));p.remainingUncertainty=str(350);
  p.acceptanceMapping=list(object({criterion:{type:'integer',minimum:1,maximum:4},status:{type:'string',enum:['supported','proposed','unverified']},explanation:str(220),evidenceIds:list(str(80),0,4)}),1,4);
 }
 s.required=Object.keys(p);return s;
}
const instructions=' Engineering report v1: Chief must state a source-backed problem, evidence IDs, qualified intended user impact, scope, exclusions, uncertainty and expected deliverables. Write complete testable criteria, not fragments; rephrase within each limit. Specialist must provide evidence-backed root cause, qualified expected impact, regression risks, affected interfaces, verification strategy, remaining uncertainty, and one acceptanceMapping entry per Chief criterion (one-based). Mark unobserved user impact as hypothesis or unverified; never invent observed customer results. Mapping status supported is a source claim, not approval. QA and Auditor independently criticize all quality fields, scope and missing evidence, including incomplete criteria and unsupported impact. Final Chief must retain every QA finding and any Auditor rejection. Replacement copy is a literal human-readable label only, never markup, entities, escapes, commands or technical explanations. This is inert proposal preparation, never execution, independent acceptance or publication.';
function issue(location,mismatch){throw Object.assign(Error('ENG_AI_REPORT_QUALITY'),{validationIssue:{location,mismatch}});}
const handoff=c=>require('./agent-operations-implementation-tasks').reviewHandoff(c);
const warningOnly=c=>require('./agent-operations-implementation-tasks').reviewQuality(c);
const QUALITY_VERSION='report-quality-review-v1';
const modern=c=>require('./agent-operations-engineering-handoff').enabled(c);
const qualityVersion=c=>modern(c)?'report-quality-review-v2':QUALITY_VERSION;
function auditReference(c){
 const r=c.priorReceipts.find(r=>r.stage==='auditor'),b=c.binding;
 if(!r||!r.binding||r.binding.planId!==b.planId||r.binding.ownerHash!==b.ownerHash||r.binding.workspaceHash!==b.workspaceHash||!require('node:util').isDeepStrictEqual(r.binding.runtime,b.runtime))issue('$.auditorReview','review-provenance');
 const {hash,receiptHash,...raw}=r,h=hash||receiptHash,tools=require('./agent-operations-engineering-tools');
 if(!/^[a-f0-9]{64}$/.test(h||'')||tools.hash(raw)!==h)issue('$.auditorReview','review-provenance');
 return{receiptHash:h,decision:r.response.decision,reasonHash:tools.hash(r.response.reason)};
}
// Narrative fields only: code replacements, source snippets, IDs and hashes are data.
function narratives(stage,v){
 const out=[],one=(x,p)=>out.push([x,p]),many=(xs,p)=>xs.forEach((x,i)=>one(x,p+'['+i+']'));
 if(stage==='qa'){v.decisions.forEach((d,i)=>one(d.reason,'$.decisions['+i+'].reason'));one(v.uncertainty,'$.uncertainty');}
 if(stage==='auditor'){one(v.reason,'$.reason');many(v.risks,'$.risks');}
 if(stage==='chief-final'){one(v.summary,'$.summary');one(v.uncertainty,'$.uncertainty');}
 if(stage==='specialist'){
  for(const k of ['analysis','uncertainty'])one(v.rootCause[k],'$.rootCause.'+k);
  for(const k of ['assessment','uncertainty'])one(v.expectedImpact[k],'$.expectedImpact.'+k);
  one(v.remainingUncertainty,'$.remainingUncertainty');
  for(const k of ['regressionRisks','verificationStrategy'])many(v[k],'$.'+k);
  v.findings.forEach((f,i)=>{one(f.claim,'$.findings['+i+'].claim');one(f.uncertainty,'$.findings['+i+'].uncertainty');});
  // Source-bundle replacements are untrusted code DATA, not prose quality.
  if(Array.isArray(v.proposal.edits)){
   v.proposal.edits.forEach((e,i)=>one(e.explanation,'$.proposal.edits['+i+'].explanation'));
   one(v.proposal.expectedBehavior,'$.proposal.expectedBehavior');for(const k of ['risks','verification'])many(v.proposal[k],'$.proposal.'+k);
  }
  if(Array.isArray(v.proposal.changes))v.proposal.changes.forEach((change,i)=>one(change.explanation,'$.proposal.changes['+i+'].explanation'));
  for(const [xs,p]of [[v.acceptanceMapping,'$.acceptanceMapping'],[v.proposal.acceptanceMapping||[],'$.proposal.acceptanceMapping']])xs.forEach((m,i)=>one(m.explanation,p+'['+i+'].explanation'));
 }
 return out;
}
function qualityNarratives(stage,v){
 if(stage!=='chief-plan')return narratives(stage,v);
 const out=[];for(const k of ['objective','reason','problem','uncertainty'])out.push([v[k],'$.'+k]);
 for(const k of ['scope','exclusions','deliverables','completionCriteria'])v[k].forEach((x,i)=>out.push([x,'$.'+k+'['+i+']']));
 for(const k of ['assessment','uncertainty'])out.push([v.intendedImpact[k],'$.intendedImpact.'+k]);return out;
}
function qualityIssues(stage,value){
 // Closed, syntactic observations only. They cannot establish semantic quality.
 const issues=[];for(const [text,location]of qualityNarratives(stage,value)){
  let code=null;
  if(!/[.!?]$/.test(text))code='missing-terminal-punctuation';
  else if(/(?:\.\.\.|…)[.!?]?$/.test(text))code='trailing-ellipsis';
  else if(/\b(?:and|or|to|with|without|including|for|of|as|by|from|into|than|because|unless|until|a|an|the)[.!?]$/i.test(text))code='terminal-word-heuristic';
  else if(stage==='chief-plan'&&location.startsWith('$.completionCriteria[')&&/\b(?:no|not)[.!?]$/i.test(text))code='terminal-word-heuristic';
  if(code)issues.push({location,code});
 }
 if(issues.length>64)issue('$','quality-review-provenance');return issues;
}
function qualityReview(c){
 const tools=require('./agent-operations-engineering-tools'),equal=require('node:util').isDeepStrictEqual,stages=['chief-plan','specialist','qa','auditor','chief-final'],assessments=[];
 if(!warningOnly(c))return{version:QUALITY_VERSION,assessments,requiredReviewRefs:[],unresolved:false,semanticQualityVerified:false};
 if(!Array.isArray(c.priorReceipts)||c.priorReceipts.length>5)issue('$','quality-review-provenance');
 for(const [i,r]of c.priorReceipts.entries()){
  const {hash,receiptHash,...raw}=r,h=hash||receiptHash,b=r.binding;
  if(r.stage!==stages[i]||!/^[a-f0-9]{64}$/.test(h||'')||tools.hash(raw)!==h||!b||b.planId!==c.binding.planId||b.ownerHash!==c.binding.ownerHash||b.workspaceHash!==c.binding.workspaceHash||!equal(b.runtime,c.binding.runtime))issue('$','quality-review-provenance');
  const issues=qualityIssues(r.stage,r.response),priorReviewRefs=assessments.map(x=>x.hash),expected={version:qualityVersion(c),issues,priorReviewRefs};
  if(!equal(r.reportQuality,expected))issue('$','quality-review-provenance');
  if(issues.length){const body={version:qualityVersion(c),stage:r.stage,receiptHash:h,bindingHash:tools.hash(b),responseHash:tools.hash(r.response),issues};assessments.push({...body,hash:tools.hash(body)});}
 }
 return{version:qualityVersion(c),assessments,requiredReviewRefs:assessments.map(x=>x.hash),unresolved:!modern(c)&&assessments.length>0,...(modern(c)?{advisoryIssuesPresent:assessments.length>0}:{}),semanticQualityVerified:false};
}
function qualityRecord(stage,value,c){return{version:qualityVersion(c),issues:qualityIssues(stage,value),priorReviewRefs:qualityReview(c).requiredReviewRefs};}
function qualityOutcome(c,receipts){const review=qualityReview({...c,priorReceipts:receipts}),failedTests=modern(c)&&receipts.some(r=>r.sourceTestEvidence?.receipt?.result?.testsPassed===false);return{version:qualityVersion(c),unresolved:review.unresolved,...(modern(c)?{advisoryIssuesPresent:review.advisoryIssuesPresent,knownTestFailure:failedTests}:{}),assessmentHashes:review.requiredReviewRefs,technicalReviewPassed:!review.unresolved&&!failedTests&&receipts.at(-1)?.response.auditDecision==='pass',semanticQualityVerified:false,independentlyAccepted:false};}
function handoffSchema(stage,s,c){
 if(!handoff(c))return s;
 // Use the same field selection as validation, avoiding repeated per-field prose.
 const sample=(node)=>node.type==='object'?Object.fromEntries(Object.entries(node.properties).map(([k,v])=>[k,sample(v)])):node.type==='array'?[sample(node.items)]:'';
 const advisory=warningOnly(c);
 for(const [,path]of (advisory?qualityNarratives:narratives)(stage,sample(s))){let node=s;for(const part of path.slice(2).split(/\.|\[|\]/).filter(Boolean))node=/^\d+$/.test(part)?node.items:node.properties[part];const max=Number(node.pattern?.match(/1,(\d+)/)?.[1]);if(max>1){if(advisory){if(node.pattern.endsWith('[.!?]$'))node.pattern='^[\\s\\S]{1,'+(max+1)+'}$';}else node.pattern='^[\\s\\S]{1,'+(max-1)+'}[.!?]$';}}
 if(stage==='chief-final'){const ref=auditReference(c);s.properties.auditorReview=object(Object.fromEntries(Object.entries(ref).map(([k,v])=>[k,{type:'string',enum:[v]}])));s.required=Object.keys(s.properties);}
 if(advisory){const review=qualityReview(c),refs=review.requiredReviewRefs;s.properties.qualityReviewRefs={type:'array',items:refs.length?{type:'string',enum:refs}:{type:'string'},minItems:refs.length,maxItems:refs.length};s.required=Object.keys(s.properties);if(review.unresolved&&stage==='auditor')s.properties.decision.enum=['fail'];if(review.unresolved&&stage==='chief-final')s.properties.auditDecision.enum=['fail'];}
 return s;
}
function validate(stage,value,c){
 if(!enabled(c))return;
 const mapped=require('./agent-operations-implementation').evidenceMapped(c),ids=new Set(c.evidence.map(e=>e.id)),refs=(v,path)=>{if(new Set(v).size!==v.length)issue(path,mapped?'evidence-duplicate':'evidence-reference');if(v.some(id=>!ids.has(id)))issue(path,mapped?'evidence-unknown':'evidence-reference');};
 const visit=(v,path='$')=>{if(typeof v==='string'&&/^(?:placeholder|reason_placeholder|todo|tbd)$/i.test(v.trim()))issue(path,'placeholder');if(Array.isArray(v))v.forEach((x,i)=>visit(x,path+'['+i+']'));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))visit(x,path+'.'+k);};visit(value);
 if(warningOnly(c)){const review=qualityReview(c);if(!require('node:util').isDeepStrictEqual(value.qualityReviewRefs,review.requiredReviewRefs))issue('$.qualityReviewRefs','quality-review-reference');if(review.unresolved&&stage==='auditor'&&value.decision!=='fail')issue('$.decision','quality-review-unresolved');if(review.unresolved&&stage==='chief-final'&&value.auditDecision!=='fail')issue('$.auditDecision','quality-review-unresolved');}
 if(handoff(c)){
  if(!warningOnly(c))for(const [text,path]of narratives(stage,value))if(!/[.!?]$/.test(text)||/\b(?:and|or|to|with|without|including|for|of|as|by|from|into|than|because|unless|until|a|an|the)[.!?]$/i.test(text)||/(?:\.\.\.|…)[.!?]?$/.test(text))issue(path,'incomplete-statement');
  if(stage==='chief-final'){
   if(!require('node:util').isDeepStrictEqual(value.auditorReview,auditReference(c)))issue('$.auditorReview','review-reference');
   const claim=/\bauditor(?:['’]s)?(?:\s+(?:reason|rejection|review))?\s*[,;:]?\s*(?:(?:has been|is|was|remains)\s+)?(?:fully\s+)?(?:preserved|copied|quoted|reproduced)\s+(?:here\s+)?verbatim\b/i;
   const original=c.priorReceipts.find(r=>r.stage==='auditor').response.reason;
   for(const k of ['summary','uncertainty'])if(claim.test(value[k])&&!value[k].includes(original))issue('$.'+k,'unsupported-verbatim-claim');
  }
 }
 if(stage==='chief-plan'){
  refs(value.sourceEvidenceIds,'$.sourceEvidenceIds');
  if(require('./agent-operations-implementation').proseQuality(c)&&!warningOnly(c)){
   const whole=(text,path)=>{if(!/[.!?]$/.test(text)||/\b(?:and|or|to|with|without|including|for|of|as|by|from|into|than|because|unless|until|a|an|the)[.!?]$/i.test(text))issue(path,'incomplete-statement');};
   for(const key of ['objective','reason','problem','uncertainty'])whole(value[key],'$.'+key);
   for(const key of ['scope','exclusions','deliverables'])value[key].forEach((text,i)=>whole(text,'$.'+key+'['+i+']'));
  }
  if(!warningOnly(c))value.completionCriteria.forEach((criterion,i)=>{if(/\b(?:and|or|no|the|to|with|without|including|not)[.!?]$/i.test(criterion))issue('$.completionCriteria['+i+']','incomplete-criterion');});
 }
 if(stage==='specialist'){
  refs(value.rootCause.evidenceIds,'$.rootCause.evidenceIds');
  const criteria=c.priorReceipts.find(r=>r.stage==='chief-plan')?.response?.completionCriteria;
  if(!criteria||value.acceptanceMapping.length!==criteria.length||new Set(value.acceptanceMapping.map(m=>m.criterion)).size!==criteria.length||value.acceptanceMapping.some(m=>m.criterion>criteria.length))issue('$.acceptanceMapping','criteria-coverage');
  value.acceptanceMapping.forEach((m,i)=>{refs(m.evidenceIds,'$.acceptanceMapping['+i+'].evidenceIds');if(m.status==='supported'&&!m.evidenceIds.length)issue('$.acceptanceMapping['+i+'].evidenceIds',mapped?'evidence-required':'evidence-reference');});
 }
}
// Explicit deterministic substitutes for offline restricted-worker verification.
// Never an AI reasoning result or acceptance decision.
function fixture(stage,value,c){
 if(!enabled(c))return value;
 const ids=c.evidence.map(e=>e.id),impact={assessment:'A source-accurate label may improve understanding of this metric.',basis:'hypothesis',uncertainty:'No observed customer interpretation or business acceptance.'};
 if(stage==='chief-plan')Object.assign(value,{problem:'Supplied source terminology requires bounded review.',sourceEvidenceIds:ids,intendedImpact:impact,scope:['Supplied dashboard source copy only.'],exclusions:['No execution, publication or acceptance.'],uncertainty:'Business intent and rendered impact unverified.',deliverables:['Inert source-backed proposal and separately attributed criticism.']});
 if(stage==='specialist')Object.assign(value,{rootCause:{analysis:'The source label does not explicitly name its active-day denominator.',evidenceIds:ids,uncertainty:'Intended business definition remains unverified.'},expectedImpact:impact,regressionRisks:['Copy can misstate intended product meaning.'],affectedInterfaces:['Client dashboard metric label.'],verificationStrategy:['Check source and rendered copy using fictional data.'],remainingUncertainty:'Deterministic substitute only; no observed customer benefit.',acceptanceMapping:c.priorReceipts.find(r=>r.stage==='chief-plan').response.completionCriteria.map((_,i)=>({criterion:i+1,status:'proposed',explanation:'Source-backed proposal retained for review, not accepted.',evidenceIds:ids}))});
 if(warningOnly(c))value.qualityReviewRefs=qualityReview(c).requiredReviewRefs;
 return value;
}
module.exports={MARKER,enabled,schema,instructions,validate,fixture,auditReference,handoffSchema,qualityIssues,qualityReview,qualityRecord,qualityOutcome};
