'use strict';
// New findings are explicit claims. Historical sentence-derived claims stay unchanged.
const VERSION='atomic-findings-v1';
const kinds=['visible-object','text','layout','readability','suitability'];
const measurements=['','heading-overlap','price-overlap','price-spacing'];
const propositions=Object.freeze({'heading-overlap':'The badge overlaps the Growth heading.','price-overlap':'The badge overlaps the price.','price-spacing':'The price is below the badge with positive vertical spacing.'});
const keys=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const box=b=>Array.isArray(b)&&b.length===4&&b.every(x=>Number.isFinite(x)&&x>=0&&x<=1)&&b[0]<b[2]&&b[1]<b[3];
function schema(){
 const object=p=>({type:'object',properties:p,required:Object.keys(p),additionalProperties:false}),str=n=>({type:'string',pattern:'^[\\s\\S]{1,'+n+'}$'}),opt=n=>({type:'string',pattern:'^[\\s\\S]{0,'+n+'}$'});
 return object({code:{type:'string',pattern:'^[A-Z0-9_-]{1,80}$'},imageId:{type:'string',enum:['I1','I2','I3','I4']},note:str(1000),claims:{type:'array',minItems:1,maxItems:4,items:object({statement:str(400),kind:{type:'string',enum:kinds},region:{type:'array',items:{type:'number',minimum:0,maximum:1},minItems:4,maxItems:4},measurementRef:{type:'string',enum:measurements},uncertainty:opt(200)})},severity:{type:'string',enum:['low','medium','high']},businessImpact:str(300),recommendation:str(300)});
}
function valid(f){return keys(f,['code','imageId','note','claims','severity','businessImpact','recommendation'])&&/^[A-Z0-9_-]{1,80}$/.test(f.code)&&['I1','I2','I3','I4'].includes(f.imageId)&&text(f.note,1000)&&Array.isArray(f.claims)&&f.claims.length>=1&&f.claims.length<=4&&new Set(f.claims.map(c=>c.statement)).size===f.claims.length&&f.note===f.claims.map(c=>c.statement).join(' ')&&f.claims.every(c=>keys(c,['statement','kind','region','measurementRef','uncertainty'])&&text(c.statement,400)&&kinds.includes(c.kind)&&box(c.region)&&measurements.includes(c.measurementRef)&&(!c.measurementRef||c.kind==='layout'&&c.statement===propositions[c.measurementRef])&&typeof c.uncertainty==='string'&&c.uncertainty.length<=200)&&['low','medium','high'].includes(f.severity)&&text(f.businessImpact,300)&&text(f.recommendation,300);}
function atoms(f,index){if(!valid(f))throw Error('Atomic finding invalid');return f.claims.map((c,j)=>({id:'C'+(index+1)+'A'+(j+1),text:c.statement,kind:c.kind,region:[...c.region],measurementRef:c.measurementRef,uncertainty:c.uncertainty}));}
function validateSupport(a,claim,workflow){
 if(!claim.kind)return true; // Historical claims retain their original contract.
 const intersects=require('./agent-operations-grounding').intersects;
 const overlap=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 if(!a.evidence.every(e=>intersects(e.region,claim.region)&&overlap(e.region,claim.region)>=.5*(e.region[2]-e.region[0])*(e.region[3]-e.region[1])))return false;
 if(!a.observations.every(id=>{const fact=workflow.results.observation.result.facts.find(f=>f.id===id);return fact&&intersects(fact.region,claim.region);}))return false;
 if(claim.kind==='suitability'&&a.support!=='insufficient')return false;
 if(claim.measurementRef){
  const g=workflow.geometry,r=g?.results?.find(r=>r.imageId===workflow.claims.find(c=>c.atoms.some(x=>x.id===claim.id))?.imageId);
  // Reproduction is informative, but cannot establish the original capture's layout.
  if(a.support==='supported'&&(!r||g.provenance!=='capture-time'))return false;
  if(r&&g.provenance==='capture-time'){
   const observed=claim.measurementRef==='heading-overlap'?r.headingOverlap:claim.measurementRef==='price-overlap'?r.priceOverlap:!r.priceOverlap&&r.priceGap>0;
   if(a.support==='supported'&&!observed||a.support==='contradicted'&&observed)return false;
  }
 }
 return true;
}
const instructions='Use atomic-findings-v1. imageAssignments explicitly binds each imageId to its page and viewport; cite that binding rather than inventing a location. Each finding contains a concise note and 1..4 explicit independent claims; never derive claims from punctuation. Separate visible layout, exact quoted text, and subjective suitability into different claims. Each claim has statement (<=400), kind visible-object|text|layout|readability|suitability, normalized region [left,top,right,bottom], measurementRef (empty or heading-overlap|price-overlap|price-spacing), and uncertainty (<=200). Do not add a claim merely to fill the limit. Keep evidence-backed statements precise; omit unreadable named entries or retain them as explicitly uncertain separate claims. A suitability claim cannot be established from pixels alone. measurementRef names only a supplied backend measurement; never invent measurement values. note MUST exactly join claim statements with a single space, containing no unreviewed assertion. For a measurementRef, statement MUST match its proposition exactly: heading-overlap: "The badge overlaps the Growth heading."; price-overlap: "The badge overlaps the price."; price-spacing: "The price is below the badge with positive vertical spacing." These are propositions to test, never predetermined verdicts. Finding also includes severity low|medium|high, businessImpact and recommendation (<=300 each). Recommendations are proposals, not execution authority. No expected verdict or acceptance target is supplied.';
module.exports={VERSION,schema,valid,atoms,validateSupport,instructions,propositions};
