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
function validate(stage,value,c){
 if(!enabled(c))return;
 const mapped=require('./agent-operations-implementation').evidenceMapped(c),ids=new Set(c.evidence.map(e=>e.id)),refs=(v,path)=>{if(new Set(v).size!==v.length)issue(path,mapped?'evidence-duplicate':'evidence-reference');if(v.some(id=>!ids.has(id)))issue(path,mapped?'evidence-unknown':'evidence-reference');};
 const visit=(v,path='$')=>{if(typeof v==='string'&&/^(?:placeholder|reason_placeholder|todo|tbd)$/i.test(v.trim()))issue(path,'placeholder');if(Array.isArray(v))v.forEach((x,i)=>visit(x,path+'['+i+']'));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))visit(x,path+'.'+k);};visit(value);
 if(stage==='chief-plan'){
  refs(value.sourceEvidenceIds,'$.sourceEvidenceIds');
  value.completionCriteria.forEach((criterion,i)=>{if(/\b(?:and|or|no|the|to|with|without|including|not)[.!?]$/i.test(criterion))issue('$.completionCriteria['+i+']','incomplete-criterion');});
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
 return value;
}
module.exports={MARKER,enabled,schema,instructions,validate,fixture};
