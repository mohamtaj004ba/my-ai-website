'use strict';
// Trusted owner controller orchestration, not a worker tool or retry executor.
// Callbacks must use authenticated, exact-release Preview endpoints. No default transport.
async function withActivation({prepare,activate,run,revoke,readback,renew,signal,durationMs=600000,renewMs=10000}={}){
 if(![prepare,activate,run,revoke,readback,renew].every(f=>typeof f==='function')||!Number.isSafeInteger(durationMs)||durationMs<1||durationMs>600000||!Number.isSafeInteger(renewMs)||renewMs<1||renewMs>10000)throw Error('Activation control dependencies required');
 let prepared,result,error,shutdown,heartbeat,renewing=Promise.resolve(),stop;
 const controller=new AbortController(),cancelled=new Promise((_,reject)=>stop=reject),abort=()=>{controller.abort();stop(Error('Activation cancelled or timed out'));};
 cancelled.catch(()=>{});signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,durationMs);
 const bounded=callback=>Promise.race([Promise.resolve().then(()=>{if(controller.signal.aborted)throw Error('Activation cancelled or timed out');return callback(prepared,{signal:controller.signal});}),cancelled]);
 try{if(signal?.aborted)abort();prepared=await bounded(prepare);await bounded(activate);heartbeat=setInterval(()=>{renewing=renewing.then(()=>renew(prepared,{signal:controller.signal})).catch(abort);},renewMs);result=await bounded(run);}
 catch(e){error=e;}
 finally{
  // prepare must assign an owner-selected ID before any request; revoke uses that ID
  // even when the prepare response is lost and no scoped token was received.
  clearInterval(heartbeat);clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();
  const cleanupSignal=AbortSignal.timeout(15000);
  const cleanup=callback=>Promise.race([Promise.resolve().then(()=>callback(prepared,{signal:cleanupSignal})),new Promise((_,reject)=>cleanupSignal.addEventListener('abort',()=>reject(Error('Shutdown timeout')),{once:true}))]);
  try{await cleanup(revoke);shutdown=await cleanup(readback);if(shutdown?.paidExecution!==false||shutdown?.replacementPaidExecution!==false)throw Error('Authoritative shutdown unconfirmed');}
  catch(e){throw Object.assign(Error('Activation shutdown failed; owner intervention required'),{cause:e,executionError:error});}
 }
 if(error)throw error;return {result,shutdown};
}
module.exports={withActivation};
