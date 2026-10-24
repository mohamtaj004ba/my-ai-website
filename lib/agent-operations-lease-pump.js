'use strict';
// Trusted parent liveness only. Never retries execution, dispatch or spending.
const VERSION='renew-lease-v1';
function transportOnly(e){return !e?.brokerStatus&&['TimeoutError','AbortError'].includes(e?.name)||!e?.brokerStatus&&['UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','ECONNRESET','ETIMEDOUT'].includes(e?.cause?.code||e?.code);}
function create({dto,executionId,approvalHash,runtime,send,signal,onFailure,onEvent=()=>{},clock=Date.now,intervalMs=5000,attemptMs=4000}={}){
 let stopped=false,sequence=0,leaseUntil=dto.leaseUntil,pending=Promise.resolve(),timer;
 const identity={runtimeOrigin:runtime?.origin||null,sourceCommit:runtime?.commit||null,workflowId:dto.id,stage:dto.stage,fence:dto.fence,executionId,stageStarted:dto.stageStarted,deadline:dto.deadline,contractHash:dto.contractHash,approvalHash};
 async function renew(){
  if(stopped||signal?.aborted)return;
  const command={type:VERSION,stage:identity.stage,fence:identity.fence,executionId,sequence:sequence+1,contractHash:identity.contractHash,approvalHash};
  for(let attempt=0;attempt<2;attempt++){
   if(stopped||signal?.aborted)throw Error('Lease pump stopped');
   if(clock()+attemptMs+1000>=leaseUntil)throw Error('Lease renewal safety margin exhausted');
   try{
    // Own a referenced timer: AbortSignal.timeout alone does not keep Node alive
    // when a broken transport has no remaining socket/handle to drive shutdown.
    const timeout=new AbortController(),deadline=setTimeout(()=>timeout.abort(new DOMException('Lease renewal timed out','TimeoutError')),attemptMs);
    const bounded=AbortSignal.any([...(signal?[signal]:[]),timeout.signal]);let abort;
    const interrupted=new Promise((_,reject)=>{abort=()=>reject(bounded.reason);bounded.addEventListener('abort',abort,{once:true});});
    let receipt;try{if(bounded.aborted)throw bounded.reason;receipt=await Promise.race([send(command,bounded),interrupted]);}finally{clearTimeout(deadline);bounded.removeEventListener('abort',abort);}
    if(stopped||signal?.aborted)throw Error('Lease pump stopped');
    if(!receipt||receipt.version!==VERSION||Object.entries(identity).some(([k,v])=>receipt[k]!==v)||receipt.sequence!==sequence+1||!Number.isSafeInteger(receipt.leaseUntil)||receipt.leaseUntil<=clock()+1000||receipt.leaseUntil>Math.min(clock()+30000,identity.deadline,identity.stageStarted+150000))throw Error('Lease confirmation identity denied');
    sequence++;leaseUntil=receipt.leaseUntil;onEvent({leaseRenewed:true,stage:identity.stage,executionId,sequence,leaseUntil,attempts:attempt+1});return;
   }catch(e){if(attempt||!transportOnly(e)||stopped||signal?.aborted)throw e;onEvent({leaseTransportInterrupted:true,stage:identity.stage,executionId,sequence:command.sequence});}
  }
 }
 function schedule(){if(stopped)return;timer=setTimeout(()=>{pending=renew().catch(e=>{if(!stopped){stopped=true;onFailure(e);}}).finally(schedule);},intervalMs);}
 schedule();
 return{async stop({refresh=false}={}){clearTimeout(timer);try{await pending;clearTimeout(timer);if(refresh&&!stopped)await renew();}finally{stopped=true;clearTimeout(timer);}},get sequence(){return sequence;}};
}
module.exports={VERSION,create,transportOnly};
