'use strict';
// Disposable localhost Redis only; never consumes application credentials.
const {command}=require('./agent-operations-redis-client.cjs');
process.once('message',async({prefix,nonce})=>{
 if(!/^test:node-controller:[a-f0-9-]+:$/.test(prefix)||!/^[a-f0-9]{32}$/.test(nonce))throw Error('Disposable fixture required');
 const kv={get:key=>command(['GET',prefix+key]),eval:(script,keys,args)=>command(['EVAL',script,keys.length,...keys.map(k=>prefix+k),...args])};
 const service=require('../../lib/agent-operations-lifecycle-verification').createVerification({kv,env:{VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_PAID_ENABLED:'false',CALLERCORE_AGENTOPS_LIFECYCLE_VERIFY_UNTIL:String(Date.now()+3600000)},runtime:{origin:'https://old.vercel.app',commit:'a'.repeat(40)}});
 const result=await service.controller({kind:'owner',verifiedOwner:true,id:'node-redis-owner'},{nonce,slot:0,scenario:'success'},{onEvent:event=>process.send?.({event})});process.send?.({result});process.disconnect();
});
