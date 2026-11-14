'use strict';
// Reuse the existing session/member/workspace owner policy. No connector credentials
// or authenticated Work session are accepted from a caller.
function createRuntime({kv,getSession,request,env=process.env}){
 const policy=require('./agent-operations-trusted-review').createOwnerReviewPolicy({getSession,getMember:email=>kv.get('user:email:'+email),getWorkspace:id=>kv.get('workspace:'+id),request});
 const assertOwner=async actor=>{await policy(actor,null,'read',{ownerHash:require('./agent-operations-monitoring').identity(actor.id),originalWorkspaceId:actor.workspaceId});return true;};
 const oauth=require('./agent-operations-vercel-oauth'),core=oauth.create({kv,env,runtime:{environment:env.VERCEL_ENV,branch:env.VERCEL_GIT_COMMIT_REF,origin:'https://'+env.VERCEL_URL,sourceCommit:env.VERCEL_GIT_COMMIT_SHA,release:require('./agent-operations-contracts').assertRelease()},assertOwner});
 const connection=Object.freeze({...core,async begin(actor){if(String(request.headers?.host||'')!==new URL(oauth.REDIRECT).host)throw Error('VCO_CALLBACK_SESSION_ORIGIN_REQUIRED');return core.begin(actor);}});
 return{connection,async owner(){const s=await getSession(request);if(!s||s.adminView)throw Error('VC_OWNER_REQUIRED');const actor={kind:'owner',verifiedOwner:true,id:String(s.email||'').trim().toLowerCase(),workspaceId:s.workspaceId};await assertOwner(actor);return actor;}};
}
module.exports={createRuntime};
