'use strict';
// v1 remains immutable for historical replay. v2 gives the model no concurrency fields.
const legacy=require('./agent-operations-chief-model'),context=require('./agent-operations-chief-context');
const VERSION='chief-intent-v2';
const contracts=require('./agent-operations-contracts'),schema=()=>contracts.schema('chief');
function request(ctx){
 const built=legacy.request(ctx,{format:'tools'});
 built.body.tools=[{type:'function',name:'delegate_inspection_v2',description:'Propose only inspection intent for the backend-assigned task; backend owns task identity, revisions and execution.',strict:true,parameters:schema()}];
 built.body.text.format=contracts.format('chief');
 built.body.instructions=contracts.instructions('chief');
 contracts.assertRequest('chief',built.body);
 if(Buffer.byteLength(JSON.stringify(built.body))>32000)throw Error('Chief intent input budget exceeded');
 return {...built,contractVersion:VERSION};
}
function receipt(data,ctx){
 const fail=code=>{throw Object.assign(Error(code),{contractCode:code});},u=data?.usage;
 if(!context.valid(ctx))fail('CHIEF_CONTEXT_EXPIRED');
 if(data.status!=='completed'||data.model!==legacy.CONFIG.model||data.service_tier!=='default'||!Number.isSafeInteger(u?.input_tokens)||u.input_tokens<0||u.input_tokens>32000||!Number.isSafeInteger(u.output_tokens)||u.output_tokens<0||u.output_tokens>20000||u.input_tokens_details?.cached_tokens!==0||u.input_tokens_details?.cache_write_tokens!==0||!Number.isSafeInteger(u.output_tokens_details?.reasoning_tokens)||u.output_tokens_details.reasoning_tokens<0||u.output_tokens_details.reasoning_tokens>u.output_tokens)fail('CHIEF_USAGE_INVALID');
 if(!Array.isArray(data.output)||data.output.some(o=>!['function_call','reasoning'].includes(o.type)))fail('CHIEF_OUTPUT_INVALID');
 const calls=data.output.filter(o=>o.type==='function_call');
 if(calls.length!==1||calls[0].name!=='delegate_inspection_v2'||typeof calls[0].arguments!=='string'||calls[0].arguments.length>12000)fail('CHIEF_INTENT_INVALID');
 let intent;try{intent=JSON.parse(calls[0].arguments);}catch{fail('CHIEF_INTENT_INVALID');}
 if(!contracts.valid('chief',intent)||!intent.reason.trim())fail('CHIEF_INTENT_INVALID');
 const actualMicros=u.input_tokens*2+u.output_tokens*10;if(actualMicros>legacy.CONFIG.reservationMicros)fail('CHIEF_USAGE_INVALID');
 return {intent,actualMicros,inputTokens:u.input_tokens,outputTokens:u.output_tokens,reasoningTokens:u.output_tokens_details.reasoning_tokens};
}
module.exports={VERSION,schema,request,receipt};
