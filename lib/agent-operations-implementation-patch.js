'use strict';
// Inert text preparation only. This module never loads, executes or publishes source.
const {createHash}=require('node:crypto');
const VERSION='engineering-implementation-patch-v1',PROFILE='starter-automations-fallback-v1';
const BEFORE="    ['automations',d=>{automationsData=d.automations||[]}],";
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
function deny(code,path='$'){throw Object.assign(Error(code),{validationIssue:{location:path,mismatch:code}});}
function check(ok,code,path){if(!ok)deny(code,path);}
const string=max=>({type:'string',pattern:'^[\\s\\S]{1,'+max+'}$'}),list=(items,min=1,max=4)=>({type:'array',items,minItems:min,maxItems:max}),object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
// One reviewed grammar, not a JavaScript evaluator or general patch capability.
// Whitespace and either quote style are allowed; identifiers and handler stay fixed.
const tokens=['...','(','has','(','automations',')','?','[','[','automations',',','d','=>','{','automationsData','=','d','.','automations','||','[',']','}',']',']',':','[',']',')',','];
const grammar=new RegExp('^[ \\t\\r\\n]*'+tokens.map((token,i)=>i===4||i===9?'(?:\'automations\'|"automations")':token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[ \\t\\r\\n]*')+'[ \\t\\r\\n]*$');
const bindingProperties={ownerHash:string(64),workspaceHash:string(64),taskId:string(170),executionId:string(170),sourceCommit:string(40),deploymentId:string(104),origin:string(250),releaseHash:string(64),contextHash:string(64)};
function schema(){return object({version:{type:'string',enum:[VERSION]},profile:{type:'string',enum:[PROFILE]},binding:object(bindingProperties),path:{type:'string',enum:['dashboard.js']},beforeSha256:string(64),evidenceIds:list(string(80)),edits:list(object({beforeText:string(2048),afterText:string(2048),explanation:string(400)}),1,1),expectedBehavior:string(500),risks:list(string(300)),verification:list(string(300)),acceptanceMapping:list(object({criterion:{type:'integer',minimum:1,maximum:4},explanation:string(300),status:{type:'string',enum:['proposed','unverified']}}))});}
function safeText(value,max,path){check(typeof value==='string'&&value.trim().length>0&&Buffer.byteLength(value)<=max&&!/[\u0000\u202a-\u202e\u2066-\u2069\ud800-\udfff]/u.test(value),'IMPLEMENTATION_TEXT',path);}
function validateBinding(b){check(exact(b,Object.keys(bindingProperties)),'IMPLEMENTATION_BINDING');for(const k of ['ownerHash','workspaceHash','releaseHash','contextHash'])check(/^[a-f0-9]{64}$/.test(b[k]||''),'IMPLEMENTATION_BINDING');check(/^[a-f0-9]{40}$/.test(b.sourceCommit||'')&&['taskId','executionId'].every(k=>/^[A-Za-z0-9_-]{1,170}$/.test(b[k]||''))&&/^dpl_[A-Za-z0-9]{1,100}$/.test(b.deploymentId||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(b.origin||''),'IMPLEMENTATION_BINDING');}
function validate(value,context){
 check(exact(value,Object.keys(schema().properties))&&value.version===VERSION&&value.profile===PROFILE&&value.path==='dashboard.js','IMPLEMENTATION_CONTRACT');
 check(context&&typeof context.sourceText==='string'&&Buffer.byteLength(context.sourceText)<=700000,'IMPLEMENTATION_SOURCE');validateBinding(context.binding);validateBinding(value.binding);
 check(Object.keys(bindingProperties).every(k=>context.binding[k]===value.binding[k]),'IMPLEMENTATION_BINDING');
 check(value.beforeSha256===hash(context.sourceText),'IMPLEMENTATION_SOURCE');
 check(Array.isArray(context.evidenceIds)&&context.evidenceIds.length>0&&Array.isArray(value.evidenceIds)&&value.evidenceIds.length>0&&value.evidenceIds.length<=4&&new Set(value.evidenceIds).size===value.evidenceIds.length&&value.evidenceIds.every(id=>context.evidenceIds.includes(id)),'IMPLEMENTATION_EVIDENCE');
 check(Array.isArray(value.edits)&&value.edits.length===1,'IMPLEMENTATION_EDITS');const e=value.edits[0];
 check(exact(e,['beforeText','afterText','explanation'])&&e.beforeText===BEFORE&&context.sourceText.indexOf(BEFORE)>=0&&context.sourceText.indexOf(BEFORE)===context.sourceText.lastIndexOf(BEFORE),'IMPLEMENTATION_SCOPE','$.edits[0].beforeText');
 safeText(e.afterText,2048,'$.edits[0].afterText');safeText(e.explanation,400,'$.edits[0].explanation');check(e.afterText!==BEFORE,'IMPLEMENTATION_NO_CHANGE');
 // Only the one server-owned feed entry can change. There is no source evaluator.
 // These conservative lexical checks are defense in depth, not an execution sandbox.
 check(!/(?:\\|<\/?script\b|\b(?:eval|Function|require|import|process|globalThis|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document|window|setTimeout|setInterval|constructor|__proto__|prototype)\b|\b(?:authorization|credentials|apiKey|audit|grant|permission|activation|publication|emergencyStop)\b)/i.test(e.afterText),'IMPLEMENTATION_FORBIDDEN_SOURCE','$.edits[0].afterText');
 check(grammar.test(e.afterText),'IMPLEMENTATION_REPLACEMENT_GRAMMAR','$.edits[0].afterText');
 safeText(value.expectedBehavior,500,'$.expectedBehavior');for(const k of ['risks','verification']){check(Array.isArray(value[k])&&value[k].length>0&&value[k].length<=4,'IMPLEMENTATION_REPORT','$.'+k);value[k].forEach((x,i)=>safeText(x,300,'$.'+k+'['+i+']'));}
 check(Number.isSafeInteger(context.criteriaCount)&&context.criteriaCount>=1&&context.criteriaCount<=4&&Array.isArray(value.acceptanceMapping)&&value.acceptanceMapping.length===context.criteriaCount,'IMPLEMENTATION_CRITERIA');
 const seen=new Set();value.acceptanceMapping.forEach((m,i)=>{check(exact(m,['criterion','explanation','status'])&&Number.isSafeInteger(m.criterion)&&m.criterion>=1&&m.criterion<=context.criteriaCount&&!seen.has(m.criterion)&&['proposed','unverified'].includes(m.status),'IMPLEMENTATION_CRITERIA');seen.add(m.criterion);safeText(m.explanation,300,'$.acceptanceMapping['+i+'].explanation');});
 return structuredClone(value);
}
function assertUnambiguousJSON(input){check(typeof input==='string'&&Buffer.byteLength(input)<=24000,'IMPLEMENTATION_BOUNDS');try{JSON.parse(input);}catch{deny('IMPLEMENTATION_JSON');}
 // JSON.parse accepts duplicate object keys; reject ambiguous wire artifacts.
 const tokens=input.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g)||[],stack=[];
 for(let i=0;i<tokens.length;i++){const token=tokens[i];if(token==='{')stack.push(new Set());else if(token==='[')stack.push(null);else if(token==='}'||token===']')stack.pop();else if(token[0]==='"'&&tokens[i+1]===':'){const keys=stack[stack.length-1],key=JSON.parse(token);check(keys instanceof Set&&!keys.has(key),'IMPLEMENTATION_AMBIGUOUS_JSON');keys.add(key);}}
 return true;}
function parse(input,context){check(typeof input==='string'&&Buffer.byteLength(input)<=16000,'IMPLEMENTATION_BOUNDS');assertUnambiguousJSON(input);return validate(JSON.parse(input),context);}
function normalize(value,context){const p=validate(value,context);return{version:'engineering-text-proposal-v1',path:p.path,beforeSha256:p.beforeSha256,edits:p.edits.map(e=>({beforeText:e.beforeText,afterText:e.afterText}))};}
module.exports={VERSION,PROFILE,BEFORE,hash,schema,validate,parse,normalize,assertUnambiguousJSON};
