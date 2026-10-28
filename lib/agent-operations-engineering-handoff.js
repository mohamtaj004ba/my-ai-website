'use strict';
// One shared stage handoff contract. This version marker selects serialization,
// never authority. It is minted by the backend and covered by runtime bindings.
// Missing markers replay historical contracts without changing their bytes.
const VERSION='engineering-handoff-v2';
const equal=require('node:util').isDeepStrictEqual;
function enabled(c){
 const r=c?.binding?.runtime;
 if(!r||!Object.hasOwn(r,'engineeringContract'))return false;
 if(r.engineeringContract!==VERSION)throw Error('ENG_AI_CONTEXT');
 return require('./agent-operations-implementation').enabled(c);
}
function runtime(base){return {...base,engineeringContract:VERSION};}
// Bounded serialization envelopes, not token counts or spending authority.
// Rich multi-file reports exceed the historical copy-only envelopes. Exact
// provider counting and per-stage output-token limits remain unchanged.
function payloadLimits(c){return enabled(c)?{requestBytes:65536,outputBytes:32768,providerBytes:131072}:{requestBytes:32768,outputBytes:16000,providerBytes:65536};}
function issue(location,mismatch){throw Object.assign(Error('ENG_AI_REPORT_QUALITY'),{validationIssue:{location,mismatch}});}
const previous=(c,stage)=>c.priorReceipts.find(r=>r.stage===stage)?.response;
function criteria(c){
 const rows=previous(c,'chief-plan')?.completionCriteria;
 if(!Array.isArray(rows)||!rows.length||rows.length>4||new Set(rows).size!==rows.length||rows.some(x=>typeof x!=='string'||!x.trim()))issue('$.completionCriteria','criteria-coverage');
 return rows;
}
function requirements(c){
 const phone=require('./agent-operations-phone-search');
 if(phone.enabled(c))return phone.snapshot().criteria;
 return require('./agent-operations-implementation-tasks').descriptor(c)?.criteria||[];
}
function data(c){
 return {version:VERSION,taskRequirements:requirements(c),acceptanceCriteria:c.priorReceipts.length?criteria(c).map((text,i)=>({criterion:i+1,text})):[],qualification:'Task requirements define scope. acceptanceMapping refers only to numbered Chief acceptanceCriteria. Review decisions and test outcomes never grant execution or publication.'};
}
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const en=value=>({type:typeof value,enum:[value]});
function schema(stage,original,c){
 if(!enabled(c))return original;
 const s=structuredClone(original),p=s.properties;
 if(stage==='specialist'){
  const count=criteria(c).length;
  for(const mapping of [p.acceptanceMapping,p.proposal?.properties?.acceptanceMapping].filter(Boolean)){
   mapping.minItems=mapping.maxItems=count;
   mapping.items.properties.criterion={type:'integer',enum:Array.from({length:count},(_,i)=>i+1)};
  }
 }
 if(stage==='qa'){
  const findings=previous(c,'specialist')?.findings;
  if(!Array.isArray(findings)||!findings.length)throw Error('ENG_AI_QA_COMPLETENESS');
  const base=p.decisions.items;
  p.decisions.minItems=p.decisions.maxItems=findings.length;
  p.decisions.items={anyOf:findings.map(f=>{
   const row=structuredClone(base);
   row.properties.findingId=en(f.id);
   row.properties.evidenceIds.items={type:'string',enum:[...f.evidenceIds]};
   row.properties.evidenceIds.maxItems=f.evidenceIds.length;
   return row;
  })};
 }
 if(stage==='chief-final'){
  const qa=previous(c,'qa'),audit=previous(c,'auditor');
  if(!qa||!audit)throw Error('ENG_AI_FINAL_AUTHORITY');
  p.findings.minItems=p.findings.maxItems=qa.decisions.length;
  p.findings.items={anyOf:qa.decisions.map(d=>object({findingId:en(d.findingId),qaDecision:en(d.decision),reason:en(d.reason),evidenceIds:{type:'array',items:{type:'string',enum:[...d.evidenceIds]},minItems:d.evidenceIds.length,maxItems:d.evidenceIds.length}}))};
  p.auditDecision=en(audit.decision);p.acceptedWork=en(false);
 }
 return s;
}
function validate(stage,value,c){
 if(!enabled(c))return;
 if(stage==='chief-plan'){
  // Only objective structural incompleteness blocks the next paid stage.
  // Punctuation/style and semantic sufficiency remain separately reviewed.
  if(new Set(value.completionCriteria).size!==value.completionCriteria.length)issue('$.completionCriteria','criteria-coverage');
  for(const [i,text]of value.completionCriteria.entries()){
   if(/(?:[,;:=<>≤≥+*/\\-]|\.\.\.|…)\s*$/.test(text)||/\b(?:and|or|including|because|unless|until)\s*[.!?]?$/i.test(text))issue('$.completionCriteria['+i+']','incomplete-criterion');
  }
 }
 if(stage==='specialist'){
  const expected=criteria(c).map((_,i)=>i+1);
  for(const [rows,path]of [[value.acceptanceMapping,'$.acceptanceMapping'],[value.proposal?.acceptanceMapping,'$.proposal.acceptanceMapping']]){
   if(rows&&!equal(rows.map(x=>x.criterion).sort((a,b)=>a-b),expected))issue(path,'criteria-coverage');
  }
 }
}
function instructions(stage,c){
 if(!enabled(c))return '';
 let text=' Shared engineering handoff v2: workflowContract.taskRequirements define authorized scope; numbered acceptanceCriteria come from the actual Chief receipt. Do not confuse those two lists. Style warnings are advisory evidence for honest criticism, never automatic acceptance or rejection. ';
 if(stage==='chief-plan')text+='Write complete testable criteria covering the task requirements; do not end a criterion with an unfinished comparison or clause. ';
 if(stage==='specialist')text+='Produce exactly one acceptanceMapping row per numbered Chief acceptanceCriterion, using every index once; the schema fixes the count. ';
 if(stage==='qa')text+='Produce exactly one decision for each Specialist finding, with only that finding\'s evidence; do not add rows for criteria or edits. ';
 if(stage==='chief-final')text+='The schema fixes the prior QA values and Auditor decision; preserve them exactly, including evidence order. Report failure or rejection honestly; completing this report is not acceptance. ';
 return text;
}
function alignInstructions(text,c){
 if(!enabled(c))return text;
 return text.replace('Unresolved quality issues require Auditor fail and honest final limitations; model claims cannot resolve them.','Review recorded style observations on their merits; preserve their references and decide substantive adequacy independently.');
}
module.exports={VERSION,runtime,enabled,payloadLimits,criteria,data,schema,validate,instructions,alignInstructions};
