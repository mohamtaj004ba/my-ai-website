'use strict';
// Reuse CallerCore's existing owner-scoped Vercel broker. GET-only project proof;
// no operator cookies, new credential, configurable URL or provider write.
const crypto=require('node:crypto'),policy=require('./agent-operations-legacy-maintenance-policy.json');
const identity=x=>crypto.createHash('sha256').update(String(x||'')).digest('hex');
const check=x=>{if(!x)throw Error('ENG_LEGACY_PROJECT_PROOF');};
async function verify({actor,runtime,connection,assertOwner,clock=Date.now}={}){
 check(actor?.kind==='owner'&&actor.verifiedOwner===true&&identity(actor.id)===policy.ownerHash&&actor.workspaceId===policy.workspaceId&&clock()<policy.expiresAt);
 check(runtime?.environment==='preview'&&runtime.branch===policy.branch&&/^[a-f0-9]{40}$/.test(runtime.commit||'')&&/^dpl_[A-Za-z0-9]+$/.test(runtime.deploymentId||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(runtime.origin||''));
 check(connection&&typeof assertOwner==='function');
 const bound={deploymentId:runtime.deploymentId,sourceCommit:runtime.commit},deadline=clock()+10000;
 const authorize=async input=>{check(clock()<deadline&&clock()<policy.expiresAt&&(!input||input.deploymentId===bound.deploymentId&&input.sourceCommit===bound.sourceCommit));check(await assertOwner(actor)===true);return true;};
 await authorize();const before=await connection.status(actor);check(before.connected===true&&/^icfg_[A-Za-z0-9]+$/.test(before.configurationId||''));
 const credentialBroker=(request,options)=>connection.credentialBroker(actor,request,{...options,authorize,deadline});
 const providerEvidence=await require('./agent-operations-vercel-connection').create({connectionId:before.configurationId,authorize,credentialBroker,clock}).inspect(bound);
 await authorize();const after=await connection.status(actor);check(after.connected===true&&after.configurationId===before.configurationId&&after.revision===before.revision);
 check(providerEvidence.status==='available'&&providerEvidence.state==='READY'&&providerEvidence.projectId===policy.projectId&&providerEvidence.deploymentId===runtime.deploymentId&&providerEvidence.sourceCommit===runtime.commit&&providerEvidence.origin===runtime.origin&&providerEvidence.paidDispatch===false&&providerEvidence.writes===false);
 return{providerEvidence,providerObservedAt:clock(),providerTeamId:policy.teamId};
}
module.exports={verify};
