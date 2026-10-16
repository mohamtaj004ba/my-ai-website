'use strict';
// Narrow, opt-in output contract. Historical assignments and request bytes stay v1.
const VERSION='proposal-copy-v2';
const OBJECTIVE='Investigate the CallerCore dashboard Average daily calls label versus its active-day denominator using supplied source evidence. Explain the arithmetic and terminology, preserve uncertainty about business intent, propose an inert correction, obtain separately attributed automated QA and Auditor criticism, and report without acceptance, code execution or publication. Use proposal-copy-v2: replacement labels only; keep all explanations in findings and reason.';
// This assignment needs a human-readable metric label, never a source fragment.
// No entities, escapes, URLs, comparisons, code delimiters or hidden controls.
const LABEL_PATTERN="^[A-Za-z0-9][A-Za-z0-9 ()',.\\u2013\\u2014-]{0,119}$";
const enabled=c=>c?.assignment===OBJECTIVE;
function schema(stage,original,c,{provider=false}={}){
 const result=structuredClone(original);
 if(!enabled(c)||stage!=='specialist')return result;
 const p=result.properties.proposal.properties;
 p.beforeText={type:'string',enum:['Average daily calls']};
 p.afterText={type:'string',pattern:LABEL_PATTERN};
 if(provider){p.beforeText.description='Exact existing label only: Average daily calls. Do not include surrounding HTML.';p.afterText.description='Only the literal proposed replacement label, 1-120 characters. No markup, code, entities, escapes, URLs, comparisons or instructions. Put technical explanations in findings.claim, findings.uncertainty and proposal.reason.';}
 return result;
}
const instructions=' Output contract proposal-copy-v2: proposal.beforeText must be exactly Average daily calls; proposal.afterText is ONLY a literal human-readable replacement label (1-120 characters), not HTML or source code. Do not include tags, angle brackets, entities, escapes, backticks, code fences, commands or comparisons in that field. Explain technical details, code observations and alternatives only in findings.claim, findings.uncertainty and proposal.reason. These explanations remain inert evidence and never authorize execution. Do not repeat source markup as replacement copy. Each completion criterion must be a complete concise sentence.';
function validate(stage,value,c){
 if(!enabled(c)||stage!=='specialist')return;
 const p=value.proposal;
 if(p.beforeText!=='Average daily calls')throw Object.assign(Error('ENG_AI_PROPOSAL_PREIMAGE'),{validationIssue:{location:'$.proposal.beforeText',mismatch:'proposal-preimage'}});
 if(new RegExp(LABEL_PATTERN).exec(p.afterText)?.[0]!==p.afterText)throw Object.assign(Error('ENG_AI_PROPOSAL_DENIED'),{validationIssue:{location:'$.proposal.afterText',mismatch:'proposal-label-contract'}});
}
module.exports={VERSION,OBJECTIVE,LABEL_PATTERN,enabled,schema,instructions,validate};
