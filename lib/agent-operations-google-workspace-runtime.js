'use strict';
// Existing CallerCore session and workspace-owner policy, never Work credentials.
function createRuntime({kv,getSession,request,env=process.env}){
 const policy=require('./agent-operations-trusted-review').createOwnerReviewPolicy({getSession,getMember:email=>kv.get('user:email:'+email),getWorkspace:id=>kv.get('workspace:'+id),request});
 const assertOwner=async actor=>{await policy(actor,null,'read',{ownerHash:require('./agent-operations-monitoring').identity(actor.id),originalWorkspaceId:actor.workspaceId});return true;};
 const oauth=require('./agent-operations-google-workspace-oauth'),core=oauth.create({kv,env,runtime:{deploymentId:env.VERCEL_DEPLOYMENT_ID,branch:env.VERCEL_GIT_COMMIT_REF,origin:'https://'+env.VERCEL_URL,sourceCommit:env.VERCEL_GIT_COMMIT_SHA,release:require('./agent-operations-contracts').assertRelease()},assertOwner});
 const connection=Object.freeze({...core,async begin(actor){if(String(request.headers?.host||'')!==new URL(oauth.REDIRECT).host)throw Error('GW_CALLBACK_SESSION_ORIGIN_REQUIRED');return core.begin(actor);}});
 return{connection,async owner(){const session=await getSession(request);if(!session||session.adminView)throw Error('GW_OWNER_REQUIRED');const actor={kind:'owner',verifiedOwner:true,id:String(session.email||'').trim().toLowerCase(),workspaceId:session.workspaceId};await assertOwner(actor);return actor;}};
}
module.exports={createRuntime};
