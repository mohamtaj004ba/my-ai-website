'use strict';
// Offline-only test wrapper. No native fetch reference is retained or invoked.
let calls=0;
global.fetch=async(url,options)=>{
  if(url!=='https://api.openai.com/v1/responses'||options.method!=='POST'||options.redirect!=='error')throw Error('Unexpected synthetic request');
  calls++;process.send({offlineProvider:{calls}});
  if(process.env.OFFLINE_PROVIDER_SCENARIO==='deny')return new Response(JSON.stringify({error:{code:'insufficient_permissions',message:'Synthetic denied response'}}),{status:403,headers:{'x-request-id':'req_offline_denied'}});
  if(process.env.OFFLINE_PROVIDER_SCENARIO==='format')return new Response(JSON.stringify({error:{type:'invalid_request_error',code:null,param:'text.format',message:"Response input messages must contain the word json. Echo: sk-proj-PRIVATE_SYNTHETIC_PAYLOAD_123456"}}),{status:400,headers:{'x-request-id':'req_offline_format'}});
  if(process.env.OFFLINE_PROVIDER_SCENARIO==='smoke_format')return new Response(JSON.stringify({error:{type:'invalid_request_error',code:'invalid_type',param:'input',message:'Invalid input: expected a string. Supplied "PRIVATE_SYNTHETIC_PAYLOAD" Bearer synthetic-offline-key https://private.example/SENSITIVE_UNKNOWN_VALUE'}}),{status:400,headers:{'x-request-id':'req_offline_smoke'}});
  const request=JSON.parse(options.body),stage=['chief','inspect','review','report'][calls-1];
  const smoke=process.env.OFFLINE_PROVIDER_SCENARIO==='smoke';
  if(!stage||smoke&&calls!==1||request.model!=='gpt-4.1-2025-04-14'||request.tools.length||request.store!==false||request.max_output_tokens!==(smoke?128:1500))throw Error('Unexpected synthetic request shape');
  const result=smoke?{stage:'chief',note:'SMOKE_OK'}:{stage,note:'OFFLINE synthetic output',...(stage==='chief'?{delegate:'website-visual-qa'}:{}),...(stage==='inspect'?{findings:[{code:'OFFLINE_FIXTURE',note:'Synthetic evidence only'}]}:{}),...(stage==='review'?{accepted:true}:{})};
  return new Response(JSON.stringify({status:'completed',model:request.model,usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]}),{headers:{'content-type':'application/json','x-request-id':'req_offline_success'}});
};
require('../../scripts/agent-operations-worker.cjs').main().catch(()=>{process.exitCode=1;if(process.connected)process.disconnect();});
