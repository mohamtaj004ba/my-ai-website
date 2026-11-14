'use strict';
// Real OAuth record/encryption/lease provenance; only provider responses substituted.
const oauth=require('../../lib/agent-operations-vercel-oauth');
module.exports=async function mint(request,options,authorize){
 const rows=new Map(),actor={kind:'owner',verifiedOwner:true,id:'owner@example.test',workspaceId:'workspace'},binding=options.binding;
 const kv={get:async k=>structuredClone(rows.get(k)||null),eval:async(_,[key],[before,after])=>{const old=rows.get(key);if((old?JSON.stringify(old):'')!==before)return 0;rows.set(key,JSON.parse(after));return 1;}};
 const api=oauth.create({kv,env:{VERCEL_ENV:'preview',CALLERCORE_VERCEL_CLIENT_ID:'oac_test',CALLERCORE_VERCEL_CLIENT_SECRET:'SYNTHETIC_SECRET',CALLERCORE_ENCRYPTION_KEY:'synthetic-encryption-key-at-least-32'},runtime:{branch:'feature/callercore-dashboards',sourceCommit:binding.sourceCommit,origin:'https://my-ai-website-test-mohamtaj004bas-projects.vercel.app',release:{digest:'b'.repeat(64)}},assertOwner:async()=>true,fetchImpl:async url=>Response.json(url.endsWith('/access_token')?{access_token:'private_QA_credential',team_id:oauth.TEAM}:url.includes('/v9/projects/')?{id:oauth.PROJECT,accountId:oauth.TEAM}:{id:request.connectionId,integrationId:'oac_test',teamId:oauth.TEAM,projectSelection:'selected',projects:[oauth.PROJECT],slug:oauth.SLUG,scopes:['read:project','read-write:deployment','read:integration-configuration']})});
 const begun=await api.begin(actor);await api.callback(actor,{code:'synthetic_code',state:new URL(begun.authorizationUrl).searchParams.get('state'),configurationId:request.connectionId,teamId:oauth.TEAM});
 return api.credentialBroker(actor,request,{...options,authorize,deadline:Date.now()+5000});
};
