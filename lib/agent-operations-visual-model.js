'use strict';
// Separate candidate profile. Legacy GPT-4.1 receipts, approvals and rates are immutable.
const {QA}=require('./agent-operations-qa');
const HYBRID=Object.freeze({...QA,profile:'hybrid-visual-qa',calls:2,maxMicros:1000000,callMicros:500000,model:'gpt-6.1-sol',reasoningEffort:'medium',serviceTier:'default',schemaVersion:'hybrid-v1',cacheMode:'explicit',pricingVersion:'2026-10-11-sol61-standard-no-cache',inputMicrosPerToken:2,outputMicrosPerToken:10,maxInputTokens:120000,observeOutputTokens:25000,adjudicateOutputTokens:25000,requestTimeoutMs:180000,evaluationHash:'23bdf8ef9529bee9728941dcd195b4f9be2a0c501432387fab70ac998d1dc4e2',objective:'Independently observe immutable original images, seal observations, then assess the pinned adversarial claims. Hybrid deterministic checks and independent acceptance are separate; no capture, browsing, delegation, repair or release.'});
const isHybrid=t=>t?.profile===HYBRID.profile;
const outputLimit=t=>isHybrid(t)?t.stage==='observe'?HYBRID.observeOutputTokens:HYBRID.adjudicateOutputTokens:1500;
const approvalIdentity=a=>isHybrid(a)&&a.model===HYBRID.model&&a.reasoningEffort===HYBRID.reasoningEffort&&a.schemaVersion===HYBRID.schemaVersion&&a.pricingVersion===HYBRID.pricingVersion&&a.serviceTier===HYBRID.serviceTier&&a.cacheMode===HYBRID.cacheMode&&a.modelAccessVerified===true;
const identity=()=>({model:HYBRID.model,reasoningEffort:HYBRID.reasoningEffort,schemaVersion:HYBRID.schemaVersion,pricingVersion:HYBRID.pricingVersion,serviceTier:HYBRID.serviceTier,cacheMode:HYBRID.cacheMode});
function usageCost(t,input,output){if(!Number.isSafeInteger(input)||input<0||input>HYBRID.maxInputTokens||!Number.isSafeInteger(output)||output<0||output>outputLimit(t))throw Error('Unverified hybrid usage');return input*HYBRID.inputMicrosPerToken+output*HYBRID.outputMicrosPerToken;}
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const str={type:'string'},number={type:'number'},region={type:'array',items:number,minItems:4,maxItems:4};
function schema(stage){const fact=object({id:str,imageId:{type:'string',enum:['I1','I2','I3','I4']},region,observed:str,readability:{type:'string',enum:['clear','limited','unreadable']},uncertainty:str});const atom=object({id:str,support:{type:'string',enum:['supported','contradicted','insufficient']},probability:number,reason:str,observations:{type:'array',items:str},evidence:{type:'array',items:object({imageId:{type:'string',enum:['I1','I2','I3','I4']},region})},uncertainty:str});const s=stage==='observe'?object({stage:{type:'string',enum:['observe']},facts:{type:'array',items:fact},note:str}):stage==='adjudicate'?object({stage:{type:'string',enum:['adjudicate']},findings:{type:'array',items:object({code:str,decision:{type:'string',enum:['accept','reject']},atoms:{type:'array',items:atom}})},note:str}):null;if(!s)throw Error('Hybrid stage denied');return{type:'json_schema',name:'callercore_'+stage+'_v1',strict:true,schema:s};}
function requestBound(body,images){
 if(body.prompt_cache_options?.mode!=='explicit'||Object.keys(body.prompt_cache_options).length!==1)throw Error('Explicit no-cache contract required');
 const hasBreakpoint=value=>value&&typeof value==='object'&&(Object.keys(value).some(k=>['prompt_cache_breakpoint','cache_control','cache_breakpoints','breakpoints'].includes(k))||Object.values(value).some(hasBreakpoint));
 if(hasBreakpoint(body))throw Error('Cache breakpoint denied');
 // Include all textual instructions, strict schema, metadata and overhead as UTF-8 bytes (conservative token bound).
 const clean=structuredClone(body);for(const m of clean.input||[])m.content=m.content.filter(c=>c.type!=='input_image');
 const textBytes=Buffer.byteLength(JSON.stringify(clean));
 // Fixed four original PNGs only. 20,000 tokens/image is an intentionally wide planning allowance,
 // not a verified GPT-6.1 sizing contract. Live admission additionally requires project/capability verification.
 if(images.length!==4||images.some(i=>![390,1440].includes(i.viewport)||i.height!==1000))throw Error('Hybrid image bound denied');
 const upper=textBytes+images.length*20000;if(upper>HYBRID.maxInputTokens)throw Error('Hybrid input budget exceeded');
 if(upper*2+body.max_output_tokens*10>HYBRID.callMicros)throw Error('Hybrid reservation insufficient');return{inputTokenPlanningBound:upper,visionSizingVerified:false};
}
module.exports={HYBRID,isHybrid,outputLimit,approvalIdentity,identity,usageCost,schema,requestBound};
