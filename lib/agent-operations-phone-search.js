'use strict';
// Source/patch preparation only. Not a registered live task, grant or executor.
const tools=require('./agent-operations-engineering-tools'),draft=require('./agent-operations-draft-proposal');
const {isDeepStrictEqual:equal}=require('node:util');
const PROFILE='client-phone-search-v1';
const SOURCE=Object.freeze({'dashboard.js':'37d1a7c38970ba3a82b3e3d97ac0aec12395dd5d6f8eb1e1fab51836f5a2de0c','lib/conversation-history.js':'1d36a9d0cf68e5d35c15e6d2df0c43557dd6e16d2ed05c2eb531164762406b23'});
const SITES=Object.freeze([
 Object.freeze({id:'calls',path:'dashboard.js',before:'!q||hay.includes(q)'}),
 Object.freeze({id:'follow-ups',path:'dashboard.js',before:"!q||[x.caller,x.phone,x.reason,x.address,callDispositionLabel(x),teamStatusLabel(x)].join(' ').toLowerCase().includes(q)"}),
 Object.freeze({id:'local-conversations',path:'dashboard.js',before:"!q||[x.name,x.phone,x.last,x.status,...(Array.isArray(x.messages)?x.messages:[]).map(m=>m.text)].join(' ').toLowerCase().includes(q)"}),
 Object.freeze({id:'contacts',path:'dashboard.js',before:"!q||[c.name,c.phone,c.address,kind,...c.services].join(' ').toLowerCase().includes(q)"}),
 Object.freeze({id:'paged-conversations',path:'lib/conversation-history.js',before:"[item&&item.name,item&&item.phone,item&&item.last,item&&item.status,...messages.map(message=>message&&message.text)].join(' ').toLowerCase().includes(options.q)"})
]);
const CRITERIA=Object.freeze([
 'Match digits-only and formatted phone queries across all five declared paths; retain current free-text matches.',
 'Specify and test partial-number and country-code behavior, empty/non-phone/mixed queries, and unrelated-record false positives.',
 'Preserve filters, sorting, paging/cursor binding, entitlements, authorization, read state, rendering and escaping.',
 'Provide source-bound patch, isolated verification evidence, impact/risks and separate QA/Auditor criticism; preserve unresolved findings.'
]);
const check=(v,c)=>{if(!v)throw Error(c);};
function snapshot(){
 const files=Object.entries(SOURCE).map(([path,sha256])=>{
  const text=tools.readPhoneSearchSource(path);check(tools.hash(text)===sha256,'PHONE_SEARCH_SOURCE_DRIFT');
  const sites=SITES.filter(s=>s.path===path).map(({id,before})=>{check(text.indexOf(before)>=0&&text.indexOf(before)===text.lastIndexOf(before),'PHONE_SEARCH_SITE_DRIFT');return{id,before};});
  return{path,text,sha256,sites};
 });
 const evidence=SITES.map(s=>{const file=files.find(f=>f.path===s.path),offset=file.text.indexOf(s.before),line=file.text.slice(0,offset).split('\n').length,text=file.text.split('\n')[line-1];return{id:s.id,path:s.path,line,text,sha256:file.sha256,excerptHash:tools.hash(text)};});
 return{profile:PROFILE,files,evidence,scopeHash:tools.hash(files.map(({path,sha256,sites})=>({path,sha256,sites}))),criteria:[...CRITERIA],executionAuthorized:false,publicationAllowed:false};
}
function context(binding){const s=snapshot();return{binding:structuredClone(binding),files:s.files};}
function validate(value,c){
 const s=snapshot();check(c&&equal(c.files,s.files),'PHONE_SEARCH_SOURCE_DRIFT');return draft.validateBundle(value,c);
}
function apply(value,c){validate(value,c);return draft.applyBundle(value,c);}
function parse(wire,c){require('./agent-operations-implementation-patch').assertUnambiguousJSON(wire);return validate(JSON.parse(wire),c);}
function schema(c){
 const s=snapshot();check(c&&equal(c.files,s.files),'PHONE_SEARCH_SOURCE_DRIFT');
 const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),en=v=>({type:'string',enum:[v]}),list=(items,n)=>({type:'array',items,minItems:n,maxItems:n});
 // Each location/preimage is a singleton enum. The Specialist authors only
 // replacement text; identity is never inferred from its prose.
 const files=c.files.map(file=>object({path:en(file.path),preimageSha256:en(file.sha256),edits:list({anyOf:file.sites.map(site=>object({offset:{type:'integer',enum:[file.text.indexOf(site.before)]},before:en(site.before),after:{type:'string',pattern:'^[\\s\\S]{1,2048}$'},beforeSha256:en(tools.hash(site.before))}))},file.sites.length)}));
 return object({version:en(draft.BUNDLE_VERSION),binding:object(Object.fromEntries(Object.entries(c.binding).map(([k,v])=>[k,en(v)]))),files:list({anyOf:files},2)});
}
function assignment(){const s=snapshot();return{profile:PROFILE,problem:'Digits-only phone searches miss formatted records across five client search paths.',impact:'A user pasting a telephone number can miss an existing record. Actual customer occurrence is not established.',criteria:s.criteria,scopeHash:s.scopeHash,evidence:s.evidence,scope:s.files.map(({path,sha256,sites})=>({path,sha256,sites})),restrictions:['Inert patch data only; no local generated-code execution.','No repository writes, publication, dependency changes, permissions or customer mutations.','Test execution requires separately qualified exact-profile isolation and fresh task/release authority.'],liveTaskRegistered:false};}
module.exports={PROFILE,snapshot,context,validate,apply,parse,schema,assignment};
