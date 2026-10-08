const {hoursAt}=require('./voice-policy');
function businessContext(policy,now=Date.now()){
  const hours=hoursAt(policy,now),end=now+policy.maxDurationSeconds*1000;
  let validAcrossCall=true;
  for(let at=now;at<=end;at+=30000)if(hoursAt(policy,at).open!==hours.open)validAcrossCall=false;
  if(hoursAt(policy,end).open!==hours.open)validAcrossCall=false;
  return {source:'CallerCore verified call-start business hours',...hours,validAcrossCall,checkedAt:new Date(now).toISOString(),appointmentAvailability:'unknown; no calendar access'};
}
async function deliverContext(kv,ctx,provider){
  if(ctx.canonical.status!=='active'||ctx.config.state!=='ready'||Number(ctx.agent.updatedAt||0)!==ctx.config.agentRevision||typeof provider.appendContext!=='function')return;
  // One attempt only: an uncertain live-control response must not duplicate an action.
  if(!await kv.set('voice:context-lock:'+ctx.canonical.id,'claimed',{nx:true,ex:86400}))return;
  const data=businessContext(ctx.policy);let state='unconfirmed',failureCode;
  try{await provider.appendContext(ctx.call,'Verified call-start business-hours context: '+JSON.stringify(data));state='submitted'}catch(error){
    // Store only bounded, known codes; provider errors can contain private URLs.
    failureCode=['VOICE_CONTROL_INVALID','VOICE_CONTEXT_TIMEOUT','VOICE_ACCESS_REQUIRED','VOICE_CONTEXT_UNCONFIRMED'].includes(error?.code)?error.code:'VOICE_CONTEXT_UNCONFIRMED';
  }
  return {state,validAcrossCall:data.validAcrossCall,open:data.open,...(failureCode?{failureCode}:{})};
}
module.exports={businessContext,deliverContext};
