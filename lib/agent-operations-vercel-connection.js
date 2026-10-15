'use strict';
// Inactive server adapter. Existing durable gateway supplies authorize; broker supplies
// provider-verified installation metadata. No OAuth exchange, vault, write or grant here.
const deployment=require('./agent-operations-engineering-deployment');
const diagnostics=require('./agent-operations-vercel-diagnostics');
const PROJECT=deployment.PROJECT,TEAM='team_6Rg3DdCrvOml6oEGwx6Ndf1I';
const check=(ok,code)=>{if(!ok)throw require('./agent-operations-vercel-diagnostics').error(code);};
function create({connectionId,authorize,credentialBroker,fetchImpl=fetch,clock=Date.now,trace}={}){
 check(/^icfg_[A-Za-z0-9]+$/.test(connectionId||'')&&typeof authorize==='function'&&typeof credentialBroker==='function','VC_CONFIGURATION_REQUIRED');
 return Object.freeze({async inspect(input,{signal}={}){
  check(input&&Object.keys(input).sort().join(',')==='deploymentId,sourceCommit'&&/^dpl_[A-Za-z0-9]+$/.test(input.deploymentId)&&/^[a-f0-9]{40}$/.test(input.sourceCommit),'VC_REQUEST_DENIED');
  const bound=Object.freeze({...input}),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;let token,lease;
  async function bounded(p){check(!combined.aborted,'VC_CANCELLED_OR_TIMEOUT');let stop;try{return await Promise.race([p,new Promise((_,reject)=>{stop=()=>reject(require('./agent-operations-vercel-diagnostics').error('VC_CANCELLED_OR_TIMEOUT'));combined.addEventListener('abort',stop,{once:true});})]);}finally{if(stop)combined.removeEventListener('abort',stop);}}
  async function guard(){check(!combined.aborted,'VC_CANCELLED_OR_TIMEOUT');check(await diagnostics.span(trace,'adapter-authorize',()=>bounded(Promise.resolve().then(()=>authorize(bound))))===true,'VC_AUTHORITY_DENIED');if(lease){check(lease.internalLeaseExpiresAt>clock()&&await diagnostics.span(trace,'adapter-lease',()=>bounded(Promise.resolve().then(()=>lease.revalidate())))===true,'VC_AUTHORITY_DENIED');}check(!combined.aborted,'VC_CANCELLED_OR_TIMEOUT');}
  try{
   await guard();lease=await diagnostics.span(trace,'credential-broker',()=>bounded(Promise.resolve().then(()=>credentialBroker({connectionId,projectId:PROJECT,teamId:TEAM},{signal:combined,trace}))));check(lease&&typeof lease.revalidate==='function','VC_CREDENTIAL_SCOPE_DENIED');await guard();
   check(lease&&typeof lease.token==='string'&&/^[A-Za-z0-9_-]{8,512}$/.test(lease.token)&&lease.configurationId===connectionId&&lease.teamId===TEAM&&lease.environment==='preview'&&lease.disabled===false&&lease.resourceSelection==='selected'&&Array.isArray(lease.projectIds)&&lease.projectIds.length===1&&lease.projectIds[0]===PROJECT&&Number.isSafeInteger(lease.internalLeaseExpiresAt)&&lease.internalLeaseExpiresAt>clock()&&lease.providerExpiresAt===null,'VC_CREDENTIAL_SCOPE_DENIED');
   // Normalized broker facts, not invented OAuth scope names. The provider grant may
   // prepare future deployment writes; this adapter always exposes GET-only behavior.
   const p=lease.permissions;check(p&&p.project==='read'&&['read','read-write'].includes(p.deployment)&&Object.keys(p).every(k=>['project','deployment','integration-configuration'].includes(k))&&(!p['integration-configuration']||p['integration-configuration']==='read'),'VC_CREDENTIAL_SCOPE_DENIED');token=lease.token;
   const expected='https://api.vercel.com/v13/deployments/'+bound.deploymentId;
   const result=await diagnostics.span(trace,'deployment-read',()=>bounded(deployment.inspect({...bound,credential:token,signal:combined,fetchImpl:async(url,options)=>{check(url===expected&&options.method==='GET'&&options.redirect==='error','VC_TRANSPORT_DENIED');await guard();return diagnostics.span(trace,'deployment-http',()=>bounded(fetchImpl(url+'?teamId='+TEAM,options)));}})));
   await guard();return result;
  }catch(error){diagnostics.recordError(trace,error);return{version:'engineering-deployment-evidence-v1',status:'unavailable',diagnostic:combined.aborted?'cancelled-or-timeout':'connection-authority-or-provider-unconfirmed',sourceCommit:bound.sourceCommit,paidDispatch:false,writes:false};}finally{controller.abort();clearTimeout(timer);token=undefined;}
 }});
}
module.exports={create,PROJECT,TEAM};
